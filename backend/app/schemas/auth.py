import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from app.models.user import Role


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("Password must contain at least one letter")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str] = None
    role: Role
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AddressResponse(BaseModel):
    id: uuid.UUID
    line1: str
    line2: Optional[str] = None
    city: str
    pincode: str
    is_default: bool = False

    model_config = ConfigDict(from_attributes=True)


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: Optional[str] = None
    role: Role
    is_active: bool
    created_at: datetime
    addresses: list[AddressResponse] = []

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
        return v


class RefreshRequest(BaseModel):
    refresh_token: str
