# Refresh Token 기반 로그인 세션 유지 개선

## Overview

기존 시스템은 access token(30분 만료)만 사용하여 사용자가 30분마다 재로그인해야 하는 문제가 있었다. Refresh token(7일 만료)을 도입하여 access token 만료 시 자동 갱신되도록 개선했다.

## Context

- 백엔드에 `create_refresh_token` 함수가 이미 존재했지만 로그인 시 반환하지 않음
- `/auth/refresh` 엔드포인트가 있었지만 access token으로만 인증 (refresh token 미사용)
- 프론트엔드는 401 응답 시 즉시 localStorage 클리어 후 로그인 페이지로 리다이렉트

## Changes Made

### 1. Backend: Token 스키마 수정
- **파일:** `backend/app/schemas/auth.py`
- `Token` 스키마에 `refresh_token: str` 필드 추가
- `TokenRefreshRequest`에 `refresh_token: str` 필드 추가 (기존 빈 body에서 변경)

### 2. Backend: Auth 엔드포인트 수정
- **파일:** `backend/app/api/endpoints/auth.py`
- **로그인 (`/auth/login`):** access token + refresh token 모두 생성하여 반환
- **토큰 갱신 (`/auth/refresh`):**
  - `Depends(get_current_user)` 의존성 제거 (access token이 만료된 상태에서 호출되므로)
  - Request body에서 `refresh_token` 수신
  - Token type이 `"refresh"`인지 검증
  - 유효한 경우 새 access token + refresh token 발급
  - 사용자 존재 및 활성 상태 확인

### 3. Backend: `get_current_user`에 token type 검증 추가
- **파일:** `backend/app/core/security.py`
- `get_current_user`에서 `payload.get("type") != "access"` 검증 추가
- refresh token으로 일반 API 엔드포인트에 접근하는 것을 차단

### 4. Frontend: Token 타입 업데이트
- **파일:** `frontend/src/types/index.ts`
- `Token` interface에 `refresh_token: string` 추가

### 5. Frontend: Auth Hook 수정
- **파일:** `frontend/src/hooks/useAuth.tsx`
- `login()` 시그니처: `login(token)` -> `login(accessToken, refreshToken)`
- `login()`: 두 토큰 모두 localStorage에 저장 (토큰 저장은 이 함수에서만 단일 관리)
- `logout()`: 두 토큰 모두 삭제
- `fetchCurrentUser` 실패 시 두 토큰 모두 삭제

### 6. Frontend: Axios Interceptor 개선
- **파일:** `frontend/src/api/client.ts`
- 401 응답 시 자동 refresh 로직:
  1. refresh token이 있으면 `/auth/refresh` 호출
  2. 성공 시 새 토큰 저장 후 원래 요청 재시도
  3. 실패 시 토큰 클리어 후 로그인 페이지 리다이렉트
- 동시 다중 요청 큐잉: `isRefreshing` 플래그 + `failedQueue` 배열로 refresh 중복 호출 방지
- `/auth/refresh` 엔드포인트 자체의 401은 바로 로그아웃 처리 (무한 루프 방지)

### 7. Frontend: LoginPage 업데이트
- **파일:** `frontend/src/pages/LoginPage.tsx`
- `login(response.access_token)` -> `login(response.access_token, response.refresh_token)`

## Code Examples

### Token Type 검증 (보안 강화)
```python
# backend/app/core/security.py - get_current_user
payload = decode_token(token)
if payload is None:
    raise credentials_exception

if payload.get("type") != "access":
    raise credentials_exception  # refresh token으로 API 접근 차단
```

### Axios Response Interceptor (핵심 로직)
```typescript
// frontend/src/api/client.ts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue concurrent requests
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }
      // ... attempt refresh, retry original request
    }
  }
);
```

### Backend Refresh Endpoint
```python
# backend/app/api/endpoints/auth.py
@router.post("/refresh", response_model=Token)
async def refresh_token(body: TokenRefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    # ... validate user, issue new tokens
```

## Verification Results

### Backend Verification
```
Token fields: ['access_token', 'refresh_token', 'token_type']
TokenRefreshRequest fields: ['refresh_token']
Auth endpoints loaded successfully
security module loaded OK
```

### Frontend Build
- 우리 변경으로 인한 새로운 TypeScript 에러 없음
- 기존 미사용 변수 경고 2건 (변경 무관): `setTeamViewMode`, `queryClient`

## Token Flow Summary

```
Login -> access_token (30min) + refresh_token (7days) -> localStorage

API call with access_token -> OK
API call with refresh_token -> 401 (type != "access")

API call -> 401 (access expired)
  -> POST /auth/refresh { refresh_token }
    -> 200: new tokens -> retry original request
    -> 401: redirect to /login

Multiple concurrent 401s -> only 1 refresh call, others queued
```

## 수정 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `backend/app/schemas/auth.py` | Token에 refresh_token 필드 추가, TokenRefreshRequest에 refresh_token 필드 추가 |
| `backend/app/api/endpoints/auth.py` | 로그인에 refresh token 반환, /refresh를 body 기반으로 변경 |
| `backend/app/core/security.py` | get_current_user에 token type=="access" 검증 추가 |
| `frontend/src/types/index.ts` | Token interface에 refresh_token 추가 |
| `frontend/src/hooks/useAuth.tsx` | login/logout에 refresh token 처리 |
| `frontend/src/api/client.ts` | 자동 refresh interceptor + 큐잉 패턴 |
| `frontend/src/pages/LoginPage.tsx` | login 호출 시 refresh token 전달 |
