import uuid
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CartItemAdd(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(..., gt=0, description="Quantity to add (must be > 0)")


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=0, description="New quantity (0 removes item)")


class CartItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    image_url: Optional[str] = None
    unit_price: Decimal
    quantity: int
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class CartResponse(BaseModel):
    id: uuid.UUID
    items: List[CartItemResponse]
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)
