from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from auth import router as auth_router
from db import init_db, get_db

app = FastAPI(title="TrustLoop API")

active_websockets: dict[int, WebSocket] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
def get_all_employees():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.full_name, u.department,
               s.id as session_id, s.trust_score, s.status, s.started_at, 
               s.ip_address, s.user_agent, s.network_isp, s.network_recognized,
               s.initial_trust_score, s.last_active_at, s.lat, s.lon
        FROM users u
        LEFT JOIN sessions s ON u.id = s.user_id
        WHERE u.role = 'employee'
        ORDER BY u.id, s.started_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    employees = {}
    for row in rows:
        uid = row['id']
        if uid not in employees:
            employees[uid] = {
                "id": uid,
                "username": row['username'],
                "full_name": row['full_name'],
                "department": row['department'],
                "sessions": []
            }
        if row['session_id']:
            employees[uid]["sessions"].append({
                "session_id": row['session_id'],
                "trust_score": row['trust_score'],
                "status": row['status'],
                "started_at": row['started_at'],
                "last_active_at": row['last_active_at'],
                "ip_address": row['ip_address'],
                "user_agent": row['user_agent'],
                "network_isp": row['network_isp'],
                "network_recognized": row['network_recognized'],
                "initial_trust_score": row['initial_trust_score'],
                "lat": row['lat'],
                "lon": row['lon'],
            })
    
    return list(employees.values())

@app.get("/api/admin/events")
def get_events():
    from biometrics import get_org_events
    return get_org_events()

@app.get("/api/admin/network_stats")
def get_network_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT network_recognized, COUNT(*) as count FROM sessions GROUP BY network_recognized")
    rows = cursor.fetchall()
    conn.close()
    recognized = 0
    unrecognized = 0
    for row in rows:
        if row['network_recognized'] == 1:
            recognized = row['count']
        else:
            unrecognized = row['count']
    return {"recognized": recognized, "unrecognized": unrecognized}

@app.post("/api/admin/simulate/{session_id}")
def admin_simulate_impostor(session_id: int, active: bool = True):
    from biometrics import set_admin_impostor, add_org_event
    set_admin_impostor(session_id, active)
    # Look up which user this session belongs to
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT u.username, u.full_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        event = "Admin Triggered Impostor" if active else "Admin Stopped Impostor"
        add_org_event(event, row['username'], row['full_name'], session_id=session_id)
    return {"status": "ok", "session_id": session_id, "impostor_active": active}

class SettingsUpdate(BaseModel):
    lock_threshold: float
    risk_threshold: float

@app.get("/api/admin/settings")
def get_settings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    settings = {row['key']: float(row['value']) for row in cursor.fetchall()}
    conn.close()
    return settings

@app.post("/api/admin/settings")
def update_settings(settings: SettingsUpdate):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE settings SET value = ? WHERE key = 'lock_threshold'", (str(settings.lock_threshold),))
    cursor.execute("UPDATE settings SET value = ? WHERE key = 'risk_threshold'", (str(settings.risk_threshold),))
    conn.commit()
    conn.close()
    return {"status": "ok"}

@app.post("/api/admin/sessions/{session_id}/terminate")
async def admin_terminate_session(session_id: int):
    # Mark session ended in DB
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET status = 'ended' WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    
    # Close websocket
    if session_id in active_websockets:
        await active_websockets[session_id].close()
        del active_websockets[session_id]
        
    return {"status": "terminated"}

@app.get("/api/employee/sessions")
def get_my_sessions(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id as session_id, ip_address, user_agent, network_isp, 
               initial_trust_score, trust_score, started_at, last_active_at, status
        FROM sessions WHERE user_id = ?
        ORDER BY started_at DESC
    """, (user_id,))
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return sessions

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
async def websocket_session(websocket: WebSocket, session_id: int):
    await websocket.accept()
    
    # Look up username for org events
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT u.username, u.full_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    ws_username = row['username'] if row else "unknown"
    ws_fullname = row['full_name'] if row else "Unknown"
    
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
                
                # Read dynamic thresholds
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM settings WHERE key = 'lock_threshold'")
                lock_threshold = float(cursor.fetchone()['value'])
                cursor.execute("SELECT value FROM settings WHERE key = 'risk_threshold'")
                risk_threshold = float(cursor.fetchone()['value'])
                conn.close()
                
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
