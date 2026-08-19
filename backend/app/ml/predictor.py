from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import numpy as np

from app.models.models import DiseaseReport, WaterQuality, Village, OutbreakPrediction


class MLPredictor:
    @staticmethod
    def get_historical_data(db: Session, village_id: UUID, disease_type: str, days: int = 90):
        start_date = datetime.utcnow() - timedelta(days=days)
        reports = (
            db.query(
                func.date(DiseaseReport.created_at).label("date"),
                func.sum(DiseaseReport.cases_count).label("cases")
            )
            .filter(
                and_(
                    DiseaseReport.village_id == village_id,
                    DiseaseReport.disease_type == disease_type,
                    DiseaseReport.created_at >= start_date
                )
            )
            .group_by(func.date(DiseaseReport.created_at))
            .order_by(func.date(DiseaseReport.created_at))
            .all()
        )
        return reports

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
                    DiseaseReport.created_at >= recent_week
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
                    DiseaseReport.created_at < recent_week
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

        total_predicted = 0
        total_confidence = 0
        high_risk_villages = []
        factors = {}

        for village in villages:
            trend = MLPredictor.calculate_trend(db, village.id, disease_type)
            water_issues = (
                db.query(WaterQuality)
                .filter(
                    and_(
                        WaterQuality.village_id == village.id,
                        WaterQuality.is_contaminated == True
                    )
                )
                .count()
            )

            risk_factors = []
            if trend["trend"] == "increasing":
                risk_factors.append("increasing_cases")
            if water_issues > 0:
                risk_factors.append("water_contamination")
            if village.population and village.population > 1000:
                risk_factors.append("high_population")

            risk_score = min(
                (trend["change_percent"] / 100 * 40) +
                (water_issues / 3.0 * 30) +
                (min(trend["recent_week_cases"] / 10.0, 1.0) * 30),
                100
            )

            predicted = max(
                trend["recent_week_cases"] * (1 + trend["change_percent"] / 200),
                trend["recent_week_cases"]
            )

            total_predicted += predicted
            total_confidence += max(0.3, 1.0 - len(risk_factors) * 0.15)

            if risk_score >= 60:
                high_risk_villages.append({
                    "village": village.name,
                    "risk_score": round(risk_score, 1),
                    "factors": risk_factors,
                })

        num_villages = len(villages) if villages else 1
        avg_confidence = total_confidence / num_villages

        risk_level = "low"
        if total_predicted > 50 or len(high_risk_villages) > 3:
            risk_level = "critical"
        elif total_predicted > 30 or len(high_risk_villages) > 2:
            risk_level = "high"
        elif total_predicted > 15 or len(high_risk_villages) > 1:
            risk_level = "medium"

        factors = {
            "high_risk_villages": high_risk_villages,
            "total_villages_assessed": len(villages),
            "disease_type": disease_type,
            "district": district,
        }

        return {
            "district": district,
            "disease_type": disease_type,
            "predicted_cases": round(total_predicted, 1),
            "confidence": round(avg_confidence, 2),
            "risk_level": risk_level,
            "prediction_date": datetime.utcnow(),
            "valid_until": datetime.utcnow() + timedelta(days=14),
            "factors": factors,
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
