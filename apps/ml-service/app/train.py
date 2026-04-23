"""
Minimal training script for a first XGBoost RTO model.

Usage:
    uv run python -m app.train --csv data/orders.csv --out models/rto-xgb-v1.joblib

Expects a CSV with the feature columns (see FeatureInput) plus a `rto` target
column (1 if the order was returned to origin, 0 if delivered).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    try:
        import numpy as np
        import pandas as pd
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import roc_auc_score
        import joblib

        try:
            from xgboost import XGBClassifier
        except ImportError:
            from sklearn.ensemble import GradientBoostingClassifier as XGBClassifier  # type: ignore
    except ImportError as e:
        raise SystemExit(f"Missing deps: {e}; run `uv sync --extra xgboost --extra dev`.")

    df = pd.read_csv(args.csv)
    features = df.drop(columns=["rto"])
    target = df["rto"].astype(int)
    x_train, x_test, y_train, y_test = train_test_split(
        features.values, target.values, test_size=0.2, random_state=42
    )
    model = XGBClassifier(max_depth=4, n_estimators=200, learning_rate=0.08)
    model.fit(x_train, y_train)
    proba = model.predict_proba(x_test)[:, 1]
    auc = roc_auc_score(y_test, proba)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, args.out)
    print(json.dumps({"auc": float(auc), "out": args.out, "rows": int(len(df))}, indent=2))


if __name__ == "__main__":
    main()
