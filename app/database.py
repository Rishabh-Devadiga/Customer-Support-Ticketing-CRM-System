"""Database engine, sessions, and startup initialization (DEC-003, DEC-016).

Synchronous SQLAlchemy (V1 stays synchronous per DEC-002). Tables are created
idempotently via ``init_db()`` at application startup; no Alembic in V1.
"""

from collections.abc import Iterator

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)


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

    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    _migrate_priority_column(engine)


def _migrate_priority_column(engine: Engine) -> None:
    """Phase 6 (DEC-020): add ``tickets.priority`` to pre-existing tables.

    ``create_all`` never alters existing tables, so a greenfield deploy gets
    the column from the model while an existing database gets it here.
    Idempotent: safe to run on every boot. ``NOT NULL DEFAULT 'Medium'``
    backfills existing rows in the same statement — no data is wiped.
    """
    statements = [
        "ALTER TABLE tickets "
        "ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'Medium'",
        "UPDATE tickets SET priority = 'Medium' WHERE priority IS NULL",
        "CREATE INDEX IF NOT EXISTS ix_tickets_priority ON tickets (priority)",
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tickets_priority') THEN "
        "ALTER TABLE tickets ADD CONSTRAINT ck_tickets_priority "
        "CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')); "
        "END IF; END $$",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    logger.info("Priority column ensured (existing rows keep their data).")
