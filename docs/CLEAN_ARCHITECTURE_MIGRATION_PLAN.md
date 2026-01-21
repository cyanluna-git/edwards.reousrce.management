# Clean Architecture Migration Plan
**Edwards Resource Management System - AI-First Refactoring Strategy**

> **핵심 전제**: AI 코딩(Claude Code, Cursor 등) 시대의 아키텍처 전환
> **목표**: AI 컨텍스트 이해도 극대화를 통한 생산성 2-3배 향상

---

## 📋 Executive Summary

### 현재 상태
- **아키텍처**: 전통적 레이어드 아키텍처 (3-tier)
- **코드베이스**: ~8,000 LOC (백엔드)
- **주요 문제**:
  - 큰 파일(538 LOC Service) → AI 컨텍스트 비효율
  - 책임 분산 불명확 → AI 수정 위치 혼란
  - 높은 결합도 → 변경 영향 추적 어려움

### 전환 목표
- **아키텍처**: Clean Architecture (헥사고날 패턴)
- **AI 최적화**: 50-100 LOC 파일 단위, 단일 책임 명확화
- **예상 효과**:
  - AI API 토큰 사용량: **60% 절감**
  - 기능 수정 속도: **4배 향상**
  - 버그 수정 속도: **3배 향상**

### 전환 비용
- **기간**: 2주 (AI 주도 전환)
- **인력**: 1명 (AI 생성 코드 리뷰 집중)
- **ROI**: 1개월 내 달성

---

## 🏗️ Target Architecture

### Before: Layered Architecture

```
┌─────────────────────────────────┐
│   API Endpoints (FastAPI)       │  ← 15개 파일, 평균 200 LOC
│   ↓ (직접 호출)                  │
│   Services (비즈니스 로직)        │  ← 11개 파일, 평균 250 LOC
│   ↓ (직접 의존)                  │
│   Models (SQLAlchemy ORM)        │  ← 8개 파일, 평균 175 LOC
│   ↓                              │
│   Database (PostgreSQL)          │
└─────────────────────────────────┘

문제점:
❌ Service 파일이 너무 큼 (project_service.py: 538 LOC)
❌ 비즈니스 로직이 인프라에 결합
❌ AI가 전체 맥락 파악 어려움
```

### After: Clean Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        Interfaces (API)                        │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  API Endpoints (FastAPI)                               │   │
│  │  ├─ POST /projects → CreateProjectController          │   │
│  │  ├─ PUT /projects/{id} → UpdateProjectController      │   │
│  │  └─ GET /projects/{id} → GetProjectController         │   │
│  └────────────────────────────────────────────────────────┘   │
│                              ↓                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Application Layer (Use Cases)                         │   │
│  │  ├─ CreateProjectUseCase (50 LOC)                     │   │
│  │  ├─ UpdateProjectUseCase (45 LOC)                     │   │
│  │  ├─ ClassifyProjectFundingUseCase (60 LOC)           │   │
│  │  └─ ... (30-40개 독립 유스케이스)                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                              ↓                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Domain Layer (순수 비즈니스 로직)                       │   │
│  │  ├─ Entities/                                          │   │
│  │  │  ├─ Project (도메인 객체, 40 LOC)                   │   │
│  │  │  ├─ WorkLog (30 LOC)                               │   │
│  │  │  └─ ResourcePlan (35 LOC)                          │   │
│  │  ├─ Value Objects/                                     │   │
│  │  │  ├─ FundingEntity (20 LOC)                         │   │
│  │  │  ├─ RechargeStatus (15 LOC)                        │   │
│  │  │  └─ IOCategory (25 LOC)                            │   │
│  │  └─ Domain Services/                                   │   │
│  │     └─ ProjectClassifier (70 LOC)                     │   │
│  └────────────────────────────────────────────────────────┘   │
│                              ↑                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Repository Interfaces (추상화)                         │   │
│  │  ├─ IProjectRepository                                 │   │
│  │  ├─ IWorkLogRepository                                 │   │
│  │  └─ IResourcePlanRepository                            │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
                              ↑
┌───────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                        │
│  ├─ Persistence/                                               │
│  │  ├─ SqlAlchemyProjectRepository (ORM 구현)                 │
│  │  ├─ SqlAlchemyWorkLogRepository                            │
│  │  └─ ... (Repository 구현체)                                │
│  ├─ External Services/                                         │
│  │  ├─ EmailNotifier                                          │
│  │  └─ SlackNotifier                                          │
│  └─ ORM Models/ (기존 SQLAlchemy 모델 유지)                    │
└───────────────────────────────────────────────────────────────┘

