import uuid
from datetime import date
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.order import Order, OrderStatus
from app.models.pickup_slot import PickupSlot
from app.schemas.order import OrderResponse, PickupSlotResponse
from app.services.order_state import _format_order_response


async def list_available_slots(
    db: AsyncSession,
    store_id: Optional[uuid.UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[PickupSlotResponse]:
    """List available pickup slots where booked_count < capacity."""
    query = select(PickupSlot).where(PickupSlot.booked_count < PickupSlot.capacity)

    if store_id:
        query = query.where(PickupSlot.store_id == store_id)

    if date_from:
        query = query.where(PickupSlot.date >= date_from)

    if date_to:
        query = query.where(PickupSlot.date <= date_to)

    query = query.order_by(PickupSlot.date.asc(), PickupSlot.start_time.asc())
    res = await db.execute(query)
    slots = res.scalars().all()

    return [
        PickupSlotResponse(
            id=slot.id,
            store_id=slot.store_id,
            date=slot.date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            capacity=slot.capacity,
            booked_count=slot.booked_count,
            slots_remaining=slot.capacity - slot.booked_count,
        )
        for slot in slots
    ]


async def book_slot(
    db: AsyncSession,
    order_id: uuid.UUID,
    slot_id: uuid.UUID,
    user_id: uuid.UUID,
) -> OrderResponse:
    """Reserve a pickup slot for an order using FOR UPDATE locking to prevent overbooking."""
    # 1. Fetch Order and verify ownership
    res = await db.execute(select(Order).where(Order.id == order_id))
    order = res.scalar_one_or_none()

    if not order or order.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID '{order_id}' not found.",
        )

    # 2. Check Order Status requirement (only PENDING or CONFIRMED allowed)
    if order.status not in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pickup slots can only be booked for PENDING or CONFIRMED orders (Current status: '{order.status.value}').",
        )

    # 3. Lock PickupSlot row with FOR UPDATE and re-check capacity
    slot_res = await db.execute(
        select(PickupSlot)
        .where(PickupSlot.id == slot_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    slot = slot_res.scalar_one_or_none()

    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pickup slot with ID '{slot_id}' not found.",
        )

    # RACE CONDITION PREVENTION COMMENT:
    # We re-check booked_count < capacity AFTER acquiring the FOR UPDATE row lock on PickupSlot.
    # Locking the slot row forces competing booking requests to execute serially.
    # The second request only evaluates availability AFTER the first transaction has committed
    # its slot increment, raising a 409 Conflict if the slot became fully booked.
    if slot.booked_count >= slot.capacity:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pickup slot is fully booked. Please select another slot.",
        )

    slot.booked_count += 1
    order.pickup_slot_id = slot_id
    await db.commit()

    return await _format_order_response(db, order.id)
