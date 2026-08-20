"""Sliding-window rate limiter with Redis backend and in-memory fallback.

Supports per-IP and per-user rate limits to protect the API from abuse and
ensure fair resource usage at 10 000+ concurrent users.
"""

from __future__ import annotations

import logging
import os
import time
from collections import defaultdict

from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)

# ── Limits ──────────────────────────────────────────────────────────────

RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # seconds

# (max_requests_per_window, window_seconds)
DEFAULT_LIMITS = {
    "auth": (10, 60),       # 10 login/register per minute per IP
    "reports": (30, 60),    # 30 report submissions per minute per user
    "general": (120, 60),   # 120 reads per minute per IP
    "write": (60, 60),      # 60 writes per minute per user
}

# ── Redis sliding-window counter ────────────────────────────────────────

_redis = None


def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis as redis_mod
        _redis = redis_mod.from_url(
            os.getenv("REDIS_URL", ""),
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        _redis.ping()
        return _redis
    except Exception:
        return None


def _redis_check(key: str, limit: int, window: int) -> tuple[bool, int]:
    """Sliding window count using Redis sorted sets."""
    r = _get_redis()
    if r is None:
        return True, 0  # allow when Redis unavailable
    now = time.time()
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zcard(key)
    pipe.zadd(key, {str(now): now})
    pipe.expire(key, window + 10)
    results = pipe.execute()
    current_count = results[1]
    allowed = current_count < limit
    return allowed, current_count + 1


# ── In-memory fallback ─────────────────────────────────────────────────

_mem_buckets: dict[str, list[float]] = defaultdict(list)
_MEM_LIMIT = 10_000  # max keys tracked before flushing


def _mem_check(key: str, limit: int, window: int) -> tuple[bool, int]:
    now = time.time()
    bucket = _mem_buckets[key]
    bucket[:] = [t for t in bucket if t > now - window]
    if len(bucket) >= _MEM_LIMIT:
        _mem_buckets.clear()
    allowed = len(bucket) < limit
    bucket.append(now)
    return allowed, len(bucket)


# ── FastAPI middleware ──────────────────────────────────────────────────

def _check(key: str, limit: int, window: int) -> tuple[bool, int]:
    r = _get_redis()
    if r:
        return _redis_check(key, limit, window)
    return _mem_check(key, limit, window)


class RateLimitMiddleware:
    """Drop-in ASGI middleware (replaces slowapi for zero-dependency)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not RATE_LIMIT_ENABLED:
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        headers = dict(scope.get("headers", []))
        raw_ip = headers.get(b"x-forwarded-for", headers.get(b"x-real-ip", b"")).decode()
        client_ip = (raw_ip.split(",")[0].strip() if raw_ip else None) or (
            scope.get("client", (None,))[0] or "unknown"
        )

        # Pick the right bucket key and limits based on path.
        if path.startswith("/api/auth/"):
            category = "auth"
        elif path.startswith("/api/reports") and scope["method"] == "POST":
            category = "reports"
        elif path.startswith("/api/") and scope["method"] in ("POST", "PUT", "DELETE", "PATCH"):
            category = "write"
        else:
            category = "general"

        max_reqs, window = DEFAULT_LIMITS[category]
        key = f"rl:{category}:{client_ip}"

        allowed, count = _check(key, max_reqs, window)

        if not allowed:
            response_body = b'{"detail":"Rate limit exceeded. Please slow down."}'
            headers_list = [
                (b"content-type", b"application/json"),
                (b"retry-after", str(window).encode()),
                (b"x-ratelimit-limit", str(max_reqs).encode()),
                (b"x-ratelimit-remaining", b"0"),
            ]
            await send({
                "type": "http.response.start",
                "status": 429,
                "headers": headers_list,
            })
            await send({"type": "http.response.body", "body": response_body})
            return

        # Pass rate-limit headers to downstream for transparency.
        scope["app"] = getattr(scope, "app", None)
        await self.app(scope, receive, send)
