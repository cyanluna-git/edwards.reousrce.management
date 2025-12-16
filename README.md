# Edwards Project Operation Board

EUV Program IS 리소스 운영 관리 시스템 (PoC)

## 🚀 Quick Start

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
| Database | MS SQL Server (로컬) / PostgreSQL (배포) |
| Container | Docker, Docker Compose |

---

## 📁 Project Structure

```
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
