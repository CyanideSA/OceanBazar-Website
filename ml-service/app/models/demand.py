"""Product demand scoring + restock suggestions.

Demand score is a 0-100 index derived from recent sales velocity, normalised
across the catalogue. `days_of_cover` projects how long current stock lasts at
the recent run-rate; a low cover triggers a restock suggestion.
"""
from __future__ import annotations

from typing import Any

import pandas as pd


def compute(df: pd.DataFrame, window_days: int = 30) -> list[dict[str, Any]]:
    if df.empty:
        return []

    units = df["units_sold"].fillna(0).astype(float)
    max_units = float(units.max()) or 1.0
    results: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        pid = str(row["product_id"]).strip()
        sold = int(row.get("units_sold") or 0)
        stock = int(row.get("stock") or 0)
        daily_rate = sold / max(window_days, 1)
        days_of_cover = round(stock / daily_rate, 1) if daily_rate > 0 else None

        # Normalised 0-100 demand index (sqrt compresses long tail).
        demand_score = round(((sold / max_units) ** 0.5) * 100.0, 2)

        restock = bool(daily_rate > 0 and days_of_cover is not None and days_of_cover < 14) or (
            sold > 0 and stock <= 0
        )

        results.append(
            {
                "product_id": pid,
                "title": row.get("title_en"),
                "demand_score": demand_score,
                "units_sold": sold,
                "stock": stock,
                "days_of_cover": days_of_cover,
                "restock_suggested": restock,
                "features": {
                    "daily_rate": round(daily_rate, 3),
                    "order_count": int(row.get("order_count") or 0),
                    "window_days": window_days,
                },
            }
        )

    results.sort(key=lambda r: r["demand_score"], reverse=True)
    return results
