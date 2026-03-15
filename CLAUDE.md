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

**Financial dimensions:**
- dim_funding_entity: VSS, SUN, LOCAL_KR, SHARED
- dim_io_category: NPI, FIELD_FAILURE, OPS_SUPPORT, SUSTAINING, CIP, etc.
- dim_activity_code: 15 activity codes (DESIGN, TEST, DOC, etc.)
- dim_cost_bucket: 4 financial tiers + UNCLASSIFIED
- allocation_rules: 30+ priority-ordered classification rules
- planning_scenarios: BASELINE, OPTIMISTIC, CONSERVATIVE, CUSTOM (per fiscal year)
- resource_plans: Long-format FTE planning (replaces Excel PCAS Eng._Monthly Headcounts)

### Key Business Concepts

- **FTE (Full-Time Equivalent):** 0.0-1.0 monthly allocation per user per project. Sum per user/month/scenario must not exceed 1.0 (enforced by DB trigger)
- **TBD Position:** ResourcePlan with user_id=null - placeholder for future hiring
- **WorkType:** Hierarchical work classification (WorkTypeCategory). 7 work types (00 Pre Gate ~ 06 Sales/Service Support)
- **PCP Gates:** G3, G5, G6 milestones for product commercialization process
- **Internal IO / Recharge IO:** Internal order numbers and inter-company cost recharge tracking
- **Project Categories:** PRODUCT (NPI/ETO), FUNCTIONAL (CEP), SUPPORT (standardized support projects with auto BU routing)
- **Project Statuses:** Prospective, Planned, InProgress, OnHold, Cancelled, Completed

### Financial System (Recharge & Cost Classification)

**Funding Entities (inter-company billing):**

| Code | Entity | Currency |
|------|--------|----------|
| VSS | VSS Division (USA) | USD |
| SUN | SUN Division (USA) | USD |
| LOCAL_KR | Edwards Korea Ltd. | KRW |
| SHARED | Shared Services | USD |

**Recharge Status:** BILLABLE (billed to another division), NON_BILLABLE (self-funded CAPEX), INTERNAL (overhead)

**Auto-Classification:** `auto_classify_project_funding()` trigger classifies projects by name/code pattern (VSS→ENTITY_VSS, SUN→ENTITY_SUN) and project type (NPI→LOCAL_KR). Manual override via CSV import for low-confidence cases.

**Recharge IO Mapping:** Support work routes to BU-specific IOs:
- ABT/IS BU: 407278 (SUN Ops), 407279 (SUN Product), 407328 (VSS Product), 407331 (VSS Sales)
- ACM BU: 407327, 407296, 407332

**BU Auto-Routing:** Users have `primary_business_unit_id`. When selecting SUPPORT project, system auto-assigns correct RechargeIO based on user's BU. Manual override allowed.

### Context-Aware Timesheet Engine

Star schema with rule-based classification trigger on INSERT/UPDATE.

**4-Tier Cost Buckets:**

| Bucket | GL | Capitalizable | Target |
|--------|-----|---------------|--------|
| DIRECT_PRODUCT | GL-1000 | Yes | 60-70% |
| DIRECT_PROJECT | GL-1100 | Yes | 10-15% |
| INDIRECT | GL-2000 | No | 15-20% |
| OVERHEAD | GL-3000 | No | <10% |

**15 Activity Codes:** DESIGN, TEST, DOC, RELEASE, MEET, REVIEW, PLAN, FIELD, SALES, SUSTAIN, TRIAGE, ADMIN, TRAINING, HIRING, PTO

**Classification Engine:** 30+ priority-ordered allocation_rules evaluated first-match-wins. Matches on user context (department, sub_team, role) + project context (type, category) + activity. Confidence score 0-95 (manual override = 100). Entries with confidence < 70 flagged for review.

**Key Functions:**
- `classify_timesheet_entry(user_id, project_id, activity_code_id, work_date)` — core classification
- `classify_with_recharge(...)` — extends with inter-company recharge logic
- `reclassify_timesheet_entries(start, end)` — batch reclassify after rule changes

**Plan vs Actual Views:** `v_plan_vs_actual`, `v_dept_plan_vs_actual`, `v_project_plan_vs_actual`, `v_monthly_variance_heatmap`, `v_monthly_recharge_report`

### Authentication & Authorization

- **JWT:** Access tokens (30 min) + Refresh tokens (7 days) + Registration tokens (24h)
- **SSO/SAML 2.0:** Microsoft Entra ID integration (configurable via SAML_* env vars, HTTP-POST binding)
- **Jarvis JWT Relay:** Separate JARVIS_SECRET_KEY for cross-service auth to Jarvis AI. EOB generates short-lived token (10 min) with type="jarvis", Jarvis validates against shared secret.
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

## Production Infrastructure

- **Server:** VTISAZUAPP218 (10.182.252.32), Ubuntu 24.04, atlasAdmin
- **Domain:** https://eob.10.182.252.32.sslip.io (sslip.io wildcard DNS)
- **SSL:** Self-signed cert (expires 2036-02-04), backed up in Azure Key Vault (pcas-keyvault-218)
- **Routing:** Traefik (Coolify, SSL termination) → Nginx (static + /api proxy) → FastAPI → PostgreSQL
- **Containers:** edwards-web (:80→3004), edwards-api (:8004), edwards-postgres (:5432→5434 internal)

## Deployment

- **One-Click:** `.\run_full_deploy.ps1` (generates .env.remote → build → backup → upload → restart)
- **Docker Compose:** `docker-compose.yml` runs db + backend + frontend
- **Dev Docker:** `docker-compose.dev.yml` adds hot reload with volume mounts
- **Build & Package:** `python scripts/deploy/build.py` → builds images and creates .tar.gz
- **Full Deploy:** `scripts/deploy/full_deploy.sh` automates build → upload → restart
- **Server cron:** `scripts/server/setup_cron.sh` sets up daily DB backups with 7-day retention
- **Env transform:** `deploy_env_remote.py --profile server` auto-converts .env for production (DEBUG=false, URLs updated)

## Performance

- **Worklogs table indexes:** 4 indexes (date, user+date, project+date, compound) via Alembic migration 010
- **Known bottleneck:** `get_resource_pivot_matrix()` at 16.75s — 70% from Python loop IO resolution. Basic queries optimized to 15-100ms (100-1000x improvement)
- **Benchmark script:** `python scripts/benchmark_resource_matrix.py`
- **Frontend caching:** TanStack Query staleTime=10min, gcTime=1hr, React.memo on RowItem

## Testing

- **Backend:** pytest + pytest-asyncio, test files: `test_{module_name}.py`
- **Frontend:** Playwright for E2E tests, test files: `{component}.spec.ts`

## Confluence Documentation

All architecture and implementation details are documented in Confluence ISP space (11 pages under EOB parent):
01-05: Domain recaps (Recharge, Timesheet, Architecture, SSO, Dev Setup)
06: SSL & Key Vault Operations
07-11: Implementation detail (Performance, Deployment, Recharge SQL, Timesheet Architecture, JWT/SSO Config)
