import os
import json
import time
import math
import random
import string
import datetime
import asyncio
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import jwt as pyjwt
from dotenv import load_dotenv

load_dotenv()

from auth import router as auth_router, SECRET_KEY, ALGORITHM
from db import init_db, get_db, pwd_context, SessionLocal
from sqlalchemy.orm import Session as DbSession
from models import User, Session as SessionModel, Setting, NetworkEvent, CorporateAllowlist
from biometrics import (
    process_enrollment_batch, process_live_batch, get_session_state,
    reset_trust_score, add_org_event, get_org_events, set_admin_impostor
)
from network_monitor import (
    lookup_ip_telemetry, evaluate_network_risk, get_latency_tracker,
    register_active_session, unregister_active_session, run_network_watcher_loop,
    haversine_distance_km, check_impossible_travel
)

# ── General API Rate Limiting Middleware ───────────────────────────────────────

API_RATE_LIMIT_PER_MINUTE = int(os.environ.get("API_RATE_LIMIT_PER_MINUTE", "120"))
_ip_request_history: Dict[str, List[float]] = {}

app = FastAPI(title="TrustLoop API", version="2.0.0")

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Exempt websockets, docs, and root ping
    if request.url.path.startswith("/ws") or request.url.path in ["/", "/docs", "/openapi.json"]:
        return await call_next(request)
        
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    # Sliding 60-second window
    history = [t for t in _ip_request_history.get(client_ip, []) if now - t < 60.0]
    if len(history) >= API_RATE_LIMIT_PER_MINUTE:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too Many Requests: API rate limit exceeded. Please retry shortly."}
        )
    history.append(now)
    _ip_request_history[client_ip] = history
    
    return await call_next(request)

# ── CORS Configuration ────────────────────────────────────────────────────────

FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL != "*" else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── JWT Auth Dependencies ─────────────────────────────────────────────────────