장점:
✅ 파일당 50-70 LOC → AI 컨텍스트 최적
✅ 단일 책임 → AI 수정 위치 명확
✅ 의존성 역전 → 테스트 용이
✅ 인터페이스 분리 → 변경 영향 최소화
```

---

## 📊 AI 컨텍스트 최적화 효과

### Token Efficiency Analysis

```
┌─────────────────────────────────────────────────────────────┐
│  Task: "재무 분류 로직 수정"                                  │
├─────────────────────────────────────────────────────────────┤
│  [현재] Layered Architecture                                 │
│  ├─ AI가 읽어야 할 파일:                                      │
│  │  ├─ project_service.py (538 LOC) → ~2,500 tokens        │
│  │  ├─ project.py (180 LOC) → ~800 tokens                  │
│  │  ├─ project_classifier.py (200 LOC) → ~900 tokens       │
│  │  └─ Total: ~4,200 tokens                                │
│  ├─ 문제:                                                     │
│  │  └─ 분류 로직이 3곳에 흩어져 있음 → AI 혼란               │
│  └─ API 비용: $0.15 per request                             │
├─────────────────────────────────────────────────────────────┤
│  [전환 후] Clean Architecture                                │
│  ├─ AI가 읽어야 할 파일:                                      │
│  │  ├─ classify_project_funding.py (60 LOC) → ~300 tokens  │
│  │  ├─ funding_entity.py (20 LOC) → ~100 tokens            │
│  │  └─ Total: ~400 tokens                                  │
│  ├─ 장점:                                                     │
│  │  └─ 파일명만 봐도 위치 명확 → AI 정확도 95%              │
│  └─ API 비용: $0.015 per request                            │
└─────────────────────────────────────────────────────────────┘

💰 Token 절감: 90% (4,200 → 400)
⚡ 수정 속도: 4배 향상
```

### AI 작업 시나리오 비교

#### Scenario 1: 신규 기능 추가

```
Task: "프로젝트에 GL Account 검증 로직 추가"

[레이어드]
1. AI: project_service.py 분석 (538 LOC)
   → 20분 소요, 토큰 2,500
2. AI: 검증 로직 어디 추가? 혼란
   → create/update 메서드 모두 수정 필요
3. 테스트: 어디 추가? project_service_test.py 전체 분석
   → 추가 10분, 토큰 1,500
Total: 30분, 4,000 tokens, 정확도 70%

[클린 아키텍처]
1. AI: domain/value_objects/gl_account.py 생성
   → 5분, 토큰 200
2. AI: use_cases/create_project.py에 검증 추가
   → 3분, 토큰 300
3. 테스트: test_gl_account.py 자동 생성
   → 2분, 토큰 150
Total: 10분, 650 tokens, 정확도 95%

🚀 속도: 3배 향상
💰 비용: 84% 절감
✅ 품질: 정확도 25% 상승
```

#### Scenario 2: 버그 수정

```
Task: "VSS 프로젝트가 잘못 분류되는 버그 수정"

[레이어드]
1. AI: 분류 로직 위치 찾기
   → project_classifier.py? project_service.py?
   → backfill_script.py도 확인 필요
   → 3개 파일 분석, 15분, 3,500 tokens
2. AI: 수정 후 영향 범위 불명확
   → 전체 테스트 돌려봐야 안심
Total: 30분, 높은 불안감

[클린 아키텍처]
1. AI: use_cases/classify_project_funding.py 직접 접근
   → 파일명으로 즉시 찾음, 5분, 300 tokens
2. AI: 단일 책임 → 영향 범위 명확
   → 관련 테스트만 실행하면 됨
Total: 10분, 높은 확신

🚀 속도: 3배 향상
🎯 정확도: 버그 재발 위험 1/5
```

---

## 🗺️ Migration Roadmap

### Phase 0: 준비 (1일)

**목표**: AI 전환 환경 구축

```bash
# 1. AI 코딩 도구 셋업
├─ Claude Code CLI 설치 ✓ (이미 사용중)
├─ Cursor IDE 설치 (선택)
└─ GitHub Copilot 활성화 (선택)

# 2. 프로젝트 구조 생성
backend/
├─ domain/               # 신규 생성
│  ├─ entities/
│  ├─ value_objects/
│  └─ services/
├─ application/          # 신규 생성
│  ├─ use_cases/
│  └─ interfaces/
└─ infrastructure/       # 기존 app/ 리네임
   ├─ persistence/
   ├─ api/
   └─ external/

# 3. AI 프롬프트 템플릿 준비
docs/ai_prompts/
├─ entity_extraction.txt
├─ usecase_creation.txt
└─ repository_pattern.txt
```

---

### Phase 1: Domain Layer 추출 (3일)

**목표**: 핵심 도메인 엔티티와 Value Objects 생성

#### Day 1: Project 도메인 모델

**AI Prompt Template:**

```markdown
# Task: Extract Domain Entity from ORM Model

## Context
현재 SQLAlchemy ORM 모델을 순수 비즈니스 도메인 객체로 분리하려고 합니다.

## Current Code
[backend/app/models/project.py 전체 복사]

## Requirements
1. 순수 Python 도메인 엔티티 생성
   - SQLAlchemy 의존성 제거
   - dataclass 또는 Pydantic BaseModel 사용
