---
name: vercel-best-practice
description: Vercel Engineering의 React/Next.js 성능 최적화 가이드라인을 적용하여 렌더링 성능, 번들 크기, API 호출을 최적화합니다.
disable-model-invocation: false
---

# Vercel React Best Practices Skill

Vercel Engineering의 React/Next.js 성능 최적화 가이드라인을 Edwards 프로젝트에 적용합니다.

## 핵심 원칙

1. **불필요한 리렌더링 방지**
2. **번들 크기 최소화**
3. **API 호출 최소화**
4. **렌더링 성능 최적화**

## 적용 규칙

### Priority 5: Re-render Optimization (MEDIUM)

#### `rerender-memo`
React.memo를 사용하여 불필요한 리렌더링 방지

```tsx
// ✅ Good: Memoized component
const InlineEditableRow = memo<Props>(({ project, onUpdate }) => {
  return <tr>...</tr>;
});

// ❌ Bad: 매번 리렌더
export function InlineEditableRow({ project, onUpdate }: Props) {
  return <tr>...</tr>;
}
```

**적용 대상**:
- 테이블 행 컴포넌트
- 셀 컴포넌트
- 리스트 아이템 컴포넌트

#### `rerender-functional-setstate`
setState에서 변경 없으면 스킵

```tsx
// ✅ Good: Skip if no change
setColumnWidths(prev => {
  if (prev[column] === newWidth) return prev;
  return { ...prev, [column]: newWidth };
});

// ❌ Bad: 항상 새 객체 생성
setColumnWidths({ ...columnWidths, [column]: newWidth });
```

#### `rerender-dependencies`
useEffect 의존성을 primitive 값으로 최적화

```tsx
// ✅ Good: Memoized filtered list
const filteredProductLines = useMemo(() => {
  return selectedBusinessUnitId
    ? productLines.filter(pl => pl.business_unit_id === selectedBusinessUnitId)
    : productLines;
}, [productLines, selectedBusinessUnitId]);

// ✅ Good: Primitive dependency
const valueExistsInFiltered = useMemo(() => {
  return value ? filteredProductLines.some(pl => pl.id === value) : true;
}, [value, filteredProductLines]);

useEffect(() => {
  if (value && !valueExistsInFiltered) {
    onChange('');
  }
}, [value, valueExistsInFiltered, onChange]);
```

### Priority 6: Rendering Performance (MEDIUM)

#### `rendering-hoist-jsx`
정적 JSX를 컴포넌트 외부로 호이스팅

```tsx
// ✅ Good: Static JSX hoisted
const SortIconDefault = <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
const SortIconAsc = <ArrowUp className="h-3 w-3 ml-1 text-gray-700" />;
const SortIconDesc = <ArrowDown className="h-3 w-3 ml-1 text-gray-700" />;

export function ProjectInlineTable() {
  return (
    <th>
      {sortField === 'name' && sortDirection === 'asc' ? SortIconAsc : SortIconDefault}
    </th>
  );
}

// ❌ Bad: 매 렌더마다 재생성
export function ProjectInlineTable() {
  return (
    <th>
      {sortField === 'name' && sortDirection === 'asc' 
        ? <ArrowUp className="h-3 w-3 ml-1 text-gray-700" />
        : <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />
      }
    </th>
  );
}
```

**적용 대상**:
- 아이콘 컴포넌트
- Placeholder 텍스트
- 정적 버튼/링크

### Priority 7: JavaScript Performance (LOW-MEDIUM)

#### `js-index-maps`
배열.find() 대신 Map을 사용하여 O(1) 조회

```tsx
// ✅ Good: Map for O(1) lookup
const FUNDING_ENTITY_MAP = new Map(
  FUNDING_ENTITY_OPTIONS.map(o => [o.value, o.label])
);

// 사용
{FUNDING_ENTITY_MAP.get(project.funding_entity_id ?? '') || EmptyPlaceholder}

// ❌ Bad: O(n) find each render
const option = FUNDING_ENTITY_OPTIONS.find(o => o.value === project.funding_entity_id);
{option?.label || '-'}
```

