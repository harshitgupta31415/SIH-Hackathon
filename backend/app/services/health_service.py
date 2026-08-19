from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc

from app.models.models import (
    DiseaseReport, WaterQuality, Alert, User, Village,
    OutbreakPrediction, ReportStatus, AlertSeverity, UserRole
)
from app.schemas.schemas import (
    ReportCreate, WaterQualityCreate, AlertCreate
)


class HealthService:
    @staticmethod
    def calculate_risk_score(db: Session, village_id: UUID, disease_type: str) -> float:
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_reports = db.query(DiseaseReport).filter(
            and_(
                DiseaseReport.village_id == village_id,
                DiseaseReport.disease_type == disease_type,
                DiseaseReport.created_at >= week_ago,
                DiseaseReport.status != ReportStatus.REJECTED
            )
        ).all()

        if not recent_reports:
            return 0.0

        total_cases = sum(r.cases_count for r in recent_reports)
        report_count = len(recent_reports)

        contamination = db.query(WaterQuality).filter(
            and_(
                WaterQuality.village_id == village_id,
                WaterQuality.is_contaminated == True,
                WaterQuality.created_at >= week_ago
            )
        ).count()

        base_score = min(total_cases / 10.0, 1.0) * 40
        frequency_score = min(report_count / 5.0, 1.0) * 30
        contamination_score = min(contamination / 3.0, 1.0) * 30

        return round(base_score + frequency_score + contamination_score, 2)

    @staticmethod
    def create_report(db: Session, report_data: ReportCreate, reporter_id: UUID) -> DiseaseReport:
        village = db.query(Village).filter(Village.id == report_data.village_id).first()
        if not village:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Village not found")

        report = DiseaseReport(
            reporter_id=reporter_id,
            **report_data.model_dump()
        )

        # Include this report in the risk calculation before it is persisted.
        existing_score = HealthService.calculate_risk_score(db, report.village_id, report.disease_type)
        report.risk_score = min(100, existing_score + min(report.cases_count / 10.0, 1.0) * 40 + 6)

        db.add(report)
        db.commit()
        db.refresh(report)

        if report.risk_score >= 70:
            HealthService._auto_create_alert(db, report, report.risk_score)

        return report

    @staticmethod
    def _auto_create_alert(db: Session, report: DiseaseReport, risk_score: float):
        severity = AlertSeverity.LOW
        if risk_score >= 90:
            severity = AlertSeverity.CRITICAL
        elif risk_score >= 80:
            severity = AlertSeverity.HIGH
        elif risk_score >= 70:
            severity = AlertSeverity.MEDIUM

        village = db.query(Village).filter(Village.id == report.village_id).first()
        admin = db.query(User).filter(
            User.role == UserRole.DISTRICT_ADMIN,
            User.district == village.district
        ).first()

        if not admin:
            return

        alert = Alert(
            title=f"Outbreak Risk: {report.disease_type} in {village.name}",
            message=f"Risk score {risk_score}/100. {report.cases_count} cases reported.",
            severity=severity,
            affected_area=village.name,
            district=village.district,
            block=village.block,
            villages=[village.name],
            predicted_cases=report.cases_count * 2,
            recommended_action=HealthService._get_recommended_action(severity, report.disease_type),
            issued_by=admin.id,
            latitude=report.latitude,
            longitude=report.longitude,
        )
        db.add(alert)
        db.commit()

    @staticmethod
    def _get_recommended_action(severity: AlertSeverity, disease_type: str) -> str:
        actions = {
            AlertSeverity.CRITICAL: f"Immediate isolation and treatment. Deploy medical team. Boil water advisory for all sources.",
            AlertSeverity.HIGH: f"Issue boil-water advisory. Increase surveillance. Prepare isolation facilities.",
            AlertSeverity.MEDIUM: f"Monitor cases closely. Test water sources. Distribute ORS packets.",
            AlertSeverity.LOW: f"Continue monitoring. Educate community on hygiene practices.",
        }
        return actions.get(severity, "Monitor the situation.")

    @staticmethod
    def get_dashboard_summary(db: Session, district: str = None):
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = datetime.utcnow() - timedelta(days=7)

        query = db.query(DiseaseReport)
        if district:
            query = query.join(Village).filter(Village.district == district)

        reports_today = query.filter(DiseaseReport.created_at >= today).count()
        reports_week = query.filter(DiseaseReport.created_at >= week_ago).count()
        verified = query.filter(DiseaseReport.status == ReportStatus.VERIFIED).count()

        alert_query = db.query(Alert).filter(Alert.is_resolved == False)
        if district:
            alert_query = alert_query.filter(Alert.district == district)
        active_alerts = alert_query.count()

        district_query = db.query(func.count(func.distinct(Village.district)))
        if district:
            district_query = district_query.filter(Village.district == district)
        districts_affected = district_query.scalar()

        village_count = db.query(func.count(Village.id))
        if district:
            village_count = village_count.filter(Village.district == district)
        villages_monitored = village_count.scalar()

        top_diseases = (
            db.query(DiseaseReport.disease_type, func.sum(DiseaseReport.cases_count).label("total"))
            .filter(DiseaseReport.created_at >= week_ago)
            .group_by(DiseaseReport.disease_type)
            .order_by(desc("total"))
            .limit(5)
            .all()
        )

        return {
            "total_reports_today": reports_today,
            "total_reports_week": reports_week,
            "active_alerts": active_alerts,
            "verified_cases": verified,
            "districts_affected": districts_affected,
            "villages_monitored": villages_monitored,
            "risk_level": "HIGH" if active_alerts > 5 else "MEDIUM" if active_alerts > 2 else "LOW",
            "top_diseases": [{"disease": d[0], "cases": d[1]} for d in top_diseases],
        }

    @staticmethod
    def get_risk_map_data(db: Session, district: str = None):
        week_ago = datetime.utcnow() - timedelta(days=7)

        query = (
            db.query(
                Village.name.label("village_name"),
                Village.district,
                Village.latitude,
                Village.longitude,
                func.coalesce(func.sum(DiseaseReport.cases_count), 0).label("cases_count"),
            )
            .outerjoin(DiseaseReport, and_(
                DiseaseReport.village_id == Village.id,
                DiseaseReport.created_at >= week_ago
            ))
        )

        if district:
            query = query.filter(Village.district == district)

        results = (
            query.group_by(Village.id, Village.name, Village.district, Village.latitude, Village.longitude)
            .all()
        )

        map_data = []
        for r in results:
            risk_score = min(r.cases_count / 10.0, 1.0) * 100 if r.cases_count else 0
            map_data.append({
                "latitude": r.latitude,
                "longitude": r.longitude,
                "risk_score": round(risk_score, 1),
                "cases_count": r.cases_count,
                "village_name": r.village_name,
                "district": r.district,
            })

        return map_data


class WaterQualityService:
    @staticmethod
    def assess_contamination(data: WaterQualityCreate) -> bool:
        is_contaminated = False
        if data.ph_level is not None and (data.ph_level < 6.5 or data.ph_level > 8.5):
            is_contaminated = True
        if data.coliform_count is not None and data.coliform_count > 10:
            is_contaminated = True
        if data.turbidity is not None and data.turbidity > 5.0:
            is_contaminated = True
        return is_contaminated

    @staticmethod
    def create_record(db: Session, data: WaterQualityCreate, tested_by: UUID) -> WaterQuality:
        village = db.query(Village).filter(Village.id == data.village_id).first()
        if not village:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Village not found")
        is_contaminated = WaterQualityService.assess_contamination(data)
        record = WaterQuality(
            tested_by=tested_by,
            is_contaminated=is_contaminated,
            **data.model_dump()
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
