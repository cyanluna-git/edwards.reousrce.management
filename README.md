# Edwards Project Operation Board

EUV Program IS 리소스 운영 관리 시스템

## 🚀 Quick Start

### 로컬 개발

```bash
# 전체 서비스 시작
python run.py
```

**접속:**
- Frontend: http://localhost:3004
- Backend API: http://localhost:8004/docs
- 기본 로그인: `admin@edwards.com` / `password`

### 서버 배포

```powershell
# PowerShell에서 한 번에 배포
.\scripts\deploy_to_vm.ps1
```

**자세한 내용:**
- 빠른 시작: [`QUICKSTART.md`](./QUICKSTART.md)
- 배포 가이드: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

---

## 📁 프로젝트 구조

```
engineering.resource.management/
├── README.md                     # 이 파일
├── QUICKSTART.md                 # 빠른 시작 가이드
├── run.py                        # 로컬 개발 실행
│
├── scripts/                      # 운영 스크립트
│   ├── build_and_compress.py    # 빌드
│   ├── deploy_to_vm.ps1         # 배포
│   ├── backup_db.py             # 백업
│   └── restore_db.py            # 복원
│
├── docs/                         # 문서
│   ├── DEPLOYMENT.md            # 배포 가이드
│   └── development/             # 개발 문서
│
├── deploy/                       # 배포 설정
│   └── .env.vm                  # 서버 정보
│
├── backend/                      # FastAPI
├── frontend/                     # React + Vite
├── backups/                      # DB 백업
├── docker-compose.yml           # Docker 설정
└── .env                         # 환경 변수
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Backend** | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| **Database** | PostgreSQL 15 |
| **Deployment** | Docker, Docker Compose, Nginx |

---

## 📋 주요 기능

| 기능 | 설명 |
|------|------|
| **개인 대시보드** | 주간 WorkLog 요약, 리소스 현황, 프로젝트 타임라인 |
| **WorkLog 관리** | 일별 업무 시간 기록, 달력 UI |
| **리소스 계획** | 12개월 FTE 배정, TBD 관리 |
| **집계 뷰** | 프로젝트별/롤별 Total HC |
| **Reports** | Capacity/WorkLog 차트 |
| **Organization** | Job Positions, Teams, Users CRUD |
| **프로젝트 관리** | 마일스톤 (G5/G6 Gate) |

---

## ⚙️ 환경 설정

### 포트 설정

모든 포트는 `.env` 파일에서 변경 가능:

```env
DB_PORT=5434          # PostgreSQL
BACKEND_PORT=8004     # FastAPI
FRONTEND_PORT=3004    # React/Vite
```

### 환경 변수 파일

- `.env` - 로컬 개발 (자동 생성)
- `.env.example` - 템플릿
- `deploy/.env.vm` - 서버 접속 정보 (Git 제외)

---

## 🗃️ 데이터베이스 관리

### 백업

```bash
python scripts/backup_db.py
```

### 복원

```bash
python scripts/restore_db.py backups/edwards_backup_YYYYMMDD_HHMMSS.sql
```

---

## 📚 추가 문서

- **빠른 시작:** [`QUICKSTART.md`](./QUICKSTART.md)
- **배포 가이드:** [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- **개발 문서:** [`docs/development/`](./docs/development/)

---

## 🔗 링크

**로컬 개발:**
- Frontend: http://localhost:3004
- Backend API: http://localhost:8004/api
- API Docs: http://localhost:8004/docs

**운영 서버:**
- Frontend: http://eob.10.182.252.32.sslip.io
- Backend API: http://eob.10.182.252.32.sslip.io/api
- API Docs: http://eob.10.182.252.32.sslip.io/docs

---

**Last Updated:** 2026-01-18
