# Standard IO Framework 탭 삭제 및 io_category_code 필드 정리

## 개요
Projects 페이지에서 Standard IO Framework 탭을 삭제하고, 관련된 `io_category_code` 필드를 시스템 전체에서 제거했습니다. 또한 FUNCTIONAL 프로젝트의 부서 매핑을 위한 Owner Department 컬럼을 추가하고, 불필요한 Financial Columns 기능을 제거했습니다.

## 변경 사항

### 1. io_category_code 필드 제거

#### 백엔드
- **backend/app/models/project.py**: `io_category_code` 컬럼 삭제
- **backend/app/schemas/project.py**: `io_category_code` 필드 삭제
- **backend/app/services/project_classifier.py**: `ClassificationResult`에서 `io_category_code` 제거, `_determine_category` 3-tuple 반환으로 변경
- **backend/alembic/versions/007_remove_io_category_code.py**: 마이그레이션 생성

```python
# 마이그레이션 파일
revision = '007_remove_io_category_code'
down_revision = '006_add_recharge_io_to_projects'

def upgrade() -> None:
    op.drop_column('projects', 'io_category_code')
```

#### 프론트엔드
- **frontend/src/types/index.ts**: `ProjectBase`, `ProjectUpdate`에서 `io_category_code` 제거
- **frontend/src/components/forms/ProjectForm.tsx**: IO Category 필드 제거
- **frontend/src/pages/ProjectDetailPage.tsx**: IO Category PropertyRow 제거

### 2. Standard IO Framework 탭 삭제
- **frontend/src/components/projects/ProjectHierarchyEditor.tsx**:
  - Tabs 관련 import 제거
  - activeTab state 및 VSS/SUN 필터링 로직 제거
  - 탭 UI 완전 삭제

### 3. Owner Department 컬럼 추가 (FUNCTIONAL 프로젝트용)

#### 백엔드
- **backend/app/schemas/project.py**: `Department` 스키마 추가, `Project` response에 `owner_department` 포함

```python
class Department(BaseModel):
    id: str
    name: str
    code: str
    class Config:
        from_attributes = True

class Project(ProjectBase):
    owner_department: Optional[Department] = None
```

#### 프론트엔드
- **frontend/src/types/index.ts**: `Project` 인터페이스에 `owner_department` 추가
- **frontend/src/components/projects/EditableCell.tsx**: `DepartmentSelectCell` 컴포넌트 추가
- **frontend/src/components/projects/InlineEditableRow.tsx**:
  - Owner Department 컬럼 (편집/조회 모드) 추가
  - departments prop 추가
- **frontend/src/components/projects/ProjectInlineTable.tsx**:
  - `owner_department` 컬럼 설정 추가
  - departments prop 추가
- **frontend/src/hooks/useInlineProjectEdit.ts**: `owner_department_id` 필드 추가

### 4. Financial Columns 기능 제거
- **frontend/src/components/projects/ProjectHierarchyEditor.tsx**:
  - `showFinancialColumns` state 제거
  - "Show Financial Columns" 버튼 제거
- **frontend/src/components/projects/ProjectInlineTable.tsx**:
  - `funding_entity`, `recharge_status` 컬럼 설정 제거
  - `showFinancialColumns` prop 제거
  - 조건부 렌더링 블록 제거
- **frontend/src/components/projects/InlineEditableRow.tsx**:
  - `showFinancialColumns` prop 제거
  - Financial columns 렌더링 제거
  - `FUNDING_ENTITY_OPTIONS`, `RECHARGE_STATUS_OPTIONS` import 제거
  - `FUNDING_ENTITY_MAP` 제거
  - `ColumnWidths` 타입에서 financial 컬럼 제거

## 검증 결과

### 빌드 검증
```bash
> pnpm build
✓ 3414 modules transformed.
✓ built in 4.96s
```

### Docker 컨테이너 재빌드
```bash
> docker compose up -d --build frontend
 Container edwards-web  Recreated
 Container edwards-web  Started
```

## 향후 개선 사항
- Internal IO와 Recharge IO는 별도 관리 전략으로 발전 예정
- FUNCTIONAL 프로젝트의 부서 매핑 데이터 입력 필요
