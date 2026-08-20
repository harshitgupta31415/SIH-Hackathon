"""End-to-end API smoke test, runnable with Python or pytest."""

import atexit
import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path

handle, database_path = tempfile.mkstemp(suffix=".db")
os.close(handle)
os.environ["DATABASE_URL"] = f"sqlite:///{database_path}"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["CACHE_ENABLED"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app.database import Base, SessionLocal, engine
from app.main import app
from app.middleware.auth import hash_password
from app.models.models import (
    Alert,
    AlertSeverity,
    DiseaseReport,
    User,
    UserRole,
    Village,
    WaterQuality,
    WaterSourceType,
)
from app.time_utils import utc_now
from fastapi.testclient import TestClient


def _cleanup_database() -> None:
    engine.dispose()
    Path(database_path).unlink(missing_ok=True)


atexit.register(_cleanup_database)


def _seed_database() -> dict[str, int]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        admin = User(
            name="Admin", email="admin@test.com", password_hash=hash_password("testpass123"),
            role=UserRole.DISTRICT_ADMIN, district="Kamrup", state="Assam", phone="9999999999",
        )
        worker = User(
            name="Worker", email="worker@test.com", password_hash=hash_password("testpass123"),
            role=UserRole.ASHA_WORKER, village="Sonapur", block="Sonapur",
            district="Kamrup", state="Assam", phone="9999999998",
        )
        volunteer = User(
            name="Volunteer", email="vol@test.com", password_hash=hash_password("testpass123"),
            role=UserRole.VOLUNTEER, village="Jorabat", block="Dispur",
            district="Kamrup", state="Assam", phone="9999999997",
        )
        db.add_all([admin, worker, volunteer])
        db.flush()

        sonapur = Village(
            name="Sonapur", block="Sonapur", district="Kamrup", latitude=26.1445,
            longitude=91.7362, population=3500,
        )
        jorabat = Village(
            name="Jorabat", block="Dispur", district="Kamrup", latitude=26.1585,
            longitude=91.7932, population=2800,
        )
        db.add_all([sonapur, jorabat])
        db.flush()

        for index in range(20):
            for disease in ("Cholera", "Typhoid", "Diarrhea"):
                db.add(DiseaseReport(
                    reporter_id=volunteer.id,
                    village_id=sonapur.id if index % 2 == 0 else jorabat.id,
                    disease_type=disease,
                    symptoms=["diarrhea", "fever"],
                    cases_count=(index % 5) + 1,
                    severity="moderate",
                    water_source=WaterSourceType.WELL,
                    latitude=26.14,
                    longitude=91.73,
                    risk_score=min(100, index * 5 + 10),
                    created_at=utc_now() - timedelta(days=20 - index),
                ))

        db.add(WaterQuality(
            village_id=sonapur.id,
            tested_by=worker.id,
            source_type=WaterSourceType.WELL,
            ph_level=7.2,
            coliform_count=25,
            is_contaminated=True,
            test_date=utc_now(),
            latitude=sonapur.latitude,
            longitude=sonapur.longitude,
        ))
        db.add(Alert(
            title="High Risk",
            message="Cholera risk in Sonapur",
            severity=AlertSeverity.HIGH,
            affected_area="Sonapur",
            district="Kamrup",
            issued_by=admin.id,
            latitude=sonapur.latitude,
            longitude=sonapur.longitude,
        ))
        db.commit()

        return {
            "users": db.query(User).count(),
            "reports": db.query(DiseaseReport).count(),
            "alerts": db.query(Alert).count(),
        }


def run_smoke() -> None:
    counts = _seed_database()
    print(f"Seed OK: {counts['users']} users, {counts['reports']} reports, {counts['alerts']} alerts")

    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["cache"]["backend"] == "disabled"
        assert client.get("/api/ready").status_code == 200
        print("1. health/readiness: 200")

        admin_login = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "testpass123"})
        assert admin_login.status_code == 200
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        print("2. login:            200")

        volunteer_login = client.post("/api/auth/login", json={"email": "vol@test.com", "password": "testpass123"})
        assert volunteer_login.status_code == 200
        volunteer_headers = {"Authorization": f"Bearer {volunteer_login.json()['access_token']}"}

        summary = client.get("/api/dashboard/summary", headers=admin_headers)
        assert summary.status_code == 200 and summary.json()["total_reports_week"] > 0
        print("3. dashboard summary: 200")

        risk_map = client.get("/api/dashboard/risk-map", headers=admin_headers)
        assert risk_map.status_code == 200 and len(risk_map.json()) == 2
        print("4. risk map:          200")

        alerts = client.get("/api/alerts", headers=admin_headers)
        assert alerts.status_code == 200 and len(alerts.json()) == 1
        print("5. alerts:            200")

        reports = client.get("/api/reports", headers=admin_headers)
        assert reports.status_code == 200 and len(reports.json()) == 50
        print("6. reports:           200")

        villages = client.get("/api/villages", headers=admin_headers)
        assert villages.status_code == 200 and len(villages.json()) == 2
        print("7. villages:          200")

        water = client.get("/api/water-quality", headers=admin_headers)
        assert water.status_code == 200 and len(water.json()) == 1
        print("8. water quality:     200")

        prediction = client.get("/api/dashboard/predictions/Kamrup/diarrhea", headers=admin_headers)
        assert prediction.status_code == 200
        assert prediction.json()["disease_type"] == "Diarrhea"
        assert prediction.json()["predicted_cases"] > 0
        assert prediction.json()["explanation"]["horizon_days"] == 14
        print("9. prediction:        200")

        upgrade = client.post("/api/auth/request-upgrade", json={
            "requested_role": "asha_worker",
            "justification": "I completed ASHA training and need report verification access.",
        }, headers=volunteer_headers)
        assert upgrade.status_code == 201
        request_id = upgrade.json()["id"]
        print("10. request upgrade:  201")

        own_upgrade = client.get("/api/auth/my-upgrade-request", headers=volunteer_headers)
        assert own_upgrade.status_code == 200 and own_upgrade.json()["status"] == "pending"
        print("11. own request:      200")

        upgrades = client.get("/api/auth/upgrade-requests", headers=admin_headers)
        assert upgrades.status_code == 200 and len(upgrades.json()) == 1
        print("12. list requests:    200")

        approval = client.put(f"/api/auth/upgrade-requests/{request_id}", json={
            "status": "approved", "review_notes": "Training verified.",
        }, headers=admin_headers)
        assert approval.status_code == 200 and approval.json()["status"] == "approved"
        print("13. approve request:  200")

        registration = client.post("/api/auth/register", json={
            "name": "New User", "email": "new.user@example.com", "phone": "9999999996",
            "password": "testpass123", "district": "Kamrup", "state": "Assam",
        })
        assert registration.status_code == 201
        duplicate = client.post("/api/auth/register", json={
            "name": "Duplicate User", "email": "NEW.USER@EXAMPLE.COM", "phone": "9999999995",
            "password": "testpass123", "district": "Kamrup", "state": "Assam",
        })
        assert duplicate.status_code == 400
        invalid_login = client.post("/api/auth/login", json={
            "email": "new.user@example.com", "password": "wrong-password",
        })
        assert invalid_login.status_code == 401
        print("14. auth flow:        verified")

    print("\n=== ALL 14 SMOKE CHECKS PASSED ===")


def test_smoke_flow() -> None:
    run_smoke()


if __name__ == "__main__":
    run_smoke()
