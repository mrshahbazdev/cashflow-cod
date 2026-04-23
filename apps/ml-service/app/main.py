"""
Cashflow COD — ML RTO Risk Service (Phase 2.3).

Exposes a FastAPI endpoint that scores a pending order for RTO (return-to-origin)
risk based on a curated feature set. The heuristic path ships by default; swap in
the XGBoost path by training a model with `app.train` and placing the artifact at
`./models/rto-xgb-v1.joblib`.
"""
from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from .features import build_feature_vector, FeatureInput
from .model import load_model, heuristic_score

app = FastAPI(title="Cashflow COD ML", version="0.1.0")

MODEL = load_model(os.getenv("MODEL_PATH", "models/rto-xgb-v1.joblib"))
MODEL_NAME = "xgboost-v1" if MODEL is not None else "heuristic-v1"


class ScoreRequest(BaseModel):
    order_id: str | None = None
    submission_id: str | None = None
    features: FeatureInput


class ScoreResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    label: str
    model: str
    version: str
    reasons: list[dict[str, Any]]


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    vec = build_feature_vector(req.features)
    if MODEL is not None:
        proba = float(MODEL.predict_proba([vec])[0][1])
        s = max(0, min(100, int(round(proba * 100))))
        reasons = []  # XGBoost SHAP values would go here; stubbed for now.
    else:
        s, reasons = heuristic_score(req.features)
    label = "high" if s >= 70 else "medium" if s >= 30 else "low"
    return ScoreResponse(
        score=s,
        label=label,
        model=MODEL_NAME,
        version="0.1.0",
        reasons=reasons,
    )
