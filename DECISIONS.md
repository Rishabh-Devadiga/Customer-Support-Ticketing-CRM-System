# Decision Log

This document records meaningful architectural and technical decisions for the
Customer Support Ticketing CRM System. Its purpose is to answer:
"Why did we build it this way instead of another way?"

Proposed stack (React + TypeScript + Tailwind / FastAPI / PostgreSQL /
Vercel + Railway-or-Render) is **accepted as-is**. No strong technical reason
was found to change it for the stated requirements. No stack change is proposed
in this document.

Scope guardrails: no microservices, no AI/LLM features, no authentication,
no bonus features in V1. See `FLOW.md` §9 for explicitly deferred ideas.

## Approval Record (2026-09-18)

Owner-reviewed and **APPROVED**: React + TypeScript + Tailwind frontend;
Python FastAPI backend; PostgreSQL database; Vercel + Railway/Render
deployment; REST API; exactly 4 required ticket endpoints;
tickets → notes one-to-many relationship; internal integer `id` + public
`TKT-XXXXXX` `ticket_id`; server-side search and filtering;
Pydantic + frontend + DB validation; append-only notes; no pagination/sorting
in V1; unrestricted status transitions; new tickets always start as `Open`;
`GET /health`; `.env.example`.

Binding clarifications locked for implementation:

- Ticket IDs are generated server-side as `TKT-XXXXXX` and must be unique.
  The extremely unlikely collision is handled by generating another ID
  (application retry loop), and uniqueness is enforced at the database level
  (`UNIQUE` constraint) — see DEC-006.
- `PUT /api/tickets/{ticket_id}` accepts `status` and/or `note`; at least one
  must be supplied; blank notes are rejected; status-only and note-only updates
  are valid; `updated_at` is updated when either changes; the status update and
  the note insertion are atomic (single transaction) — see DEC-008.

---

## DEC-001 — Frontend Framework (React + TypeScript + Tailwind CSS)

### Decision
Use React with TypeScript and Tailwind CSS as a standalone single-page
application (SPA) that talks to the backend only over HTTP JSON.

### Alternatives Considered
- Plain JavaScript React without TypeScript.
- Alternative frameworks: Vue, Svelte, Next.js (SSR), or server-rendered
  templates from FastAPI (Jinja).
- Alternative styling: plain CSS, CSS modules, MUI/Chakra component library.

### Why
- React is the proposed stack, widely known, and has the largest hiring-assessment
  familiarity; evaluators can read it quickly.
- TypeScript catches contract mismatches (e.g., `status` literals, ticket shape)
  at build time, which directly supports "readable code" and "proper error handling".
- Tailwind provides good UX quickly with utility classes and works well on Vercel
  with zero CSS build complexity.

### Tradeoff
- TypeScript adds type-definition overhead vs. plain JS.
- Tailwind's utility classes can bloat JSX readability if overused; mitigated by
  small reusable components.

### Consequence
- Frontend lives in its own folder/project, built with `npm run build`, deployed
  to Vercel as static assets.
- All backend communication goes through a single configurable base URL
  (see DEC-013).

---

## DEC-002 — Backend Framework (Python FastAPI)

### Decision
Use Python FastAPI for the REST API, with Pydantic v2 schemas for
request/response validation and serialization.

### Alternatives Considered
- Flask or Django / Django REST Framework.
- Node.js (Express/NestJS) to share TypeScript with the frontend.
- FastAPI with GraphQL or tRPC instead of REST.

### Why
- FastAPI is the proposed stack and fits the required CRUD API exactly
  (4 endpoints, JSON in/out).
- Built-in OpenAPI docs (`/docs`) let an evaluator inspect and try the API
  with no extra work.
- Pydantic gives declarative validation (required fields, email format, status
  literals) with consistent 422 error responses.
- Async-ready but V1 can stay synchronous; no extra complexity needed.

### Tradeoff
- Python backend + TypeScript frontend means two languages (vs. all-TypeScript
  Node stack). Accepted because the assessment specifies Python/FastAPI.
- FastAPI's automatic 422 errors must be shaped/documented so the frontend can
  display them cleanly (see DEC-011).

### Consequence
- Backend exposes only the endpoints in `FLOW.md` §6 under the `/api` prefix.
- Every request is validated by a Pydantic schema before touching the database.

