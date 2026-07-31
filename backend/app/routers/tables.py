from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas, auth
from ..websocket_manager import manager as ws_manager

router = APIRouter(prefix="/tables", tags=["Table Management"])

@router.get("", response_model=List[schemas.TableResponse])
def get_tables(db: Session = Depends(get_db)):
    """
    Get all tables and their current status.
    """
    return db.query(models.Table).all()

@router.put("/{table_id}/status", response_model=schemas.TableResponse)
async def update_table_status(
    table_id: int,
    table_status: str,  # empty, occupied, reserved
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Update a table's status manually.
    """
    if table_status not in ["empty", "occupied", "reserved"]:
        raise HTTPException(status_code=400, detail="Invalid table status")
        
    table = db.query(models.Table).filter(models.Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    table.status = table_status
    db.commit()
    db.refresh(table)
    
    # Broadcast updates to manager and order takers
    await ws_manager.broadcast({"type": "TABLE_UPDATE", "table_id": table_id, "status": table_status})
    
    return table

@router.post("", response_model=schemas.TableResponse, status_code=status.HTTP_201_CREATED)
async def create_table(
    table_in: schemas.TableCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["owner", "manager"]))
):
    """
    Create a new dining table. Restricted to Owner or Manager.
    """
    existing = db.query(models.Table).filter(models.Table.table_number == table_in.table_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Table number already exists")
        
    table = models.Table(
        table_number=table_in.table_number,
        capacity=table_in.capacity,
        status="empty"
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    
    await ws_manager.broadcast({"type": "TABLE_UPDATE"})
    return table
