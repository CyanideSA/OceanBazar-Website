"""Pydantic request/response schemas."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ChurnRequest(BaseModel):
    customer_ids: list[str] | None = Field(default=None, description="Specific customers; omit for all")
    persist: bool = Field(default=True, description="Write scores to ml_predictions + customers")


class ChurnScore(BaseModel):
    customer_id: str
    churn_score: float
    predicted_ltv: float
    segment: str
    recency_days: int | None = None
    frequency: int
    monetary: float


class ChurnResponse(BaseModel):
    model_version: str
    count: int
    results: list[ChurnScore]


class DemandRequest(BaseModel):
    product_ids: list[str] | None = None
    window_days: int = 30
    persist: bool = True


class DemandScore(BaseModel):
    product_id: str
    title: str | None = None
    demand_score: float
    units_sold: int
    stock: int
    days_of_cover: float | None = None
    restock_suggested: bool


class DemandResponse(BaseModel):
    model_version: str
    count: int
    results: list[DemandScore]


class ForecastRequest(BaseModel):
    horizon_days: int = 30
    history_days: int = 180


class ForecastPoint(BaseModel):
    date: str
    predicted_revenue: float
    lower: float
    upper: float


class ForecastResponse(BaseModel):
    method: str
    horizon_days: int
    history_points: int
    total_predicted: float
    points: list[ForecastPoint]


class MarketingRequest(BaseModel):
    kind: Literal["email", "ad_copy", "product_description", "sms", "push"] = "email"
    topic: str
    audience: str | None = None
    tone: str | None = "friendly, persuasive"
    language: Literal["en", "bn"] = "en"
    product_name: str | None = None
    extra_context: str | None = None


class MarketingResponse(BaseModel):
    source: str
    subject: str | None = None
    body: str


class SeoRequest(BaseModel):
    entity_type: Literal["product", "category", "brand", "page"] = "product"
    name: str
    description: str | None = None
    category: str | None = None
    keywords: list[str] | None = None
    language: Literal["en", "bn"] = "en"
    canonical_url: str | None = None


class SeoResponse(BaseModel):
    source: str
    meta_title: str
    meta_description: str
    keywords: list[str]
    schema_json: dict[str, Any]
    faq: list[dict[str, str]]
    seo_score: int


class RecomputeRequest(BaseModel):
    churn: bool = True
    demand: bool = True
    window_days: int = 30
