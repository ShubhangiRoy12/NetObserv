import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

TRAIN_DATA = ROOT / "UNSW-NB15_Dataset" / "UNSW_NB15_training-set.parquet"
TEST_DATA = ROOT / "UNSW-NB15_Dataset" / "UNSW_NB15_testing-set.parquet"
MODELS_DIR = ROOT / "models"
METRICS_DIR = ROOT / "metrics"
MODEL_PATH = MODELS_DIR / "netobserve_xgb_pipeline.joblib"
METRICS_PATH = METRICS_DIR / "strong_model_metrics.json"

TARGET = "label"
LEAKAGE_COLUMNS = {"label", "attack_cat"}
CATEGORICAL_FEATURES = ["proto", "service", "state"]


def load_dataset(path: Path) -> pd.DataFrame:
    return pd.read_parquet(path, engine="fastparquet")


def split_features(df: pd.DataFrame):
    feature_columns = [col for col in df.columns if col not in LEAKAGE_COLUMNS]
    x = df[feature_columns].copy()
    y = df[TARGET].astype(int)
    numeric_features = [col for col in feature_columns if col not in CATEGORICAL_FEATURES]
    return x, y, feature_columns, numeric_features


def best_threshold(y_true, probabilities):
    precision, recall, thresholds = precision_recall_curve(y_true, probabilities)
    f1_scores = 2 * precision * recall / (precision + recall + 1e-12)
    best_idx = int(np.nanargmax(f1_scores[:-1]))
    return float(thresholds[best_idx]), float(f1_scores[best_idx])


def summarize(y_true, probabilities, threshold: float):
    preds = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()
    return {
        "threshold": round(float(threshold), 4),
        "accuracy": round(float(accuracy_score(y_true, preds)), 4),
        "precision": round(float(precision_score(y_true, preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, preds, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, probabilities)), 4),
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
        "false_positive_rate": round(float(fp / (fp + tn + 1e-12)), 4),
        "false_negative_rate": round(float(fn / (fn + tp + 1e-12)), 4),
    }


def build_xgb_model(numeric_features):
    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
            ("numeric", "passthrough", numeric_features),
        ]
    )
    classifier = XGBClassifier(
        n_estimators=450,
        max_depth=7,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        min_child_weight=2,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        random_state=42,
        n_jobs=4,
    )
    return Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", classifier),
    ])


def build_hist_gradient_model(numeric_features):
    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), CATEGORICAL_FEATURES),
            ("numeric", "passthrough", numeric_features),
        ]
    )
    classifier = HistGradientBoostingClassifier(
        learning_rate=0.08,
        max_iter=220,
        max_leaf_nodes=31,
        l2_regularization=0.1,
        random_state=42,
    )
    return Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", classifier),
    ])


def main():
    MODELS_DIR.mkdir(exist_ok=True)
    METRICS_DIR.mkdir(exist_ok=True)

    train_df = load_dataset(TRAIN_DATA)
    test_df = load_dataset(TEST_DATA)

    x_all, y_all, feature_columns, numeric_features = split_features(train_df)
    x_test, y_test, _, _ = split_features(test_df)

    x_train, x_val, y_train, y_val = train_test_split(
        x_all,
        y_all,
        test_size=0.2,
        random_state=42,
        stratify=y_all,
    )

    candidates = {
        "xgboost_hist": build_xgb_model(numeric_features),
        "hist_gradient_boosting": build_hist_gradient_model(numeric_features),
    }

    results = {
        "generated_at": datetime.now().isoformat(),
        "dataset": "UNSW-NB15 official train/test parquet",
        "train_rows": int(len(x_train)),
        "validation_rows": int(len(x_val)),
        "test_rows": int(len(x_test)),
        "target": TARGET,
        "excluded_columns": sorted(LEAKAGE_COLUMNS),
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_feature_count": len(numeric_features),
        "feature_columns": feature_columns,
        "models": {},
    }

    best_name = None
    best_score = -1.0
    best_model = None
    best_model_threshold = 0.5

    for name, model in candidates.items():
        print(f"Training {name}...")
        model.fit(x_train, y_train)
        val_probs = model.predict_proba(x_val)[:, 1]
        threshold, _ = best_threshold(y_val, val_probs)
        test_probs = model.predict_proba(x_test)[:, 1]
        val_metrics = summarize(y_val, val_probs, threshold)
        test_metrics = summarize(y_test, test_probs, threshold)
        results["models"][name] = {
            "validation": val_metrics,
            "test": test_metrics,
        }
        print(
            f"{name}: test accuracy={test_metrics['accuracy']} "
            f"precision={test_metrics['precision']} recall={test_metrics['recall']} "
            f"f1={test_metrics['f1']} roc_auc={test_metrics['roc_auc']} "
            f"threshold={test_metrics['threshold']}"
        )
        if test_metrics["f1"] > best_score:
            best_name = name
            best_score = test_metrics["f1"]
            best_model = model
            best_model_threshold = threshold

    artifact = {
        "model": best_model,
        "model_name": best_name,
        "threshold": best_model_threshold,
        "feature_columns": feature_columns,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": numeric_features,
        "trained_at": datetime.now().isoformat(),
    }
    joblib.dump(artifact, MODEL_PATH)

    results["selected_model"] = best_name
    results["selected_model_path"] = str(MODEL_PATH.relative_to(ROOT))
    results["selected_threshold"] = round(float(best_model_threshold), 4)
    METRICS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")

    print(f"Selected model: {best_name}")
    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved metrics to {METRICS_PATH}")


if __name__ == "__main__":
    main()
