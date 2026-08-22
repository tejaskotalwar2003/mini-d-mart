import uuid
from decimal import Decimal
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.catalog import Category, Product
from app.models.store import Inventory, Store
from app.models.user import User
from app.schemas.catalog import CategoryCreate, ProductCreate, ProductResponse, ProductUpdate
from app.services.audit_service import log_action


async def list_categories(db: AsyncSession) -> List[Category]:
    """Retrieve all product categories ordered by name."""
    result = await db.execute(select(Category).order_by(Category.name.asc()))
    return list(result.scalars().all())


async def create_category(db: AsyncSession, data: CategoryCreate) -> Category:
    """Create a new category after validating slug uniqueness."""
    res = await db.execute(select(Category).where(Category.slug == data.slug))
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category with slug '{data.slug}' already exists.",
        )

    if data.parent_id:
        parent_res = await db.execute(select(Category).where(Category.id == data.parent_id))
        if not parent_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent category '{data.parent_id}' not found.",
            )

    category = Category(
        name=data.name,
        slug=data.slug,
        parent_id=data.parent_id,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def list_products(
    db: AsyncSession,
    search: Optional[str] = None,
    category_id: Optional[uuid.UUID] = None,
    min_price: Optional[Decimal] = None,
    max_price: Optional[Decimal] = None,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "newest",
    include_inactive: bool = False,
) -> Tuple[List[ProductResponse], int]:
    """Search, filter, paginate, and return products with aggregated inventory stock."""
    query = (
        select(
            Product,
            Category.name.label("category_name"),
            func.coalesce(func.sum(Inventory.quantity_available), 0).label("quantity_available"),
        )
        .join(Category, Product.category_id == Category.id)
        .outerjoin(Inventory, Product.id == Inventory.product_id)
        .group_by(Product.id, Category.name)
    )

    if not include_inactive:
        query = query.where(Product.is_active.is_(True))
        query = query.where(Product.parent_id.is_(None))

    if search:
        query = query.where(Product.name.ilike(f"%{search.strip()}%"))

    if category_id:
        query = query.where(Product.category_id == category_id)

    if min_price is not None:
        query = query.where(Product.price >= min_price)

    if max_price is not None:
        query = query.where(Product.price <= max_price)

    if sort_by == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort_by == "name":
        query = query.order_by(Product.name.asc())
    else:  # newest
        query = query.order_by(Product.created_at.desc())

    count_subquery = query.subquery()
    count_query = select(func.count()).select_from(count_subquery)
    count_res = await db.execute(count_query)
    total = count_res.scalar_one() or 0

    offset = (page - 1) * page_size
    paginated_query = query.offset(offset).limit(page_size)
    result = await db.execute(paginated_query)
    rows = result.all()

    items: List[ProductResponse] = []
    for product, cat_name, stock in rows:
        # Fetch all sibling variants (including parent and children)
        var_parent_id = product.id if product.parent_id is None else product.parent_id
        var_query = (
            select(Product, func.coalesce(func.sum(Inventory.quantity_available), 0).label("quantity_available"))
            .outerjoin(Inventory, Product.id == Inventory.product_id)
            .where((Product.parent_id == var_parent_id) | (Product.id == var_parent_id))
            .where(Product.is_active.is_(True))
            .group_by(Product.id)
        )
        var_res = await db.execute(var_query)
        variants_rows = var_res.all()
        
        from app.schemas.catalog import ProductVariantInfo
        variants_list = []
        for vp, v_stock in variants_rows:
            variants_list.append(
                ProductVariantInfo(
                    id=vp.id,
                    sku=vp.sku,
                    price=vp.price,
                    unit=vp.unit,
                    quantity_available=int(v_stock)
                )
            )
        # Sort variants by price ascending
        variants_list.sort(key=lambda x: x.price)

        resp = ProductResponse(
            id=product.id,
            category_id=product.category_id,
            category_name=cat_name,
            name=product.name,
            description=product.description,
            sku=product.sku,
            price=product.price,
            unit=product.unit,
            image_url=product.image_url,
            is_active=product.is_active,
            is_returnable=product.is_returnable,
            tax_rate=product.tax_rate if getattr(product, "tax_rate", None) is not None else Decimal("5.00"),
            quantity_available=int(stock),
            parent_id=product.parent_id,
            variants=variants_list,
        )
        items.append(resp)

    return items, total


async def get_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    include_inactive: bool = False,
) -> ProductResponse:
    """Fetch single product details including category name and total available stock."""
    query = (
        select(
            Product,
            Category.name.label("category_name"),
            func.coalesce(func.sum(Inventory.quantity_available), 0).label("quantity_available"),
        )
        .join(Category, Product.category_id == Category.id)
        .outerjoin(Inventory, Product.id == Inventory.product_id)
        .where(Product.id == product_id)
        .group_by(Product.id, Category.name)
    )

    if not include_inactive:
        query = query.where(Product.is_active.is_(True))

    res = await db.execute(query)
    row = res.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID '{product_id}' not found.",
        )

    product, cat_name, stock = row

    # Fetch all sibling variants (including parent and children)
    var_parent_id = product.id if product.parent_id is None else product.parent_id
    var_query = (
        select(Product, func.coalesce(func.sum(Inventory.quantity_available), 0).label("quantity_available"))
        .outerjoin(Inventory, Product.id == Inventory.product_id)
        .where((Product.parent_id == var_parent_id) | (Product.id == var_parent_id))
        .where(Product.is_active.is_(True))
        .group_by(Product.id)
    )
    var_res = await db.execute(var_query)
    variants_rows = var_res.all()

    from app.schemas.catalog import ProductVariantInfo
    variants_list = []
    for vp, v_stock in variants_rows:
        variants_list.append(
            ProductVariantInfo(
                id=vp.id,
                sku=vp.sku,
                price=vp.price,
                unit=vp.unit,
                quantity_available=int(v_stock)
            )
        )
    # Sort variants by price ascending
    variants_list.sort(key=lambda x: x.price)

    return ProductResponse(
        id=product.id,
        category_id=product.category_id,
        category_name=cat_name,
        name=product.name,
        description=product.description,
        sku=product.sku,
        price=product.price,
        unit=product.unit,
        image_url=product.image_url,
        is_active=product.is_active,
        is_returnable=product.is_returnable,
        tax_rate=product.tax_rate if getattr(product, "tax_rate", None) is not None else Decimal("5.00"),
        quantity_available=int(stock),
        parent_id=product.parent_id,
        variants=variants_list,
    )


