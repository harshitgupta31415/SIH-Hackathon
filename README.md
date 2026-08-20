# HealthWatch NE

HealthWatch NE is a Smart Community Health Monitoring and Early Warning System for water-borne disease reporting, water-quality tracking, district risk maps, and outbreak alerts.

## Run locally

1. Start the API and its PostgreSQL/PostGIS and Redis dependencies:

   ```powershell
   docker compose up --build
   ```

   The development database is seeded automatically on its first start. It includes these demo accounts:

   - `admin@healthwatch.gov.in` / `admin123`
   - `priya@healthwatch.gov.in` / `worker123`
   - `rahul@healthwatch.gov.in` / `volunteer123`

2. In a second terminal, start the web application:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`. API documentation is at `http://localhost:8000/api/docs`.

### Run without Docker

For a quick local demo, the backend can use SQLite instead of PostgreSQL. From the `backend` folder:

```powershell
cd backend
py -m pip install -r requirements.txt
.\run_local.ps1
```

Then start the frontend as in step 2 above. Keep the backend terminal open while using the app.

## Development database reset

Resetting deletes the local database data. Use it only for development:

```powershell
$env:RESET_DATABASE = "true"
docker compose up --build
```

## Access model

Public registration creates a community-volunteer account. Higher roles are provisioned by an administrator. Users can view and submit data only for their own district, while alert resolution and report verification require staff roles.
