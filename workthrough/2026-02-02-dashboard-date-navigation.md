# Dashboard Date Navigation Update

## 목표
대시보드의 날짜 탐색 UI를 개선하여 동적 기간 이동을 지원합니다. 기존의 정적 "이번 주/이번 달" 방식에서 좌우 화살표 버튼을 사용한 동적 탐색 방식으로 변경했습니다.

## 구현 내용

### 1. 동적 날짜 범위 계산
[DashboardPage.tsx:21-70](file:///Users/cyanluna-pro16/dev/edwards/engineering.management/edwards.reousrce.management/frontend/src/pages/DashboardPage.tsx#L21-L70)

**기존 방식**:
- 모듈 로드 시점에 정적으로 계산된 `STATIC_DATE_RANGES` 사용
- 페이지 새로고침 없이 다른 기간으로 이동 불가

**개선 방식**:
- `currentDate` state를 추가하여 현재 참조 날짜 추적
- `getDynamicDateRanges(referenceDate, mode)` 헬퍼 함수로 동적 계산
- `viewMode`와 `currentDate`에 따라 실시간으로 날짜 범위 업데이트

```typescript
const getDynamicDateRanges = (referenceDate: Date, mode: ViewMode) => {
    switch (mode) {
        case 'weekly': {
            const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
            return { start: format(weekStart, 'yyyy-MM-dd'), end: format(weekEnd, 'yyyy-MM-dd') };
        }
        // ... monthly, quarterly, yearly cases
    }
};
```

### 2. 네비게이션 핸들러 구현
[DashboardPage.tsx:447-490](file:///Users/cyanluna-pro16/dev/edwards/engineering.management/edwards.reousrce.management/frontend/src/pages/DashboardPage.tsx#L447-L490)

3가지 네비게이션 액션 추가:

- **`handlePrevPeriod()`**: 이전 기간으로 이동 (주 → -1주, 월 → -1월, 분기 → -1분기, 연 → -1년)
- **`handleNextPeriod()`**: 다음 기간으로 이동
- **`handleToday()`**: 현재 날짜를 포함하는 기간으로 복귀

### 3. 데이터 훅 리팩토링
[DashboardPage.tsx:85-115](file:///Users/cyanluna-pro16/dev/edwards/engineering.management/edwards.reousrce.management/frontend/src/pages/DashboardPage.tsx#L85-L115)

**기존**: 5개의 정적 `useWorklogsTable` 훅 (weekly, monthly, quarterly, halfYear, yearly)
**개선**: 1개의 동적 훅으로 통합

```typescript
const { data: currentWorklogs = [], isLoading: currentLoading } = useWorklogsTable({
    start_date: periodStart,
    end_date: periodEnd,
    user_id: user?.id,
    limit: viewMode === 'yearly' ? 2000 : viewMode === 'quarterly' ? 500 : 200,
    enabled: true,
});
```

**장점**:
- 메모리 사용량 감소 (5개 → 1개 훅)
- 불필요한 API 호출 제거
- `currentDate` 또는 `viewMode` 변경 시 자동 refetch

### 4. UI 업데이트
[DashboardPage.tsx:510-542](file:///Users/cyanluna-pro16/dev/edwards/engineering.management/edwards.reousrce.management/frontend/src/pages/DashboardPage.tsx#L510-L542)

**네비게이션 컨트롤 추가**:
```tsx
<Button variant="outline" onClick={handlePrevPeriod} size="sm">←</Button>
<Button variant="outline" onClick={handleToday} size="sm">오늘</Button>
<Button variant="outline" onClick={handleNextPeriod} size="sm">→</Button>
```

**기간 선택 버튼 레이블 변경**:
- `📅 이번 주` → `Weekly`
- `📆 이번 달` → `Monthly`
- `📊 이번 분기` → `Quarterly`
- `📈 최근 6개월` → `Half Year`
- `🗓️ 올해` → `Yearly`

**날짜 범위 표시 간소화**:
- 기존: `viewMode`에 따라 조건부 표시
- 개선: 단일 `{periodStart} ~ {periodEnd}` 표시

## 테스트 방법

1. **Weekly 네비게이션**:
   - Weekly 버튼 클릭
   - `→` 클릭 → 다음 주로 이동 확인
   - `←` 클릭 → 이전 주로 이동 확인
   - `오늘` 클릭 → 현재 주로 복귀 확인

2. **Monthly 네비게이션**:
   - Monthly 버튼 클릭
   - 화살표 버튼으로 월 단위 이동 확인

3. **Quarterly/Yearly**:
   - 각 기간 선택 후 네비게이션 정상 작동 확인

4. **데이터 로딩**:
   - 기간 변경 시 worklog 데이터 자동 재로딩 확인
   - 차트 및 통계 업데이트 확인

## 영향 범위

**수정된 파일**:
- [DashboardPage.tsx](file:///Users/cyanluna-pro16/dev/edwards/engineering.management/edwards.reousrce.management/frontend/src/pages/DashboardPage.tsx)

**주요 변경사항**:
- 날짜 계산 로직 동적화
- 네비게이션 핸들러 추가
- 데이터 훅 통합
- UI 컨트롤 업데이트
