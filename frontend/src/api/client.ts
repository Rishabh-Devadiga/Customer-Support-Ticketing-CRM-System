/**
 * Thin fetch client for the 4 ticket endpoints (DEC-004, DEC-018).
 * Base URL comes only from VITE_API_BASE_URL (DEC-014); nothing is hardcoded.
 */
import type {
  CreateTicketInput,
  Ticket,
  TicketListItem,
  UpdateTicketInput,
  UpdateTicketResult,
} from "../types/tickets";

export const API_BASE_URL: string | undefined = import.meta.env
  .VITE_API_BASE_URL as string | undefined;

/** HTTP error with the backend's message. `status` 0 means no response reached us. */
export class ApiError extends Error {
  status: number;
  /** Raw `detail` payload (string or FastAPI 422 array) for field-level mapping. */
  detail: unknown;

  constructor(status: number, message: string, detail: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function parseDetail(body: unknown, fallback: string): string {
  if (body !== null && typeof body === "object" && "detail" in body) {
    const detail: unknown = (body as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (Array.isArray(detail)) {
      const parts = detail.map((entry) =>
        typeof entry === "string"
          ? entry
          : typeof entry === "object" && entry !== null && "msg" in entry
            ? String((entry as { msg: unknown }).msg)
            : JSON.stringify(entry),
      );
      if (parts.length > 0) return parts.join("; ");
    }
  }
  return fallback;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(0, "API is not configured (VITE_API_BASE_URL is missing).");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(
      0,
      "Cannot reach the API. Check your connection and try again.",
    );
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body: fall through to the generic message */
    }
    throw new ApiError(
      res.status,
      parseDetail(body, `Request failed (${res.status}).`),
      body,
    );
  }
  return (await res.json()) as T;
}

export function listTickets(
  params: { search?: string; status?: string; priority?: string },
  signal?: AbortSignal,
): Promise<TicketListItem[]> {
  const query = new URLSearchParams();
  if (params.search && params.search.trim().length > 0) {
    query.set("search", params.search.trim());
  }
  if (params.status) {
    query.set("status", params.status);
  }
  if (params.priority) {
    query.set("priority", params.priority);
  }
  const suffix = query.toString();
  return api<TicketListItem[]>(`/api/tickets${suffix ? `?${suffix}` : ""}`, {
    signal,
  });
}

export function createTicket(input: CreateTicketInput): Promise<Ticket> {
  return api<Ticket>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getTicket(
  ticketId: string,
  signal?: AbortSignal,
): Promise<Ticket> {
  return api<Ticket>(`/api/tickets/${encodeURIComponent(ticketId)}`, { signal });
}

export function updateTicket(
  ticketId: string,
  input: UpdateTicketInput,
): Promise<UpdateTicketResult> {
  return api<UpdateTicketResult>(
    `/api/tickets/${encodeURIComponent(ticketId)}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

/** Aborted fetches are stale (superseded), never errors (DEC-019). */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
