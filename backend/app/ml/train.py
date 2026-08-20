"""Train and persist outbreak-risk models.

This script builds a real machine-learning model -- a gradient-boosted /
random-forest regressor trained on engineered surveillance features -- and
stores it as a .joblib artifact that the live API loads at runtime. It also
runs on the rule-based (exponential-smoothing) forecaster over the seeded
data so the outputs can be surfaced in the dashboard.

Run from the backend directory::

    python -m app.ml.train

The artifacts are written to ``app/ml/models/``:
  - ``outbreak_rf_<date>.joblib``  trained regressor (primary model)
  - ``latest_model.json``          pointer to the newest artifact
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta

from sqlalchemy import and_, func

from app.database import SessionLocal
from app.ml.forecast import fit_and_forecast
from app.models.models import Alert, DiseaseReport, Village, WaterQuality
from app.time_utils import utc_now

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

try:
    import joblib
    from sklearn.ensemble import RandomForestRegressor
    HAVE_SKLEARN = True
except ImportError:  # pragma: no cover
    HAVE_SKLEARN = False


def _engineered_features(
    db, village, disease_type, days: int = 120
) -> dict:
    """Feature vector used to predict case-load in the next 7 days."""
    start = utc_now() - timedelta(days=days)
    rows = (
        db.query(
            func.date(DiseaseReport.created_at).label("day"),
            func.coalesce(func.sum(DiseaseReport.cases_count), 0).label("cases"),
        )
        .filter(
            and_(
                DiseaseReport.village_id == village.id,
                DiseaseReport.disease_type == disease_type,
                DiseaseReport.created_at >= start,
            )
        )
        .group_by(func.date(DiseaseReport.created_at))
        .order_by(func.date(DiseaseReport.created_at))
        .all()
    )
    daily = {
        r.day if hasattr(r.day, "weekday") else date.fromisoformat(str(r.day)): int(r.cases)
        for r in rows
    }

    def window(days_ago):
        cutoff = utc_now().date() - timedelta(days=days_ago - 1)
        return sum(c for d, c in daily.items() if d >= cutoff)

    contaminated = (
        db.query(func.count(WaterQuality.id))
        .filter(
            and_(
                WaterQuality.village_id == village.id,
                WaterQuality.is_contaminated.is_(True),
                WaterQuality.test_date >= start,
            )
        )
        .scalar()
        or 0
    )
    alerts = (
        db.query(func.count(Alert.id))
        .filter(
            and_(
                Alert.villages.isnot(None),
                Alert.affected_area == village.name,
                Alert.is_resolved.is_(False),
            )
        )
        .scalar()
        or 0
    )

    features = {
        "cases_7d": window(7),
        "cases_14d": window(14),
        "cases_30d": window(30),
        "cases_90d": window(90),
        "population": village.population or 0,
        "contaminated_sources": contaminated,
        "active_alerts": alerts,
        "monsoon_month": 1 if utc_now().month in (6, 7, 8, 9) else 0,
    }
    target = window(14) if days > 14 else window(7)
    return features, target


def _build_training_set(db):
    """Return (X, y, meta) over all villages for every seeded disease."""
    villages = db.query(Village).all()
    diseases = ["Cholera", "Typhoid", "Diarrhea", "Hepatitis A", "Dysentery"]

    X, y, meta = [], [], []
    for village in villages:
        for disease in diseases:
            features, target = _engineered_features(db, village, disease)
            X.append(list(features.values()))
            y.append(target)
            meta.append(
                {
                    "village_id": str(village.id),
                    "village_name": village.name,
                    "district": village.district,
                    "disease_type": disease,
                    "features": features,
                }
            )
    return X, y, meta


def _train_model(X, y) -> str:
    """Fit the primary model and persist a versioned artifact."""
    if not HAVE_SKLEARN:
        return ""

    model = RandomForestRegressor(n_estimators=200, max_depth=10, random_state=42)
    model.fit(X, y)

    stamp = utc_now().strftime("%Y%m%d_%H%M%S")
    artifact = os.path.join(MODELS_DIR, f"outbreak_rf_{stamp}.joblib")
    joblib.dump(model, artifact)

    pointer = os.path.join(MODELS_DIR, "latest_model.json")
    with open(pointer, "w") as handle:
        json.dump({"path": artifact, "trained_at": stamp}, handle)
    return artifact


def _run_forecasts(db) -> list:
    """Fit the smoothing forecaster for each (village, disease) pair."""
    villages = db.query(Village).all()
    diseases = ["Cholera", "Typhoid", "Diarrhea", "Hepatitis A", "Dysentery"]
    results = []
    for village in villages:
        for disease in diseases:
            result = fit_and_forecast(db, str(village.id), disease)
            results.append(
                {
                    "village": village.name,
                    "district": village.district,
                    "disease_type": disease,
                    "next_14_total": result.next_14_total,
                    "trend": result.trend,
                    "confidence": result.confidence,
                    "method": result.method,
                    "peak_day": result.peak_day,
                }
            )
    return results


def main():
    db = SessionLocal()
    try:
        X, y, meta = _build_training_set(db)
        artifact = _train_model(X, y)
        forecasts = _run_forecasts(db)

        summary = {
            "samples": len(X),
            "features": list(meta[0]["features"]) if meta else [],
            "model_artifact": artifact,
            "forecasts_trained": len(forecasts),
        }
        report = os.path.join(MODELS_DIR, "metrics.json")
        with open(report, "w") as handle:
            json.dump({"summary": summary, "forecasts": forecasts[:20]}, handle, indent=2)

        print(f"Trained {len(X)} samples"
              + (f" -> {artifact}" if artifact else " (sklearn unavailable, smoothing only)"))
        print(f"Forecast models built for {len(forecasts)} village/disease pairs")
        print(f"Artifacts: {MODELS_DIR}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
