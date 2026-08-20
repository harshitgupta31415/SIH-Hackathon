from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator
from enum import Enum


class UserRoleEnum(str, Enum):
    VOLUNTEER = "volunteer"
    ASHA_WORKER = "asha_worker"
    BLOCK_OFFICER = "block_officer"
    DISTRICT_ADMIN = "district_admin"


class ReportStatusEnum(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    RESOLVED = "resolved"


class AlertSeverityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class WaterSourceEnum(str, Enum):
    WELL = "well"
    RIVER = "river"
    TAP = "tap"
    POND = "pond"
    RAINWATER = "rainwater"
    OTHER = "other"


# ── Auth Schemas ──────────────────────────────────────────

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(..., min_length=8)
    village: Optional[str] = None
    block: Optional[str] = None
    district: str
    state: str = "Assam"

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str]
    role: UserRoleEnum
    village: Optional[str]
    block: Optional[str]
    district: str
    state: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Report Schemas ────────────────────────────────────────

class ReportCreate(BaseModel):
    village_id: UUID
    disease_type: str = Field(..., max_length=100)
    symptoms: list[str]
    cases_count: int = Field(..., ge=1, le=500)
    severity: str = "moderate"
    water_source: Optional[WaterSourceEnum] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    latitude: float
    longitude: float


class ReportUpdate(BaseModel):
    status: Optional[ReportStatusEnum] = None
    notes: Optional[str] = None


class ReportResponse(BaseModel):
    id: UUID
    reporter_id: UUID
    village_id: UUID
    disease_type: str
    symptoms: list
    cases_count: int
    severity: str
    water_source: Optional[WaterSourceEnum]
    notes: Optional[str]
    photo_url: Optional[str]
    latitude: float
    longitude: float
    status: ReportStatusEnum
    risk_score: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Water Quality Schemas ─────────────────────────────────

class WaterQualityCreate(BaseModel):
    village_id: UUID
    source_type: WaterSourceEnum
    ph_level: Optional[float] = Field(None, ge=0, le=14)
    turbidity: Optional[float] = Field(None, ge=0)
    coliform_count: Optional[int] = Field(None, ge=0)
    dissolved_oxygen: Optional[float] = Field(None, ge=0)
    nitrate_level: Optional[float] = Field(None, ge=0)
    chlorine_residual: Optional[float] = Field(None, ge=0)
    test_date: datetime
    latitude: float
    longitude: float
    notes: Optional[str] = None


class WaterQualityResponse(BaseModel):
    id: UUID
    village_id: UUID
    source_type: WaterSourceEnum
    ph_level: Optional[float]
    turbidity: Optional[float]
    coliform_count: Optional[int]
    is_contaminated: bool
    test_date: datetime
    latitude: float
    longitude: float
    created_at: datetime

    class Config:
        from_attributes = True


class VillageResponse(BaseModel):
    id: UUID
    name: str
    block: str
    district: str
    state: str
    latitude: float
    longitude: float

    class Config:
        from_attributes = True


class ReverseLocationResponse(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    nearest_village: Optional[VillageResponse] = None


# ── Alert Schemas ─────────────────────────────────────────

class AlertCreate(BaseModel):
    title: str = Field(..., max_length=200)
    message: str
    severity: AlertSeverityEnum
    affected_area: str
    district: str
    block: Optional[str] = None
    villages: Optional[list[str]] = None
    predicted_cases: Optional[int] = None
    recommended_action: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: float = 10.0


class AlertResponse(BaseModel):
    id: UUID
    title: str
    message: str
    severity: AlertSeverityEnum
    affected_area: str
    district: str
    is_resolved: bool
    predicted_cases: Optional[int]
    recommended_action: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Dashboard Schemas ─────────────────────────────────────

class DashboardSummary(BaseModel):
    total_reports_today: int
    total_reports_week: int
    active_alerts: int
    verified_cases: int
    districts_affected: int
    villages_monitored: int
    risk_level: str
    top_diseases: list[dict]


class DistrictData(BaseModel):
    district: str
    total_cases: int
    active_cases: int
    risk_score: float
    water_quality_index: float
    alerts_count: int
    villages_affected: list[str]


class RiskMapData(BaseModel):
    latitude: float
    longitude: float
    risk_score: float
    cases_count: int
    village_name: str
    district: str


class PredictionResponse(BaseModel):
    district: str
    disease_type: str
    predicted_cases: float
    confidence: float
    risk_level: str
    prediction_date: datetime
    valid_until: datetime
    factors: Optional[dict]


# ── Role Upgrade Schemas ─────────────────────────────────

class UpgradeRequestStatusEnum(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RoleUpgradeRequestCreate(BaseModel):
    requested_role: UserRoleEnum
    justification: str = Field(..., min_length=10, max_length=500)


class RoleUpgradeRequestResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    current_role: UserRoleEnum
    requested_role: UserRoleEnum
    justification: str
    status: UpgradeRequestStatusEnum
    review_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RoleUpgradeReview(BaseModel):
    status: UpgradeRequestStatusEnum
    review_notes: Optional[str] = None
