import os
import datetime
import secrets
import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
import jwt
from dotenv import load_dotenv

load_dotenv()

from db import get_db, pwd_context
from sqlalchemy.orm import Session as DbSession
from models import User, Session as SessionModel, NetworkEvent, CorporateAllowlist
from network_monitor import lookup_ip_telemetry, evaluate_network_risk, register_active_session

router = APIRouter()

SECRET_KEY = os.environ.get("JWT_SECRET", "trustloop_super_secret_dev_key")
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
LOGIN_MAX_ATTEMPTS = int(os.environ.get("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(os.environ.get("LOGIN_LOCKOUT_MINUTES", "15"))

# In-memory store for tracking failed login attempts: username -> {"count": int, "locked_until": datetime}
failed_login_attempts: Dict[str, Dict[str, Any]] = {}

def reset_failed_logins(username: Optional[str] = None):
    """Helper to reset lockout state (used by tests and administrative overrides)."""
    if username:
        failed_login_attempts.pop(username.strip().lower(), None)
    else:
        failed_login_attempts.clear()

# ── Pydantic Request Models ───────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)
    device_fingerprint: Optional[Dict[str, Any]] = None

class ForgotPasswordRequest(BaseModel):
    username: str = Field(..., min_length=1)

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=4)


# ── Auth Endpoints ────────────────────────────────────────────────────────────

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
    
    now = datetime.datetime.now(datetime.timezone.utc)
    key = req.username.strip().lower()

    # 1. Check Brute-Force Lockout
    if key in failed_login_attempts:
        record = failed_login_attempts[key]
        locked_until = record.get("locked_until")
        if locked_until:
            if now < locked_until:
                remaining_secs = int((locked_until - now).total_seconds())
                remaining_mins = max(1, (remaining_secs + 59) // 60)
                raise HTTPException(
                    status_code=429,
                    detail=f"Account temporarily locked due to multiple failed login attempts. Try again in {remaining_mins} minute(s)."
                )
            else:
                # Lockout expired
                del failed_login_attempts[key]

    user = db.query(User).filter(User.username == req.username).first()
    
    # 2. Check Password Verification
    if not user or not user.is_active or not pwd_context.verify(req.password, user.password_hash):
        rec = failed_login_attempts.get(key, {"count": 0, "locked_until": None})
        new_count = rec["count"] + 1
        if new_count >= LOGIN_MAX_ATTEMPTS:
            locked_time = now + datetime.timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
            failed_login_attempts[key] = {"count": new_count, "locked_until": locked_time}
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed login attempts. Account temporarily locked for {LOGIN_LOCKOUT_MINUTES} minutes."
            )
        else:
            failed_login_attempts[key] = {"count": new_count, "locked_until": None}
            remaining = LOGIN_MAX_ATTEMPTS - new_count
            raise HTTPException(
                status_code=401,
                detail=f"Invalid username or password. {remaining} attempt(s) remaining before lockout."
            )

    # Login succeeded: clear failed counter
    if key in failed_login_attempts:
        del failed_login_attempts[key]

    # 3. Extract Metadata and Network Telemetry
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")
    device_fp_str = json.dumps(req.device_fingerprint or {
        "ua": user_agent,
        "browser": "Browser",
        "os": "OS",
        "screen": "1920x1080",
        "timezone": "UTC",
        "language": "en"
    })

    # Telemetry lookup & risk scoring
    telemetry = lookup_ip_telemetry(client_ip)
    
    # Check corporate allowlist in DB
    allowlist_entries = db.query(CorporateAllowlist).all()
    network_isp = telemetry.get("isp", "Unknown")
    asn = telemetry.get("as", "Unknown")
    lat = telemetry.get("lat", 37.7749 if client_ip in ["127.0.0.1", "::1"] else None)
    lon = telemetry.get("lon", -122.4194 if client_ip in ["127.0.0.1", "::1"] else None)
    
    is_recognized = False
    for entry in allowlist_entries:
        if entry.entry_type == "ISP" and entry.value.lower() in network_isp.lower():
            is_recognized = True
            break
        elif entry.entry_type == "ASN" and entry.value.lower() in asn.lower():
            is_recognized = True
            break
        elif entry.entry_type == "IP" and entry.value == client_ip:
            is_recognized = True
            break
    if client_ip in ["127.0.0.1", "::1"]:
        is_recognized = True
        network_isp = "Acme Corp Internal Network"

    initial_trust = 100.0 if is_recognized else 85.0
    network_logic = (
        f"Session started at trust {int(initial_trust)} — recognized corporate network ({network_isp})."
        if is_recognized else
        f"Session started at trust {int(initial_trust)} — unrecognized external network ({network_isp})."
    )

    # 4. Create Session in DB
    new_session = SessionModel(
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        network_isp=network_isp,
        network_recognized=is_recognized,
        initial_trust_score=initial_trust,
        trust_score=initial_trust,
        status="active",
        lat=lat,
        lon=lon,
        device_fingerprint=device_fp_str,
        asn=asn,
        is_vpn=telemetry.get("is_vpn", False),
        is_tor=telemetry.get("is_tor", False),
        is_proxy=telemetry.get("proxy", False),
        is_datacenter=telemetry.get("hosting", False),
        network_risk_score=0.0 if is_recognized else 15.0
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    session_id = new_session.id

    # Register session for continuous background monitoring
    register_active_session(session_id)

    # 5. Record Initial Network Audit Event
    audit_evt = NetworkEvent(
        session_id=session_id,
        user_id=user.id,
        event_type="SESSION_START",
        severity="low" if is_recognized else "medium",
        risk_score=new_session.network_risk_score,
        ip_address=client_ip,
        location=f"{telemetry.get('city', 'Local')}, {telemetry.get('country', 'Internal')}",
        details=network_logic
    )
    db.add(audit_evt)
    db.commit()

    # Org event
    add_org_event("Login", user.username, user.full_name, initial_trust, session_id)

    # 6. Generate JWT
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
        "is_simulated": client_ip in ["127.0.0.1", "::1"],
        "network_risk_score": new_session.network_risk_score,
        "telemetry": telemetry
    }

# ── Password Recovery Endpoints ───────────────────────────────────────────────

reset_tokens: Dict[str, Dict[str, Any]] = {}

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
    
    del reset_tokens[req.token]
    return {"message": "Password reset successful"}

class ResetLockoutRequest(BaseModel):
    username: Optional[str] = None

@router.post("/reset-lockout")
def api_reset_lockout(req: Optional[ResetLockoutRequest] = None):
    uname = req.username if req else None
    reset_failed_logins(uname)
    return {"status": "lockout_cleared", "username": uname}
