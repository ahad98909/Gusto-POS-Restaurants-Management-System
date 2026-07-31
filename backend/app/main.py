from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base
from .websocket_manager import manager as ws_manager

# Import all routers
from .routers import auth, menu, tables, orders, billing, manager, owner

# Automatically compile database tables on start (SQLite / MySQL / Postgres)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    import sys
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