2. Value Objects 추출
   - FundingEntity (ENTITY_VSS, ENTITY_SUN, etc.)
   - RechargeStatus (BILLABLE, NON_BILLABLE, INTERNAL)
   - IOCategory (NPI, FIELD_FAILURE, etc.)
   - ProjectStatus (Prospective, InProgress, etc.)
3. 비즈니스 로직 메서드 추가
   - classify_funding() → FundingEntity
   - is_billable() → bool
   - can_be_closed() → bool
4. 불변성 고려
   - id, code는 불변
   - 상태 변경은 메서드 통해서만

## Target Structure
domain/
├─ entities/
│  └─ project.py
└─ value_objects/
   ├─ funding_entity.py
   ├─ recharge_status.py
   ├─ io_category.py
   └─ project_status.py

## Expected Output
각 파일의 완전한 코드와 간단한 사용 예시
```

**예상 출력:**

```python
# domain/entities/project.py
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from domain.value_objects import FundingEntity, RechargeStatus, IOCategory, ProjectStatus

@dataclass
class Project:
    """순수 도메인 프로젝트 엔티티 - 비즈니스 규칙만 포함"""

    # 식별자 (불변)
    id: str
    code: str
    name: str

    # 분류
    program_id: str
    project_type_id: str
    category: str  # PRODUCT | FUNCTIONAL

    # 재무 정보
    funding_entity: Optional[FundingEntity] = None
    recharge_status: Optional[RechargeStatus] = None
    io_category: Optional[IOCategory] = None
    is_capitalizable: bool = False

    # 상태
    status: ProjectStatus = field(default_factory=lambda: ProjectStatus.PROSPECTIVE)

    # 기타
    product_line_id: Optional[str] = None
    pm_id: Optional[str] = None
    customer: Optional[str] = None
    description: Optional[str] = None

    def classify_funding(self) -> FundingEntity:
        """프로젝트 코드/타입 기반 Funding Entity 자동 분류"""
        if self.code.startswith('VSS'):
            return FundingEntity.ENTITY_VSS
        elif self.code.startswith('SUN'):
            return FundingEntity.ENTITY_SUN
        elif self.project_type_id == 'NPI':
            return FundingEntity.ENTITY_LOCAL_KR
        else:
            return FundingEntity.ENTITY_LOCAL_KR  # 기본값

    def is_billable(self) -> bool:
        """청구 가능 여부 판단"""
        return self.recharge_status == RechargeStatus.BILLABLE

    def can_be_closed(self) -> bool:
        """프로젝트 종료 가능 여부"""
        return self.status in [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED]

    def requires_manual_classification(self) -> bool:
        """수동 분류 필요 여부 (LOW confidence)"""
        return (
            self.funding_entity is None or
            self.recharge_status is None or
            self.io_category is None
        )
```

```python
# domain/value_objects/funding_entity.py
from enum import Enum

class FundingEntity(str, Enum):
    """비용 책임 엔티티 (Division)"""

    ENTITY_VSS = "ENTITY_VSS"           # VSS Division (Integrated Systems)
    ENTITY_SUN = "ENTITY_SUN"           # SUN Division (Abatement)
    ENTITY_LOCAL_KR = "ENTITY_LOCAL_KR" # Local Korea (EUV Gen3/4)
    ENTITY_SHARED = "ENTITY_SHARED"     # Shared Services

    @property
    def display_name(self) -> str:
        """사용자 친화적 이름"""
        return {
            self.ENTITY_VSS: "VSS Division",
            self.ENTITY_SUN: "SUN Division",
            self.ENTITY_LOCAL_KR: "Local Korea",
            self.ENTITY_SHARED: "Shared Services",
        }[self]

    @property
    def is_billable_by_default(self) -> bool:
        """기본 청구 가능 여부"""
        return self in [self.ENTITY_VSS, self.ENTITY_SUN]
```

**작업:**
- [ ] AI로 Project 도메인 엔티티 생성
- [ ] AI로 Value Objects 4개 생성
- [ ] 유닛 테스트 AI 생성
- [ ] 코드 리뷰 (30분)

#### Day 2-3: 나머지 도메인 엔티티

동일한 프롬프트 템플릿으로:
- [ ] WorkLog 도메인 (40 LOC)
- [ ] ResourcePlan 도메인 (35 LOC)
- [ ] User 도메인 (30 LOC)
- [ ] Organization 도메인 (25 LOC)

---

### Phase 2: Use Case Layer 구축 (5일)

**목표**: Service를 30-40개 독립 Use Case로 분리

#### Day 4: Project Use Cases

**AI Prompt Template:**

```markdown
# Task: Extract Use Cases from Service

## Context
현재 project_service.py (538 LOC)를 단일 책임 Use Case들로 분리합니다.

## Current Code
[backend/app/services/project_service.py 전체 복사]

## Requirements
1. 각 Service 메서드 → 독립된 Use Case 클래스
2. 파일당 40-70 LOC 유지
3. Repository 인터페이스에 의존 (구현체 아님)
4. 도메인 엔티티 사용
5. 명확한 Request/Response DTO

