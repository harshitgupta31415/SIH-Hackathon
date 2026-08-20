"""Database engine and session factory.

Production settings:
  - Pool size scales with number of backend pods (env BACKEND_PODS).
  - SQLite fallback keeps local development dependency-free.
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()

database_url = settings.DATABASE_URL
# SQLAlchemy otherwise defaults to psycopg2 for a plain PostgreSQL URL. The
# project uses psycopg 3 on every supported Python version.
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

is_sqlite = database_url.startswith("sqlite")

_pool_args: dict = {}
if not is_sqlite:
    _pool_args = dict(
        pool_pre_ping=True,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
    )

engine = create_engine(
    database_url,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    **_pool_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
