"""Pydantic request/response schemas: the authoritative API contract (DEC-013).

Defined here during foundation; ticket schemas get wired to routes in the
endpoints step. Only ``HealthResponse`` is served so far (``GET /health``).
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

TicketStatus = Literal["Open", "In Progress", "Closed"]
TicketPriority = Literal["Low", "Medium", "High", "Urgent"]


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    created_at: datetime


class TicketCreate(BaseModel):
    """POST /api/tickets body. ``status`` is NOT accepted; always starts Open."""

    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: EmailStr = Field(max_length=254)
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=10000)
    priority: TicketPriority = "Medium"

    @field_validator("customer_name", "subject", "description", mode="before")
    @classmethod
    def strip_text_fields(cls, value: object) -> object:
        # Strip before length checks so blank strings fail min_length.
        return value.strip() if isinstance(value, str) else value

    @field_validator("customer_email")
    @classmethod
    def strip_email(cls, value: str) -> str:
        return value.strip()


class TicketUpdate(BaseModel):
    """PUT /api/tickets/{ticket_id} body: ``status``/``note``/``priority`` (≥1 required)."""

    status: Optional[TicketStatus] = None
    note: Optional[str] = Field(default=None, max_length=10000)
    priority: Optional[TicketPriority] = None

    @field_validator("note")
    @classmethod
    def note_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Note must not be blank.")
        return stripped

    @model_validator(mode="after")
    def at_least_one_field(self) -> "TicketUpdate":
        if self.status is None and self.note is None and self.priority is None:
            raise ValueError("Provide at least one of 'status', 'note' or 'priority'.")
        return self


class TicketListItem(BaseModel):
    """Ticket shape for list responses (no notes; keeps payloads small)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: str
    customer_name: str
    customer_email: str
    subject: str
    description: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime


class TicketRead(TicketListItem):
    """Ticket shape for detail responses (with notes, oldest first)."""

    notes: list[NoteRead] = []


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class TicketUpdateResponse(BaseModel):
    """PUT /api/tickets/{ticket_id} response: exactly {success, updated_at}."""

    success: bool = True
    updated_at: datetime
