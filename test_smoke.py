import sys, os, tempfile
os.environ['DATABASE_URL'] = 'sqlite:///' + tempfile.mktemp(suffix='.db')
os.environ['RATE_LIMIT_ENABLED'] = 'false'
os.environ['CACHE_ENABLED'] = 'false'
sys.path.insert(0, 'backend')

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine, Base
from app.models.models import User, Village, DiseaseReport, WaterQuality, Alert, UserRole, WaterSourceType, AlertSeverity
from app.middleware.auth import hash_password
from datetime import datetime, timedelta
import uuid

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Seed data inline
admin = User(name="Admin", email="admin@test.com", password_hash=hash_password("testpass123"),
             role=UserRole.DISTRICT_ADMIN, district="Kamrup", state="Assam", phone="9999999999")
db.add(admin)
worker = User(name="Worker", email="worker@test.com", password_hash=hash_password("testpass123"),
              role=UserRole.ASHA_WORKER, village="Sonapur", block="Sonapur", district="Kamrup", state="Assam", phone="9999999998")
db.add(worker)
vol = User(name="Volunteer", email="vol@test.com", password_hash=hash_password("testpass123"),
           role=UserRole.VOLUNTEER, village="Jorabat", block="Dispur", district="Kamrup", state="Assam", phone="9999999997")
db.add(vol)
db.flush()

v1 = Village(name="Sonapur", block="Sonapur", district="Kamrup", latitude=26.1445, longitude=91.7362, population=3500)
v2 = Village(name="Jorabat", block="Dispur", district="Kamrup", latitude=26.1585, longitude=91.7932, population=2800)
db.add_all([v1, v2])
db.flush()

diseases = ["Cholera", "Typhoid", "Diarrhea"]
for i in range(20):
    for disease in diseases:
        r = DiseaseReport(reporter_id=vol.id, village_id=v1.id if i % 2 == 0 else v2.id,
                          disease_type=disease, symptoms=["diarrhea", "fever"],
                          cases_count=(i % 5) + 1, severity="moderate",
                          water_source=WaterSourceType.WELL, latitude=26.14, longitude=91.73,
                          risk_score=min(100, i * 5 + 10),
                          created_at=datetime.utcnow() - timedelta(days=20 - i))
        db.add(r)
db.flush()

wq = WaterQuality(village_id=v1.id, tested_by=worker.id, source_type=WaterSourceType.WELL,
                  ph_level=7.2, coliform_count=25, is_contaminated=True, test_date=datetime.utcnow(),
                  latitude=26.14, longitude=91.73)
db.add(wq)
alert = Alert(title="High Risk", message="Cholera risk in Sonapur", severity=AlertSeverity.HIGH,
              affected_area="Sonapur", district="Kamrup", issued_by=admin.id, latitude=26.14, longitude=91.73)
db.add(alert)
db.commit()
db.close()

print(f"Seed OK: {db.query(User).count()} users, {db.query(DiseaseReport).count()} reports, {db.query(Alert).count()} alerts")

# Run tests
with TestClient(app) as c:
    r = c.get('/api/health')
    print(f"1. health:      {r.status_code}  cache={r.json()['cache']['backend']}")

    login = c.post('/api/auth/login', json={'email': 'admin@test.com', 'password': 'testpass123'})
    print(f"2. login:       {login.status_code}")
    assert login.status_code == 200
    tok = login.json()['access_token']
    h = {'Authorization': f'Bearer {tok}'}

    vol_login = c.post('/api/auth/login', json={'email': 'vol@test.com', 'password': 'testpass123'})
    assert vol_login.status_code == 200
    vol_token = vol_login.json()['access_token']

    r = c.get('/api/dashboard/summary', headers=h)
    s = r.json()
    print(f"3. summary:     {r.status_code}  weekly_cases={s['total_reports_week']}  alerts={s['active_alerts']}")

    r = c.get('/api/dashboard/risk-map', headers=h)
    print(f"4. risk-map:    {r.status_code}  points={len(r.json())}")

    r = c.get('/api/alerts', headers=h)
    print(f"5. alerts:      {r.status_code}  count={len(r.json())}")

    r = c.get('/api/reports', headers=h)
    print(f"6. reports:     {r.status_code}  count={len(r.json())}")

    r = c.get('/api/villages', headers=h)
    print(f"7. villages:    {r.status_code}  count={len(r.json())}")

    r = c.get('/api/water-quality', headers=h)
    print(f"8. water:       {r.status_code}  count={len(r.json())}")

    # Test ML prediction
    r = c.get('/api/dashboard/predictions/Kamrup/Diarrhea', headers=h)
    assert r.status_code == 200
    assert r.json()['predicted_cases'] > 0
    assert r.json()['explanation']['horizon_days'] == 14
    assert r.json()['explanation']['risk_drivers']
    assert r.json()['explanation']['recommended_actions']
    print(f"9. prediction:  {r.status_code}  risk={r.json().get('risk_level')}  predicted={r.json().get('predicted_cases')}")

    # ── Upgrade Request Flow ──
    h_vol = {"Authorization": f"Bearer {vol_token}"}
    h_admin = {"Authorization": f"Bearer {tok}"}

    r = c.post('/api/auth/request-upgrade', json={
        "requested_role": "asha_worker",
        "justification": "I have completed ASHA training and need access to verify reports.",
    }, headers=h_vol)
    print(f"10. request-upgrade: {r.status_code}  status={r.json().get('status')}")
    req_id = r.json()['id']

    r = c.get('/api/auth/my-upgrade-request', headers=h_vol)
    print(f"11. my-request:      {r.status_code}  status={r.json().get('status')}")

    r = c.get('/api/auth/upgrade-requests', headers=h_admin)
    print(f"12. list-requests:   {r.status_code}  count={len(r.json())}")

    r = c.put(f'/api/auth/upgrade-requests/{req_id}', json={
        "status": "approved",
        "review_notes": "Training verified. Welcome aboard.",
    }, headers=h_admin)
    print(f"13. approve-request: {r.status_code}  status={r.json().get('status')}")

    registration = c.post('/api/auth/register', json={
        'name': 'New User', 'email': 'new.user@example.com', 'phone': '9999999996',
        'password': 'testpass123', 'district': 'Kamrup', 'state': 'Assam',
    })
    assert registration.status_code == 201
    duplicate = c.post('/api/auth/register', json={
        'name': 'Duplicate User', 'email': 'NEW.USER@EXAMPLE.COM', 'phone': '9999999995',
        'password': 'testpass123', 'district': 'Kamrup', 'state': 'Assam',
    })
    assert duplicate.status_code == 400
    invalid_login = c.post('/api/auth/login', json={'email': 'new.user@example.com', 'password': 'wrong-password'})
    assert invalid_login.status_code == 401
    print("14. auth flow:   registration, duplicate protection, and invalid login verified")

    print("\n=== ALL 14 TESTS PASSED ===")
