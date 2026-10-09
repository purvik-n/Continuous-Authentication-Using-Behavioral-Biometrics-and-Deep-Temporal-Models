import pytest
import datetime
import requests
import json
import asyncio
import websockets

from auth import reset_failed_logins
from network_monitor import (
    haversine_distance_km, check_impossible_travel,
    lookup_ip_telemetry, evaluate_network_risk
)
from db import SessionLocal
from models import User, Session as SessionModel

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"

def clear_lockout(username: str = None):
    requests.post(f"{BASE_URL}/api/auth/reset-lockout", json={"username": username})

def get_user_token(username: str, password: str = "password123"):
    clear_lockout(username)
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    data = resp.json()
    return data["access_token"], data["session_id"], data["user_id"]

def get_admin_token():
    clear_lockout("admin")
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


# ── Test 1: Anonymous user gets 401 on admin routes ───────────────────────────

def test_anonymous_gets_401_on_admin_routes():
    routes = [
        ("GET", "/api/admin/employees"),
        ("GET", "/api/admin/events"),
        ("GET", "/api/admin/network_stats"),
        ("GET", "/api/admin/settings"),
        ("GET", "/api/admin/network/operations"),
        ("GET", "/api/admin/network/events"),
        ("GET", "/api/admin/network/allowlist"),
    ]
    for method, path in routes:
        if method == "GET":
            res = requests.get(f"{BASE_URL}{path}")
        else:
            res = requests.post(f"{BASE_URL}{path}", json={})
        assert res.status_code == 401, f"Expected 401 for anonymous access to {path}, got {res.status_code}"
        assert "detail" in res.json()


# ── Test 2: Employee token gets 403 on admin routes ───────────────────────────

def test_employee_token_gets_403_on_admin_routes():
    emp_token, _, _ = get_user_token("emp_01", "password123")
    headers = {"Authorization": f"Bearer {emp_token}"}

    routes = [
        ("GET", "/api/admin/employees"),
        ("GET", "/api/admin/events"),
        ("GET", "/api/admin/network_stats"),
        ("GET", "/api/admin/settings"),
        ("GET", "/api/admin/network/operations"),
        ("GET", "/api/admin/network/events"),
        ("GET", "/api/admin/network/allowlist"),
    ]
    for method, path in routes:
        if method == "GET":
            res = requests.get(f"{BASE_URL}{path}", headers=headers)
        else:
            res = requests.post(f"{BASE_URL}{path}", json={}, headers=headers)
        assert res.status_code == 403, f"Expected 403 for employee access to {path}, got {res.status_code}"
        assert res.json().get("detail") == "Admin privileges required"


# ── Test 3: Employee A cannot read Employee B's sessions ──────────────────────

