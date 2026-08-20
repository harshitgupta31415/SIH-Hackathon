from contextlib import asynccontextmanager
from threading import Thread

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from loguru import logger
from sqlalchemy import text

from app.config import get_settings
from app.database import Base, engine
from app.middleware.rate_limiter import RateLimitMiddleware
from app.routes import (
    alerts,
    auth,
    dashboard,
    locations,
    reports,
    villages,
    water_quality,
)
from app.services.cache import cache_health

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Schema initialization failed: {}", exc)

    # Model training is optional and must never hold up health/readiness probes.
    if settings.ML_PRETRAIN_ENABLED:
        def prepare_model():
            try:
                from app.ml.predictor import ensure_model_trained
                ensure_model_trained()
                logger.info("ML model preparation complete")
            except Exception as exc:  # pragma: no cover - best-effort background work
                logger.warning("ML model pre-training skipped: {}", exc)

        Thread(target=prepare_model, name="ml-model-pretrain", daemon=True).start()

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
    allow_credentials=settings.cors_origins_list != ["*"],
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
    """Confirm the API can reach its required database dependency."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("Readiness check failed: {}", exc)
        raise HTTPException(status_code=503, detail="Database is unavailable")
    return {"status": "ready"}


@app.get("/", tags=["Health"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/api/docs",
        "health": "/api/health",
    }
