# NetObserve Demo Script

Use this flow when showing the project to an interviewer, recruiter, professor, or hiring manager.

## 30-Second Introduction

NetObserve is an AIOps web application for network fault prediction. It uses the UNSW-NB15 network traffic dataset, trains a supervised XGBoost classifier, exposes the model through a FastAPI backend, and visualizes live device risk across dashboards, topology, analytics, prediction, and supervised remediation workflows.

The goal is not just to show a model score. The goal is to show an end-to-end operational system: dataset-backed inference, model metrics, live-style telemetry, risk scoring, explainable device views, browser-stored alerts, and human-approved remediation recommendations.

## Start The Project

```powershell
cd C:\Users\sroya\Documents\Codex\2026-07-02\ca\AI_Network_Fault_Prediction
py -3.10 -m uvicorn app:app --reload --host 127.0.0.1 --port 8001
```

Open:

```text
http://127.0.0.1:8001/static/index.html
```

If port 8001 is busy, change it to another port, for example `8002`.

## Verify It Works

Run the automated checks:

```powershell
py -3.10 -m pytest -q
```

Expected result:

```text
5 passed
```

Check API health:

```text
http://127.0.0.1:8001/health
```

## Demo Flow

1. Dashboard

Show the live operational summary: total devices, critical devices, average risk, packet loss, risk distribution, model performance, and action queue.

What to say:

NetObserve continuously converts model output into operational risk. The dashboard is designed for quick triage, not just static charts.

2. Devices

Open the devices page and show routers, switches, and servers with current risk, failure probability, anomaly score, latency, packet loss, and suggested action.

What to say:

Each device is scored from the same stream, so operators can compare severity and decide which node needs attention first.

3. Topology

Open topology and show the network map with risk-colored nodes and animated packet movement.

What to say:

The topology view turns ML predictions into infrastructure context. Instead of only knowing that something is risky, I can see where it sits in the network.

4. Analytics

Open analytics and show distribution, failure probability, latency, packet loss, and high-risk device trends.

What to say:

This page is for understanding patterns across the environment, not just one alert.

5. Prediction

Open prediction and submit a manual prediction.

What to say:

The `/predict` endpoint allows direct model-backed inference. This proves the model is wired into the backend and not only used for a fake UI.

6. Supervised Healing

Open supervised healing and show prioritized actions plus alert statuses: Open, Investigating, and Resolved.

What to say:

I intentionally named this supervised healing because the system recommends remediation actions, but a human approves them. That is more honest and production-realistic than claiming the app automatically changes real network infrastructure.

## Metrics To Mention

Use these exact metrics unless retraining changes them:

- Accuracy: 87.42%
- Precision: 82.84%
- Recall: 97.31%
- F1-score: 89.49%
- ROC-AUC: 98.06%
- False negative rate: 2.69%
- Evaluation set: official UNSW-NB15 test split with 82,332 rows

Best interview explanation:

I prioritized recall and false negative rate because missing a risky network event is more expensive than sending an extra alert. The model reached 97.31% recall and 2.69% false negatives on the official test split, while still maintaining an 89.49% F1-score.

## Honest Limitations

- The live stream is simulated from dataset-backed traffic rows, not connected to a real router or SIEM.
- The remediation actions are recommendations, not real production network changes.
- Alert workflow is stored in browser `localStorage`, so it is lightweight and demo-friendly, but not shared across users.
- The current deployment does not use a database because free hosting persistence is limited.

## Resume-Ready Technical Points

- Built an end-to-end AIOps network monitoring app using FastAPI, XGBoost, UNSW-NB15, and a responsive operations dashboard.
- Trained and evaluated an XGBoost risk classifier on 82,332 official test rows, achieving 89.49% F1-score, 98.06% ROC-AUC, and 2.69% false negative rate.
- Designed live-style telemetry, topology visualization, manual prediction, analytics, and supervised remediation workflows.
- Added API tests for health, model metrics, streaming telemetry, prediction, and remediation endpoints.
