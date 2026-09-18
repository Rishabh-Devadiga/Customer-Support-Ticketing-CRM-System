# System Flow — Customer Support Ticketing CRM

Source of truth for how the system behaves. Companions: `DECISIONS.md`
(why this shape). No code is specified here beyond contracts; no auth, AI,
or bonus features are in scope.

**Status: approved 2026-09-18.** Binding clarifications: ticket IDs are
server-side `TKT-XXXXXX`, unique, retry-on-collision, DB-enforced; `PUT`
accepts `status` and/or `note` (≥1 required, blank notes rejected,
`updated_at` on either change, atomic); new tickets always start as `Open`;
health check is exactly `GET /health`; no pagination/sorting in V1.

---

## 1. System Overview

A web-based CRM that lets a customer support agent create, find, read, and
update customer support tickets, including a running notes history per ticket.

- **Frontend:** React + TypeScript + Tailwind SPA (Vercel).
- **Backend:** FastAPI REST JSON API (Railway or Render).
- **Database:** Single managed PostgreSQL instance (same provider as backend).
- **Contract:** 4 REST endpoints under `/api`. Ticket list supports
  server-side `search` and `status` query params. Ticket detail embeds notes.
- **Scope:** Single shared agent workspace in V1 — no login, no roles, no
  assignment. Every visitor to the deployed app sees the same tickets.

Non-goals (explicitly not in V1): authentication, multi-agent ownership,
priority/SLA, customer profiles, attachments, analytics, channels (see §9).

---

## 2. User Role

**Primary user: Customer Support Agent** (single shared role, no login in V1).

The agent can:

1. Create a support ticket.
2. View a list of all tickets.
3. Search tickets.
4. Filter tickets by status.
5. Open a ticket and view its complete details (including notes).
6. Update the ticket status (`Open` → `In Progress` → `Closed`, or any
   transition — no enforced order in V1).
7. Add notes/comments to a ticket.

There are no other roles in V1. No permissions model.

---

## 3. High-Level Architecture

```text
Support Agent
      ↓  (browser, HTTPS)
React Frontend (Vercel static SPA)
      ↓  (HTTPS JSON, CORS-allowlisted)
FastAPI REST API (Railway or Render, Uvicorn)
      ↓  (private TCP, DATABASE_URL)
PostgreSQL Database (managed, same provider)
```

- The browser never talks to the database. All data access goes through the API.
- The API is stateless: no sessions, no server-side state between requests.
- Request/response encoding is JSON with UTF-8. Timestamps are ISO-8601 UTC.
- Frontend API base URL and backend CORS origins are environment-injected
  (see `DECISIONS.md` DEC-013/DEC-015).

---

## 4. Application Flow

### A. Create Ticket

```text
Agent → Create Ticket Form
  → Frontend validation (required fields, email format)
  → POST /api/tickets
  → Backend validation (Pydantic)
  → Generate ticket_id server-side
  → INSERT INTO tickets (status defaults to Open)
  → 201 + created ticket JSON
  → Frontend shows success and navigates to / tickets/{ticket_id}
```

1. Agent fills `customer_name`, `customer_email`, `subject`, `description`
   (all required). `status` is **not** chosen at creation — it defaults to `Open`.
2. Frontend blocks submit on missing/invalid fields with inline messages.
3. `POST /api/tickets` with `{customer_name, customer_email, subject, description}`.
4. Backend validates (422/400 on failure), generates `ticket_id`
   (e.g., `TKT-XXXXXX`, retry on collision), sets `created_at = updated_at = now()`.
5. Returns `201` with the created ticket (no notes yet: `notes: []`).
6. Frontend displays confirmation and routes to the new ticket's detail view.

### B. View Tickets

```text
Agent → Dashboard (/)
  → GET /api/tickets (no params = all, newest first)
  → SELECT * FROM tickets ORDER BY created_at DESC
  → 200 + ticket array (without notes)
  → Frontend renders table/list + loading/empty states
```

1. Dashboard mounts → `GET /api/tickets`.
2. Backend queries `tickets` ordered `created_at DESC`.
3. Frontend renders rows (ticket ID, subject, customer, status badge, dates).
   Shows skeleton while loading, "No tickets yet" when empty, error + retry on failure.

### C. Search Tickets

