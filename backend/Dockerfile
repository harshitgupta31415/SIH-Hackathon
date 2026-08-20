# ── Stage 1: Build dependencies ─────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Production image ───────────────────────────────────────
FROM python:3.12-slim AS production

# Security: run as non-root
RUN groupadd -r healthwatch && useradd -r -g healthwatch healthwatch \
    && mkdir -p /app/ml/models /app/logs \
    && chown -R healthwatch:healthwatch /app

WORKDIR /app

# Copy only installed packages (no gcc needed)
COPY --from=builder /install /usr/local

# Copy application code
COPY backend/app ./app
COPY backend/seed_data.py .
COPY backend/requirements.txt .

# Ensure the ML models directory exists at runtime
RUN chown -R healthwatch:healthwatch /app

USER healthwatch

# Connection pool tuning for 10k concurrent users
ENV DB_POOL_SIZE=20 \
    DB_MAX_OVERFLOW=30 \
    DB_POOL_TIMEOUT=30 \
    DB_POOL_RECYCLE=1800 \
    CACHE_TTL=300 \
    CACHE_ENABLED=true \
    RATE_LIMIT_ENABLED=true \
    RATE_LIMIT_WINDOW=60 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--limit-concurrency", "500", \
     "--timeout-keep-alive", "65", \
     "--access-log"]
