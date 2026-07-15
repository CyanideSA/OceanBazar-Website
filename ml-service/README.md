# OceanBazar ML Service

Python FastAPI microservice providing the AI/ML layer for OceanBazar OS v1.0:

- **Churn prediction** + **predicted LTV** + RFM/behavioural **segmentation** (`/predict/churn`)
- **Demand prediction** + restock suggestions (`/predict/demand`)
- **Sales forecasting** — Prophet when available, OLS-trend fallback (`/forecast/sales`)
- **Marketing copy generation** — OpenAI with template fallback (`/generate/marketing`)
- **SEO metadata generation** — meta/keywords/schema/FAQ (`/generate/seo`)
- **Batch recompute** writing into `ml_predictions` + `customers` (`/batch/recompute`)

It reads the **same PostgreSQL** the BFF and Java core use, and writes predictions
to the `ml_predictions` table and mirrors key scores onto `customers`.

## Run locally

```bash
cd ml-service
python -m venv .venv && . .venv/Scripts/activate   # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL, ML_SERVICE_API_KEY, OPENAI_API_KEY
uvicorn app.main:app --reload --port 8100
```

## Docker

```bash
docker build -t oceanbazar-ml ./ml-service
docker run --env-file ml-service/.env -p 8100:8100 oceanbazar-ml
```

Or via the root compose file: `docker compose up ml_service`.

## Auth

Every endpoint except `/health` requires the `X-ML-API-Key` header matching
`ML_SERVICE_API_KEY`. The BFF sends this automatically (see `backend/src/services/mlClient.ts`).

## Notes

- `prophet` and `xgboost` are optional (commented in `requirements.txt`). The service
  degrades gracefully to robust statistical fallbacks when they are absent.
- Without `OPENAI_API_KEY`, generation endpoints return high-quality deterministic templates.
- The service never trusts client input for DB writes beyond ids; all SQL is parameterised.
