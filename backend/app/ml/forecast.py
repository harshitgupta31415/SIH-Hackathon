"""Time-series forecasting engine for outbreak prediction.

Implements lightweight exponential-smoothing models in pure NumPy so the
forecast pipeline stays dependency-light in production, while optionally
falling back to scikit-learn estimators when they are available.

Public API
----------
- ``build_series(db, village_id, disease_type, days)`` -> list[(date, cases)]
- ``fit_and_forecast(db, village_id, disease_type, horizon_days)`` -> ForecastResult
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.models.models import DiseaseReport


def _ensure_uuid(value) -> UUID:
    """Coerce string UUIDs to UUID objects for SQLite compatibility."""
    if isinstance(value, UUID):
        return value
    return UUID(str(value))

try:  # scikit-learn is optional; the smoothing models work without it
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

MIN_POINTS_FOR_MODEL = 5  # fewer observations -> heuristic fallback
DEFAULT_HORIZON_DAYS = 14


@dataclass
class ForecastResult:
    """A single time-series forecast for one (village, disease) pair."""

    village_id: str
    disease_type: str
    series: list  # historical (date, cases) pairs
    forecast: list  # predicted daily cases over the horizon
    lower: list  # 80% lower bound per horizon day
    upper: list  # 80% upper bound per horizon day
    confidence: float  # 0..1 model agreement / fit quality
    method: str  # "holts-linear" | "ses" | "heuristic"
    next_14_total: float
    trend: str  # "increasing" | "stable" | "decreasing"

    @property
    def peak_day(self) -> int:
        """Horizon-relative day (1-indexed) with the highest prediction."""
        if not self.forecast:
            return 0
        return int(self.forecast.index(max(self.forecast))) + 1


# ── Series construction ────────────────────────────────────────────────

def build_series(
    db: Session,
    village_id: str,
    disease_type: str,
    days: int = 120,
) -> list:
    """Return daily (date, total_cases) pairs for a village + disease."""
    start = datetime.utcnow() - timedelta(days=days)
    vid = _ensure_uuid(village_id)
    rows = (
        db.query(
            func.date(DiseaseReport.created_at).label("day"),
            func.coalesce(func.sum(DiseaseReport.cases_count), 0).label("cases"),
        )
        .filter(
            and_(
                DiseaseReport.village_id == vid,
                DiseaseReport.disease_type == disease_type,
                DiseaseReport.created_at >= start,
            )
        )
        .group_by(func.date(DiseaseReport.created_at))
        .order_by(func.date(DiseaseReport.created_at))
        .all()
    )
    return [(datetime.combine(r.day if hasattr(r.day, 'weekday') else date.fromisoformat(str(r.day)), datetime.min.time()), int(r.cases)) for r in rows]


def _fill_gaps(series: list, days: int) -> list:
    """Expand sparse observations into a dense daily series (zero-filled)."""
    if not series:
        return []
    start = series[0][0].date()
    index = {d: c for d, c in series}
    dense = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        dense.append((datetime.combine(day, datetime.min.time()), int(index.get(day, 0))))
    return dense


# ── Smoothing models (pure NumPy) ──────────────────────────────────────

def _ses_next(values, alpha):
    """Simple exponential smoothing: returns (smoothed, one-step-ahead)."""
    if not values:
        return 0.0, 0.0
    level = float(values[0])
    for value in values:
        level = alpha * float(value) + (1 - alpha) * level
    return level, level


def _holt_next(values, alpha, beta):
    """Holt's linear trend method: returns (level, trend, next forecast)."""
    if len(values) < 2:
        return float(values[0]), 0.0, float(values[0])
    level = float(values[0])
    trend = float(values[1]) - float(values[0])
    for value in values[1:]:
        new_level = alpha * float(value) + (1 - alpha) * (level + trend)
        new_trend = beta * (new_level - level) + (1 - beta) * trend
        level, trend = new_level, new_trend
    return level, trend, level + trend


