import time
import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.cart import Cart, CartItem
from app.models.order import FulfillmentType, Order, OrderItem, OrderStatus, OrderStatusLog
from app.models.pickup_slot import PickupSlot
from app.models.store import Inventory
from app.schemas.order import CheckoutRequest, OrderItemResponse, OrderResponse
from app.services.order_state import _format_order_response, transition_order

logger = logging.getLogger("uvicorn.error")


async def checkout(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: CheckoutRequest,
) -> OrderResponse:
    """Perform transactionally atomic checkout with FOR UPDATE row locking and inventory reservation."""
    # 1. Fetch user's cart and items
    cart_res = await db.execute(
        select(Cart)
        .options(selectinload(Cart.items).selectinload(CartItem.product))
        .where(Cart.user_id == user_id)
    )
    cart = cart_res.scalar_one_or_none()

    if not cart or not cart.items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shopping cart is empty.",
        )

    # Validate delivery address if fulfillment type is DELIVERY
    if data.fulfillment_type == FulfillmentType.DELIVERY:
        if not data.delivery_address_id and not (data.note and data.note.strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery address or instructions are required for Home Delivery orders.",
            )

    order_items_to_create = []
    subtotal = Decimal("0.00")

    # 2. Transactionally lock Inventory rows and verify stock under lock
    for cart_item in cart.items:
        product = cart_item.product
        req_qty = cart_item.quantity

        inv_res = await db.execute(
            select(Inventory)
            .where(Inventory.product_id == product.id)
            .execution_options(populate_existing=True)
            .with_for_update()
        )
        inventories = list(inv_res.scalars().all())

        total_avail = sum(inv.quantity_available for inv in inventories)

        prod_name = product.name
        if total_avail < req_qty:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Insufficient stock for '{prod_name}'. "
                    f"Requested: {req_qty}, Available: {total_avail}."
                ),
            )

        remaining_to_deduct = req_qty
        for inv in inventories:
            if inv.quantity_available >= remaining_to_deduct:
                inv.quantity_available -= remaining_to_deduct
                inv.quantity_reserved += remaining_to_deduct
                remaining_to_deduct = 0
                break
            else:
                deduct = inv.quantity_available
                remaining_to_deduct -= deduct
                inv.quantity_reserved += deduct
                inv.quantity_available = 0

        unit_price = product.price
        line_total = Decimal(req_qty) * unit_price
        subtotal += line_total

        order_items_to_create.append({
            "product_id": product.id,
            "product_name": product.name,
            "quantity": req_qty,
            "unit_price_at_order": unit_price,
            "line_total": line_total,
        })

    tax = (subtotal * Decimal("0.05")).quantize(Decimal("0.01"))
    total = subtotal + tax

    order_number = f"ORD-{int(time.time())}-{uuid.uuid4().hex[:6].upper()}"

    order = Order(
        order_number=order_number,
        user_id=user_id,
        status=OrderStatus.PENDING,
        fulfillment_type=data.fulfillment_type,
        delivery_address_id=data.delivery_address_id,
        subtotal=subtotal,
        tax=tax,
        total=total,
    )
    db.add(order)
    await db.flush()

    for item_data in order_items_to_create:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data["product_id"],
            quantity=item_data["quantity"],
            unit_price_at_order=item_data["unit_price_at_order"],
        )
        db.add(order_item)

    status_log = OrderStatusLog(
        order_id=order.id,
        from_status=None,
        to_status=OrderStatus.PENDING,
        changed_by=user_id,
        note=data.note or "Order placed successfully.",
    )
    db.add(status_log)

    for cart_item in cart.items:
        await db.delete(cart_item)

    await db.commit()

    return await _format_order_response(db, order.id)


async def get_order(
    db: AsyncSession,
    order_id: uuid.UUID,
    user_id: uuid.UUID,
) -> OrderResponse:
    """Fetch single order by ID for the owning user."""
    res = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = res.scalar_one_or_none()

    if not order or order.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' not found.",
        )

    return await _format_order_response(db, order.id)


