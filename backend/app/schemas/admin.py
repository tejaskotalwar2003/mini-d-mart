import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[uuid.UUID] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LowStockItemResponse(BaseModel):
    product_id: uuid.UUID
    product_name: str
    sku: str
    store_name: str
    quantity_available: int
    reorder_threshold: int

    model_config = ConfigDict(from_attributes=True)


class InventoryOverviewResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    store_id: uuid.UUID
    store_name: str
    quantity_available: int
    quantity_reserved: int
    reorder_threshold: int

    model_config = ConfigDict(from_attributes=True)


class InventoryAdjustRequest(BaseModel):
    new_quantity_available: int = Field(..., ge=0, description="New quantity available")
    reason: str = Field(..., min_length=3, description="Reason for stock adjustment")
