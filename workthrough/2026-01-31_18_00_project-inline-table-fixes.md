# 프로젝트 인라인 테이블 버그 수정 및 UI 개선

## 개요

프로젝트 인라인 편집 테이블 기능의 빌드 오류, UI 시인성 문제, 런타임 에러를 수정하고 Code 필드 편집 기능을 추가했습니다.

## 수정된 문제들

### 1. 빌드 오류 (TypeScript)
- 사용되지 않는 변수들로 인한 컴파일 에러
- `updateField` 타입 불일치

### 2. 백엔드 API 에러 (500 Internal Server Error)
- `/api/users` 호출 시 `role` 필드가 None인 사용자로 인한 에러

### 3. UI 시인성 문제
- 다크 모드 스타일이 라이트 모드 앱에 적용되어 텍스트가 안 보임
- 필터 바, 테이블 헤더, 셀 텍스트 색상 문제

### 4. 런타임 에러 (Radix UI Select)
- `<SelectItem value="">` 빈 문자열 value 사용 불가

### 5. Code 필드 편집 불가
- Code가 read-only로 되어 있어 편집 불가

## 변경 내역

### 1. 빌드 오류 수정

**파일: `frontend/src/components/projects/ProjectHierarchyEditor.tsx`**

사용되지 않는 변수들 제거:
- `sortColumn`, `sortDirection`, `handleSort`
- `isLegacyCandidate`, `sortedProjects`
- `showClassificationColumns`

```tsx
// 변경 전
const [sortColumn, setSortColumn] = useState<string>('code');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
const [showClassificationColumns, setShowClassificationColumns] = useState(false);
// ... 많은 코드 ...

// 변경 후
const [showFinancialColumns, setShowFinancialColumns] = useState(false);
// 정렬/필터는 ProjectInlineTable 컴포넌트가 자체 처리
```

**파일: `frontend/src/components/projects/InlineEditableRow.tsx`**

타입 수정:
```tsx
// 변경 전
updateField: (field: string, value: any) => void;

// 변경 후
updateField: (field: keyof import('@/types').ProjectUpdate, value: any) => void;
```

### 2. 백엔드 스키마 수정

**파일: `backend/app/schemas/user.py`**

```python
# 변경 전
role: str = "USER"

# 변경 후
role: Optional[str] = "USER"
```

### 3. UI 라이트 모드 전용 스타일 적용

**파일: `frontend/src/components/ui/table.tsx`**

모든 `dark:` 클래스 제거하고 라이트 모드 전용 스타일 적용:

```tsx
// Table 컴포넌트
className={cn("w-full caption-bottom text-sm text-gray-900", className)}

// TableHeader
className={cn("[&_tr]:border-b bg-slate-50", className)}

// TableRow
className={cn(
  "border-b transition-colors bg-white hover:bg-slate-50 data-[state=selected]:bg-slate-100",
  className
)}

// TableHead
className={cn(
  "h-12 px-4 text-left align-middle font-semibold text-gray-900 [&:has([role=checkbox])]:pr-0",
  className
)}
```

**파일: `frontend/src/components/projects/InlineEditableRow.tsx`**

모든 셀에 라이트 모드 색상 적용:
```tsx
// View Mode 행
<TableRow className="bg-white hover:bg-slate-50">
  <TableCell className="font-mono text-xs text-gray-900">...</TableCell>
  <TableCell className="font-medium text-gray-900">...</TableCell>
  <TableCell className="text-sm text-gray-900">...</TableCell>
  ...
</TableRow>

// 배지 스타일
<span className={cn(
  'inline-flex px-2 py-0.5 rounded text-xs font-semibold',
  project.category === 'PRODUCT'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-purple-100 text-purple-800'
)}>
```

**파일: `frontend/src/components/projects/ProjectTableFilters.tsx`**

```tsx
<div className="flex flex-wrap items-center gap-3 p-4 bg-slate-100 border-b border-slate-200">
  <span className="text-sm font-semibold text-gray-900">Category:</span>
  <Button className="text-gray-700 hover:text-gray-900 hover:bg-slate-200">
    ...
  </Button>
</div>
```

