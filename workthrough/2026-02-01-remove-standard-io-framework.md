# Standard IO Framework 탭 삭제 및 io_category_code 필드 정리

## 개요
Internal IO와 Recharge IO를 별도 전략으로 관리하기로 결정함에 따라, Standard IO Framework 탭(VSS/SUN Matrix)과 관련 `io_category_code` 필드를 전체 시스템에서 제거했습니다.

## 배경
- 기존 Standard IO Framework 탭은 VSS/SUN 사업부별 IO 카테고리 관리를 위해 설계됨
- Internal IO와 Recharge IO가 별도 테이블로 분리되면서 이 접근 방식이 더 이상 필요하지 않음
- io_category_code 필드(NPI, FIELD_FAILURE, SUSTAINING, CIP, OPS_SUPPORT, OTHER)는 미사용 상태

## 변경 사항

### 1. Frontend - Standard IO Framework 탭 삭제

**파일:** `frontend/src/components/projects/ProjectHierarchyEditor.tsx`

- TabsTrigger에서 "sustaining" 탭 제거
- TabsContent의 VSS/SUN Matrix 전체 섹션 삭제 (약 140줄)
- sustainingProjects, vssProjects, sunProjects useMemo 필터링 로직 삭제

```typescript
// 삭제 전: 5개 탭
<TabsList>
    <TabsTrigger value="product">Active Projects</TabsTrigger>
    <TabsTrigger value="sustaining">Standard IO Framework</TabsTrigger>
    <TabsTrigger value="functional">Functional</TabsTrigger>
    <TabsTrigger value="all">All / Legacy</TabsTrigger>
    <TabsTrigger value="io-management">IO Management</TabsTrigger>
</TabsList>

// 삭제 후: 4개 탭
<TabsList>
    <TabsTrigger value="product">Active Projects</TabsTrigger>
    <TabsTrigger value="functional">Functional</TabsTrigger>
    <TabsTrigger value="all">All / Legacy</TabsTrigger>
    <TabsTrigger value="io-management">IO Management</TabsTrigger>
</TabsList>
```

### 2. Frontend - ProjectForm에서 IO Category 필드 삭제

**파일:** `frontend/src/components/forms/ProjectForm.tsx`

- `IO_CATEGORY_OPTIONS` 상수 삭제
- Financial Classification 섹션에서 IO Category 선택 필드 삭제
- grid-cols-4 → grid-cols-3 변경 (Funding Entity, Recharge, Capitalizable 3개만 유지)
- getDefaultValues에서 io_category_code 초기화 로직 삭제

```typescript
// 삭제된 상수
export const IO_CATEGORY_OPTIONS = [
    { value: 'NPI', label: 'NPI (New Product Introduction)' },
    { value: 'FIELD_FAILURE', label: 'Field Failure Escalation' },
    { value: 'OPS_SUPPORT', label: 'Operations Support' },
    { value: 'SUSTAINING', label: 'Sustaining Engineering' },
    { value: 'CIP', label: 'CIP (Continuous Improvement)' },
    { value: 'OTHER', label: 'Other (Miscellaneous)' },
];
```

### 3. Frontend - ProjectDetailPage에서 IO Category 표시 제거

**파일:** `frontend/src/pages/ProjectDetailPage.tsx`

- IO Category PropertyRow 전체 삭제
- 미사용 `Folder` 아이콘 import 삭제

### 4. Frontend - 타입 정의 업데이트

**파일:** `frontend/src/types/index.ts`

- `ProjectBase`와 `ProjectUpdate` 인터페이스에서 `io_category_code` 필드 삭제

```typescript
// 변경 전
export interface ProjectBase {
    // ...
    io_category_code?: string  // Maps to IO Framework Programme
    // ...
}

// 변경 후 (필드 제거)
export interface ProjectBase {
    // ...
    // io_category_code 삭제됨
    // ...
}
```

### 5. Backend - Project 모델 업데이트

**파일:** `backend/app/models/project.py`

- `io_category_code` 컬럼 정의 삭제

```python
# 삭제된 컬럼
io_category_code = Column(String(100), nullable=True)  # Maps to IO Framework Programme
```

### 6. Backend - Project Classifier 서비스 업데이트

**파일:** `backend/app/services/project_classifier.py`

- `ClassificationResult` dataclass에서 `io_category_code` 필드 삭제
- `CATEGORY_RULES` 딕셔너리에서 `io_category_code` 항목 삭제
- `_determine_category` 메서드 반환값에서 io_category_code 제거 (4-tuple → 3-tuple)
- `classify` 메서드에서 관련 로직 업데이트

```python
# 변경 전
@dataclass
class ClassificationResult:
    funding_entity_id: str
    recharge_status: str
    io_category_code: str  # 삭제됨
    is_capitalizable: bool
    # ...

# 변경 후
@dataclass
class ClassificationResult:
    funding_entity_id: str
    recharge_status: str
    is_capitalizable: bool
    # ...
```

### 7. 데이터베이스 마이그레이션

**파일:** `backend/alembic/versions/007_remove_io_category_code.py`

```python
"""Remove io_category_code column from projects table"""

def upgrade() -> None:
    op.drop_column('projects', 'io_category_code')

def downgrade() -> None:
    op.add_column(
        'projects',
        sa.Column('io_category_code', sa.String(100), nullable=True)
    )
```

## 유지된 항목

다음 항목들은 계속 사용됩니다:
- **IO Management 탭**: Internal IO와 Recharge IO CRUD 관리
- **funding_entity_id**: VSS/SUN Division 등 펀딩 엔터티
- **recharge_status**: BILLABLE/NON_BILLABLE/INTERNAL
- **is_capitalizable**: CAPEX/OPEX 구분
- **gl_account_code**: General Ledger 계정 코드

## 검증 결과

### Frontend 빌드
```bash
> pnpm build
✓ built in 3.08s
```

### 데이터베이스 마이그레이션
```bash
> docker compose exec backend alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade 006_add_recharge_io_to_projects -> 007_remove_io_category_code
```

### 컬럼 삭제 확인
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'io_category_code';
-- (0 rows)
```

### API 응답 확인
```bash
> curl "http://localhost:8004/api/projects?limit=1"
# io_category_code 필드가 응답에서 제거됨
```

## 영향받는 문서 파일 (참고용)

다음 문서 파일들에 io_category_code 참조가 있지만, 기록 목적으로 유지됩니다:
- `docs/RECHARGE-IMPLEMENTATION-GUIDE.md`
- `docs/BACKFILL_IMPLEMENTATION_SUMMARY.md`
- `docs/MANUAL_CLASSIFICATION_GUIDE.md`
- `backend/scripts/seed_sustaining_matrix_v2.py`

## 다음 단계

- 필요시 기존 문서 파일들의 io_category_code 참조 정리
- Internal IO / Recharge IO 별도 관리 UI 개선