#### `js-combine-iterations`
여러 순회를 하나로 통합

```tsx
// ✅ Good: Single-pass filter + sort
const sortedProjects = useMemo(() => {
  let result: Project[] = [];
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (hasCategories && (!p.category || !selectedCategories.includes(p.category))) continue;
    if (hasStatuses && !selectedStatuses.includes(p.status)) continue;
    result.push(p);
  }
  if (sortField && sortDirection) {
    result.sort((a, b) => { ... });
  }
  return result;
}, [projects, selectedCategories, selectedStatuses, sortField, sortDirection]);

// ❌ Bad: Multiple iterations
const filtered = projects.filter(p => selectedCategories.includes(p.category));
const sorted = filtered.sort((a, b) => { ... });
```

## TanStack Query 최적화

### 전역 설정 (main.tsx)

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 데이터를 5분간 fresh 상태로 유지
      staleTime: 5 * 60 * 1000,
      // 미사용 데이터를 30분간 캐시에 유지
      gcTime: 30 * 60 * 1000,
      // 윈도우 포커스 시 자동 refetch 비활성화
      refetchOnWindowFocus: false,
      // 실패 시 1회만 재시도
      retry: 1,
      retryDelay: 1000,
    },
  },
});
```

### 참조 데이터 장기 캐싱

```tsx
// Job Position 같은 참조 데이터는 30분 staleTime
const { data: jobPositions } = useQuery({
  queryKey: ['jobPositions'],
  queryFn: () => apiClient.get('/job-positions').then(r => r.data),
  staleTime: 30 * 60 * 1000, // 30분
});
```

## CSS 최적화

### content-visibility

```css
/* 화면 밖 콘텐츠 렌더링 지연 */
tbody.virtualized {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}
```

**적용 대상**: 대량 데이터 테이블 (500+ 행)

## Route-Level Code Splitting

```tsx
// ✅ Good: Lazy loading
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

// Suspense로 감싸서 로딩 상태 처리
<Route path="/" element={
  <Suspense fallback={<PageLoader />}>
    <DashboardPage />
  </Suspense>
} />
```

**효과**: 초기 번들 크기 61% 감소 (1,127KB → 437KB)

## 적용 체크리스트

### 컴포넌트 최적화
- [ ] React.memo 적용 (테이블 행, 셀, 리스트 아이템)
- [ ] 정적 JSX 호이스팅 (아이콘, placeholder)
- [ ] useCallback으로 핸들러 함수 메모이제이션
- [ ] useMemo로 계산 결과 캐싱

### 상태 관리 최적화
- [ ] setState에서 변경 없으면 스킵
- [ ] useEffect 의존성을 primitive 값으로
- [ ] 불필요한 상태 업데이트 방지

### 데이터 처리 최적화
- [ ] Map을 사용한 O(1) 조회
- [ ] 여러 순회를 하나로 통합
- [ ] TanStack Query staleTime 설정

### 번들 최적화
- [ ] Route-level code splitting
- [ ] 동적 import 사용
- [ ] 불필요한 의존성 제거

## 성능 측정

### 빌드 결과
```bash
✓ built in 4.10s
ProjectsPage: 41.37 kB → 30.94 kB (-25% 감소)
```

### 번들 크기 목표
- 메인 번들: < 500KB (gzipped)
- 페이지별 청크: < 100KB
- 총 번들: < 1MB (gzipped)

## 관련 문서

- `workthrough/2026-01-28_14_30_vercel-react-best-practices.md` - 초기 적용
- `workthrough/2026-01-31_19_30_vercel-best-practices-optimization.md` - 인라인 테이블 최적화
- `workthrough/2026-01-28_11_00_route-level-code-splitting.md` - Code splitting

## 참고 자료

- [Vercel React Performance](https://vercel.com/docs/framework/react/overview)
- [TanStack Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
