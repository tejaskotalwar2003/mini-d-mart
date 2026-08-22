import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.cart import CartItemAdd, CartItemUpdate, CartResponse
from app.services.cart_service import add_item, get_cart_with_items, remove_item, update_item

router = APIRouter(prefix="/cart", tags=["Shopping Cart"])


@router.get("", response_model=CartResponse)
async def view_cart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve current user's active shopping cart."""
    return await get_cart_with_items(db, current_user.id)


@router.post("/items", response_model=CartResponse)
async def add_to_cart(
    payload: CartItemAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a product to cart or increase quantity."""
    return await add_item(db, current_user.id, payload.product_id, payload.quantity)


@router.patch("/items/{item_id}", response_model=CartResponse)
async def edit_cart_item(
    item_id: uuid.UUID,
    payload: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update item quantity in cart. Setting quantity to 0 removes the item."""
    return await update_item(db, current_user.id, item_id, payload.quantity)


@router.delete("/items/{item_id}", response_model=CartResponse)
async def delete_cart_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove item from cart."""
    return await remove_item(db, current_user.id, item_id)
