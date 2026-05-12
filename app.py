from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import random
import os
import pandas as pd
import numpy as np
import joblib

app = FastAPI(
    title="AI Network Fault Prediction API",
    description="AI-powered network observability and self-healing platform",
    version="4.0.0"
)

if not os.path.exists("static"):
    os.makedirs("static", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

rf_model = None
xgb_model = None
anomaly_model = None
scaler = None

MODEL_FEATURES = [
    "dur", "sbytes", "dbytes", "sload", "dload",
    "spkts", "dpkts", "sinpkt", "dinpkt",
    "sjit", "djit", "smean", "dmean",
    "trafficvolume", "packetratio", "loadratio",
    "jitdifference", "byteratio", "pktmeandiff",
    "interarrivalsum"
]

DEVICES = (
    [f"Router-{i}" for i in range(1, 8)] +
    [f"Switch-{i}" for i in range(1, 5)] +
    [f"Server-{i}" for i in range(1, 4)]
)

TOPOLOGY_EDGES = [
    {"source": "Router-1", "target": "Switch-1"},
    {"source": "Router-2", "target": "Switch-1"},
    {"source": "Router-3", "target": "Switch-2"},
    {"source": "Router-4", "target": "Switch-2"},
    {"source": "Router-5", "target": "Switch-3"},
    {"source": "Router-6", "target": "Switch-3"},
    {"source": "Router-7", "target": "Switch-4"},
    {"source": "Switch-1", "target": "Server-1"},
    {"source": "Switch-2", "target": "Server-2"},
    {"source": "Switch-3", "target": "Server-3"},
    {"source": "Switch-4", "target": "Server-1"},
]

MODEL_LOAD_MESSAGES = []

def try_load_models():
    global rf_model, xgb_model, anomaly_model, scaler

    try:
        if os.path.exists("network_fault_rf_model.pkl"):
            rf_model = joblib.load("network_fault_rf_model.pkl")
        elif os.path.exists("networkfaultrfmodel.pkl"):
            rf_model = joblib.load("networkfaultrfmodel.pkl")

        if os.path.exists("network_fault_xgb_model.pkl"):
            xgb_model = joblib.load("network_fault_xgb_model.pkl")
        elif os.path.exists("networkfaultxgbmodel.pkl"):
            xgb_model = joblib.load("networkfaultxgbmodel.pkl")

        if os.path.exists("network_anomaly_iforest.pkl"):
            anomaly_model = joblib.load("network_anomaly_iforest.pkl")
        elif os.path.exists("networkanomalyiforest.pkl"):
            anomaly_model = joblib.load("networkanomalyiforest.pkl")

        if os.path.exists("feature_scaler.pkl"):
            scaler = joblib.load("feature_scaler.pkl")
        elif os.path.exists("featurescaler.pkl"):
            scaler = joblib.load("featurescaler.pkl")

    except Exception as e:
        MODEL_LOAD_MESSAGES.append(str(e))
        print("Model loading warning:", e)

try_load_models()

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
    file_path = os.path.join("static", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"{filename} not found in static folder")
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["trafficvolume"] = df["sbytes"] + df["dbytes"]
    df["packetratio"] = df["spkts"] / (df["dpkts"] + 1)
    df["loadratio"] = df["sload"] / (df["dload"] + 1)
    df["jitdifference"] = abs(df["sjit"] - df["djit"])
    df["byteratio"] = df["sbytes"] / (df["dbytes"] + 1)
    df["pktmeandiff"] = abs(df["smean"] - df["dmean"])
    df["interarrivalsum"] = df["sinpkt"] + df["dinpkt"]
    return df

def classify_risk(score: float) -> str:
    if score >= 0.70:
        return "CRITICAL"
    elif score >= 0.45:
        return "HIGH"
    elif score >= 0.25:
        return "MEDIUM"
    return "LOW"

def get_recommendation(failure_prob: float, anomaly_flag: int) -> str:
    if failure_prob >= 0.80:
        return "Reroute traffic or trigger failover immediately"
    if anomaly_flag == 1:
        return "Inspect logs and isolate this device"
    if failure_prob >= 0.45:
        return "Increase monitoring frequency"
    return "System operating normally"

def simulate_telemetry(is_fault: bool) -> dict:
    return {
        "dur": random.uniform(2.0, 10.0) if is_fault else random.uniform(0.01, 1.0),
        "sbytes": random.uniform(5000, 50000) if is_fault else random.uniform(100, 5000),
        "dbytes": random.uniform(100, 2000),
        "sload": random.uniform(1e5, 1e6) if is_fault else random.uniform(1e3, 1e5),
        "dload": random.uniform(1e3, 5e4),
        "spkts": random.uniform(100, 500) if is_fault else random.uniform(1, 50),
        "dpkts": random.uniform(1, 100),
        "sinpkt": random.uniform(500, 2000) if is_fault else random.uniform(10, 200),
        "dinpkt": random.uniform(10, 500),
        "sjit": random.uniform(100, 800) if is_fault else random.uniform(0, 50),
        "djit": random.uniform(0, 200),
        "smean": random.uniform(500, 2000) if is_fault else random.uniform(50, 500),
        "dmean": random.uniform(50, 500)
    }

def fallback_predict(raw: dict, device_id: str) -> dict:
    traffic_volume = raw["sbytes"] + raw["dbytes"]
    packet_ratio = raw["spkts"] / (raw["dpkts"] + 1)
    load_ratio = raw["sload"] / (raw["dload"] + 1)
    jitter_gap = abs(raw["sjit"] - raw["djit"])
    mean_gap = abs(raw["smean"] - raw["dmean"])
    interarrival = raw["sinpkt"] + raw["dinpkt"]

    failure_probability = float(np.clip(
        (traffic_volume / 25000) * 0.18 +
        (packet_ratio / 8) * 0.16 +
        (load_ratio / 12) * 0.22 +
        (jitter_gap / 250) * 0.20 +
        (mean_gap / 800) * 0.10 +
        (interarrival / 1600) * 0.14, 0, 1
    ))

    xgb_probability = float(np.clip(
        failure_probability * 0.92 + (raw["sbytes"] / (raw["dbytes"] + 1) / 15) * 0.08,
        0, 1
    ))

    anomaly_score = float(np.clip(
        (jitter_gap / 250) * 0.35 +
        (load_ratio / 12) * 0.25 +
        (packet_ratio / 8) * 0.20 +
        (interarrival / 1600) * 0.20,
        0, 1
    ))

    anomaly_flag = 1 if anomaly_score >= 0.60 else 0
    risk_score = float(np.clip(
        0.4 * anomaly_score + 0.4 * failure_probability + 0.2 * xgb_probability,
        0, 1
    ))
    risk_level = classify_risk(risk_score)

    return {
        "device_id": device_id,
        "failure_probability": round(failure_probability, 4),
        "xgb_probability": round(xgb_probability, 4),
        "anomaly_score": round(anomaly_score, 4),
        "anomaly_flag": anomaly_flag,
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "recommendation": get_recommendation(failure_probability, anomaly_flag),
        "timestamp": datetime.now().isoformat()
    }

def model_predict(raw: dict, device_id: str) -> dict:
    if rf_model is None or xgb_model is None or anomaly_model is None or scaler is None:
        return fallback_predict(raw, device_id)

    try:
        df = pd.DataFrame([raw])
        df = engineer_features(df)
        x_scaled = scaler.transform(df[MODEL_FEATURES])

        failure_probability = float(rf_model.predict_proba(x_scaled)[0][1])
        xgb_probability = float(xgb_model.predict_proba(x_scaled)[0][1])

        anomaly_raw = -float(anomaly_model.decision_function(x_scaled)[0])
        anomaly_flag = int(anomaly_model.predict(x_scaled)[0] == -1)
        anomaly_score = float(np.clip(anomaly_raw / 0.5, 0, 1))

        risk_score = float(np.clip(
            0.4 * anomaly_score + 0.4 * failure_probability + 0.2 * xgb_probability,
            0, 1
        ))
        risk_level = classify_risk(risk_score)

        return {
            "device_id": device_id,
            "failure_probability": round(failure_probability, 4),
            "xgb_probability": round(xgb_probability, 4),
            "anomaly_score": round(anomaly_score, 4),
            "anomaly_flag": anomaly_flag,
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
            "recommendation": get_recommendation(failure_probability, anomaly_flag),
            "timestamp": datetime.now().isoformat()
        }
    except Exception:
        return fallback_predict(raw, device_id)

def generate_stream_data():
    results = []
    for device in DEVICES:
        is_fault = random.random() < 0.35
        raw = simulate_telemetry(is_fault)
        pred = model_predict(raw, device)

        latency_ms = round(raw["sinpkt"] / 10, 2)
        packet_loss = round(min((raw["spkts"] / (raw["dpkts"] + 1)) * 2, 30), 2)
        bandwidth_util = round(min((raw["sload"] / 1e6) * 100, 99), 2)

        results.append({
            "device_id": pred["device_id"],
            "failure_probability": pred["failure_probability"],
            "xgb_probability": pred["xgb_probability"],
            "anomaly_score": pred["anomaly_score"],
            "anomaly_flag": pred["anomaly_flag"],
            "risk_score": pred["risk_score"],
            "risk_level": pred["risk_level"],
            "recommendation": pred["recommendation"],
            "latency_ms": latency_ms,
            "packet_loss": packet_loss,
            "bandwidth_util": bandwidth_util,
            "timestamp": pred["timestamp"]
        })
    return results

@app.get("/", response_class=HTMLResponse)
def home():
    return render_page("index.html")

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
        "models_loaded": all([
            rf_model is not None,
            xgb_model is not None,
            anomaly_model is not None,
            scaler is not None
        ]),
        "device_count": len(DEVICES),
        "timestamp": datetime.now().isoformat(),
        "warnings": MODEL_LOAD_MESSAGES
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