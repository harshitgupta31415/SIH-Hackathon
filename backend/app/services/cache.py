"""Graceful Redis cache with in-memory fallback.

When Redis is unavailable the cache silently degrades to a process-local
dict so the application keeps running (just without distributed caching).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Configuration ───────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "")
CACHE_DEFAULT_TTL = int(os.getenv("CACHE_TTL", "300"))  # 5 minutes
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"

# ── Redis connection (lazy) ─────────────────────────────────────────────

_redis = None
_redis_available = False


def _get_redis():
    global _redis, _redis_available
    if _redis_available and _redis is not None:
        return _redis
    if not CACHE_ENABLED or not REDIS_URL:
        return None
    try:
        import redis as redis_mod
        _redis = redis_mod.from_url(
            REDIS_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
            decode_responses=True,
        )
        _redis.ping()
        _redis_available = True
        logger.info("Redis cache connected: %s", REDIS_URL.split("@")[-1])
        return _redis
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis unavailable, falling back to in-memory cache: %s", exc)
        _redis_available = False
        _redis = None
        return None


# ── In-memory fallback ─────────────────────────────────────────────────

_mem_cache: dict[str, tuple[float, Any]] = {}
_MEM_MAX = 500


def _mem_get(key: str) -> Optional[Any]:
    entry = _mem_cache.get(key)
    if entry is None:
        return None
    expiry, value = entry
    if time.time() > expiry:
        _mem_cache.pop(key, None)
        return None
    return value


def _mem_set(key: str, value: Any, ttl: int) -> None:
    if len(_mem_cache) >= _MEM_MAX:
        # evict oldest 20%
        keys = sorted(_mem_cache, key=lambda k: _mem_cache[k][0])[: _MEM_MAX // 5]
        for k in keys:
            _mem_cache.pop(k, None)
    _mem_cache[key] = (time.time() + ttl, value)


# ── Public API ──────────────────────────────────────────────────────────

def cache_key(*parts) -> str:
    """Build a deterministic cache key from the given parts."""
    raw = ":".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def cache_get(key: str) -> Optional[Any]:
    """Return the cached value or ``None``."""
    r = _get_redis()
    if r:
        try:
            raw = r.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            return None
    return _mem_get(key)


def cache_set(key: str, value: Any, ttl: int = CACHE_DEFAULT_TTL) -> None:
    """Store *value* under *key* for *ttl* seconds."""
    r = _get_redis()
    if r:
        try:
            r.setex(key, ttl, json.dumps(value, default=str))
        except Exception:
            pass
    _mem_set(key, value, ttl)


def cache_delete(pattern: str) -> int:
    """Delete keys matching *pattern* (Redis only)."""
    r = _get_redis()
    if not r:
        return 0
    try:
        keys = r.keys(pattern)
        if keys:
            return r.delete(*keys)
    except Exception:
        pass
    return 0


def cache_flush_district(district: str) -> None:
    """Invalidate all cached responses for a district after mutations."""
    cache_delete(f"dw:{district}:*")
    cache_delete(f"dr:{district}:*")


def cache_health() -> dict:
    """Return cache status for the /api/health endpoint."""
    r = _get_redis()
    if r:
        try:
            r.ping()
            info = r.info("memory")
            return {
                "backend": "redis",
                "connected": True,
                "used_memory": info.get("used_memory_human", "?"),
            }
        except Exception:
            return {"backend": "redis", "connected": False}
    return {"backend": "in-memory", "connected": True, "entries": len(_mem_cache)}
