# 역할별 권한 제어 구현

**날짜**: 2025-02-10
**작성자**: Claude (Sonnet 4.5)
**작업 타입**: Security Enhancement, Feature Implementation

---

## 📋 작업 개요

일반 사용자가 조직/프로젝트/리소스 데이터를 생성/수정/삭제할 수 있는 보안 문제를 해결하기 위해 역할별 권한 제어 시스템을 구현했습니다.

### 문제점
- 모든 인증된 사용자가 조직 구조(Department, SubTeam, JobPosition 등) 수정 가능
- 일반 USER가 프로젝트 생성/삭제 가능
- 일반 USER가 리소스 계획 수정 가능
- 역할(ADMIN, PM, FM, USER) 구분이 있지만 실제 권한 체크가 미흡

### 해결 방안
간단한 하드코딩 방식으로 역할별 권한 매트릭스를 구현:
- Frontend: `usePermissions` 훅으로 UI 레벨 권한 체크
- Backend: `require_role()` 데코레이터로 API 레벨 권한 체크

---

## 🎯 권한 매트릭스

| 기능 영역 | ADMIN | PM | FM | USER/VIEWER |
|----------|-------|----|----|-------------|
| **조직 관리** (Division, Department, SubTeam, JobPosition, ProjectRole, HiringPlan) | ✅ 모든 권한 | ❌ | ❌ | ❌ 읽기만 |
| **프로젝트 관리** (Project, ProductLine, Milestone) | ✅ 모든 권한 | ✅ 생성/수정/삭제 | ❌ | ❌ 읽기만 |
| **리소스 관리** (ResourcePlan) | ✅ 모든 권한 | ❌ | ✅ 생성/수정/삭제 | ❌ 읽기만 |
| **사용자 관리** | ✅ | ❌ | ❌ | ❌ |
| **워크로그** | ✅ | ✅ | ✅ | ✅ |

---

## 🔧 구현 내용

### 1. Frontend - usePermissions 훅 확장

**파일**: `frontend/src/hooks/usePermissions.ts`

```typescript
export function usePermissions() {
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';
  const isPM = user?.role === 'PM';
  const isFM = user?.role === 'FM';
  const isUser = user?.role === 'USER';

  // 권한 로직
  const canManageProjects = isAdmin || isPM;      // ADMIN + PM
  const canManageResources = isAdmin || isFM;     // ADMIN + FM (새로 추가)
  const canManageOrganization = isAdmin;          // ADMIN만
  const canManageUsers = isAdmin;                 // ADMIN만
  const canManageHiringPlans = isAdmin;           // ADMIN만
  const canViewReports = isAdmin || isPM || isFM;
  const canManageWorklogs = true;

  return {
    isAdmin, isPM, isFM, isUser,
    canManageProjects,
    canManageResources,    // 추가됨
    canManageOrganization,
    canManageUsers,
    canManageHiringPlans,
    canViewReports,
    canManageWorklogs,
  };
}
```

**변경사항**:
- `canManageProjects`: PM 권한 추가
- `canManageResources`: 새로 추가 (FM 권한)

---

### 2. Backend - API 권한 체크

#### 2.1 ResourcePlans API (FM 권한 추가)

**파일**: `backend/app/api/endpoints/resource_plans.py`

**변경사항**:
- `create_resource_plan`: `require_role("ADMIN", "FM")`
- `update_resource_plan`: `require_role("ADMIN", "FM")`
- `delete_resource_plan`: `require_role("ADMIN", "FM")`
- `assign_user_to_plan`: `require_role("ADMIN", "FM")`

**예시**:
```python
from app.core.security import require_role

@router.post("", response_model=ResourcePlan, status_code=status.HTTP_201_CREATED)
async def create_resource_plan(
    plan_in: ResourcePlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "FM")),  # 추가
):
    """Create a new resource plan"""
    service = ResourcePlanService(db)
    return service.create(plan_in, created_by=current_user.id)
```

#### 2.2 Projects API (PM 권한 추가)

**파일**: `backend/app/api/endpoints/projects.py`

**변경사항**:
- ProductLine CUD: `require_role("ADMIN", "PM")`
- Project CUD: `require_role("ADMIN", "PM")`
- Milestone CUD: `require_role("ADMIN", "PM")`

#### 2.3 Organization APIs (ADMIN만)

**파일들**:
- `backend/app/api/endpoints/departments.py`
- `backend/app/api/endpoints/job_positions.py`
- `backend/app/api/endpoints/project_roles.py`
- `backend/app/api/endpoints/hiring_plans.py`

