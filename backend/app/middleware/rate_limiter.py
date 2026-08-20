"""Sliding-window rate limiter with Redis backend and in-memory fallback.

Supports per-IP and per-user rate limits to protect the API from abuse and
ensure fair resource usage at 10 000+ concurrent users.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict

from app.config import get_settings

logger = logging.getLogger(__name__)

# ── Limits ──────────────────────────────────────────────────────────────

settings = get_settings()
RATE_LIMIT_ENABLED = settings.RATE_LIMIT_ENABLED
RATE_LIMIT_WINDOW = settings.RATE_LIMIT_WINDOW
DEBUG_MODE = settings.DEBUG

# (max_requests_per_window, window_seconds)
DEFAULT_LIMITS = {
    "auth": (100, RATE_LIMIT_WINDOW) if DEBUG_MODE else (10, RATE_LIMIT_WINDOW),
    "reports": (200, RATE_LIMIT_WINDOW) if DEBUG_MODE else (30, RATE_LIMIT_WINDOW),
    "general": (500, RATE_LIMIT_WINDOW) if DEBUG_MODE else (120, RATE_LIMIT_WINDOW),
    "write": (200, RATE_LIMIT_WINDOW) if DEBUG_MODE else (60, RATE_LIMIT_WINDOW),
}

# ── Redis sliding-window counter ────────────────────────────────────────

_redis = None
_redis_retry_after = 0.0


def _get_redis():
    global _redis, _redis_retry_after
    if _redis is not None:
        return _redis
    if not settings.REDIS_URL or time.monotonic() < _redis_retry_after:
        return None
    try:
        import redis as redis_mod
        _redis = redis_mod.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        _redis.ping()
        return _redis
    except Exception:
        _redis_retry_after = time.monotonic() + settings.REDIS_RETRY_SECONDS
        return None


def _redis_check(r, key: str, limit: int, window: int) -> tuple[bool, int]:
    """Sliding window count using Redis sorted sets."""
    now = time.time()
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zcard(key)
    pipe.zadd(key, {str(time.time_ns()): now})
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
    if key not in _mem_buckets and len(_mem_buckets) >= _MEM_LIMIT:
        _mem_buckets.clear()
    bucket = _mem_buckets[key]
    bucket[:] = [t for t in bucket if t > now - window]
    allowed = len(bucket) < limit
    bucket.append(now)
    return allowed, len(bucket)


# ── FastAPI middleware ──────────────────────────────────────────────────

def _check(key: str, limit: int, window: int) -> tuple[bool, int]:
    global _redis, _redis_retry_after
    r = _get_redis()
    if r:
        try:
            return _redis_check(r, key, limit, window)
        except Exception:
            _redis = None
            _redis_retry_after = time.monotonic() + settings.REDIS_RETRY_SECONDS
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
        raw_ip = b""
        if settings.TRUST_PROXY_HEADERS:
            raw_ip = headers.get(b"x-forwarded-for", headers.get(b"x-real-ip", b""))
        raw_ip = raw_ip.decode(errors="ignore")
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

        async def send_with_rate_limit_headers(message):
            if message["type"] == "http.response.start":
                response_headers = list(message.get("headers", []))
                response_headers.extend([
                    (b"x-ratelimit-limit", str(max_reqs).encode()),
                    (b"x-ratelimit-remaining", str(max(0, max_reqs - count)).encode()),
                ])
                message = {**message, "headers": response_headers}
            await send(message)

        await self.app(scope, receive, send_with_rate_limit_headers)
