# Edwards Project Operation Board

EUV Program IS 리소스 운영 관리 시스템 (PoC)

## 🚀 Quick Start (추천)

### 크로스플랫폼 실행 스크립트 사용

**단일 Python 스크립트로 Windows/macOS/Linux 모두 지원**

```bash
# Backend 실행 (DB + API)
python run.py backend

# Frontend 실행 (별도 터미널)
python run.py frontend

# 모든 서비스 한번에 실행
python run.py all

# 서비스 상태 확인
python run.py status

# 모든 서비스 중지
python run.py stop
```

**접속:**
- Frontend: http://localhost:3004
- Backend API: http://localhost:8004
- API Docs: http://localhost:8004/docs
- Database: localhost:5434

### 플랫폼별 스크립트 (대안)

```bash
# macOS/Linux
./run_backend.sh
./run_frontend.sh

# Windows PowerShell
.\run_backend.ps1
.\run_frontend.ps1
```

---

## 📋 Option: 기타 실행 방법

### Option 1: Dev Container

**요구사항:** VS Code + Dev Containers 확장

1. VS Code에서 프로젝트 폴더 열기
2. `Cmd+Shift+P` → "Dev Containers: Reopen in Container" 선택
3. 컨테이너 빌드 완료 후 자동으로 종속성 설치됨

**개발 서버 실행:**
```bash
# Terminal 1: Backend
cd backend && uvicorn app.main:app --reload --host 0.0.0.0

# Terminal 2: Frontend
cd frontend && pnpm dev --host
```

### Option 2: Docker Compose

```bash
# 환경 변수 복사
cp .env.example .env

# 컨테이너 빌드 및 실행
docker compose up -d

# 로그 확인
docker compose logs -f
```

### Option 3: 로컬 개발 (Manual)

```bash
# Database (PostgreSQL)
docker compose up db -d

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
RESET_DB=true ./run_local.sh

# Frontend (새 터미널)
cd frontend
pnpm install
pnpm dev
```

**기본 로그인:**
| Email | Password |
|-------|----------|
| admin@edwards.com | password |

---

## 📋 주요 기능

### ✅ 구현 완료
| 기능 | 설명 |
|------|------|
| **개인 대시보드** | 주간 WorkLog 요약, 리소스 현황, 프로젝트 타임라인 |
| **WorkLog 관리** | 일별 업무 시간 기록, 달력 UI |
| **리소스 계획** | 12개월 FTE 배정, TBD 관리 |
| **집계 뷰** | 프로젝트별/롤별 Total HC |
| **Reports** | Capacity/WorkLog 차트 (recharts) |
| **Organization** | Job Positions CRUD |
| **프로젝트 관리** | 마일스톤 (G5/G6 Gate) |

### 📋 개발 예정
- 클라우드 배포 (Vercel + Render + Supabase)
- Excel Import/Export
- TBD 사용자 할당

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind, recharts |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | PostgreSQL 15 |
| Container | Docker, Docker Compose, Dev Container |

---

## 📁 Project Structure

```
├── .devcontainer/     # VS Code Dev Container 설정
├── backend/           # FastAPI
│   ├── app/
│   │   ├── api/       # 엔드포인트
│   │   ├── models/    # SQLAlchemy 모델
│   │   ├── services/  # 비즈니스 로직
│   │   └── schemas/   # Pydantic 스키마
│   └── scripts/       # DB 시딩
├── frontend/          # React + Vite
│   └── src/
│       ├── pages/     # 페이지 컴포넌트
│       ├── hooks/     # React Query hooks
│       └── api/       # API 클라이언트
└── docker-compose.yml
```

---

## 📖 Documentation
- [TODO 및 개발 계획](./TODO.md)
- [요구사항](./requirment.md)
