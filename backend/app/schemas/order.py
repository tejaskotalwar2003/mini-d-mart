import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.order import FulfillmentType, OrderStatus


class PickupSlotResponse(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    date: date
    start_time: time
    end_time: time
    capacity: int
    booked_count: int
    slots_remaining: int

    model_config = ConfigDict(from_attributes=True)


class OrderStatusUpdateRequest(BaseModel):
    to_status: OrderStatus
    note: Optional[str] = None


class OrderStatusLogResponse(BaseModel):
    from_status: Optional[OrderStatus] = None
    to_status: OrderStatus
    changed_by_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CheckoutRequest(BaseModel):
    fulfillment_type: FulfillmentType
    delivery_address_id: Optional[uuid.UUID] = None
    note: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    image_url: Optional[str] = None
    quantity: int
    unit_price_at_order: Decimal
    line_total: Decimal

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    status: OrderStatus
    fulfillment_type: FulfillmentType
    items: List[OrderItemResponse]
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    created_at: datetime
    order_status_history: List[OrderStatusLogResponse] = []

    model_config = ConfigDict(from_attributes=True)
