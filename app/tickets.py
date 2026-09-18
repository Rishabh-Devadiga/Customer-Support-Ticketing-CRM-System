"""Ticket REST endpoints — exactly the 4 required operations (DEC-004).

- POST   /api/tickets             — create (always starts Open, server ticket_id)
- GET    /api/tickets             — list, newest-first, optional ?status=&search=
- GET    /api/tickets/{ticket_id} — detail with notes (oldest-first)
- PUT    /api/tickets/{ticket_id} — status and/or note, atomically

Response bodies are supersets of the assessment contract: every field named
there is present (dynamic timestamps make exact-equality assertions impossible,
so presence is what matters). PUT returns exactly {success, updated_at}.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import TICKET_STATUSES, Note, Ticket
from app.schemas import (
    TicketCreate,
    TicketListItem,
    TicketRead,
    TicketUpdate,
    TicketUpdateResponse,
)
from app.utils import generate_ticket_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

TICKET_NOT_FOUND = "Ticket not found"
MAX_ID_ATTEMPTS = 5


def _escape_like(value: str) -> str:
    """Escape LIKE wildcards so the search query is matched literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _get_ticket_or_404(db: Session, ticket_id: str) -> Ticket:
    """Fetch a ticket with notes eager-loaded, or raise 404."""
    ticket = db.scalar(
        select(Ticket)
        .options(selectinload(Ticket.notes))
        .where(Ticket.ticket_id == ticket_id)
    )
    if ticket is None:
        raise HTTPException(status_code=404, detail=TICKET_NOT_FOUND)
    return ticket


# Both "" and "/" are registered so POST/GET work with or without a
# trailing slash and no redirect is ever needed (redirects break POST clients).


@router.post("", response_model=TicketRead, status_code=201)
@router.post("/", response_model=TicketRead, status_code=201, include_in_schema=False)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)) -> Ticket:
    """Create a ticket. Client-sent status/ids are not accepted (DEC-006/007)."""
    for _ in range(MAX_ID_ATTEMPTS):
        ticket = Ticket(
            ticket_id=generate_ticket_id(),
            customer_name=payload.customer_name,
            customer_email=payload.customer_email,
            subject=payload.subject,
            description=payload.description,
            status="Open",
        )
        db.add(ticket)
        try:
            db.commit()
        except IntegrityError:
            # Extremely unlikely ticket_id collision: retry with a fresh ID.
            db.rollback()
            logger.warning("Ticket ID collision; retrying with a fresh ID.")
            continue
        db.refresh(ticket)
        return ticket
    logger.error("Could not generate a unique ticket ID after retries.")
    raise HTTPException(status_code=500, detail="Internal server error")


@router.get("", response_model=list[TicketListItem])
@router.get("/", response_model=list[TicketListItem], include_in_schema=False)
def list_tickets(
    status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> list[Ticket]:
    """List tickets newest-first, with optional server-side status/search (DEC-010/011)."""
    stmt = select(Ticket)
    if status is not None:
        if status not in TICKET_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status. Must be one of: {', '.join(TICKET_STATUSES)}.",
            )
        stmt = stmt.where(Ticket.status == status)
    if search is not None and search.strip():
        pattern = f"%{_escape_like(search.strip())}%"
        stmt = stmt.where(
            or_(
                Ticket.ticket_id.ilike(pattern, escape="\\"),
                Ticket.customer_name.ilike(pattern, escape="\\"),
                Ticket.customer_email.ilike(pattern, escape="\\"),
                Ticket.subject.ilike(pattern, escape="\\"),
                Ticket.description.ilike(pattern, escape="\\"),
            )
        )
    stmt = stmt.order_by(Ticket.created_at.desc(), Ticket.id.desc())
    return list(db.scalars(stmt))


@router.get("/{ticket_id}", response_model=TicketRead)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)) -> Ticket:
    """Ticket detail with notes oldest-first (relationship ordering, DEC-008)."""
    return _get_ticket_or_404(db, ticket_id)


@router.put("/{ticket_id}", response_model=TicketUpdateResponse)
def update_ticket(
    ticket_id: str, payload: TicketUpdate, db: Session = Depends(get_db)
) -> TicketUpdateResponse:
    """Update status and/or append a note atomically (DEC-008).

    Pydantic rejects empty bodies, invalid statuses, and blank notes (422)
    before this runs. ``updated_at`` is bumped on every update.
    """
    ticket = _get_ticket_or_404(db, ticket_id)
    if payload.status is not None:
        ticket.status = payload.status
    if payload.note is not None:
        db.add(Note(ticket_fk=ticket.id, content=payload.note))
    ticket.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to update ticket %s.", ticket_id)
        raise HTTPException(status_code=500, detail="Internal server error")
    db.refresh(ticket)
    return TicketUpdateResponse(success=True, updated_at=ticket.updated_at)
