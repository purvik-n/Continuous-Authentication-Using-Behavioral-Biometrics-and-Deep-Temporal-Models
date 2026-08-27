import os
import requests
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_curve
import matplotlib.pyplot as plt

DATA_URLS = [
    "http://www.cs.cmu.edu/~keystroke/DSL-StrongPasswordData.csv",
    "https://raw.githubusercontent.com/lvalerion/keystroke-dynamics/master/DSL-StrongPasswordData.csv",
    "https://raw.githubusercontent.com/vigneshvk/Keystroke-Dynamics-Using-Biometrics/master/DSL-StrongPasswordData.csv"
]
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
DATA_FILE = os.path.join(DATA_DIR, "DSL-StrongPasswordData.csv")

def download_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(RESULTS_DIR, exist_ok=True)
        
    if not os.path.exists(DATA_FILE):
        for url in DATA_URLS:
            print(f"Trying to download dataset from {url}...")
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                with open(DATA_FILE, 'wb') as f:
                    f.write(response.content)
                print("Download complete.")
                global DATA_URL
                DATA_URL = url
                return
            except Exception as e:
                print(f"Failed to download data from {url}: {e}")
        raise Exception("All fallback download links failed.")

def evaluate_model():
    print("Loading data...")
    df = pd.read_csv(DATA_FILE)
    subjects = df['subject'].unique()
    
    feature_cols = [col for col in df.columns if col not in ['subject', 'sessionIndex', 'rep']]
    eers = []
    
    print("Evaluating Isolation Forest for each subject...")
    for i, subject in enumerate(subjects):
        genuine_data = df[df['subject'] == subject]
        impostor_data = df[df['subject'] != subject].sample(n=200, random_state=42)
        
        train_genuine = genuine_data.iloc[:200][feature_cols].values
        test_genuine = genuine_data.iloc[200:][feature_cols].values
        test_impostor = impostor_data[feature_cols].values
        
        model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
        model.fit(train_genuine)
        
        score_genuine = model.decision_function(test_genuine)
        score_impostor = model.decision_function(test_impostor)
        
        y_true = np.concatenate([np.ones(len(score_genuine)), np.zeros(len(score_impostor))])
        y_scores = np.concatenate([score_genuine, score_impostor])
        
        fpr, tpr, thresholds = roc_curve(y_true, y_scores)
        fnr = 1 - tpr
        
        eer_idx = np.nanargmin(np.absolute((fnr - fpr)))
        eer = (fpr[eer_idx] + fnr[eer_idx]) / 2
        eers.append(eer)
        
    mean_eer = np.mean(eers)
    std_eer = np.std(eers)
    print(f"\nOverall EER: {mean_eer:.4f} ± {std_eer:.4f}")
    
    summary_path = os.path.join(RESULTS_DIR, "summary.txt")
    with open(summary_path, "w") as f:
        f.write(f"CMU Keystroke Dynamics Benchmark Validation\n")
        f.write(f"Dataset URL: {DATA_URLS[0]}\n")
        f.write(f"Model: scikit-learn IsolationForest (n_estimators=100, contamination=0.1)\n")
        f.write(f"Subjects Evaluated: {len(subjects)}\n")
        f.write(f"Training Samples (per subject): 200 genuine\n")
        f.write(f"Test Samples (per subject): 200 genuine + 200 impostor\n\n")
        f.write(f"Overall Equal Error Rate (EER): {mean_eer:.4f} ± {std_eer:.4f}\n")
    print(f"Summary saved to {summary_path}")
        
    return mean_eer, std_eer

def plot_overall_far_frr():
    print("Generating aggregate FAR/FRR curves...")
    df = pd.read_csv(DATA_FILE)
    subjects = df['subject'].unique()
    feature_cols = [col for col in df.columns if col not in ['subject', 'sessionIndex', 'rep']]
    
    all_y_true = []
    all_y_scores = []
    
    for subject in subjects:
        genuine_data = df[df['subject'] == subject]
        impostor_data = df[df['subject'] != subject].sample(n=200, random_state=42)
        
        train_genuine = genuine_data.iloc[:200][feature_cols].values
        test_genuine = genuine_data.iloc[200:][feature_cols].values
        test_impostor = impostor_data[feature_cols].values
        
        model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
        model.fit(train_genuine)
        
        score_genuine = model.decision_function(test_genuine)
        score_impostor = model.decision_function(test_impostor)
        
        all_y_true.extend(np.ones(len(score_genuine)))
        all_y_true.extend(np.zeros(len(score_impostor)))
        all_y_scores.extend(score_genuine)
        all_y_scores.extend(score_impostor)
        
    all_y_true = np.array(all_y_true)
    all_y_scores = np.array(all_y_scores)
    
    fpr, tpr, thresholds = roc_curve(all_y_true, all_y_scores)
    frr = 1 - tpr
    far = fpr
    
    eer_idx = np.nanargmin(np.absolute((frr - far)))
    eer_val = (far[eer_idx] + frr[eer_idx]) / 2
    eer_threshold = thresholds[eer_idx]
    
    valid_thresholds = thresholds[np.isfinite(thresholds)]
    min_thresh = np.min(valid_thresholds) if len(valid_thresholds) > 0 else -1
    max_thresh = np.max(valid_thresholds) if len(valid_thresholds) > 0 else 1
    
    plt.figure(figsize=(10, 6))
    plt.plot(thresholds, far, label='False Accept Rate (FAR)', color='red', linewidth=2)
    plt.plot(thresholds, frr, label='False Reject Rate (FRR)', color='blue', linewidth=2)
    plt.plot(eer_threshold, eer_val, 'go', markersize=10, label=f'EER = {eer_val:.3f}')
    
    plt.xlim(min_thresh, max_thresh)
    plt.ylim(0, 1)
    plt.xlabel('Isolation Forest Decision Score Threshold')
    plt.ylabel('Error Rate')
    plt.title('Aggregate FAR and FRR vs. Threshold (CMU Keystroke Benchmark)')
    plt.legend()
    plt.grid(True, linestyle='--', alpha=0.7)
    
    plot_path = os.path.join(RESULTS_DIR, "eer_plot.png")
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    print(f"Plot saved to {plot_path}")

if __name__ == "__main__":
    download_data()
    evaluate_model()
    plot_overall_far_frr()
