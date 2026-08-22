import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.order import Order, OrderStatus
from app.models.user import Role, User
from app.schemas.order import CheckoutRequest, OrderResponse, OrderStatusUpdateRequest
from app.services.order_service import (
    checkout,
    get_order,
    list_all_staff_orders,
    list_upcoming_pickups,
    list_upcoming_deliveries,
    list_user_orders,
)
from app.services.order_state import transition_order

router = APIRouter(tags=["Orders"])


@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def place_order(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Place an order from items currently in the user's shopping cart."""
    return await checkout(db, current_user.id, payload)


@router.get("/orders", response_model=List[OrderResponse])
async def get_my_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch order history for the authenticated user."""
    return await list_user_orders(db, current_user.id)


@router.get("/orders/{id}", response_model=OrderResponse)
async def get_order_by_id(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch single order details by ID for the authenticated owner."""
    return await get_order(db, id, current_user.id)


@router.post("/orders/{id}/cancel", response_model=OrderResponse)
async def cancel_my_order(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Customer] Cancel own order (allowed only if status is PENDING or CONFIRMED)."""
    res = await db.execute(select(Order).where(Order.id == id))
    order = res.scalar_one_or_none()

    if not order or order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{id}' not found.",
        )

    return await transition_order(
        db=db,
        order=order,
        to_status=OrderStatus.CANCELLED,
        actor=current_user,
        note="Order cancelled by customer.",
    )


# STAFF & ADMIN ORDER MANAGEMENT ENDPOINTS

@router.patch(
    "/orders/{id}/status",
    response_model=OrderResponse,
    dependencies=[Depends(require_role(Role.STAFF, Role.ADMIN))],
)
async def update_order_status(
    id: uuid.UUID,
    payload: OrderStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Staff/Admin] Transition an order's status through the lifecycle state machine."""
    res = await db.execute(select(Order).where(Order.id == id))
    order = res.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{id}' not found.",
        )

    return await transition_order(
        db=db,
        order=order,
        to_status=payload.to_status,
        actor=current_user,
        note=payload.note,
    )


@router.get(
    "/staff/orders",
    response_model=List[OrderResponse],
    dependencies=[Depends(require_role(Role.STAFF, Role.ADMIN))],
)
async def get_staff_orders(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    """[Staff/Admin] Browse all store orders, optionally filtered by status."""
    return await list_all_staff_orders(db, status_filter)


@router.get(
    "/staff/orders/upcoming-pickups",
    response_model=List[OrderResponse],
    dependencies=[Depends(require_role(Role.STAFF, Role.ADMIN))],
)
async def get_staff_upcoming_pickups(
    db: AsyncSession = Depends(get_db),
):
    """[Staff/Admin] View upcoming pickup orders sorted by pickup slot schedule."""
    return await list_upcoming_pickups(db)


@router.get(
    "/staff/orders/deliveries",
    response_model=List[OrderResponse],
    dependencies=[Depends(require_role(Role.STAFF, Role.ADMIN))],
)
async def get_staff_upcoming_deliveries(
    db: AsyncSession = Depends(get_db),
):
    """[Staff/Admin] View upcoming home delivery orders."""
    return await list_upcoming_deliveries(db)
