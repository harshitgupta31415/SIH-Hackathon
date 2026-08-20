import enum
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.time_utils import utc_now


class UserRole(str, enum.Enum):
    VOLUNTEER = "volunteer"
    ASHA_WORKER = "asha_worker"
    BLOCK_OFFICER = "block_officer"
    DISTRICT_ADMIN = "district_admin"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    RESOLVED = "resolved"


class AlertSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class WaterSourceType(str, enum.Enum):
    WELL = "well"
    RIVER = "river"
    TAP = "tap"
    POND = "pond"
    RAINWATER = "rainwater"
    OTHER = "other"


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(15), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.VOLUNTEER)
    village = Column(String(100), nullable=True)
    block = Column(String(100), nullable=True)
    district = Column(String(100), nullable=False)
    state = Column(String(50), nullable=False, default="Assam")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    reports = relationship(
        "DiseaseReport",
        foreign_keys="DiseaseReport.reporter_id",
        back_populates="reporter",
    )
    alerts = relationship(
        "Alert",
        foreign_keys="Alert.issued_by",
        back_populates="issuer",
    )


class Village(Base):
    __tablename__ = "villages"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    block = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    state = Column(String(50), nullable=False, default="Assam")
    population = Column(Integer, default=0)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    nearest_health_center = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=utc_now)


class DiseaseReport(Base):
    __tablename__ = "disease_reports"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    village_id = Column(Uuid(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    disease_type = Column(String(100), nullable=False)
    symptoms = Column(JSON, nullable=False)
    cases_count = Column(Integer, nullable=False, default=1)
    severity = Column(String(20), default="moderate")
    water_source = Column(Enum(WaterSourceType), nullable=True)
    notes = Column(Text, nullable=True)
    photo_url = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    verified_by = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reports")
    village = relationship("Village")
    verifier = relationship("User", foreign_keys=[verified_by])


class WaterQuality(Base):
    __tablename__ = "water_quality"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    village_id = Column(Uuid(as_uuid=True), ForeignKey("villages.id"), nullable=False)
    tested_by = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    source_type = Column(Enum(WaterSourceType), nullable=False)
    ph_level = Column(Float, nullable=True)
    turbidity = Column(Float, nullable=True)
    coliform_count = Column(Integer, nullable=True)
    dissolved_oxygen = Column(Float, nullable=True)
    nitrate_level = Column(Float, nullable=True)
    chlorine_residual = Column(Float, nullable=True)
    is_contaminated = Column(Boolean, default=False)
    test_date = Column(DateTime, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    village = relationship("Village")
    tester = relationship("User")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(Enum(AlertSeverity), nullable=False)
    affected_area = Column(String(200), nullable=False)
    district = Column(String(100), nullable=False)
    block = Column(String(100), nullable=True)
    villages = Column(JSON, nullable=True)
    predicted_cases = Column(Integer, nullable=True)
    recommended_action = Column(Text, nullable=True)
    issued_by = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_km = Column(Float, default=10.0)
    created_at = Column(DateTime, default=utc_now)

    issuer = relationship("User", foreign_keys=[issued_by], back_populates="alerts")
    resolver = relationship("User", foreign_keys=[resolved_by])


class UpgradeRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RoleUpgradeRequest(Base):
    __tablename__ = "role_upgrade_requests"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    current_role = Column(Enum(UserRole), nullable=False)
    requested_role = Column(Enum(UserRole), nullable=False)
    justification = Column(Text, nullable=False)
    status = Column(Enum(UpgradeRequestStatus), default=UpgradeRequestStatus.PENDING)
    reviewed_by = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class OutbreakPrediction(Base):
    __tablename__ = "outbreak_predictions"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    district = Column(String(100), nullable=False)
    block = Column(String(100), nullable=True)
    village_id = Column(Uuid(as_uuid=True), ForeignKey("villages.id"), nullable=True)
    disease_type = Column(String(100), nullable=False)
    predicted_cases = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    prediction_date = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=False)
    factors = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    village = relationship("Village")
