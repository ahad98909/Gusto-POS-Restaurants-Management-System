from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine.url import make_url
import pymysql
from .config import settings

def create_database_if_not_exists(database_url: str):
    if not database_url.startswith("mysql"):
        return
    try:
        url_obj = make_url(database_url)
        user = url_obj.username or "root"
        password = url_obj.password or ""
        host = url_obj.host or "localhost"
        port = url_obj.port or 3306
        db_name = url_obj.database
        
        if not db_name:
            return
            
        connection = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            connect_timeout=5
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
                cursor.execute(f"USE `{db_name}`;")
                
                # Create helper views to show Employee and Order Taker names directly in MySQL Workbench
                try:
                    cursor.execute("""
                    CREATE OR REPLACE VIEW v_attendance AS
                    SELECT a.id, u.name AS employee_name, u.username, u.role, a.date, a.clock_in, a.clock_out, a.status
                    FROM attendance a JOIN users u ON a.user_id = u.id;
                    """)
                    cursor.execute("""
                    CREATE OR REPLACE VIEW v_orders AS
                    SELECT o.id AS order_id, u.name AS order_taker_name, u.username AS order_taker_username, COALESCE(t.table_number, 'Takeaway') AS table_number, o.total_amount, o.status, o.created_at
                    FROM orders o JOIN users u ON o.user_id = u.id LEFT JOIN tables t ON o.table_id = t.id;
                    """)
                    cursor.execute("""
                    CREATE OR REPLACE VIEW v_bills AS
                    SELECT b.id AS bill_id, b.order_id, u.name AS order_taker_name, b.subtotal, b.tax_amount, b.discount, b.total_amount, b.payment_status, b.payment_method, b.generated_at
                    FROM bills b JOIN orders o ON b.order_id = o.id JOIN users u ON o.user_id = u.id;
                    """)
                except Exception:
                    pass # Views will compile once tables are created

            connection.commit()
            print(f"Verified/Created MySQL database '{db_name}' and helper views.")
        finally:
            connection.close()

    except Exception as e:
        print(f"Warning: Failed to automatically verify/create MySQL database: {e}")


from sqlalchemy.pool import NullPool

# Ensure database exists before creating sqlalchemy engine
create_database_if_not_exists(settings.DATABASE_URL)

# SQLite needs connect_args={"check_same_thread": False} to run in FastAPI multi-threaded environment
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        poolclass=NullPool
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
