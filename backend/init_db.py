import datetime
from app.database import engine, Base, SessionLocal
from app import models, auth

def init_and_seed():
    print("=== Initializing database schema ===")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        import sys
        from app.config import settings
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
    
    db = SessionLocal()
    try:
        # Check if database is already seeded
        existing_user = db.query(models.User).first()
        if existing_user:
            print("Database already contains records. Skipping seeding.")
            return
            
        print("Seeding default role accounts...")
        roles = ["order_taker", "chef", "billing", "manager", "owner"]
        for r in roles:
            new_user = models.User(
                username=r,
                hashed_password=auth.hash_password("password123"),
                name=f"Default {r.replace('_', ' ').title()}",
                role=r,
                is_active=True
            )
            db.add(new_user)
            
        print("Seeding default dining tables...")
        for i in range(1, 11):
            table_num = f"T-{i}"
            new_table = models.Table(
                table_number=table_num,
                capacity=2 if i <= 4 else (4 if i <= 8 else 8),
                status="empty"
            )
            db.add(new_table)
            
        print("Seeding Pakistani menu items...")
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
        print("=== Database seeded successfully! ===")
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_and_seed()
