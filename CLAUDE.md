# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Edwards Project Operation Board - Engineering resource management system for EUV Program IS. Replaces SharePoint/Excel workflows with a unified web application for worklog tracking, resource forecasting, and milestone management.

## Development Commands

### Quick Start
```bash
./run.py all          # Start all services (Backend + DB + Frontend)
./run.py backend      # Backend + Database only
./run.py frontend     # Frontend only
./run.py status       # Check service status
./run.py stop         # Stop all services
```

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate
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

## Architecture

### Backend (FastAPI + SQLAlchemy)
```
backend/app/
├── api/endpoints/    # HTTP handlers only - delegate to services
├── core/             # Config, database connection, security (JWT)
├── models/           # SQLAlchemy models - DB structure only
├── schemas/          # Pydantic schemas - validation only
├── services/         # Business logic - all complex operations here
```

**Key Pattern:** Endpoints → Services → Models. Keep endpoints thin, services handle business logic.

### Frontend (React + TanStack Query)
```
frontend/src/
├── api/client.ts     # Axios client with auth interceptor
├── components/ui/    # Shadcn/UI primitives (Button, Card, Dialog, etc.)
├── hooks/            # TanStack Query hooks (useUsers, useProjects, etc.)
├── pages/            # Page components - route handlers
├── types/            # TypeScript interfaces
```

**Key Pattern:** Pages use hooks for data fetching. Hooks wrap API calls with TanStack Query.

### Database Models (PostgreSQL)
- **Organization:** BusinessUnit → Department → SubTeam → JobPosition (hierarchy)
- **Projects:** Program, ProjectType, ProductLine, Project, ProjectMilestone
- **Resources:** ResourcePlan (monthly FTE), WorkLog (daily hours)
- **Users:** User, UserHistory (change tracking)

### Key Business Concepts
- **FTE (Full-Time Equivalent):** 0.0-1.0 monthly allocation per user per project
- **TBD Position:** ResourcePlan with user_id=null - placeholder for future hiring
- **WorkType:** Categorized work activities (Meeting, Development, Review, etc.)
- **PCP Gates:** G3, G5, G6 milestones for product commercialization process

## Service URLs
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3004 |
| Backend API | http://localhost:8004 |
| API Docs | http://localhost:8004/docs |
| Database | localhost:5434 (PostgreSQL) |

Default login: `admin@edwards.com` / `password`

## Code Style

### Backend
- Type hints everywhere: `def get_user(user_id: str, db: Session) -> User | None`
- Service layer pattern: Business logic in `services/`, not endpoints
- Use `Depends()` for dependency injection

### Frontend
- Functional components with TypeScript interfaces
- TanStack Query for all data fetching
- Tailwind CSS for styling, `cn()` for conditional classes
- Path alias: `@/` maps to `src/`

## Key Files to Know
- `backend/app/core/database.py` - Database connection and session
- `backend/app/core/security.py` - JWT authentication
- `frontend/src/api/client.ts` - API client with token handling
- `frontend/src/components/ui/index.ts` - All UI component exports
