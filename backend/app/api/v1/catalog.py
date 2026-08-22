import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import Role, User
from app.schemas.catalog import (
    CategoryCreate,
    CategoryResponse,
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)
from app.services.catalog_service import (
    create_category,
    create_product,
    deactivate_product,
    get_product,
    list_categories,
    list_products,
    update_product,
)

router = APIRouter(tags=["Catalog"])


# PUBLIC / CUSTOMER-FACING CATALOG ENDPOINTS
# PUBLIC ACCESS DECISION: Product catalog and category endpoints are intentionally public (unprotected)
# so guest visitors and customers can search and browse products without requiring an active user session.

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Fetch all product categories."""
    return await list_categories(db)


@router.get("/products", response_model=ProductListResponse)
async def get_products(
    search: Optional[str] = Query(None, description="Search product name"),
    category_id: Optional[uuid.UUID] = Query(None, description="Filter by category UUID"),
    min_price: Optional[Decimal] = Query(None, ge=0, description="Minimum price filter"),
    max_price: Optional[Decimal] = Query(None, ge=0, description="Maximum price filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("newest", pattern="^(price_asc|price_desc|name|newest)$"),
    db: AsyncSession = Depends(get_db),
):
    """Browse public active products with filtering, search, sorting, and stock summary."""
    items, total = await list_products(
        db=db,
        search=search,
        category_id=category_id,
        min_price=min_price,
        max_price=max_price,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        include_inactive=False,
    )
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{id}", response_model=ProductResponse)
async def get_product_by_id(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Fetch single product details by ID."""
    return await get_product(db, id, include_inactive=False)


# ADMIN-ONLY CATALOG ENDPOINTS

@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
async def add_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Create a new product category."""
    return await create_category(db, data)


@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_product(
    data: ProductCreate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Create a new product."""
    return await create_product(db, data, actor=current_user)


@router.patch(
    "/products/{id}",
    response_model=ProductResponse,
)
async def edit_product(
    id: uuid.UUID,
    data: ProductUpdate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Update existing product details partially."""
    return await update_product(db, id, data, actor=current_user)


@router.delete(
    "/products/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_product(
    id: uuid.UUID,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Soft-delete a product by setting is_active=False."""
    await deactivate_product(db, id, actor=current_user)


@router.get(
    "/admin/products",
    response_model=ProductListResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
)
async def get_admin_products(
    search: Optional[str] = Query(None),
    category_id: Optional[uuid.UUID] = Query(None),
    min_price: Optional[Decimal] = Query(None, ge=0),
    max_price: Optional[Decimal] = Query(None, ge=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("newest", pattern="^(price_asc|price_desc|name|newest)$"),
    db: AsyncSession = Depends(get_db),
):
    """[Admin Only] Browse all products including inactive ones."""
    items, total = await list_products(
        db=db,
        search=search,
        category_id=category_id,
        min_price=min_price,
        max_price=max_price,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        include_inactive=True,
    )
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