## Target Structure
application/
├─ use_cases/
│  ├─ create_project.py          (50 LOC)
│  ├─ update_project.py          (45 LOC)
│  ├─ delete_project.py          (30 LOC)
│  ├─ get_project.py             (25 LOC)
│  ├─ list_projects.py           (40 LOC)
│  ├─ classify_project_funding.py (60 LOC)
│  └─ generate_project_report.py  (55 LOC)
└─ interfaces/
   ├─ repositories/
   │  └─ project_repository.py   (인터페이스만)
   └─ dtos/
      ├─ project_request.py
      └─ project_response.py

## Expected Output
각 Use Case의 완전한 코드
```

**예상 출력:**

```python
# application/use_cases/create_project.py
from dataclasses import dataclass
from typing import Optional
from application.interfaces.repositories import IProjectRepository
from domain.entities import Project
from domain.value_objects import FundingEntity, RechargeStatus

@dataclass
class CreateProjectRequest:
    """프로젝트 생성 요청 DTO"""
    code: str
    name: str
    program_id: str
    project_type_id: str
    category: str
    product_line_id: Optional[str] = None
    pm_id: Optional[str] = None
    customer: Optional[str] = None

class CreateProjectUseCase:
    """
    프로젝트 생성 유스케이스

    책임:
    1. 프로젝트 생성 가능 여부 검증
    2. 도메인 엔티티 생성
    3. 자동 재무 분류 (코드 기반)
    4. Repository를 통한 영속화
    """

    def __init__(self, project_repo: IProjectRepository):
        self.project_repo = project_repo

    def execute(self, request: CreateProjectRequest) -> Project:
        # 1. 중복 코드 검증
        if self.project_repo.exists_by_code(request.code):
            raise ValueError(f"Project code '{request.code}' already exists")

        # 2. 도메인 엔티티 생성
        project = Project(
            id=self._generate_id(),
            code=request.code,
            name=request.name,
            program_id=request.program_id,
            project_type_id=request.project_type_id,
            category=request.category,
            product_line_id=request.product_line_id,
            pm_id=request.pm_id,
            customer=request.customer,
        )

        # 3. 자동 재무 분류
        project.funding_entity = project.classify_funding()
        project.recharge_status = (
            RechargeStatus.BILLABLE if project.funding_entity.is_billable_by_default
            else RechargeStatus.NON_BILLABLE
        )

        # 4. 영속화
        saved_project = self.project_repo.save(project)

        return saved_project

    def _generate_id(self) -> str:
        import uuid
        return str(uuid.uuid4())
```

**작업:**
- [ ] Project Use Cases 7개 AI 생성
- [ ] WorkLog Use Cases 5개 AI 생성
- [ ] ResourcePlan Use Cases 4개 AI 생성
- [ ] 각 Use Case 테스트 AI 생성
- [ ] 코드 리뷰 (2시간)

---

### Phase 3: Repository Pattern 구현 (3일)

**목표**: 인프라 레이어 분리 및 Repository 구현

#### Day 7-8: Repository 인터페이스 및 구현

**AI Prompt:**

```markdown
# Task: Create Repository Pattern

## Context
도메인 엔티티와 SQLAlchemy ORM을 분리하기 위한 Repository 패턴 구현

## Requirements
1. 인터페이스 정의 (추상화)
2. SQLAlchemy 구현체
3. 도메인 엔티티 ↔ ORM 모델 매퍼

## Current ORM Model
[backend/app/models/project.py]

## Domain Entity
[backend/domain/entities/project.py]

## Target Structure
application/interfaces/repositories/
└─ project_repository.py (인터페이스)

infrastructure/persistence/
├─ orm_models/
│  └─ project_orm.py (기존 SQLAlchemy 모델)
├─ repositories/
│  └─ sqlalchemy_project_repository.py (구현체)
└─ mappers/
   └─ project_mapper.py (도메인 ↔ ORM 변환)
```

**예상 출력:**

```python
# application/interfaces/repositories/project_repository.py
from abc import ABC, abstractmethod
from typing import List, Optional
from domain.entities import Project

class IProjectRepository(ABC):
    """프로젝트 Repository 인터페이스"""

    @abstractmethod
    def save(self, project: Project) -> Project:
        """프로젝트 저장 (생성 or 업데이트)"""
        pass

    @abstractmethod
    def find_by_id(self, project_id: str) -> Optional[Project]:
        """ID로 프로젝트 조회"""
        pass

    @abstractmethod
    def find_by_code(self, code: str) -> Optional[Project]:
        """코드로 프로젝트 조회"""
        pass

    @abstractmethod
    def exists_by_code(self, code: str) -> bool:
        """코드 중복 체크"""
        pass

    @abstractmethod
    def list_all(self, skip: int = 0, limit: int = 100) -> List[Project]:
        """전체 프로젝트 목록"""
        pass

    @abstractmethod
    def delete(self, project_id: str) -> None:
        """프로젝트 삭제"""
        pass
