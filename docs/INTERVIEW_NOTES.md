# NetObserve Interview Notes

## 30-second explanation

NetObserve is an AI-powered network observability prototype. It uses the UNSW-NB15 network intrusion dataset to train a binary classifier that predicts whether network traffic is normal or risky. I built a FastAPI backend, an XGBoost inference pipeline, simulated live telemetry, risk scoring, a dashboard, alert recommendations, and model evaluation endpoints.

## Dataset

- Dataset: UNSW-NB15
- Task: binary classification
- Target: `label`
  - `0` = normal traffic
  - `1` = attack/risky traffic
- I excluded `attack_cat` from training because it would leak the answer.

## Models Compared

I compared:

- XGBoost histogram classifier
- Scikit-learn HistGradientBoostingClassifier

XGBoost performed slightly better, so I selected it for the deployed inference pipeline.

## Final Metrics

Evaluated on the official UNSW-NB15 test parquet with 82,332 rows:

- Accuracy: 87.42%
- Precision: 82.84%
- Recall: 97.31%
- F1-score: 89.49%
- ROC-AUC: 98.06%
- False negative rate: 2.69%

## How To Explain The Metrics

Accuracy means overall correctness.

Precision means: when the model says traffic is risky, how often it is actually risky.

Recall means: out of all real risky/attack traffic, how much the model catches.

F1-score balances precision and recall. I would emphasize F1 because cybersecurity datasets can be imbalanced.

ROC-AUC measures how well the model ranks risky traffic above normal traffic across thresholds.

False negative rate matters because a false negative is a missed attack. In cybersecurity, missing attacks is usually more serious than sending extra alerts.

## Why Accuracy And ROC-AUC Are Different

Accuracy depends on one selected threshold. ROC-AUC measures ranking quality across many possible thresholds. A high ROC-AUC means the model separates risky and normal traffic well, while threshold tuning controls the final alert behavior.

## What The Backend Does

- FastAPI serves the app and REST endpoints.
- `/health` exposes model status, selected model, feature count, and threshold.
- `/model-metrics` exposes reproducible evaluation metrics.
- `/stream` returns simulated live device telemetry and model-backed risk scores.
- `/predict` accepts telemetry input and returns risk probability, risk level, recommendation, and inference mode.
- `/self-healing-data` converts high/critical risk into supervised remediation recommendations.

## What The Dashboard Shows

- Overall network risk summary
- Model metrics proof cards
- Risk distribution
- Failure probability chart
- Action queue for high-risk devices
- Browser-persisted alert workflow with Open, Investigating, and Resolved statuses
- Compact topology pulse
- Device table with latency, packet loss, bandwidth, risk score, and anomaly score

## Honest Limitations

- Telemetry stream is simulated from dataset samples, not live packet capture.
- Supervised self-healing is recommendation-based, not executing real network actions.
- Alert history uses browser localStorage for demo persistence instead of a database.
- The dashboard is currently local and prototype-style, not production authenticated infrastructure.
- Next improvements would be live flow ingestion, database-backed history, richer topology, auth, CI tests, and cloud deployment.

## Strong Resume Bullet

Built NetObserve, a FastAPI-based AIOps network monitoring prototype using UNSW-NB15 telemetry, XGBoost risk classification, anomaly scoring, simulated live streams, model metrics endpoints, topology status visualization, browser-persisted alert workflows, and supervised self-healing recommendations; achieved 87.4% accuracy, 89.5% F1-score, and 98.1% ROC-AUC on the official 82K-row test split.