```text
Agent types query → (debounced) GET /api/tickets?search=<q> (+ status if set)
  → Backend ILIKE '%q%' over ticket_id, customer_name, customer_email,
     subject, description
  → 200 + matching tickets (newest first)
  → UI updates list in place
```

1. Agent types in the search box; frontend debounces (~300 ms) and issues
   `GET /api/tickets?search=<q>`, preserving any active status filter.
2. Backend trims the query; blank query = no search clause. Matching is
   case-insensitive substring (`ILIKE`) across the five fields above, ANDed
   with the status filter if present.
3. UI updates the list; zero matches shows "No tickets match…" (distinct from
   load error). Clearing the box re-fetches the unfiltered list.

### D. Filter Tickets

```text
Agent selects status (All / Open / In Progress / Closed)
  → GET /api/tickets?status=<value> (+ search if set)
  → Backend WHERE status = <value> (strict literal check)
  → 200 + filtered tickets
  → UI updates list; URL reflects ?status= for deep-linking
```

1. Dropdown defaults to **All** (param omitted).
2. Selecting a status sends `?status=Open` (etc.); invalid literals are rejected
   by the API (422/400), never silently treated as empty.
3. Filter composes with search: `GET /api/tickets?search=...&status=...`
   (AND semantics). Both states survive navigation via URL query string.

### E. View Ticket Details

```text
Agent clicks ticket → route /tickets/{ticket_id}
  → GET /api/tickets/{ticket_id}
  → SELECT ticket by ticket_id + SELECT notes ORDER BY created_at ASC
  → 200 + ticket with embedded notes[]
  → Frontend displays full details + notes timeline + status/note controls
```

1. Click navigates to `/tickets/{ticket_id}` (public `ticket_id`, e.g. `TKT-XXXXXX`).
2. Backend looks up by `ticket_id` (404 if unknown), then fetches its notes
   oldest-first.
3. Frontend shows every field (`ticket_id`, customer name/email, subject,
   description, status, `created_at`, `updated_at`) plus the notes timeline.
   Unknown ID renders a "Ticket not found" state (see §7).

### F. Update Ticket (Change Status and/or Add Note)

```text
Agent changes status and/or types a note → PUT /api/tickets/{ticket_id}
  {status?: "Open"|"In Progress"|"Closed", note?: "…"} (≥1 required)
  → Backend validates → transaction: UPDATE tickets (+ updated_at=now())
     and/or INSERT INTO notes
  → 200 + updated ticket with notes[]
  → Frontend refreshes detail state + list badge
```

1. Agent uses the status dropdown and/or the "Add note" box on the detail page.
2. Frontend sends one `PUT` containing `status` and/or `note`. Blank notes are
   blocked client-side.
3. Backend: 404 if ticket missing → validate (at least one field; status literal;
   note non-blank) → single transaction updating `tickets` (`updated_at = now()`
   on **any** change) and inserting the note row if present → return updated
   ticket with full notes list.
4. Frontend replaces detail state from the response (no second GET needed) and
   updates the status badge; failures surface as inline error + unchanged state.

---

## 5. Database Flow

Two tables, one-to-many. One ticket → zero-to-many notes.

```text
tickets (1) ─────< (N) notes
  id  PK                    id  PK
  ticket_id UNIQUE ───┐      ticket_fk FK → tickets.id (ON DELETE CASCADE)
                      │      content TEXT NOT NULL
                      │      created_at TIMESTAMPTZ DEFAULT now()
  customer_name       │
  customer_email      │      Notes are append-only in V1 (no updated_at,
  subject             │      no edit/delete). Ordered created_at ASC.
  description         │
  status (CHECK)      │      List view reads tickets only.
  created_at          │      Detail view reads ticket + its notes.
  updated_at          │
```

Key rules:

- `tickets.id` (integer) is the internal PK used by the FK; `tickets.ticket_id`
  (string, unique) is the public ID used in URLs and the UI.
- Uniqueness of `ticket_id` is enforced by the DB `UNIQUE` constraint; on the
  extremely unlikely collision the API generates another ID and retries.
- `notes.ticket_fk → tickets.id ON DELETE CASCADE` — deleting a ticket removes
  its notes (no orphan rows). No separate ticket-delete endpoint in V1.
- `tickets.status` is CHECK-constrained to `Open | In Progress | Closed`.
- `updated_at` changes on **every** `PUT` (status change and/or note append).
  `created_at` never changes.
