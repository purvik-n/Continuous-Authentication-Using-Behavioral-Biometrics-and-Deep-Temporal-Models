from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from auth import router as auth_router
from db import init_db, get_db, pwd_context
from sqlalchemy.orm import Session as DbSession
from models import User, Session, Setting
import string
import random

app = FastAPI(title="TrustLoop API")

active_websockets: dict[int, WebSocket] = {}

FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL != "*" else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def read_root():
    return {"status": "TrustLoop API is running"}

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# --- Admin endpoints ---

@app.get("/api/admin/employees")
def get_all_employees(db: DbSession = Depends(get_db)):
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
    full_name: str
    username: str
    department: str

@app.post("/api/admin/employees")
def add_employee(emp: EmployeeCreate, db: DbSession = Depends(get_db)):
    # Generate temporary password
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
        "temp_password": temp_password # Return once for the admin to copy
    }

class EmployeeUpdate(BaseModel):
    full_name: str
    department: str
    reset_password: bool = False

@app.put("/api/admin/employees/{user_id}")
def edit_employee(user_id: int, update: EmployeeUpdate, db: DbSession = Depends(get_db)):
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
def deactivate_employee(user_id: int, db: DbSession = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    return {"status": "deactivated"}

@app.get("/api/admin/events")
def get_events():
    from biometrics import get_org_events
    return get_org_events()

@app.get("/api/admin/network_stats")
def get_network_stats(db: DbSession = Depends(get_db)):
    recognized = db.query(Session).filter(Session.network_recognized == True).count()
    unrecognized = db.query(Session).filter(Session.network_recognized == False).count()
    return {"recognized": recognized, "unrecognized": unrecognized}

@app.post("/api/admin/simulate/{session_id}")
def admin_simulate_impostor(session_id: int, active: bool = True, db: DbSession = Depends(get_db)):
    from biometrics import set_admin_impostor, add_org_event
    set_admin_impostor(session_id, active)
    # Look up which user this session belongs to
    session = db.query(Session).filter(Session.id == session_id).first()
    if session and session.user:
        event = "Admin Triggered Impostor" if active else "Admin Stopped Impostor"
        add_org_event(event, session.user.username, session.user.full_name, session_id=session_id)
    return {"status": "ok", "session_id": session_id, "impostor_active": active}

class SettingsUpdate(BaseModel):
    lock_threshold: float
    risk_threshold: float

@app.get("/api/admin/settings")
def get_settings(db: DbSession = Depends(get_db)):
    settings_rows = db.query(Setting).all()
    settings = {s.key: float(s.value) for s in settings_rows}
    return settings

@app.post("/api/admin/settings")
def update_settings(settings: SettingsUpdate, db: DbSession = Depends(get_db)):
    lock = db.query(Setting).filter(Setting.key == 'lock_threshold').first()
    if lock: lock.value = str(settings.lock_threshold)
    risk = db.query(Setting).filter(Setting.key == 'risk_threshold').first()
    if risk: risk.value = str(settings.risk_threshold)
    db.commit()
    return {"status": "ok"}

@app.post("/api/admin/sessions/{session_id}/terminate")
async def admin_terminate_session(session_id: int, db: DbSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if session:
        session.status = 'ended'
        db.commit()
    
    # Close websocket
    if session_id in active_websockets:
        await active_websockets[session_id].close()
        del active_websockets[session_id]
        
    return {"status": "terminated"}

@app.get("/api/employee/sessions")
def get_my_sessions(user_id: int, db: DbSession = Depends(get_db)):
    sessions = db.query(Session).filter(Session.user_id == user_id).order_by(Session.started_at.desc()).all()
    return [{
        "session_id": s.id,
        "ip_address": s.ip_address,
        "user_agent": s.user_agent,
        "network_isp": s.network_isp,
        "initial_trust_score": s.initial_trust_score,
        "trust_score": s.trust_score,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
        "status": s.status
    } for s in sessions]

# --- WebSocket ---

from biometrics import process_enrollment_batch, process_live_batch, get_session_state, reset_trust_score, add_org_event

active_websockets: dict[int, list[WebSocket]] = {}

async def broadcast_to_session(session_id: int, payload: dict):
    if session_id in active_websockets:
        dead = []
        for ws in active_websockets[session_id]:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            active_websockets[session_id].remove(ws)

@app.websocket("/ws/session/{session_id}")
async def websocket_session(websocket: WebSocket, session_id: int, db: DbSession = Depends(get_db)):
    await websocket.accept()
    
    # Look up username for org events
    session_obj = db.query(Session).filter(Session.id == session_id).first()
    ws_username = session_obj.user.username if session_obj and session_obj.user else "unknown"
    ws_fullname = session_obj.user.full_name if session_obj and session_obj.user else "Unknown"
    
    if session_id not in active_websockets:
        active_websockets[session_id] = []
    active_websockets[session_id].append(websocket)
    
    # Send current session state immediately upon connection
    state = get_session_state(session_id)
    if state["is_enrolled"]:
        await websocket.send_text(json.dumps({
            "type": "enroll_update",
            "status": "already_enrolled",
            "baseline_means": state["baseline_means"]
        }))
    
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            action = payload.get("action")
            features = payload.get("features", {})
            
            if action == "enroll":
                result = process_enrollment_batch(session_id, features)
                if result.get("status") == "model_trained":
                    add_org_event("Enrollment Complete", ws_username, ws_fullname, 100, session_id)
                await broadcast_to_session(session_id, {"type": "enroll_update", **result})
            elif action == "live":
                result = process_live_batch(session_id, features)
                score = result.get("trust_score", 100)
                
                # Re-fetch settings each time using a fresh session generator since Depends(get_db) 
                # might be bound to the websocket connection's lifecycle and DB could time out.
                # But we'll try using the injected db first.
                lock_setting = db.query(Setting).filter(Setting.key == 'lock_threshold').first()
                risk_setting = db.query(Setting).filter(Setting.key == 'risk_threshold').first()
                
                lock_threshold = float(lock_setting.value) if lock_setting else 60.0
                risk_threshold = float(risk_setting.value) if risk_setting else 80.0
                
                # Fire org events on threshold crossings
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
