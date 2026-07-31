import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/owner", tags=["Owner Analytics"])

@router.get("/metrics", response_model=schemas.OwnerDashboardMetrics)
def get_owner_metrics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["owner"]))):
    """
    Retrieve sales telemetry: revenues, daily/monthly totals, and item popularity.
    """
    now = datetime.datetime.utcnow()
    today_start = datetime.datetime(now.year, now.month, now.day)
    month_start = datetime.datetime(now.year, now.month, 1)
    
    # Revenue Today
    rev_today = db.query(func.sum(models.Bill.total_amount)).filter(
        models.Bill.payment_status == "paid",
        models.Bill.generated_at >= today_start
    ).scalar() or 0.0
    
    # Revenue This Month
    rev_month = db.query(func.sum(models.Bill.total_amount)).filter(
        models.Bill.payment_status == "paid",
        models.Bill.generated_at >= month_start
    ).scalar() or 0.0

    # Total All-Time Business Revenue
    rev_total = db.query(func.sum(models.Bill.total_amount)).filter(
        models.Bill.payment_status == "paid"
    ).scalar() or 0.0
    
    # Orders count
    orders_today = db.query(models.Order).filter(models.Order.created_at >= today_start).count()
    orders_month = db.query(models.Order).filter(models.Order.created_at >= month_start).count()
    
    # Active vs Completed
    active_orders = db.query(models.Order).filter(
        models.Order.status.in_(["pending", "preparing", "ready", "served"])
    ).count()
    completed_orders = db.query(models.Order).filter(models.Order.status == "billed").count()
    
    # Popular items (Top 5)
    popular_query = db.query(
        models.MenuItem.name,
        func.sum(models.OrderItem.quantity).label("qty_sold")
    ).join(models.OrderItem).group_by(models.MenuItem.name).order_by(func.sum(models.OrderItem.quantity).desc()).limit(5).all()
    
    popular_items = [{"name": item[0], "sold": int(item[1])} for item in popular_query]
    
    return {
        "revenue_today": float(rev_today),
        "revenue_month": float(rev_month),
        "revenue_total": float(rev_total),
        "total_orders_today": orders_today,
        "total_orders_month": orders_month,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "popular_items": popular_items
    }

@router.get("/sales-history")
def get_sales_history(db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["owner"]))):
    """
    Get detailed breakdown of all order payment transactions for business tracking.
    """
    bills = db.query(models.Bill).order_by(models.Bill.generated_at.desc()).all()
    transactions = []
    for b in bills:
        order = b.order
        if not order:
            continue
        order_taker_name = order.user.name if order.user else "System"
        table_name = order.table.table_number if order.table else "Takeaway"
        items_summary = ", ".join([f"{item.quantity}x {item.menu_item.name}" for item in order.items]) if order.items else "No items"
        transactions.append({
            "bill_id": b.id,
            "order_id": order.id,
            "order_taker_name": order_taker_name,
            "table_name": table_name,
            "items_summary": items_summary,
            "subtotal": float(b.subtotal),
            "tax_amount": float(b.tax_amount),
            "discount": float(b.discount),
            "total_amount": float(b.total_amount),
            "payment_status": b.payment_status,
            "payment_method": b.payment_method,
            "timestamp": b.generated_at
        })
    return transactions


@router.get("/staff-performance")
def get_staff_performance(db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["owner"]))):
    """
    View orders processed by Order Takers and billing transactions handled.
    """
    # Order Takers performance
    taker_performance = db.query(
        models.User.name,
        models.User.username,
        func.count(models.Order.id).label("orders_placed")
    ).join(models.Order, models.User.id == models.Order.user_id).group_by(models.User.id).all()
    
    # Billing staff performance (users that logged "Marked Bill paid" in Audit logs, or simple aggregate)
    billing_performance = db.query(
        models.User.name,
        models.User.username,
        func.count(models.AuditLog.id).label("bills_processed")
    ).join(models.AuditLog, models.User.id == models.AuditLog.user_id).filter(
        models.AuditLog.action.like("%Marked Bill%paid%")
    ).group_by(models.User.id).all()
    
    # Convert tuples to dictionary lists
    takers = [{"name": name, "username": username, "orders_placed": int(orders)} for name, username, orders in taker_performance]
    billers = [{"name": name, "username": username, "bills_processed": int(bills)} for name, username, bills in billing_performance]
    
    return {
        "order_takers": takers,
        "billing_staff": billers
    }

@router.get("/audit-logs", response_model=List[schemas.AuditLogResponse])
def get_audit_logs(limit: int = 50, db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["owner"]))):
    """
    View recent restaurant action logs (security audit trail).
    """
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(limit).all()
