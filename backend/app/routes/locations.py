from math import asin, cos, radians, sin, sqrt

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User, Village
from app.schemas.schemas import ReverseLocationResponse, VillageResponse

router = APIRouter(prefix="/api/locations", tags=["Locations"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
MAX_NEAREST_VILLAGE_DISTANCE_KM = 25


def distance_km(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    """Return the great-circle distance between two coordinates."""
    radius_km = 6371.0
    latitude_delta = radians(latitude_b - latitude_a)
    longitude_delta = radians(longitude_b - longitude_a)
    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(radians(latitude_a)) * cos(radians(latitude_b)) * sin(longitude_delta / 2) ** 2
    )
    return 2 * radius_km * asin(sqrt(haversine))


@router.get("/reverse", response_model=ReverseLocationResponse)
async def reverse_location(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve an opted-in device location and suggest a monitored village."""
    address = None
    try:
        async with httpx.AsyncClient(timeout=5.0, headers={"User-Agent": "JJS/1.0"}) as client:
            response = await client.get(
                NOMINATIM_URL,
                params={"lat": latitude, "lon": longitude, "format": "jsonv2", "addressdetails": 1},
            )
            response.raise_for_status()
            address = response.json().get("display_name")
    except (httpx.HTTPError, ValueError):
        # Reporting should still work when reverse geocoding is unavailable.
        pass

    villages = db.query(Village).filter(Village.district == current_user.district).all()
    nearest_village = None
    nearest_distance = None
    for village in villages:
        candidate_distance = distance_km(latitude, longitude, village.latitude, village.longitude)
        if nearest_distance is None or candidate_distance < nearest_distance:
            nearest_village = village
            nearest_distance = candidate_distance

    if nearest_distance is not None and nearest_distance > MAX_NEAREST_VILLAGE_DISTANCE_KM:
        nearest_village = None

    return ReverseLocationResponse(
        latitude=latitude,
        longitude=longitude,
        address=address,
        nearest_village=VillageResponse.model_validate(nearest_village) if nearest_village else None,
    )
