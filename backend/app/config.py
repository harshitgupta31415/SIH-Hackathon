from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Local .env files often contain process variables (for example,
    # FASTAPI_APP). They must not prevent the API from starting.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "HealthWatch NE"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # SQLite lets the project run locally without Docker. Docker Compose
    # explicitly supplies the production-like PostgreSQL connection string.
    DATABASE_URL: str = "sqlite:///./healthwatch.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 1440

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""

    FCM_SERVER_KEY: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

@lru_cache()
def get_settings() -> Settings:
    return Settings()
