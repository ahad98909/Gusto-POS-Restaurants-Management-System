from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas, auth
from ..websocket_manager import manager as ws_manager

router = APIRouter(prefix="/menu", tags=["Menu Management"])

@router.get("", response_model=List[schemas.MenuItemResponse])
def get_menu(db: Session = Depends(get_db)):
    """
    Get all menu items. Accessible by any authenticated user.
    """
    return db.query(models.MenuItem).all()

@router.post("", response_model=schemas.MenuItemResponse, status_code=status.HTTP_201_CREATED)
async def create_menu_item(
    item: schemas.MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["owner"]))
):
    """
    Create a new menu item. Restricted to Owner only.
    """
    existing = db.query(models.MenuItem).filter(models.MenuItem.name == item.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Menu item with this name already exists.")
        
    db_item = models.MenuItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action=f"Created menu item: {db_item.name} for {db_item.price} PKR"
    )
    db.add(audit_log)
    db.commit()
    
    # Live broadcast to update Order Taker UI immediately
    await ws_manager.broadcast({"type": "MENU_UPDATE"})
    
    return db_item

@router.put("/{item_id}", response_model=schemas.MenuItemResponse)
async def update_menu_item(
    item_id: int,
    item_update: schemas.MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["owner"]))
):
    """
    Update an existing menu item. Restricted to Owner only.
    """
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
        
    for key, value in item_update.model_dump().items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action=f"Updated menu item ID {item_id}: {db_item.name}"
    )
    db.add(audit_log)
    db.commit()
    
    # Live broadcast
    await ws_manager.broadcast({"type": "MENU_UPDATE"})
    
    return db_item

@router.delete("/{item_id}")
async def delete_menu_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["owner"]))
):
    """
    Delete a menu item. Restricted to Owner only.
    """
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
        
    db.delete(db_item)
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action=f"Deleted menu item: {db_item.name}"
    )
    db.add(audit_log)
    db.commit()
    
    # Live broadcast
    await ws_manager.broadcast({"type": "MENU_UPDATE"})
    
    return {"message": "Menu item deleted successfully"}
