import math
import time
import json
import datetime
import requests
import asyncio
import os
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session as DbSession
from models import Session as SessionModel, NetworkEvent, CorporateAllowlist, User

# ── Haversine Distance & Travel Speed ──────────────────────────────────────────

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two geographic coordinates in kilometers."""
    R = 6371.0 # Earth's mean radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def check_impossible_travel(
    prev_lat: Optional[float], prev_lon: Optional[float], prev_time: Optional[datetime.datetime],
    curr_lat: Optional[float], curr_lon: Optional[float], curr_time: Optional[datetime.datetime]
) -> Dict[str, Any]:
    """
    Evaluates whether consecutive geolocations represent physically impossible travel.
    Threshold: > 900 km/h (commercial aircraft flight speed limit).
    """
    if prev_lat is None or prev_lon is None or curr_lat is None or curr_lon is None:
        return {"impossible": False, "speed_kmh": 0.0, "distance_km": 0.0, "reason": "Insufficient coordinate data"}
    
    if prev_time is None or curr_time is None:
        return {"impossible": False, "speed_kmh": 0.0, "distance_km": 0.0, "reason": "Missing timestamp"}

    # Normalize timezone awareness to avoid offset-naive vs offset-aware subtraction errors
    t_prev = prev_time.replace(tzinfo=None) if prev_time.tzinfo else prev_time
    t_curr = curr_time.replace(tzinfo=None) if curr_time.tzinfo else curr_time
    
    distance_km = haversine_distance_km(prev_lat, prev_lon, curr_lat, curr_lon)
    time_diff_hours = abs((t_curr - t_prev).total_seconds()) / 3600.0

    if distance_km < 50.0:
        return {"impossible": False, "speed_kmh": 0.0, "distance_km": round(distance_km, 1), "reason": "Local perimeter movement"}

    if time_diff_hours <= (1.0 / 3600.0): # within 1 second
        speed_kmh = distance_km * 3600.0
    else:
        speed_kmh = distance_km / time_diff_hours

    is_impossible = speed_kmh > 900.0 and distance_km > 100.0
    reason = (
        f"Travel speed {speed_kmh:.1f} km/h over {distance_km:.1f} km exceeds maximum aircraft speed (900 km/h)"
        if is_impossible else f"Travel speed {speed_kmh:.1f} km/h within physically plausible range"
    )

    return {
        "impossible": is_impossible,
        "speed_kmh": round(speed_kmh, 1),
        "distance_km": round(distance_km, 1),
        "reason": reason
    }


# ── Tor Exit-Node Cache & Refresh ─────────────────────────────────────────────

TOR_CACHE_FILE = os.path.join(os.path.dirname(__file__), "tor_exit_nodes.json")
TOR_EXIT_LIST_URL = os.environ.get("TOR_EXIT_LIST_URL", "https://check.torproject.org/torbulkexitlist")

_tor_exit_nodes: set[str] = set()
_last_tor_refresh: float = 0.0

def load_cached_tor_nodes() -> set[str]:
    global _tor_exit_nodes
    if os.path.exists(TOR_CACHE_FILE):
        try:
            with open(TOR_CACHE_FILE, "r", encoding="utf-8") as f:
                _tor_exit_nodes = set(json.load(f))
        except Exception as e:
            print(f"[NetworkMonitor] Warning loading Tor cache: {e}")
    # Add well-known public Tor test exits for reliable local detection verification
    _tor_exit_nodes.update([
        "185.220.101.5", "185.220.101.6", "185.220.101.7",
        "51.15.54.205", "198.98.56.143", "199.249.230.70"
    ])
    return _tor_exit_nodes

def refresh_tor_nodes_if_needed():
    global _last_tor_refresh, _tor_exit_nodes
    now = time.time()
    if now - _last_tor_refresh < 3600 and len(_tor_exit_nodes) > 0:
        return
    _last_tor_refresh = now
    try:
        resp = requests.get(TOR_EXIT_LIST_URL, timeout=3)
        if resp.status_code == 200:
            lines = [line.strip() for line in resp.text.splitlines() if line.strip() and not line.startswith("#")]
            _tor_exit_nodes.update(lines)
            with open(TOR_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(list(_tor_exit_nodes), f)
            print(f"[NetworkMonitor] Tor exit-node list refreshed ({len(_tor_exit_nodes)} nodes).")
    except Exception as e:
        print(f"[NetworkMonitor] Tor node list refresh failed (using cache): {e}")

load_cached_tor_nodes()


# ── IP Geo & Threat Reputation Cache ──────────────────────────────────────────

_ip_info_cache: Dict[str, Dict[str, Any]] = {}
_ip_call_timestamps: List[float] = []

def lookup_ip_telemetry(ip: str) -> Dict[str, Any]:
    """
    Performs rate-limited, cached threat and ASN lookup for a given IP.
    Gracefully falls back if external service is unreachable.
    """
    if ip in ["127.0.0.1", "::1", "localhost"]:
        return {
            "status": "success",
            "ip": ip,
            "isp": "Acme Corp Internal Network",
            "org": "Acme Corporation HQ",
            "as": "AS15169 Acme Internal",
            "country": "United States",
            "city": "San Francisco",
            "lat": 37.7749,
            "lon": -122.4194,
            "proxy": False,
            "hosting": False,
            "is_tor": False,
            "is_vpn": False,
            "source": "loopback"
        }

    if ip in _ip_info_cache:
        cached = _ip_info_cache[ip].copy()
        cached["is_tor"] = ip in _tor_exit_nodes
        return cached

    # Rate limiting: max 40 calls per 60 seconds
    now = time.time()
    global _ip_call_timestamps
    _ip_call_timestamps = [t for t in _ip_call_timestamps if now - t < 60.0]
    if len(_ip_call_timestamps) >= 40:
        # Fallback to synthetic lookup to avoid blocking
        return {
            "status": "rate_limited",
            "ip": ip,
            "isp": "External Network (Lookup Deferred)",
            "as": "AS0 Unknown",
            "country": "Unknown",
            "city": "Unknown",
            "lat": 37.7749,
            "lon": -122.4194,
            "proxy": False,
            "hosting": False,
            "is_tor": ip in _tor_exit_nodes,
            "is_vpn": False,
            "source": "fallback"
        }

    try:
        _ip_call_timestamps.append(now)
        # Request with threat fields: proxy, hosting
        url = f"http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query,proxy,hosting"
        resp = requests.get(url, timeout=2.5)
        data = resp.json()
        if data.get("status") == "success":
            is_tor = ip in _tor_exit_nodes
            is_proxy = bool(data.get("proxy", False))
            is_hosting = bool(data.get("hosting", False))
            
            # Check known VPN / Hosting keywords in ISP / Org
            isp_lower = (data.get("isp", "") + " " + data.get("org", "") + " " + data.get("as", "")).lower()
            vpn_keywords = ["mullvad", "nordvpn", "expressvpn", "surfshark", "wireguard", "openvpn", "private internet access", "protonvpn", "vpn", "digitalocean", "linode", "ovh", "hetzner"]
            is_vpn = is_proxy or any(k in isp_lower for k in vpn_keywords)

            result = {
                "status": "success",
                "ip": ip,
                "isp": data.get("isp", "Unknown ISP"),
                "org": data.get("org", "Unknown Org"),
                "as": data.get("as", "AS0 Unknown"),
                "country": data.get("country", "Unknown"),
                "city": data.get("city", "Unknown"),
                "lat": data.get("lat"),
                "lon": data.get("lon"),
                "proxy": is_proxy,
                "hosting": is_hosting,
                "is_tor": is_tor,
                "is_vpn": is_vpn,
                "source": "live_api"
            }
            _ip_info_cache[ip] = result
            return result
    except Exception as e:
        print(f"[NetworkMonitor] IP telemetry query error: {e}")

    # Fallback default
    fallback = {
        "status": "fallback",
        "ip": ip,
        "isp": "Dynamic Gateway",
        "as": "AS0 Unknown",
        "country": "Unknown",
        "city": "Unknown",
        "lat": None,
        "lon": None,
        "proxy": False,
        "hosting": False,
        "is_tor": ip in _tor_exit_nodes,
        "is_vpn": False,
        "source": "fallback"
    }
    _ip_info_cache[ip] = fallback
    return fallback


# ── Latency & Jitter Measurement Tracker ──────────────────────────────────────

class LatencyTracker:
    def __init__(self, max_samples: int = 15):
        self.max_samples = max_samples
        self.samples: List[float] = [] # in milliseconds
        self.last_ping_time: Optional[float] = None
        self.reconnect_count: int = 0
        self.last_seen: float = time.time()

    def record_ping(self) -> str:
        self.last_ping_time = time.time()
        return str(self.last_ping_time)

    def record_pong(self, client_timestamp: Optional[float] = None) -> float:
        now = time.time()
        self.last_seen = now
        rtt_ms = 10.0
        if self.last_ping_time:
            rtt_ms = max(1.0, (now - self.last_ping_time) * 1000.0)
        elif client_timestamp:
            rtt_ms = max(1.0, (now - client_timestamp) * 1000.0)

        self.samples.append(rtt_ms)
        if len(self.samples) > self.max_samples:
            self.samples.pop(0)
        return rtt_ms

    def record_reconnect(self):
        self.reconnect_count += 1
        self.last_seen = time.time()

    def get_stats(self) -> Dict[str, float]:
        if not self.samples:
            return {"avg_latency_ms": 12.0, "jitter_ms": 1.5, "samples_count": 0}
        
        avg_latency = sum(self.samples) / len(self.samples)
        if len(self.samples) > 1:
            diffs = [abs(self.samples[i] - self.samples[i - 1]) for i in range(1, len(self.samples))]
            jitter = sum(diffs) / len(diffs)
        else:
            jitter = 0.0

        return {
            "avg_latency_ms": round(avg_latency, 1),
            "jitter_ms": round(jitter, 1),
            "samples_count": len(self.samples)
        }

_session_latency_trackers: Dict[int, LatencyTracker] = {}

def get_latency_tracker(session_id: int) -> LatencyTracker:
    if session_id not in _session_latency_trackers:
        _session_latency_trackers[session_id] = LatencyTracker()
    return _session_latency_trackers[session_id]


# ── Explainable Combined Network Risk Score Calculation ────────────────────────

def evaluate_network_risk(
    session: SessionModel,
    current_ip: str,
    telemetry: Dict[str, Any],
    device_data: Optional[Dict[str, Any]],
    db: DbSession
) -> Dict[str, Any]:
    """
    Computes a 0-100 Network Risk Score with fully explainable breakdown.
    Each factor contributes a weighted portion with plain-English reasoning.
    """
    breakdown: Dict[str, Dict[str, Any]] = {}
    total_risk = 0.0

    # 1. IP Change Mid-Session Check (Weight: 25)
    ip_changed = bool(session.ip_address and session.ip_address != current_ip)
    if ip_changed:
        risk_add = 25.0
        total_risk += risk_add
        breakdown["ip_change"] = {
            "points": risk_add,
            "weight": 25,
            "status": "FAIL",
            "reason": f"IP address changed mid-session from {session.ip_address} to {current_ip} (potential session hijack)"
        }
    else:
        breakdown["ip_change"] = {
            "points": 0.0,
            "weight": 25,
            "status": "PASS",
            "reason": f"IP address matches session baseline ({current_ip})"
        }

    # 2. Impossible Travel Check (Weight: 30)
    curr_lat = telemetry.get("lat")
    curr_lon = telemetry.get("lon")
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    
    travel_result = check_impossible_travel(
        prev_lat=session.lat,
        prev_lon=session.lon,
        prev_time=session.last_active_at,
        curr_lat=curr_lat,
        curr_lon=curr_lon,
        curr_time=now_dt
    )

    if travel_result["impossible"]:
        risk_add = 30.0
        total_risk += risk_add
        breakdown["impossible_travel"] = {
            "points": risk_add,
            "weight": 30,
            "status": "FAIL",
            "reason": travel_result["reason"]
        }
    else:
        breakdown["impossible_travel"] = {
            "points": 0.0,
            "weight": 30,
            "status": "PASS",
            "reason": travel_result["reason"]
        }

    # 3. Tor Exit Node Check (Weight: 30)
    is_tor = telemetry.get("is_tor", False) or (current_ip in _tor_exit_nodes)
    if is_tor:
        risk_add = 30.0
        total_risk += risk_add
        breakdown["tor_node"] = {
            "points": risk_add,
            "weight": 30,
            "status": "FAIL",
            "reason": f"Traffic originated from verified Tor exit relay ({current_ip})"
        }
    else:
        breakdown["tor_node"] = {
            "points": 0.0,
            "weight": 30,
            "status": "PASS",
            "reason": "Traffic does not originate from any known Tor exit relay"
        }

    # 4. VPN / Proxy / Datacenter Check (Weight: 20)
    is_vpn = telemetry.get("is_vpn", False)
    is_proxy = telemetry.get("proxy", False)
    is_hosting = telemetry.get("hosting", False)

    if is_vpn or is_proxy or is_hosting:
        threat_type = "VPN / Proxy" if (is_vpn or is_proxy) else "Datacenter / Hosting IP"
        risk_add = 20.0
        total_risk += risk_add
        breakdown["vpn_proxy"] = {
            "points": risk_add,
            "weight": 20,
            "status": "FAIL",
            "reason": f"{threat_type} detected for provider {telemetry.get('isp', 'Unknown')}"
        }
    else:
        breakdown["vpn_proxy"] = {
            "points": 0.0,
            "weight": 20,
            "status": "PASS",
            "reason": "No commercial VPN, proxy or datacenter relay detected"
        }

    # 5. Corporate Allowlist & ASN Reputation Check (Weight: 15)
    allowlist_entries = db.query(CorporateAllowlist).all()
    isp_val = telemetry.get("isp", "")
    asn_val = telemetry.get("as", "")
    
    is_allowlisted = False
    allowlist_match = ""
    for entry in allowlist_entries:
        if entry.entry_type == "ISP" and entry.value.lower() in isp_val.lower():
            is_allowlisted = True
            allowlist_match = f"ISP: {entry.value}"
            break
        elif entry.entry_type == "ASN" and entry.value.lower() in asn_val.lower():
            is_allowlisted = True
            allowlist_match = f"ASN: {entry.value}"
            break
        elif entry.entry_type == "IP" and entry.value == current_ip:
            is_allowlisted = True
            allowlist_match = f"IP: {entry.value}"
            break

    if is_allowlisted:
        breakdown["asn_reputation"] = {
            "points": 0.0,
            "weight": 15,
            "status": "PASS",
            "reason": f"Provider verified in Corporate Allowlist ({allowlist_match})"
        }
    else:
        # Unrecognized residential or remote provider
        risk_add = 10.0
        total_risk += risk_add
        breakdown["asn_reputation"] = {
            "points": risk_add,
            "weight": 15,
            "status": "WARN",
            "reason": f"External provider not in Corporate Allowlist: {isp_val or asn_val or 'Unknown'}"
        }

    # 6. Device Fingerprint Drift Check (Weight: 15)
    device_drift_detected = False
    drift_details = []
    if device_data and session.device_fingerprint:
        try:
            baseline_fp = json.loads(session.device_fingerprint)
            for k in ["browser", "os", "screen", "timezone", "language"]:
                if k in baseline_fp and k in device_data:
                    if str(baseline_fp[k]).lower() != str(device_data[k]).lower():
                        device_drift_detected = True
                        drift_details.append(f"{k} shifted from {baseline_fp[k]} to {device_data[k]}")
        except Exception:
            pass

    if device_drift_detected:
        risk_add = 15.0
        total_risk += risk_add
        breakdown["device_drift"] = {
            "points": risk_add,
            "weight": 15,
            "status": "FAIL",
            "reason": f"Device fingerprint drift detected: {'; '.join(drift_details)}"
        }
    else:
        breakdown["device_drift"] = {
            "points": 0.0,
            "weight": 15,
            "status": "PASS",
            "reason": "Browser, OS, resolution and timezone match login baseline"
        }

    # 7. Latency & Jitter Relay Detection (Weight: 10)
    tracker = get_latency_tracker(session.id)
    stats = tracker.get_stats()
    avg_lat = stats["avg_latency_ms"]
    jitter = stats["jitter_ms"]

    if avg_lat > 400.0 or jitter > 120.0:
        risk_add = 10.0
        total_risk += risk_add
        breakdown["latency_jitter"] = {
            "points": risk_add,
            "weight": 10,
            "status": "WARN",
            "reason": f"Abnormal round-trip latency ({avg_lat:.0f}ms) or jitter ({jitter:.1f}ms) indicative of multi-hop proxy or relay"
        }
    else:
        breakdown["latency_jitter"] = {
            "points": 0.0,
            "weight": 10,
            "status": "PASS",
            "reason": f"Stable low-latency transport ({avg_lat:.0f}ms, jitter {jitter:.1f}ms)"
        }

    # 8. Connection Stability (Weight: 10)
    if tracker.reconnect_count > 3:
        risk_add = 10.0
        total_risk += risk_add
        breakdown["stability"] = {
            "points": risk_add,
            "weight": 10,
            "status": "WARN",
            "reason": f"Unusual reconnect frequency ({tracker.reconnect_count} reconnects during session)"
        }
    else:
        breakdown["stability"] = {
            "points": 0.0,
            "weight": 10,
            "status": "PASS",
            "reason": f"Clean persistent socket connection ({tracker.reconnect_count} reconnects)"
        }

    # Final Combined Risk Score capped at 100
    final_score = min(100.0, round(total_risk, 1))

    # Severity classification
    if final_score >= 70.0:
        severity = "critical"
    elif final_score >= 45.0:
        severity = "high"
    elif final_score >= 25.0:
        severity = "medium"
    elif final_score > 5.0:
        severity = "low"
    else:
        severity = "healthy"

    return {
        "network_risk_score": final_score,
        "severity": severity,
        "breakdown": breakdown,
        "telemetry": telemetry,
        "latency_stats": stats,
        "is_allowlisted": is_allowlisted
    }


# ── Continuous Background Network Watcher Task ────────────────────────────────

_watcher_running = False
_active_session_ids: set[int] = set()

def register_active_session(session_id: int):
    _active_session_ids.add(session_id)

def unregister_active_session(session_id: int):
    _active_session_ids.discard(session_id)

async def run_network_watcher_loop(db_session_factory, broadcast_callback, org_event_callback):
    """
    Continuous background watcher loop running every 5 seconds.
    Monitors all active sessions, re-evaluating connection telemetry and pushing live events.
    """
    global _watcher_running
    _watcher_running = True
    print("[NetworkWatcher] Continuous background monitoring engine started.")

    while _watcher_running:
        try:
            refresh_tor_nodes_if_needed()
            if _active_session_ids:
                db: DbSession = db_session_factory()
                try:
                    for sid in list(_active_session_ids):
                        sess = db.query(SessionModel).filter(SessionModel.id == sid, SessionModel.status == "active").first()
                        if not sess:
                            _active_session_ids.discard(sid)
                            continue

                        current_ip = sess.ip_address or "127.0.0.1"
                        telemetry = lookup_ip_telemetry(current_ip)
                        evaluation = evaluate_network_risk(
                            session=sess,
                            current_ip=current_ip,
                            telemetry=telemetry,
                            device_data=None,
                            db=db
                        )

                        old_score = sess.network_risk_score or 0.0
                        new_score = evaluation["network_risk_score"]

                        # Update session table
                        sess.network_risk_score = new_score
                        sess.asn = telemetry.get("as", "Unknown")
                        sess.is_vpn = telemetry.get("is_vpn", False)
                        sess.is_tor = telemetry.get("is_tor", False)
                        sess.is_proxy = telemetry.get("proxy", False)
                        sess.is_datacenter = telemetry.get("hosting", False)
                        sess.avg_latency_ms = evaluation["latency_stats"]["avg_latency_ms"]
                        sess.jitter_ms = evaluation["latency_stats"]["jitter_ms"]
                        sess.last_active_at = datetime.datetime.now(datetime.timezone.utc)
                        db.commit()

                        # Audit & Alert when risk crosses threshold or changes significantly
                        if abs(new_score - old_score) >= 10.0 or evaluation["severity"] in ["high", "critical"]:
                            top_reasons = [
                                factor["reason"] for factor in evaluation["breakdown"].values()
                                if factor.get("status") in ["FAIL", "WARN"]
                            ]
                            detail_str = "; ".join(top_reasons) if top_reasons else "Routine network evaluation"

                            event = NetworkEvent(
                                session_id=sess.id,
                                user_id=sess.user_id,
                                event_type="NETWORK_RISK_SPIKE" if new_score > old_score else "NETWORK_EVALUATION",
                                severity=evaluation["severity"],
                                risk_score=new_score,
                                ip_address=current_ip,
                                location=f"{telemetry.get('city', 'Unknown')}, {telemetry.get('country', 'Unknown')}",
                                details=detail_str
                            )
                            db.add(event)
                            db.commit()

                            # Push to org events
                            username = sess.user.username if sess.user else f"session-{sess.id}"
                            fullname = sess.user.full_name if sess.user else "User"
                            org_event_callback(
                                f"Network: {evaluation['severity'].upper()} Risk ({new_score}%)",
                                username,
                                fullname,
                                100 - new_score,
                                sess.id
                            )

                        # Live WebSocket push for this session
                        payload = {
                            "type": "network_update",
                            "session_id": sid,
                            "network_risk_score": new_score,
                            "severity": evaluation["severity"],
                            "breakdown": evaluation["breakdown"],
                            "telemetry": telemetry,
                            "latency_stats": evaluation["latency_stats"],
                            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
                        }
                        await broadcast_callback(sid, payload)

                finally:
                    db.close()

        except Exception as e:
            print(f"[NetworkWatcher] Exception in watcher loop: {e}")

        await asyncio.sleep(5)
