"""Ticket ID generation (DEC-006).

Pure helper: returns a new public ID like ``TKT-7KQ2XA``. Uniqueness is
enforced by the DB ``UNIQUE`` constraint; on the extremely unlikely collision
the caller (POST handler) generates another ID and retries.
"""

import secrets

TICKET_ID_PREFIX = "TKT-"
TICKET_ID_RANDOM_LENGTH = 6

# Uppercase alphanumerics minus ambiguous chars (0/O, 1/I/L).
_TICKET_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_ticket_id() -> str:
    """Return a new public ticket ID."""
    suffix = "".join(
        secrets.choice(_TICKET_ID_ALPHABET) for _ in range(TICKET_ID_RANDOM_LENGTH)
    )
    return f"{TICKET_ID_PREFIX}{suffix}"
