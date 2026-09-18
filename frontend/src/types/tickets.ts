/** Ticket domain types. Mirror `app/schemas.py` 1:1 (DEC-018). */

export type TicketStatus = "Open" | "In Progress" | "Closed";

export const TICKET_STATUSES: TicketStatus[] = ["Open", "In Progress", "Closed"];

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as string[]).includes(value);
}

export interface Note {
  id: number;
  content: string;
  created_at: string;
}

/** GET /api/tickets item (no notes; keeps payloads small). */
export interface TicketListItem {
  id: number;
  ticket_id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

/** GET /api/tickets/{ticket_id} (with notes, oldest first). */
export interface Ticket extends TicketListItem {
  notes: Note[];
}

/** POST /api/tickets body. No status: new tickets always start Open. */
export interface CreateTicketInput {
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string;
}

/** PUT /api/tickets/{ticket_id} body: status and/or note (at least one). */
export interface UpdateTicketInput {
  status?: TicketStatus;
  note?: string;
}

/** PUT response: exactly { success, updated_at }. */
export interface UpdateTicketResult {
  success: boolean;
  updated_at: string;
}
