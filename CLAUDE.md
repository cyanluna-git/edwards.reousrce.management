# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Edwards Project Operation Board - Engineering resource management system for EUV Program IS. Replaces SharePoint/Excel workflows with a unified web application for worklog tracking, resource forecasting, and milestone management.

### Port Convention

All services use port suffix **4** (xxx4) to avoid conflicts when running multiple projects: DB 5434, Backend 8004, Frontend 3004.

## Development Commands

### Quick Start

```bash
./run.sh all              # Start all services (Backend + DB + Frontend) in Docker
./run.sh backend          # Backend + Database only (Docker)
./run.sh frontend         # Frontend only (Docker)
./run.sh status           # Check service status
./run.sh stop             # Stop all services
```

### Local Development Mode

```bash
./run.sh dev              # Start DB in Docker, then run backend/frontend locally
./run.sh db               # Start database only (Docker)
./run.sh local-backend    # Run backend with uvicorn locally (auto-finds .venv)
./run.sh local-frontend   # Run frontend with pnpm dev locally
```

### Backend (FastAPI)

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8004

# Run tests
pytest
pytest tests/test_users.py -v           # Single test file
pytest -k "test_create_user"            # Single test by name

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Frontend (React + Vite)

```bash
cd frontend
pnpm install
pnpm dev --port 3004
pnpm build            # Production build
pnpm preview          # Preview production build
```

### Data Sync (CSV to PostgreSQL)

```bash
cd backend
python -m scripts.sync_from_pbi --csv --worklogs -0       # Today's worklogs
python -m scripts.sync_from_pbi --csv --worklogs -7d      # Last 7 days
```

### Database Backup/Restore

```bash
python3 scripts/db/backup_remote.py                                    # Backup DB from remote server → local backups/
python3 scripts/db/restore_local.py edwards_backup_YYYYMMDD_HHMMSS.sql  # Restore backup to local DB
python3 scripts/db/restore_remote.py backups/remote_backup_XXX.sql       # Restore local backup to remote DB
```

## Architecture

### Backend (FastAPI + SQLAlchemy)

```
backend/app/
├── api/endpoints/    # HTTP handlers only - delegate to services
├── core/             # Config, database, security (JWT + SSO/SAML)
├── models/           # SQLAlchemy models - DB structure only
├── schemas/          # Pydantic schemas - validation only
├── services/         # Business logic - all complex operations here
```

**Key Pattern:** Endpoints → Services → Models. Keep endpoints thin, services handle business logic.

**Service instantiation pattern:**
```python
@router.get("/{id}", response_model=UserResponse)
async def get_item(id: str, db: Session = Depends(get_db)):
    service = UserService(db)
    return service.get_by_id(id)
```

### Frontend (React 19 + TanStack Query v5)

```
frontend/src/
├── api/client.ts     # Axios client with auth interceptor + all API functions
├── components/ui/    # Shadcn/UI primitives (Button, Card, Dialog, etc.)
├── components/       # Domain components (UserHierarchySelect, WorklogHeatmap, etc.)
├── hooks/            # TanStack Query hooks + useAuth (AuthContext)
├── pages/            # Page components - lazy-loaded via React Router 7
├── types/index.ts    # All TypeScript interfaces (centralized)
├── lib/              # Utilities (cn(), formatDate, etc.)
```

**Key Pattern:** Pages use hooks for data fetching. Hooks wrap API calls with TanStack Query. All pages are lazy-loaded except LandingPage and LoginPage.

### Database Schema (PostgreSQL 15)

**Organization hierarchy:**
Division → Department → SubTeam → JobPosition

**Project hierarchy:**
BusinessUnit → Program → Project → ProjectMilestone

**Resource tracking:**
- ResourcePlan: Monthly FTE allocation per user per project (user_id=null for TBD positions)
- WorkLog: Daily hours per user per project
- User → UserHistory: Tracks org changes (HIRE, TRANSFER_IN, TRANSFER_OUT, PROMOTION, RESIGN)

**Project categories:** PRODUCT or FUNCTIONAL
**Project statuses:** Prospective, Planned, InProgress, OnHold, Cancelled, Completed

### Key Business Concepts

- **FTE (Full-Time Equivalent):** 0.0-1.0 monthly allocation per user per project
- **TBD Position:** ResourcePlan with user_id=null - placeholder for future hiring
- **WorkType:** Hierarchical work classification (WorkTypeCategory)
- **PCP Gates:** G3, G5, G6 milestones for product commercialization process
- **Internal IO / Recharge IO:** Internal order numbers and cost recharge tracking

