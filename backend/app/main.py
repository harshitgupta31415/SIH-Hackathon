from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from loguru import logger

from app.config import get_settings
from app.database import engine, Base
from app.routes import auth, reports, water_quality, alerts, dashboard, villages, locations
from app.middleware.rate_limiter import RateLimitMiddleware
from app.services.cache import cache_health

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Schema migration may have partially failed (safe to ignore on restart): %s", exc)

    # Pre-train and cache the ML model so the first forecast request is fast.
    try:
        from app.ml.predictor import ensure_model_trained
        ensure_model_trained()
    except Exception as exc:
        logger.warning("ML model pre-training skipped: %s", exc)

    logger.info("Startup complete")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Smart Community Health Monitoring and Early Warning System for Water-Borne Diseases in Rural Northeast India",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# ── Middleware (order matters: outermost runs first) ────────────────────
app.add_middleware(RateLimitMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

# ── Routers ─────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(water_quality.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(villages.router)
app.include_router(locations.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    import time
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "cache": cache_health(),
        "timestamp": time.time(),
    }


@app.get("/api/ready", tags=["Health"])
def readiness():
    """Kubernetes readiness probe: confirms the app can serve traffic."""
    return {"status": "ready"}


@app.get("/", tags=["Health"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/api/docs",
        "health": "/api/health",
    }