**변경사항**: 모든 CUD 엔드포인트에 `require_role("ADMIN")` 추가

---

### 3. Frontend - 권한 기반 UI 제어

#### 3.1 PositionsTab (조직 관리)

**파일**: `frontend/src/components/organization/PositionsTab.tsx`

**변경사항**:
- `usePermissions` 훅 import
- `canManageOrganization` 사용
- Add/Edit/Delete 버튼 조건부 렌더링

```typescript
const { canManageOrganization } = usePermissions();

// Add 버튼
{canManageOrganization && (
  <Button onClick={openAddModal}>{t('common:buttons.add')}</Button>
)}

// Edit/Delete 버튼
{canManageOrganization && (
  <>
    <button onClick={() => openEditModal(position)}>Edit</button>
    <button onClick={() => handleDelete(position)}>Delete</button>
  </>
)}
```

#### 3.2 HiringPlansTab

**파일**: `frontend/src/components/organization/HiringPlansTab.tsx`

**변경사항**:
- `canManageHiringPlans` 기반 Add/Delete 버튼 제어

#### 3.3 ProjectDetailPage

**파일**: `frontend/src/pages/ProjectDetailPage.tsx`

**변경사항**:
- `canManageProjects` 기반 Edit/Delete/Add Milestone 버튼 제어
- Milestone 클릭 편집 기능도 권한 기반 제어

```typescript
const { canManageProjects } = usePermissions();

// Edit/Delete 버튼
{canManageProjects && (
  <div className="flex space-x-2">
    <Dialog>...</Dialog> {/* Edit */}
    <Dialog>...</Dialog> {/* Delete */}
  </div>
)}

// Add Milestone 버튼
{canManageProjects && (
  <Button onClick={openAddMilestoneModal}>Add Milestone</Button>
)}

// Milestone 클릭 편집
<div
  className={`${canManageProjects ? 'cursor-pointer hover:opacity-80' : ''}`}
  onClick={canManageProjects ? () => openEditMilestoneModal(ms) : undefined}
>
```

#### 3.4 ResourcePlansPage & ProjectResourceTable

**파일**:
- `frontend/src/pages/ResourcePlansPage.tsx`
- `frontend/src/components/resource-plans/ProjectResourceTable.tsx`

**변경사항**:
- `canManageResources` 기반 Add/Edit/Delete 버튼 제어
- `ProjectResourceTable`의 props를 optional로 변경
- 권한 없을 때 undefined 전달하여 버튼 숨김

```typescript
// ResourcePlansPage.tsx
const { canManageResources } = usePermissions();

<ProjectResourceTable
  projectId={project.id}
  months={months}
  onAddMember={canManageResources ? () => handleAddRow(project.id) : undefined}
  onEditRow={canManageResources ? (row) => handleEditRow(row, project.id) : undefined}
  onDeleteRow={canManageResources ? (row) => handleDeleteRow(row) : undefined}
/>

// ProjectResourceTable.tsx
interface ProjectResourceTableProps {
  projectId: string;
  months: { year: number; month: number; label: string }[];
  onAddMember?: () => void;  // optional로 변경
  onEditRow?: (row: ResourceRow) => void;
  onDeleteRow?: (row: ResourceRow) => void;
}

// 조건부 렌더링
{onAddMember && (
  <Button onClick={onAddMember}>Add Row</Button>
)}
```

---

## 📁 변경된 파일 목록

### Backend (6개)
1. `backend/app/api/endpoints/resource_plans.py` - FM 권한 추가
2. `backend/app/api/endpoints/projects.py` - PM 권한 추가
3. `backend/app/api/endpoints/departments.py` - ADMIN 전용
4. `backend/app/api/endpoints/job_positions.py` - ADMIN 전용
5. `backend/app/api/endpoints/project_roles.py` - ADMIN 전용
6. `backend/app/api/endpoints/hiring_plans.py` - ADMIN 전용

### Frontend (6개)
1. `frontend/src/hooks/usePermissions.ts` - canManageResources 추가
2. `frontend/src/components/organization/PositionsTab.tsx` - 권한 체크 추가
3. `frontend/src/components/organization/HiringPlansTab.tsx` - 권한 체크 추가
4. `frontend/src/pages/ProjectDetailPage.tsx` - 권한 체크 추가
5. `frontend/src/pages/ResourcePlansPage.tsx` - 권한 체크 추가
6. `frontend/src/components/resource-plans/ProjectResourceTable.tsx` - 조건부 렌더링

---

## 🧪 테스트 시나리오