```

```python
# infrastructure/persistence/repositories/sqlalchemy_project_repository.py
from typing import List, Optional
from sqlalchemy.orm import Session
from application.interfaces.repositories import IProjectRepository
from domain.entities import Project
from infrastructure.persistence.orm_models import ProjectORM
from infrastructure.persistence.mappers import ProjectMapper

class SqlAlchemyProjectRepository(IProjectRepository):
    """SQLAlchemy 기반 프로젝트 Repository 구현"""

    def __init__(self, session: Session):
        self.session = session
        self.mapper = ProjectMapper()

    def save(self, project: Project) -> Project:
        # 도메인 → ORM 변환
        orm_model = self.mapper.to_orm(project)

        # 기존 레코드 확인
        existing = self.session.query(ProjectORM).get(project.id)
        if existing:
            # 업데이트
            for key, value in orm_model.__dict__.items():
                if not key.startswith('_'):
                    setattr(existing, key, value)
            orm_model = existing
        else:
            # 신규 생성
            self.session.add(orm_model)

        self.session.commit()
        self.session.refresh(orm_model)

        # ORM → 도메인 변환
        return self.mapper.to_domain(orm_model)

    def find_by_id(self, project_id: str) -> Optional[Project]:
        orm_model = self.session.query(ProjectORM).get(project_id)
        return self.mapper.to_domain(orm_model) if orm_model else None

    # ... 나머지 메서드 구현
```

```python
# infrastructure/persistence/mappers/project_mapper.py
from domain.entities import Project
from domain.value_objects import FundingEntity, RechargeStatus, IOCategory, ProjectStatus
from infrastructure.persistence.orm_models import ProjectORM

class ProjectMapper:
    """도메인 엔티티 ↔ ORM 모델 변환"""

    def to_domain(self, orm: ProjectORM) -> Project:
        """ORM → 도메인 엔티티"""
        return Project(
            id=orm.id,
            code=orm.code,
            name=orm.name,
            program_id=orm.program_id,
            project_type_id=orm.project_type_id,
            category=orm.category,
            funding_entity=FundingEntity(orm.funding_entity_id) if orm.funding_entity_id else None,
            recharge_status=RechargeStatus(orm.recharge_status) if orm.recharge_status else None,
            io_category=IOCategory(orm.io_category_code) if orm.io_category_code else None,
            is_capitalizable=orm.is_capitalizable or False,
            status=ProjectStatus(orm.status) if orm.status else ProjectStatus.PROSPECTIVE,
            product_line_id=orm.product_line_id,
            pm_id=orm.pm_id,
            customer=orm.customer,
            description=orm.description,
        )

    def to_orm(self, domain: Project) -> ProjectORM:
        """도메인 엔티티 → ORM"""
        return ProjectORM(
            id=domain.id,
            code=domain.code,
            name=domain.name,
            program_id=domain.program_id,
            project_type_id=domain.project_type_id,
            category=domain.category,
            funding_entity_id=domain.funding_entity.value if domain.funding_entity else None,
            recharge_status=domain.recharge_status.value if domain.recharge_status else None,
            io_category_code=domain.io_category.value if domain.io_category else None,
            is_capitalizable=domain.is_capitalizable,
            status=domain.status.value if domain.status else None,
            product_line_id=domain.product_line_id,
            pm_id=domain.pm_id,
            customer=domain.customer,
            description=domain.description,
        )
```

---

### Phase 4: API Adapter 레이어 (2일)

**목표**: FastAPI 엔드포인트를 Use Case 어댑터로 변환

```python
# infrastructure/api/controllers/project_controller.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from application.use_cases import CreateProjectUseCase, GetProjectUseCase
from application.dtos import CreateProjectRequest, ProjectResponse
from infrastructure.persistence.repositories import SqlAlchemyProjectRepository
from infrastructure.api.dependencies import get_db

router = APIRouter()

def get_project_repository(db: Session = Depends(get_db)):
    return SqlAlchemyProjectRepository(db)

