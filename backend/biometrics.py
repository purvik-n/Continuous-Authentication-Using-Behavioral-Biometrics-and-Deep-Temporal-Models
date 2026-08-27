from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import numpy as np
import datetime

# In-memory store for session states and models
session_states = {}

# Org-wide event log (shared across all sessions)
org_events = []

# Admin-controlled impostor flags: session_id -> True/False
admin_impostor_flags = {}

def get_session_state(session_id: int):
    if session_id not in session_states:
        session_states[session_id] = {
            "model": None,
            "scaler": None,
            "enrollment_data": [],
            "baseline_means": {},
            "trust_score": 100.0,
            "is_enrolled": False
        }
    return session_states[session_id]

def add_org_event(event_type: str, username: str, full_name: str, score: float = None, session_id: int = None):
    """Append to org-wide event feed."""
    org_events.insert(0, {
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
        "event_type": event_type,
        "username": username,
        "full_name": full_name,
        "score": score,
        "session_id": session_id
    })
    # Keep last 50 events
    if len(org_events) > 50:
        org_events.pop()

def get_org_events():
    return org_events

def set_admin_impostor(session_id: int, active: bool):
    admin_impostor_flags[session_id] = active

def is_admin_impostor(session_id: int) -> bool:
    return admin_impostor_flags.get(session_id, False)

def process_enrollment_batch(session_id: int, features: dict) -> dict:
    state = get_session_state(session_id)
    
    if state["is_enrolled"]:
        return {"status": "already_enrolled"}
        
    vector = [
        features.get("avgDwell", 0),
        features.get("avgFlight", 0),
        features.get("mouseVelocity", 0),
        features.get("mouseCurvature", 0)
    ]
    
    state["enrollment_data"].append(vector)
    
    REQUIRED_BATCHES = 15
    current_batches = len(state["enrollment_data"])
    
    # Keep rolling baseline means even during enrollment
    X = np.array(state["enrollment_data"])
    means = np.mean(X, axis=0)
    state["baseline_means"] = {
        "avgDwell": float(means[0]),
        "avgFlight": float(means[1]),
        "mouseVelocity": float(means[2]),
        "mouseCurvature": float(means[3])
    }
    
    if current_batches >= REQUIRED_BATCHES:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        state["scaler"] = scaler

        clf = IsolationForest(n_estimators=100, contamination=0.02, random_state=42)
        clf.fit(X_scaled)
        state["model"] = clf
        state["is_enrolled"] = True
        return {
            "status": "model_trained", 
            "message": "Enrollment complete.",
            "baseline_means": state["baseline_means"]
        }
        
    return {
        "status": "enrolling", 
        "progress": current_batches / REQUIRED_BATCHES,
        "message": f"Collected {current_batches}/{REQUIRED_BATCHES} batches.",
        "baseline_means": state["baseline_means"]
    }

def process_live_batch(session_id: int, features: dict) -> dict:
    state = get_session_state(session_id)
    if not state["is_enrolled"] or state["model"] is None:
        # If not fully enrolled yet, calculate running baseline
        return {"status": "error", "message": "Not enrolled yet."}
    
    # Check if admin has triggered impostor on this session
    is_impostor = is_admin_impostor(session_id)
    if is_impostor:
        features = {
            "avgDwell": features.get("avgDwell", 120) * 3.5 + 80,
            "avgFlight": max(features.get("avgFlight", 150) * 0.25, 20),
            "mouseVelocity": features.get("mouseVelocity", 450) * 4.5,
            "mouseCurvature": features.get("mouseCurvature", 0.2) + 8.5,
        }
    
    vector = [
        float(features.get("avgDwell", 110)),
        float(features.get("avgFlight", 140)),
        float(features.get("mouseVelocity", 450)),
        float(features.get("mouseCurvature", 0.25))
    ]
    
    baseline = state["baseline_means"]
    
    # Calculate feature-level deviations
    b_dwell = max(baseline.get("avgDwell", 110), 10)
    b_flight = max(baseline.get("avgFlight", 140), 10)
    b_vel = max(baseline.get("mouseVelocity", 450), 20)
    b_curv = max(baseline.get("mouseCurvature", 0.25), 0.05)
    
    dev_dwell = abs(vector[0] - b_dwell) / b_dwell
    dev_flight = abs(vector[1] - b_flight) / b_flight
    dev_vel = abs(vector[2] - b_vel) / b_vel
    dev_curv = abs(vector[3] - b_curv) / b_curv
    
    # Weighted relative drift:
    weighted_drift = (dev_dwell * 0.35) + (dev_flight * 0.25) + (dev_vel * 0.25) + (dev_curv * 0.15)
    
    # Isolation Forest anomaly scoring
    X = np.array([vector])
    X_scaled = state["scaler"].transform(X)
    iforest_raw = float(state["model"].decision_function(X_scaled)[0])
    
    # Logging for calibration
    print(f"DEBUG: session_id={session_id} | iforest_raw={iforest_raw:.4f} | weighted_drift={weighted_drift:.4f}")

    # Anomaly conversion:
    # If weighted drift < 0.35 -> Score stays high (92-100)
    # If weighted drift is 0.75-1.5 -> Score drops to elevated risk (65-80)
    # If weighted drift is > 2.0 or impostor -> Score drops into lock territory (<60)
    
    drift_score = max(100 - (weighted_drift * 42), 5)
    
    # We will adjust this calibration mapping based on observed values.
    # Normal IF raw scores sit between -0.04 and +0.08. 
    # To keep normal behavior in the 80-100 range:
    iforest_norm = min(max((iforest_raw * 400) + 95, 10), 100)
    
    instant_target = (drift_score * 0.65) + (iforest_norm * 0.35)
    instant_target = min(max(instant_target, 0), 100)
    
    ALPHA = 0.40 # Responsive exponential smoothing
    state["trust_score"] = (state["trust_score"] * (1 - ALPHA)) + (instant_target * ALPHA)
    
    # Breakdown percentages for UI explainability
    breakdown = {
        "avgDwell": dev_dwell,
        "avgFlight": dev_flight,
        "mouseVelocity": dev_vel,
        "mouseCurvature": dev_curv
    }
    total_dev = sum(breakdown.values())
    contributions = {}
    if total_dev > 0:
        for k, v in breakdown.items():
            contributions[k] = round((v / total_dev) * 100)
    else:
        contributions = {"avgDwell": 25, "avgFlight": 25, "mouseVelocity": 25, "mouseCurvature": 25}
        
    live_averages = {
        "avgDwell": round(vector[0], 1),
        "avgFlight": round(vector[1], 1),
        "mouseVelocity": round(vector[2], 1),
        "mouseCurvature": round(vector[3], 3)
    }
    
    rounded_baseline = {
        "avgDwell": round(baseline.get("avgDwell", 110), 1),
        "avgFlight": round(baseline.get("avgFlight", 140), 1),
        "mouseVelocity": round(baseline.get("mouseVelocity", 450), 1),
        "mouseCurvature": round(baseline.get("mouseCurvature", 0.25), 3)
    }

    return {
        "status": "scoring",
        "raw_anomaly_score": iforest_raw,
        "trust_score": round(state["trust_score"], 1),
        "contributions": contributions,
        "baseline_means": rounded_baseline,
        "live_averages": live_averages,
        "weighted_drift": round(weighted_drift, 3)
    }

def reset_trust_score(session_id: int):
    state = get_session_state(session_id)
    state["trust_score"] = 100.0
    # Clear admin impostor flag on reset
    admin_impostor_flags.pop(session_id, None)
    return {"status": "reset", "trust_score": 100.0}