def _decode_token(token: str) -> dict:
    try:
        return pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def _decode_bearer(request: Request) -> dict:
    """Extract and decode JWT from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return _decode_token(auth[len("Bearer "):])

def require_admin(request: Request, db: DbSession = Depends(get_db)) -> User:
    """Dependency: allows only active admin users."""
    payload = _decode_bearer(request)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    user = db.query(User).filter(User.id == payload.get("user_id"), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Admin account not found or inactive")
    return user

def get_current_employee(request: Request, db: DbSession = Depends(get_db)) -> User:
    """Dependency: decodes JWT and returns current active employee/user."""
    payload = _decode_bearer(request)
    user = db.query(User).filter(User.id == payload.get("user_id"), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found or inactive")
    return user

# ── Lifecycle Management ──────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    init_db()
    # Launch continuous background network watcher task
    asyncio.create_task(run_network_watcher_loop(SessionLocal, broadcast_to_session, add_org_event))

@app.get("/")
def read_root():
    return {"status": "TrustLoop Continuous Authentication & Network Monitoring API is running"}

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# ── Admin Endpoints: Employee Management ──────────────────────────────────────

@app.get("/api/admin/employees")
def get_all_employees(db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    users = db.query(User).filter(User.role == 'employee').all()
    employees = {}
    for u in users:
        employees[u.id] = {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "department": u.department,
            "is_active": u.is_active,
            "sessions": []
        }
        for s in sorted(u.sessions, key=lambda x: x.started_at, reverse=True):
            employees[u.id]["sessions"].append({
                "session_id": s.id,
                "trust_score": s.trust_score,
                "network_risk_score": s.network_risk_score,
                "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
                "ip_address": s.ip_address,
                "user_agent": s.user_agent,
                "network_isp": s.network_isp,
                "network_recognized": s.network_recognized,
                "initial_trust_score": s.initial_trust_score,
                "lat": s.lat,
                "lon": s.lon,
            })
    return list(employees.values())

class EmployeeCreate(BaseModel):
    full_name: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    department: str = Field(..., min_length=1)

@app.post("/api/admin/employees")
def add_employee(emp: EmployeeCreate, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
    hashed_password = pwd_context.hash(temp_password)
    
    existing = db.query(User).filter(User.username == emp.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    new_user = User(
        full_name=emp.full_name,
        username=emp.username,
        department=emp.department,
        password_hash=hashed_password,
        role="employee",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "status": "created",
        "id": new_user.id,
        "username": new_user.username,
        "full_name": new_user.full_name,
        "department": new_user.department,
        "temp_password": temp_password
    }

class EmployeeUpdate(BaseModel):
    full_name: str = Field(..., min_length=1)
    department: str = Field(..., min_length=1)
    reset_password: bool = False

@app.put("/api/admin/employees/{user_id}")
def edit_employee(user_id: int, update: EmployeeUpdate, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.full_name = update.full_name
    user.department = update.department
    
    temp_password = None
    if update.reset_password:
        temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
        user.password_hash = pwd_context.hash(temp_password)
        
    db.commit()
    return {
        "status": "updated",
        "temp_password": temp_password
    }

@app.delete("/api/admin/employees/{user_id}")
def deactivate_employee(user_id: int, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"status": "deactivated"}

# ── Admin Endpoints: Org Events, Settings & Simulation ───────────────────────

@app.get("/api/admin/events")
def get_events(_admin: User = Depends(require_admin)):
    return get_org_events()

@app.get("/api/admin/network_stats")
def get_network_stats(db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    recognized = db.query(SessionModel).filter(SessionModel.network_recognized == True).count()
    unrecognized = db.query(SessionModel).filter(SessionModel.network_recognized == False).count()
    return {"recognized": recognized, "unrecognized": unrecognized}

@app.post("/api/admin/simulate/{session_id}")
def admin_simulate_impostor(session_id: int, active: bool = True, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    set_admin_impostor(session_id, active)
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session and session.user:
        event = "Admin Triggered Impostor" if active else "Admin Stopped Impostor"
        add_org_event(event, session.user.username, session.user.full_name, session_id=session_id)
    return {"status": "ok", "session_id": session_id, "impostor_active": active}

class SettingsUpdate(BaseModel):
    lock_threshold: float = Field(..., ge=10, le=90)
    risk_threshold: float = Field(..., ge=20, le=95)

@app.get("/api/admin/settings")
def get_settings(db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    settings_rows = db.query(Setting).all()
    settings = {s.key: float(s.value) for s in settings_rows}
    return settings

@app.post("/api/admin/settings")
def update_settings(settings: SettingsUpdate, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    lock = db.query(Setting).filter(Setting.key == 'lock_threshold').first()
    if lock: lock.value = str(settings.lock_threshold)
    risk = db.query(Setting).filter(Setting.key == 'risk_threshold').first()
    if risk: risk.value = str(settings.risk_threshold)
    db.commit()
    return {"status": "ok"}

@app.post("/api/admin/sessions/{session_id}/terminate")
async def admin_terminate_session(session_id: int, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session:
        session.status = 'ended'
        db.commit()
        unregister_active_session(session_id)
    
    if session_id in active_websockets:
        for ws in list(active_websockets[session_id]):
            try:
                await ws.close(code=1000, reason="Terminated by Administrator")
            except Exception:
                pass
        del active_websockets[session_id]
        
    return {"status": "terminated"}

# ── Admin Endpoints: Network Operations & Real-Time Monitoring ───────────────

@app.get("/api/admin/network/operations")
def get_network_operations(db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    """Provides complete real-time network operations telemetry across all sessions."""
    sessions = db.query(SessionModel).order_by(SessionModel.started_at.desc()).limit(20).all()
    result = []
    for s in sessions:
        tracker = get_latency_tracker(s.id)
        stats = tracker.get_stats()
        telemetry = lookup_ip_telemetry(s.ip_address or "127.0.0.1")
        eval_result = evaluate_network_risk(s, s.ip_address or "127.0.0.1", telemetry, None, db)

        result.append({
            "session_id": s.id,
            "user_id": s.user_id,
            "username": s.user.username if s.user else "Unknown",
            "full_name": s.user.full_name if s.user else "Unknown",
            "department": s.user.department if s.user else "Unknown",
            "status": s.status,
            "ip_address": s.ip_address,
            "isp": s.network_isp,
            "asn": s.asn or telemetry.get("as", "Unknown"),
            "lat": s.lat or 37.7749,
            "lon": s.lon or -122.4194,
            "city": telemetry.get("city", "San Francisco"),
            "country": telemetry.get("country", "United States"),
            "network_risk_score": s.network_risk_score or eval_result["network_risk_score"],
            "severity": eval_result["severity"],
            "is_vpn": s.is_vpn or telemetry.get("is_vpn", False),
            "is_tor": s.is_tor or telemetry.get("is_tor", False),
            "is_proxy": s.is_proxy or telemetry.get("proxy", False),
            "is_datacenter": s.is_datacenter or telemetry.get("hosting", False),
            "avg_latency_ms": stats["avg_latency_ms"],
            "jitter_ms": stats["jitter_ms"],
            "reconnect_count": tracker.reconnect_count,
            "breakdown": eval_result["breakdown"],
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
        })
    return result

@app.get("/api/admin/network/events")
def get_network_events(db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    """Returns network audit log from the database."""
    events = db.query(NetworkEvent).order_by(NetworkEvent.timestamp.desc()).limit(100).all()
    return [{
        "id": e.id,
        "session_id": e.session_id,
        "user_id": e.user_id,
        "username": e.user.username if e.user else f"session-{e.session_id}",
        "full_name": e.user.full_name if e.user else "User",
        "timestamp": e.timestamp.strftime("%Y-%m-%d %H:%M:%S") if e.timestamp else "",
        "event_type": e.event_type,
        "severity": e.severity,
        "risk_score": e.risk_score,
        "ip_address": e.ip_address,
        "location": e.location,
        "details": e.details
    } for e in events]

class AllowlistCreate(BaseModel):
    entry_type: str = Field(..., pattern="^(ISP|ASN|IP|CIDR)$")
    value: str = Field(..., min_length=1)
    description: Optional[str] = None

@app.get("/api/admin/network/allowlist")
def get_corporate_allowlist(db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    entries = db.query(CorporateAllowlist).all()
    return [{
        "id": e.id,
        "entry_type": e.entry_type,
        "value": e.value,
        "description": e.description,
        "created_at": e.created_at.strftime("%Y-%m-%d %H:%M:%S") if e.created_at else ""
    } for e in entries]

@app.post("/api/admin/network/allowlist")
def add_corporate_allowlist_entry(entry: AllowlistCreate, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    existing = db.query(CorporateAllowlist).filter(CorporateAllowlist.value == entry.value).first()
    if existing:
        raise HTTPException(status_code=400, detail="Allowlist entry already exists")
    new_entry = CorporateAllowlist(entry_type=entry.entry_type, value=entry.value, description=entry.description)
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return {"status": "created", "id": new_entry.id, "value": new_entry.value}

@app.delete("/api/admin/network/allowlist/{entry_id}")
def delete_corporate_allowlist_entry(entry_id: int, db: DbSession = Depends(get_db), _admin: User = Depends(require_admin)):
    entry = db.query(CorporateAllowlist).filter(CorporateAllowlist.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}

class ThreatSimulationRequest(BaseModel):
    threat_type: str = Field(..., pattern="^(impossible_travel|ip_jump|tor_relay|vpn_proxy|device_drift|high_jitter|restore_healthy)$")
    custom_ip: Optional[str] = None

@app.post("/api/admin/network/simulate_threat/{session_id}")
async def simulate_network_threat(
    session_id: int,
    req: ThreatSimulationRequest,
    db: DbSession = Depends(get_db),
    _admin: User = Depends(require_admin)
):
    """
    Live threat simulator for continuous network testing.
    Mutates the session telemetry to demonstrate real-time risk scoring and alert generation.
    """
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    tracker = get_latency_tracker(session_id)
    event_type = "THREAT_SIMULATION"
    severity = "high"
    details = ""

    if req.threat_type == "impossible_travel":
        # Jump from SF to London (5,350 miles away) instantaneously
        session.lat = 51.5074
        session.lon = -0.1278
        session.ip_address = req.custom_ip or "82.165.197.1"
        session.network_isp = "British Telecom Relay"
        event_type = "IMPOSSIBLE_TRAVEL"
        severity = "critical"
        details = "Simulated geo-jump: San Francisco to London (8,610 km in 0 seconds, speed > 10,000 km/h)"

    elif req.threat_type == "ip_jump":
        old_ip = session.ip_address
        session.ip_address = req.custom_ip or "198.51.100.42"
        session.network_isp = "Untrusted Public Wi-Fi"
        event_type = "IP_CHANGE_MID_SESSION"
        severity = "high"
        details = f"Simulated mid-session IP change: from {old_ip} to {session.ip_address}"

    elif req.threat_type == "tor_relay":
        # Known Tor Exit Node from test list
        session.ip_address = "185.220.101.5"
        session.network_isp = "Tor Anonymizing Exit Router"
        session.is_tor = True
        event_type = "TOR_EXIT_NODE_DETECTED"
        severity = "critical"
        details = "Session traffic redirected through known Tor exit node relay (185.220.101.5)"

    elif req.threat_type == "vpn_proxy":
        session.ip_address = "185.156.172.5"
        session.network_isp = "Mullvad Commercial VPN Proxy"
        session.is_vpn = True
        session.is_proxy = True
        event_type = "VPN_PROXY_DETECTED"
        severity = "high"
        details = "Commercial anonymizing VPN / datacenter proxy detected"

    elif req.threat_type == "device_drift":
        # Shift user agent and device fingerprint
        new_fp = {"browser": "Firefox", "os": "Linux", "screen": "1366x768", "timezone": "Europe/Moscow", "language": "ru"}
        session.device_fingerprint = json.dumps(new_fp)
        session.user_agent = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
        event_type = "DEVICE_FINGERPRINT_DRIFT"
        severity = "medium"
        details = "Device fingerprint mismatch: browser changed from Chrome to Firefox, timezone shifted to Moscow"

    elif req.threat_type == "high_jitter":
        # Inject high latency samples
        for _ in range(5):
            tracker.samples.append(650.0)
            tracker.samples.append(85.0)
        event_type = "LATENCY_JITTER_ANOMALY"
        severity = "medium"
        details = "Abnormal transport latency (avg 480ms, jitter 280ms) indicative of proxy relay chaining"

    elif req.threat_type == "restore_healthy":
        session.ip_address = "127.0.0.1"
        session.lat = 37.7749
        session.lon = -122.4194
        session.network_isp = "Acme Corp Internal Network"
        session.is_tor = False
        session.is_vpn = False
        session.is_proxy = False
        session.is_datacenter = False
        session.network_risk_score = 0.0
        tracker.samples = [12.0, 14.0, 11.5, 13.0]
        event_type = "SESSION_RESTORED"
        severity = "low"
        details = "Session restored to trusted Acme Corp Internal Network baseline"

    # Evaluate new risk score
    telemetry = lookup_ip_telemetry(session.ip_address)
    eval_res = evaluate_network_risk(session, session.ip_address, telemetry, None, db)
    session.network_risk_score = eval_res["network_risk_score"]
    db.commit()

    # Log to audit table
    audit_evt = NetworkEvent(
        session_id=session.id,
        user_id=session.user_id,
        event_type=event_type,
        severity=severity,
        risk_score=session.network_risk_score,
        ip_address=session.ip_address,
        location=f"{telemetry.get('city', 'Unknown')}, {telemetry.get('country', 'Unknown')}",
        details=details
    )
    db.add(audit_evt)
    db.commit()

    # Org event
    username = session.user.username if session.user else f"session-{session.id}"
    fullname = session.user.full_name if session.user else "User"
    add_org_event(f"Threat Sim: {event_type}", username, fullname, 100 - session.network_risk_score, session.id)

    # Broadcast live update
    await broadcast_to_session(session_id, {
        "type": "network_update",
        "session_id": session_id,
        "network_risk_score": session.network_risk_score,
        "severity": eval_res["severity"],
        "breakdown": eval_res["breakdown"],
        "telemetry": telemetry,
        "latency_stats": eval_res["latency_stats"],
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
    })

    return {
        "status": "simulated",
        "threat_type": req.threat_type,
        "new_risk_score": session.network_risk_score,
        "severity": eval_res["severity"],
        "breakdown": eval_res["breakdown"]
    }

# ── Employee Endpoints: Own Sessions & Privacy-Respecting Network View ────────

@app.get("/api/employee/sessions")
def get_my_sessions(current_user: User = Depends(get_current_employee), db: DbSession = Depends(get_db)):
    """Returns ONLY the authenticated employee's own sessions."""
    sessions = db.query(SessionModel).filter(SessionModel.user_id == current_user.id).order_by(SessionModel.started_at.desc()).all()
    return [{
        "session_id": s.id,
        "ip_address": s.ip_address,
        "user_agent": s.user_agent,
        "network_isp": s.network_isp,
        "network_recognized": s.network_recognized,
        "network_risk_score": s.network_risk_score or 0.0,
        "initial_trust_score": s.initial_trust_score,
        "trust_score": s.trust_score,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
        "status": s.status
    } for s in sessions]

