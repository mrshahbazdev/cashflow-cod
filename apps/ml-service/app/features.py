"""Feature engineering for RTO risk scoring."""
from __future__ import annotations

import re
from typing import Any, TypedDict

from pydantic import BaseModel


class FeatureInput(BaseModel):
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    country: str | None = None
    order_amount: float | None = None
    hour_of_day: int | None = None  # 0..23
    day_of_week: int | None = None  # 0..6 (Mon=0)
    device_type: str | None = None  # desktop | mobile | tablet
    phone_velocity_24h: int = 0
    ip_velocity_24h: int = 0
    is_repeat_customer: bool = False
    prev_rto_rate: float = 0.0  # 0..1 for this phone across our network


class FeatureVec(TypedDict):
    phone_digits: int
    phone_leading_zero: int
    phone_velocity_24h: int
    ip_velocity_24h: int
    address_len: int
    address_has_digit: int
    city_known: int
    has_postal_code: int
    hour_late_night: int  # 0/1 for 0..5 or 22..23
    day_weekend: int
    amount_high: int
    is_repeat_customer: int
    prev_rto_rate: float


def build_feature_vector(f: FeatureInput) -> list[float]:
    v = _raw(f)
    return [float(v[k]) for k in (
        "phone_digits",
        "phone_leading_zero",
        "phone_velocity_24h",
        "ip_velocity_24h",
        "address_len",
        "address_has_digit",
        "city_known",
        "has_postal_code",
        "hour_late_night",
        "day_weekend",
        "amount_high",
        "is_repeat_customer",
        "prev_rto_rate",
    )]


def _raw(f: FeatureInput) -> FeatureVec:
    digits = re.sub(r"\D", "", f.phone or "")
    addr = (f.address or "").strip()
    hour = f.hour_of_day if f.hour_of_day is not None else 12
    day = f.day_of_week if f.day_of_week is not None else 2
    return FeatureVec(
        phone_digits=len(digits),
        phone_leading_zero=1 if digits.startswith("0") else 0,
        phone_velocity_24h=f.phone_velocity_24h,
        ip_velocity_24h=f.ip_velocity_24h,
        address_len=len(addr),
        address_has_digit=1 if any(c.isdigit() for c in addr) else 0,
        city_known=1 if (f.city and len(f.city.strip()) >= 3) else 0,
        has_postal_code=1 if (f.postal_code and len(f.postal_code.strip()) > 0) else 0,
        hour_late_night=1 if (hour <= 5 or hour >= 22) else 0,
        day_weekend=1 if day in (5, 6) else 0,
        amount_high=1 if (f.order_amount or 0) > 10000 else 0,
        is_repeat_customer=1 if f.is_repeat_customer else 0,
        prev_rto_rate=float(f.prev_rto_rate),
    )


def describe_reasons(f: FeatureInput) -> list[dict[str, Any]]:
    """Human-readable reasons for UI. Used by the heuristic scorer."""
    r = _raw(f)
    reasons: list[dict[str, Any]] = []
    if r["phone_digits"] < 10:
        reasons.append({"code": "short_phone", "message": "Phone has fewer than 10 digits"})
    if r["phone_velocity_24h"] >= 3:
        reasons.append(
            {"code": "phone_velocity", "message": f"{r['phone_velocity_24h']} orders in 24h"}
        )
    if r["ip_velocity_24h"] >= 5:
        reasons.append(
            {"code": "ip_velocity", "message": f"{r['ip_velocity_24h']} orders in 24h from IP"}
        )
    if r["address_len"] < 10:
        reasons.append({"code": "short_address", "message": "Address looks too short"})
    if not r["address_has_digit"]:
        reasons.append({"code": "no_house_number", "message": "No house/flat number"})
    if not r["city_known"]:
        reasons.append({"code": "missing_city", "message": "City missing or too short"})
    if r["hour_late_night"]:
        reasons.append({"code": "late_night", "message": "Ordered late-night (22:00–05:59)"})
    if r["amount_high"]:
        reasons.append({"code": "high_amount", "message": "Order amount above 10,000"})
    if r["prev_rto_rate"] >= 0.5:
        reasons.append(
            {"code": "network_rto", "message": f"Network RTO rate {int(r['prev_rto_rate']*100)}%"}
        )
    return reasons
