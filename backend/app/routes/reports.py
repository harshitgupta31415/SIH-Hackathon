from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.models import DiseaseReport, User, UserRole, ReportStatus, Village
from app.schemas.schemas import ReportCreate, ReportUpdate, ReportResponse
from app.middleware.auth import get_current_user, require_role
from app.services.health_service import HealthService

router = APIRouter(prefix="/api/reports", tags=["Disease Reports"])


@router.post("", response_model=ReportResponse, status_code=201)
def create_report(
    data: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.VOLUNTEER, UserRole.ASHA_WORKER)),
):
    report = HealthService.create_report(db, data, current_user.id)
    return ReportResponse.model_validate(report)


@router.get("", response_model=list[ReportResponse])
def list_reports(
    district: Optional[str] = None,
    status: Optional[ReportStatus] = None,
    disease_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(DiseaseReport)

    if district:
        query = query.join(Village).filter(Village.district == district)
    if status:
        query = query.filter(DiseaseReport.status == status)
    if disease_type:
        query = query.filter(DiseaseReport.disease_type == disease_type)

    if current_user.role == UserRole.VOLUNTEER:
        query = query.filter(DiseaseReport.reporter_id == current_user.id)

    reports = (
        query.order_by(desc(DiseaseReport.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [ReportResponse.model_validate(r) for r in reports]


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(DiseaseReport).filter(DiseaseReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user.role == UserRole.VOLUNTEER and report.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this report")
    if current_user.role != UserRole.VOLUNTEER and report.village.district != current_user.district:
        raise HTTPException(status_code=403, detail="Not authorized to view reports outside your district")
    return ReportResponse.model_validate(report)


@router.put("/{report_id}/status", response_model=ReportResponse)
def update_report_status(
    report_id: UUID,
    data: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASHA_WORKER, UserRole.BLOCK_OFFICER, UserRole.DISTRICT_ADMIN)),
):
    report = db.query(DiseaseReport).filter(DiseaseReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.village.district != current_user.district:
        raise HTTPException(status_code=403, detail="Not authorized to update reports outside your district")

    if data.status:
        report.status = data.status
        report.verified_by = current_user.id
        report.verified_at = __import__("datetime").datetime.utcnow()
    if data.notes:
        report.notes = data.notes

    db.commit()
    db.refresh(report)
    return ReportResponse.model_validate(report)
