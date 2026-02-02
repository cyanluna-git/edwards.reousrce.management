# 프로젝트 인라인 테이블 컬럼 드래그 리사이즈 기능 추가

## 개요

Excel 스타일 프로젝트 인라인 편집 테이블에 컬럼 드래그 리사이즈 기능을 추가했습니다. 사용자가 컬럼 헤더의 오른쪽 가장자리를 드래그하여 컬럼 너비를 조절할 수 있습니다.

## 변경 내역

### 1. ProjectInlineTable.tsx

**컬럼 설정 상수 추가:**
```tsx
const COLUMN_CONFIG = {
  code: { label: 'Code', minWidth: 80, defaultWidth: 100, sortable: true },
  name: { label: 'Name', minWidth: 120, defaultWidth: 180, sortable: true },
  category: { label: 'Category', minWidth: 80, defaultWidth: 100, sortable: true },
  status: { label: 'Status', minWidth: 80, defaultWidth: 100, sortable: true },
  business_unit: { label: 'Business Unit', minWidth: 100, defaultWidth: 150, sortable: false },
  product_line: { label: 'Product Line', minWidth: 100, defaultWidth: 150, sortable: false },
  pm: { label: 'PM', minWidth: 80, defaultWidth: 120, sortable: false },
  scale: { label: 'Scale', minWidth: 60, defaultWidth: 80, sortable: false },
  customer: { label: 'Customer', minWidth: 80, defaultWidth: 100, sortable: false },
  product: { label: 'Product', minWidth: 80, defaultWidth: 120, sortable: false },
  start_month: { label: 'Start Month', minWidth: 100, defaultWidth: 120, sortable: true },
  end_month: { label: 'End Month', minWidth: 100, defaultWidth: 120, sortable: true },
  funding_entity: { label: 'Funding Entity', minWidth: 100, defaultWidth: 140, sortable: false },
  recharge_status: { label: 'Recharge Status', minWidth: 80, defaultWidth: 120, sortable: false },
} as const;
```

**리사이즈 상태 및 핸들러:**
```tsx
// Column resize state
const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
  const initial: Record<string, number> = {};
  Object.entries(COLUMN_CONFIG).forEach(([key, config]) => {
    initial[key] = config.defaultWidth;
  });
  return initial as Record<ColumnKey, number>;
});

// Resize refs
const resizingRef = useRef<{ column: ColumnKey; startX: number; startWidth: number } | null>(null);

// Handle column resize start
const handleResizeStart = useCallback((e: React.MouseEvent, column: ColumnKey) => {
  e.preventDefault();
  e.stopPropagation();
  resizingRef.current = {
    column,
    startX: e.clientX,
    startWidth: columnWidths[column],
  };
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeEnd);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}, [columnWidths]);
```

**리사이즈 가능한 헤더 렌더링:**
```tsx
const renderResizableHeader = (
  column: ColumnKey,
  sortField?: SortField,
  showResize: boolean = true
) => {
  const config = COLUMN_CONFIG[column];
  const isSortable = config.sortable && sortField;

  return (
    <TableHead
      className={`relative select-none text-gray-900 font-semibold ${isSortable ? 'cursor-pointer' : ''}`}
      style={{ width: columnWidths[column], minWidth: config.minWidth }}
      onClick={isSortable ? () => handleSort(sortField) : undefined}
    >
      <div className="flex items-center pr-2">
        {config.label}
        {isSortable && renderSortIcon(sortField)}
      </div>
      {showResize && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 group"
          onMouseDown={(e) => handleResizeStart(e, column)}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-300 group-hover:bg-blue-400" />
        </div>
      )}
    </TableHead>
  );
};
```

### 2. InlineEditableRow.tsx

**컬럼 너비 타입 및 Props 추가:**
```tsx
type ColumnWidths = {
  code: number;
  name: number;
  category: number;
  status: number;
  business_unit: number;
  product_line: number;
  pm: number;
  scale: number;
  customer: number;
  product: number;
  start_month: number;
  end_month: number;
  funding_entity: number;
  recharge_status: number;
};

interface InlineEditableRowProps {
  // ... 기존 props
  columnWidths: ColumnWidths;
}
```

**셀에 너비 적용:**
```tsx
// Edit Mode
<TableCell style={{ width: columnWidths.code }}>
  <TextCell ... />
</TableCell>

// View Mode
<TableCell className="font-mono text-xs text-gray-900 truncate" style={{ width: columnWidths.code }}>
  {project.code}
</TableCell>
```

## 수정된 파일 목록

| 파일 | 변경 내용 |
|-----|----------|
| `frontend/src/components/projects/ProjectInlineTable.tsx` | 컬럼 리사이즈 상태, 핸들러, 헤더 컴포넌트 추가 |
| `frontend/src/components/projects/InlineEditableRow.tsx` | columnWidths prop 추가, 셀에 너비 적용 |

## 사용 방법

1. 컬럼 헤더의 오른쪽 가장자리에 마우스를 올리면 리사이즈 커서가 나타남
2. 클릭 후 드래그하여 컬럼 너비 조절
3. 각 컬럼에는 최소 너비(minWidth)가 설정되어 있어 너무 좁아지지 않음
4. 테이블 헤더와 바디 셀 모두 동일한 너비가 적용됨

## 빌드 검증

```bash
> pnpm run build

✓ 3413 modules transformed.
✓ built in 3.65s

dist/assets/ProjectsPage-Bsac5JNB.js            41.37 kB │ gzip:   9.51 kB
```

## 핵심 구현 포인트

### 1. Document Event Listener 패턴
리사이즈 중에는 document 레벨에서 mousemove/mouseup 이벤트를 처리해야 마우스가 테이블 밖으로 나가도 정상 동작함

### 2. CSS table-layout: fixed
고정 레이아웃을 사용해야 컬럼 너비가 정확하게 적용됨

### 3. 커서 및 선택 방지
리사이즈 중 `document.body.style.cursor = 'col-resize'`와 `userSelect = 'none'`으로 UX 개선

### 4. truncate 클래스
긴 텍스트가 셀을 넘치지 않도록 말줄임표(...) 처리

## 남은 작업

- [ ] 컬럼 너비 localStorage 저장으로 새로고침 후에도 유지
- [ ] 더블클릭으로 컬럼 너비 자동 조절 (컨텐츠에 맞춤)
- [ ] 키보드 단축키 지원 (Enter로 저장, Esc로 취소)