---

## DEC-003 — Database Choice (PostgreSQL)

### Decision
Use managed PostgreSQL (Railway or Render) as the single system of record.
No SQLite, no NoSQL, no second datastore.

### Alternatives Considered
- SQLite (zero-config local file DB).
- MySQL / MariaDB.
- NoSQL (MongoDB, Firebase/Firestore).
- Backend-hosted embedded DB or in-memory store.

### Why
- PostgreSQL is the proposed stack and matches the relational model
  (tickets one-to-many notes) with real foreign keys and constraints.
- `ILIKE` gives simple case-insensitive search with no extra services.
- `timestamptz` + defaults handle `created_at` / `updated_at` cleanly.
- Managed Postgres on Railway/Render is publicly reachable by the deployed
  backend and needs no manual ops.

### Tradeoff
- Requires a `DATABASE_URL` and a managed instance (vs. SQLite's zero setup).
- Local development needs either local Postgres or a dev cloud instance;
  mitigated with Docker Compose or a shared dev URL documented later.

### Consequence
- Schema uses standard SQL (SERIAL/UUID, VARCHAR, TEXT, FK, CHECK) — portable
  across local and hosted Postgres.
- No application-level joins in memory; all filtering/searching happens in SQL.

---

## DEC-004 — API Architecture (REST JSON, Resource-Oriented, Stateless)

### Decision
**Status: APPROVED (2026-09-18) — exactly these 4 endpoints in V1, no extra routes.**

Build a stateless REST JSON API under the `/api` prefix with no versioning in V1:

- `POST /api/tickets` — create
- `GET /api/tickets` — list (with optional `search` and `status` query params)
- `GET /api/tickets/{ticket_id}` — ticket detail + notes
- `PUT /api/tickets/{ticket_id}` — update status and/or append a note

No GraphQL, no RPC actions, no server sessions.

### Alternatives Considered
- Versioned prefix (`/api/v1/...`) from day one.
- Separate sub-resources (`POST /api/tickets/{id}/notes`,
  `PATCH /api/tickets/{id}/status`).
- GraphQL single-endpoint API.

### Why
- Exactly matches the required API operations with the smallest surface area.
- Resource-oriented REST is the most readable choice for CRUD and maps 1:1 to
  the agent's mental model (tickets list → ticket detail).
- Folding "update status" and "add note" into one `PUT` keeps the contract to
  4 endpoints as specified; separate note endpoints can be added later without
  breaking clients.
- No version prefix in V1 avoids dead version scaffolding; versioning is a
  future extension point if breaking changes appear.

### Tradeoff
- A single `PUT` doing two things (status change + note append) is slightly less
  "pure REST" than `PATCH /status` + `POST /notes`. Accepted for spec compliance
  and simplicity; request shape makes the intent explicit (see `FLOW.md` §6).
- No versioning means any future breaking change needs a migration plan.

### Consequence
- Frontend needs only one API client with 4 methods.
- `GET` responses embed notes inside the ticket detail; list responses do not
  (keeps list payload small).

---

## DEC-005 — Database Schema Approach (Normalized: Tickets + Notes)

### Decision
Use two normalized tables with a one-to-many relationship:

- `tickets` — one row per ticket. Holds all required fields:
  `id`, `ticket_id`, `customer_name`, `customer_email`, `subject`,
  `description`, `status`, `created_at`, `updated_at`.
- `notes` — one row per comment: `id`, `ticket_fk` → `tickets.id`,
  `content`, `created_at`.

`GET` detail joins both; `GET` list reads `tickets` only.

### Alternatives Considered
- Single `tickets` table with a `notes` JSONB array column.
- Single table with denormalized latest-note fields.
- Three+ tables (customers, agents, tickets, notes) up front.

### Why
- A separate Notes table is explicitly suggested and is the correct relational
  shape: unbounded comments per ticket, each with its own timestamp.
- Normalized rows allow ordering, counting, and future per-note features
  (author, edit) without migrating a JSON blob.
- Two tables are the minimum that satisfies the requirements — anything more
  (customers/agents tables) is over-engineering before auth/assignment exists.

### Tradeoff
- Detail view requires a join/second query vs. single-row read of a JSONB design.
  Negligible at this scale and far more maintainable.
- Notes have no `updated_at` in V1 (append-only, immutable); editing history is
  deferred.

### Consequence
- Foreign key `notes.ticket_fk → tickets.id ON DELETE CASCADE`.
- Indexes on `tickets(ticket_id)` (unique), `tickets(status)`,
  `tickets(created_at DESC)`, `notes(ticket_fk)`.

---

## DEC-006 — Ticket ID Generation (Internal Integer `id` + Public `ticket_id`)

### Decision
**Status: APPROVED (2026-09-18) — server-side `TKT-XXXXXX`, unique, retry on
collision, DB-level `UNIQUE`.**

Keep two identifiers:

- `id` (SERIAL INTEGER PRIMARY KEY) — internal, used for foreign keys and joins.
  Never shown in URLs.
- `ticket_id` (VARCHAR UNIQUE NOT NULL) — public, human-readable, generated
  **server-side** on `POST`, e.g. `TKT-XXXXXX` (short random alphanumeric,
  uppercase, unambiguous characters). All API URLs use `{ticket_id}`.

### Alternatives Considered
- Expose auto-increment integer IDs directly in URLs.
- Use raw UUIDv4 as the public ID.
- Let the frontend generate the ticket ID.
- Timestamp-prefixed IDs (e.g., `TCK-2026-000123` with a sequence).

### Why
- Human-readable `TKT-XXXXXX` is easy for an agent to read over the phone, fits
  the "Ticket ID" concept in a CRM, and does not leak table size like sequential
  integers.
- Server-side generation prevents collisions and untrusted client input.
- Keeping the integer PK for FKs keeps joins narrow and fast while the public
  string stays stable in URLs and the UI.

### Tradeoff
- Random IDs need a uniqueness retry loop (on unique-violation, regenerate).
  Probability of collision is negligible but the code path must exist.
- Two IDs can confuse newcomers; mitigated by naming (`id` vs `ticket_id`)
  and documenting that URLs always use `ticket_id`.

### Consequence
- `POST /api/tickets` ignores any client-supplied `id`/`ticket_id`/`timestamps`.
- `ticket_id` is UNIQUE indexed; lookup by `ticket_id`, join by `id`.
- Uniqueness is enforced at the database level by the `UNIQUE` constraint; on
  the extremely unlikely collision the application generates another ID and
  retries (retry loop lives in the `POST` handler, added with the endpoints).

---

## DEC-007 — Status Representation (Plain String + CHECK Constraint)

### Decision
Store `status` as `VARCHAR NOT NULL DEFAULT 'Open'` with a database
`CHECK (status IN ('Open', 'In Progress', 'Closed'))`. Validate with a shared
literal in Pydantic (`Literal["Open", "In Progress", "Closed"]`) and a
TypeScript union (`"Open" | "In Progress" | "Closed"`).

### Alternatives Considered
- Native Postgres `ENUM` type.
- Integer codes (0/1/2) with a lookup map.
- Free-form string with application-only validation.

### Why
- Exact match to the required status values; readable in the DB, API, and UI
  with no translation layer.
- CHECK constraint is simpler to migrate than a native ENUM (no custom type to
  alter) and still enforces integrity at the lowest layer.
- Single source of truth per layer (DB CHECK, Pydantic Literal, TS union)
  keeps validation consistent.

### Tradeoff
- String comparison is marginally heavier than integers; irrelevant at this scale.
- Adding a future status (e.g., "On Hold") requires touching DB CHECK + backend
  schema + frontend union — a deliberate, visible change.

### Consequence
- Invalid status → `400/422` from the API (see DEC-011); never written to DB.
- Frontend renders status as a badge/dropdown bound to the same three literals.

---

## DEC-008 — Notes Implementation (Separate Table, Append-Only via PUT)

### Decision
**Status: APPROVED (2026-09-18) — `status` and/or `note`, ≥1 required, blank
notes rejected, `updated_at` on either change, atomic transaction.**

Implement notes as rows in the `notes` table, appended through
`PUT /api/tickets/{ticket_id}` with an optional `note` string field.
A `PUT` must contain at least one of `status` or `note`. Notes are immutable
in V1 (no edit/delete endpoints). `updated_at` on the parent ticket is bumped
whenever a note is appended or the status changes. Detail responses return
notes ordered by `created_at ASC`.

### Alternatives Considered
- Dedicated `POST /api/tickets/{id}/notes` endpoint.
- Overwriting a single `latest_note` column on `tickets`.
- Fully editable/deletable notes with their own CRUD.

### Why
- Satisfies "add notes/comments" within the required 4-endpoint contract —
  no invented endpoints in V1.
- Append-only history matches support-workflow expectations (audit trail of
  what the agent wrote and when).
- Bumping `updated_at` on note-add keeps "recently active" sorting meaningful.

### Tradeoff
- Combined `PUT` semantics must be clearly documented (see `FLOW.md` §6) so a
  status-only update does not accidentally create an empty note; empty/blank
  notes are rejected.
- No note editing means typos persist; acceptable for V1, noted as extension.

### Consequence
- `PUT` with `note` → `INSERT INTO notes`; `PUT` with `status` → `UPDATE tickets`.
  Both in one transaction.
- Blank `note` (`""` / whitespace-only) is a validation error, not a silent no-op.
- `PUT` returns exactly `{success: true, updated_at}` per the assessment
  contract; the client re-fetches the detail for the updated ticket + notes.

---

## DEC-009 — Frontend/Backend Separation (Decoupled SPA + API, CORS Allowlist)

### Decision
Deploy frontend and backend as independent services communicating only via
HTTPS JSON. Backend enforces a CORS allowlist sourced from environment config.
No server-side rendering, no backend-served frontend bundle in production.

### Alternatives Considered
- Monolith: FastAPI serves the React build from the same process/domain.
- Monorepo single deployment (e.g., everything on Render).
- Shared-database or direct-DB access from the frontend.

### Why
- Matches the required deployment (Vercel frontend + Railway/Render backend)
  and lets each side scale/deploy independently.
- Keeps a clean contract: the OpenAPI spec is the only coupling point, which
  aids readability and maintainability.
- Frontend never sees database credentials; all secrets stay server-side.

### Tradeoff
- Two deployments to manage + CORS configuration to get right (origin, methods,
  headers). Mitigated by env-driven CORS (see DEC-013).
- Local development requires running two processes (or documented proxy).

### Consequence
- Frontend API base URL is environment-injected, never hardcoded.
- Backend validates `Origin` against an explicit allowlist; wildcard `*` is
  forbidden when credentials are ever introduced.

---

## DEC-010 — Search Implementation (Backend `ILIKE`, Multi-Field, Combined with Filter)

### Decision
**Status: APPROVED (2026-09-18) — server-side search, no pagination in V1.**

Implement search **server-side** in `GET /api/tickets?search=...` using
parameterized `ILIKE '%query%'` across `ticket_id`, `customer_name`,
`customer_email`, `subject`, and `description`, ordered newest-first.
Search composes with `?status=` in a single query. Empty/blank search returns
unfiltered results.

### Alternatives Considered
- Frontend-only filtering of a fully fetched list.
- Postgres full-text search (`tsvector`/`tsquery`) or trigram (`pg_trgm`) indexes.
- External search service (Elasticsearch/Typesense/Algolia).

### Why
- Backend search works regardless of list size and keeps list payloads small;
  frontend-only search breaks as soon as the ticket count grows.
- `ILIKE` needs no extensions, migrations, or extra services — the simplest
  thing that satisfies "search tickets".
- Searching the five agent-facing fields matches how support agents actually
  look things up (name, email, ticket ID, subject keywords).

### Tradeoff
- Leading-wildcard `ILIKE` cannot use plain B-tree indexes efficiently; slower
  than trigram/full-text at very large scale. Acceptable for a support CRM V1;
  `pg_trgm` is the documented upgrade path, not V1 scope.
- No relevance ranking or typo tolerance in V1.

### Consequence
- Frontend debounces search input and sends it as a query param; it does not
  implement its own search logic.
- Query is always parameterized (ORM-bound); never string-interpolated (SQL
  injection prevention).

---

## DEC-011 — Filtering Implementation (Backend `status` Query Param, Strict Validation)

### Decision
**Status: APPROVED (2026-09-18) — server-side single-status filter, strict literals.**

Implement status filtering **server-side** via `GET /api/tickets?status=...`.
`status` must be exactly one of `Open`, `In Progress`, `Closed` or omitted
(all statuses). Invalid values return `422/400`, not silent empty results.
`status` composes with `search` (AND semantics).

### Alternatives Considered
- Frontend-only filtering of a full list.
- Multi-status (`?status=Open,Closed`) or case-insensitive matching in V1.
- Separate endpoints per status.

### Why
- Server-side filtering keeps the list endpoint stateless and the DB the source
  of truth; frontend stays a thin renderer of `?status=` state (also deep-linkable).
- Strict validation surfaces agent/URL mistakes immediately instead of showing a
  misleading empty list.

### Tradeoff
- Single-status-only in V1 (no multi-select). Multi-select is a trivial future
  additive change (`status[]` params) if requested.
- Case-sensitive exact match requires the frontend dropdown to send canonical
  literals — enforced by the shared TS union type.

### Consequence
- Frontend filter control is a dropdown bound to the three literals + "All".
- List ordering is fixed newest-first (`created_at DESC`); sorting controls are
  out of V1 scope.

---

## DEC-012 — Error Handling Strategy (Consistent Status Codes + JSON Shape, Friendly UI)

### Decision
Backend returns standard HTTP status codes with a consistent JSON error body
(`{"detail": ...}` — FastAPI default, string or list for validation errors).
Frontend maps every failure to an explicit UI state: inline field errors for
validation, "not found" page for 404, toast/banner + retry for network/500.

Backend status-code contract:

| Situation | Code |
|---|---|
| Validation failure (missing field, bad email, bad status, blank note, empty PUT) | 422 (Pydantic) or 400 (business rule) |
| Ticket ID not found | 404 |
| Database/dependency failure | 500 (generic message; details logged server-side only) |
| Success create | 201; success read/update | 200 |

### Alternatives Considered
- Always-200 responses with `{success: false}` envelopes.
- Leaking raw exception traces to the client.
- Silent failures / console-only logging on the frontend.

### Why
- Standard codes let the frontend, evaluator (`curl`/docs), and future clients
  reason uniformly; no custom envelope to learn.
- Generic 500 messages avoid leaking DB internals while server logs retain the
  traceback for debugging.
- Explicit UI states satisfy "good user experience" and "proper error handling"
  without inventing an error framework.

### Tradeoff
- Two validation codes (400 vs 422) require frontend to handle both; mitigated
  by a single error-parsing helper.
- No global error-tracking service (e.g., Sentry) in V1; logs only.

### Consequence
- Every endpoint documents its error cases (see `FLOW.md` §7).
- Frontend never shows a blank screen on API failure; loading/error/empty states
  are required for list and detail views.

---

## DEC-013 — Validation Strategy (Defense in Depth: UI → Pydantic → Database)

### Decision
**Status: APPROVED (2026-09-18).**

Validate at three layers, with Pydantic as the authoritative contract:

1. **Frontend** — required-field, format (email regex), and max-length checks
   for immediate UX; blocks obviously bad submits.
2. **Backend (Pydantic)** — required vs. optional, `EmailStr` for
   `customer_email`, status literals, non-blank note, `PUT` requires ≥1 field.
   Trims whitespace on string inputs.
3. **Database** — `NOT NULL`, `CHECK` on status, `UNIQUE` on `ticket_id`,
   FK integrity, sensible length caps.

### Alternatives Considered
- Frontend-only validation.
- Backend-only validation.
-Regex-only email validation at the DB level.

### Why
- Frontend validation is UX (fast feedback); it is never trust (bypassable).
- Pydantic is the single enforceable API contract both docs and tests target.
- DB constraints are the last line of defense against bugs bypassing the API.

### Tradeoff
- Some rules exist in three places (e.g., "email required"). Duplication is
  deliberate and minimal; Pydantic remains canonical if layers disagree.

### Consequence
- `POST` requires `customer_name`, `customer_email`, `subject`, `description`;
  `status` is not accepted on create — new tickets always start as `Open`.
- Invalid email → rejected at submit (frontend) and at API (422) — see
  `FLOW.md` §7.

---

## DEC-014 — Environment Variables (Strict Separation of Config and Code)

### Decision
All environment-specific values come from environment variables; no URLs,
credentials, or origins are hardcoded. A checked-in `.env.example` documents
every key with safe placeholders.

| Key | Used by | Example |
|---|---|---|
| `DATABASE_URL` | Backend | `postgresql+psycopg://user:pass@host:5432/crm` |
| `FRONTEND_URL` / `CORS_ORIGINS` | Backend (CORS allowlist) | `https://<app>.vercel.app` |
| `VITE_API_BASE_URL` (or equivalent `*_API_*` for the chosen React scaffold) | Frontend (API base) | `https://<api>.up.railway.app` |
| `PORT` | Backend (host-provided) | `8000` |

### Alternatives Considered
- Hardcoding localhost URLs and editing code per environment.
- Committing real `.env` files for convenience.
- Storing config in code constants with per-env branches.

### Why
- "Easy deployment" and evaluator-friendly hosting require zero-code-change
  promotion from local → preview → production.
- Keeping secrets out of git is non-negotiable for a publicly deployed app.

### Tradeoff
- Misconfigured env is the most likely deploy failure (CORS errors, dead API
  base). Mitigated by startup validation (backend fails fast with a clear log
  if `DATABASE_URL` is missing) and `.env.example`.

### Consequence
- Backend reads config once at startup. `DATABASE_URL` defaults to local
  Postgres for development; production MUST set the real `DATABASE_URL`
  (otherwise every DB operation fails loudly with a 500 per the error
  contract). A startup table-creation failure is logged as a warning without
  crashing so the `GET /health` liveness probe stays meaningful — see DEC-016.
- Frontend bakes `VITE_API_BASE_URL` at build time per Vercel environment
  (production vs. preview).

---

## DEC-015 — Deployment Architecture (Vercel Static + Railway/Render API + Managed Postgres)

### Decision
**Status: APPROVED (2026-09-18).**

Deploy three units on managed platforms:

- **Frontend** → Vercel (static build of the React SPA).
- **Backend** → Railway or Render (FastAPI via Uvicorn).
- **Database** → managed PostgreSQL on the same provider as the backend
  (reduces latency, keeps `DATABASE_URL` private to the provider network).

Browser → Vercel (HTTPS) → backend public URL (HTTPS JSON) → private/managed
Postgres. See `FLOW.md` §8.

### Alternatives Considered
- All-in-one single host (frontend + backend + DB on one Render/Railway service).
- Docker/self-hosted VPS.
- SQLite file next to the backend.
- Vercel serverless functions as the backend.

### Why
- Follows the proposed deployment direction and plays to each platform's
  strength (Vercel CDN for static; Railway/Render long-running process +
  managed Postgres for FastAPI).
- Public evaluator access with no ops: push-to-deploy, managed TLS, managed
  backups, free/low-cost tiers.
- Co-locating API and DB on one provider minimizes latency and egress.

### Tradeoff
- Two deployables + CORS + two URLs to configure (vs. single-origin monolith).
  Accepted as the cost of the required topology.
- Free-tier backends may cold-start/sleep → first request can be slow;
  mitigated with frontend loading states, not architecture changes.
- No containers/K8s/CI-CD pipelines in V1; provider auto-deploy from `main`
  is sufficient.

### Consequence
- Required runbooks for V1: Vercel project (root = frontend, `VITE_API_BASE_URL`
  set), backend service (start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`,
  `DATABASE_URL` + `CORS_ORIGINS` set), schema created via startup migration/SQL.
- Health check `GET /health` (root path, not under `/api`) is the deployment
  smoke test; it must not expose secrets.

---

## DEC-016 — Schema Migration Approach (`create_all` on Startup, No Alembic in V1)

### Decision
**Status: APPROVED — owner review, ticket API milestone.**

Create the two-table schema with SQLAlchemy `Base.metadata.create_all()` at
application startup (`init_db()` in the lifespan handler). No Alembic or other
migration tooling in V1.

### Alternatives Considered
- Alembic autogenerate + versioned migrations from day one.
- Hand-written `schema.sql` applied manually per environment.
- A separate one-off init script run by the deployer.

### Why
- Greenfield V1 has exactly two tables and no production data to preserve yet;
  `create_all(checkfirst=True)` is idempotent and needs no extra dependency,
  config, or deploy step — the fastest path to "easy deployment".
- A startup failure to reach the DB is logged as a warning without crashing,
  so `GET /health` (liveness) stays meaningful and DB errors surface as 500s
  per the error contract (see DEC-012/DEC-014).

### Tradeoff
- `create_all` cannot evolve an existing schema (no ALTERs); the first future
  breaking schema change requires introducing Alembic (or equivalent) then.
  Accepted: that cost lands only if/when the schema actually changes.

### Consequence
- Deploy needs no migration step: start the API with a valid `DATABASE_URL`
  and the tables appear.
- Any future column/table change must switch to versioned migrations; do not
  extend the `create_all`-only approach past V1 if the schema evolves.

---

## DEC-017 — Frontend Scaffold (Vite + React Router + Tailwind v4)

### Decision
**Status: APPROVED — frontend planning.**

Scaffold with Vite `react-ts`, route with `react-router-dom`
(`/`, `/tickets/new`, `/tickets/:ticketId`), style with Tailwind v4 via
`@tailwindcss/vite`. No other frontend libraries in V1.

### Alternatives Considered
- Create React App (deprecated, slow, no longer maintained).
- Next.js (SSR framework; overkill for a static SPA and conflicts with the
  approved Vercel-static deployment in DEC-015).
- Wouter / TanStack Router (smaller or more powerful, but less familiar to
  evaluators than react-router).

### Why
- Vite is the current standard React scaffold: instant dev server, trivial
  `npm run build`, first-class Vercel support.
- Deep-linkable routes (`/`, ticket detail) are required by FLOW §4D/§4E, so a
  real router beats state-only navigation.
- Tailwind v4 needs no config file and matches DEC-001.

### Tradeoff
- One extra runtime dependency (react-router-dom). Accepted: routing is
  required functionality, not a nice-to-have.

### Consequence
- `frontend/` is the Vite root and later the Vercel project root.
- Frontend dev server runs on port 5173 (already in backend default
  `CORS_ORIGINS`).

---

## DEC-018 — API Client (Native Fetch, No Axios)

### Decision
**Status: APPROVED — frontend planning.**

One small fetch wrapper (`frontend/src/api/client.ts`) with a typed
`ApiError(status, detail)` parsed from FastAPI's `{detail}` bodies. Four
endpoint functions matching DEC-004. No Axios.

### Alternatives Considered
- Axios (interceptors, transforms, wider familiarity).
- OpenAPI codegen (orval/openapi-typescript-codegen).

### Why
- Four endpoints with JSON in/out need no interceptors or transforms; ~60
  lines of fetch cover base URL, methods, and error parsing.
- Codegen adds a build step and dependency for an API small enough to mirror
  by hand (types in `types/tickets.ts` match `app/schemas.py` 1:1).

### Tradeoff
- Hand-mirrored types can drift from backend schemas; mitigated by keeping
  both shapes minimal and reviewing them together at each milestone.

### Consequence
- `VITE_API_BASE_URL` is the only runtime config, read once in the client.

---

## DEC-019 — Filter State in URL + Debounce + Abort Stale Requests

### Decision
**Status: APPROVED — frontend planning.**

Dashboard filter state lives in URL query params (`?search=&status=`,
`All` = param omitted); search input debounces ~300 ms before committing to
the URL; every list/detail fetch uses `AbortController` and ignores
`AbortError` silently.

### Alternatives Considered
- Component-local filter state (simpler, but breaks FLOW §4D deep-linking).
- No debounce (a request per keystroke; wasteful and flickery).
- No abort (last-response-wins race: slow earlier request overwrites newer results).

### Why
- Implements FLOW §4C/§4D exactly: debounce interval, deep-linkable filters,
  search AND-composed with status server-side.
- Abort is the standard fix for out-of-order responses with zero dependencies.

### Tradeoff
- URL and input can briefly disagree mid-debounce (input shows keystrokes,
  results follow 300 ms later). Accepted: this is the expected debounced UX.

### Consequence
- Back/forward, bookmark, and refresh preserve the dashboard view.
- `AbortError` is swallowed, never shown as an error state.