@app.get("/api/employee/network/status")
def get_employee_network_status(current_user: User = Depends(get_current_employee), db: DbSession = Depends(get_db)):
    """
    Privacy-respecting employee network security report.
    Returns only the current user's active session connection telemetry.
    """
    active_sess = db.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.status == 'active'
    ).order_by(SessionModel.started_at.desc()).first()

    if not active_sess:
        active_sess = db.query(SessionModel).filter(
            SessionModel.user_id == current_user.id
        ).order_by(SessionModel.started_at.desc()).first()

    if not active_sess:
        raise HTTPException(status_code=404, detail="No session found for employee")

    tracker = get_latency_tracker(active_sess.id)
    stats = tracker.get_stats()
    telemetry = lookup_ip_telemetry(active_sess.ip_address or "127.0.0.1")
    eval_res = evaluate_network_risk(active_sess, active_sess.ip_address or "127.0.0.1", telemetry, None, db)

    # Privacy mask: mask last octet of IP
    raw_ip = active_sess.ip_address or "127.0.0.1"
    parts = raw_ip.split(".")
    masked_ip = f"{parts[0]}.{parts[1]}.{parts[2]}.***" if len(parts) == 4 else "Localhost"

    return {
        "status": "Protected",
        "session_id": active_sess.id,
        "connection_ip": masked_ip,
        "network_isp": active_sess.network_isp or "Corporate Network",
        "network_recognized": active_sess.network_recognized,
        "security_score": round(max(0.0, 100.0 - (active_sess.network_risk_score or 0.0)), 1),
        "network_risk_score": active_sess.network_risk_score or 0.0,
        "severity": eval_res["severity"],
        "encrypted_transport": "TLS 1.3 / WSS",
        "avg_latency_ms": stats["avg_latency_ms"],
        "jitter_ms": stats["jitter_ms"],
        "connection_stability": "Optimal" if tracker.reconnect_count <= 1 else "Acceptable",
        "reconnect_count": tracker.reconnect_count,
        "allowlisted": eval_res["is_allowlisted"]
    }

