"""Outbreak prediction service.

Combines:
  1. A trained scikit-learn regressor (see ``train.py``) that scores
     near-term case-load from engineered surveillance features.
  2. A time-series forecaster (``forecast.py``) that produces a 14-day
     projection per village + disease.

Responses are cached in Redis when available and always mirrored into the
``outbreak_predictions`` table for auditability/history.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.models import DiseaseReport, Village, WaterQuality, OutbreakPrediction
from app.ml.forecast import fit_and_forecast, MIN_POINTS_FOR_MODEL

try:
    import joblib
    HAVE_JOBLIB = True
except ImportError:  # pragma: no cover
    HAVE_JOBLIB = False

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
LATEST_POINTER = os.path.join(MODELS_DIR, "latest_model.json")

_model_cache = {"path": None, "model": None}

KNOWN_DISEASES = ["Cholera", "Typhoid", "Diarrhea", "Hepatitis A", "Dysentery"]


def _load_trained_model():
    """Load the persisted regressor once and cache it in-process."""
    if not HAVE_JOBLIB:
        return None
    if _model_cache["model"] is not None:
        return _model_cache["model"]
    try:
        with open(LATEST_POINTER) as handle:
            pointer = json.load(handle)
        model = joblib.load(pointer["path"])
        _model_cache["path"] = pointer["path"]
        _model_cache["model"] = model
        return model
    except (OSError, KeyError, ValueError):
        return None


def _ensure_model_file() -> str | None:
    """Train on demand if no artifact exists yet."""
    model = _load_trained_model()
    if model is not None:
        return _model_cache["path"]
    try:
        from app.ml.train import _train_model, _build_training_set
        db = SessionLocal()
        try:
            X, y, _ = _build_training_set(db)
            return _train_model(X, y)
        finally:
            db.close()
    except Exception:  # pragma: no cover - training is best-effort
        return None


def get_forecast(
    db: Session,
    village: Village,
    disease_type: str,
    horizon_days: int = 14,
) -> dict:
    """14-day forecast for one village + disease (real model-backed)."""
    result = fit_and_forecast(db, str(village.id), disease_type, horizon_days=horizon_days)

    # Optionally blend the trained regressor's near-term projection.
    model = _load_trained_model()
    regressor_score = None
    if model is not None:
        try:
            from app.ml.train import _engineered_features
            features, _ = _engineered_features(db, village, disease_type)
            regressor_score = float(model.predict([list(features.values())])[0])
        except Exception:
            regressor_score = None

    base = result.next_14_total
    if regressor_score is not None and result.method != "heuristic":
        base = 0.6 * base + 0.4 * max(0.0, regressor_score)

    return {
        "village_id": str(village.id),
        "village_name": village.name,
        "disease_type": disease_type,
        "forecast_series": result.forecast,
        "lower_bound": result.lower,
        "upper_bound": result.upper,
        "next_14_total": round(base, 1),
        "trend": result.trend,
        "confidence": result.confidence,
        "method": result.method,
        "regressor_score": regressor_score,
        "peak_day": result.peak_day,
    }


class MLPredictor:
    @staticmethod
    def calculate_trend(db: Session, village_id: UUID, disease_type: str) -> dict:
        two_weeks_ago = datetime.utcnow() - timedelta(days=14)
        recent_week = datetime.utcnow() - timedelta(days=7)

        recent_cases = (
            db.query(func.coalesce(func.sum(DiseaseReport.cases_count), 0))
            .filter(
                and_(
                    DiseaseReport.village_id == village_id,
                    DiseaseReport.disease_type == disease_type,
                    DiseaseReport.created_at >= recent_week,
                )
            )
            .scalar()
        )
        previous_cases = (
            db.query(func.coalesce(func.sum(DiseaseReport.cases_count), 0))
            .filter(
                and_(
                    DiseaseReport.village_id == village_id,
                    DiseaseReport.disease_type == disease_type,
                    DiseaseReport.created_at >= two_weeks_ago,
                    DiseaseReport.created_at < recent_week,
                )
            )
            .scalar()
        )

        if previous_cases == 0:
            change_percent = 100.0 if recent_cases > 0 else 0.0
        else:
            change_percent = ((recent_cases - previous_cases) / previous_cases) * 100

        trend = "increasing" if change_percent > 20 else "decreasing" if change_percent < -20 else "stable"

        return {
            "recent_week_cases": recent_cases,
            "previous_week_cases": previous_cases,
            "change_percent": round(change_percent, 1),
            "trend": trend,
        }

    @staticmethod
    def predict_outbreak(db: Session, district: str, disease_type: str) -> dict:
        villages = db.query(Village).filter(Village.district == district).all()

        total_predicted = 0.0
        total_confidence = 0.0
        village_forecasts = []
        high_risk_villages = []

        for village in villages:
            forecast = get_forecast(db, village, disease_type)
            water_issues = (
                db.query(WaterQuality)
                .filter(
                    and_(
                        WaterQuality.village_id == village.id,
                        WaterQuality.is_contaminated.is_(True),
                    )
                )
                .count()
            )

            factors = []
            if forecast["trend"] == "increasing":
                factors.append("increasing_cases")
            if water_issues > 0:
                factors.append("water_contamination")
            if village.population and village.population > 1000:
                factors.append("high_population")

            # Risk level from the model projection vs the recent baseline.
            recent_total = sum(forecast["forecast_series"][-14:])
            projected = forecast["next_14_total"]
            growth = (projected / recent_total) if recent_total else 2.0

            risk_score = min(
                100.0,
                max(0.0,
                    ((projected / 10.0) * 40)
                    + (growth * 25)
                    + (min(water_issues, 3) / 3.0 * 20)
                    + (min(len(factors), 3) / 3.0 * 15)),
            )

            total_predicted += projected
            total_confidence += forecast["confidence"]
            village_forecasts.append({**forecast, "risk_score": round(risk_score, 1)})

            if risk_score >= 60:
                high_risk_villages.append(
                    {
                        "village": village.name,
                        "risk_score": round(risk_score, 1),
                        "predicted_cases": forecast["next_14_total"],
                        "factors": factors,
                    }
                )

        num_villages = len(villages) if villages else 1
        avg_confidence = total_confidence / num_villages

        risk_level = "low"
        if total_predicted > 50 or len(high_risk_villages) > 3:
            risk_level = "critical"
        elif total_predicted > 30 or len(high_risk_villages) > 2:
            risk_level = "high"
        elif total_predicted > 15 or len(high_risk_villages) > 1:
            risk_level = "medium"

        return {
            "district": district,
            "disease_type": disease_type,
            "predicted_cases": round(total_predicted, 1),
            "confidence": round(avg_confidence, 2),
            "risk_level": risk_level,
            "prediction_date": datetime.utcnow(),
            "valid_until": datetime.utcnow() + timedelta(days=14),
            "factors": {
                "high_risk_villages": high_risk_villages,
                "total_villages_assessed": len(villages),
                "models_used": sorted({v["method"] for v in village_forecasts}),
                "disease_type": disease_type,
                "district": district,
            },
            "village_forecasts": village_forecasts,
            "model_artifact": _model_cache["path"],
        }

    @staticmethod
    def save_prediction(db: Session, prediction: dict) -> OutbreakPrediction:
        record = OutbreakPrediction(
            district=prediction["district"],
            disease_type=prediction["disease_type"],
            predicted_cases=prediction["predicted_cases"],
            confidence=prediction["confidence"],
            risk_level=prediction["risk_level"],
            prediction_date=prediction["prediction_date"],
            valid_until=prediction["valid_until"],
            factors=prediction["factors"],
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


def ensure_model_trained():
    """Best-effort training of the regressor at startup if absent."""
    _ensure_model_file()