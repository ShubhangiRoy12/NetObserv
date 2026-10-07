import json
from datetime import datetime
import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from .inference import generate_stream_data, model_health, model_predict
from .settings import BASE_DIR, DEVICES, STATIC_DIR, TOPOLOGY_EDGES

METRICS_PATH = BASE_DIR / "metrics" / "strong_model_metrics.json"

app = FastAPI(
    title="AI Network Fault Prediction API",
    description="AI-powered network observability and supervised self-healing platform",
    version="4.0.0"
)

os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


class TelemetryRecord(BaseModel):
    dur: float
    sbytes: float
    dbytes: float
    sload: float
    dload: float
    spkts: float
    dpkts: float
    sinpkt: float
    dinpkt: float
    sjit: float
    djit: float
    smean: float
    dmean: float
    device_id: Optional[str] = "Unknown"


def render_page(filename: str):
    file_path = STATIC_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found in static folder")
    return file_path.read_text(encoding="utf-8")


@app.get("/")
def root():
    return RedirectResponse(url="/login")


@app.get("/login", response_class=HTMLResponse)
def login_page():
    return render_page("login.html")


@app.get("/signup", response_class=HTMLResponse)
def signup_page():
    return render_page("signup.html")


@app.get("/predict-page", response_class=HTMLResponse)
def predict_page():
    return render_page("predict.html")


@app.get("/devices-page", response_class=HTMLResponse)
def devices_page():
    return render_page("devices.html")


@app.get("/analytics-page", response_class=HTMLResponse)
def analytics_page():
    return render_page("analytics.html")


@app.get("/self-healing", response_class=HTMLResponse)
def self_healing_page():
    return render_page("self-healing.html")


@app.get("/topology-page", response_class=HTMLResponse)
def topology_page():
    return render_page("topology.html")


@app.get("/health")
def health():
    return {
        "status": "operational",
        **model_health(),
        "device_count": len(DEVICES),
        "timestamp": datetime.now().isoformat()
    }



@app.get("/model-metrics")
def model_metrics():
    if not METRICS_PATH.exists():
        raise HTTPException(status_code=404, detail="Model metrics file not found. Run ml/train_strong_model.py first.")
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    selected = metrics.get("selected_model")
    selected_metrics = metrics.get("models", {}).get(selected, {}).get("test", {})
    return {
        "selected_model": selected,
        "dataset": metrics.get("dataset"),
        "test_rows": metrics.get("test_rows"),
        "threshold": metrics.get("selected_threshold"),
        "accuracy": selected_metrics.get("accuracy"),
        "precision": selected_metrics.get("precision"),
        "recall": selected_metrics.get("recall"),
        "f1": selected_metrics.get("f1"),
        "roc_auc": selected_metrics.get("roc_auc"),
        "false_negative_rate": selected_metrics.get("false_negative_rate"),
        "false_positive_rate": selected_metrics.get("false_positive_rate"),
        "generated_at": metrics.get("generated_at"),
    }

@app.get("/devices")
def devices():
    return {
        "devices": DEVICES,
        "count": len(DEVICES),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/stream")
def stream():
    return {
        "devices": generate_stream_data(),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/self-healing-data")
def self_healing_data():
    live_data = generate_stream_data()
    actionable = []

    for device in live_data:
        if device["risk_level"] in ["HIGH", "CRITICAL"]:
            actions = []
            if device["failure_probability"] >= 0.80:
                actions.extend(["Reroute traffic", "Trigger failover"])
            if device["anomaly_flag"] == 1 or device["anomaly_score"] >= 0.60:
                actions.extend(["Inspect logs", "Isolate device"])
            actions.extend(["Reduce load", "Restart device"])

            actionable.append({
                "device_id": device["device_id"],
                "risk_level": device["risk_level"],
                "risk_score": device["risk_score"],
                "failure_probability": device["failure_probability"],
                "anomaly_score": device["anomaly_score"],
                "recommendation": device["recommendation"],
                "actions": list(dict.fromkeys(actions)),
                "timestamp": device["timestamp"]
            })

    return {
        "devices": actionable,
        "count": len(actionable),
        "critical_count": len([d for d in actionable if d["risk_level"] == "CRITICAL"]),
        "executed_actions": len(actionable),
        "automation_mode": "Ready",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/topology-data")
def topology_data():
    live_data = generate_stream_data()
    node_map = {d["device_id"]: d for d in live_data}

    nodes = []
    for name in DEVICES:
        device_data = node_map.get(name, {})
        nodes.append({
            "id": name,
            "label": name,
            "type": "router" if name.startswith("Router") else "switch" if name.startswith("Switch") else "server",
            "risk_level": device_data.get("risk_level", "LOW"),
            "risk_score": device_data.get("risk_score", 0),
            "failure_probability": device_data.get("failure_probability", 0),
            "anomaly_score": device_data.get("anomaly_score", 0),
        })

    return {
        "nodes": nodes,
        "edges": TOPOLOGY_EDGES,
        "timestamp": datetime.now().isoformat()
    }


@app.post("/predict")
def predict(record: TelemetryRecord):
    try:
        raw = {
            "dur": record.dur,
            "sbytes": record.sbytes,
            "dbytes": record.dbytes,
            "sload": record.sload,
            "dload": record.dload,
            "spkts": record.spkts,
            "dpkts": record.dpkts,
            "sinpkt": record.sinpkt,
            "dinpkt": record.dinpkt,
            "sjit": record.sjit,
            "djit": record.djit,
            "smean": record.smean,
            "dmean": record.dmean
        }
        return model_predict(raw, record.device_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

