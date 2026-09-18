"""Database engine, sessions, and startup initialization (DEC-003, DEC-016).

Synchronous SQLAlchemy (V1 stays synchronous per DEC-002). Tables are created
idempotently via ``init_db()`` at application startup; no Alembic in V1.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


_engine = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine():
    """Lazily-created SQLAlchemy engine with a liveness pre-ping."""
    global _engine
    if _engine is None:
        _engine = create_engine(get_settings().database_url, pool_pre_ping=True)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Lazily-created session factory bound to the engine."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), autoflush=False, expire_on_commit=False
        )
    return _SessionLocal


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request (used by ticket endpoints)."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create tables if missing (idempotent). Raises if the DB is unreachable."""
    from app import models  # noqa: F401 — register models before create_all

    Base.metadata.create_all(bind=get_engine())
