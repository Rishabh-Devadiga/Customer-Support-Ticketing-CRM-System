# Customer Support Ticketing CRM

Web-based ticketing CRM for customer support agents: create, search, filter,
read, and update support tickets with an append-only notes history.

- **Frontend:** React + TypeScript + Tailwind CSS (Vite SPA)
- **Backend:** Python FastAPI + SQLAlchemy + Pydantic
- **Database:** PostgreSQL (single managed instance)
- **Deploy:** Vercel (frontend) + Render or Railway (backend + database)

Design docs are the source of truth: [`DECISIONS.md`](DECISIONS.md) (why this
shape) and [`FLOW.md`](FLOW.md) (how the system behaves).

## Architecture

```text
Support Agent (browser, HTTPS)
  → React SPA (Vercel static)
  → FastAPI REST JSON API (Render/Railway, Uvicorn)
  → Managed PostgreSQL (same provider as the API)
```

The browser never talks to the database. The API is stateless; all
search/filtering happens server-side in SQL.

## Repository layout

```text
app/            FastAPI backend (config, database, models, schemas, tickets router)
frontend/       Vite React SPA (pages, components, api client, types, hooks)
DECISIONS.md    Architecture decision log
FLOW.md         System behavior / flows / API contracts
requirements.txt Backend dependencies
```

## Local setup

Prerequisites: Python 3.12+, Node 20+, local PostgreSQL.

Backend:

```bash
pip install -r requirements.txt
cp .env.example .env        # then edit DATABASE_URL
uvicorn app.main:app --reload   # http://localhost:8000, docs at /docs
```

Frontend (new terminal):

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:8000
npm run dev                 # http://localhost:5173
```

## Environment variables

Backend (repo-root `.env`; see `.env.example`):

| Key | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection (psycopg driver) | `postgresql://user:pass@localhost:5433/support_crm` |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins (no `*`) | `http://localhost:5173,http://localhost:3000` |
| `ENVIRONMENT` | Informational only | `local` |
| `PORT` | Consumed by the Uvicorn CLI / host, e.g. `--port $PORT` | `8000` |

Frontend (`frontend/.env`; see `frontend/.env.example`):

| Key | Purpose | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend base URL, baked at build time | `http://localhost:8000` |

Never commit real secrets: both `.env` files are gitignored.

## API endpoints

Base URL from `VITE_API_BASE_URL`. Timestamps are ISO-8601 UTC.

| Method | Path | Purpose | Success |
|---|---|---|---|
| `POST` | `/api/tickets` | Create (no `status` accepted; always `Open`, server `TKT-XXXXXX` id) | `201` ticket |
| `GET` | `/api/tickets` | List newest-first; `?search=` (5 fields) + `?status=` (exact literal) | `200` array |
| `GET` | `/api/tickets/{ticket_id}` | Detail with notes oldest-first | `200` ticket / `404` |
| `PUT` | `/api/tickets/{ticket_id}` | `{status?, note?}` (≥1, atomic, bumps `updated_at`) | `200 {success, updated_at}` |
| `GET` | `/health` | Liveness / deploy smoke test | `200 {status: ok}` |

Errors use `{"detail": ...}`: `422` validation, `404` unknown ticket,
`500` generic (internals stay in server logs).

## Testing

Frontend integration suite runs against a live backend + PostgreSQL:

```bash
# terminal 1: backend with a valid DATABASE_URL in root .env
uvicorn app.main:app --port 8000
# terminal 2:
cd frontend
npm test -- --run   # 26 tests: dashboard, create, detail, error paths
npm run build       # tsc strict + production bundle
```

`DashboardPage.empty` needs an emptied table, so it is excluded from the
default suite; run it explicitly after a wipe (it asserts the "No tickets yet"
state).

## Manual deployment (owner executes)

### 1. Database (Render or Railway)

Provision managed PostgreSQL on the same provider as the backend. Tables are
created automatically at API startup (`create_all`, DEC-016) — no migration
step. Note the `DATABASE_URL`.

### 2. Backend (Render or Railway)

- Root directory: repo root. Build: `pip install -r requirements.txt`.
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Env: `DATABASE_URL` (provider value), `CORS_ORIGINS=https://<app>.vercel.app`.
- Smoke: `GET /health` → 200; `GET /docs` loads.

### 3. Frontend (Vercel)

- Project root directory: `frontend/`. Build command `npm run build`.
- Env: `VITE_API_BASE_URL=https://<api-host>` (production backend URL).
- Smoke: dashboard lists tickets; create → search → filter → detail →
  status + note round-trip works against the deployed API.

Deployment order matters: database → backend (set `CORS_ORIGINS` to the final
Vercel URL) → frontend. CORS is an exact allowlist — `curl` succeeding while
the browser fails almost always means the frontend origin is missing there.
