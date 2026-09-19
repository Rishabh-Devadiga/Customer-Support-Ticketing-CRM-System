"""SQLAlchemy models: tickets one-to-many notes (DEC-005, DEC-007, DEC-008).

``Ticket.id`` is the internal integer PK used by the foreign key.
``Ticket.ticket_id`` is the public unique handle used in URLs and the UI.
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

TICKET_STATUSES = ("Open", "In Progress", "Closed")
TICKET_PRIORITIES = ("Low", "Medium", "High", "Urgent")


class Ticket(Base):
    """One support ticket."""

    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint(
            "status IN ('Open', 'In Progress', 'Closed')",
            name="ck_tickets_status",
        ),
        CheckConstraint(
            "priority IN ('Low', 'Medium', 'High', 'Urgent')",
            name="ck_tickets_priority",
        ),
        Index("ix_tickets_status", "status"),
        Index("ix_tickets_priority", "priority"),
        Index("ix_tickets_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticket_id: Mapped[str] = mapped_column(
        String(16), unique=True, nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(254), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="Open", server_default="Open"
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="Medium", server_default="Medium"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    notes: Mapped[list["Note"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="Note.created_at",
    )

    def __repr__(self) -> str:
        return (
            f"<Ticket id={self.id} ticket_id={self.ticket_id!r} "
            f"status={self.status!r}>"
        )


class Note(Base):
    """One append-only comment on a ticket (no edit/delete in V1)."""

    __tablename__ = "notes"
    __table_args__ = (Index("ix_notes_ticket_fk", "ticket_fk"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticket_fk: Mapped[int] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ticket: Mapped["Ticket"] = relationship(back_populates="notes")

    def __repr__(self) -> str:
        return f"<Note id={self.id} ticket_fk={self.ticket_fk}>"
