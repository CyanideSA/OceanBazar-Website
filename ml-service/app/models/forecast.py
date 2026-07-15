"""Sales revenue forecasting.

Prefers Facebook Prophet when installed; otherwise falls back to an
ordinary-least-squares trend with weekly seasonality approximation and a
confidence band derived from residual standard deviation. Always returns a
result even with sparse history.
"""
from __future__ import annotations

import datetime as dt
from typing import Any

import numpy as np
import pandas as pd


def _prophet_forecast(df: pd.DataFrame, horizon: int) -> list[dict[str, Any]] | None:
    try:
        from prophet import Prophet  # type: ignore
    except Exception:
        return None
    try:
        m = Prophet(daily_seasonality=False, weekly_seasonality=True, yearly_seasonality=False)
        m.fit(df.rename(columns={"ds": "ds", "y": "y"}))
        future = m.make_future_dataframe(periods=horizon)
        fc = m.predict(future).tail(horizon)
        return [
            {
                "date": pd.to_datetime(r["ds"]).strftime("%Y-%m-%d"),
                "predicted_revenue": round(max(0.0, float(r["yhat"])), 2),
                "lower": round(max(0.0, float(r["yhat_lower"])), 2),
                "upper": round(max(0.0, float(r["yhat_upper"])), 2),
            }
            for _, r in fc.iterrows()
        ]
    except Exception:
        return None


def _trend_forecast(df: pd.DataFrame, horizon: int) -> list[dict[str, Any]]:
    df = df.copy()
    df["t"] = np.arange(len(df))
    y = df["y"].astype(float).values

    if len(df) >= 2:
        coeffs = np.polyfit(df["t"].values, y, 1)
        trend = np.poly1d(coeffs)
        resid = y - trend(df["t"].values)
        sigma = float(np.std(resid)) if len(resid) > 1 else float(np.std(y) or 1.0)
    else:
        mean = float(y.mean()) if len(y) else 0.0
        trend = np.poly1d([0.0, mean])
        sigma = float(np.std(y) or mean or 1.0)

    # Weekly seasonality multiplier from day-of-week averages.
    dow_factor = {}
    if len(df) >= 7:
        df["dow"] = pd.to_datetime(df["ds"]).dt.dayofweek
        overall = y.mean() or 1.0
        for dow, grp in df.groupby("dow"):
            dow_factor[int(dow)] = float(grp["y"].mean() / overall) if overall else 1.0

    last_date = pd.to_datetime(df["ds"].iloc[-1]) if len(df) else dt.datetime.utcnow()
    last_t = int(df["t"].iloc[-1]) if len(df) else 0
    points: list[dict[str, Any]] = []
    for i in range(1, horizon + 1):
        date = last_date + dt.timedelta(days=i)
        base = float(trend(last_t + i))
        factor = dow_factor.get(date.dayofweek, 1.0) if dow_factor else 1.0
        pred = max(0.0, base * factor)
        band = 1.96 * sigma
        points.append(
            {
                "date": date.strftime("%Y-%m-%d"),
                "predicted_revenue": round(pred, 2),
                "lower": round(max(0.0, pred - band), 2),
                "upper": round(pred + band, 2),
            }
        )
    return points


def compute(df: pd.DataFrame, horizon: int = 30) -> tuple[str, list[dict[str, Any]]]:
    if df.empty:
        today = dt.datetime.utcnow()
        return "empty", [
            {
                "date": (today + dt.timedelta(days=i)).strftime("%Y-%m-%d"),
                "predicted_revenue": 0.0,
                "lower": 0.0,
                "upper": 0.0,
            }
            for i in range(1, horizon + 1)
        ]
    prophet = _prophet_forecast(df, horizon)
    if prophet is not None:
        return "prophet", prophet
    return "ols_trend", _trend_forecast(df, horizon)
