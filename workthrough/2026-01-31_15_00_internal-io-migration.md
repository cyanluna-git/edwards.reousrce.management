# Internal IO 테이블 마이그레이션 및 Project.code 리팩토링

## Overview
프로젝트의 `code` 컬럼을 별도의 `internal_ios` 테이블로 분리하여 1:N 관계로 정규화하는 데이터베이스 마이그레이션을 완료했습니다. 이를 통해 여러 프로젝트가 동일한 IO 번호를 공유할 수 있고, IO 관련 메타데이터를 독립적으로 관리할 수 있게 되었습니다.

## Context
- **기존 문제**: `projects.code` 컬럼에 IO 번호가 직접 저장되어 있어 중복 관리 및 IO 관련 추가 정보 저장이 어려웠음
- **목표**: InternalIO를 별도 엔티티로 분리하여 데이터 정규화 및 확장성 확보
- **영향 범위**: Backend 모델, 서비스, API 엔드포인트 및 Frontend 컴포넌트 전체

## Changes Made

### 1. 데이터베이스 마이그레이션

#### 새로운 `internal_ios` 테이블 생성
```sql
CREATE TABLE internal_ios (
    id VARCHAR(36) PRIMARY KEY,
    io_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `projects` 테이블 변경
- `internal_io_id` FK 컬럼 추가
- `code` 컬럼 삭제
- FK 인덱스 추가: `ix_projects_internal_io_id`
- 부분 인덱스 추가: `ix_internal_ios_active` (활성 IO 빠른 조회용)

#### 데이터 마이그레이션
- 146개 기존 프로젝트 코드를 `internal_ios` 테이블로 이전
- 모든 프로젝트가 새로운 `internal_io_id`로 연결됨

### 2. Backend 유틸리티 함수 추가
- 파일: `backend/app/utils/__init__.py`, `backend/app/utils/project_helpers.py`

```python
# backend/app/utils/project_helpers.py
def get_io_number(project: "Project") -> Optional[str]:
    """Safely get the IO number from a project's internal_io relationship."""
    return project.internal_io.io_number if project.internal_io else None

def get_project_display_code(project: "Project") -> str:
    """Get a display code for a project, falling back to truncated ID if no IO."""
    if project.internal_io:
        return project.internal_io.io_number
    return project.id[:8] if project.id else "-"

def project_to_hierarchy_dict(project: "Project") -> Dict[str, Any]:
    """Convert a project to a hierarchy node dictionary."""
    return {
        "id": project.id,
        "internal_io": {
            "io_number": project.internal_io.io_number,
            "name": project.internal_io.name,
        } if project.internal_io else None,
        "name": project.name,
        "status": project.status,
        "type": "project",
    }
```

### 3. Backend 서비스 업데이트

#### 업데이트된 파일들
| 파일 | 변경 내용 |
|------|-----------|
| `services/project_service.py` | `project_to_hierarchy_dict` 헬퍼 함수 사용 |
| `services/dashboard_service.py` | `get_io_number` 헬퍼 함수 사용 (3곳) |
| `services/resource_plan_service.py` | `get_io_number` 헬퍼 함수 사용 (2곳) |
| `services/ai_worklog_service.py` | `get_io_number` 헬퍼 함수 사용 (2곳) |
| `services/resource_matrix_service.py` | `get_io_number` 헬퍼 함수 사용 + joinedload 최적화 |
| `services/worklog_service.py` | `get_io_number` 헬퍼 함수 사용 |

### 4. API 엔드포인트 업데이트
- 파일: `backend/app/api/endpoints/worklogs.py`

```python
# Before
"project_code": wl.project.code if wl.project else None,

# After
from app.utils import get_io_number
"project_code": get_io_number(wl.project) if wl.project else None,
```

6개 위치에서 `project.code` → `get_io_number(project)` 변경

### 5. Alembic 마이그레이션 파일
- 파일: `backend/alembic/versions/005_add_internal_io_table.py`

```python
# Postgres Best Practices 적용
# FK 인덱스 추가 (JOIN 성능 향상)
op.create_index("ix_projects_internal_io_id", "projects", ["internal_io_id"])

# 부분 인덱스 추가 (활성 IO 조회 최적화)
op.execute(
    "CREATE INDEX ix_internal_ios_active ON internal_ios(io_number) WHERE is_active = true"
)
```

### 6. N+1 쿼리 방지를 위한 Eager Loading 추가
```python
# resource_matrix_service.py
query = (
    db.query(ResourcePlan)
    .options(
        joinedload(ResourcePlan.project).joinedload(Project.internal_io),
        joinedload(ResourcePlan.user),
        joinedload(ResourcePlan.project_role),
        joinedload(ResourcePlan.position),
    )
    .filter(...)
)
```

## Verification Results

### 데이터베이스 스키마 확인
```
 internal_ios_count | projects_with_io
--------------------+------------------
                146 |              146
```

### 데이터 마이그레이션 검증
```
                  id                  |  old_code  | new_io_number
--------------------------------------+------------+---------------
 8a45fd77-809a-442c-8000-f82a0597964d | PRJ-14     | PRJ-14
 f6320bb9-c737-410b-8f4a-b8b7b9ef84f4 | 406364     | 406364
 c9e296fd-e4f5-497a-8021-a7d4a5bdc460 | 406442-122 | 406442-122
```

### Backend 빌드 확인
```bash
> docker-compose up -d --build backend
✓ Container edwards-api Started

> docker logs edwards-api --tail 10
INFO:     Started server process [1]
INFO:     Application startup complete.
INFO:     192.168.158.1:56236 - "GET /health HTTP/1.1" 200 OK
```

### API 응답 확인
```json
{
  "id": "586a644a-5fbd-4490-953b-62a10ec25287",
  "internal_io": {
    "io_number": "406428-123",
    "name": null,
    "id": "31368ced-7cb2-4ce8-be32-dd4eb51f0c59",
    "is_active": true
  },
  "name": "(AA) R&D General",
  "status": "InProgress"
}
```

## Postgres Best Practices 적용 사항

1. **FK 인덱스**: `projects.internal_io_id`에 인덱스 추가로 JOIN 성능 향상
2. **부분 인덱스**: 활성 IO만 인덱싱하여 일반적인 조회 최적화
3. **Eager Loading**: N+1 쿼리 방지를 위한 joinedload 적용
4. **헬퍼 함수**: 일관된 null 처리 패턴으로 코드 중복 제거

## 변경된 파일 목록

### Backend
- `backend/app/utils/__init__.py` (신규)
- `backend/app/utils/project_helpers.py` (신규)
- `backend/alembic/versions/005_add_internal_io_table.py` (신규)
- `backend/app/services/project_service.py`
- `backend/app/services/dashboard_service.py`
- `backend/app/services/resource_plan_service.py`
- `backend/app/services/ai_worklog_service.py`
- `backend/app/services/resource_matrix_service.py`
- `backend/app/services/worklog_service.py`
- `backend/app/api/endpoints/worklogs.py`

## Next Steps
- Frontend 컴포넌트에서 `project.code` → `project.internal_io?.io_number` 변경 완료 필요 (이전 세션에서 진행됨)
- InternalIO CRUD API 엔드포인트 추가 고려
- IO 번호 관리 UI 개발 고려
