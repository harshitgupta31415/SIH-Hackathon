from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user, require_role
from app.ml.predictor import MLPredictor
from app.models.models import User, UserRole, Village
from app.schemas.schemas import canonical_disease_name
from app.services.health_service import HealthService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_summary(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if district and district != current_user.district:
        raise HTTPException(status_code=403, detail="Not authorized to view another district")
    return HealthService.get_dashboard_summary(db, district or current_user.district)


@router.get("/risk-map")
def get_risk_map(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if district and district != current_user.district:
        raise HTTPException(status_code=403, detail="Not authorized to view another district")
    return HealthService.get_risk_map_data(db, district or current_user.district)


@router.get("/predictions/{district}/{disease_type}")
def get_prediction(
    district: str,
    disease_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BLOCK_OFFICER, UserRole.DISTRICT_ADMIN)),
):
    if district != current_user.district:
        raise HTTPException(status_code=403, detail="Not authorized to view another district")
    prediction = MLPredictor.predict_outbreak(db, district, canonical_disease_name(disease_type))
    MLPredictor.save_prediction(db, prediction)
    return prediction


@router.get("/trends/{village_id}/{disease_type}")
def get_trends(
    village_id: UUID,
    disease_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    if village.district != current_user.district:
        raise HTTPException(status_code=403, detail="Not authorized to view another district")
    return MLPredictor.calculate_trend(db, village_id, disease_type)
