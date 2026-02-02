# 기능 프로젝트 섹션 미표시 버그 수정

## Overview
WorkLog 모달에서 "기능 프로젝트 (내 팀)" 섹션이 표시되지 않는 버그를 수정했습니다. 원인은 프론트엔드에서 `sub_team_id`를 전달하고 백엔드에서 `owner_department_id`와 비교하는 ID 타입 불일치였습니다.

## Context
- WorkLog 입력 UI에서 프로젝트 선택 드롭다운 구현 중
- "제품 프로젝트", "비프로젝트 업무" 섹션은 정상 표시
- "기능 프로젝트 (내 팀)" 섹션만 표시되지 않음
- API `/projects/hierarchy`는 `functional_projects` 데이터를 정상 반환
- OQC Digitalization 등 FUNCTIONAL 카테고리 프로젝트가 Projects 페이지에는 보이지만 WorkLog 모달에는 안 보임

## 문제 분석

### 데이터 흐름
```
프론트엔드                          백엔드
────────────────────────────────────────────────────────
User.sub_team_id  ──────────────>  user_department_id 파라미터
       │                                    │
       └─── SubTeam ID (예: "ST001")        │
                                            ▼
                               Project.owner_department_id와 비교
                                            │
                               Department ID (예: "DEPT001")
                                            │
                               ❌ ID 타입 불일치로 매칭 실패
```

### 백엔드 코드 (project_service.py:418-421)
```python
if user_department_id:
    functional_query = functional_query.filter(
        Project.owner_department_id == user_department_id
    )
```

### 프론트엔드 코드 (ProjectHierarchySelect.tsx:38-40) - 수정 전
```typescript
const { data: projectHierarchy } = useProjectHierarchy(
    user?.sub_team_id ? String(user.sub_team_id) : undefined
);
```

**문제**: `SubTeam.id`와 `Department.id`는 다른 테이블의 ID이므로 절대 매칭되지 않음

## Changes Made

### 1. ProjectHierarchySelect.tsx
**File**: `frontend/src/components/ProjectHierarchySelect.tsx`

```typescript
// Before
const { user } = useAuth();
const { data: projectHierarchy, isLoading: isLoadingProjects } = useProjectHierarchy(
    user?.sub_team_id ? String(user.sub_team_id) : undefined
);

// After
const { user } = useAuth();
// Pass department_id (not sub_team_id) to filter functional projects by owner_department_id
const userDepartmentId = user?.sub_team?.department_id;
const { data: projectHierarchy, isLoading: isLoadingProjects } = useProjectHierarchy(
    userDepartmentId ? String(userDepartmentId) : undefined
);
```

**변경 사항**:
- `user?.sub_team_id` 대신 `user?.sub_team?.department_id` 사용
- SubTeam 객체 내부의 `department_id`를 추출하여 백엔드와 올바르게 매칭

### 2. 데이터 모델 참고

**User 타입** (frontend/src/types/index.ts):
```typescript
export interface User {
    id: string
    sub_team_id?: string      // SubTeam의 ID
    sub_team?: SubTeam        // nested SubTeam 객체
    // ...
}

export interface SubTeam {
    id: string
    department_id: string     // ← 이 값을 사용해야 함
    name: string
    // ...
}
```

## Edge Cases 고려

| 케이스 | `userDepartmentId` 값 | 결과 |
|--------|----------------------|------|
| 정상 사용자 | `"DEPT001"` | 해당 부서의 functional projects만 표시 |
| sub_team 미할당 | `undefined` | 모든 functional projects 표시 |
| sub_team 로딩 중 | `undefined` | 모든 functional projects 표시 (합리적 기본값) |

## Verification Results

### Build 검증
```bash
> pnpm build
✓ 3414 modules transformed.
✓ built in 2.99s
```

### 기능 검증
- WorkLog 모달에서 "기능 프로젝트 (내 팀)" 섹션 정상 표시
- OQC Digitalization 프로젝트 선택 가능
- 검색 필터링 정상 동작

### Gemini 코드 리뷰
- 수정 로직 정확성: 통과
- Edge case 처리: 적절함
- 코드 품질: 양호

## 관련 파일

| 파일 | 역할 |
|------|------|
| `frontend/src/components/ProjectHierarchySelect.tsx` | 프로젝트 선택 UI 컴포넌트 |
| `frontend/src/hooks/useProjectHierarchy.ts` | 프로젝트 계층 데이터 fetching |
| `backend/app/services/project_service.py` | `get_project_hierarchy()` 비즈니스 로직 |
| `frontend/src/types/index.ts` | User, SubTeam 타입 정의 |

## 교훈

1. **ID 타입 주의**: 서로 다른 엔티티의 ID를 혼동하지 않도록 주의
2. **데이터 모델 이해**: nested 객체 구조를 정확히 파악하고 올바른 필드 사용
3. **API 파라미터 확인**: 프론트엔드가 전달하는 값과 백엔드가 기대하는 값이 일치하는지 확인
