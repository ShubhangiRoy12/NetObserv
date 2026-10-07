from datetime import datetime
import random

import joblib
import numpy as np
import pandas as pd

from .settings import BASE_DIR, DEVICES, MODEL_FEATURES

rf_model = None
xgb_model = None
anomaly_model = None
scaler = None
strong_model_artifact = None

MODEL_LOAD_MESSAGES = []
MODEL_ARTIFACTS = {}
DEMO_NORMAL_ROWS = []
DEMO_ATTACK_ROWS = []
DEMO_WARNING_ROWS = []
STREAM_TICK = 0


def load_first_available(label: str, filenames: list[str]):
    found_artifact = False
    for filename in filenames:
        path = BASE_DIR / filename
        if path.exists():
            found_artifact = True
            try:
                model = joblib.load(path)
                if hasattr(model, "n_jobs"):
                    model.n_jobs = 1
                feature_names = getattr(model, "feature_names_in_", [])
                MODEL_ARTIFACTS[label] = {
                    "file": filename,
                    "loaded": True,
                    "features_in": int(getattr(model, "n_features_in_", 0) or 0),
                    "feature_names": list(feature_names) if feature_names is not None else []
                }
                return model
            except Exception as e:
                message = f"{label} failed to load from {filename}: {e}"
                MODEL_LOAD_MESSAGES.append(message)
                MODEL_ARTIFACTS[label] = {"file": filename, "loaded": False, "error": str(e)}
                print("Model loading warning:", message)
    if not found_artifact:
        MODEL_ARTIFACTS[label] = {"loaded": False, "error": "artifact not found"}
    return None


def load_strong_model():
    path = BASE_DIR / "models" / "netobserve_xgb_pipeline.joblib"
    if not path.exists():
        MODEL_ARTIFACTS["strong_pipeline"] = {"loaded": False, "error": "artifact not found"}
        return None
    try:
        artifact = joblib.load(path)
        model = artifact.get("model")
        classifier = getattr(model, "named_steps", {}).get("classifier") if model is not None else None
        if hasattr(classifier, "n_jobs"):
            classifier.n_jobs = 1
        MODEL_ARTIFACTS["strong_pipeline"] = {
            "file": str(path.relative_to(BASE_DIR)),
            "loaded": True,
            "model_name": artifact.get("model_name"),
            "threshold": round(float(artifact.get("threshold", 0.5)), 4),
            "feature_count": len(artifact.get("feature_columns", [])),
        }
        return artifact
    except Exception as e:
        message = f"strong pipeline failed to load: {e}"
        MODEL_LOAD_MESSAGES.append(message)
        MODEL_ARTIFACTS["strong_pipeline"] = {"file": str(path.relative_to(BASE_DIR)), "loaded": False, "error": str(e)}
        print("Model loading warning:", message)
        return None


def load_demo_rows():
    global DEMO_NORMAL_ROWS, DEMO_ATTACK_ROWS, DEMO_WARNING_ROWS
    path = BASE_DIR / "UNSW-NB15_Dataset" / "UNSW_NB15_training-set.parquet"
    if not path.exists():
        MODEL_LOAD_MESSAGES.append("demo dataset not found; using synthetic telemetry")
        return
    try:
        feature_columns = list((strong_model_artifact or {}).get("feature_columns", []))
        columns = feature_columns + ["label"]
        df = pd.read_parquet(path, columns=columns, engine="fastparquet")
        model = strong_model_artifact.get("model") if strong_model_artifact else None
        if model is not None:
            sample = df.sample(min(len(df), 25000), random_state=42).copy()
            probabilities = model.predict_proba(sample[feature_columns])[:, 1]
            sample["__probability"] = probabilities
            normal = sample[(sample["label"] == 0) & (sample["__probability"] < 0.18)].drop(columns=["label", "__probability"])
            warning = sample[(sample["label"] == 1) & (sample["__probability"] >= 0.52) & (sample["__probability"] < 0.78)].drop(columns=["label", "__probability"])
            attack = sample[(sample["label"] == 1) & (sample["__probability"] >= 0.90)].drop(columns=["label", "__probability"])
        else:
            normal = df[df["label"] == 0].drop(columns=["label"])
            warning = df[df["label"] == 1].drop(columns=["label"])
            attack = warning
        DEMO_NORMAL_ROWS = normal.sample(min(len(normal), 300), random_state=42, replace=False).to_dict("records")
        DEMO_WARNING_ROWS = warning.sample(min(len(warning), 120), random_state=21, replace=False).to_dict("records") if len(warning) else []
        DEMO_ATTACK_ROWS = attack.sample(min(len(attack), 120), random_state=84, replace=False).to_dict("records") if len(attack) else []
        MODEL_ARTIFACTS["demo_stream"] = {
            "loaded": True,
            "normal_rows": len(DEMO_NORMAL_ROWS),
            "warning_rows": len(DEMO_WARNING_ROWS),
            "attack_rows": len(DEMO_ATTACK_ROWS),
            "source": str(path.relative_to(BASE_DIR))
        }
    except Exception as e:
        message = f"demo rows failed to load: {e}"
        MODEL_LOAD_MESSAGES.append(message)
        MODEL_ARTIFACTS["demo_stream"] = {"loaded": False, "error": str(e)}


