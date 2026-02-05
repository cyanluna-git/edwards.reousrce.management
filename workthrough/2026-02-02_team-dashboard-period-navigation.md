# Team Dashboard Period Navigation Implementation

**Date:** 2026-02-02  
**Branch:** `dashboard-team-report`  
**Related Issues:** 팀 대시보드에 유저 대시보드와 동일한 기간 선택 및 탐색 기능 추가

## Summary

팀 대시보드(Team Dashboard)에 유저 대시보드와 동일한 기간 선택 기능(주간, 월간, 분기, 연)과 화살표 탐색 기능을 추가했습니다.

## Changes Made

### Frontend Changes

#### 1. `frontend/src/pages/DashboardPage.tsx`
- **날짜 탐색 상태 추가**: `teamCurrentDate` state 추가
- **날짜 탐색 핸들러 추가**:
  - `handleTeamPrevPeriod()`: 이전 기간으로 이동
  - `handleTeamNextPeriod()`: 다음 기간으로 이동
  - `handleTeamToday()`: 오늘로 이동
- **날짜 범위 계산**: `teamDateRange` useMemo로 계산
- **UI 업데이트**: 팀 대시보드 탭에 화살표 탐색 버튼 및 기간 선택 버튼 추가
  - 화살표 버튼 (←, 오늘, →)
  - 기간 선택 버튼 (Weekly, Monthly, Quarterly, Yearly)

#### 2. `frontend/src/components/dashboard/TeamDashboardContent.tsx`
- **Props 확장**: `dateRange?: { start: string; end: string }` 추가
- **기간 선택 버튼 제거**: 상단의 기간 선택 버튼 제거 (DashboardPage에서 관리)
- **Hook 업데이트**: `useTeamDashboard`에 `dateRange` 전달

#### 3. `frontend/src/hooks/useDashboard.ts`
- **Hook 수정**: `useTeamDashboard`가 `dateRange` 파라미터를 받도록 수정
- **Query Key 업데이트**: 날짜 범위를 query key에 포함

#### 4. `frontend/src/api/client.ts`
- **API 함수 수정**: `getTeamDashboard`가 `dateRange`를 받아서 `start_date`, `end_date` 쿼리 파라미터로 전달

### Backend Changes

#### 1. `backend/app/api/endpoints/dashboard.py`
- **API 엔드포인트 수정**: `/api/dashboard/team-summary`에 `start_date`, `end_date` 선택적 파라미터 추가
- **예외 처리 추가**: try-catch 블록으로 에러 로깅 및 HTTPException 처리
- **타입 변환**: `current_user.id`를 `str()`로 변환

#### 2. `backend/app/services/dashboard_service.py`
- **메서드 시그니처 수정**: `get_team_dashboard`에 `start_date`, `end_date` 파라미터 추가
- **날짜 범위 계산 로직 개선**: 
  - `today` 변수를 항상 정의하도록 수정 (버그 수정)
  - `start_date`, `end_date`가 제공되면 사용, 없으면 `view_mode`로 계산
- **안전한 접근**: `user.sub_team`, `user_department` 접근 시 None 체크 강화
- **Import 추가**: `date` 타입 import 추가

#### 3. `backend/app/main.py`
- **CORS 설정 개선**: `localhost:3004`가 항상 포함되도록 확인 로직 추가

## Technical Details

### Date Range Calculation

```python
# Always define today for later use
today = datetime.now().date()

# If start_date and end_date are provided, use them; otherwise calculate from view_mode
if start_date is None or end_date is None:
    if view_mode == "weekly":
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=6)
    # ... other modes
```

### Frontend Date Navigation

```typescript
const handleTeamPrevPeriod = () => {
    switch (teamViewMode) {
        case 'weekly':
            setTeamCurrentDate(prev => subWeeks(prev, 1));
            break;
        // ... other modes
    }
};
```

## Bugs Fixed

1. **`today` 변수 미정의 에러**: `start_date`, `end_date`가 제공될 때 `today` 변수가 정의되지 않아 발생한 `UnboundLocalError` 수정
2. **`date` 타입 import 누락**: `dashboard_service.py`에 `date` import 추가
3. **타입 에러**: `current_user.id`를 문자열로 변환하여 전달

## Testing

- [x] 팀 대시보드에서 기간 선택 버튼 클릭 시 해당 기간 데이터 표시
- [x] 화살표 버튼으로 이전/다음 기간 탐색
- [x] "오늘" 버튼으로 현재 기간으로 이동
- [x] 날짜 범위가 API에 정확히 전달되는지 확인
- [x] 백엔드에서 날짜 범위를 올바르게 처리하는지 확인

## Files Changed

### Frontend
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/dashboard/TeamDashboardContent.tsx`
- `frontend/src/hooks/useDashboard.ts`
- `frontend/src/api/client.ts`

### Backend
- `backend/app/api/endpoints/dashboard.py`
- `backend/app/services/dashboard_service.py`
- `backend/app/main.py`

## Notes

- 유저 대시보드와 동일한 UX를 제공하여 사용자 경험 일관성 향상
- 날짜 범위를 프론트엔드에서 계산하여 백엔드에 전달하는 방식으로 구현
- 기존 `view_mode` 기반 계산 로직은 하위 호환성을 위해 유지