async def list_user_orders(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> List[OrderResponse]:
    """Fetch all orders placed by current authenticated user."""
    res = await db.execute(
        select(Order.id)
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    order_ids = list(res.scalars().all())

    response_list = []
    for oid in order_ids:
        response_list.append(await _format_order_response(db, oid))
    return response_list


async def list_all_staff_orders(
    db: AsyncSession,
    status_filter: Optional[OrderStatus] = None,
) -> List[OrderResponse]:
    """[Staff/Admin] Fetch all store orders, optionally filtered by status."""
    query = select(Order.id)
    if status_filter:
        query = query.where(Order.status == status_filter)
    query = query.order_by(Order.created_at.desc())

    res = await db.execute(query)
    order_ids = list(res.scalars().all())

    response_list = []
    for oid in order_ids:
        response_list.append(await _format_order_response(db, oid))
    return response_list


async def list_upcoming_pickups(db: AsyncSession) -> List[OrderResponse]:
    """[Staff/Admin] Fetch upcoming pickup orders ordered by pickup slot date/time."""
    upcoming_statuses = [
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY_FOR_PICKUP,
    ]
    query = (
        select(Order.id)
        .outerjoin(PickupSlot, Order.pickup_slot_id == PickupSlot.id)
        .where(
            Order.fulfillment_type == FulfillmentType.PICKUP,
            Order.status.in_(upcoming_statuses),
        )
        .order_by(PickupSlot.date.asc().nulls_last(), PickupSlot.start_time.asc().nulls_last(), Order.created_at.desc())
    )

    res = await db.execute(query)
    order_ids = list(res.scalars().all())

    response_list = []
    for oid in order_ids:
        response_list.append(await _format_order_response(db, oid))
    return response_list


async def list_upcoming_deliveries(db: AsyncSession) -> List[OrderResponse]:
    """[Staff/Admin] Fetch upcoming delivery orders ordered by creation time."""
    upcoming_statuses = [
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.OUT_FOR_DELIVERY,
    ]
    query = (
        select(Order.id)
        .where(
            Order.fulfillment_type == FulfillmentType.DELIVERY,
            Order.status.in_(upcoming_statuses),
        )
        .order_by(Order.created_at.desc())
    )

    res = await db.execute(query)
    order_ids = list(res.scalars().all())

    response_list = []
    for oid in order_ids:
        response_list.append(await _format_order_response(db, oid))
    return response_list


async def expire_abandoned_orders(db: AsyncSession) -> int:
    """Find PENDING orders older than 15 minutes and cancel them. Returns count of expired orders."""
    expiry_limit = datetime.now(timezone.utc) - timedelta(minutes=15)
    res = await db.execute(
        select(Order).where(Order.status == OrderStatus.PENDING)
    )
    pending_orders = res.scalars().all()
    
    cancelled_count = 0
    for order in pending_orders:
        order_time = order.created_at
        if order_time.tzinfo is None:
            order_time = order_time.replace(tzinfo=timezone.utc)
            
        if order_time < expiry_limit:
            logger.info(f"System Auto-Expiring Order {order.order_number} (Created: {order.created_at})")
            try:
                await transition_order(
                    db=db,
                    order=order,
                    to_status=OrderStatus.CANCELLED,
                    actor=None,
                    note="Order automatically cancelled due to stock reservation timeout (15 minutes).",
                )
                cancelled_count += 1
            except Exception as inner_ex:
                logger.error(f"Failed to auto-expire order {order.order_number}: {inner_ex}")
    return cancelled_count


async def run_stock_reservation_cleanup(db_session_factory):
    """Background task that runs periodically to release expired stock reservations.

    Cancels PENDING orders that have not been confirmed within 15 minutes.
    """
    logger.info("Starting stock reservation cleanup background task.")
    while True:
        try:
            await asyncio.sleep(60)  # Check every minute
            async with db_session_factory() as db:
                await expire_abandoned_orders(db)
        except asyncio.CancelledError:
            logger.info("Stock reservation cleanup background task cancelled.")
            break
        except Exception as e:
            logger.exception(f"Unhandled error in stock reservation cleanup task: {e}")
