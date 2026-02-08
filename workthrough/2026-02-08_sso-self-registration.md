# SSO Self-Registration for Unregistered Users

## Overview

SSO(SAML) 인증 후 DB에 등록되지 않은 유저가 직접 계정을 생성할 수 있는 Self-Registration 기능을 구현했다. 기존에는 미등록 유저가 `/login?error=unregistered` 에러 배너만 보았지만, 이제는 최소 정보(이름, 한글이름, 부서, 직급)를 입력하고 즉시 계정을 생성할 수 있다.

## Context

- 기존 플로우: SSO 로그인 → DB에 없음 → `/login?error=unregistered` → "관리자에게 연락하세요" 배너
- 개선 플로우: SSO 로그인 → DB에 없음 → registration token 발급 → `/register?token=...` → 폼 입력 → 계정 생성 → 자동 로그인

이 변경으로 관리자 개입 없이 SSO 인증된 유저가 셀프 서비스로 계정을 생성할 수 있다.

## Changes Made

### 1. Registration Token (backend/app/core/security.py)

기존 `create_access_token` / `create_refresh_token` 패턴을 따라 두 함수 추가:

- `create_registration_token()`: `type="registration"` JWT 생성, 기본 10분 만료
- `decode_registration_token()`: 디코딩 후 `type=="registration"` 검증

```python
def create_registration_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=10))
    to_encode.update({"exp": expire, "type": "registration"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_registration_token(token: str) -> Optional[dict]:
    payload = decode_token(token)
    if payload is None or payload.get("type") != "registration":
        return None
    return payload
```

토큰 타입 분리로 access/refresh 토큰과 혼용 불가.

### 2. Registration Schema (backend/app/schemas/auth.py)

```python
class SSORegistrationRequest(BaseModel):
    registration_token: str
    name: str
    korean_name: str      # 필수
    department_id: str     # 필수
    position_id: str       # 필수
```

응답은 기존 `Token` 스키마 재사용.

### 3. SSO Callback 변경 + 등록 엔드포인트 (backend/app/api/endpoints/auth.py)

**sso_callback 수정**: 미등록 유저 발견 시 `/login?error=unregistered` 대신 registration token 생성 후 `/register?token=...`로 리다이렉트.

```python
# Before
return RedirectResponse(url=f"{frontend_base}/login?error=unregistered&email={quote(email)}")

# After
reg_token = create_registration_token({"email": email, "name": user_info.get("name", "")})
return RedirectResponse(url=f"{frontend_base}/register?token={reg_token}")
```

**새 엔드포인트 `POST /auth/sso/register`**:
1. registration token 디코딩 → email 추출
2. 중복 유저 체크 (409 Conflict)
3. department_id, position_id DB 유효성 검증 (400)
4. `UserService.create_user()` 호출 (랜덤 패스워드, UserHistory 자동 생성)
5. access/refresh 토큰 발급 및 반환

### 4. Frontend API (frontend/src/api/client.ts)

```typescript
export interface SSORegistrationData {
  registration_token: string;
  name: string;
  korean_name: string;
  department_id: string;
  position_id: string;
}

export const ssoRegister = async (data: SSORegistrationData): Promise<Token> => {
  const response = await apiClient.post<Token>('/auth/sso/register', data);
  return response.data;
};
```

### 5. RegisterPage (frontend/src/pages/RegisterPage.tsx) - 신규

- URL에서 `token` 파라미터 파싱 → JWT payload에서 email/name 추출 (`atob`)
- `getDepartments()`, `getJobPositionsList()`로 드롭다운 데이터 fetch (인증 불필요)
- 폼: email(read-only), name(editable), korean_name, department Select, position Select
- Submit → `ssoRegister()` → `useAuth().login()` → 대시보드 자동 이동
- 에러 처리: 토큰 만료(401), 이미 등록됨(409), 유효성 오류(400)
- 토큰 없이 접근 시 "SSO로 로그인하세요" 안내 + 로그인 페이지 링크
- LoginPage와 동일한 비주얼 스타일 (그라디언트 배경, Card, Lucide 아이콘)