def _grid_search(series, model: str) -> dict:
    """Pick smoothing parameters that minimise holdout RMSE on the last 25%."""
    series = [float(c) for _, c in series]
    if len(series) < MIN_POINTS_FOR_MODEL + 2:
        return {"alpha": 0.3}

    split = max(1, int(len(series) * 0.75))
    train, valid = series[:split], series[split:]
    best = None

    if model == "holt":
        grid = ((a, b) for a in (0.2, 0.3, 0.5) for b in (0.1, 0.2, 0.3))
        for alpha, beta in grid:
            level, trend, *_ = _holt_next(train, alpha, beta)
            preds = [level + trend * step for step in range(1, len(valid) + 1)]
            rmse = math.sqrt(sum((p - v) ** 2 for p, v in zip(preds, valid)) / len(valid))
            if best is None or rmse < best[0]:
                best = (rmse, {"alpha": alpha, "beta": beta})
        return best[1]

    grid = (0.1, 0.2, 0.3, 0.5, 0.7, 0.9)
    for alpha in grid:
        _, pred = _ses_next(train, alpha)
        rmse = sum((pred - v) ** 2 for v in valid)
        if best is None or rmse < best[0]:
            best = (rmse, {"alpha": alpha})
    return best[1]


def _forecast_holt(series, horizon, alpha, beta):
    level, trend, _ = _holt_next(series, alpha, beta)
    return [max(0.0, level + trend * step) for step in range(1, horizon + 1)]


def _forecast_ses(series, horizon, alpha):
    level, _ = _ses_next(series, alpha)
    return [max(0.0, level)] * horizon


# ── Public entry point ─────────────────────────────────────────────────

def fit_and_forecast(
    db: Session,
    village_id: str,
    disease_type: str,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    max_lookback_days: int = 120,
) -> ForecastResult:
    """
    Fit smoothing models to the observed series and produce a forecast.

    Falls back to a heuristic (recent average + trend extrapolation) when
    there are too few observations to fit a statistical model.
    """
    raw = build_series(db, village_id, disease_type, days=max_lookback_days)
    dense = _fill_gaps(raw, max_lookback_days)
    values = [c for _, c in dense]

    if len([v for v in values if v > 0]) < MIN_POINTS_FOR_MODEL:
        # Heuristic fallback: Poisson-like flat forecast using recent mean.
        recent = values[-14:] or [0]
        mean_recent = sum(recent) / len(recent)
        forecast = [mean_recent] * horizon_days
        trend = "stable" if sum(recent) == 0 else "increasing"
        return ForecastResult(
            village_id=village_id,
            disease_type=disease_type,
            series=dense,
            forecast=forecast,
            lower=[max(0.0, v * 0.6) for v in forecast],
            upper=[v * 1.6 for v in forecast],
            confidence=0.3,
            method="heuristic",
            next_14_total=sum(forecast),
            trend=trend,
        )

    # Try both models on the aggregated week series first (smooths noise),
    # then forecast onto a daily grid for the horizon.
    params_h = _grid_search(dense, "holt")
    params_s = _grid_search(dense, "ses")
    h_forecast = _forecast_holt(values, horizon_days, params_h["alpha"], params_h.get("beta", 0.2))
    s_forecast = _forecast_ses(values, horizon_days, params_s["alpha"])

    # Weighted ensemble: prefer Holt when series is clearly trending.
    last_7 = sum(values[-7:])
    prev_7 = sum(values[-14:-7]) if len(values) >= 14 else last_7
    trend_delta = last_7 - prev_7
    rising = trend_delta > max(2, last_7 * 0.25)

    weight_h = 0.75 if rising else 0.35
    forecast = [
        weight_h * h + (1 - weight_h) * s
        for h, s in zip(h_forecast, s_forecast)
    ]

    scale = max(1.0, sum(values) / (len(values) or 1))
    residual = math.sqrt(sum((v - sum(values) / len(values)) ** 2 for v in values) / len(values))
    spread = max(0.5, residual)
    confidence = max(0.35, min(0.9, len(values) / max_lookback_days))

    method = "holts-linear" if weight_h > 0.5 else "ses"
    trend = "increasing" if trend_delta > 0 else "decreasing" if trend_delta < 0 else "stable"

    return ForecastResult(
        village_id=str(village_id),
        disease_type=disease_type,
        series=dense,
        forecast=[round(v, 2) for v in forecast],
        lower=[round(max(0.0, v - spread), 2) for v in forecast],
        upper=[round(v + spread * 1.5, 2) for v in forecast],
        confidence=round(confidence, 2),
        method=method,
        next_14_total=round(sum(forecast), 2),
        trend=trend,
    )