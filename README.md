# Edwards Project Operation Board

통합 리소스 관리 플랫폼 (PoC)

## 🚀 Quick Start

### 1. Docker로 전체 시스템 실행
```bash
# 환경 변수 복사
cp .env.example .env

# 컨테이너 빌드 및 실행
docker compose up -d

# 로그 확인
docker compose logs -f
```

**접속:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/docs
- Database: localhost:1433

### 2. 개별 개발 환경

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
pnpm dev
```

## 📁 Project Structure
```
edwards.engineering_operation_management/
├── docker-compose.yml      # Docker 통합 설정
├── backend/                # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── api/endpoints/  # API 라우트
│   │   ├── core/           # Config, DB, Security
│   │   ├── models/         # SQLAlchemy 모델
│   │   ├── schemas/        # Pydantic 스키마
│   │   └── services/       # 비즈니스 로직
│   ├── alembic/            # DB 마이그레이션
│   └── Dockerfile
├── frontend/               # React 19 + Vite
│   ├── src/
│   │   ├── components/     # UI 컴포넌트
│   │   ├── pages/          # 페이지
│   │   ├── api/            # API 클라이언트
│   │   └── types/          # TypeScript 타입
│   └── Dockerfile
└── ref_table/              # 참조 데이터 (CSV)
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | MS SQL Server (Azure SQL Edge) |
| Container | Docker, Docker Compose |

## 📋 주요 기능

- **WorkLog 관리**: 일별 업무 시간 기록
- **리소스 계획**: 월별 프로젝트 인력 배치 (TBD 포함)
- **마일스톤 관리**: PCP Gate 및 커스텀 마일스톤
- **Capacity 분석**: 한국 공휴일 반영 동적 계산
- **부서별 리포트**: 계획 vs 실적 비교

## 📖 Documentation

- [요구사항](./requirment.md)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
