# My FTE 대시보드 기능 구현

## 개요

User Dashboard의 Monthly 뷰에 "나의 리소스 배분" (My FTE) 카드를 추가하여 사용자의 월별 FTE 배분을 시각화했습니다. 리소스 매트릭스와 동일한 정규화 FTE 계산 방식을 적용하여 총계가 1.0 (100%)이 되도록 구현했습니다.

## 변경 사항

### Backend

#### 1. 새로운 스키마 추가
- **파일**: `backend/app/schemas/dashboard.py`
- Pydantic 스키마 정의:
  - `MyFTEProjectItem`: 개별 프로젝트 FTE 데이터
  - `MyFTESummary`: 총계 FTE 요약
  - `MyFTEProductFunctional`: Product/Functional 프로젝트 그룹 (계획됨/계획 외)
  - `MyFTEResponse`: 전체 응답 구조

#### 2. Dashboard Service 확장
- **파일**: `backend/app/services/dashboard_service.py`
- `get_my_fte(user_id, year, month)` 메서드 추가
- **FTE 계산 공식** (리소스 매트릭스와 동일):
  ```
  FTE = (해당 프로젝트 시간) / (전체 프로젝트 시간 합계)
  ```
  - 팀 업무 (project_id가 NULL인 WorkLog) 제외
  - 총계 FTE는 항상 1.0 (100%)
- 계획과 실적이 모두 0인 프로젝트 필터링 (반올림된 FTE 기준)

#### 3. API 엔드포인트 추가
- **파일**: `backend/app/api/endpoints/dashboard.py`
- `GET /api/dashboard/my-fte?year=2026&month=1`
- JWT 인증 필요

### Frontend

#### 1. API 클라이언트 확장
- **파일**: `frontend/src/api/client.ts`
- `MyFTEProjectItem`, `MyFTEResponse` 인터페이스 추가
- `getMyFTE(year, month)` 함수 추가

#### 2. Hook 추가
- **파일**: `frontend/src/hooks/useDashboard.ts`
- `useMyFTE(year, month, enabled)` TanStack Query 훅 추가

#### 3. MyFTECard 컴포넌트 생성
- **파일**: `frontend/src/components/dashboard/MyFTECard.tsx`
- 주요 기능:
  - Product/Functional 섹션: 계획 대비 실적 비교 (프로그레스 바)
  - Support 섹션: 실적만 표시 (ad-hoc 특성)
  - 색상 코딩: >110% 빨강, <80% 주황, 80-110% 초록
  - 프로젝트명을 대표 텍스트로, IO 번호는 우측에 작게 회색으로 표시

#### 4. DashboardPage 수정
- **파일**: `frontend/src/pages/DashboardPage.tsx`
- Monthly 뷰에서 MyFTECard 렌더링
- "참여 프로젝트 현황" 섹션 제거

### 데이터베이스 수정

- `General/Non-Project`와 `TFT` 프로젝트의 ResourcePlan `planned_hours`를 0으로 업데이트 (611개 레코드)
- 이유: 해당 프로젝트들은 catch-all/ad-hoc 성격으로 계획 FTE가 필요 없음

## 코드 예시

### FTE 계산 로직 (Backend)
```python
# 정규화된 FTE 계산 (리소스 매트릭스와 동일)
total_actual_hours = sum(actual_map.values())

for pid in all_project_ids:
    actual_hours = actual_map.get(pid, 0)

    # FTE = 프로젝트 시간 / 전체 프로젝트 시간
    actual_fte = 0.0
    if total_actual_hours > 0:
        actual_fte = actual_hours / total_actual_hours
```

### 0/0 프로젝트 필터링
```python
# 반올림된 FTE 기준으로 필터링
rounded_planned = round(planned_fte, 2) if planned_fte else 0
rounded_actual = round(actual_fte, 2)
if rounded_planned == 0 and rounded_actual == 0:
    continue
```

## 검증

- API 엔드포인트 정상 동작 확인
- FTE 총계가 1.0 (100%)으로 정규화되는 것 확인
- 계획/실적이 모두 0인 프로젝트가 목록에서 제외되는 것 확인

## 향후 개선 사항

- Weekly/Quarterly 뷰에서도 FTE 카드 표시 고려
- 프로젝트별 상세 드릴다운 기능
- FTE 트렌드 차트 (월별 변화 추이)
