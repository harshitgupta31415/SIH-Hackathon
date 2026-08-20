from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.models import WaterQuality, User, UserRole, Village
from app.schemas.schemas import WaterQualityCreate, WaterQualityResponse
from app.middleware.auth import require_role
from app.services.health_service import WaterQualityService

router = APIRouter(prefix="/api/water-quality", tags=["Water Quality"])


@router.post("", response_model=WaterQualityResponse, status_code=201)
def create_water_quality(
    data: WaterQualityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ASHA_WORKER, UserRole.BLOCK_OFFICER)),
):
    village = db.query(Village).filter(Village.id == data.village_id).first()
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    if village.district != current_user.district:
        raise HTTPException(status_code=403, detail="Not authorized to submit a test for another district")
    record = WaterQualityService.create_record(db, data, current_user.id)
    return WaterQualityResponse.model_validate(record)


@router.get("", response_model=list[WaterQualityResponse])
def list_water_quality(
    village_id: Optional[UUID] = None,
    is_contaminated: Optional[bool] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.ASHA_WORKER, UserRole.BLOCK_OFFICER, UserRole.DISTRICT_ADMIN
    )),
):
    query = db.query(WaterQuality)

    query = query.join(Village).filter(Village.district == current_user.district)

    if village_id:
        query = query.filter(WaterQuality.village_id == village_id)
    if is_contaminated is not None:
        query = query.filter(WaterQuality.is_contaminated == is_contaminated)

    records = (
        query.order_by(desc(WaterQuality.test_date))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [WaterQualityResponse.model_validate(r) for r in records]
