from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import jwt
import requests
import datetime
import os
from db import get_db, pwd_context
from sqlalchemy.orm import Session as DbSession
from models import User, Session

router = APIRouter()
SECRET_KEY = os.environ.get("JWT_SECRET", "trustloop_super_secret_dev_key")
ALGORITHM = "HS256"

# In-memory cache for IP API responses to avoid rate limits
ip_cache = {}

class LoginRequest(BaseModel):
    username: str
    password: str

@router.get("/me")
def get_me(request: Request, db: DbSession = Depends(get_db)):
    """Validates the JWT from the Authorization header and returns the current user's info."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header[len("Bearer "):]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name,
        "session_id": payload.get("session_id"),
    }

@router.get("/users")
def get_users(db: DbSession = Depends(get_db)):
    """Returns a list of active employee users for the login dropdown."""
    users = db.query(User).filter(User.role == 'employee', User.is_active == True).all()
    return [{"username": u.username, "full_name": u.full_name} for u in users]

@router.post("/login")
def login(req: LoginRequest, request: Request, db: DbSession = Depends(get_db)):
    from biometrics import add_org_event
    
    user = db.query(User).filter(User.username == req.username).first()
    
    if not user or not user.is_active or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    # Extract request metadata
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")
    
    network_isp = "Unknown"
    initial_trust = 85.0
    network_logic = "Session started at trust 85 — unrecognized network."
    is_simulated = False
    network_recognized = False
    lat = None
    lon = None
    
    # Network Layer Logic with caching and fallbacks
    if client_ip in ["127.0.0.1", "::1"]:
        network_isp = "Acme Corp Internal Network"
        initial_trust = 100.0
        network_logic = "Session started at trust 100 — recognized corporate network (Acme Corp Internal)."
        is_simulated = True
        network_recognized = True
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
                network_recognized = True
            else:
                initial_trust = 85.0
                network_logic = f"Session started at trust 85 — unrecognized network ({network_isp})."
        else:
            network_isp = "Unknown network (Lookup Failed)"
            initial_trust = 85.0
            network_logic = "Session started at trust 85 — network lookup failed, defaulting to neutral baseline."

    # Create session
    new_session = Session(
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        network_isp=network_isp,
        network_recognized=network_recognized,
        initial_trust_score=initial_trust,
        trust_score=initial_trust,
        status="active",
        lat=lat,
        lon=lon
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    session_id = new_session.id
    
    # Fire org event
    add_org_event("Login", user.username, user.full_name, initial_trust, session_id)
    
    # Generate JWT with roles
    token_data = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
        "full_name": user.full_name,
        "session_id": session_id,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "session_id": session_id,
        "user_id": user.id,
        "role": user.role,
        "full_name": user.full_name,
        "network_isp": network_isp,
        "initial_trust": initial_trust,
        "network_logic": network_logic,
        "is_simulated": is_simulated
    }

# In-memory token store for forgot password: token -> {"username": str, "exp": datetime}
reset_tokens = {}

class ForgotPasswordRequest(BaseModel):
    username: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

import secrets

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: DbSession = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")
        
    token = secrets.token_urlsafe(16)
    reset_tokens[token] = {
        "username": req.username,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
    }
    
    return {"message": "Token generated", "token": token}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: DbSession = Depends(get_db)):
    if req.token not in reset_tokens:
        raise HTTPException(status_code=400, detail="Invalid token")
        
    token_data = reset_tokens[req.token]
    if datetime.datetime.now(datetime.timezone.utc) > token_data["exp"]:
        del reset_tokens[req.token]
        raise HTTPException(status_code=400, detail="Token expired")
        
    user = db.query(User).filter(User.username == token_data["username"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password_hash = pwd_context.hash(req.new_password)
    db.commit()
    
    # Invalidate token
    del reset_tokens[req.token]
    
    return {"message": "Password reset successful"}