### Authentication & Authorization

- **JWT:** Access tokens (30 min) + Refresh tokens (7 days) + Registration tokens
- **SSO/SAML 2.0:** Microsoft Entra ID integration (configurable via SAML_* env vars)
- **Roles:** ADMIN, PM, FM, USER, GUEST, VIEWER
- **Read-only roles:** GUEST and VIEWER cannot create/update/delete (enforced via `require_write_permission()`)
- **Auth flow:** `backend/app/core/security.py` → `require_role()`, `require_write_permission()`
- **Frontend auth:** `useAuth` hook with localStorage token management, auto-refresh on 401

### AI-Powered Features

- **AI Worklog Parser:** Natural language → structured worklog entries
- **AI Summaries:** Dashboard summaries with caching (AISummary model)
- **Providers:** Configured via `AI_PROVIDER` env var - supports Groq (Llama 3.3), Gemini (2.0 Flash), PCAS
- **Entity resolution:** Fuzzy matching for project/user/worktype via `matching_service.py`

## Service URLs

| Service     | URL                         |
| ----------- | --------------------------- |
| Frontend    | http://localhost:3004       |
| Backend API | http://localhost:8004       |
| API Docs    | http://localhost:8004/docs  |
| Database    | localhost:5434 (PostgreSQL) |

Default login: `admin@edwards.com` / `password`

## Environment Variables

Key variables in `.env` (copy from `.env.example`):

- **Ports:** `DB_PORT=5434`, `BACKEND_PORT=8004`, `FRONTEND_PORT=3004`
- **Database:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
- **Security:** `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- **AI:** `AI_PROVIDER` (groq/gemini/pcas), `GROQ_API_KEY`, `GEMINI_API_KEY`
- **SSO:** `SAML_ENABLED`, `SAML_ENTITY_ID`, `SAML_IDP_SSO_URL`, `SAML_IDP_X509_CERT`
- **Frontend:** `VITE_API_URL=/api`, `VITE_DEV_PROXY_TARGET=http://localhost:8004`

## Code Style

### Backend (Python)

- Type hints everywhere: `def get_user(user_id: str, db: Session) -> User | None`
- Service layer pattern: Business logic in `services/`, not endpoints
- Use `Depends()` for dependency injection
- Avoid circular imports - use `TYPE_CHECKING`
- Functions: `snake_case`, Classes: `PascalCase`, Constants: `UPPER_SNAKE_CASE`
- Use `async def` for I/O operations

### Frontend (TypeScript/React)

- Functional components with TypeScript interfaces
- TanStack Query for all data fetching
- Tailwind CSS for styling, `cn()` for conditional classes
- Path alias: `@/` maps to `src/`
- Components: `PascalCase.tsx`, Hooks: `use*.ts`, Pages: `*Page.tsx`
- File order: Imports → Types/Interfaces → Component → Export

### Language

- All code comments and documentation in English
- Respond to users in Korean

## Key Files to Know

- `backend/app/core/config.py` - All environment variable settings
- `backend/app/core/database.py` - Database connection, session factory, `get_db()`
- `backend/app/core/security.py` - JWT auth, role checks, password hashing
- `backend/app/main.py` - App setup, CORS, startup seed, router registration
- `frontend/src/api/client.ts` - Axios client, all API functions, token refresh
- `frontend/src/hooks/useAuth.tsx` - AuthContext provider, login/logout/token management
- `frontend/src/App.tsx` - Routing config, lazy loading, protected routes
- `frontend/src/types/index.ts` - All TypeScript interfaces

## Deployment

- **Docker Compose:** `docker-compose.yml` runs db + backend + frontend
- **Dev Docker:** `docker-compose.dev.yml` adds hot reload with volume mounts
- **Build & Package:** `python scripts/deploy/build.py` → builds images and creates .tar.gz
- **Full Deploy:** `scripts/deploy/full_deploy.sh` automates build → upload → restart
- **Server cron:** `scripts/server/setup_cron.sh` sets up daily DB backups with 7-day retention

## Testing

- **Backend:** pytest + pytest-asyncio, test files: `test_{module_name}.py`
- **Frontend:** Playwright for E2E tests, test files: `{component}.spec.ts`