# ── Authenticated WebSockets ──────────────────────────────────────────────────

active_websockets: Dict[int, List[WebSocket]] = {}

async def broadcast_to_session(session_id: int, payload: dict):
    if session_id in active_websockets:
        dead = []
        for ws in active_websockets[session_id]:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in active_websockets[session_id]:
                active_websockets[session_id].remove(ws)

@app.websocket("/ws/session/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: int, db: DbSession = Depends(get_db)):
    """
    Continuous Biometric Stream & Network Telemetry WebSocket.
    Strictly authenticated: requires JWT via query param (?token=...) or first message.
    Verifies role: Employees can ONLY connect to their OWN session. Admins can monitor any session.
    """
    token = websocket.query_params.get("token")
    
    # 1. Attempt token extraction from query params or wait for auth message
    auth_payload = None
    if token:
        try:
            auth_payload = _decode_token(token)
        except Exception as e:
            print(f"[WebSocket Auth Reject] Invalid token: {e}")
            await websocket.close(code=4001, reason="Invalid authentication token")
            return
    else:
        # Accept temporarily to receive initial auth handshake message
        await websocket.accept()
        try:
            raw_init = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            init_data = json.loads(raw_init)
            if init_data.get("action") == "auth" and init_data.get("token"):
                auth_payload = _decode_token(init_data["token"])
            else:
                await websocket.close(code=4001, reason="Authentication handshake required")
                return
        except Exception as e:
            print(f"[WebSocket Auth Reject] Handshake timeout or error: {e}")
            await websocket.close(code=4001, reason="Authentication failed")
            return

    # 2. Verify User and Session Ownership
    user_id = auth_payload.get("user_id")
    user_role = auth_payload.get("role")
    
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        await websocket.close(code=4001, reason="User account not found or inactive")
        return

    session_obj = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session_obj:
        await websocket.close(code=4004, reason="Session does not exist")
        return

    # EMPLOYEE ROLE CHECK: An employee can ONLY connect to their OWN session!
    if user_role == "employee" and session_obj.user_id != user.id:
        print(f"[SECURITY ALERT] Unauthorized WebSocket attempt: Employee '{user.username}' (id={user.id}) attempted access to session {session_id} belonging to user {session_obj.user_id}")
        
        # Log to audit table
        unauth_evt = NetworkEvent(
            session_id=session_id,
            user_id=user.id,
            event_type="UNAUTHORIZED_SESSION_WS_CONNECT",
            severity="critical",
            risk_score=95.0,
            ip_address=websocket.client.host if websocket.client else "127.0.0.1",
            details=f"Forbidden cross-session WebSocket attempt by employee {user.username} on session {session_id}"
        )
        db.add(unauth_evt)
        db.commit()
        
        await websocket.close(code=4003, reason="Access denied: Cannot access another employee's session")
        return

    # Accept if not already accepted via query param
    if not websocket.client_state.name == "CONNECTED":
        try:
            await websocket.accept()
        except Exception:
            pass

    if session_id not in active_websockets:
        active_websockets[session_id] = []
    active_websockets[session_id].append(websocket)
    register_active_session(session_id)

    tracker = get_latency_tracker(session_id)
    ws_username = session_obj.user.username if session_obj and session_obj.user else user.username
    ws_fullname = session_obj.user.full_name if session_obj and session_obj.user else user.full_name

    # Send initial state and network security telemetry immediately
    state = get_session_state(session_id)
    if state["is_enrolled"]:
        await websocket.send_text(json.dumps({
            "type": "enroll_update",
            "status": "already_enrolled",
            "baseline_means": state["baseline_means"]
        }))

    # Initial network state push
    telemetry = lookup_ip_telemetry(session_obj.ip_address or "127.0.0.1")
    eval_res = evaluate_network_risk(session_obj, session_obj.ip_address or "127.0.0.1", telemetry, None, db)
    await websocket.send_text(json.dumps({
        "type": "network_update",
        "session_id": session_id,
        "network_risk_score": session_obj.network_risk_score or eval_res["network_risk_score"],
        "severity": eval_res["severity"],
        "breakdown": eval_res["breakdown"],
        "telemetry": telemetry,
        "latency_stats": eval_res["latency_stats"],
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
    }))

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            action = payload.get("action")
            features = payload.get("features", {})

            # ── Latency Ping/Pong Handshake ──────────────────────────────────
            if action == "ping":
                client_time = payload.get("client_time")
                if client_time:
                    tracker.record_pong(client_time)
                await websocket.send_text(json.dumps({
                    "type": "pong",
                    "client_time": client_time,
                    "server_time": time.time(),
                    "latency_stats": tracker.get_stats()
                }))
                continue

            elif action == "pong":
                client_time = payload.get("client_time")
                tracker.record_pong(client_time)
                continue

            # ── Device Fingerprint Drift Update ──────────────────────────────
            elif action == "device_telemetry":
                dev = payload.get("device", {})
                eval_drift = evaluate_network_risk(session_obj, session_obj.ip_address or "127.0.0.1", telemetry, dev, db)
                if eval_drift["breakdown"].get("device_drift", {}).get("status") == "FAIL":
                    session_obj.network_risk_score = eval_drift["network_risk_score"]
                    db.commit()
                    await broadcast_to_session(session_id, {
                        "type": "network_update",
                        "session_id": session_id,
                        "network_risk_score": session_obj.network_risk_score,
                        "severity": eval_drift["severity"],
                        "breakdown": eval_drift["breakdown"],
                        "telemetry": telemetry,
                        "latency_stats": eval_drift["latency_stats"],
                        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
                    })
                continue

            # ── Behavioral Biometrics ─────────────────────────────────────────
            elif action == "enroll":
                result = process_enrollment_batch(session_id, features)
                if result.get("status") == "model_trained":
                    add_org_event("Enrollment Complete", ws_username, ws_fullname, 100, session_id)
                await broadcast_to_session(session_id, {"type": "enroll_update", **result})

            elif action == "live":
                result = process_live_batch(session_id, features)
                score = result.get("trust_score", 100)
                
                # Dynamic thresholds
                lock_setting = db.query(Setting).filter(Setting.key == 'lock_threshold').first()
                risk_setting = db.query(Setting).filter(Setting.key == 'risk_threshold').first()
                lock_threshold = float(lock_setting.value) if lock_setting else 60.0
                risk_threshold = float(risk_setting.value) if risk_setting else 80.0
                
                if score < lock_threshold:
                    add_org_event("Session Locked", ws_username, ws_fullname, round(score), session_id)
                elif score < risk_threshold:
                    add_org_event("Elevated Risk", ws_username, ws_fullname, round(score), session_id)
                
                result["lock_threshold"] = lock_threshold
                result["risk_threshold"] = risk_threshold
                await broadcast_to_session(session_id, {"type": "score_update", **result})

            elif action == "reset":
                result = reset_trust_score(session_id)
                add_org_event("Re-Authenticated", ws_username, ws_fullname, 100, session_id)
                await broadcast_to_session(session_id, {"type": "score_update", **result})

    except WebSocketDisconnect:
        print(f"WebSocket client disconnected from session {session_id}")
    finally:
        if session_id in active_websockets and websocket in active_websockets[session_id]:
            active_websockets[session_id].remove(websocket)
        if session_id in active_websockets and len(active_websockets[session_id]) == 0:
            unregister_active_session(session_id)
