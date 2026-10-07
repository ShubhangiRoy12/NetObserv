# NetObserve - AI Network Fault Prediction and AIOps Console

NetObserve is a local FastAPI-based AIOps prototype for network fault prediction, risk scoring, topology monitoring, analytics, and supervised self-healing recommendations.

The project uses the UNSW-NB15 network dataset to train and evaluate ML models, then serves a dashboard that simulates live network telemetry across routers, switches, and servers.

## What Is Implemented

- FastAPI backend with REST endpoints for health, stream telemetry, prediction, model metrics, topology data, and supervised remediation actions.
- XGBoost-based binary risk classifier trained on the official UNSW-NB15 train/test parquet split.
- Model comparison between XGBoost histogram classifier and HistGradientBoostingClassifier.
- Simulated live telemetry stream sampled from dataset-backed traffic rows.
- Risk scoring that combines model failure probability and anomaly signal.
- Dashboard with live metrics, topology view, analytics, manual prediction, devices page, and remediation recommendations.
- Supervised self-healing recommendation layer that converts high/critical risk into actions such as failover, reroute, isolate, inspect logs, reduce load, and restart device.
- Browser-persisted alert workflow using `localStorage` with `Open`, `Investigating`, and `Resolved` statuses.

## Model Performance

Final selected model: `xgboost_hist`

For a short presentation flow, see [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

Evaluation dataset: official UNSW-NB15 test set with 82,332 rows.

| Metric | Value |
|---|---:|
| Accuracy | 87.42% |
| Precision | 82.84% |
| Recall | 97.31% |
| F1-score | 89.49% |
| ROC-AUC | 98.06% |
| False negative rate | 2.69% |

Why these metrics matter:

- F1-score is useful because it balances precision and recall.
- Recall is important because missed risky traffic is expensive in security/network operations.
- ROC-AUC shows the model separates risky and normal traffic well across thresholds.
- False negative rate is highlighted because missed attacks/faults are more dangerous than extra alerts.

## Architecture

```text
UNSW-NB15 parquet dataset
        |
        v
Training pipeline
  - preprocessing
  - model comparison
  - threshold selection
  - metrics export
        |
        v
Saved XGBoost pipeline
        |
        v
FastAPI backend
  - /health
  - /stream
  - /predict
  - /model-metrics
  - /topology-data
  - /self-healing-data
        |
        v
Static operations console
  - dashboard
  - devices
  - topology
  - analytics
  - prediction
  - supervised self-healing
```

## Main Pages

### Dashboard

Shows device count, critical devices, average risk, packet loss, model proof cards, risk distribution, failure probability, anomaly signals, topology pulse, and action queue.

### Devices

Live inventory table showing device type, risk level, failure probability, latency, packet loss, and recommended action.

### Topology

Graph-style topology map with live risk-colored routers, switches, servers, central backbone node, animated packet-flow dots, selected node details, and high-risk device list.

### Analytics

Live analytical view with risk distribution, failure probability ranking, latency versus packet loss, anomaly/risk/bandwidth comparison, AI insights, and top risky devices.

### Prediction

Manual inference workspace where telemetry features can be entered and submitted to `/predict`. Shows risk score, failure probability, XGBoost probability, anomaly score, anomaly flag, chart breakdown, and recommendation.

### Supervised Self-Healing

Human-in-the-loop remediation console that turns model output into a prioritized runbook with metrics and action tags. It recommends actions but does not directly change real network devices. High/critical alerts are tracked in browser storage with `Open`, `Investigating`, and `Resolved` statuses.

## Tech Stack

- Python
- FastAPI
- scikit-learn
- XGBoost
- pandas
- NumPy
- Chart.js
- HTML, CSS, JavaScript
- UNSW-NB15 dataset

## How To Run

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the app:

```bash
uvicorn app:app --reload --port 8000
```

Open:

```text
http://127.0.0.1:8000/static/index.html
```

## Useful API Checks

```text
GET  /health
GET  /model-metrics
GET  /stream
GET  /topology-data
GET  /self-healing-data
POST /predict
```

## Run Tests

Use Python 3.10 for the local ML environment:

```bash
py -3.10 -m pytest -q
```

The tests cover health, stream telemetry, prediction, model metrics, and supervised self-healing data.

## Honest Limitations

- The telemetry stream is simulated from dataset-backed samples, not live packet capture.
- Supervised self-healing is recommendation-based and does not execute real network changes.
- Alert history is stored in browser `localStorage`, not a shared database.
- There is no authentication/authorization layer yet.
- The project is a local prototype, not a deployed production monitoring system.

## Strong Resume Bullet

Built NetObserve, a FastAPI-based AIOps network monitoring prototype using UNSW-NB15 telemetry, XGBoost risk classification, anomaly scoring, simulated live streams, model metrics endpoints, topology visualization, browser-persisted alert workflows, and supervised self-healing recommendations; achieved 87.4% accuracy, 89.5% F1-score, 97.3% recall, and 98.1% ROC-AUC on the official 82K-row test split.

## Interview Explanation

NetObserve predicts whether network traffic is risky using an XGBoost model trained on UNSW-NB15. I exposed the model through FastAPI, simulated live telemetry for network devices, and built a command-center UI for monitoring risk, topology, analytics, manual prediction, and supervised remediation recommendations. The project is honest about its limits: it is a prototype with simulated streaming and human-in-the-loop self-healing, but the model evaluation and metrics are reproducible.
