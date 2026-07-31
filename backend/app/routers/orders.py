from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from .. import models, schemas, auth
from ..websocket_manager import manager as ws_manager

router = APIRouter(prefix="/orders", tags=["Order Management"])

@router.post("", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_in: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["order_taker", "manager", "owner"]))
):
    """
    Create a new customer order. Order Taker or Manager/Owner only.
    """
    # Verify table if table_id is provided
    if order_in.table_id:
        table = db.query(models.Table).filter(models.Table.id == order_in.table_id).first()
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        table.status = "occupied"
        db.commit()

    # Create Order
    new_order = models.Order(
        table_id=order_in.table_id,
        user_id=current_user.id,
        status="pending",
        total_amount=0.0
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Process items and calculate total
    total = 0.0
    for item in order_in.items:
        menu_item = db.query(models.MenuItem).filter(models.MenuItem.id == item.menu_item_id).first()
        if not menu_item:
            raise HTTPException(status_code=400, detail=f"Menu item ID {item.menu_item_id} not found")
        if not menu_item.is_available:
            raise HTTPException(status_code=400, detail=f"Menu item {menu_item.name} is not available")
            
        unit_price = menu_item.price
        item_total = unit_price * item.quantity
        total += item_total
        
        db_item = models.OrderItem(
            order_id=new_order.id,
            menu_item_id=item.menu_item_id,
            quantity=item.quantity,
            unit_price=unit_price,
            notes=item.notes
        )
        db.add(db_item)
        
    new_order.total_amount = total
    db.commit()
    db.refresh(new_order)

    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action=f"Created order ID {new_order.id} for Table ID {new_order.table_id or 'Takeaway'} totaling {total} PKR"
    )
    db.add(audit_log)
    db.commit()

    # Live broadcast to update Chef and Manager dashboards
    await ws_manager.broadcast({
        "type": "NEW_ORDER",
        "order_id": new_order.id,
        "table_id": new_order.table_id,
        "message": f"New order placed for Table {new_order.table.table_number if new_order.table else 'Takeaway'}!"
    })

    return new_order

@router.get("", response_model=List[schemas.OrderResponse])
def get_orders(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    List orders. Filterable by status (e.g. pending, preparing, ready).
    """
    query = db.query(models.Order)
    if status_filter:
        query = query.filter(models.Order.status == status_filter)
        
    # Order Takers see all orders they placed or active orders
    return query.order_by(models.Order.created_at.desc()).all()

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order_details(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.put("/{order_id}/status", response_model=schemas.OrderResponse)
async def update_order_status(
    order_id: int,
    status_update: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Update order status. Rules:
    - Chef can transition pending -> preparing -> ready
    - Order Taker can transition ready -> served
    - Billing system transitions served -> billed (paid)
    """
    new_status = status_update.status
    if new_status not in ["pending", "preparing", "ready", "served", "billed"]:
        raise HTTPException(status_code=400, detail="Invalid order status")
        
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Access control per status change
    if new_status in ["preparing", "ready"]:
        if current_user.role not in ["chef", "manager", "owner"]:
            raise HTTPException(status_code=403, detail="Only Chef or Manager can update cooking status")
    elif new_status == "served":
        if current_user.role not in ["order_taker", "manager", "owner"]:
            raise HTTPException(status_code=403, detail="Only Order Taker can mark order as served")
            
    order.status = new_status
    db.commit()
    db.refresh(order)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action=f"Updated order ID {order.id} status to '{new_status}'"
    )
    db.add(audit_log)
    db.commit()
    
    # Live broadcast notifications
    if new_status == "ready":
        # Alert the Order Taker that the order is ready
        await ws_manager.broadcast({
            "type": "ORDER_READY",
            "order_id": order.id,
            "table_number": order.table.table_number if order.table else "Takeaway",
            "order_taker_id": order.user_id,
            "message": f"Order #{order.id} for Table {order.table.table_number if order.table else 'Takeaway'} is ready to serve!"
        })
        await ws_manager.broadcast({
            "type": "ORDER_STATUS_UPDATE",
            "order_id": order.id,
            "status": new_status
        })
    elif new_status == "served":

        # Alert billing and manager that the order is served and ready for billing request
        await ws_manager.broadcast({
            "type": "ORDER_SERVED",
            "order_id": order.id,
            "table_number": order.table.table_number if order.table else "Takeaway",
            "message": f"Order #{order.id} served at Table {order.table.table_number if order.table else 'Takeaway'}."
        })
    else:
        await ws_manager.broadcast({
            "type": "ORDER_STATUS_UPDATE",
            "order_id": order.id,
            "status": new_status
        })
        
    return order
