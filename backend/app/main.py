from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base
from .websocket_manager import manager as ws_manager

# Import all routers
from .routers import auth, menu, tables, orders, billing, manager, owner

# Automatically compile database tables and seed on start (SQLite / MySQL / Postgres)
try:
    Base.metadata.create_all(bind=engine)
    
    # Auto-seed database if no users exist
    from .database import SessionLocal
    from . import models
    from . import auth as auth_helper
    db = SessionLocal()
    try:
        existing_user = db.query(models.User).first()
        if not existing_user:
            print("Database empty. Auto-seeding default role accounts...")
            
            # 1. Default Users
            roles = ["order_taker", "chef", "billing", "manager", "owner"]
            for r in roles:
                new_user = models.User(
                    username=r,
                    hashed_password=auth_helper.hash_password("password123"),
                    name=f"Default {r.replace('_', ' ').title()}",
                    role=r,
                    is_active=True
                )
                db.add(new_user)
                
            # 2. Default Dining Tables
            for i in range(1, 11):
                table_num = f"T-{i}"
                new_table = models.Table(
                    table_number=table_num,
                    capacity=2 if i <= 4 else (4 if i <= 8 else 8),
                    status="empty"
                )
                db.add(new_table)
                
            # 3. Default Pakistani Menu Items
            menu_items = [
                {"name": "Samosa Chaat", "description": "Crispy samosas served with spiced chickpeas, yogurt, and chutneys.", "price": 250.0, "category": "Starters"},
                {"name": "Chicken Tikka Boti", "description": "Spiced grilled chicken skewers.", "price": 450.0, "category": "Starters"},
                {"name": "Garlic Bread", "description": "Toasted bread with fresh garlic butter.", "price": 180.0, "category": "Starters"},
                {"name": "Chicken Karahi (Half)", "description": "Wok-cooked chicken in spiced tomato gravy.", "price": 1200.0, "category": "Mains"},
                {"name": "Mutton Biryani", "description": "Aromatic basmati rice layered with spiced mutton.", "price": 850.0, "category": "Mains"},
                {"name": "Chicken Handi", "description": "Boneless chicken cooked in a rich, creamy tomato gravy.", "price": 950.0, "category": "Mains"},
                {"name": "Daal Makhni", "description": "Lentils cooked slow in butter and cream.", "price": 450.0, "category": "Mains"},
                {"name": "Roti/Naan", "description": "Tandoori flatbread.", "price": 40.0, "category": "Mains"},
                {"name": "Shahi Kheer", "description": "Traditional Pakistani rice pudding garnished with pistachios.", "price": 300.0, "category": "Desserts"},
                {"name": "Gulab Jamun (3 Pcs)", "description": "Warm syrup-soaked milk solid spheres.", "price": 220.0, "category": "Desserts"},
                {"name": "Sweet Lassi", "description": "Thick traditional yogurt beverage.", "price": 180.0, "category": "Beverages"},
                {"name": "Soft Drink (Can)", "description": "Cola, Sprite, or Fanta.", "price": 120.0, "category": "Beverages"},
                {"name": "Mineral Water (Large)", "description": "Chilled drinking water.", "price": 90.0, "category": "Beverages"}
            ]
            for item in menu_items:
                new_item = models.MenuItem(
                    name=item["name"],
                    description=item["description"],
                    price=item["price"],
                    category=item["category"],
                    is_available=True
                )
                db.add(new_item)
                
            db.commit()
            print("Auto-seeding database completed successfully!")
    except Exception as e:
        print(f"Failed to auto-seed database: {e}")
        db.rollback()
    finally:
        db.close()
except Exception as e:
    import sys
    from .config import settings
    print("\n" + "="*80)
    print(" DATABASE CONNECTION ERROR ".center(80, "*"))
    print("="*80)
    print(f"Failed to connect to the database: {e}\n")
    if "mysql" in settings.DATABASE_URL:
        print("This error usually occurs when the MySQL server/service is not running.")
        print("To resolve this permanently:")
        print("1. Double-click the 'setup_mysql_service.bat' file in the project folder.")
        print("   This will configure the 'MYSQL80' service to start automatically when")
        print("   your PC boots and will start it now.")
        print("2. Alternatively, open Windows Services (services.msc), find 'MYSQL80',")
        print("   set its Startup Type to 'Automatic', and click 'Start'.")
    print("="*80 + "\n")
    sys.exit(1)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Full-stack Restaurant Management POS backend with real-time sync",
    version="1.0.0"
)

# CORS Middleware (allows communication from React client at port 5173 or other)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local testing, allow any origin. In production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(menu.router, prefix=settings.API_V1_STR)
app.include_router(tables.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)
app.include_router(billing.router, prefix=settings.API_V1_STR)
app.include_router(manager.router, prefix=settings.API_V1_STR)
app.include_router(owner.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "api_documentation": "/docs"
    }

# Real-time WebSocket connection hub
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Maintain active connection and listen for heartbeat ping/messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
