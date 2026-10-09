import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_curve, auc
from typing import Dict, Any

def generate_synthetic_data(n_samples=1000):
    # Genuine user data (avgDwell, avgFlight, mouseVelocity, mouseCurvature)
    genuine = np.random.normal(loc=[110, 140, 450, 0.25], scale=[10, 15, 40, 0.05], size=(n_samples, 4))
    
    # Impostor data (drifted away)
    impostor = np.random.normal(loc=[150, 110, 600, 0.45], scale=[20, 20, 80, 0.1], size=(n_samples, 4))
    
    # Ensure non-negative bounds
    genuine = np.clip(genuine, a_min=0, a_max=None)
    impostor = np.clip(impostor, a_min=0, a_max=None)
    
    return genuine, impostor

def evaluate_model() -> Dict[str, Any]:
    genuine, impostor = generate_synthetic_data(1000)
    
    # Train on 50% of genuine
    X_train = genuine[:500]
    
    # Test on the rest of genuine and all impostor
    X_test_genuine = genuine[500:]
    X_test_impostor = impostor
    
    # Isolation forest
    clf = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    clf.fit(X_train)
    
    # Predict (raw scores: lower is more anomalous in sklearn. We negate so higher = more anomalous)
    scores_genuine = -clf.decision_function(X_test_genuine)
    scores_impostor = -clf.decision_function(X_test_impostor)
    
    y_true = np.concatenate([np.zeros(len(scores_genuine)), np.ones(len(scores_impostor))])
    y_scores = np.concatenate([scores_genuine, scores_impostor])
    
    fpr, tpr, thresholds = roc_curve(y_true, y_scores)
    roc_auc = auc(fpr, tpr)
    
    # EER calculation
    fnr = 1 - tpr
    eer_threshold_idx = np.nanargmin(np.absolute((fnr - fpr)))
    eer = fpr[eer_threshold_idx]
    
    # Sample ROC points for UI (limit to ~50 points)
    indices = np.linspace(0, len(fpr) - 1, 50, dtype=int)
    roc_points = [{"fpr": float(fpr[i]), "tpr": float(tpr[i])} for i in indices]
    
    # FAR / FRR curve
    far = fpr
    frr = fnr
    # We clip threshold values because they might have infinite bounds at the extremes
    safe_thresholds = np.clip(thresholds, a_min=-1.0, a_max=1.0)
    far_frr_points = [{"threshold": float(safe_thresholds[i]), "far": float(far[i]), "frr": float(frr[i])} for i in indices]
    
    return {
        "auc": float(roc_auc),
        "eer": float(eer),
        "roc_curve": roc_points,
        "far_frr_curve": far_frr_points,
        "summary": "Evaluation completed using IsolationForest (100 estimators) on synthetic continuous biometric distributions."
    }
