from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=schemas.UserResponse)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user_in.username).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    hashed_password = auth.hash_password(user_in.password)
    new_user = models.User(
        username=user_in.username,
        hashed_password=hashed_password,
        name=user_in.name,
        role=user_in.role,
        phone_number=user_in.phone_number,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Write audit log
    audit_log = models.AuditLog(
        user_id=new_user.id,
        action=f"User signed up with username '{new_user.username}' and role '{new_user.role}'"
    )
    db.add(audit_log)
    db.commit()
    
    return new_user

@router.post("/login", response_model=schemas.Token)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == login_data.username).first()
    if not user or not auth.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account")
        
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    
    # Audit log
    audit_log = models.AuditLog(user_id=user.id, action="Logged in successfully")
    db.add(audit_log)
    db.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name
    }

# Also support standard OAuth2 Form login for Swagger docs
@router.post("/token", response_model=schemas.Token)
def login_for_swagger(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name
    }

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_details(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.post("/seed")
def seed_database(db: Session = Depends(get_db)):
    """
    Seed initial tables, menu items, and user accounts for all roles.
    """
    # 1. Create Default Users (Role Accounts)
    roles = ["order_taker", "chef", "billing", "manager", "owner"]
    created_users = []
    
    for r in roles:
        existing = db.query(models.User).filter(models.User.username == r).first()
        if not existing:
            new_user = models.User(
                username=r,
                hashed_password=auth.hash_password("password123"),
                name=f"Default {r.replace('_', ' ').title()}",
                role=r,
                is_active=True
            )
            db.add(new_user)
            created_users.append(r)
    
    # 2. Create Default Tables
    created_tables = 0
    for i in range(1, 11):
        table_num = f"T-{i}"
        existing = db.query(models.Table).filter(models.Table.table_number == table_num).first()
        if not existing:
            new_table = models.Table(
                table_number=table_num,
                capacity=2 if i <= 4 else (4 if i <= 8 else 8),
                status="empty"
            )
            db.add(new_table)
            created_tables += 1
            
    # 3. Create Default Menu Items (PKR pricing)
    menu_items = [
        # Starters
        {"name": "Samosa Chaat", "description": "Crispy samosas served with spiced chickpeas, yogurt, and chutneys.", "price": 250.0, "category": "Starters"},
        {"name": "Chicken Tikka Boti", "description": "Spiced grilled chicken skewers.", "price": 450.0, "category": "Starters"},
        {"name": "Garlic Bread", "description": "Toasted bread with fresh garlic butter.", "price": 180.0, "category": "Starters"},
        # Mains
        {"name": "Chicken Karahi (Half)", "description": "Wok-cooked chicken in spiced tomato gravy.", "price": 1200.0, "category": "Mains"},
        {"name": "Mutton Biryani", "description": "Aromatic basmati rice layered with spiced mutton.", "price": 850.0, "category": "Mains"},
        {"name": "Chicken Handi", "description": "Boneless chicken cooked in a rich, creamy tomato gravy.", "price": 950.0, "category": "Mains"},
        {"name": "Daal Makhni", "description": "Lentils cooked slow in butter and cream.", "price": 450.0, "category": "Mains"},
        {"name": "Roti/Naan", "description": "Tandoori flatbread.", "price": 40.0, "category": "Mains"},
        # Desserts
        {"name": "Shahi Kheer", "description": "Traditional Pakistani rice pudding garnished with pistachios.", "price": 300.0, "category": "Desserts"},
        {"name": "Gulab Jamun (3 Pcs)", "description": "Warm syrup-soaked milk solid spheres.", "price": 220.0, "category": "Desserts"},
        # Beverages
        {"name": "Sweet Lassi", "description": "Thick traditional yogurt beverage.", "price": 180.0, "category": "Beverages"},
        {"name": "Soft Drink (Can)", "description": "Cola, Sprite, or Fanta.", "price": 120.0, "category": "Beverages"},
        {"name": "Mineral Water (Large)", "description": "Chilled drinking water.", "price": 90.0, "category": "Beverages"}
    ]
    
    created_menu = 0
    for item in menu_items:
        existing = db.query(models.MenuItem).filter(models.MenuItem.name == item["name"]).first()
        if not existing:
            new_item = models.MenuItem(
                name=item["name"],
                description=item["description"],
                price=item["price"],
                category=item["category"],
                is_available=True
            )
            db.add(new_item)
            created_menu += 1
            
    db.commit()
    
    return {
        "message": "Database seeded successfully",
        "created_users": created_users,
        "tables_added": created_tables,
        "menu_items_added": created_menu
    }

@router.post("/logout")
def logout(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Log out the current user and write an audit log entry.
    """
    audit_log = models.AuditLog(
        user_id=current_user.id,
        action="Logged out successfully"
    )
    db.add(audit_log)
    db.commit()
    return {"message": "Logged out successfully"}
