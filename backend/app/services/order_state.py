import uuid
from decimal import Decimal
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.order import Order, OrderItem, OrderStatus, OrderStatusLog
from app.models.store import Inventory
from app.models.user import Role, User
from app.schemas.order import OrderItemResponse, OrderResponse, OrderStatusLogResponse
from app.services.audit_service import log_action

ALLOWED_TRANSITIONS: Dict[OrderStatus, List[OrderStatus]] = {
    OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    OrderStatus.PREPARING: [OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
    OrderStatus.READY_FOR_PICKUP: [OrderStatus.COMPLETED],
    OrderStatus.OUT_FOR_DELIVERY: [OrderStatus.DELIVERED],
    OrderStatus.COMPLETED: [OrderStatus.RETURN_REQUESTED],
    OrderStatus.DELIVERED: [OrderStatus.RETURN_REQUESTED],
}


def can_transition(from_status: OrderStatus, to_status: OrderStatus) -> bool:
    """Return True if the state transition from_status -> to_status is valid."""
    allowed = ALLOWED_TRANSITIONS.get(from_status, [])
    return to_status in allowed


async def transition_order(
    db: AsyncSession,
    order: Order,
    to_status: OrderStatus,
    actor: Optional[User] = None,
    note: Optional[str] = None,
) -> OrderResponse:
    """Perform explicit state machine order transition with inventory adjustment and audit logging."""
    # Ensure order and items are preloaded
    order_res = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order.id)
    )
    order = order_res.scalar_one()
    from_status = order.status
 
    # 1. Validate State Machine transition rules
    if not can_transition(from_status, to_status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Invalid state transition: Cannot transition order from status "
                f"'{from_status.value}' to '{to_status.value}'."
            ),
        )
 
    # 2. Validate Role permissions
    if actor:
        if actor.role == Role.CUSTOMER:
            if order.user_id != actor.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Order with ID '{order.id}' not found.",
                )
            # Customer can only cancel PENDING or CONFIRMED orders
            if not (from_status in [OrderStatus.PENDING, OrderStatus.CONFIRMED] and to_status == OrderStatus.CANCELLED):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Customers are only permitted to cancel their own PENDING or CONFIRMED orders.",
                )

    # 3. Inventory Stock Adjustments based on target state
    if to_status == OrderStatus.CANCELLED:
        # RELEASE RESERVED STOCK:
        # Restore quantity_available and decrement quantity_reserved
        for item in order.items:
            inv_res = await db.execute(
                select(Inventory)
                .where(Inventory.product_id == item.product_id)
                .execution_options(populate_existing=True)
                .with_for_update()
            )
            inventories = list(inv_res.scalars().all())

            remaining_to_release = item.quantity
            for inv in inventories:
                if inv.quantity_reserved >= remaining_to_release:
                    inv.quantity_reserved -= remaining_to_release
                    inv.quantity_available += remaining_to_release
                    remaining_to_release = 0
                    break
                else:
                    rel = inv.quantity_reserved
                    remaining_to_release -= rel
                    inv.quantity_available += rel
                    inv.quantity_reserved = 0

    elif to_status in [OrderStatus.COMPLETED, OrderStatus.DELIVERED]:
        # FINALIZE SALE:
        # Decrement quantity_reserved permanently. Do NOT touch quantity_available
        # because quantity_available was already decremented at checkout.
        for item in order.items:
            inv_res = await db.execute(
                select(Inventory)
                .where(Inventory.product_id == item.product_id)
                .execution_options(populate_existing=True)
                .with_for_update()
            )
            inventories = list(inv_res.scalars().all())

            remaining_to_finalize = item.quantity
            for inv in inventories:
                if inv.quantity_reserved >= remaining_to_finalize:
                    inv.quantity_reserved -= remaining_to_finalize
                    remaining_to_finalize = 0
                    break
                else:
                    remaining_to_finalize -= inv.quantity_reserved
                    inv.quantity_reserved = 0

    # 4. Update order status and record audit log
    order.status = to_status

    status_log = OrderStatusLog(
        order_id=order.id,
        from_status=from_status,
        to_status=to_status,
        changed_by=actor.id if actor else None,
        note=note or f"Status updated from {from_status.value} to {to_status.value}.",
    )
    db.add(status_log)
    await db.commit()

    await log_action(
        db,
        user_id=actor.id if actor else None,
        action="ORDER_STATUS_CHANGED",
        entity_type="Order",
        entity_id=order.id,
        metadata={"from": from_status.value, "to": to_status.value, "order_number": order.order_number, "note": note},
    )
    await db.commit()

    # Re-fetch order with full history log relations
    return await _format_order_response(db, order.id)


async def _format_order_response(db: AsyncSession, order_id: uuid.UUID) -> OrderResponse:
    """Format full OrderResponse including order_status_history and user details."""
    res = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.status_logs).selectinload(OrderStatusLog.order),
        )
        .where(Order.id == order_id)
    )
    order = res.scalar_one()

    # Load actor names for status history logs
    log_responses = []
    for log in order.status_logs:
        changed_by_name = None
        if log.changed_by:
            user_res = await db.execute(select(User).where(User.id == log.changed_by))
            u = user_res.scalar_one_or_none()
            if u:
                changed_by_name = u.name

        log_responses.append(
            OrderStatusLogResponse(
                from_status=log.from_status,
                to_status=log.to_status,
                changed_by_name=changed_by_name,
                note=log.note,
                created_at=log.created_at,
            )
        )

    item_responses = []
    for item in order.items:
        line_total = Decimal(item.quantity) * item.unit_price_at_order
        item_responses.append(
            OrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name,
                image_url=item.product.image_url if item.product else None,
                quantity=item.quantity,
                unit_price_at_order=item.unit_price_at_order,
                line_total=line_total,
            )
        )

    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        fulfillment_type=order.fulfillment_type,
        items=item_responses,
        subtotal=order.subtotal,
        tax=order.tax,
        total=order.total,
        created_at=order.created_at,
        order_status_history=log_responses,
    )
