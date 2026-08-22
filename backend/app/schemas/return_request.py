import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.return_request import ReturnStatus, ReturnType


class ReturnRequestCreate(BaseModel):
    order_item_id: uuid.UUID
    type: ReturnType
    requested_qty: int
    reason: str
    exchange_for_product_id: Optional[uuid.UUID] = None


class ReturnResolveRequest(BaseModel):
    resolution_note: Optional[str] = None


class ReturnRequestResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    order_item_id: uuid.UUID
    product_name: str
    type: ReturnType
    status: ReturnStatus
    requested_qty: int
    reason: str
    exchange_for_product_id: Optional[uuid.UUID] = None
    exchange_product_name: Optional[str] = None
    resolved_by_name: Optional[str] = None
    resolution_note: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