def try_load_models():
    global rf_model, xgb_model, anomaly_model, scaler, strong_model_artifact

    strong_model_artifact = load_strong_model()
    load_demo_rows()
    rf_model = load_first_available("random_forest_legacy", [
        "network_fault_rf_model.pkl",
        "networkfaultrfmodel.pkl"
    ])
    xgb_model = load_first_available("xgboost_legacy", [
        "network_fault_xgb_model.pkl",
        "networkfaultxgbmodel.pkl"
    ])
    anomaly_model = load_first_available("isolation_forest_legacy", [
        "network_anomaly_iforest.pkl",
        "networkanomalyiforest.pkl"
    ])
    scaler = load_first_available("scaler_legacy", [
        "feature_scaler.pkl",
        "featurescaler.pkl"
    ])


def classify_risk(score: float) -> str:
    if score >= 0.85:
        return "CRITICAL"
    if score >= 0.65:
        return "HIGH"
    if score >= 0.35:
        return "MEDIUM"
    return "LOW"


def get_recommendation(failure_prob: float, anomaly_flag: int) -> str:
    if failure_prob >= 0.85:
        return "Reroute traffic or trigger failover immediately"
    if anomaly_flag == 1:
        return "Inspect logs and isolate this device"
    if failure_prob >= 0.65:
        return "Increase monitoring frequency"
    return "System operating normally"


def simulate_telemetry(is_fault: bool) -> dict:
    dur = random.uniform(2.0, 10.0) if is_fault else random.uniform(0.01, 1.0)
    spkts = random.uniform(100, 500) if is_fault else random.uniform(1, 50)
    dpkts = random.uniform(1, 100)
    sbytes = random.uniform(5000, 50000) if is_fault else random.uniform(100, 5000)
    dbytes = random.uniform(100, 2000)
    sload = random.uniform(1e5, 1e6) if is_fault else random.uniform(1e3, 1e5)
    dload = random.uniform(1e3, 5e4)
    sinpkt = random.uniform(500, 2000) if is_fault else random.uniform(10, 200)
    dinpkt = random.uniform(10, 500)
    sjit = random.uniform(100, 800) if is_fault else random.uniform(0, 50)
    djit = random.uniform(0, 200)
    smean = random.uniform(500, 2000) if is_fault else random.uniform(50, 500)
    dmean = random.uniform(50, 500)

    return {
        "dur": dur,
        "proto": "tcp",
        "service": "-",
        "state": "FIN" if not is_fault else random.choice(["CON", "INT", "FIN"]),
        "spkts": spkts,
        "dpkts": dpkts,
        "sbytes": sbytes,
        "dbytes": dbytes,
        "rate": (spkts + dpkts) / max(dur, 0.001),
        "sload": sload,
        "dload": dload,
        "sloss": max(spkts * random.uniform(0.01, 0.08), 0),
        "dloss": max(dpkts * random.uniform(0.01, 0.06), 0),
        "sinpkt": sinpkt,
        "dinpkt": dinpkt,
        "sjit": sjit,
        "djit": djit,
        "swin": 255,
        "stcpb": random.randint(0, 2_000_000_000),
        "dtcpb": random.randint(0, 2_000_000_000),
        "dwin": 255,
        "tcprtt": random.uniform(0.001, 0.3) if is_fault else random.uniform(0.0, 0.08),
        "synack": random.uniform(0.001, 0.2),
        "ackdat": random.uniform(0.001, 0.2),
        "smean": smean,
        "dmean": dmean,
        "trans_depth": 0,
        "response_body_len": 0,
        "ct_src_dport_ltm": random.randint(1, 8) if is_fault else random.randint(1, 3),
        "ct_dst_sport_ltm": random.randint(1, 8) if is_fault else random.randint(1, 3),
        "is_ftp_login": 0,
        "ct_ftp_cmd": 0,
        "ct_flw_http_mthd": 0,
        "is_sm_ips_ports": 0,
    }


