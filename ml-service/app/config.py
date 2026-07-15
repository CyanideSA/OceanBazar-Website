"""Runtime configuration for the OceanBazar ML service."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres connection. The ML service reads the same database as the BFF/Java.
    # Accepts a standard SQLAlchemy URL, e.g.
    #   postgresql+psycopg2://oceanbazar:secret@localhost:5433/oceanbazar
    database_url: str = "postgresql+psycopg2://oceanbazar:secret@localhost:5433/oceanbazar"

    # Shared secret required in the `X-ML-API-Key` header on every request.
    # When empty, auth is disabled (local dev only).
    ml_service_api_key: str = ""

    # OpenAI (marketing + SEO generation). When empty, deterministic templates are used.
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Model metadata stamped onto every prediction row.
    model_version: str = "ob-os-1.0"

    # Service
    port: int = 8100
    log_level: str = "info"


@lru_cache
def get_settings() -> Settings:
    return Settings()
