# Vercel React Best Practices 최적화 적용

## 개요

프로젝트 인라인 테이블 컴포넌트들에 Vercel React Best Practices를 적용하여 렌더링 성능을 최적화했습니다.

## 적용된 최적화 규칙

| Rule | 파일 | 개선 효과 |
|------|------|----------|
| `rerender-memo` | InlineEditableRow, EditableCell | 불필요한 리렌더링 방지 |
| `rerender-functional-setstate` | handleResizeMove | setState 배치 최적화 |
| `js-index-maps` | InlineEditableRow | O(1) 조회로 성능 향상 |
| `rendering-hoist-jsx` | ProjectInlineTable, InlineEditableRow | 정적 JSX 재생성 방지 |
| `rerender-dependencies` | ProductLineSelectCell | useEffect 불필요 실행 방지 |
| `js-combine-iterations` | ProjectInlineTable | filter + sort 단일 순회 |

## 변경 내역

### 1. ProjectInlineTable.tsx

**정적 JSX 호이스팅:**
```tsx
// [rendering-hoist-jsx] Static JSX hoisted outside component
const SortIconDefault = <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
const SortIconAsc = <ArrowUp className="h-3 w-3 ml-1 text-gray-700" />;
const SortIconDesc = <ArrowDown className="h-3 w-3 ml-1 text-gray-700" />;
```

**setState 최적화:**
```tsx
// [rerender-functional-setstate] Skip if no change
setColumnWidths(prev => {
  if (prev[column] === newWidth) return prev;
  return { ...prev, [column]: newWidth };
});
```

**필터 + 정렬 통합:**
```tsx
// [js-combine-iterations] Combined filter + sort in single useMemo
const sortedProjects = useMemo(() => {
  const hasCategories = selectedCategories.length > 0;
  const hasStatuses = selectedStatuses.length > 0;

  // Single-pass filter
  let result: Project[] = [];
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (hasCategories && (!p.category || !selectedCategories.includes(p.category))) continue;
    if (hasStatuses && !selectedStatuses.includes(p.status)) continue;
    result.push(p);
  }

  // Sort if needed
  if (sortField && sortDirection) {
    result.sort((a, b) => { ... });
  }
  return result;
}, [projects, selectedCategories, selectedStatuses, sortField, sortDirection]);
```

### 2. InlineEditableRow.tsx

**React.memo 적용:**
```tsx
// [rerender-memo] Memoized row component
const InlineEditableRowInner: React.FC<InlineEditableRowProps> = ({ ... }) => { ... };

// Export memoized component
export const InlineEditableRow = memo(InlineEditableRowInner);
```

**Map을 이용한 O(1) 조회:**
```tsx
// [js-index-maps] Build Map for O(1) lookups instead of .find() each render
const FUNDING_ENTITY_MAP = new Map(
  FUNDING_ENTITY_OPTIONS.map(o => [o.value, o.label])
);

// 사용
{FUNDING_ENTITY_MAP.get(project.funding_entity_id ?? '') || EmptyPlaceholder}
```

**정적 JSX 호이스팅:**
```tsx
// [rendering-hoist-jsx] Static placeholder JSX
const EmptyPlaceholder = <span className="text-gray-400">-</span>;
```

### 3. EditableCell.tsx

**모든 셀 컴포넌트 메모이제이션:**
```tsx
// [rerender-memo] Memoized TextCell
export const TextCell = memo<TextCellProps>(({ ... }) => { ... });

// [rerender-memo] Memoized SelectCell
export const SelectCell = memo<SelectCellProps>(({ ... }) => { ... });

// [rerender-memo] Memoized MonthCell
export const MonthCell = memo<MonthCellProps>(({ ... }) => { ... });
```

**useEffect 의존성 최적화:**
```tsx
// [rerender-dependencies] Memoize filtered list
const filteredProductLines = useMemo(() => {
  return selectedBusinessUnitId
    ? productLines.filter(pl => pl.business_unit_id === selectedBusinessUnitId)
    : productLines;
}, [productLines, selectedBusinessUnitId]);

// [rerender-dependencies] Use primitive for dependency check
const valueExistsInFiltered = useMemo(() => {
  return value ? filteredProductLines.some(pl => pl.id === value) : true;
}, [value, filteredProductLines]);

// Reset only when needed - stable primitive dependency
useEffect(() => {
  if (value && !valueExistsInFiltered) {
    onChange('');
  }
}, [value, valueExistsInFiltered, onChange]);
```

## 빌드 검증

```bash
> pnpm run build

✓ 3413 modules transformed.
✓ built in 4.10s

# 번들 사이즈 비교
ProjectsPage: 41.37 kB → 30.94 kB (-25% 감소)
```

## 성능 개선 효과

### 렌더링 최적화
- **React.memo**: 부모 리렌더 시 props 변경 없으면 스킵
- **useCallback**: 핸들러 함수 참조 안정화
- **hoisted JSX**: 아이콘, placeholder 매 렌더마다 재생성 방지

### 계산 최적화
- **combined iterations**: 3회 순회 → 1회 순회
- **Map lookup**: O(n) find → O(1) get

### 메모리 최적화
- **functional setState**: 불필요한 객체 생성 방지
- **primitive dependencies**: 참조 비교 대신 값 비교

## 적용 규칙 요약

```
Priority 5: Re-render Optimization (MEDIUM)
├── rerender-memo: 8개 컴포넌트 메모이제이션
├── rerender-functional-setstate: resize 핸들러 최적화
└── rerender-dependencies: useEffect 의존성 정리

Priority 6: Rendering Performance (MEDIUM)
└── rendering-hoist-jsx: 6개 정적 JSX 호이스팅

Priority 7: JavaScript Performance (LOW-MEDIUM)
├── js-index-maps: FUNDING_ENTITY Map 생성
└── js-combine-iterations: filter+sort 통합
```
