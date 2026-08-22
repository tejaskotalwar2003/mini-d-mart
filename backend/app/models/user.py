import enum
import uuid
from typing import List, Optional
from sqlalchemy import Boolean, Enum, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base, TimestampMixin


class Role(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    STAFF = "STAFF"
    ADMIN = "ADMIN"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role", native_enum=False),
        default=Role.CUSTOMER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    addresses: Mapped[List["Address"]] = relationship(
        "Address",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    cart = relationship(
        "Cart",
        uselist=False,
        back_populates="user",
        cascade="all, delete-orphan",
    )



class Address(Base, TimestampMixin):
    __tablename__ = "addresses"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    line1: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    line2: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    pincode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="addresses",
    )