def complete_strong_features(raw: dict) -> pd.DataFrame:
    artifact = strong_model_artifact or {}
    feature_columns = artifact.get("feature_columns", [])
    categorical = set(artifact.get("categorical_features", []))
    row = {}
    for feature in feature_columns:
        if feature in raw:
            row[feature] = raw[feature]
        elif feature in categorical:
            row[feature] = "-"
        else:
            row[feature] = 0
    return pd.DataFrame([row], columns=feature_columns)


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
    anomaly_score = float(np.clip(
        (jitter_gap / 250) * 0.35 +
        (load_ratio / 12) * 0.25 +
        (packet_ratio / 8) * 0.20 +
        (interarrival / 1600) * 0.20,
        0, 1
    ))
    anomaly_flag = 1 if anomaly_score >= 0.60 else 0
    risk_score = float(np.clip(0.6 * failure_probability + 0.4 * anomaly_score, 0, 1))
    return {
        "device_id": device_id,
        "failure_probability": round(failure_probability, 4),
        "xgb_probability": round(failure_probability, 4),
        "anomaly_score": round(anomaly_score, 4),
        "anomaly_flag": anomaly_flag,
        "risk_score": round(risk_score, 4),
        "risk_level": classify_risk(risk_score),
        "recommendation": get_recommendation(failure_probability, anomaly_flag),
        "timestamp": datetime.now().isoformat(),
        "inference_mode": "heuristic_fallback"
    }


def legacy_anomaly(raw: dict):
    if anomaly_model is None or scaler is None:
        return 0.0, 0
    try:
        df = pd.DataFrame([raw])
        x_scaled = pd.DataFrame(scaler.transform(df[MODEL_FEATURES]), columns=MODEL_FEATURES)
        anomaly_raw = -float(anomaly_model.decision_function(x_scaled)[0])
        anomaly_flag = int(anomaly_model.predict(x_scaled)[0] == -1)
        anomaly_score = float(np.clip(anomaly_raw / 0.5, 0, 1))
        return anomaly_score, anomaly_flag
    except Exception:
        return 0.0, 0


def model_predict(raw: dict, device_id: str) -> dict:
    if strong_model_artifact is None:
        result = fallback_predict(raw, device_id)
        result["fallback_reason"] = "strong model artifact is not loaded"
        return result

    try:
        model = strong_model_artifact["model"]
        threshold = float(strong_model_artifact.get("threshold", 0.5))
        x = complete_strong_features(raw)
        failure_probability = float(model.predict_proba(x)[0][1])
        anomaly_score, anomaly_flag = legacy_anomaly(raw)
        risk_score = float(np.clip(0.75 * failure_probability + 0.25 * anomaly_score, 0, 1))
        risk_level = classify_risk(risk_score)
        return {
            "device_id": device_id,
            "failure_probability": round(failure_probability, 4),
            "xgb_probability": round(failure_probability, 4),
            "anomaly_score": round(anomaly_score, 4),
            "anomaly_flag": anomaly_flag,
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
            "recommendation": get_recommendation(failure_probability, anomaly_flag),
            "timestamp": datetime.now().isoformat(),
            "inference_mode": "strong_xgboost_model",
            "decision_threshold": round(threshold, 4),
            "predicted_attack": int(failure_probability >= threshold),
        }
    except Exception as e:
        result = fallback_predict(raw, device_id)
        result["fallback_reason"] = str(e)
        return result


def choose_demo_row(index: int) -> dict:
    global STREAM_TICK
    incident_slots = {3}
    warning_slots = {6, 12}
    if index in incident_slots and DEMO_ATTACK_ROWS:
        source = DEMO_ATTACK_ROWS
    elif STREAM_TICK % 4 == 0 and index in warning_slots and DEMO_WARNING_ROWS:
        source = DEMO_WARNING_ROWS
    else:
        source = DEMO_NORMAL_ROWS
    if source:
        row = dict(source[(STREAM_TICK * len(DEVICES) + index) % len(source)])
        return row
    return simulate_telemetry(index in incident_slots)


def generate_stream_data():
    global STREAM_TICK
    results = []
    for index, device in enumerate(DEVICES):
        raw = choose_demo_row(index)
        pred = model_predict(raw, device)

        latency_ms = round(float(raw.get("sinpkt", 0)) / 10, 2)
        packet_loss = round(min((float(raw.get("sloss", 0)) + float(raw.get("dloss", 0))) / max(float(raw.get("spkts", 1)) + float(raw.get("dpkts", 1)), 1) * 100, 30), 2)
        bandwidth_util = round(min((float(raw.get("sload", 0)) / 1e6) * 100, 99), 2)

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
            "timestamp": pred["timestamp"],
            "inference_mode": pred.get("inference_mode", "unknown")
        })
    return results


def model_health() -> dict:
    strong_loaded = strong_model_artifact is not None
    return {
        "models_loaded": strong_loaded,
        "selected_model": strong_model_artifact.get("model_name") if strong_loaded else None,
        "inference_mode": "strong_xgboost_model" if strong_loaded else "heuristic_fallback",
        "decision_threshold": round(float(strong_model_artifact.get("threshold", 0.5)), 4) if strong_loaded else None,
        "model_features": strong_model_artifact.get("feature_columns", []) if strong_loaded else MODEL_FEATURES,
        "model_artifacts": MODEL_ARTIFACTS,
        "warnings": MODEL_LOAD_MESSAGES
    }


try_load_models()



