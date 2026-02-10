# Edwards Project Operation Board - GitHub Copilot Instructions

Engineering resource management system for EUV Program IS. Replaces SharePoint/Excel workflows with worklog tracking, resource forecasting, and milestone management.

## Build, Test, and Lint Commands

### Backend (FastAPI + SQLAlchemy)

```bash
cd backend

# Run all tests
pytest

# Run single test file
pytest tests/test_users.py -v

# Run specific test
pytest -k "test_create_user"

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Dev server
uvicorn app.main:app --reload --port 8004
```

### Frontend (React 19 + Vite)

```bash
cd frontend

# Dev server
pnpm dev --port 3004

# Build
pnpm build

# Lint
pnpm lint

# E2E tests
pnpm test:e2e              # Headless
pnpm test:e2e:ui           # Interactive UI
pnpm test:e2e:headed       # Headed browser
```

### Quick Start Scripts

```bash
./run.py all              # All services (Docker)
./run.py backend          # Backend + DB (Docker)
./run.py frontend         # Frontend (Docker)
./run.py dev              # DB in Docker, backend/frontend locally
./run.py status           # Check service status
./run.py stop             # Stop all services
```

## Architecture

### Port Convention

All services use port suffix **4** (xxx4):
- Database: `5434` (PostgreSQL)
- Backend: `8004` (FastAPI)
- Frontend: `3004` (Vite)

### Backend Structure (FastAPI + SQLAlchemy 2.0)

```
backend/app/
├── api/endpoints/    # HTTP handlers - delegate to services
├── core/             # Config, database, security (JWT + SAML)
├── models/           # SQLAlchemy models - DB structure only
├── schemas/          # Pydantic schemas - validation only
├── services/         # Business logic - all operations here
└── utils/            # Helpers, matching algorithms
```

**Key Pattern:** `Endpoints → Services → Models`

- Keep endpoints thin (< 50 lines)
- Business logic lives in services
- Service instantiation pattern:

```python
@router.get("/{id}", response_model=UserResponse)
async def get_item(id: str, db: Session = Depends(get_db)):
    service = UserService(db)
    return service.get_by_id(id)
```

### Frontend Structure (React 19 + TanStack Query v5)

```
frontend/src/
├── api/client.ts     # Axios + auth interceptor + all API functions
├── components/ui/    # Shadcn/UI primitives (Button, Card, Dialog)
├── components/       # Domain components (UserHierarchySelect, WorklogHeatmap)
├── hooks/            # TanStack Query hooks + useAuth
├── pages/            # Page components - lazy-loaded via React Router 7
├── types/index.ts    # All TypeScript interfaces (centralized)
└── lib/              # Utilities (cn(), formatDate)
```

**Key Pattern:** `Pages → Hooks → API`

- All data fetching via TanStack Query
- All pages lazy-loaded except LandingPage and LoginPage
- Path alias: `@/` maps to `src/`

### Database Schema (PostgreSQL 15)

**Organization hierarchy:**
```
Division → Department → SubTeam → JobPosition
```

**Project hierarchy:**
```
BusinessUnit → Program → Project → ProjectMilestone
```

**Resource tracking:**
- `ResourcePlan`: Monthly FTE allocation (0.0-1.0) per user per project
  - `user_id=null` for TBD positions (future hiring placeholders)
- `WorkLog`: Daily hours per user per project
- `UserHistory`: Tracks org changes (HIRE, TRANSFER_IN, TRANSFER_OUT, PROMOTION, RESIGN)

**Project categories:** PRODUCT | FUNCTIONAL  
**Project statuses:** Prospective | Planned | InProgress | OnHold | Cancelled | Completed

### Authentication & Authorization

- **JWT:** Access (30min) + Refresh (7 days) + Registration tokens
- **SSO/SAML 2.0:** Microsoft Entra ID integration (configurable via `SAML_*` env vars)
- **Roles:** ADMIN | PM | FM | USER | GUEST | VIEWER
- **Read-only enforcement:** GUEST and VIEWER roles blocked by `require_write_permission()`
- **Auth flow:** `backend/app/core/security.py` implements role checks
- **Frontend auth:** `useAuth` hook with localStorage, auto-refresh on 401

### AI Features

- **AI Worklog Parser:** Natural language → structured worklog entries
- **AI Summaries:** Dashboard summaries with caching (`AISummary` model)
- **Providers:** Groq (Llama 3.3), Gemini (2.0 Flash), PCAS (via `AI_PROVIDER` env var)
- **Entity resolution:** Fuzzy matching for project/user/worktype in `matching_service.py`

## Key Conventions

### Service Layer Pattern

Always instantiate services inside endpoints, not at module level:

```python
# ✅ CORRECT
@router.get("/users")
async def get_users(db: Session = Depends(get_db)):
    service = UserService(db)
    return service.get_all()

# ❌ WRONG - service persists across requests
user_service = UserService(db)  # Don't do this at module level
```

### Type Hints

Backend requires type hints everywhere:

