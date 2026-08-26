from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import jwt
import requests
import datetime
from db import get_db, pwd_context

router = APIRouter()
SECRET_KEY = "trustloop_super_secret_dev_key"
ALGORITHM = "HS256"

# In-memory cache for IP API responses to avoid rate limits
ip_cache = {}

class LoginRequest(BaseModel):
    username: str
    password: str

@router.get("/users")
def get_users():
    """Returns a list of employee users for the login dropdown."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT username, full_name FROM users WHERE role = 'employee'")
    users = cursor.fetchall()
    conn.close()
    return [{"username": u["username"], "full_name": u["full_name"]} for u in users]

@router.post("/login")
def login(req: LoginRequest, request: Request):
    from biometrics import add_org_event
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE username = ?", (req.username,))
    user = cursor.fetchone()
    
    if not user or not pwd_context.verify(req.password, user['password_hash']):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    # Extract request metadata
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")
    
    network_isp = "Unknown"
    initial_trust = 85.0
    network_logic = "Session started at trust 85 — unrecognized network."
    is_simulated = False
    network_recognized = 0
    lat = None
    lon = None
    
    # Network Layer Logic with caching and fallbacks
    if client_ip in ["127.0.0.1", "::1"]:
        network_isp = "Acme Corp Internal Network"
        initial_trust = 100.0
        network_logic = "Session started at trust 100 — recognized corporate network (Acme Corp Internal)."
        is_simulated = True
        network_recognized = 1
        lat = 37.7749 # Dummy SF coordinate for localhost
        lon = -122.4194
    else:
        if client_ip in ip_cache:
            resp = ip_cache[client_ip]
        else:
            try:
                raw_resp = requests.get(f"http://ip-api.com/json/{client_ip}", timeout=2)
                resp = raw_resp.json()
                if resp.get("status") == "success":
                    ip_cache[client_ip] = resp
                else:
                    resp = None
            except Exception as e:
                print(f"IP-API failed or timed out: {e}")
                resp = None
                
        if resp:
            network_isp = resp.get("isp", "Unknown")
            lat = resp.get("lat")
            lon = resp.get("lon")
            known_isps = ["Google", "Amazon", "Acme"]
            if any(known in network_isp for known in known_isps):
                initial_trust = 100.0
                network_logic = f"Session started at trust 100 — recognized network ({network_isp})."
                network_recognized = 1
            else:
                initial_trust = 85.0
                network_logic = f"Session started at trust 85 — unrecognized network ({network_isp})."
        else:
            network_isp = "Unknown network (Lookup Failed)"
            initial_trust = 85.0
            network_logic = "Session started at trust 85 — network lookup failed, defaulting to neutral baseline."

    # Create session
    cursor.execute(
        "INSERT INTO sessions (user_id, ip_address, user_agent, network_isp, network_recognized, initial_trust_score, trust_score, status, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user['id'], client_ip, user_agent, network_isp, network_recognized, initial_trust, initial_trust, "active", lat, lon)
    )
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Fire org event
    add_org_event("Login", user['username'], user['full_name'], initial_trust, session_id)
    
    # Generate JWT with roles
    token_data = {
        "sub": user['username'],
        "user_id": user['id'],
        "role": user['role'],
        "full_name": user['full_name'],
        "session_id": session_id,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "session_id": session_id,
        "user_id": user['id'],
        "role": user['role'],
        "full_name": user['full_name'],
        "network_isp": network_isp,
        "initial_trust": initial_trust,
        "network_logic": network_logic,
        "is_simulated": is_simulated
    }
