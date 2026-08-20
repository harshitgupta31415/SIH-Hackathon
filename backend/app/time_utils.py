"""UTC helpers that keep the existing database columns timezone-naive."""

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return the current UTC time without tzinfo for SQLAlchemy DateTime columns."""
    return datetime.now(UTC).replace(tzinfo=None)
