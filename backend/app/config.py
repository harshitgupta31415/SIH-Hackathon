import json
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Jal Jeevan Swasthya"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./healthwatch.db"
    REDIS_URL: str = ""

    JWT_SECRET_KEY: str = "development-only-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 1440

    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    CACHE_ENABLED: bool = True
    CACHE_TTL: int = 300
    REDIS_RETRY_SECONDS: int = 30

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_WINDOW: int = 60
    TRUST_PROXY_HEADERS: bool = False

    ML_PRETRAIN_ENABLED: bool = False
    RESET_DATABASE: bool = False

    CORS_ORIGINS: str = '["http://localhost:3000"]'

    @model_validator(mode="after")
    def validate_production_secret(self):
        weak_secret = (
            len(self.JWT_SECRET_KEY) < 32
            or self.JWT_SECRET_KEY.startswith("replace-")
            or self.JWT_SECRET_KEY == "development-only-change-me"
        )
        if not self.DEBUG and weak_secret:
            raise ValueError("JWT_SECRET_KEY must be a private value of at least 32 characters when DEBUG=false")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        try:
            origins = json.loads(raw)
            if isinstance(origins, list) and all(isinstance(origin, str) for origin in origins):
                return origins
        except (json.JSONDecodeError, TypeError):
            pass
        return ["http://localhost:3000"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
