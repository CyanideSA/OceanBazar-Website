"""Customer churn risk + lifetime value estimation.

Uses an RFM (Recency, Frequency, Monetary) feature set. When scikit-learn is
available it adds KMeans-based behavioural segmentation; otherwise it falls back
to rule-based RFM tiers. Churn probability is a calibrated logistic function of
recency and frequency — robust on cold-start data where a trained classifier
would have no labels.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


def _logistic(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _days_since(value: Any) -> int | None:
    """Timezone-safe day delta from `value` to now (UTC). Returns None if missing."""
    if value is None or pd.isnull(value):
        return None
    ts = pd.to_datetime(value, utc=True)
    now_ts = pd.Timestamp.now(tz="UTC")
    return int((now_ts - ts).days)


def _segment_label(recency_days: float, frequency: int, monetary: float) -> str:
    if frequency == 0:
        return "prospect"
    if monetary >= 50000 and frequency >= 5:
        return "champion"
    if recency_days <= 30 and frequency >= 3:
        return "loyal"
    if recency_days <= 60:
        return "active"
    if recency_days <= 120:
        return "at_risk"
    return "dormant"


def compute(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    results: list[dict[str, Any]] = []

    # Optional behavioural clustering for richer segments.
    cluster_map: dict[str, int] = {}
    try:
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler

        active = df[df["order_count"].fillna(0) > 0].copy()
        if len(active) >= 8:
            feats = active[["order_count", "total_spend"]].fillna(0).astype(float)
            feats["recency"] = [
                (_days_since(last) if last is not None else 365) or 365
                for last in active["last_order_at"].tolist()
            ]
            scaled = StandardScaler().fit_transform(feats)
            k = min(5, max(2, len(active) // 4))
            labels = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(scaled)
            for cid, lbl in zip(active["customer_id"].tolist(), labels):
                cluster_map[str(cid).strip()] = int(lbl)
    except Exception:
        cluster_map = {}

    for _, row in df.iterrows():
        cid = str(row["customer_id"]).strip()
        frequency = int(row.get("order_count") or 0)
        monetary = float(row.get("total_spend") or 0.0)
        recency_days = _days_since(row.get("last_order_at"))

        # Churn probability: rises with recency, falls with frequency.
        r = recency_days if recency_days is not None else 365
        churn_logit = -2.0 + (r / 90.0) - (0.45 * frequency) - (0.000004 * monetary)
        churn = round(min(0.9999, max(0.0001, _logistic(churn_logit))), 4)

        # Predicted LTV: monetary base scaled by retention (1 - churn) and frequency lift.
        avg_order = (monetary / frequency) if frequency else 0.0
        retention = 1.0 - churn
        predicted_ltv = round(monetary + avg_order * frequency * retention * 1.5, 2)

        segment = _segment_label(r, frequency, monetary)
        if cid in cluster_map:
            segment = f"{segment}"  # keep semantic label; cluster id stored in features

        results.append(
            {
                "customer_id": cid,
                "churn_score": churn,
                "predicted_ltv": predicted_ltv,
                "segment": segment,
                "recency_days": recency_days,
                "frequency": frequency,
                "monetary": round(monetary, 2),
                "features": {
                    "recency_days": recency_days,
                    "frequency": frequency,
                    "monetary": round(monetary, 2),
                    "avg_order_value": round(avg_order, 2),
                    "cluster": cluster_map.get(cid),
                },
            }
        )
    return results
