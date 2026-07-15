"""Database access for the ML service (read features, write predictions)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Iterable
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from .config import get_settings

_engine: Engine | None = None


def normalize_database_url(url: str) -> tuple[str, dict[str, str]]:
    """Makes a Prisma/JDBC-style URL safe for SQLAlchemy + psycopg2.

    - Forces the ``postgresql+psycopg2`` driver so the same secret used by the
      BFF (``postgresql://...``) works here.
    - Extracts Prisma's ``?schema=`` into a ``search_path`` connect option
      (psycopg2 rejects an unknown ``schema`` libpq parameter).
    """
    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+psycopg2"

    query = dict(parse_qsl(parts.query))
    schema = query.pop("schema", None)
    new_url = urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    connect_args: dict[str, str] = {}
    if schema:
        connect_args["options"] = f"-csearch_path={schema}"
    return new_url, connect_args


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        settings = get_settings()
        url, connect_args = normalize_database_url(settings.database_url)
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            future=True,
            connect_args=connect_args,
        )
    return _engine


def read_df(sql: str, params: dict[str, Any] | None = None) -> pd.DataFrame:
    """Runs a parameterised query and returns a DataFrame.

    Uses SQLAlchemy execute (not pandas.read_sql) so that Python list params bind
    reliably to Postgres ``= ANY(:ids)`` via psycopg2 array adaptation.
    """
    with get_engine().connect() as conn:
        result = conn.execute(text(sql), params or {})
        rows = result.fetchall()
        columns = list(result.keys())
    return pd.DataFrame(rows, columns=columns)


# ─── Feature queries ──────────────────────────────────────────────────────

def customer_rfm(customer_ids: Iterable[str] | None = None) -> pd.DataFrame:
    """Recency / Frequency / Monetary features per customer (paid orders)."""
    where = ""
    params: dict[str, Any] = {}
    if customer_ids:
        ids = list(customer_ids)
        where = "WHERE u.id = ANY(:ids)"
        params["ids"] = ids
    sql = f"""
        SELECT
          u.id AS customer_id,
          u.user_type,
          u.lifetime_spend,
          u.created_at AS signup_at,
          COUNT(o.id) FILTER (WHERE o.payment_status = 'paid') AS order_count,
          COALESCE(SUM(o.total) FILTER (WHERE o.payment_status = 'paid'), 0) AS total_spend,
          MAX(o.created_at) FILTER (WHERE o.payment_status = 'paid') AS last_order_at
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        {where}
        GROUP BY u.id, u.user_type, u.lifetime_spend, u.created_at
    """
    return read_df(sql, params)


def product_sales_velocity(product_ids: Iterable[str] | None = None, days: int = 30) -> pd.DataFrame:
    """Units sold over a recent window + current stock per product.

    The recency/payment filter lives inside the LEFT JOIN so that products with
    no recent sales still appear (with units_sold = 0).
    """
    params: dict[str, Any] = {"since": dt.datetime.utcnow() - dt.timedelta(days=days)}
    product_where = ""
    if product_ids:
        product_where = "WHERE p.id = ANY(:ids)"
        params["ids"] = list(product_ids)
    sql = f"""
        SELECT
          p.id AS product_id,
          p.title_en,
          p.stock,
          COALESCE(SUM(oi.quantity), 0) AS units_sold,
          COUNT(DISTINCT o.id) AS order_count
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o
          ON o.id = oi.order_id
          AND o.payment_status = 'paid'
          AND o.created_at >= :since
        {product_where}
        GROUP BY p.id, p.title_en, p.stock
    """
    return read_df(sql, params)


def daily_revenue(days: int = 180) -> pd.DataFrame:
    sql = """
        SELECT DATE(o.created_at) AS ds, COALESCE(SUM(o.total), 0) AS y
        FROM orders o
        WHERE o.payment_status = 'paid'
          AND o.created_at >= :since
        GROUP BY DATE(o.created_at)
        ORDER BY ds
    """
    return read_df(sql, {"since": dt.datetime.utcnow() - dt.timedelta(days=days)})


# ─── Prediction writes ──────────────────────────────────────────────────────

def upsert_prediction(
    subject_type: str,
    subject_id: str,
    *,
    churn_score: float | None = None,
    predicted_ltv: float | None = None,
    demand_score: float | None = None,
    segment: str | None = None,
    features: dict[str, Any] | None = None,
    model_version: str | None = None,
) -> None:
    import json
    settings = get_settings()
    sql = """
        INSERT INTO ml_predictions
          (id, subject_type, subject_id, churn_score, predicted_ltv, demand_score, segment, features, model_version, computed_at)
        VALUES
          (:id, :subject_type, :subject_id, :churn, :ltv, :demand, :segment, CAST(:features AS jsonb), :mv, NOW())
        ON CONFLICT (subject_type, subject_id) DO UPDATE SET
          churn_score = EXCLUDED.churn_score,
          predicted_ltv = EXCLUDED.predicted_ltv,
          demand_score = EXCLUDED.demand_score,
          segment = EXCLUDED.segment,
          features = EXCLUDED.features,
          model_version = EXCLUDED.model_version,
          computed_at = NOW()
    """
    pred_id = f"{subject_type}:{subject_id}"
    with get_engine().begin() as conn:
        conn.execute(
            text(sql),
            {
                "id": pred_id,
                "subject_type": subject_type,
                "subject_id": subject_id,
                "churn": churn_score,
                "ltv": predicted_ltv,
                "demand": demand_score,
                "segment": segment,
                "features": json.dumps(features or {}),
                "mv": model_version or settings.model_version,
            },
        )


def update_customer_scores(customer_id: str, churn: float | None, ltv: float | None, segment: str | None) -> None:
    """Mirror key scores onto the customers row for fast CRM reads."""
    sql = """
        UPDATE customers
        SET churn_risk_score = :churn,
            predicted_ltv = :ltv,
            segment = COALESCE(:segment, segment),
            updated_at = NOW()
        WHERE user_id = :cid
    """
    with get_engine().begin() as conn:
        conn.execute(text(sql), {"churn": churn, "ltv": ltv, "segment": segment, "cid": customer_id})
