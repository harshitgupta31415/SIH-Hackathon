import sys
from datetime import timedelta

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.middleware.auth import hash_password
from app.models.models import (
    Alert,
    AlertSeverity,
    DiseaseReport,
    ReportStatus,
    User,
    UserRole,
    Village,
    WaterQuality,
    WaterSourceType,
)
from app.time_utils import utc_now

if get_settings().RESET_DATABASE:
    Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

if db.query(User).first():
    db.close()
    print("Database already contains data; skipping seed. Set RESET_DATABASE=true to replace development data.")
    sys.exit(0)

# Create admin user
admin = User(
    name="District Admin",
    email="admin@healthwatch.gov.in",
    phone="9876543210",
    password_hash=hash_password("admin123"),
    role=UserRole.DISTRICT_ADMIN,
    district="Kamrup",
    state="Assam",
)
db.add(admin)

# Create ASHA worker
worker = User(
    name="Priya Das",
    email="priya@healthwatch.gov.in",
    phone="9876543211",
    password_hash=hash_password("worker123"),
    role=UserRole.ASHA_WORKER,
    village="Sonapur",
    block="Sonapur",
    district="Kamrup",
    state="Assam",
)
db.add(worker)

# Create block officer
block_officer = User(
    name="Arup Jyoti Kalita",
    email="arup@healthwatch.gov.in",
    phone="9876543213",
    password_hash=hash_password("officer123"),
    role=UserRole.BLOCK_OFFICER,
    block="Sonapur",
    district="Kamrup",
    state="Assam",
)
db.add(block_officer)

# Create volunteer
volunteer = User(
    name="Rahul Borgohain",
    email="rahul@healthwatch.gov.in",
    phone="9876543212",
    password_hash=hash_password("volunteer123"),
    role=UserRole.VOLUNTEER,
    village="Jorabat",
    block="Dispur",
    district="Kamrup",
    state="Assam",
)
db.add(volunteer)

db.flush()

# Create villages
villages_data = [
    ("Sonapur", "Sonapur", "Kamrup", 26.1445, 91.7362, 3500),
    ("Jorabat", "Dispur", "Kamrup", 26.1585, 91.7932, 2800),
    ("Palasbari", "Palasbari", "Kamrup", 26.2455, 91.6452, 4200),
    ("Hajo", "Hajo", "Kamrup", 26.2225, 91.5282, 5100),
    ("Rangiya", "Rangiya", "Kamrup", 26.4435, 91.6112, 3800),
    ("Nalbari", "Nalbari", "Nalbari", 26.4485, 91.4412, 6200),
    ("Mangaldoi", "Mangaldoi", "Darrang", 26.4285, 92.0272, 4500),
    ("Tezpur", "Tezpur", "Sonitpur", 26.6525, 92.7922, 8900),
]

villages = []
for v in villages_data:
    village = Village(
        name=v[0], block=v[1], district=v[2],
        latitude=v[3], longitude=v[4], population=v[5],
    )
    db.add(village)
    villages.append(village)

db.flush()

# Create sample reports
diseases = ["Cholera", "Typhoid", "Diarrhea", "Hepatitis A", "Dysentery"]
symptoms_map = {
    "Cholera": ["diarrhea", "vomiting"],
    "Typhoid": ["fever", "diarrhea"],
    "Diarrhea": ["diarrhea", "vomiting"],
    "Hepatitis A": ["fever", "hepatitis"],
    "Dysentery": ["diarrhea", "fever"],
}

reports = []
for i in range(30):
    days_ago = 30 - i
    for _ in range(max(1, 5 - i // 7)):
        village = villages[i % len(villages)]
        disease = diseases[i % len(diseases)]
        report = DiseaseReport(
            reporter_id=volunteer.id,
            village_id=village.id,
            disease_type=disease,
            symptoms=symptoms_map[disease],
            cases_count=max(1, (i % 5) + 1),
            severity=["mild", "moderate", "severe"][i % 3],
            water_source=[WaterSourceType.WELL, WaterSourceType.RIVER, WaterSourceType.TAP][i % 3],
            latitude=village.latitude + (i * 0.001),
            longitude=village.longitude + (i * 0.001),
            status=[ReportStatus.PENDING, ReportStatus.VERIFIED][i % 2],
            risk_score=min(100, (i % 6) * 15 + 10),
            created_at=utc_now() - timedelta(days=days_ago, hours=i),
        )
        db.add(report)
        reports.append(report)

db.flush()

# Create sample water quality records
for i, village in enumerate(villages[:4]):
    wq = WaterQuality(
        village_id=village.id,
        tested_by=worker.id,
        source_type=WaterSourceType.WELL,
        ph_level=6.5 + (i * 0.5),
        turbidity=2.0 + (i * 3),
        coliform_count=i * 15,
        is_contaminated=i > 1,
        test_date=utc_now() - timedelta(days=i),
        latitude=village.latitude,
        longitude=village.longitude,
    )
    db.add(wq)

# Create alerts
alerts_data = [
    ("High Cholera Risk in Sonapur", "Risk score 85/100. 12 cases reported in 3 days.", AlertSeverity.HIGH, "Sonapur"),
    ("Water Contamination Alert", "Well water in Jorabat shows high coliform count.", AlertSeverity.CRITICAL, "Jorabat"),
    ("Monitoring Required - Hajo", "Diarrhea cases trending upward. 8 cases this week.", AlertSeverity.MEDIUM, "Hajo"),
]

for title, msg, severity, area in alerts_data:
    alert = Alert(
        title=title,
        message=msg,
        severity=severity,
        affected_area=area,
        district="Kamrup",
        block="Sonapur",
        predicted_cases=25,
        recommended_action="Issue boil-water advisory. Increase surveillance.",
        issued_by=admin.id,
        latitude=26.1445,
        longitude=91.7362,
    )
    db.add(alert)

db.commit()
db.close()
print("Seed data created successfully!")
print("Admin:       admin@healthwatch.gov.in / admin123")
print("Worker:      priya@healthwatch.gov.in / worker123")
print("Volunteer:   rahul@healthwatch.gov.in / volunteer123")
print("Block Officer: arup@healthwatch.gov.in / officer123")
