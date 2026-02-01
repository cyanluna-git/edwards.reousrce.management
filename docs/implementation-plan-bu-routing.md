# 구현 계획: BU 기반 자동 라우팅 시스템

## 대원칙
"입력은 단순하게, 집계는 세밀하게"

---

## Phase 1: 백엔드 모델 변경

### 1.1 User 모델 수정
**파일**: `backend/app/models/user.py`

```python
# 추가할 컬럼
primary_business_unit_id = Column(
    String(50),
    ForeignKey("business_units.id"),
    nullable=True
)

# 추가할 relationship
primary_business_unit = relationship("BusinessUnit", foreign_keys=[primary_business_unit_id])
```

### 1.2 RechargeIO ↔ BusinessUnit M:N 관계
**파일**: `backend/app/models/recharge_io.py`

```python
# 중간 테이블 추가
recharge_io_business_units = Table(
    "recharge_io_business_units",
    Base.metadata,
    Column("recharge_io_id", String(36), ForeignKey("recharge_ios.id"), primary_key=True),
    Column("business_unit_id", String(50), ForeignKey("business_units.id"), primary_key=True),
)

# RechargeIO 클래스에 relationship 추가
business_units = relationship(
    "BusinessUnit",
    secondary=recharge_io_business_units,
    backref="recharge_ios"
)
```

### 1.3 InternalIO 모델 수정
**파일**: `backend/app/models/internal_io.py`

```python
# 추가할 컬럼
business_unit_id = Column(
    String(50),
    ForeignKey("business_units.id"),
    nullable=True
)

# 추가할 relationship
business_unit = relationship("BusinessUnit", backref="internal_ios")
```

### 1.4 Project 모델 수정
**파일**: `backend/app/models/project.py`

```python
# category 컬럼 변경: PRODUCT, FUNCTIONAL, SUPPORT
category = Column(String(20), default="PRODUCT")  # PRODUCT, FUNCTIONAL, SUPPORT
```

---

## Phase 2: Alembic 마이그레이션

**파일**: `backend/alembic/versions/008_add_bu_routing.py`

### 마이그레이션 내용:
1. `users` 테이블에 `primary_business_unit_id` 컬럼 추가
2. `recharge_io_business_units` 중간 테이블 생성
3. `internal_ios` 테이블에 `business_unit_id` 컬럼 추가
4. 기존 데이터 마이그레이션 (RechargeIO → BU 매핑)

---

## Phase 3: Pydantic 스키마 수정

### 3.1 User 스키마
**파일**: `backend/app/schemas/user.py`

```python
# UserBase에 추가
primary_business_unit_id: Optional[str] = None

# User response에 추가
primary_business_unit: Optional[BusinessUnit] = None
```

### 3.2 RechargeIO 스키마
**파일**: `backend/app/schemas/project.py`

```python
# RechargeIO response에 추가
business_units: List[BusinessUnit] = []
```

### 3.3 InternalIO 스키마
**파일**: `backend/app/schemas/project.py`

```python
# InternalIO response에 추가
business_unit_id: Optional[str] = None
business_unit: Optional[BusinessUnit] = None
```

### 3.4 Project 스키마
```python
# ProjectCategory enum 또는 Literal 추가
category: Literal["PRODUCT", "FUNCTIONAL", "SUPPORT"] = "PRODUCT"
```

---

## Phase 4: Seed Data - Support 프로젝트 생성

**파일**: `backend/scripts/seed_support_projects.py`

```python
SUPPORT_PROJECTS = [
    {
        "name": "Pre-Gate Support",
        "category": "SUPPORT",
        "status": "InProgress",  # 상시 진행
        "description": "NPI PRJ 사전 검토 업무",
    },
    {
        "name": "SUN Operations Support",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "ME/QC Project & Support, 제조/품질 업무 지원",
    },
    {
        "name": "SUN Product Improvement",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "ETO Project, Legacy HVM CIP, Global EC 양산 장비 CIP 대응",
    },
    {
        "name": "VSS Product Improvement",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "Legacy Service Update, 서비스/고객 추가 요구사항",
    },
    {
        "name": "VSS Sales/Service Support",
        "category": "SUPPORT",
        "status": "InProgress",
        "description": "Sales/Service 업무 지원, 설계자료/문서/현장 이슈 대응",
    },
]
```