**파일: `frontend/src/components/projects/ProjectInlineTable.tsx`**

```tsx
<TableHeader className="bg-slate-100">
  <TableHead className="text-gray-900 font-semibold">Code</TableHead>
  ...
</TableHeader>
```

### 4. Radix UI Select 빈 문자열 에러 수정

**파일: `frontend/src/components/projects/EditableCell.tsx`**

```tsx
// NONE_VALUE 상수 추가
const NONE_VALUE = '__NONE__';

// UserSelectCell
export const UserSelectCell: React.FC<UserSelectCellProps> = ({...}) => {
  const handleChange = (newValue: string) => {
    onChange(newValue === NONE_VALUE ? '' : newValue);
  };

  return (
    <Select value={value || NONE_VALUE} onValueChange={handleChange}>
      <SelectContent>
        <SelectItem value={NONE_VALUE} className="text-xs text-gray-500">None</SelectItem>
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>...</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ProductLineSelectCell도 동일하게 수정
```

### 5. Code 필드 편집 기능 추가

**파일: `frontend/src/components/projects/InlineEditableRow.tsx`**

```tsx
// 변경 전 (read-only)
<TableCell className="font-mono text-xs text-slate-600">
  {project.code}
</TableCell>

// 변경 후 (편집 가능)
<TableCell>
  <TextCell
    value={editState.fields.code}
    onChange={(value) => updateField('code', value)}
    error={editState.errors.code}
    placeholder="Project code"
    className="font-mono"
  />
</TableCell>
```

**파일: `frontend/src/hooks/useInlineProjectEdit.ts`**

```tsx
const startEdit = useCallback((project: Project) => {
  setEditState({
    projectId: project.id,
    fields: {
      code: project.code,  // ← 추가
      name: project.name,
      category: project.category,
      // ... 나머지 필드
    },
    errors: {},
  });
}, []);
```

## 수정된 파일 목록

| 파일 | 변경 내용 |
|-----|----------|
| `backend/app/schemas/user.py` | role 필드 Optional 처리 |
| `frontend/src/components/ui/table.tsx` | 라이트 모드 전용 스타일 |
| `frontend/src/components/projects/ProjectHierarchyEditor.tsx` | 미사용 변수 제거 |
| `frontend/src/components/projects/ProjectInlineTable.tsx` | dark: 클래스 제거, 라이트 모드 스타일 |
| `frontend/src/components/projects/ProjectTableFilters.tsx` | 라이트 모드 색상 적용 |
| `frontend/src/components/projects/InlineEditableRow.tsx` | 라이트 모드 스타일, Code 편집 추가 |
| `frontend/src/components/projects/EditableCell.tsx` | NONE_VALUE로 빈 문자열 에러 수정 |
| `frontend/src/hooks/useInlineProjectEdit.ts` | code 필드 추가 |

## 빌드 검증

```bash
> pnpm run build

✓ 3413 modules transformed.
✓ built in 3.20s

dist/assets/ProjectsPage-*.js    39.44 kB
dist/assets/index-*.js          452.24 kB
```

## 핵심 학습 포인트

### 1. Radix UI Select 제약사항
- `<SelectItem value="">` 사용 불가
- 빈 문자열 대신 특별한 placeholder 값 사용 필요
- onChange에서 값 변환 처리

### 2. 다크 모드 vs 라이트 모드
- 앱 전체 테마와 일관성 유지 중요
- `dark:` 클래스 사용 시 전체 앱 테마 고려 필요

### 3. TypeScript 엄격한 타입 체크
- 사용되지 않는 변수도 빌드 에러 발생
- Props 타입 정확히 맞춰야 함

## 남은 작업

- [ ] 저장 기능 실제 테스트
- [ ] BU-Program 관계 개선 (현재 간소화됨)
- [ ] 키보드 단축키 추가 (Enter로 저장, Esc로 취소)
