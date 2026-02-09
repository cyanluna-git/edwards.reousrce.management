# Backend Error Codes Standardization (Phase 2)

## Overview

Backend의 126개 `HTTPException`이 55+개의 자유 텍스트 메시지로 흩어져 있어 프론트엔드에서 로컬라이즈된 에러 메시지를 표시할 수 없는 문제를 해결. 모든 에러 응답을 `{"code": "ERROR_CODE", "message": "..."}` 형식으로 표준화하고, 프론트엔드에 에러 코드 → i18n 매핑을 추가했다.

## Context

- 기존: `raise HTTPException(status_code=404, detail="User not found")` → `{"detail": "User not found"}`
- 문제: 프론트엔드에서 `errors.json` 로케일 파일이 있었지만, 백엔드 에러와 매핑할 코드가 없어 번역 불가
- 목표: 구조화된 에러 코드로 프론트엔드에서 `errors.code.NOT_FOUND_USER` 같은 i18n 키로 매핑 가능하게 함

## Changes Made

### 1. Error Code Constants + Helper (`backend/app/core/errors.py`) - **신규**

도메인별로 그룹화된 에러 코드 상수와 `app_error()` 헬퍼 함수 생성:

- `AUTH_*` (11개): 인증/인가 관련 에러
- `NOT_FOUND_*` (16개): 리소스를 찾을 수 없는 경우
- `DUPLICATE_*` (4개): 중복 데이터 충돌
- `VALIDATION_*` (5개): 유효성 검사 실패
- `DEPENDENCY_*` (4개): 의존 관계로 삭제 불가
- `SERVER_*` (2개): 서버 내부 에러

```python
# backend/app/core/errors.py
class ErrorCode:
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    NOT_FOUND_USER = "NOT_FOUND_USER"
    DUPLICATE_EMAIL = "DUPLICATE_EMAIL"
    # ... 총 42개 에러 코드

def app_error(status_code: int, code: str, detail: str, **kwargs) -> HTTPException:
    """Create HTTPException with error code in detail dict."""
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": detail, **kwargs},
    )
```

### 2. Global Exception Handler 업데이트 (`backend/app/main.py`)

dict/string detail 모두 처리하는 하이브리드 핸들러로 변경:

```python
# Before
if isinstance(exc, HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

# After
if isinstance(exc, HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": "UNKNOWN", "message": exc.detail},
    )
```

### 3. Backend Endpoint 파일 변환 (18개 파일, 126개 에러)

모든 `raise HTTPException(...)` → `raise app_error(...)` 변환:

| 파일 | 변환 수 | 주요 에러 코드 |
|------|---------|---------------|
| `auth.py` | 19 | AUTH_INVALID_CREDENTIALS, AUTH_SSO_DISABLED, AUTH_REGISTRATION_TOKEN_INVALID |
| `projects.py` | 16 | NOT_FOUND_PROJECT, NOT_FOUND_MILESTONE, VALIDATION_MILESTONE_MISMATCH |
| `departments.py` | 16 | NOT_FOUND_DEPARTMENT, DEPENDENCY_HAS_SUB_TEAMS, DEPENDENCY_HAS_USERS |
| `users.py` | 8 | NOT_FOUND_USER, DUPLICATE_EMAIL, NOT_FOUND_HISTORY |
| `recharge_ios.py` | 8 | NOT_FOUND_RECHARGE_IO, DUPLICATE_IO, DEPENDENCY_HAS_PROJECTS |
| `scenarios.py` | 7 | NOT_FOUND_SCENARIO, NOT_FOUND_MILESTONE |
| `internal_ios.py` | 7 | NOT_FOUND_INTERNAL_IO, DUPLICATE_IO |
| `resource_plans.py` | 6 | NOT_FOUND_RESOURCE_PLAN, VALIDATION_FAILED |
| `hiring_plans.py` | 6 | NOT_FOUND_HIRING_PLAN, NOT_FOUND_DEPARTMENT |
| `worklogs.py` | 5 | NOT_FOUND_WORKLOG, VALIDATION_FAILED |
| `resource_matrix.py` | 5 | VALIDATION_FAILED, SERVER_INTERNAL_ERROR |
| `divisions.py` | 5 | NOT_FOUND_DIVISION, DUPLICATE_CODE, DEPENDENCY_HAS_DEPARTMENTS |
| `job_positions.py` | 5 | NOT_FOUND_JOB_POSITION, DUPLICATE_NAME |
| `project_roles.py` | 5 | NOT_FOUND_PROJECT_ROLE, DUPLICATE_NAME |
| `work_types.py` | 3 | NOT_FOUND_WORK_TYPE, DUPLICATE_CODE |
| `security.py` | 3 | AUTH_INVALID_TOKEN, AUTH_INACTIVE_USER, AUTH_INSUFFICIENT_PERMISSIONS |
| `dashboard.py` | 1 | SERVER_INTERNAL_ERROR |
| `ai_worklog.py` | 1 | SERVER_AI_PARSE_ERROR |

