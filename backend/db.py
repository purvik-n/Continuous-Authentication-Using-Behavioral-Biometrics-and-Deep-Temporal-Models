import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base, User, Setting, CorporateAllowlist, NetworkEvent
from passlib.context import CryptContext

load_dotenv()

# Read from env var, default to local sqlite
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./trustloop.db")

# If using sqlite, check_same_thread=False is needed for FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEPARTMENTS = {
    "admin": "IT Administration",
    "emp_01": "Engineering",
    "emp_02": "Finance",
}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _migrate_session_columns():
    """Ensure newly added columns exist in sqlite sessions table."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(sessions)"))
            existing_columns = {row[1] for row in result.fetchall()}
            
            columns_to_add = [
                ("network_risk_score", "FLOAT DEFAULT 0.0"),
                ("device_fingerprint", "TEXT DEFAULT '{}'"),
                ("asn", "VARCHAR DEFAULT 'Unknown'"),
                ("is_vpn", "BOOLEAN DEFAULT 0"),
                ("is_tor", "BOOLEAN DEFAULT 0"),
                ("is_proxy", "BOOLEAN DEFAULT 0"),
                ("is_datacenter", "BOOLEAN DEFAULT 0"),
                ("avg_latency_ms", "FLOAT DEFAULT 0.0"),
                ("jitter_ms", "FLOAT DEFAULT 0.0"),
                ("reconnect_count", "INTEGER DEFAULT 0"),
            ]
            for col_name, col_type in columns_to_add:
                if col_name not in existing_columns:
                    conn.execute(text(f"ALTER TABLE sessions ADD COLUMN {col_name} {col_type}"))
            conn.commit()
    except Exception as e:
        print(f"[TrustLoop DB] Column migration notice: {e}")

def init_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    _migrate_session_columns()
    
    db = SessionLocal()
    try:
        count = db.query(User).count()
        
        admin_pw = os.environ.get("DEFAULT_ADMIN_PASSWORD", "admin123")
        emp1_pw = os.environ.get("DEFAULT_EMP1_PASSWORD", "password123")
        emp2_pw = os.environ.get("DEFAULT_EMP2_PASSWORD", "password456")
        
        if count == 0:
            print("[TrustLoop DB] No users found. Seeding initial data...")
            users_to_seed = [
                User(username="admin", full_name="System Administrator", password_hash=pwd_context.hash(admin_pw), role="admin", department="IT Administration"),
                User(username="emp_01", full_name="Alice Smith", password_hash=pwd_context.hash(emp1_pw), role="employee", department="Engineering"),
                User(username="emp_02", full_name="Bob Jones", password_hash=pwd_context.hash(emp2_pw), role="employee", department="Finance"),
            ]
            db.add_all(users_to_seed)
            db.commit()
            
            # Seed default settings
            db.add(Setting(key="lock_threshold", value="60"))
            db.add(Setting(key="risk_threshold", value="80"))
            db.commit()
        else:
            # Ensure admin user has updated password hash for admin123
            admin_user = db.query(User).filter(User.username == 'admin').first()
            if admin_user:
                admin_user.password_hash = pwd_context.hash(admin_pw)
                db.commit()
                
        # Seed Corporate Allowlist defaults if empty
        allowlist_count = db.query(CorporateAllowlist).count()
        if allowlist_count == 0:
            default_entries = [
                CorporateAllowlist(entry_type="ISP", value="Acme Corp Internal Network", description="Headquarters corporate intranet"),
                CorporateAllowlist(entry_type="IP", value="127.0.0.1", description="Local development loopback"),
                CorporateAllowlist(entry_type="IP", value="::1", description="IPv6 loopback"),
                CorporateAllowlist(entry_type="ISP", value="Google LLC", description="Trusted corporate cloud gateway"),
                CorporateAllowlist(entry_type="ASN", value="AS15169", description="Google Autonomous System"),
                CorporateAllowlist(entry_type="ISP", value="Amazon.com, Inc.", description="Trusted corporate AWS gateway"),
                CorporateAllowlist(entry_type="ASN", value="AS16509", description="Amazon AWS Autonomous System")
            ]
            db.add_all(default_entries)
            db.commit()

        # Query and print seeded admin user to console
        admin_users = db.query(User).filter(User.role == 'admin').all()
        for ar in admin_users:
            print(f"[TrustLoop DB] Verified Seeded Admin Username: '{ar.username}' ({ar.full_name}) | Role: {ar.role}")
            
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
