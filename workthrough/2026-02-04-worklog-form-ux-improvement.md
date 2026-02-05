# Worklog 입력 폼 UX 개선: 기본 펼침 + 자주 사용 항목

## 개요

WorkLog 입력 시 업무 유형(WorkType)과 프로젝트 선택 드롭다운의 UX를 개선했다. 드롭다운을 열면 모든 카테고리/노드가 기본으로 펼쳐진 상태로 표시되며, 사용자의 실제 워크로그 데이터를 기반으로 자주 사용하는 항목을 상단에 칩 형태로 제공한다.

## Context

- 기존: 드롭다운 열면 모든 카테고리가 접혀 있어 매번 펼쳐야 선택 가능
- 기존: 자주 사용하는 항목에 대한 빠른 접근 수단 없음
- 초기 구현은 localStorage 기반 클릭 빈도 추적이었으나, 실제 worklog 데이터 기반으로 전환

## 변경 사항

### 1. 백엔드: 자주 사용 항목 API 추가

#### `backend/app/schemas/worklog.py`
- `FrequentItem` 스키마 추가 (id, label, count)
- `FrequentSelections` 스키마 추가 (work_types, projects 목록)

#### `backend/app/services/worklog_service.py`
- `get_frequent_selections()` 메서드 추가
- 최근 90일간 worklog에서 `work_type_category_id`별 COUNT 집계 → 상위 5개 반환
- 최근 90일간 worklog에서 `project_id`별 COUNT 집계 → 상위 5개 반환
- 카테고리명은 한국어 우선(`name_ko`), 프로젝트명은 IO번호 포함

```python
# backend/app/services/worklog_service.py
def get_frequent_selections(
    self, user_id: str, limit: int = 5, days: int = 90
) -> FrequentSelections:
    cutoff_date = date.today() - timedelta(days=days)

    wt_rows = (
        self.db.query(
            WorkLog.work_type_category_id,
            func.count().label("cnt"),
        )
        .filter(
            WorkLog.user_id == user_id,
            WorkLog.work_type_category_id.isnot(None),
            cast(WorkLog.date, Date) >= cutoff_date,
        )
        .group_by(WorkLog.work_type_category_id)
        .order_by(func.count().desc())
        .limit(limit)
        .all()
    )
    # ... project frequency도 동일 패턴
```

#### `backend/app/api/endpoints/worklogs.py`
- `GET /worklogs/frequent` 엔드포인트 추가
- 인증 필수 (`get_current_user`)
- 파라미터: `limit` (기본 5, 최대 10), `days` (기본 90, 최대 365)

### 2. 프론트엔드: API 기반 빈도 훅

#### `frontend/src/api/worklogs.ts`
- `FrequentItem`, `FrequentSelections` 타입 추가
- `getFrequentSelections()` API 클라이언트 함수 추가

#### `frontend/src/hooks/useFrequentSelections.ts` (신규 → 전면 교체)
- 초기: localStorage 기반 클릭 빈도 추적
- 최종: TanStack Query로 `GET /worklogs/frequent` API 호출
- `staleTime: 5분`으로 불필요한 재요청 방지
- `type` 파라미터로 work_types/projects 분기

```typescript
// frontend/src/hooks/useFrequentSelections.ts
export function useFrequentSelections(type: 'worktype' | 'project', userId?: string) {
    const { data } = useQuery({
        queryKey: [FREQUENT_KEY, userId],
        queryFn: () => getFrequentSelections(),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });

    const topItems: FrequentItem[] = type === 'worktype'
        ? (data?.work_types ?? [])
        : (data?.projects ?? []);

    return { topItems };
}
```

### 3. WorkTypeCategorySelect 개선

#### `frontend/src/components/WorkTypeCategorySelect.tsx`

**기본 펼침:**
- `expandedL1: number | null` → `expandedL1s: Set<number>`로 변경
- `useEffect`로 드롭다운 열릴 때 모든 L1 ID를 Set에 추가
- 여러 L1 동시 펼침 가능, 수동 접기/펼기 유지

**자주 사용 섹션:**
- 검색창과 카테고리 목록 사이에 칩 목록 표시
- `findCategoryById` 헬퍼로 현재 카테고리 트리에 존재하는 항목만 표시
- 검색어 입력 시 자주 사용 섹션 숨김
- 현재 선택된 항목은 파란색 하이라이트

### 4. ProjectHierarchySelect 개선

#### `frontend/src/components/ProjectHierarchySelect.tsx`

**기본 펼침:**
- `useEffect`로 드롭다운 열릴 때 모든 비-leaf 노드 ID를 `expandedNodes`에 추가
- `allParentNodeIds` memo로 product_projects, functional_projects, productLineHierarchy의 상위 노드 수집

**자주 사용 섹션:**
- `validItemLookup` Map으로 project/product_line/support 항목 O(1) 조회
- 칩 클릭 시 항목 타입에 따라 적절한 핸들러 호출
- 현재 hierarchy에 없는 ID는 자동 제외

## 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `backend/app/schemas/worklog.py` | FrequentItem, FrequentSelections 스키마 추가 |
| `backend/app/services/worklog_service.py` | get_frequent_selections() 메서드 추가 |
| `backend/app/api/endpoints/worklogs.py` | GET /worklogs/frequent 엔드포인트 추가 |
| `frontend/src/api/worklogs.ts` | getFrequentSelections() API 함수 추가 |
| `frontend/src/hooks/useFrequentSelections.ts` | localStorage → API 기반으로 전면 교체 |
| `frontend/src/components/WorkTypeCategorySelect.tsx` | 기본 펼침 + 자주 사용 섹션 |
| `frontend/src/components/ProjectHierarchySelect.tsx` | 기본 펼침 + 자주 사용 섹션 |

## 검증

### Python 구문 검증
```
All Python files parse OK
```

### 프론트엔드 빌드
- 신규 코드에 의한 TypeScript 에러 없음
- 기존 미사용 변수 경고 2건은 변경 전부터 존재 (TeamDashboardContent.tsx, ResourcesTab.tsx)

## 설계 결정

### localStorage → API 전환 이유
- localStorage: 기기/브라우저별 데이터 분리, cold-start 문제
- API: 실제 worklog 이력 기반으로 즉시 의미 있는 추천 제공, 크로스 디바이스 동작
- 클라이언트 측 기록(`recordUsage`) 불필요 → 코드 단순화
