# My FTE Section 구현 결과

## 개요
User Dashboard의 Monthly 뷰 하단에 "My FTE" 섹션을 추가하여 사용자의 계획된 FTE와 실제 투입 FTE를 비교 표시하는 기능을 성공적으로 구현했습니다. 또한 리소스 플랜 데이터 정리를 위해 특정 프로젝트의 2026년 계획을 0으로 조정했습니다.

## 구현 내용

### 1. Backend API 구현
사용자의 월별 리소스 배분 데이터를 제공하는 전용 엔드포인트를 구축했습니다.

- **엔드포인트:** `GET /api/dashboard/my-fte?year=2026&month=2`
- **스키마:** `MyFTEResponse` (요약, Product/Functional, Support 분류 포함)
- **로직:** 
  - `ResourcePlan`과 `WorkLog` 데이터를 통합 분석
  - FTE 계산 기준: 월 160시간 (정규화된 FTE 방식 적용)
  - 전체 프로젝트 투입 시간 대비 비율로 계산하여 총계가 항상 1.0(100%)이 되도록 정규화

### 2. Frontend UI 구현
사용자가 직관적으로 자신의 리소스 투입 현황을 파악할 수 있도록 대시보드를 확장했습니다.

- **컴포넌트:** `MyFTECard.tsx`
- **시각화:** 
  - 계획이 있는 프로젝트는 프로그레스 바를 통해 계획 대비 실적 표시
  - 실적에 따른 색상 코딩 적용 (초과: 빨강, 미달: 주황, 정상: 초록)
  - 지원 업무(Support)는 별도 섹션으로 분리하여 실적 위주로 표시
- **대시보드 통합:** Monthly 뷰 선택 시 하단에 카드가 자동으로 나타나도록 통합

### 3. 데이터베이스 정리 (2026년 리소스 플랜)
운영 효율성을 위해 계획 관리가 불필요한 프로젝트들의 2026년 리소스 플랜을 정리했습니다.

- **대상 프로젝트:**
  - `General/Non-Project`
  - `EUV Gen4 Phase 1 Tumalo` (IO: 406437)
  - `TFT` (IO: PRJ-40)
- **작업 결과:** 해당 프로젝트들의 2026년 `planned_hours`를 모두 `0.0`으로 일괄 업데이트 완료 (약 800여 건)
- **참고:** `EUV Gen4 Phase 2 Tumalo`는 실수로 업데이트된 후 백업을 통해 원래 값으로 복구 완료

## 파일 변경 목록

### Backend
- `backend/app/schemas/dashboard.py`: MyFTE 관련 스키마 추가
- `backend/app/services/dashboard_service.py`: `get_my_fte()` 로직 구현
- `backend/app/api/endpoints/dashboard.py`: `/my-fte` 엔드포인트 노출

### Frontend
- `frontend/src/components/dashboard/MyFTECard.tsx`: 신규 UI 컴포넌트
- `frontend/src/api/client.ts`: API 통신 함수 추가
- `frontend/src/hooks/useDashboard.ts`: 데이터 페칭을 위한 TanStack Query 훅
- `frontend/src/pages/DashboardPage.tsx`: 대시보드 내 섹션 통합 및 기존 구형 섹션 제거

## 배포 및 검증
- **로컬 및 원격 배포:** `run_full_deploy.ps1`을 사용하여 원격 서버(`10.182.252.32`)에 배포 완료
- **동작 확인:** 강력 새로고침(Ctrl + F5) 후 Monthly 뷰에서 정상적으로 데이터가 표시됨을 확인
- **데이터 검증:** FTE 계산 및 프로젝트 분류 로직이 의도대로 작동함을 검증

## 향후 과제
- 프로젝트별 상세 실적 드릴다운 기능 추가 고려
- 주간(Weekly) 또는 분기(Quarterly) 단위의 FTE 요약 제공 검토