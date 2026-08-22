import uuid
from decimal import Decimal
from typing import Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.cart import Cart, CartItem
from app.models.catalog import Product
from app.models.store import Inventory
from app.schemas.cart import CartItemResponse, CartResponse


async def get_or_create_cart(db: AsyncSession, user_id: uuid.UUID) -> Cart:
    """Retrieve existing cart for user or create a new one."""
    res = await db.execute(select(Cart).where(Cart.user_id == user_id))
    cart = res.scalar_one_or_none()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
    return cart


async def _get_total_available_stock(db: AsyncSession, product_id: uuid.UUID) -> int:
    """Sum quantity_available across all store inventories for a given product."""
    res = await db.execute(
        select(func.coalesce(func.sum(Inventory.quantity_available), 0)).where(Inventory.product_id == product_id)
    )
    return int(res.scalar_one() or 0)


async def get_cart_with_items(db: AsyncSession, user_id: uuid.UUID) -> CartResponse:
    """Return populated CartResponse with item details and calculated subtotal."""
    cart = await get_or_create_cart(db, user_id)

    res = await db.execute(
        select(CartItem)
        .options(selectinload(CartItem.product))
        .where(CartItem.cart_id == cart.id)
        .order_by(CartItem.created_at.asc())
    )
    items = list(res.scalars().all())

    item_responses = []
    subtotal = Decimal("0.00")

    for item in items:
        unit_price = item.product.price
        line_total = Decimal(item.quantity) * unit_price
        subtotal += line_total
        item_responses.append(
            CartItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name,
                image_url=item.product.image_url,
                unit_price=unit_price,
                quantity=item.quantity,
                line_total=line_total,
            )
        )

    return CartResponse(
        id=cart.id,
        items=item_responses,
        subtotal=subtotal,
    )


async def add_item(
    db: AsyncSession,
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    quantity: int,
) -> CartResponse:
    """Add item to cart or increase quantity if already present, validating inventory bounds."""
    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity to add must be greater than zero.",
        )

    # 1. Check Product existence and active state
    prod_res = await db.execute(select(Product).where(Product.id == product_id))
    product = prod_res.scalar_one_or_none()
    if not product or not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID '{product_id}' not found or inactive.",
        )

    cart = await get_or_create_cart(db, user_id)

    # 2. Check if item already exists in cart
    item_res = await db.execute(
        select(CartItem).where(CartItem.cart_id == cart.id, CartItem.product_id == product_id)
    )
    existing_item = item_res.scalar_one_or_none()

    current_qty = existing_item.quantity if existing_item else 0
    target_qty = current_qty + quantity

    # 3. Validate against available stock
    total_stock = await _get_total_available_stock(db, product_id)
    if target_qty > total_stock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot add {quantity} units of '{product.name}'. "
                f"Requested total ({target_qty}) exceeds total available stock ({total_stock})."
            ),
        )

    if existing_item:
        existing_item.quantity = target_qty
    else:
        new_item = CartItem(
            cart_id=cart.id,
            product_id=product_id,
            quantity=quantity,
        )
        db.add(new_item)

    await db.commit()
    return await get_cart_with_items(db, user_id)


async def update_item(
    db: AsyncSession,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    quantity: int,
) -> CartResponse:
    """Update item quantity in cart. If quantity is 0, item is removed."""
    if quantity == 0:
        return await remove_item(db, user_id, item_id)

    cart = await get_or_create_cart(db, user_id)

    item_res = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
    )
    item = item_res.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cart item with ID '{item_id}' not found.",
        )

    total_stock = await _get_total_available_stock(db, item.product_id)
    if quantity > total_stock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Requested quantity ({quantity}) exceeds total available stock ({total_stock}).",
        )

    item.quantity = quantity
    await db.commit()
    return await get_cart_with_items(db, user_id)


async def remove_item(
    db: AsyncSession,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
) -> CartResponse:
    """Remove item from cart."""
    cart = await get_or_create_cart(db, user_id)

    item_res = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
    )
    item = item_res.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cart item with ID '{item_id}' not found.",
        )

    await db.delete(item)
    await db.commit()
    return await get_cart_with_items(db, user_id)


async def clear_cart(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Delete all items from user's cart."""
    cart = await get_or_create_cart(db, user_id)
    res = await db.execute(select(CartItem).where(CartItem.cart_id == cart.id))
    items = res.scalars().all()
    for item in items:
        await db.delete(item)
    await db.commit()