### 6. 라우트 등록

- `frontend/src/pages/index.ts`: `RegisterPage` export 추가
- `frontend/src/App.tsx`: 비인증 라우트에 `<Route path="/register" element={<RegisterPage />} />` 추가

### 7. 테스트 인프라 개선 (backend/tests/conftest.py)

SQLite 테스트 DB에서 PostgreSQL JSONB 타입 호환성 문제 해결:
```python
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
if not hasattr(SQLiteTypeCompiler, 'visit_JSONB'):
    SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON
```

### 8. 테스트 파일 (backend/tests/test_sso_registration.py) - 신규

18개 테스트 케이스:

**단위 테스트 (6개)**: Registration token 생성/디코딩, 만료, 타입 혼용 방지

**통합 테스트 (12개)**: POST /auth/sso/register 엔드포인트
- Happy path: 정상 등록 + DB 검증 + UserHistory + 토큰 유효성
- 에러: 만료 토큰(401), 중복 이메일(409), 잘못된 부서/직급(400), access token 혼용(401), 필수 필드 누락(422)
- 보안: email은 토큰에서만 추출, name은 폼 입력값 사용

## File Summary

| File | Action |
|------|--------|
| `backend/app/core/security.py` | Modified - 2 functions added |
| `backend/app/schemas/auth.py` | Modified - 1 schema added |
| `backend/app/api/endpoints/auth.py` | Modified - callback changed + endpoint added |
| `backend/tests/conftest.py` | Modified - JSONB compatibility fix |
| `backend/tests/test_sso_registration.py` | **New** - 18 test cases |
| `frontend/src/api/client.ts` | Modified - ssoRegister API added |
| `frontend/src/pages/RegisterPage.tsx` | **New** - Registration form page |
| `frontend/src/pages/index.ts` | Modified - RegisterPage export |
| `frontend/src/App.tsx` | Modified - /register route added |

## Verification Results

### TypeScript Type Check
```bash
$ npx tsc --noEmit
# (no output - clean pass)
```

### Python Syntax Validation
```bash
$ python3 -c "import ast; ..."
OK: security.py
OK: auth.py (schemas)
OK: auth.py (endpoints)
All Python files parse correctly
```

### Backend Tests
```bash
$ pytest tests/test_sso_registration.py -v
18 passed in 3.02s

# Full test suite (4 pre-existing failures unrelated to this change)
$ pytest tests/ -v
88 passed, 4 failed (pre-existing)
```

## Security Considerations

1. **토큰 타입 분리**: `type="registration"` → access/refresh 토큰으로 사용 불가
2. **10분 만료**: 남용 방지, 만료 시 SSO 재인증으로 갱신
3. **SAML 검증 이메일만**: 등록 폼에서 email 변경 불가, 백엔드는 토큰 내 email만 사용
4. **중복 등록 방지**: DB 쿼리로 race condition 차단
5. **랜덤 패스워드**: `secrets.token_urlsafe(32)` - SSO 전용 유저는 패스워드 로그인 불가

## Testing Limitations

| 구간 | 로컬 테스트 | 사유 |
|------|------------|------|
| SAML IdP 인증 | 불가 | Entra ID 연동 필요 |
| SSO Callback → register 리다이렉트 | 불가 | SAML assertion 필요 |
| Registration token 생성/검증 | 가능 | 단위 테스트 커버 |
| POST /sso/register 엔드포인트 | 가능 | TestClient + SQLite |
| 프론트엔드 UI 렌더링 | 수동 | `pnpm dev` 후 URL 직접 접근 |

## Next Steps

- 프로덕션 배포 후 실제 SSO 플로우 E2E 검증
- 신규 유저 기본 role 정책 검토 (현재 "USER")
- 관리자에게 신규 등록 알림 기능 고려
