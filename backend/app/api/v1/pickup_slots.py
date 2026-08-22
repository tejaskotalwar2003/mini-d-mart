import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.order import OrderResponse, PickupSlotResponse
from app.services.pickup_slot_service import book_slot, list_available_slots

router = APIRouter(tags=["Pickup Slots"])


class BookSlotRequest(BaseModel):
    slot_id: uuid.UUID


@router.get("/pickup-slots", response_model=List[PickupSlotResponse])
async def get_pickup_slots(
    store_id: Optional[uuid.UUID] = Query(None, description="Filter by store UUID"),
    date_from: Optional[date] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List available pickup slots where remaining capacity is > 0."""
    return await list_available_slots(db, store_id, date_from, date_to)


@router.post("/orders/{order_id}/pickup-slot", response_model=OrderResponse)
async def reserve_order_pickup_slot(
    order_id: uuid.UUID,
    payload: BookSlotRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reserve a pickup slot for an existing PENDING or CONFIRMED order."""
    return await book_slot(db, order_id, payload.slot_id, current_user.id)
