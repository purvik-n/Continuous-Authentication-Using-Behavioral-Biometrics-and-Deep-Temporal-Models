import sqlite3
import os
from passlib.context import CryptContext

DB_FILE = "trustloop.db"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Department mapping for seeded employees
DEPARTMENTS = {
    "admin": "IT Administration",
    "emp_01": "Engineering",
    "emp_02": "Finance",
}

def get_db():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT DEFAULT 'General'
        )
    ''')
    
    # Create Sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            network_isp TEXT,
            network_recognized INTEGER DEFAULT 0,
            initial_trust_score REAL,
            trust_score REAL,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active',
            lat REAL,
            lon REAL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Create Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    
    # Seed users if empty
    cursor.execute("SELECT COUNT(*) as count FROM users")
    count = cursor.fetchone()['count']
    
    admin_pw = "admin123"
    emp1_pw = "password123"
    emp2_pw = "password456"
    
    if count == 0:
        users_to_seed = [
            ("admin", "System Administrator", pwd_context.hash(admin_pw), "admin", "IT Administration"),
            ("emp_01", "Alice Smith", pwd_context.hash(emp1_pw), "employee", "Engineering"),
            ("emp_02", "Bob Jones", pwd_context.hash(emp2_pw), "employee", "Finance"),
        ]
        
        cursor.executemany(
            "INSERT INTO users (username, full_name, password_hash, role, department) VALUES (?, ?, ?, ?, ?)", 
            users_to_seed
        )
        conn.commit()
        
        # Seed default settings
        cursor.execute("INSERT INTO settings (key, value) VALUES ('lock_threshold', '60')")
        cursor.execute("INSERT INTO settings (key, value) VALUES ('risk_threshold', '80')")
        conn.commit()
    else:
        # Ensure admin user has updated password hash for admin123
        cursor.execute("UPDATE users SET password_hash = ? WHERE username = 'admin'", (pwd_context.hash(admin_pw),))
        conn.commit()
        
    # Query and print seeded admin user to console
    cursor.execute("SELECT username, role, full_name FROM users WHERE role = 'admin'")
    admin_rows = cursor.fetchall()
    for ar in admin_rows:
        print(f"[TrustLoop DB] Verified Seeded Admin Username: '{ar['username']}' ({ar['full_name']}) | Role: {ar['role']}")
        
    conn.close()

if __name__ == "__main__":
    init_db()
