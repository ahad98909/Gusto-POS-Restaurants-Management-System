import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)  # order_taker, chef, billing, manager, owner
    phone_number = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    orders = relationship("Order", back_populates="user")
    attendance = relationship("Attendance", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class Table(Base):
    __tablename__ = "tables"
    
    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(String(50), unique=True, index=True, nullable=False)
    capacity = Column(Integer, default=4)
    status = Column(String(50), default="empty")  # empty, occupied, reserved
    
    # Relationships
    orders = relationship("Order", back_populates="table")

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    price = Column(Float, nullable=False)  # Price in PKR
    category = Column(String(50), nullable=False)  # Starters, Mains, Desserts, Beverages
    is_available = Column(Boolean, default=True)
    image_url = Column(String(255), nullable=True)
    
    # Relationships
    order_items = relationship("OrderItem", back_populates="menu_item")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)  # Nullable for takeaway/delivery
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Order Taker ID
    status = Column(String(50), default="pending")  # pending, preparing, ready, served, billed
    total_amount = Column(Float, default=0.0)  # Subtotal in PKR
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    table = relationship("Table", back_populates="orders")
    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False)  # Snapshot of price at order time in PKR
    notes = Column(String(255), nullable=True)
    
    # Relationships
    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")

class Bill(Base):
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    subtotal = Column(Float, nullable=False)
    tax_amount = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)  # Total in PKR
    payment_status = Column(String(50), default="unpaid")  # paid, unpaid
    payment_method = Column(String(50), default="cash")  # cash, card
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="bills")

class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=datetime.date.today)
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)
    status = Column(String(50), default="present")  # present, absent, late
    
    # Relationships
    user = relationship("User", back_populates="attendance")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null if system-initiated
    action = Column(String(255), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    ip_address = Column(String(50), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