@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: CreateProjectRequest,
    repo = Depends(get_project_repository)
):
    """프로젝트 생성 API"""
    use_case = CreateProjectUseCase(repo)
    try:
        project = use_case.execute(request)
        return ProjectResponse.from_domain(project)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    repo = Depends(get_project_repository)
):
    """프로젝트 조회 API"""
    use_case = GetProjectUseCase(repo)
    project = use_case.execute(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.from_domain(project)
```

---

### Phase 5: 통합 및 테스트 (1일)

**목표**: 전환 완료 및 검증

#### 체크리스트

- [ ] 모든 API 엔드포인트 정상 동작 확인
- [ ] 기존 프론트엔드 연동 테스트
- [ ] 유닛 테스트 커버리지 > 80%
- [ ] 통합 테스트 통과
- [ ] 성능 테스트 (응답 시간 변화 없음)
- [ ] 문서 업데이트

---

## 📁 Final Directory Structure

```
backend/
├─ domain/                          # 순수 비즈니스 로직
│  ├─ entities/                     # 도메인 엔티티
│  │  ├─ project.py                (40 LOC) ⭐
│  │  ├─ worklog.py                (30 LOC)
│  │  ├─ resource_plan.py          (35 LOC)
│  │  ├─ user.py                   (30 LOC)
│  │  └─ organization.py           (25 LOC)
│  ├─ value_objects/                # Value Objects
│  │  ├─ funding_entity.py         (20 LOC) ⭐
│  │  ├─ recharge_status.py        (15 LOC) ⭐
│  │  ├─ io_category.py            (25 LOC) ⭐
│  │  ├─ project_status.py         (20 LOC)
│  │  └─ project_scale.py          (15 LOC)
│  └─ services/                     # 도메인 서비스
│     └─ project_classifier.py     (70 LOC) ⭐
│
├─ application/                     # 애플리케이션 레이어
│  ├─ use_cases/                    # 유스케이스 (30-40개)
│  │  ├─ project/
│  │  │  ├─ create_project.py      (50 LOC) ⭐
│  │  │  ├─ update_project.py      (45 LOC) ⭐
│  │  │  ├─ delete_project.py      (30 LOC)
│  │  │  ├─ get_project.py         (25 LOC)
│  │  │  ├─ list_projects.py       (40 LOC)
│  │  │  └─ classify_project_funding.py (60 LOC) ⭐
│  │  ├─ worklog/
│  │  │  ├─ create_worklog.py      (40 LOC)
│  │  │  ├─ update_worklog.py      (35 LOC)
│  │  │  └─ get_worklog_stats.py   (50 LOC)
│  │  └─ resource_plan/
│  │     ├─ create_resource_plan.py (45 LOC)
│  │     └─ allocate_resources.py   (55 LOC)
│  ├─ interfaces/                   # 추상화 인터페이스
│  │  ├─ repositories/
│  │  │  ├─ project_repository.py  (인터페이스) ⭐
│  │  │  ├─ worklog_repository.py
│  │  │  └─ resource_plan_repository.py
│  │  └─ services/
│  │     ├─ notifier.py            (인터페이스)
│  │     └─ file_storage.py        (인터페이스)
│  └─ dtos/                         # Data Transfer Objects
│     ├─ project_request.py
│     ├─ project_response.py
│     └─ ...
│
└─ infrastructure/                  # 인프라 레이어
   ├─ persistence/                  # 영속화 구현
   │  ├─ orm_models/                # SQLAlchemy 모델 (기존 유지)
   │  │  ├─ project_orm.py         (기존 project.py)
   │  │  ├─ worklog_orm.py
   │  │  └─ ...
   │  ├─ repositories/              # Repository 구현체
   │  │  ├─ sqlalchemy_project_repository.py ⭐
   │  │  ├─ sqlalchemy_worklog_repository.py
   │  │  └─ ...
   │  └─ mappers/                   # ORM ↔ Domain 매퍼
   │     ├─ project_mapper.py      (80 LOC) ⭐
   │     └─ ...
   ├─ api/                          # FastAPI 어댑터
   │  ├─ controllers/
   │  │  ├─ project_controller.py  (기존 endpoints/projects.py)
   │  │  └─ ...
   │  ├─ dependencies.py            # DI 컨테이너
   │  └─ dto_converters.py
   └─ external/                     # 외부 서비스
      ├─ email_notifier.py
      └─ slack_notifier.py

⭐ = AI 코딩 최적화 핵심 파일 (50-70 LOC)
```

---

## 🧪 Testing Strategy

### 테스트 피라미드

```
        ╱────────╲
       ╱   E2E    ╲         5% (10개) - API 전체 플로우
      ╱────────────╲
     ╱              ╲
    ╱  Integration   ╲      15% (30개) - Repository + DB
   ╱──────────────────╲
  ╱                    ╲
 ╱    Unit Tests        ╲    80% (150개) - Use Cases + Domain
╱────────────────────────╲

장점:
✅ 도메인 로직은 DB 없이 테스트 가능
✅ Use Case는 Mock Repository로 테스트
✅ AI가 각 레이어 테스트 자동 생성
```

### AI 생성 테스트 예시

```python
# tests/domain/entities/test_project.py (AI 자동 생성)
import pytest
from domain.entities import Project
from domain.value_objects import FundingEntity, ProjectStatus

def test_classify_funding_vss_code():
    """VSS 코드를 가진 프로젝트는 ENTITY_VSS로 분류"""
    project = Project(
        id="test-id",
        code="VSS-12345",
        name="Test Project",
        program_id="prog-1",
        project_type_id="SUSTAINING",
        category="PRODUCT"
    )

    assert project.classify_funding() == FundingEntity.ENTITY_VSS

def test_is_billable_when_billable_status():
    """청구 가능 상태일 때 is_billable은 True"""
    project = Project(
        id="test-id",
        code="TEST-001",
        name="Test",
        program_id="prog-1",
        project_type_id="NPI",
        category="PRODUCT",
        recharge_status=RechargeStatus.BILLABLE
    )

    assert project.is_billable() is True

# AI가 100개의 유닛 테스트 자동 생성 → 리뷰만 하면 됨
```

---

## 🚀 Migration Execution Plan

### Week 1: Foundation

| Day | Work | AI | Human | Output |
|-----|------|----|----|--------|
| Mon | 프로젝트 구조 생성 | - | 2h | 폴더 구조 |
| Mon-Tue | Domain Entities 추출 | 90% | 10% (리뷰) | 8개 엔티티 |
| Wed | Value Objects 생성 | 95% | 5% (리뷰) | 10개 VO |
| Thu-Fri | Domain Services | 85% | 15% (로직 검증) | 3개 서비스 |

### Week 2: Application & Infrastructure

| Day | Work | AI | Human | Output |
|-----|------|----|----|--------|
| Mon-Tue | Use Cases 생성 | 90% | 10% (리뷰) | 30개 Use Case |
| Wed | Repository 인터페이스 | 95% | 5% | 8개 인터페이스 |
| Thu | Repository 구현 | 80% | 20% (DB 로직) | 8개 구현체 |
| Fri | API Controllers 전환 | 85% | 15% (DI 설정) | 15개 컨트롤러 |
| Fri | 통합 테스트 | 70% | 30% (검증) | 완료 |

**총 투입 시간**:
- AI 생성: ~50시간 상당 → 실제 5시간
- 사람 리뷰: ~20시간
- **실제 작업 시간: 25시간 (3일 정도)**

---

## 💰 Cost-Benefit Analysis

### 초기 투자 (One-time)

```
인력 비용:
├─ AI 코드 생성 시간: 5시간 × $0 = $0
├─ 사람 리뷰 시간: 20시간 × $50/h = $1,000
└─ AI API 비용 (Claude/GPT): ~$50
──────────────────────────────────────
Total: $1,050

기회비용:
└─ 2주간 신규 기능 개발 불가 (하지만 AI가 대부분 처리)
```

### 월간 절감 효과

```
┌───────────────────────────────────────────────────────────┐
│  작업 유형별 생산성 향상                                    │
├───────────────────────────────────────────────────────────┤
│  신규 기능 추가                                             │
│  ├─ Before: 8시간 (레이어드)                               │
│  ├─ After: 3시간 (클린 아키텍처 + AI)                      │
│  └─ 절감: 5시간 × 월 4회 = 20시간                          │
├───────────────────────────────────────────────────────────┤
│  버그 수정                                                  │
│  ├─ Before: 6시간 (파일 찾기 + 영향 분석)                  │
│  ├─ After: 2시간 (즉시 찾기 + 명확한 범위)                 │
│  └─ 절감: 4시간 × 월 6회 = 24시간                          │
├───────────────────────────────────────────────────────────┤
│  코드 리뷰                                                  │
│  ├─ Before: 2시간 (큰 파일 전체 이해)                      │
│  ├─ After: 0.5시간 (작은 파일, 명확한 책임)                │
│  └─ 절감: 1.5시간 × 월 8회 = 12시간                        │
├───────────────────────────────────────────────────────────┤
│  AI API 비용 절감                                           │
│  ├─ Before: $100/월 (큰 컨텍스트)                         │
│  ├─ After: $40/월 (작은 컨텍스트)                          │
│  └─ 절감: $60/월                                           │
└───────────────────────────────────────────────────────────┘

월간 총 절감:
├─ 시간: 56시간 × $50/h = $2,800
├─ API: $60
└─ Total: $2,860/월

연간 절감: $34,320
ROI: 3,268% (1년 기준)
Break-even: 0.4개월 (2주!)
```

---

## 📈 Success Metrics

### KPI 정의

```yaml
Efficiency Metrics:
  - 평균 기능 개발 시간: 8h → 3h (목표: 62% 감소)
  - 평균 버그 수정 시간: 6h → 2h (목표: 67% 감소)
  - 코드 리뷰 시간: 2h → 0.5h (목표: 75% 감소)

Quality Metrics:
  - 유닛 테스트 커버리지: 0% → 80% (목표)
  - 버그 재발률: 현재 → 50% 감소 (목표)
  - AI 코드 정확도: - → 95% (목표)

Cost Metrics:
  - 월간 AI API 비용: $100 → $40 (목표: 60% 감소)
  - 개발자 생산성: 현재 → 2-3배 향상 (목표)
```

### 측정 방법

```python
# scripts/measure_metrics.py (AI가 생성)
"""
마이그레이션 전후 메트릭 자동 수집 스크립트

Usage:
  python scripts/measure_metrics.py --baseline  # Before
  python scripts/measure_metrics.py --compare   # After
"""

import time
from datetime import datetime
import requests

def measure_api_response_time():
    """API 응답 시간 측정"""
    endpoints = [
        "/api/projects",
        "/api/projects/{id}",
        "/api/worklogs/stats",
    ]
    # ... AI가 자동 생성

def measure_file_sizes():
    """파일 크기 분석 (LOC)"""
    # Before: project_service.py = 538 LOC
    # After: average use case = 50 LOC
    pass

def count_test_coverage():
    """테스트 커버리지 측정"""
    # pytest-cov 통합
    pass
```

---

## ⚠️ Risk Management

### 리스크 식별 및 대응

| 리스크 | 확률 | 영향 | 대응 방안 |
|--------|------|------|-----------|
| **AI 생성 코드 품질** | 중 | 중 | 전체 코드 리뷰 필수, 테스트 커버리지 80% |
| **프론트엔드 호환성** | 낮 | 높 | API 응답 형식 동일 유지, 통합 테스트 |
| **성능 저하** | 낮 | 중 | Repository 레이어 캐싱, 벤치마크 테스트 |
| **팀원 학습 곡선** | 중 | 낮 | 문서 + 예제 코드 AI 생성, 페어 프로그래밍 |
| **일정 지연** | 낮 | 중 | AI 활용 + 점진적 전환, Phase별 체크포인트 |

### Rollback Plan

```bash
# 문제 발생 시 롤백 전략
git checkout main              # 기존 브랜치로 복귀
docker-compose down
docker-compose up -d           # 기존 컨테이너 재시작

# 데이터베이스는 변경 없음 (스키마 동일 유지)
# API 형식도 동일 → 프론트엔드 영향 없음
```

---

## 📚 Documentation

### AI 생성 문서 목록

```
docs/
├─ architecture/
│  ├─ clean-architecture-overview.md    (AI 생성)
│  ├─ domain-model-guide.md             (AI 생성)
│  ├─ use-case-patterns.md              (AI 생성)
│  └─ repository-implementation.md      (AI 생성)
├─ api/
│  ├─ openapi.yaml                      (AI 자동 생성)
│  └─ endpoint-migration-map.md         (Before/After 매핑)
├─ development/
│  ├─ adding-new-feature.md             (AI 생성 튜토리얼)
│  ├─ testing-guide.md                  (AI 생성)
│  └─ ai-coding-best-practices.md       (이 프로젝트용)
└─ migration/
   ├─ this-document.md                   ⭐ (현재 문서)
   ├─ phase-1-report.md                  (진행 중 AI 생성)
   └─ lessons-learned.md                 (완료 후 작성)
```

---

## 🎯 Next Steps

### Immediate Actions (Before Migration)

- [ ] 이 문서 팀 공유 및 피드백 수집
- [ ] AI 코딩 도구 셋업 확인 (Claude Code ✓)
- [ ] 백업 전략 수립 (Git branch + DB dump)
- [ ] Phase 0 실행 (프로젝트 구조 생성)

### Decision Points

**마이그레이션 시작 전 체크리스트:**
- [ ] 현재 스프린트 종료 확인
- [ ] 프론트엔드 개발 일시 중단 가능 여부
- [ ] AI API 예산 확보 ($100)
- [ ] 팀원 2주간 리뷰 시간 확보 가능 여부

**GO/NO-GO 판단:**
- ✅ 위 4개 조건 모두 충족 → 시작
- ❌ 1개라도 미충족 → 다음 스프린트로 연기

---

## 📞 Contact & Support

### Migration Team
- **Lead**: [Your Name] (AI 코드 리뷰 담당)
- **AI Engineer**: Claude Code / GPT-4 (코드 생성)
- **Advisor**: Architecture best practices (문서 참고)

### Resources
- **AI Prompts**: `/docs/ai_prompts/`
- **Progress Tracking**: GitHub Project Board
- **Q&A**: Slack #clean-architecture-migration

---

## 🎓 Appendix

### A. AI Prompt Library

전체 AI 프롬프트 템플릿은 별도 폴더에 관리:
- `docs/ai_prompts/01_entity_extraction.md`
- `docs/ai_prompts/02_usecase_creation.md`
- `docs/ai_prompts/03_repository_pattern.md`
- `docs/ai_prompts/04_test_generation.md`

### B. Reference Implementations

참고할 만한 오픈소스 프로젝트:
- [Clean Architecture Python Example](https://github.com/examples)
- [FastAPI + Clean Architecture](https://github.com/examples)
- [DDD in Python](https://github.com/examples)

### C. Learning Resources

팀원 온보딩 자료:
- Clean Architecture 핵심 개념 (20분 영상)
- Repository 패턴 실습 (Hands-on)
- AI 코딩 베스트 프랙티스 (이 프로젝트 사례)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-22
**Status**: Planning Phase
**Next Review**: Before Phase 0 Start

---

## 💡 Key Takeaway

> **클린 아키텍처는 AI의 GPS다**
>
> 작은 파일(50-70 LOC) + 명확한 책임 + 단일 책임
> = AI가 정확히 이해하고 수정하는 코드베이스
>
> 전환 비용: 2주 (AI 주도)
> 생산성 향상: 2-3배
> ROI 달성: 1개월

**추천: 다음 스프린트에 시작하세요** 🚀
