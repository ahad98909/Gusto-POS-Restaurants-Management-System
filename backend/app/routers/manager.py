import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/manager", tags=["Manager Dashboard"])

@router.get("/metrics", response_model=schemas.ManagerDashboardMetrics)
def get_manager_metrics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["manager", "owner"]))):
    """
    Get metrics for tables, orders, delays, and attendance.
    """
    total_tables = db.query(models.Table).count()
    empty_tables = db.query(models.Table).filter(models.Table.status == "empty").count()
    occupied_tables = db.query(models.Table).filter(models.Table.status == "occupied").count()
    reserved_tables = db.query(models.Table).filter(models.Table.status == "reserved").count()
    
    active_orders_count = db.query(models.Order).filter(models.Order.status.in_(["pending", "preparing", "ready", "served"])).count()
    
    # Calculate delayed orders (> 40 minutes in pending/preparing status)
    forty_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=40)
    delayed_orders_count = db.query(models.Order).filter(
        models.Order.status.in_(["pending", "preparing"]),
        models.Order.created_at < forty_mins_ago
    ).count()
    
    # Present staff today
    today = datetime.date.today()
    present_staff_count = db.query(models.Attendance).filter(
        models.Attendance.date == today,
        models.Attendance.clock_in != None,
        models.Attendance.clock_out == None
    ).count()
    
    return {
        "total_tables": total_tables,
        "empty_tables": empty_tables,
        "occupied_tables": occupied_tables,
        "reserved_tables": reserved_tables,
        "active_orders_count": active_orders_count,
        "delayed_orders_count": delayed_orders_count,
        "present_staff_count": present_staff_count
    }

@router.get("/delayed-orders", response_model=List[schemas.OrderResponse])
def get_delayed_orders(db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["manager", "owner"]))):
    """
    Get all active orders that are delayed (created more than 40 mins ago and still pending/preparing).
    """
    forty_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=40)
    return db.query(models.Order).filter(
        models.Order.status.in_(["pending", "preparing"]),
        models.Order.created_at < forty_mins_ago
    ).order_by(models.Order.created_at.asc()).all()


# Attendance logs view
@router.get("/attendance", response_model=List[schemas.AttendanceResponse])
def get_attendance_log(
    date_filter: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["manager", "owner"]))
):
    """
    Get attendance log. Defaults to today's records.
    """
    target_date = date_filter or datetime.date.today()
    return db.query(models.Attendance).filter(models.Attendance.date == target_date).all()

@router.get("/attendance/today", response_model=Optional[schemas.AttendanceResponse])
def get_my_attendance_today(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Get the current user's attendance record for today.
    """
    today = datetime.date.today()
    return db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()

# Clock In endpoint (Available to any authenticated user)
@router.post("/attendance/clock-in", response_model=schemas.AttendanceResponse)
def clock_in(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Clock in for the day. Creates attendance log.
    """
    today = datetime.date.today()
    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You have already clocked in today!")
        
    log = models.Attendance(
        user_id=current_user.id,
        date=today,
        clock_in=datetime.datetime.utcnow(),
        status="present"
    )
    db.add(log)
    
    # Audit log
    audit = models.AuditLog(
        user_id=current_user.id,
        action=f"Clocked in at {datetime.datetime.utcnow().strftime('%H:%M:%S')}"
    )
    db.add(audit)
    db.commit()
    db.refresh(log)
    
    return log

# Clock Out endpoint (Available to any authenticated user)
@router.post("/attendance/clock-out", response_model=schemas.AttendanceResponse)
def clock_out(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Clock out for the day. Updates attendance log.
    """
    today = datetime.date.today()
    log = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()
    
    if not log:
        raise HTTPException(status_code=400, detail="You haven't clocked in today yet!")
    if log.clock_out:
        raise HTTPException(status_code=400, detail="You have already clocked out today!")
        
    log.clock_out = datetime.datetime.utcnow()
    
    # Audit log
    audit = models.AuditLog(
        user_id=current_user.id,
        action=f"Clocked out at {datetime.datetime.utcnow().strftime('%H:%M:%S')}"
    )
    db.add(audit)
    db.commit()
    db.refresh(log)
    
    return log
