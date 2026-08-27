import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Setting
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

def init_db():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        count = db.query(User).count()
        
        admin_pw = "admin123"
        emp1_pw = "password123"
        emp2_pw = "password456"
        
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
                
        # Query and print seeded admin user to console
        admin_users = db.query(User).filter(User.role == 'admin').all()
        for ar in admin_users:
            print(f"[TrustLoop DB] Verified Seeded Admin Username: '{ar.username}' ({ar.full_name}) | Role: {ar.role}")
            
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
