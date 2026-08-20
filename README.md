<div align="center">

# Jal Jeevan Swasthya

### Smart community health monitoring and early warning for water-borne disease

Built for Smart India Hackathon 2025, problem statement `SIH25001`.

</div>

## Overview

Jal Jeevan Swasthya helps field workers report disease cases, record village
water-quality tests, monitor district risk, and review explainable 14-day
outbreak forecasts. The interface supports English, Hindi, Bengali, Assamese,
Marathi, and Tamil.

The repository is a Vercel-only monorepo:

- `frontend/` is a Next.js 16 App Router project.
- `backend/` is a FastAPI project exposed through Vercel's Python runtime.
- A managed PostgreSQL database stores application data.
- Managed Redis is optional; the API falls back to an in-process cache.

## Features

- Role-based workflows for volunteers, ASHA workers, block officers, and
  district administrators.
- Disease reporting with symptoms, severity, water source, and optional
  geolocation-assisted village selection.
- Water-quality tracking for pH, turbidity, coliform, dissolved oxygen, and
  nitrate measurements.
- Dashboard analytics, active alerts, and an interactive Leaflet risk map.
- Explainable outbreak forecasts with confidence, risk drivers, and human
  approval requirements.
- JWT authentication, district-scoped access, request validation, caching, and
  rate limiting.

## Technology

| Layer | Technology |
| --- | --- |
| Web | Next.js 16, React 19, Tailwind CSS 4 |
| Client data | Axios, Zustand |
| Visuals | Recharts, Leaflet, React Leaflet |
| API | FastAPI, Pydantic 2, SQLAlchemy 2 |
| Data | PostgreSQL, optional Redis |
| Forecasting | Pure-Python exponential smoothing with optional scikit-learn regressor |
| Hosting | Vercel for both frontend and API |

## Repository layout

```text
SIH-Hackathon/
├── .env.example
├── .github/workflows/ci.yml
├── backend/
│   ├── .env.example
│   ├── .python-version
│   ├── index.py                 # Vercel FastAPI entrypoint
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── seed_data.py
│   └── app/
│       ├── main.py
│       ├── routes/
│       ├── models/
│       ├── schemas/
│       ├── services/
│       └── ml/
├── frontend/
│   ├── .env.example
│   ├── app/                     # Next.js App Router routes and layouts
│   ├── public/
│   ├── src/                     # UI, state, API client, and translations
│   ├── next.config.mjs
│   └── package.json
├── docs/JUDGE_DEMO.md
└── test_smoke.py
```

## Local development

### Prerequisites

- Node.js 22 or newer
- Python 3.12 or newer
- PostgreSQL for production-like local development; SQLite works by default
- Redis only if distributed caching is needed locally

### Backend

```powershell
cd backend
Copy-Item .env.example .env
python -m pip install -r requirements-dev.txt
python seed_data.py
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

For dependency-free local setup, change `DATABASE_URL` in `backend/.env` to:

```dotenv
DATABASE_URL=sqlite:///./healthwatch.db
```

The API is available at `http://localhost:8000`; Swagger documentation is at
`http://localhost:8000/api/docs`.

### Frontend

Open a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

The Next.js app is available at `http://localhost:3000`.

### Demo accounts

After running `backend/seed_data.py`:

| Role | Email | Password |
| --- | --- | --- |
| District admin | `admin@healthwatch.gov.in` | `admin123` |
| ASHA worker | `priya@healthwatch.gov.in` | `worker123` |
| Block officer | `arup@healthwatch.gov.in` | `officer123` |
| Volunteer | `rahul@healthwatch.gov.in` | `volunteer123` |

These credentials are demonstration data and must not be used for real users.

## Environment variables

Use [`.env.example`](.env.example) as the combined reference. The deployable
projects also contain scoped templates:

- [`backend/.env.example`](backend/.env.example) contains API, database,
  authentication, CORS, cache, and rate-limit settings.
- [`frontend/.env.example`](frontend/.env.example) contains the public API
  origin used by the browser.

Production requirements:

- Set `DEBUG=false`.
- Generate a private `JWT_SECRET_KEY` of at least 32 characters.
- Use a pooled managed PostgreSQL `DATABASE_URL`; a function-local SQLite file
  is not durable on Vercel.
- Set `CORS_ORIGINS` to a JSON array containing the deployed frontend URL and
  any preview URLs that should be permitted.
- Set `NEXT_PUBLIC_API_URL` to the deployed backend origin, with or without a
  trailing `/api`.
- Keep `RESET_DATABASE=false` and `ML_PRETRAIN_ENABLED=false` in production.

## Vercel deployment

Deploy the repository as two Vercel projects so both runtimes stay on stable,
generally available platform paths.

### 1. Deploy the API

1. Import this repository in Vercel.
2. Set the project root directory to `backend`.
3. Keep automatic framework detection and the default build settings.
4. Add the backend variables from `backend/.env.example`, using production
   values. At minimum configure `DATABASE_URL`, `JWT_SECRET_KEY`, `DEBUG=false`,
   and `CORS_ORIGINS`.
5. Deploy. Vercel loads the FastAPI `app` exported by `backend/index.py`.

The health check is `/api/health`, readiness is `/api/ready`, and API docs are
served at `/api/docs`.

### 2. Deploy the Next.js app

1. Import the same repository as a second Vercel project.
2. Set the project root directory to `frontend`.
3. Vercel detects Next.js automatically.
4. Set `NEXT_PUBLIC_API_URL` to the backend deployment URL.
5. Deploy, then add the resulting frontend URL to the backend project's
   `CORS_ORIGINS` and redeploy the API.

Vercel's Git integration creates preview deployments and promotes production
deployments. The repository CI only runs tests, linting, and the production
build; it does not maintain a second deployment pipeline.

## Testing

From the repository root:

```powershell
python -m pip install -r backend/requirements-dev.txt
python -m pytest test_smoke.py -q -W error::DeprecationWarning
python -m ruff check backend test_smoke.py --select F

cd frontend
npm ci
npm run lint
npm run build
```

## API summary

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register a volunteer |
| `POST` | `/api/auth/login` | Sign in and receive a JWT |
| `GET` | `/api/auth/me` | Read the current profile |
| `GET`, `POST` | `/api/reports` | List or submit disease reports |
| `GET`, `POST` | `/api/water-quality` | List or submit water tests |
| `GET`, `POST` | `/api/alerts` | List or create alerts |
| `GET` | `/api/dashboard/summary` | Read dashboard metrics |
| `GET` | `/api/dashboard/risk-map` | Read village risk points |
| `GET` | `/api/dashboard/predictions/{district}/{disease}` | Generate a forecast |
| `GET` | `/api/villages` | List monitored villages |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/ready` | Database readiness check |

## Safety note

Forecasts are decision-support signals, not diagnoses. Public-health action
must be reviewed and approved by a qualified official.
