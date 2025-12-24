# Edwards Project Operation Board - TODO

## ✅ 완료된 작업

### Phase 1: 코어 기능 (2024-12-11)
- [x] Authentication API - Login/JWT, Token refresh, Current user
- [x] Users API - CRUD, 부서원 목록, 변경 이력 추적
- [x] Projects API - 목록/상세 조회
- [x] 초기 DB 시딩 - Alembic 마이그레이션

### Phase 2: 프론트엔드 기초 (2024-12-11)
- [x] AuthContext, useAuth, 보호된 라우팅
- [x] 로그인 페이지, 프로젝트 목록 페이지

### Phase 3-4: Projects & WorkLogs (2024-12-12)
- [x] Projects CRUD, Milestones API
- [x] WorkLogs CRUD, 달력 기반 UI

### Phase 5-6: Resource Plans & Dashboard (2024-12-16)
- [x] 12개월 월별 FTE 그리드
- [x] 집계 뷰 (프로젝트별/롤별)
- [x] 개인 대시보드 (주간 WorkLog, 리소스 현황)

### Phase 7: 관리 기능 (2024-12-16)
- [x] Job Positions 관리 UI (`/organization`)
- [x] Reports 기능 - Capacity/WorkLog 차트 (recharts)

---

## 📋 다음 작업 (TODO)

### 🚀 Phase 8: 확장 대시보드 (Next)
- [x] **User Dashboard UI 개선** - 탭 구조 전환, 차트 리사이징, 레이아웃 변경
- [ ] **Team Dashboard 구현**
    - [ ] 팀원별 리소스 할당 현황 (바 차트)
    - [ ] 팀 전체 WorkLog 통계 (히트맵/파이)
    - [ ] 부서별 프로젝트 참여율 비교
- [ ] **Project Dashboard 구현**
    - [ ] 프로젝트별 번다운 차트 / 진행률
    - [ ] 프로젝트별 투입 인원 및 시간 통계
    - [ ] 마일스톤 달성 현황 대시보드

### 🔴 배포 (다음 일정)
- [ ] **Vercel 배포** - Frontend (React)
- [ ] **Render 배포** - Backend (FastAPI)
- [ ] **Supabase 연동** - PostgreSQL 데이터베이스
- [ ] **환경변수 설정** - 프로덕션 설정

### 🟡 우선순위 중간
- [ ] TBD → 사용자 할당 모달
- [ ] 리소스 충돌 감지 (월별 FTE > 1.0 경고)
- [ ] Programs 관리 UI
- [ ] Team 관리 (사용자/부서)

### 🟢 향후 개선
- [ ] Excel Import/Export
- [ ] 다크 모드, 다국어 지원
- [ ] 알림 시스템

---

## 🔧 개발 환경 명령어

```bash
# 전체 시스템 실행
docker compose up -d

# 로그 확인
docker compose logs -f backend

# Frontend 재빌드 (패키지 추가 후)
docker compose exec frontend pnpm install && docker compose restart frontend

# API 문서
http://localhost:8000/api/docs
```

---

## 📚 참고 문서
- [요구사항](./requirment.md)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)

## 🔑 기본 로그인
- **Email:** admin@edwards.com
- **Password:** password