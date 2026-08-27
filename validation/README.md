# CMU Keystroke Dynamics Benchmark Validation

This folder contains a standalone validation script that evaluates our live application's anomaly-detection approach against an established academic benchmark.

## What This Validates
This script validates our **Isolation Forest** anomaly-detection algorithm's ability to successfully distinguish a genuine user's typing pattern from an impostor's typing pattern. 
It uses the exact same `scikit-learn` Isolation Forest configuration that runs in the live TrustLoop backend (using default parameters `n_estimators=100`, `contamination=0.1`).

The evaluation is run on the **CMU Keystroke Dynamics Benchmark Dataset** (Killourhy & Maxion), which contains keystroke timing records (Dwell and Flight times) from 51 unique subjects who each typed the password `.tie5Roanl` 400 times.

## Methodology
For each of the 51 subjects:
1. **Baseline Training**: An Isolation Forest is trained on the first 200 genuine typing samples of the subject.
2. **Testing**: The trained model scores the remaining 200 genuine samples as well as 200 impostor samples (randomly selected from other subjects).
3. **Error Calculation**: We compute the False Accept Rate (FAR) and False Reject Rate (FRR) across all possible decision thresholds, and locate the Equal Error Rate (EER) where FAR = FRR.

## Results
The script produces:
- `summary.txt`: A text summary of the overall mean Equal Error Rate (EER) across all 51 subjects.
- `eer_plot.png`: A plotted graph of the aggregate FAR and FRR curves vs. the decision threshold, with the overall EER marked.

## Disclaimer
**This script does not affect the live app.**
The live TrustLoop app still trains its Isolation Forest dynamically per-user using their own real enrollment data captured through the browser. This validation script is strictly an independent, offline validation of the underlying mathematical approach using public benchmark data.
