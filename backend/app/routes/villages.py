from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User, Village
from app.schemas.schemas import VillageResponse

router = APIRouter(prefix="/api/villages", tags=["Villages"])


@router.get("", response_model=list[VillageResponse])
def list_villages(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Village)
    # Community users should only be able to submit data for their district.
    allowed_district = current_user.district
    if district and district != allowed_district:
        raise HTTPException(status_code=403, detail="Not authorized to view villages outside your district")
    query = query.filter(Village.district == (district or allowed_district))
    return query.order_by(Village.name).all()