변환 예시:
```python
# Before
raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

# After
raise app_error(status_code=status.HTTP_404_NOT_FOUND, code=ErrorCode.NOT_FOUND_USER, detail="User not found")
```

### 4. Frontend Error Interceptor (`frontend/src/api/client.ts`)

`ApiError` 타입과 `getApiError()` 유틸리티 함수 추가:

```typescript
export interface ApiError {
  code: string;
  message: string;
  [key: string]: unknown;
}

export function getApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data;
    if (data.code) return data as ApiError;
    if (data.detail) {
      if (typeof data.detail === 'object' && data.detail.code) return data.detail as ApiError;
      return { code: 'UNKNOWN', message: typeof data.detail === 'string' ? data.detail : 'An unknown error occurred' };
    }
  }
  return { code: 'UNKNOWN', message: 'An unknown error occurred' };
}
```

### 5. Frontend Error Locale Files (EN/KO)

`errors.json`에 `code` 섹션 추가 (50개 에러 코드 매핑):

```json
// frontend/public/locales/en/errors.json
{
  "network": { ... },
  "auth": { ... },
  "data": { ... },
  "generic": { ... },
  "code": {
    "AUTH_INVALID_CREDENTIALS": "Incorrect email or password.",
    "NOT_FOUND_USER": "User not found.",
    "DUPLICATE_EMAIL": "A user with this email already exists.",
    ...
  }
}
```

```json
// frontend/public/locales/ko/errors.json
{
  "code": {
    "AUTH_INVALID_CREDENTIALS": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "NOT_FOUND_USER": "사용자를 찾을 수 없습니다.",
    "DUPLICATE_EMAIL": "이미 등록된 이메일 주소입니다.",
    ...
  }
}
```

## API Error Response Format

### Before (자유 텍스트)
```json
{"detail": "User not found"}
{"detail": "A user with this email already exists."}
{"detail": "Cannot delete: 3 active departments belong to this business unit"}
```

### After (구조화된 에러 코드)
```json
{"code": "NOT_FOUND_USER", "message": "User not found"}
{"code": "DUPLICATE_EMAIL", "message": "A user with this email already exists."}
{"code": "DEPENDENCY_HAS_DEPARTMENTS", "message": "Cannot delete: 3 active departments belong to this business unit"}
```

## File Summary

| Action | Files | Count |
|--------|-------|-------|
| New | `backend/app/core/errors.py` | 1 |
| Modify | `backend/app/main.py` | 1 |
| Modify | `backend/app/core/security.py` | 1 |
| Modify | `backend/app/api/endpoints/*.py` | 16 |
| Modify | `frontend/src/api/client.ts` | 1 |
| Modify | `frontend/public/locales/en/errors.json` | 1 |
| Modify | `frontend/public/locales/ko/errors.json` | 1 |
| **Total** | | **22** |

## Verification Results

### Python Syntax Check
```
All Python files in backend/app/ parse successfully.
```

### TypeScript Check
```bash
$ npx tsc --noEmit
# No errors (clean exit)
```

### Frontend Build
```bash
$ npx vite build
✓ built in 1m 27s
```

### Conversion Completeness
```
raise HTTPException in endpoints: 0 remaining
raise app_error total: 126 calls across 18 files
Error code imports: 18 files
```

## Usage Guide (for Frontend Developers)

프론트엔드에서 에러 코드 활용 방법:

```typescript
import { getApiError } from '@/api/client';
import { useTranslation } from 'react-i18next';

// In a component or mutation error handler:
const { t } = useTranslation('errors');

try {
  await createUser(data);
} catch (err) {
  const apiError = getApiError(err);
  // Use i18n key: errors.code.DUPLICATE_EMAIL → "이미 등록된 이메일 주소입니다."
  const localizedMessage = t(`code.${apiError.code}`, { defaultValue: apiError.message });
  toast.error(localizedMessage);
}
```

## Next Steps

- 프론트엔드 컴포넌트에서 `getApiError()` + `t('errors:code.XXX')` 패턴 적용
- toast/notification 시스템에 에러 코드 기반 로컬라이즈 통합
- 추후 새 에러 추가 시 `ErrorCode` 상수 + locale JSON 동시 업데이트 필요
