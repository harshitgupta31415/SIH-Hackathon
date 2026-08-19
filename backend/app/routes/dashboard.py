from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, UserRole
from app.middleware.auth import get_current_user, require_role
from app.services.health_service import HealthService
from app.ml.predictor import MLPredictor

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_summary(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return HealthService.get_dashboard_summary(db, district)


@router.get("/risk-map")
def get_risk_map(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return HealthService.get_risk_map_data(db, district)


@router.get("/predictions/{district}/{disease_type}")
def get_prediction(
    district: str,
    disease_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BLOCK_OFFICER, UserRole.DISTRICT_ADMIN)),
):
    prediction = MLPredictor.predict_outbreak(db, district, disease_type)
    MLPredictor.save_prediction(db, prediction)
    return prediction


@router.get("/trends/{village_id}/{disease_type}")
def get_trends(
    village_id: str,
    disease_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from uuid import UUID
    return MLPredictor.calculate_trend(db, UUID(village_id), disease_type)
