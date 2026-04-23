# Cashflow COD — ML RTO Risk Service

FastAPI microservice for scoring orders for RTO (return-to-origin) risk.
Phase 2.3 of the Cashflow COD app.

## Run locally

```bash
cd apps/ml-service
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

`GET /healthz` and `POST /score` (see `app/main.py`).

## Train

```bash
uv run python -m app.train --csv data/orders.csv --out models/rto-xgb-v1.joblib
```

If no model artifact is present, the service falls back to an interpretable
heuristic scorer (`app/model.py:heuristic_score`).

## Request schema

```json
POST /score
{
  "order_id": "abc",
  "features": {
    "phone": "+923001234567",
    "city": "Karachi",
    "address": "House 12, Block B, Gulshan",
    "phone_velocity_24h": 0,
    "ip_velocity_24h": 0,
    "hour_of_day": 14,
    "order_amount": 2500
  }
}
```
