import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str
    slug: str
    parent_id: Optional[uuid.UUID] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    parent_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    category_id: uuid.UUID
    name: str
    description: Optional[str] = None
    sku: str
    price: Decimal = Field(..., gt=0)
    unit: str
    image_url: Optional[str] = None
    is_returnable: bool = True
    tax_rate: Decimal = Field(default=Decimal("5.00"), ge=0, le=100)
    quantity: Optional[int] = Field(None, ge=0, description="Initial stock quantity")


class ProductUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_returnable: Optional[bool] = None
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    quantity: Optional[int] = Field(None, ge=0, description="Updated stock quantity")


class ProductVariantInfo(BaseModel):
    id: uuid.UUID
    sku: str
    price: Decimal
    unit: str
    quantity_available: int = 0

    model_config = ConfigDict(from_attributes=True)


class ProductResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    sku: str
    price: Decimal
    unit: str
    image_url: Optional[str] = None
    is_active: bool
    is_returnable: bool
    tax_rate: Decimal = Decimal("5.00")
    quantity_available: int = 0
    parent_id: Optional[uuid.UUID] = None
    variants: List[ProductVariantInfo] = []

    model_config = ConfigDict(from_attributes=True)


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
