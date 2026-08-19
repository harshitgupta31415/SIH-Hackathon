from uuid import UUID
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.models import Alert, User, UserRole
from app.schemas.schemas import AlertCreate, AlertResponse
from app.middleware.auth import require_role

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.post("", response_model=AlertResponse, status_code=201)
def create_alert(
    data: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BLOCK_OFFICER, UserRole.DISTRICT_ADMIN)),
):
    alert = Alert(
        issued_by=current_user.id,
        **data.model_dump()
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    district: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.ASHA_WORKER, UserRole.BLOCK_OFFICER, UserRole.DISTRICT_ADMIN
    )),
):
    query = db.query(Alert)

    if district:
        query = query.filter(Alert.district == district)
    if is_resolved is not None:
        query = query.filter(Alert.is_resolved == is_resolved)
    if severity:
        query = query.filter(Alert.severity == severity)

    alerts = (
        query.order_by(desc(Alert.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [AlertResponse.model_validate(a) for a in alerts]


@router.put("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.BLOCK_OFFICER, UserRole.DISTRICT_ADMIN)),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = current_user.id
    db.commit()
    db.refresh(alert)
    return AlertResponse.model_validate(alert)
