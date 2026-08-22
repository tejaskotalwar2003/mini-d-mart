import enum
import uuid
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base_class import Base, TimestampMixin


class ReturnType(str, enum.Enum):
    RETURN = "RETURN"
    EXCHANGE = "EXCHANGE"


class ReturnStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"


class ReturnRequest(Base, TimestampMixin):
    __tablename__ = "return_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    order_item_id = Column(UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(
        Enum(ReturnType, name="return_type", native_enum=False),
        nullable=False,
    )
    reason = Column(Text, nullable=False)
    status = Column(
        Enum(ReturnStatus, name="return_status", native_enum=False),
        default=ReturnStatus.REQUESTED,
        nullable=False,
    )
    requested_qty = Column(Integer, nullable=False)
    exchange_for_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)

    order = relationship("Order")
    order_item = relationship("OrderItem")
    exchange_product = relationship("Product", foreign_keys=[exchange_for_product_id])
    resolver = relationship("User", foreign_keys=[resolved_by])
