"""FastAPI application entrypoint.

Run locally:  uvicorn app.main:app --reload
Deploy:       uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.schemas import HealthResponse
from app.tickets import router as tickets_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure tables exist; warn (don't crash) if the DB is unreachable (DEC-016)."""
    from app.database import init_db

    try:
        init_db()
        logger.info("Database tables ensured.")
    except Exception:
        logger.warning(
            "Could not initialize database at startup; serving anyway "
            "(database errors will return 500).",
            exc_info=True,
        )
    yield


settings = get_settings()

app = FastAPI(
    title="Customer Support Ticketing CRM API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Liveness probe and deployment smoke test (no secrets, no DB touch)."""
    return HealthResponse()


app.include_router(tickets_router)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request, exc: SQLAlchemyError) -> JSONResponse:
    """Database failures: generic 500 to the client, full traceback in logs (DEC-012)."""
    logger.exception("Database operation failed.")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
