# Edwards Project Operation Board - Claude Code Guide

> **Created**: 2026-02-12 (Thu) 00:35 UTC  
> **Updated**: 2026-02-12 (Thu) 00:35 UTC

Engineering resource management system for EUV Program IS. Replaces SharePoint/Excel with unified web application for worklog tracking, resource forecasting, and milestone management.

## Quick Commands

```bash
./run.py all              # All services (DB + Backend + Frontend) in Docker
./run.py status           # Check status
./run.py stop             # Stop all

# Local development
./run.py dev              # DB in Docker, backend/frontend locally
./run.py local-backend    # uvicorn --reload --port 8004
./run.py local-frontend   # pnpm dev --port 3004
```

## Architecture Overview

**Tech Stack:**
- **Backend:** FastAPI + SQLAlchemy + Alembic (PostgreSQL 15)
- **Frontend:** React 19 + Vite + TanStack Query v5 + Tailwind CSS
- **Auth:** JWT + SSO/SAML 2.0 (Microsoft Entra ID)
- **Deployment:** Docker Compose + GitHub Actions

**Port Convention:** Port suffix **4** → DB 5434, Backend 8004, Frontend 3004

**Key URLs:**
- Frontend: http://localhost:3004
- Backend API: http://localhost:8004 | Docs: /docs
- Default login: `admin@edwards.com` / `password`

## Project Structure

```
.
├── CLAUDE.md              # ← You are here
├── .claude/
│   ├── rules/            # Code style, testing, API conventions
│   └── skills/
├── backend/
│   ├── app/
│   │   ├── api/endpoints/
│   │   ├── core/          # Config, database, security
│   │   ├── models/        # SQLAlchemy schemas
│   │   ├── schemas/       # Pydantic validation
│   │   └── services/      # Business logic
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/           # Axios client + API functions
│       ├── components/    # React components
│       ├── hooks/         # TanStack Query hooks
│       ├── pages/         # Lazy-loaded pages
│       └── types/         # TypeScript interfaces
├── docker-compose.yml
└── run.py                 # Service orchestration
```

## Development Workflow

### Backend (FastAPI)

```bash
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8004

# Tests
pytest
pytest tests/test_users.py -v
pytest -k "test_create_user"

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Frontend (React + Vite)

```bash
cd frontend
pnpm install && pnpm dev --port 3004
pnpm build                # Production
```

### Data Sync (CSV to PostgreSQL)

```bash
cd backend
python -m scripts.sync_from_pbi --csv --worklogs -0    # Today
python -m scripts.sync_from_pbi --csv --worklogs -7d   # Last 7 days
```

### Database Backup/Restore

```bash
python3 backup_db.py                                    # Create
python3 restore_db.py edwards_backup_YYYYMMDD_HHMMSS.sql  # Restore
```

## Key Concepts

- **FTE:** Monthly allocation per user per project (0.0–1.0)
- **TBD Position:** ResourcePlan with user_id=null (future hiring)
- **Org Hierarchy:** Division → Department → SubTeam → JobPosition
- **Project Hierarchy:** BusinessUnit → Program → Project → Milestone
- **Project Status:** Prospective, Planned, InProgress, OnHold, Cancelled, Completed
- **Roles:** ADMIN, PM, FM, USER, GUEST, VIEWER (GUEST/VIEWER are read-only)
- **PCP Gates:** G3, G5, G6 (product commercialization milestones)

## Configuration

**Key .env variables:**
- Ports: `DB_PORT=5434`, `BACKEND_PORT=8004`, `FRONTEND_PORT=3004`
- Database: `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Security: `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- AI: `AI_PROVIDER` (groq/gemini/pcas), provider API keys
- SSO: `SAML_ENABLED`, `SAML_ENTITY_ID`, `SAML_IDP_SSO_URL`, `SAML_IDP_X509_CERT`

**Refer to `.env.example` for full list.**

## Import Rules & Conventions

This project follows the Unify/OQC structure. Rules are documented separately:

```yaml
Backend Code Style:
  @../../.claude/rules/code-style.md
  @../../.claude/rules/api-conventions.md
  @../../.claude/rules/security.md

Testing:
  @../../.claude/rules/testing.md

Git Workflow:
  @../../.claude/rules/commit-workflow.md
```

## Key Files Reference

| File | Purpose |
|------|----------|
| `backend/app/core/config.py` | Environment variables + settings |
| `backend/app/core/database.py` | DB connection + session factory |
| `backend/app/core/security.py` | JWT + role checks + password hashing |
| `backend/app/main.py` | FastAPI setup, CORS, seed, routers |
| `frontend/src/api/client.ts` | Axios client + all API functions |
| `frontend/src/hooks/useAuth.tsx` | AuthContext + token management |
| `frontend/src/App.tsx` | Router config + lazy loading |
| `frontend/src/types/index.ts` | All TypeScript interfaces |

## Deployment

- **Docker Compose:** `docker-compose.yml` → db + backend + frontend
- **Build & Package:** `python build_and_compress.py` → .tar.gz
- **Full Deploy:** `run_full_deploy.ps1` (build → upload → restart)
- **Server Cron:** `server/setup_cron.sh` (daily DB backups, 7-day retention)

## Documentation

- **README.md** — Project overview, features, architecture
- **DEPLOYMENT.md** — Deployment instructions
- **Submodule guides:**
  - `backend/.claude/CLAUDE.md` — FastAPI-specific patterns
  - `frontend/.claude/CLAUDE.md` — React-specific patterns