- Indexes: `tickets(ticket_id)` unique, `tickets(status)`,
  `tickets(created_at DESC)`, `notes(ticket_fk)`.

---

## 6. API Flow

Base URL is environment-injected (e.g., `https://<api>.up.railway.app`).
All bodies are JSON. Timestamps are ISO-8601 UTC strings.

### 6.1 `POST /api/tickets` — Create ticket

- **Request:** `POST /api/tickets`
  ```json
  {
    "customer_name": "Jane Doe",
    "customer_email": "jane@example.com",
    "subject": "Cannot reset password",
    "description": "Reset link never arrives…"
  }
  ```
  (`status` is not accepted on create; client-sent `id`/`ticket_id`/timestamps
  are ignored.)
- **Backend processing:** Pydantic validation (all four required, non-blank;
  email format) → generate unique `ticket_id` → default `status = "Open"`.
- **Database interaction:** single `INSERT INTO tickets (...)`.
- **Response:** `201 Created`
  ```json
  {
    "id": 1,
    "ticket_id": "TKT-7KQ2XA",
    "customer_name": "Jane Doe",
    "customer_email": "jane@example.com",
    "subject": "Cannot reset password",
    "description": "Reset link never arrives…",
    "status": "Open",
    "created_at": "2026-09-18T10:00:00Z",
    "updated_at": "2026-09-18T10:00:00Z",
    "notes": []
  }
  ```
- **Possible errors:** `422/400` missing/blank field, invalid email;
  `500` DB failure (generic message).

### 6.2 `GET /api/tickets` — List tickets (search + filter)

- **Request:** `GET /api/tickets?search=<q>&status=<Open|In Progress|Closed>`
  (both optional; omit `status` = all).
- **Backend processing:** trim `search` (blank = ignore); strict-check `status`
  literal; build one parameterized query (search-across-5-fields AND status),
  `ORDER BY created_at DESC`. No pagination in V1.
- **Database interaction:** single `SELECT` on `tickets` (no notes join).
- **Response:** `200 OK` — array of ticket objects **without** `notes`
  (same shape as §6.1 minus `notes`).
- **Possible errors:** `422/400` invalid `status`; `500` DB failure.
  (Search never 404s — zero matches = `200 []`.)

### 6.3 `GET /api/tickets/{ticket_id}` — Ticket detail + notes

- **Request:** `GET /api/tickets/TKT-7KQ2XA`.
- **Backend processing:** look up by public `ticket_id` (exact, case-sensitive).
- **Database interaction:** `SELECT` ticket by `ticket_id` → if found,
  `SELECT * FROM notes WHERE ticket_fk = <id> ORDER BY created_at ASC`.
- **Response:** `200 OK` — ticket object **with** `notes` array:
  ```json
  {
    "id": 1, "ticket_id": "TKT-7KQ2XA",
    "customer_name": "Jane Doe", "customer_email": "jane@example.com",
    "subject": "…", "description": "…", "status": "In Progress",
    "created_at": "2026-09-18T10:00:00Z",
    "updated_at": "2026-09-18T11:30:00Z",
    "notes": [
      {"id": 5, "content": "Called customer, investigating.", "created_at": "2026-09-18T11:00:00Z"}
    ]
  }
  ```
- **Possible errors:** `404` unknown `ticket_id`; `500` DB failure.

### 6.4 `PUT /api/tickets/{ticket_id}` — Update status and/or add note

- **Request:** `PUT /api/tickets/TKT-7KQ2XA` — at least one field required:
  ```json
  { "status": "In Progress", "note": "Reproduced the issue, escalating." }
  ```
  (`status`-only, `note`-only, or both are all valid. Blank/whitespace-only
  `note` is invalid. Unknown fields ignored or rejected per schema strictness.)
- **Backend processing:** 404 check → validate (`status` literal; `note`
  non-blank; ≥1 field present) → single transaction.
- **Database interaction:** `UPDATE tickets SET status = …, updated_at = now()`
  (if status given) + `INSERT INTO notes (ticket_fk, content)` (if note given);
  always bumps `updated_at`, even for note-only updates. Re-read ticket + notes.
- **Response:** `200 OK` — updated ticket with full `notes[]` (same shape as §6.3).
- **Possible errors:** `404` unknown `ticket_id`; `422/400` empty body, invalid
  status, or blank note; `500` DB failure (transaction rolled back).

