# Edwards Project Operation Board - TODO

## ✅ 완료된 작업 (2024-12-10)

### 1. 요구사항 정의
- [x] `requirment.md` 작성 완료
- [x] 조직 구조 정의 (BusinessUnit > Department > SubTeam)
- [x] 프로젝트 구조 정의 (Program > Project > Milestone)
- [x] 사용자/이력 관리 스키마 정의
- [x] WorkLog, ResourcePlan 스키마 정의
- [x] CommonCodes, Holidays 정의

### 2. Backend 스캐폴딩
- [x] Python 3.12 가상환경 생성
- [x] FastAPI + SQLAlchemy 2.0 + Alembic 설치
- [x] 프로젝트 구조 생성 (`app/api`, `app/core`, `app/models`, `app/schemas`, `app/services`)
- [x] SQLAlchemy 모델 14개 생성
- [x] API 엔드포인트 스텁 7개 생성 (auth, users, departments, projects, worklogs, resource_plans, reports)
- [x] `.cursorrules` 생성 (Python 개발 규칙)

### 3. Frontend 스캐폴딩
- [x] React 19 + Vite + TypeScript 프로젝트 생성 (pnpm)
- [x] Tailwind CSS 4 설정
- [x] UI 컴포넌트 생성 (Button, Card, Input)
- [x] 레이아웃 컴포넌트 생성 (Sidebar, MainLayout)
- [x] Dashboard 페이지 생성
- [x] TypeScript 타입 정의
- [x] `.cursorrules` 생성 (React 개발 규칙)

### 4. Docker 환경 구성
- [x] `docker-compose.yml` 생성 (mssql, backend, frontend)
- [x] Backend `Dockerfile` 생성 (ODBC 드라이버 포함)
- [x] Frontend `Dockerfile` 생성 (multi-stage)
- [x] `nginx.conf` 생성 (production용)

### 5. DB 마이그레이션
- [x] Alembic 초기 설정
- [x] `001_initial_schema.py` - 14개 테이블 생성
- [x] `002_seed_data.py` - 초기 데이터 시딩
- [x] 마이그레이션 실행 완료

---

## 📋 다음 작업 (TODO)

### Phase 1: Core API 구현
- [x] **Authentication**
  - [x] Login / JWT 발급
  - [x] Token refresh
  - [x] Current user endpoint

- [ ] **Users API**
  - [ ] CRUD endpoints
  - [ ] Department members listing
  - [ ] User history tracking

- [ ] **Projects API**
  - [ ] CRUD endpoints
  - [ ] Milestones management
  - [ ] Status updates

- [ ] **WorkLogs API**
  - [ ] CRUD endpoints
  - [ ] 24시간 초과 검증
  - [ ] 주간 복사 기능
  - [ ] 일별 요약 API

- [ ] **Resource Plans API**
  - [ ] CRUD endpoints
  - [ ] TBD 포지션 관리
  - [ ] 담당자 배정

- [ ] **Reports API**
  - [ ] Capacity 리포트 (공휴일 반영)
  - [ ] Department 리포트
  - [ ] Project 리포트

### Phase 2: Frontend 페이지 구현
- [ ] Login 페이지
- [ ] Projects 목록/상세
- [ ] WorkLogs 입력/편집
- [ ] Resource Plans 관리
- [ ] Team 관리
- [ ] Reports 대시보드

### Phase 3: 통합 및 배포
- [ ] Frontend ↔ Backend 연동
- [ ] 테스트 작성
- [ ] Azure VM 배포 설정
- [ ] CI/CD 파이프라인

---

## 🔧 개발 환경 명령어

```bash
# 전체 시스템 실행
docker compose up -d

# Backend만 실행 (로컬 개발)
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Frontend만 실행 (로컬 개발)
cd frontend && pnpm dev

# 마이그레이션 실행
docker compose exec backend alembic upgrade head

# 마이그레이션 생성
docker compose exec backend alembic revision --autogenerate -m "description"
```

---

## 📚 참고 문서
- [요구사항](./requirment.md)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
