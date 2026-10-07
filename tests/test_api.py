from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


def test_health_reports_operational_api():
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["device_count"] > 0
    assert "inference_mode" in data
    assert "timestamp" in data


def test_model_metrics_exposes_selected_model_results():
    response = client.get("/model-metrics")

    assert response.status_code == 200
    data = response.json()
    assert data["selected_model"] == "xgboost_hist"
    assert data["test_rows"] == 82332
    assert 0 <= data["accuracy"] <= 1
    assert 0 <= data["f1"] <= 1
    assert 0 <= data["roc_auc"] <= 1
    assert "false_negative_rate" in data


def test_stream_returns_live_device_risk_shape():
    response = client.get("/stream")

    assert response.status_code == 200
    data = response.json()
    assert "timestamp" in data
    assert len(data["devices"]) > 0

    first = data["devices"][0]
    expected_fields = {
        "device_id",
        "failure_probability",
        "anomaly_score",
        "risk_score",
        "risk_level",
        "recommendation",
        "latency_ms",
        "packet_loss",
        "bandwidth_util",
        "inference_mode",
    }
    assert expected_fields.issubset(first)
    assert first["risk_level"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_predict_returns_risk_decision_for_sample_payload():
    payload = {
        "device_id": "Router-6",
        "dur": 7.2,
        "sbytes": 42000,
        "dbytes": 600,
        "sload": 820000,
        "dload": 8000,
        "spkts": 460,
        "dpkts": 12,
        "sinpkt": 1700,
        "dinpkt": 80,
        "sjit": 620,
        "djit": 20,
        "smean": 1800,
        "dmean": 90,
    }

    response = client.post("/predict", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["device_id"] == "Router-6"
    assert 0 <= data["failure_probability"] <= 1
    assert 0 <= data["risk_score"] <= 1
    assert data["risk_level"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert data["recommendation"]


def test_self_healing_data_is_consistent_with_actionable_devices():
    response = client.get("/self-healing-data")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == len(data["devices"])
    assert data["critical_count"] == len([
        device for device in data["devices"]
        if device["risk_level"] == "CRITICAL"
    ])

    for device in data["devices"]:
        assert device["risk_level"] in {"HIGH", "CRITICAL"}
        assert device["actions"]
        assert device["recommendation"]
