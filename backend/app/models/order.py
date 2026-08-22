import enum
import uuid
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base, TimestampMixin


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PREPARING = "PREPARING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    COMPLETED = "COMPLETED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    RETURN_REQUESTED = "RETURN_REQUESTED"
    RETURN_APPROVED = "RETURN_APPROVED"
    RETURN_REJECTED = "RETURN_REJECTED"
    RETURNED = "RETURNED"
    EXCHANGED = "EXCHANGED"


class FulfillmentType(str, enum.Enum):
    PICKUP = "PICKUP"
    DELIVERY = "DELIVERY"


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(
        Enum(OrderStatus, name="order_status", native_enum=False),
        default=OrderStatus.PENDING,
        nullable=False,
    )
    fulfillment_type = Column(
        Enum(FulfillmentType, name="fulfillment_type", native_enum=False),
        nullable=False,
    )
    pickup_slot_id = Column(UUID(as_uuid=True), ForeignKey("pickup_slots.id"), nullable=True)
    delivery_address_id = Column(UUID(as_uuid=True), ForeignKey("addresses.id"), nullable=True)
    subtotal = Column(Numeric(10, 2), nullable=False)
    tax = Column(Numeric(10, 2), nullable=False)
    total = Column(Numeric(10, 2), nullable=False)

    user = relationship("User")
    delivery_address = relationship("Address")
    pickup_slot = relationship("PickupSlot")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_logs = relationship("OrderStatusLog", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    unit_price_at_order = Column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class OrderStatusLog(Base):
    __tablename__ = "order_status_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(Enum(OrderStatus, name="order_status", native_enum=False), nullable=True)
    to_status = Column(Enum(OrderStatus, name="order_status", native_enum=False), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    order = relationship("Order", back_populates="status_logs")
