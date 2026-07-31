import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    PROJECT_NAME: str = "Gusto POS"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkeygustopos1234567890!")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day (1440 minutes)
    
    # Default to SQLite, override with MySQL/PostgreSQL URL in .env
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./restaurant.db")

settings = Settings()
