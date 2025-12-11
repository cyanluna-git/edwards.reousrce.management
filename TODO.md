# Edwards Project Operation Board - TODO

## ✅ 완료된 작업 (2024-12-11)

### 1. 코어 기능 구현
- [x] **Authentication API**
  - [x] Login / JWT 발급, Token refresh, Current user endpoint
- [x] **Users API**
  - [x] CRUD 엔드포인트
  - [x] 부서원 목록 조회 (필터링)
  - [x] 사용자 변경 이력 추적 (부서/직책 변경 시)
- [x] **Projects API**
  - [x] 목록 및 상세 조회 엔드포인트 (R)
- [x] **초기 데이터베이스 시딩**
  - [x] Alembic 마이그레이션 스크립트(`001`, `002`, `003`)
  - [x] `projects` 테이블 샘플 데이터 추가

### 2. 프론트엔드 페이지 구현
- [x] **인증 및 라우팅**
  - [x] `AuthContext` 및 `useAuth` 훅 구현
  - [x] 로그인 상태에 따른 보호된 라우팅 설정
- [x] **로그인 페이지**
  - [x] UI 및 API 연동, 오류 처리
- [x] **프로젝트 목록 페이지**
  - [x] `@tanstack/react-query`를 사용한 `useProjects` 훅
  - [x] `Table` 컴포넌트를 사용한 데이터 표시

---

## 📋 다음 작업 (TODO)

### Phase 1: Projects 기능 완성
- [ ] **Projects API**
  - [ ] 생성, 수정, 삭제(CUD) 엔드포인트 구현
  - [ ] 마일스톤(Milestones) 관리 CRUD 구현
  - [ ] 프로젝트 상태(Status) 변경 로직 구현
- [ ] **Projects Frontend**
  - [ ] 프로젝트 목록 페이지에서 항목 클릭 시 상세 페이지로 이동
  - [ ] 프로젝트 상세 정보 표시 페이지 구현
  - [ ] (Optional) 프로젝트 생성 및 수정을 위한 모달(Modal) 또는 폼(Form) 구현

### Phase 2: WorkLogs 기능 구현
- [ ] **WorkLogs API**
  - [ ] CRUD 엔드포인트
  - [ ] 24시간 초과 입력 검증 로직
  - [ ] 주간 복사 기능
  - [ ] 일별 요약 API
- [ ] **WorkLogs Frontend**
  - [ ] 달력 기반의 WorkLog 입력/편집 UI 구현

### Phase 3: 기타 기능 구현
- [ ] **Resource Plans API & Frontend**
- [ ] **Reports API & Frontend**
- [ ] **Team 관리 Frontend**

---

## 🔧 개발 환경 명령어

```bash
# 전체 시스템 실행
docker compose up -d

# Backend만 실행 (로컬 개발)
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Frontend만 실행 (로컬 개발)
cd frontend && pnpm dev

# DB 초기화 및 마이그레이션 실행 (DB 스키마나 시드 데이터 변경 시)
docker compose down -v
docker compose up -d --build --force-recreate
docker compose exec backend python scripts/create_db.py
docker compose exec backend alembic upgrade head
```

---

## 📚 참고 문서
- [요구사항](./requirment.md)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)