---

## 7. Error Flow

General rule: backend returns the correct HTTP code with `{"detail": ...}`;
frontend never shows a blank screen — every failure maps to inline text,
a not-found view, or a toast/banner with retry. Server logs keep the full
traceback; clients get safe messages only.

| Situation | API behavior | Frontend behavior |
|---|---|---|
| Ticket does not exist (`GET`/`PUT` unknown `ticket_id`) | `404 {"detail": "Ticket not found"}` | Detail view shows "Ticket not found" + back-to-dashboard link; update controls disabled |
| Invalid email on create | `422` validation error naming `customer_email` | Inline "Enter a valid email address" under the field; submit blocked until fixed |
| Required fields missing (`POST` without name/email/subject/description; `PUT` with neither `status` nor `note`) | `422/400` naming the missing field(s) | Inline per-field messages on the form; on `PUT`, "Add a note or change the status" hint |
| Invalid status (`?status=` or `PUT status` not exactly `Open`/`In Progress`/`Closed`) | `422/400 {"detail": "Invalid status…"}` | Filter resets to last valid value + toast; detail dropdown reverts, shows error |
| Database operation fails (down, constraint, timeout) | `500 {"detail": "Internal server error"}` (no internals leaked); transaction rolled back for `PUT` | Toast/banner "Something went wrong, try again" + Retry button; form input preserved so nothing is lost |
| API request fails (network error, CORS misconfig, cold start timeout, 5xx) | No response / non-2xx | List/detail show error state with Retry; create form keeps its draft; loading skeletons prevent layout jump |

Notes: search with zero matches is **not** an error (`200 []` + "no matches"
empty state). `PUT` failures leave the ticket unchanged (atomic transaction).

---

## 8. Deployment Flow

```text
User browser (HTTPS)
  → Vercel: React SPA static build (VITE_API_BASE_URL baked per env)
  → Railway/Render: FastAPI (Uvicorn, $PORT, DATABASE_URL + CORS_ORIGINS set)
  → Managed PostgreSQL (same provider, private DATABASE_URL)
```

1. **Database:** provision managed Postgres on Railway/Render; note the
   `DATABASE_URL`. Create schema (`tickets`, `notes`, constraints, indexes)
   via the V1 migration/SQL script at deploy time.
2. **Backend:** deploy FastAPI service from `main` (or backend subfolder).
   Set `DATABASE_URL`, `CORS_ORIGINS=https://<app>.vercel.app`, `PORT`.
   Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   Smoke test: `GET /health` → 200; `GET /docs` loads.
3. **Frontend:** Vercel project rooted at the frontend folder. Set
   `VITE_API_BASE_URL=https://<api>.up.railway.app`. Deploy on push to `main`.
   Smoke test: dashboard loads, create → search → filter → detail → status+note
   round-trip works against the deployed API.
4. **Evaluator path:** public Vercel URL only. No credentials, no VPN, no local
   setup. CORS allowlist must include the exact production (and preview, if used)
   frontend origins, otherwise browser calls fail while `curl` succeeds.

---

## 9. Future Extension Points (Out of Scope for V1 — Do Not Build)

These are named here only so V1 does not block them later. None are designed,
scheduled, or to be implemented now.

- **Authentication** — login for agents (e.g., JWT sessions); turns the shared
  workspace into per-user access. Touches: `users` table, auth middleware, CORS
  with credentials, login UI.
- **Multiple support agents** — agent identities on tickets/notes (`author`
  on notes, `updated_by`); needs auth first.
- **Ticket assignment** — `assignee` field + "assigned to me" filter; needs
  agent identities.
- **Priority** — e.g., Low/Medium/High/Urgent: new constrained column + filter
  + badge; same pattern as `status` (DEC-007).
- **Customer profiles** — `customers` table (name/email → repeat-ticket history)
  replacing free-text name/email per ticket.
- **Attachments** — file upload (object storage like S3/R2 + `attachments`
  table with ticket FK); out of scope due to storage/virus-scan concerns.
- **Analytics** — counts by status, response-time dashboards; read-only
  aggregations over existing tables, no schema change needed to start.
- **Multiple communication channels** — email/web-chat ingestion creating
  tickets via the same `POST` core; needs inbound adapters + dedupe, API unchanged.
