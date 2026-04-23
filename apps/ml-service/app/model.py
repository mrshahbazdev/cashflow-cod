"""Model loader + heuristic fallback."""
from __future__ import annotations

import os
from typing import Any

from .features import FeatureInput, describe_reasons, _raw


def load_model(path: str) -> Any:
    """Return a sklearn-compatible model or None if artifact is absent / import fails."""
    if not os.path.exists(path):
        return None
    try:
        import joblib  # type: ignore

        return joblib.load(path)
    except Exception:
        return None


def heuristic_score(f: FeatureInput) -> tuple[int, list[dict[str, Any]]]:
    """Interpretable heuristic used as fallback and to seed labels for training."""
    r = _raw(f)
    score = 0
    if r["phone_digits"] < 10:
        score += 30
    if r["phone_velocity_24h"] >= 3:
        score += min(35, r["phone_velocity_24h"] * 10)
    if r["ip_velocity_24h"] >= 5:
        score += min(25, r["ip_velocity_24h"] * 3)
    if r["address_len"] < 10:
        score += 15
    if not r["address_has_digit"]:
        score += 10
    if not r["city_known"]:
        score += 10
    if r["hour_late_night"]:
        score += 8
    if r["amount_high"]:
        score += 12
    if r["prev_rto_rate"] >= 0.5:
        score += int(r["prev_rto_rate"] * 30)
    score = max(0, min(100, score))
    return score, describe_reasons(f)
