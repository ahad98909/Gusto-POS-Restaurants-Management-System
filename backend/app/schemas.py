from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date

# User Schemas
class UserBase(BaseModel):
    username: str
    name: str
    role: str
    phone_number: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# Table Schemas
class TableBase(BaseModel):
    table_number: str
    capacity: int = 4

class TableCreate(TableBase):
    pass

class TableResponse(TableBase):
    id: int
    status: str  # empty, occupied, reserved

    model_config = {"from_attributes": True}

# Menu Item Schemas
class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str  # Starters, Mains, Desserts, Beverages
    is_available: bool = True
    image_url: Optional[str] = None

class MenuItemCreate(MenuItemBase):
    pass

class MenuItemResponse(MenuItemBase):
    id: int

    model_config = {"from_attributes": True}

# Order Item Schemas
class OrderItemBase(BaseModel):
    menu_item_id: int
    quantity: int = 1
    notes: Optional[str] = None

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    menu_item_id: int
    menu_item: MenuItemResponse
    quantity: int
    unit_price: float
    notes: Optional[str] = None

    model_config = {"from_attributes": True}

# Order Schemas
class OrderBase(BaseModel):
    table_id: Optional[int] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class OrderResponse(OrderBase):
    id: int
    user_id: int
    user: UserResponse  # The Order Taker details
    table: Optional[TableResponse] = None
    status: str  # pending, preparing, ready, served, billed
    total_amount: float
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]

    model_config = {"from_attributes": True}

class OrderStatusUpdate(BaseModel):
    status: str  # pending, preparing, ready, served, billed

# Bill Schemas
class BillBase(BaseModel):
    order_id: int
    discount: float = 0.0
    tax_amount: float = 0.0

class BillCreate(BillBase):
    payment_method: str = "cash"  # cash, card

class BillResponse(BaseModel):
    id: int
    order_id: int
    subtotal: float
    tax_amount: float
    discount: float
    total_amount: float
    payment_status: str  # paid, unpaid
    payment_method: str
    generated_at: datetime

    model_config = {"from_attributes": True}

class BillPaymentUpdate(BaseModel):
    payment_status: str  # paid, unpaid
    payment_method: str  # cash, card
    card_number: Optional[str] = None
    card_expiry: Optional[str] = None
    card_cvc: Optional[str] = None
    card_holder: Optional[str] = None


# Attendance Schemas
class AttendanceCreate(BaseModel):
    user_id: int
    status: str = "present"  # present, absent, late

class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    user: UserResponse
    date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: str

    model_config = {"from_attributes": True}

# Audit Log Schema
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user: Optional[UserResponse] = None
    action: str
    timestamp: datetime
    ip_address: Optional[str] = None

    model_config = {"from_attributes": True}

# Dashboard & Metrics Schemas
class ManagerDashboardMetrics(BaseModel):
    total_tables: int
    empty_tables: int
    occupied_tables: int
    reserved_tables: int
    active_orders_count: int
    delayed_orders_count: int
    present_staff_count: int

class OwnerDashboardMetrics(BaseModel):
    revenue_today: float
    revenue_month: float
    revenue_total: float = 0.0
    total_orders_today: int
    total_orders_month: int
    active_orders: int
    completed_orders: int
    popular_items: List[dict]

class SalesTransactionResponse(BaseModel):
    bill_id: int
    order_id: int
    order_taker_name: str
    table_name: str
    items_summary: str
    subtotal: float
    tax_amount: float
    discount: float
    total_amount: float
    payment_status: str
    payment_method: str
    timestamp: datetime

