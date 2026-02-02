# Support 프로젝트 UI 구현

## 개요
WorkLog 입력 UI에 "비프로젝트 업무 (Support)" 섹션을 추가하여 상시 업무를 선택할 수 있도록 구현했습니다.

## 변경 내용

### 1. Backend - project_service.py

`get_project_hierarchy()` 메서드에 `support_projects` 반환 추가:

```python
# Build Support Projects list (non-project regular work)
support_projects_db = (
    self.db.query(Project)
    .options(
        joinedload(Project.internal_io),
        joinedload(Project.recharge_io),
    )
    .filter(Project.category == "SUPPORT")
    .order_by(Project.name)
    .all()
)

support_projects = [
    {
        "id": p.id,
        "code": p.internal_io.io_number if p.internal_io else "",
        "name": p.name,
        "type": "project",
        "status": p.status,
        "description": p.description,
        "recharge_io_id": p.recharge_io_id,
    }
    for p in support_projects_db
]
```

### 2. Frontend - useProjectHierarchy.ts

`ProjectHierarchyResponse` 인터페이스에 `support_projects` 추가:

```typescript
export interface ProjectHierarchyResponse {
    product_projects: HierarchyNode[];
    functional_projects: HierarchyNode[];
    support_projects: HierarchyNode[];  // NEW
    ungrouped_projects: HierarchyNode[];
}
```

### 3. Frontend - ProjectHierarchySelect.tsx

주요 변경사항:
- `SelectionMode` 타입에 `'support'` 추가
- `onProjectChange` 콜백에 `category` 파라미터 추가
- `Wrench` 아이콘 import (Support 프로젝트용)
- `selectedName`에서 support_projects 검색 추가
- `handleSelectSupportProject` 함수 추가
- `filteredSupportProjects` useMemo 추가
- 드롭다운에 "비프로젝트 업무" 섹션 추가 (amber 스타일)

```tsx
{/* Support Projects Section (비프로젝트 상시 업무) */}
{filteredSupportProjects.length > 0 && (
    <div className="border-b">
        <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-amber-50">
            비프로젝트 업무
        </div>
        {filteredSupportProjects.map(project => (
            <button
                key={project.id}
                type="button"
                onClick={() => handleSelectSupportProject(project)}
                className={`w-full flex items-center gap-2 py-2 px-3 text-sm hover:bg-amber-50 text-left ${
                    projectId === project.id ? 'bg-amber-100 text-amber-700' : ''
                }`}
            >
                <Wrench className="h-4 w-4 text-amber-500" />
                <span className="truncate">{project.name}</span>
            </button>
        ))}
    </div>
)}
```

### 4. Frontend - WorkLogEntryModal.tsx & AIWorklogPreview.tsx

`onProjectChange` 콜백 시그니처 업데이트:

```typescript
// Before
const handleProjectChange = (projectId: string | null) => { ... }

// After
const handleProjectChange = (projectId: string | null, _projectName?: string, _category?: string) => { ... }
```

## 검증 결과

### Build 확인
```bash
> pnpm build
✓ 3414 modules transformed.
✓ built in 2.86s
```

### API 테스트
```bash
> curl http://localhost:8004/api/projects/hierarchy | jq '.support_projects'
[
  {"id": "7da15734...", "name": "Pre-Gate Support", ...},
  {"id": "025852db...", "name": "SUN Operations Support", ...},
  {"id": "f63dfcaf...", "name": "SUN Product Improvement", ...},
  {"id": "c101b5a3...", "name": "VSS Product Improvement", ...},
  {"id": "89f2b110...", "name": "VSS Sales/Service Support", ...}
]
```

## UI 구조

프로젝트 선택 드롭다운 구조:
1. **제품 프로젝트** - Business Unit → Product Line → Projects 계층
2. **기능 프로젝트 (내 팀)** - Department → Projects 계층
3. **비프로젝트 업무** - Support 프로젝트 리스트 (NEW)
4. **해당 없음** - 프로젝트 미선택 옵션

## Phase 2: Auto-routing 구현 (완료)

### 변경 내용

#### 1. API Client (client.ts)
```typescript
// BusinessUnit 타입 추가
export interface BusinessUnitSimple {
  id: string;
  name: string;
  code: string;
}

// RechargeIO에 business_units 추가
export interface RechargeIOResponse {
  // ... existing fields
  business_units?: BusinessUnitSimple[];
}

// BU별 RechargeIO 조회 함수
export const getRechargeIOsByBusinessUnit = async (buId: string): Promise<RechargeIOResponse[]> => {
  const response = await apiClient.get(`/recharge-ios/by-business-unit/${buId}`);
  return response.data;
};
```

#### 2. useRechargeIOs.ts Hook
```typescript
export function useRechargeIOsByBusinessUnit(buId: string | undefined) {
    return useQuery<RechargeIOResponse[], Error>({
        queryKey: rechargeIOKeys.byBusinessUnit(buId || ''),
        queryFn: () => getRechargeIOsByBusinessUnit(buId!),
        enabled: !!buId,
        staleTime: 5 * 60 * 1000,
    });
}
```

#### 3. ProjectHierarchySelect.tsx
- 사용자의 `primary_business_unit_id` 기반으로 RechargeIO 조회
- `findMatchingRechargeIO` 함수로 Support 프로젝트와 RechargeIO 매칭
- UI에 매칭된 IO 번호 표시

```tsx
// Support 프로젝트 섹션 헤더에 BU 코드 표시
비프로젝트 업무 (ABT)

// 각 Support 프로젝트에 매칭된 IO 표시
🔧 SUN Operations Support
   ℹ️ IO: 407278
```

### Auto-routing 로직

1. 사용자의 `primary_business_unit_id` 확인
2. 해당 BU에 연결된 RechargeIO 목록 조회
3. Support 프로젝트 이름과 RechargeIO 이름 매칭
4. 매칭된 IO 번호를 힌트로 표시

예시:
- 사용자 BU: ABT
- Support 프로젝트: "SUN Operations Support"
- 매칭된 RechargeIO: "[ABT/IS] SUN Operations Support" (407278)

### Gemini 코드 리뷰 결과

- 로직 정확성: 통과
- Edge Cases: 처리됨 (no BU, no match, empty list)
- 성능: 5분 캐싱으로 최적화
- UI/UX: 적절함

## 다음 단계

1. ~~Auto-routing 로직 구현~~ ✅
2. RechargeIO Override 옵션 제공 (수동 선택)
3. Support 프로젝트 관리 UI 추가
