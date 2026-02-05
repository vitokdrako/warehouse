from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

# Auth Schemas
class CustomerRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    firstname: str
    lastname: str
    telephone: Optional[str] = None

class CustomerLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'

class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    customer_id: int
    email: str
    firstname: Optional[str]
    lastname: Optional[str]
    telephone: Optional[str]
    is_active: bool
    email_verified: bool

# Product Schemas
class ProductListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    product_id: int
    sku: Optional[str]
    name: Optional[str]
    category_name: Optional[str]
    subcategory_name: Optional[str]
    color: Optional[str]
    material: Optional[str]
    size: Optional[str]
    rental_price: Optional[Decimal]
    quantity: int
    frozen_quantity: int
    image_url: Optional[str]
    status: int
    
    # Статистика доступності (як у warehouse)
    reserved: Optional[int] = 0  # Зарезервовано в мудбордах
    available: Optional[int] = 0  # Реально доступно = quantity - frozen - reserved

class ProductDetail(ProductListItem):
    description: Optional[str]
    care_instructions: Optional[str]
    price: Optional[Decimal]
    zone: Optional[str]
    aisle: Optional[str]
    shelf: Optional[str]

class ProductAvailability(BaseModel):
    product_id: int
    total_quantity: int
    available_quantity: int
    reserved_quantity: int
    frozen_quantity: int
    is_available: bool

# Category Schema
class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    category_id: int
    name: str
    parent_id: Optional[int]
    description: Optional[str]
    sort_order: Optional[int]
    is_active: bool

# Event Board Schemas
class EventBoardCreate(BaseModel):
    board_name: str = Field(..., min_length=1, max_length=255)
    event_date: Optional[date] = None
    event_type: Optional[str] = None
    rental_start_date: Optional[date] = None
    rental_end_date: Optional[date] = None
    notes: Optional[str] = None
    budget: Optional[Decimal] = None

class EventBoardUpdate(BaseModel):
    board_name: Optional[str] = None
    event_date: Optional[date] = None
    event_type: Optional[str] = None
    rental_start_date: Optional[date] = None
    rental_end_date: Optional[date] = None
    notes: Optional[str] = None
    budget: Optional[Decimal] = None
    status: Optional[str] = None
    canvas_layout: Optional[dict] = None

class EventBoardItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    notes: Optional[str] = None
    section: Optional[str] = None

class EventBoardItemUpdate(BaseModel):
    quantity: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None
    section: Optional[str] = None

class EventBoardItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    board_id: str
    product_id: int
    quantity: int
    notes: Optional[str]
    section: Optional[str]
    position: int
    added_at: datetime
    product: Optional[ProductListItem]

class EventBoardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    customer_id: int
    board_name: str
    event_date: Optional[date]
    event_type: Optional[str]
    rental_start_date: Optional[date]
    rental_end_date: Optional[date]
    rental_days: Optional[int]
    status: str
    notes: Optional[str]
    cover_image: Optional[str]
    budget: Optional[Decimal]
    estimated_total: Decimal
    canvas_layout: Optional[dict]
    created_at: datetime
    updated_at: datetime
    converted_to_order_id: Optional[int]
    items: List[EventBoardItemResponse] = []

# Availability Check Schema
class AvailabilityCheckRequest(BaseModel):
    product_id: int
    quantity: int
    reserved_from: date
    reserved_until: date

class AvailabilityCheckResponse(BaseModel):
    product_id: int
    requested_quantity: int
    available_quantity: int
    is_available: bool
    message: Optional[str]