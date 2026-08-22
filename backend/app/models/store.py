import uuid
from typing import List
from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base, TimestampMixin


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    address: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    pickup_capacity_per_slot: Mapped[int] = mapped_column(
        Integer,
        default=10,
        nullable=False,
    )

    inventory: Mapped[List["Inventory"]] = relationship(
        "Inventory",
        back_populates="store",
        cascade="all, delete-orphan",
    )


class Inventory(Base, TimestampMixin):
    __tablename__ = "inventory"

    __table_args__ = (
        UniqueConstraint("product_id", "store_id", name="uq_inventory_product_store"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    store_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity_available: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    quantity_reserved: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    reorder_threshold: Mapped[int] = mapped_column(
        Integer,
        default=10,
        nullable=False,
    )

    product: Mapped["Product"] = relationship(
        "Product",
        back_populates="inventory",
    )
    store: Mapped["Store"] = relationship(
        "Store",
        back_populates="inventory",
    )
