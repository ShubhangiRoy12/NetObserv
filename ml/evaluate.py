import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from netobserve.settings import MODEL_FEATURES

TEST_DATA = ROOT / "UNSW-NB15_Dataset" / "UNSW_NB15_testing-set.parquet"
METRICS_PATH = ROOT / "metrics" / "model_metrics.json"


def load_model(filename: str):
    model = joblib.load(ROOT / filename)
    if hasattr(model, "n_jobs"):
        model.n_jobs = 1
    return model


def evaluate_classifier(name: str, model, x_test: pd.DataFrame, y_test: pd.Series) -> dict:
    y_pred = model.predict(x_test)
    y_proba = model.predict_proba(x_test)[:, 1]
    return {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, y_proba)), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(
            y_test,
            y_pred,
            target_names=["Normal", "Attack"],
            zero_division=0,
            output_dict=True,
        ),
    }


def main():
    if not TEST_DATA.exists():
        raise FileNotFoundError(f"Missing test dataset: {TEST_DATA}")

    df = pd.read_parquet(TEST_DATA)
    missing = [feature for feature in MODEL_FEATURES + ["label"] if feature not in df.columns]
    if missing:
        raise ValueError(f"Test dataset is missing columns: {missing}")

    x_raw = df[MODEL_FEATURES].dropna().copy()
    y_test = df.loc[x_raw.index, "label"].astype(int)

    scaler = load_model("feature_scaler.pkl")
    x_test = pd.DataFrame(
        scaler.transform(x_raw),
        columns=MODEL_FEATURES,
        index=x_raw.index,
    )

    rf_model = load_model("network_fault_rf_model.pkl")
    anomaly_model = load_model("network_anomaly_iforest.pkl")

    results = {
        "generated_at": datetime.now().isoformat(),
        "dataset": "UNSW-NB15 official testing parquet",
        "dataset_path": str(TEST_DATA.relative_to(ROOT)),
        "sample_count": int(len(x_test)),
        "positive_label": "Attack / anomaly label = 1",
        "features": MODEL_FEATURES,
        "models": {
            "random_forest": evaluate_classifier("random_forest", rf_model, x_test, y_test),
        },
    }

    xgb_path = ROOT / "network_fault_xgb_model.pkl"
    if xgb_path.exists():
        try:
            xgb_model = load_model("network_fault_xgb_model.pkl")
            results["models"]["xgboost"] = evaluate_classifier("xgboost", xgb_model, x_test, y_test)
        except Exception as exc:
            results["models"]["xgboost"] = {"error": str(exc)}

    anomaly_pred = (anomaly_model.predict(x_test) == -1).astype(int)
    results["models"]["isolation_forest"] = {
        "detected_anomalies": int(anomaly_pred.sum()),
        "detected_anomaly_rate": round(float(anomaly_pred.mean()), 4),
    }

    METRICS_PATH.parent.mkdir(exist_ok=True)
    METRICS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")

    print(f"Evaluated {len(x_test):,} records from {TEST_DATA.name}")
    for model_name, metrics in results["models"].items():
        if "error" in metrics:
            print(f"{model_name}: ERROR - {metrics['error']}")
            continue
        if "roc_auc" in metrics:
            print(
                f"{model_name}: accuracy={metrics['accuracy']} "
                f"precision={metrics['precision']} recall={metrics['recall']} "
                f"f1={metrics['f1']} roc_auc={metrics['roc_auc']}"
            )
        else:
            print(
                f"{model_name}: detected_anomalies={metrics['detected_anomalies']} "
                f"rate={metrics['detected_anomaly_rate']}"
            )
    print(f"Saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