---

## Phase 5: RechargeIO ↔ BU 매핑 데이터

| io_number | name | business_units |
|-----------|------|----------------|
| 407278 | [ABT/IS] SUN Operations Support | ABT, IS |
| 407279 | [ABT/IS] SUN Product Improvement | ABT, IS |
| 407328 | [ABT/IS] VSS Product Improvement | ABT, IS |
| 407331 | [ABT/IS] VSS Sales/Service Support | ABT, IS |
| 407327 | [ACM] SUN Operations Support | ACM |
| 407296 | [ACM] SUN Product Improvement | ACM |
| 407332 | [ACM] VSS Support (공용) | ACM |

---

## Phase 6: Frontend 수정

### 6.1 타입 정의
**파일**: `frontend/src/types/index.ts`

```typescript
// User 타입 수정
interface User {
  // ...existing
  primary_business_unit_id?: string;
  primary_business_unit?: BusinessUnit;
}

// Project category 타입
type ProjectCategory = 'PRODUCT' | 'FUNCTIONAL' | 'SUPPORT';

// RechargeIO 타입 수정
interface RechargeIO {
  // ...existing
  business_units: BusinessUnit[];
}
```

### 6.2 프로젝트 선택 컴포넌트 수정
**파일**: `frontend/src/components/worklogs/ProjectSelect.tsx` (또는 유사)

```
UI 구조:
┌─────────────────────────────────┐
│ 프로젝트 선택...                 │
├─────────────────────────────────┤
│ 📦 제품 프로젝트                 │  ← category = PRODUCT
│   > Abatement (Product Line)    │
│   > ACM (Product Line)          │
├─────────────────────────────────┤
│ 🔧 기능 프로젝트                 │  ← category = FUNCTIONAL
│   > CEP-2024-001                │
├─────────────────────────────────┤
│ 🏢 비프로젝트 업무               │  ← category = SUPPORT
│   > Pre-Gate Support            │
│   > SUN Operations Support      │
│   > SUN Product Improvement     │
│   > VSS Product Improvement     │
│   > VSS Sales/Service Support   │
├─────────────────────────────────┤
│ ⚪ 해당 없음 (팀 자체 업무)       │  ← project_id = null
└─────────────────────────────────┘
```

### 6.3 자동 라우팅 로직
```typescript
// Support 프로젝트 선택 시 자동 Recharge IO 매핑
function getAutoRechargeIO(
  supportProject: Project,
  userPrimaryBU: BusinessUnit,
  rechargeIOs: RechargeIO[]
): RechargeIO | null {
  // Support 프로젝트명으로 해당 유형의 RechargeIO 필터
  // 사용자의 primary_bu로 최종 IO 선택
  const matchingIOs = rechargeIOs.filter(io =>
    io.business_units.some(bu => bu.id === userPrimaryBU.id)
  );
  // ... 매칭 로직
}
```

---

## 구현 순서

| 단계 | 작업 | 파일 |
|------|------|------|
| 1 | User 모델 수정 | `models/user.py` |
| 2 | RechargeIO M:N 테이블 | `models/recharge_io.py` |
| 3 | InternalIO BU 컬럼 | `models/internal_io.py` |
| 4 | Alembic 마이그레이션 | `alembic/versions/008_*.py` |
| 5 | Pydantic 스키마 수정 | `schemas/user.py`, `schemas/project.py` |
| 6 | Support 프로젝트 Seed | `scripts/seed_support_projects.py` |
| 7 | RechargeIO BU 매핑 Seed | `scripts/seed_recharge_io_bu.py` |
| 8 | Frontend 타입 수정 | `types/index.ts` |
| 9 | 프로젝트 선택 UI 수정 | `components/worklogs/*.tsx` |
| 10 | 자동 라우팅 로직 | `hooks/useAutoRouting.ts` |

---

## 테스트 시나리오

1. **Product 프로젝트 선택**: 기존 동작 유지
2. **Functional 프로젝트 선택**: Recharge IO 별도 매핑
3. **Support 프로젝트 선택**: User.primary_bu 기반 자동 라우팅
4. **Override**: 수동으로 다른 BU의 IO 선택 가능
5. **해당 없음**: project_id = null, General로 집계
