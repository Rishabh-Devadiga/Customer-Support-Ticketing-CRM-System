"""Environment-driven configuration (DEC-014).

All environment-specific values come from the process environment or a local
``.env`` file. Copy ``.env.example`` to ``.env`` for local development.
Never commit real secrets.
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded once at startup."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    environment: str = Field(default="local")
    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/crm"
    )
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000"
    )

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Accept common Postgres URL forms; reject non-Postgres (DEC-003)."""
        url = value.strip()
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        if url.startswith("sqlite"):
            raise ValueError("SQLite is not supported; PostgreSQL only (DEC-003).")
        if not url.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must be a PostgreSQL URL.")
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        """CORS allowlist as a list (DEC-009)."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (read once at startup)."""
    return Settings()