async def create_product(
    db: AsyncSession,
    data: ProductCreate,
    actor: Optional[User] = None,
) -> ProductResponse:
    """Create a new product after validating SKU uniqueness and Category existence."""
    cat_res = await db.execute(select(Category).where(Category.id == data.category_id))
    if not cat_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID '{data.category_id}' does not exist.",
        )

    sku_res = await db.execute(select(Product).where(Product.sku == data.sku))
    if sku_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{data.sku}' already exists.",
        )

    product = Product(
        category_id=data.category_id,
        name=data.name,
        description=data.description,
        sku=data.sku,
        price=data.price,
        unit=data.unit,
        image_url=data.image_url,
        is_returnable=data.is_returnable,
        tax_rate=data.tax_rate if data.tax_rate is not None else Decimal("5.00"),
        is_active=True,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)

    # Initialize store inventory if quantity was provided
    if data.quantity is not None and data.quantity >= 0:
        store_res = await db.execute(select(Store))
        store = store_res.scalars().first()
        if store:
            inv = Inventory(
                product_id=product.id,
                store_id=store.id,
                quantity_available=data.quantity,
                quantity_reserved=0,
                reorder_threshold=10,
            )
            db.add(inv)
            await db.commit()

    await log_action(
        db,
        user_id=actor.id if actor else None,
        action="PRODUCT_CREATED",
        entity_type="Product",
        entity_id=product.id,
        metadata={"name": product.name, "sku": product.sku, "price": str(product.price)},
    )
    await db.commit()

    return await get_product(db, product.id, include_inactive=True)


async def update_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    data: ProductUpdate,
    actor: Optional[User] = None,
) -> ProductResponse:
    """Update existing product fields partially."""
    res = await db.execute(select(Product).where(Product.id == product_id))
    product = res.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID '{product_id}' not found.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "category_id" in update_data:
        cat_res = await db.execute(select(Category).where(Category.id == update_data["category_id"]))
        if not cat_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with ID '{update_data['category_id']}' not found.",
            )

    if "sku" in update_data and update_data["sku"] != product.sku:
        sku_res = await db.execute(select(Product).where(Product.sku == update_data["sku"]))
        if sku_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product with SKU '{update_data['sku']}' already exists.",
            )

    # Handle quantity update if provided
    if "quantity" in update_data and update_data["quantity"] is not None:
        qty = update_data.pop("quantity")
        store_res = await db.execute(select(Store))
        store = store_res.scalars().first()
        if store:
            inv_res = await db.execute(
                select(Inventory).where(Inventory.product_id == product.id, Inventory.store_id == store.id)
            )
            inv = inv_res.scalar_one_or_none()
            if inv:
                inv.quantity_available = qty
            else:
                inv = Inventory(
                    product_id=product.id,
                    store_id=store.id,
                    quantity_available=qty,
                    quantity_reserved=0,
                    reorder_threshold=10,
                )
                db.add(inv)

    for field, val in update_data.items():
        setattr(product, field, val)

    await db.commit()
    await db.refresh(product)

    await log_action(
        db,
        user_id=actor.id if actor else None,
        action="PRODUCT_UPDATED",
        entity_type="Product",
        entity_id=product.id,
        metadata={"changed_fields": {k: str(v) for k, v in update_data.items()}},
    )
    await db.commit()

    return await get_product(db, product.id, include_inactive=True)


async def deactivate_product(
    db: AsyncSession,
    product_id: uuid.UUID,
    actor: Optional[User] = None,
) -> None:
    """Soft delete a product by setting is_active=False."""
    res = await db.execute(select(Product).where(Product.id == product_id))
    product = res.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID '{product_id}' not found.",
        )

    product.is_active = False
    await db.commit()

    await log_action(
        db,
        user_id=actor.id if actor else None,
        action="PRODUCT_DEACTIVATED",
        entity_type="Product",
        entity_id=product.id,
        metadata={"name": product.name, "sku": product.sku},
    )
    await db.commit()