def test_employee_a_cannot_read_employee_b_sessions():
    token_a, session_a_id, user_a_id = get_user_token("emp_01", "password123")
    token_b, session_b_id, user_b_id = get_user_token("emp_02", "password456")

    # Employee A calls /api/employee/sessions
    res_a = requests.get(f"{BASE_URL}/api/employee/sessions", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    sessions_a = res_a.json()
    assert len(sessions_a) > 0

    # Ensure all sessions belong to Employee A's session IDs, and none match Employee B
    sess_ids_for_a = [s["session_id"] for s in sessions_a]
    assert session_a_id in sess_ids_for_a
    assert session_b_id not in sess_ids_for_a, "Employee A's endpoint leaked Employee B's session!"

    # Ensure Employee A query parameter tampering is ignored (token determines user)
    tampered_res = requests.get(f"{BASE_URL}/api/employee/sessions?user_id=2", headers={"Authorization": f"Bearer {token_a}"})
    assert tampered_res.status_code == 200
    tampered_ids = [s["session_id"] for s in tampered_res.json()]
    assert session_b_id not in tampered_ids


# ── Test 4: Rate limiting on login (brute-force lockout) ──────────────────────

def test_rate_limiting_and_lockout_on_login():
    test_user = "emp_01"
    clear_lockout(test_user)

    # 4 consecutive bad attempts should return 401 with remaining attempts count
    for i in range(1, 5):
        res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": test_user, "password": "wrong_password"})
        assert res.status_code == 401
        assert f"{5 - i} attempt(s) remaining" in res.json().get("detail", "")

    # 5th bad attempt should trigger 429 Too Many Requests (Lockout)
    res_lockout = requests.post(f"{BASE_URL}/api/auth/login", json={"username": test_user, "password": "wrong_password"})
    assert res_lockout.status_code == 429
    assert "temporarily locked" in res_lockout.json().get("detail", "")

    # 6th attempt (even with the correct password) should still be rejected with 429 while locked
    res_blocked = requests.post(f"{BASE_URL}/api/auth/login", json={"username": test_user, "password": "password123"})
    assert res_blocked.status_code == 429

    # Clean up for subsequent tests
    clear_lockout(test_user)


def test_websocket_authentication_and_isolation():
    async def run_ws_suite():
        token_a, session_a_id, user_a_id = get_user_token("emp_01", "password123")
        token_b, session_b_id, user_b_id = get_user_token("emp_02", "password456")
        admin_tok = get_admin_token()

        # 1. Invalid token rejected with code 4001 or closed
        try:
            async with websockets.connect(f"{WS_URL}/ws/session/{session_a_id}?token=bad_token") as ws:
                pass
            assert False, "Expected connection to be rejected with 4001"
        except (websockets.exceptions.InvalidStatusCode, Exception):
            pass # rejected as required

        # 2. Employee A attempting to connect to Employee B's session -> Rejected with Forbidden (4003)
        try:
            async with websockets.connect(f"{WS_URL}/ws/session/{session_b_id}?token={token_a}") as ws:
                pass
            assert False, "Expected cross-session connection to be rejected"
        except (websockets.exceptions.InvalidStatusCode, Exception):
            pass # rejected as required

        # 3. Employee A connecting to their OWN session -> Accepted & receives telemetry
        async with websockets.connect(f"{WS_URL}/ws/session/{session_a_id}?token={token_a}") as ws_emp:
            await ws_emp.send(json.dumps({"action": "ping", "client_time": 100.0}))
            msg = await asyncio.wait_for(ws_emp.recv(), timeout=3.0)
            data = json.loads(msg)
            assert data.get("type") in ["enroll_update", "network_update", "pong"]

        # 4. Admin connecting to Employee A's session -> Accepted (Admins can monitor all sessions)
        async with websockets.connect(f"{WS_URL}/ws/session/{session_a_id}?token={admin_tok}") as ws_admin:
            await ws_admin.send(json.dumps({"action": "ping", "client_time": 100.0}))
            msg = await asyncio.wait_for(ws_admin.recv(), timeout=3.0)
            data = json.loads(msg)
            assert data.get("type") in ["enroll_update", "network_update", "pong"]

    asyncio.run(run_ws_suite())


# ── Test 6: Impossible travel detection logic (haversine) ─────────────────────

def test_impossible_travel_haversine_logic():
    # SF (37.7749, -122.4194) to London (51.5074, -0.1278) is approx 8,610 km
    sf_lat, sf_lon = 37.7749, -122.4194
    lon_lat, lon_lon = 51.5074, -0.1278

    dist = haversine_distance_km(sf_lat, sf_lon, lon_lat, lon_lon)
    assert 8500 < dist < 8700, f"Expected ~8610 km, got {dist}"

    t0 = datetime.datetime.now(datetime.timezone.utc)
    # Travel in 10 seconds (impossible)
    t1 = t0 + datetime.timedelta(seconds=10)
    result_impossible = check_impossible_travel(sf_lat, sf_lon, t0, lon_lat, lon_lon, t1)
    assert result_impossible["impossible"] is True
    assert result_impossible["speed_kmh"] > 900.0
    assert "exceeds maximum aircraft speed" in result_impossible["reason"]

    # Travel over 14 hours (realistic flight speed ~615 km/h)
    t2 = t0 + datetime.timedelta(hours=14)
    result_possible = check_impossible_travel(sf_lat, sf_lon, t0, lon_lat, lon_lon, t2)
    assert result_possible["impossible"] is False
    assert result_possible["speed_kmh"] < 900.0

    # Local perimeter movement (< 50 km)
    result_local = check_impossible_travel(37.7749, -122.4194, t0, 37.7800, -122.4100, t0 + datetime.timedelta(minutes=5))
    assert result_local["impossible"] is False
    assert "Local perimeter movement" in result_local["reason"]


# ── Test 7: Mid-session IP change detection ───────────────────────────────────

def test_ip_change_mid_session_detection():
    db = SessionLocal()
    try:
        sess = SessionModel(
            user_id=1,
            ip_address="127.0.0.1",
            lat=37.7749,
            lon=-122.4194,
            status="active",
            network_isp="Acme Corp Internal Network",
            initial_trust_score=100.0,
            trust_score=100.0,
            last_active_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        # Re-evaluate with an unexpected foreign IP
        hijacked_ip = "198.51.100.42"
        telemetry = lookup_ip_telemetry(hijacked_ip)
        eval_result = evaluate_network_risk(sess, hijacked_ip, telemetry, None, db)

        # IP change factor must trigger FAIL
        ip_factor = eval_result["breakdown"].get("ip_change")
        assert ip_factor is not None
        assert ip_factor["status"] == "FAIL"
        assert "IP address changed mid-session" in ip_factor["reason"]
        assert eval_result["network_risk_score"] >= 25.0
    finally:
        db.close()


# ── Test 8: VPN, Tor, and Datacenter detection logic ──────────────────────────

def test_vpn_and_tor_detection_logic():
    db = SessionLocal()
    try:
        sess = SessionModel(
            user_id=1,
            ip_address="185.220.101.5",
            status="active"
        )
        # 1. Tor Exit Node
        tor_telemetry = {"is_tor": True, "isp": "Tor Relay", "lat": 52.52, "lon": 13.405}
        tor_eval = evaluate_network_risk(sess, "185.220.101.5", tor_telemetry, None, db)
        assert tor_eval["breakdown"]["tor_node"]["status"] == "FAIL"
        assert "Tor exit relay" in tor_eval["breakdown"]["tor_node"]["reason"]

        # 2. Commercial VPN / Proxy
        vpn_telemetry = {"is_vpn": True, "proxy": True, "isp": "Mullvad VPN", "lat": 59.3293, "lon": 18.0686}
        vpn_eval = evaluate_network_risk(sess, "185.156.172.5", vpn_telemetry, None, db)
        assert vpn_eval["breakdown"]["vpn_proxy"]["status"] == "FAIL"
        assert "VPN / Proxy" in vpn_eval["breakdown"]["vpn_proxy"]["reason"]
    finally:
        db.close()
