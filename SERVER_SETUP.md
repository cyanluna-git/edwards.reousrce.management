# Edwards Project Operation Board

EUV Program IS 리소스 운영 관리 시스템 (PoC)

## 🚀 Quick Start

### 1️⃣ 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd edwards.engineering_operation_managenent

# 서버 운영 환경 변수
# - 로컬 개발: .env 사용
# - 서버 운영: .env.remote 사용 (레포에 커밋하지 않음)
#   예) .env.remote.example을 복사해서 서버에 .env.remote로 생성
```

### 2️⃣ 서비스 실행

**방법 1: 직접 실행 (가장 간단)**
```bash
./run.py backend      # Backend + Database 시작
./run.py frontend     # Frontend 시작 (별도 터미널)
./run.py all          # 모든 서비스 한번에 시작
```

**방법 2: python3 명령어**
```bash
python3 run.py backend
python3 run.py frontend
python3 run.py all
```

### 3️⃣ 서비스 관리

```bash
./run.py status       # 서비스 상태 확인
./run.py stop         # 모든 서비스 중지
./run.py help         # 도움말 보기
```

### 4️⃣ 접속

| 서비스 | URL |
|--------|-----|
| **Frontend** | http://localhost:3004 |
| **Backend API** | http://localhost:8004 |
| **API Docs** | http://localhost:8004/docs |
| **Database** | localhost:5434 |

**기본 로그인:**
- Email: `admin@edwards.com`
- Password: `password`

---

## ⚙️ 포트 설정

모든 포트는 `.env` 파일에서 변경 가능:

```env
DB_PORT=5434          # PostgreSQL
BACKEND_PORT=8004     # FastAPI
FRONTEND_PORT=3004    # Vite/React
```

서버에서 Docker Compose로 실행할 때는 다음처럼 서버용 env 파일을 지정하는 것을 권장:

```bash
docker compose --env-file .env.remote up -d --build
```

---

## 🔧 기타 실행 방법

<details>
<summary>Docker Compose 직접 사용</summary>

```bash
# 서비스 시작
docker compose up -d

# 로그 확인
docker compose logs -f

# 특정 서비스만 시작
docker compose up -d backend
docker compose up -d frontend

# 서비스 중지
docker compose down
```
</details>

<details>
<summary>Dev Container (VS Code)</summary>

**요구사항:** VS Code + Dev Containers 확장

1. VS Code에서 프로젝트 폴더 열기
2. `Cmd+Shift+P` → "Dev Containers: Reopen in Container"
3. 컨테이너 빌드 후 터미널에서:
   ```bash
   # Backend
   cd backend && uvicorn app.main:app --reload --host 0.0.0.0
   
   # Frontend (새 터미널)
   cd frontend && pnpm dev --host
   ```
</details>

<details>
<summary>로컬 개발 (Docker 없이)</summary>

```bash
# PostgreSQL 시작 (Docker 사용)
docker-compose up -d db

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8004

# Frontend (새 터미널)
cd frontend
pnpm install
pnpm dev --port 3004
```
</details>

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

## 데이터베이스 백업 & 마이그레이션

다른 PC로 프로젝트와 데이터를 이전하는 방법:

### 1️⃣ 현재 PC에서 백업

```bash
# 데이터베이스 백업 생성 (서비스가 실행 중이어야 함)
python3 backup_db.py

# backups/edwards_backup_YYYYMMDD_HHMMSS.sql 파일 생성됨
```

### 2️⃣ 새 PC로 이전

1. **프로젝트 복사**
   ```bash
   # 백업 파일 포함하여 전체 프로젝트 폴더 복사
   # backups/ 폴더를 포함하여 이동
   ```

2. **새 PC에서 실행**
   ```bash
   # 서비스 시작 (빈 데이터베이스로 시작)
   ./run.py all
   
   # 백업 복원
   python3 restore_db.py edwards_backup_YYYYMMDD_HHMMSS.sql
   ```

### 📌 주의사항
- 백업은 **서비스가 실행 중일 때만** 가능
- 복원은 기존 데이터를 **완전히 삭제**하고 덮어씀 (확인 메시지 있음)
- 백업 파일은 `.gitignore`에 포함되어 Git에 업로드되지 않음

---

## Documentation
- [개발 메모](./docs/todo.md)
- [요구사항](./docs/requirements.md)
