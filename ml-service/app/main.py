"""OceanBazar ML service — FastAPI app.

Endpoints (all require X-ML-API-Key when ML_SERVICE_API_KEY is set):
  GET  /health
  POST /predict/churn
  POST /predict/demand
  POST /forecast/sales
  POST /generate/marketing
  POST /generate/seo
  POST /batch/recompute
"""
from __future__ import annotations

import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .security import require_api_key
from . import db
from .models import churn as churn_model
from .models import demand as demand_model
from .models import forecast as forecast_model
from .generation import marketing as marketing_gen
from .generation import seo as seo_gen
from .generation import llm
from .schemas import (
    ChurnRequest, ChurnResponse, ChurnScore,
    DemandRequest, DemandResponse, DemandScore,
    ForecastRequest, ForecastResponse, ForecastPoint,
    MarketingRequest, MarketingResponse,
    SeoRequest, SeoResponse,
    RecomputeRequest,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ob-ml")

settings = get_settings()
app = FastAPI(title="OceanBazar ML Service", version=settings.model_version)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    db_ok = True
    try:
        db.read_df("SELECT 1 AS ok")
    except Exception as exc:  # pragma: no cover
        db_ok = False
        log.warning("DB health check failed: %s", exc)
    return {
        "status": "ok",
        "service": "oceanbazar-ml",
        "model_version": settings.model_version,
        "db": db_ok,
        "openai": llm.is_enabled(),
    }


@app.post("/predict/churn", response_model=ChurnResponse, dependencies=[Depends(require_api_key)])
async def predict_churn(req: ChurnRequest) -> ChurnResponse:
    df = db.customer_rfm(req.customer_ids)
    scored = churn_model.compute(df)
    if req.persist:
        for s in scored:
            db.upsert_prediction(
                "customer", s["customer_id"],
                churn_score=s["churn_score"], predicted_ltv=s["predicted_ltv"],
                segment=s["segment"], features=s["features"],
            )
            db.update_customer_scores(s["customer_id"], s["churn_score"], s["predicted_ltv"], s["segment"])
    return ChurnResponse(
        model_version=settings.model_version,
        count=len(scored),
        results=[ChurnScore(**{k: s[k] for k in (
            "customer_id", "churn_score", "predicted_ltv", "segment", "recency_days", "frequency", "monetary")}) for s in scored],
    )


@app.post("/predict/demand", response_model=DemandResponse, dependencies=[Depends(require_api_key)])
async def predict_demand(req: DemandRequest) -> DemandResponse:
    df = db.product_sales_velocity(req.product_ids, req.window_days)
    scored = demand_model.compute(df, req.window_days)
    if req.persist:
        for s in scored:
            db.upsert_prediction(
                "product", s["product_id"],
                demand_score=s["demand_score"], features=s["features"],
            )
    return DemandResponse(
        model_version=settings.model_version,
        count=len(scored),
        results=[DemandScore(**{k: s[k] for k in (
            "product_id", "title", "demand_score", "units_sold", "stock", "days_of_cover", "restock_suggested")}) for s in scored],
    )


@app.post("/forecast/sales", response_model=ForecastResponse, dependencies=[Depends(require_api_key)])
async def forecast_sales(req: ForecastRequest) -> ForecastResponse:
    df = db.daily_revenue(req.history_days)
    method, points = forecast_model.compute(df, req.horizon_days)
    return ForecastResponse(
        method=method,
        horizon_days=req.horizon_days,
        history_points=len(df),
        total_predicted=round(sum(p["predicted_revenue"] for p in points), 2),
        points=[ForecastPoint(**p) for p in points],
    )


@app.post("/generate/marketing", response_model=MarketingResponse, dependencies=[Depends(require_api_key)])
async def generate_marketing(req: MarketingRequest) -> MarketingResponse:
    return marketing_gen.generate(req)


@app.post("/generate/seo", response_model=SeoResponse, dependencies=[Depends(require_api_key)])
async def generate_seo(req: SeoRequest) -> SeoResponse:
    return seo_gen.generate(req)


@app.post("/batch/recompute", dependencies=[Depends(require_api_key)])
async def batch_recompute(req: RecomputeRequest) -> dict:
    out: dict = {"churn": 0, "demand": 0}
    if req.churn:
        df = db.customer_rfm(None)
        scored = churn_model.compute(df)
        for s in scored:
            db.upsert_prediction("customer", s["customer_id"], churn_score=s["churn_score"],
                                 predicted_ltv=s["predicted_ltv"], segment=s["segment"], features=s["features"])
            db.update_customer_scores(s["customer_id"], s["churn_score"], s["predicted_ltv"], s["segment"])
        out["churn"] = len(scored)
    if req.demand:
        df = db.product_sales_velocity(None, req.window_days)
        scored = demand_model.compute(df, req.window_days)
        for s in scored:
            db.upsert_prediction("product", s["product_id"], demand_score=s["demand_score"], features=s["features"])
        out["demand"] = len(scored)
    return {"status": "ok", **out}