### 1. ADMIN 테스트
- ✅ 모든 기능 접근 가능
- ✅ Organization 관리 가능
- ✅ Project 관리 가능
- ✅ Resource 관리 가능

### 2. PM 테스트
- ✅ Project/ProductLine/Milestone 생성/수정/삭제 가능
- ❌ Organization 관리 버튼 안 보임
- ❌ Resource Plans 편집 버튼 안 보임

### 3. FM 테스트
- ✅ ResourcePlan 생성/수정/삭제 가능
- ❌ Organization 관리 버튼 안 보임
- ❌ Project 편집/삭제 버튼 안 보임

### 4. USER 테스트
- ✅ 모든 데이터 조회 가능
- ❌ 모든 생성/수정/삭제 버튼 안 보임
- ❌ API 호출 시 403 Forbidden 응답

---

## 🔒 보안 향상 효과

### Before (이전)
```
모든 인증된 사용자 → 모든 CUD 작업 가능
└── 보안 취약점: 데이터 무결성 위험
```

### After (이후)
```
ADMIN → 모든 권한
├── PM → 프로젝트 관리만
├── FM → 리소스 관리만
└── USER → 읽기만 (CUD 불가)
```

### 방어 계층
1. **Frontend**: UI 레벨에서 버튼 숨김 (UX 개선)
2. **Backend**: API 레벨에서 권한 체크 (보안 강화)
3. **이중 방어**: Frontend 우회해도 Backend에서 차단

---

## 🚀 향후 계획

### 단기 (추가 구현 예정 없음)
현재 구현은 **하드코딩 방식**으로 충분:
- 역할 4개 (ADMIN, PM, FM, USER)
- 권한 매트릭스 고정
- 변경 빈도 낮음

### 장기 (요구사항 발생 시)
**Django 스타일 동적 권한 시스템**으로 확장 가능:

```sql
-- Permission 테이블
CREATE TABLE permissions (
  id VARCHAR PRIMARY KEY,
  resource VARCHAR,      -- 'project', 'resource_plan', 'department'
  action VARCHAR,        -- 'create', 'read', 'update', 'delete'
  description TEXT
);

-- RolePermission 테이블
CREATE TABLE role_permissions (
  role VARCHAR,          -- 'ADMIN', 'PM', 'FM', 'USER'
  permission_id VARCHAR,
  PRIMARY KEY (role, permission_id)
);
```

**장점**:
- Admin UI에서 권한 설정 변경 가능
- 코드 수정 없이 권한 조정
- 세밀한 권한 제어 (resource-action 조합)

**단점**:
- 복잡도 증가
- 현재 요구사항에 과도한 엔지니어링

**결론**: 비즈니스 요구사항 복잡해지면 그때 마이그레이션 고려

---

## 📝 구현 패턴 정리

### Backend 패턴
```python
# 1. require_role import
from app.core.security import require_role

# 2. 엔드포인트에 권한 체크 추가
@router.post("", response_model=Schema)
async def create_item(
    data: CreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN", "PM")),  # 여기
):
    # 비즈니스 로직
    pass
```

### Frontend 패턴
```typescript
// 1. usePermissions import
import { usePermissions } from '@/hooks/usePermissions';

// 2. 컴포넌트에서 권한 가져오기
const { canManageProjects } = usePermissions();

// 3. 조건부 렌더링
{canManageProjects && (
  <Button onClick={handleCreate}>Create</Button>
)}
```

---

## ✅ 체크리스트

- [x] usePermissions.ts 수정 완료
- [x] 백엔드 6개 파일 수정 완료
- [x] 프론트엔드 6개 파일 수정 완료
- [x] 로컬 테스트 완료 (ADMIN/PM/FM/USER)
- [x] 동작 확인 완료
- [ ] 프로덕션 배포
- [ ] 프로덕션 테스트

---

## 🔗 관련 이슈

- 보안 취약점: 일반 사용자가 조직/프로젝트/리소스 수정 가능
- 해결 방법: 역할별 권한 매트릭스 구현 (하드코딩 방식)
- 향후: 동적 권한 시스템은 필요 시 구현

---

## 📚 참고 자료

- FastAPI Depends: https://fastapi.tiangolo.com/tutorial/dependencies/
- React Conditional Rendering: https://react.dev/learn/conditional-rendering
- Security Best Practices: 이중 방어 계층 (Frontend + Backend)

---

**작업 완료**: 2025-02-10
**검증 완료**: 사용자 확인 완료 ("동작하는것 같다")
**다음 단계**: 커밋 후 프로덕션 배포 대기