```python
# ✅ Required
def get_user(user_id: str, db: Session) -> User | None:
    return db.query(User).filter(User.id == user_id).first()

# ❌ Avoid
def get_user(user_id, db):
    return db.query(User).filter(User.id == user_id).first()
```

### Circular Import Prevention

Use `TYPE_CHECKING` for type hints in models:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User

class Department(Base):
    users: list["User"] = relationship("User", back_populates="department")
```

### Frontend Component Structure

Consistent file ordering:

```tsx
// 1. Imports
import { useState } from 'react'
import { cn } from '@/lib/utils'

// 2. Types/Interfaces
interface Props {
  variant?: 'primary' | 'secondary'
}

// 3. Component
export function MyComponent({ variant = 'primary' }: Props) {
  // Hooks first
  const [state, setState] = useState(false)
  
  // Handlers
  const handleClick = () => setState(true)
  
  // Render
  return <div onClick={handleClick}>...</div>
}

// 4. Export (if not inline)
```

### TanStack Query Hook Pattern

One hook per entity:

```tsx
// hooks/useUsers.ts
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiClient.getUsers()
  })
}

// Usage in pages
function UsersPage() {
  const { data: users, isLoading } = useUsers()
  // ...
}
```

### Lazy Loading Pages

All pages except landing/login are lazy-loaded:

```tsx
// App.tsx
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const WorklogsPage = lazy(() => import('@/pages/WorklogsPage'))

// Route definition
<Route path="/dashboard" element={
  <Suspense fallback={<LoadingSpinner />}>
    <DashboardPage />
  </Suspense>
} />
```

### Naming Conventions

**Backend (Python):**
- Functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `snake_case.py`

**Frontend (TypeScript/React):**
- Components: `PascalCase.tsx` (e.g., `UserCard.tsx`)
- Hooks: `use*.ts` (e.g., `useUsers.ts`)
- Pages: `*Page.tsx` (e.g., `DashboardPage.tsx`)
- Types: `PascalCase` (e.g., `User`, `ProjectStatus`)
- Utilities: `camelCase` (e.g., `formatDate.ts`)

### Korean String Support

All database strings use `NVARCHAR` for Korean characters:

```python
# ✅ Correct for Korean support
name = Column(String(100), nullable=False)  # SQLAlchemy maps to NVARCHAR

# Frontend displays Korean naturally
<span>{user.name}</span>  # "박지영" renders correctly
```

## Key Files

- `backend/app/core/config.py` - Environment variable settings
- `backend/app/core/database.py` - DB connection, session factory, `get_db()`
- `backend/app/core/security.py` - JWT auth, role checks, password hashing
- `backend/app/main.py` - App setup, CORS, startup seed, router registration
- `frontend/src/api/client.ts` - Axios client, all API functions, token refresh
- `frontend/src/hooks/useAuth.tsx` - AuthContext, login/logout, token management
- `frontend/src/App.tsx` - Routing, lazy loading, protected routes
- `frontend/src/types/index.ts` - All TypeScript interfaces (centralized)

## Data Sync & Backup

```bash
# Sync CSV data to PostgreSQL
cd backend
python -m scripts.sync_from_pbi --csv --worklogs -0    # Today
python -m scripts.sync_from_pbi --csv --worklogs -7d   # Last 7 days

# Database backup/restore
python3 backup_db.py                                    # Create backup
python3 restore_db.py edwards_backup_YYYYMMDD_HHMMSS.sql  # Restore
```

## Deployment

- **Local Dev:** `docker-compose.yml` runs all services
- **Build & Package:** `python build_and_compress.py` → creates `.tar.gz`
- **Full Deploy:** `run_full_deploy.ps1` → build → upload → restart
- **Server Cron:** `server/setup_cron.sh` for daily DB backups (7-day retention)

## Environment Variables

Key variables in `.env` (copy from `.env.example`):

```env
# Ports
DB_PORT=5434
BACKEND_PORT=8004
FRONTEND_PORT=3004

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=edwards_db
DATABASE_URL=postgresql://postgres:password@localhost:5434/edwards_db

# Security
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# AI
AI_PROVIDER=groq  # groq | gemini | pcas
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key

# SSO (optional)
SAML_ENABLED=true
SAML_ENTITY_ID=your_entity_id
SAML_IDP_SSO_URL=your_idp_url
SAML_IDP_X509_CERT=your_cert

# Frontend
VITE_API_URL=/api
VITE_DEV_PROXY_TARGET=http://localhost:8004
```

## Service URLs

| Service     | URL                        |
| ----------- | -------------------------- |
| Frontend    | http://localhost:3004      |
| Backend API | http://localhost:8004      |
| API Docs    | http://localhost:8004/docs |
| Database    | localhost:5434 (PostgreSQL)|

**Default login:** `admin@edwards.com` / `password`

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query v5, React Router 7
- **Backend:** FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic
- **Database:** PostgreSQL 15
- **Auth:** JWT + SAML 2.0 (Microsoft Entra ID)
- **Testing:** pytest (backend), Playwright (frontend E2E)
- **Deployment:** Docker, Docker Compose
