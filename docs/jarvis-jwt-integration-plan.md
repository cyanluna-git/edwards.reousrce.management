# EOB → Jarvis JWT 인증 연동 구현 계획

## Context

EOB(Edwards Project Operation Board)는 사내 프로젝트 관리 시스템이며, Jarvis(http://jarvis.10.182.252.32.sslip.io/)는 별도 Docker 스택으로 운영되는 AI 어시스턴트 서비스입니다. 현재 Jarvis는 URL만 알면 누구나 접근 가능한 상태입니다.

**목표**: EOB에 로그인한 사용자만 Jarvis에 접근할 수 있도록 JWT 기반 인증을 구현합니다. EOB의 인증 세션을 활용하여 Jarvis로 안전하게 연결되도록 합니다.

**구현 방식**: 백엔드 중계 방식
- EOB 백엔드가 Jarvis 전용 JWT 토큰을 생성
- 프론트엔드에서 이 토큰을 받아 Jarvis URL로 리다이렉트
- Jarvis는 전달받은 JWT를 검증하여 사용자 인증

## Implementation Plan

### Phase 1: Backend - JWT Token Generation

#### 1.1 환경변수 추가

**파일**: `backend/.env` (및 `.env.example`)

```env
# Jarvis Integration
JARVIS_URL=http://jarvis.10.182.252.32.sslip.io
JARVIS_SECRET_KEY=jarvis-integration-secret-key-change-in-production
JARVIS_TOKEN_EXPIRE_MINUTES=10
```

**주의사항**:
- `JARVIS_SECRET_KEY`는 EOB의 `SECRET_KEY`와 **별도로 관리** (보안 격리)
- Production에서는 강력한 랜덤 문자열 사용
- Jarvis 측과 이 키를 안전하게 공유 필요

#### 1.2 Config 업데이트

**파일**: `backend/app/core/config.py` (L36 이후 추가)

```python
# Jarvis Integration
JARVIS_URL: str = "http://jarvis.10.182.252.32.sslip.io"
JARVIS_SECRET_KEY: str = ""
JARVIS_TOKEN_EXPIRE_MINUTES: int = 10
```

**설명**:
- 기존 Settings 클래스에 3개 필드 추가
- validate_required에서 JARVIS_SECRET_KEY 검증은 선택사항 (경고만)

#### 1.3 Security - Jarvis Token 생성 함수

**파일**: `backend/app/core/security.py` (L78 이후 추가)

```python
def create_jarvis_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token for Jarvis service integration.

    Uses a separate secret key (JARVIS_SECRET_KEY) for security isolation.
    Token contains minimal user information: user_id (sub), email, role.
    Default expiry: 10 minutes (short-lived for single-use redirect).

    Args:
        data: Token payload (should include sub, email, role)
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JARVIS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire, "type": "jarvis"})
    encoded_jwt = jwt.encode(
        to_encode, settings.JARVIS_SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt
```

**Payload 구조**:
```json
{
  "sub": "user_id_uuid",
  "email": "user@edwards.com",
  "role": "USER",
  "type": "jarvis",
  "exp": 1234567890
}
```

#### 1.4 Schema 추가

**파일**: `backend/app/schemas/auth.py` (L82 이후 추가)

```python
class JarvisTokenResponse(BaseModel):
    """Jarvis integration token response"""

    jarvis_token: str
    jarvis_url: str
    expires_in: int  # seconds

    class Config:
        json_schema_extra = {
            "example": {
                "jarvis_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "jarvis_url": "http://jarvis.10.182.252.32.sslip.io",
                "expires_in": 600
            }
        }
```

#### 1.5 Auth Endpoint 추가

**파일**: `backend/app/api/endpoints/auth.py` (L426 이후 추가)

```python
@router.get("/jarvis-token", response_model=JarvisTokenResponse)
async def get_jarvis_token(
    current_user: User = Depends(get_current_user),
):
    """
    Generate a single-use JWT token for Jarvis service integration.

    Requires valid EOB authentication.
    Returns a short-lived token (10 minutes) with minimal user information.
    """
    if not settings.JARVIS_SECRET_KEY or not settings.JARVIS_SECRET_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Jarvis integration is not configured",
        )

    # Create Jarvis-specific token with minimal information
    jarvis_token = create_jarvis_token(
        data={
            "sub": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
        },
        expires_delta=timedelta(minutes=settings.JARVIS_TOKEN_EXPIRE_MINUTES),
    )

    logger.info(f"Generated Jarvis token for user: {current_user.email}")

    return JarvisTokenResponse(
        jarvis_token=jarvis_token,
        jarvis_url=settings.JARVIS_URL,
        expires_in=settings.JARVIS_TOKEN_EXPIRE_MINUTES * 60,
    )
```

**import 추가**:
```python
from app.schemas.auth import JarvisTokenResponse
from app.core.security import create_jarvis_token
```

### Phase 2: Frontend - UI & API Integration

#### 2.1 API Client 업데이트

**파일**: `frontend/src/api/client.ts` (파일 끝에 추가)

```typescript
// ============ Jarvis Integration API ============

export interface JarvisTokenResponse {
  jarvis_token: string;
  jarvis_url: string;
  expires_in: number;
}

export const getJarvisToken = async (): Promise<JarvisTokenResponse> => {
  const response = await apiClient.get<JarvisTokenResponse>('/auth/jarvis-token');
  return response.data;
};
```

#### 2.2 i18n 번역 추가

**파일**: `frontend/public/locales/en/navigation.json`

```json
{
  "main": {
    "jarvis": "Jarvis AI Assistant",
    // ... 기존 항목들
  },
  "sections": {
    "integrations": "Integrations",
    // ... 기존 항목들
  },
  "sidebar": {
    "jarvisDescription": "AI-powered project assistant",
    // ... 기존 항목들
  }
}
```

**파일**: `frontend/public/locales/ko/navigation.json`

```json
{
  "main": {
    "jarvis": "Jarvis AI 어시스턴트",
    // ... 기존 항목들
  },
  "sections": {
    "integrations": "통합 서비스",
    // ... 기존 항목들
  },
  "sidebar": {
    "jarvisDescription": "AI 기반 프로젝트 어시스턴트",
    // ... 기존 항목들
  }
}
```

#### 2.3 Sidebar 컴포넌트 업데이트

**파일**: `frontend/src/components/layout/Sidebar.tsx`

**변경사항 요약**:
1. Import 추가: `ExternalLink` 아이콘, `getJarvisToken` API
2. Integrations 섹션 네비게이션 배열 추가
3. Jarvis 클릭 핸들러 함수 추가
4. Navigation에 Integrations 섹션 렌더링 추가

**주요 코드**:

```typescript
// Import 추가
import { ExternalLink } from 'lucide-react'
import { getJarvisToken } from '@/api/client'
import { toast } from 'sonner'

// Integrations 섹션 (L52 이후 추가)
const integrationsNavigation: NavItem[] = [
    { nameKey: 'main.jarvis', href: '/integrations/jarvis', icon: ExternalLink },
]

// Jarvis 클릭 핸들러 (컴포넌트 내부, L68 이후)
const handleJarvisClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
        const { jarvis_token, jarvis_url } = await getJarvisToken();
        const targetUrl = `${jarvis_url}?token=${jarvis_token}`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
        console.error('Failed to get Jarvis token:', error);
        toast.error('Jarvis 연결에 실패했습니다. 나중에 다시 시도해주세요.');
    }
};

// renderNavItem 수정 (external link 처리)
const renderNavItem = (item: NavItem, onClick?: (e: React.MouseEvent) => void) => {
    const isActive = location.pathname === item.href
    const name = t(item.nameKey)
    const isExternal = item.href.startsWith('/integrations/jarvis')

    return (
        <Link
            key={item.nameKey}
            to={item.href}
            onClick={isExternal ? onClick : undefined}
            title={isCollapsed ? name : undefined}
            className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                isCollapsed && 'justify-center px-2'
            )}
        >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && (
                <span className="flex items-center gap-2">
                    {name}
                    {isExternal && <ExternalLink className="h-3 w-3 opacity-60" />}
                </span>
            )}
        </Link>
    )
}

// Navigation에 Integrations 섹션 추가 (L190 이후)
{/* Integrations Section */}
<div className="pt-3">
    <div className="border-t border-slate-700 mb-3" />
    {!isCollapsed && (
        <div className="mb-2 flex items-center gap-2 px-3">
            <ExternalLink className='h-4 w-4 text-slate-500' />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('sections.integrations')}
            </span>
        </div>
    )}
    {isCollapsed && (
        <div className="flex justify-center mb-2">
            <ExternalLink className='h-4 w-4 text-slate-500' />
        </div>
    )}
    <div className="space-y-1">
        {renderNavItem(
            integrationsNavigation[0],
            handleJarvisClick
        )}
    </div>
</div>
```

## Phase 3: Jarvis - JWT Token Verification

### 3.1 패키지 설치

**디렉토리**: `/mnt/d/00.Dev/javis.gerald/src/javis-viewer/`

```bash
cd /mnt/d/00.Dev/javis.gerald/src/javis-viewer
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

**대안**: `jose` 라이브러리 (더 현대적)
```bash
npm install jose
```

### 3.2 환경변수 추가

**파일**: `/mnt/d/00.Dev/javis.gerald/.env` (루트)

```bash
# EOB JWT Integration
EOB_JWT_SECRET=jarvis-integration-secret-key-change-in-production
EOB_JWT_ALGORITHM=HS256
EOB_JWT_VALIDATION_ENABLED=true

# Next.js (기존)
PORT=3009
NODE_ENV=development
NEXT_PUBLIC_READ_ONLY=true
# ... 기존 환경변수들
```

**주의사항**:
- `EOB_JWT_SECRET`은 EOB의 `JARVIS_SECRET_KEY`와 **동일한 값** 사용
- Production에서는 `.env.local` 또는 환경변수로 관리

### 3.3 인증 유틸리티 생성

**파일**: `/mnt/d/00.Dev/javis.gerald/src/javis-viewer/src/lib/auth.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// JWT Payload 타입 정의
export interface EOBJWTPayload {
  sub: string;        // user_id
  email: string;      // user email
  role: string;       // user role (ADMIN, PM, USER, etc.)
  type: string;       // "jarvis"
  exp: number;        // expiration timestamp
}

/**
 * Extract JWT token from request (query parameter or Authorization header)
 */
export function extractTokenFromRequest(request: NextRequest): string | null {
  // 1. 쿼리 파라미터에서 토큰 추출: ?token=xxx
  const searchParams = request.nextUrl.searchParams;
  const queryToken = searchParams.get('token');

  if (queryToken) return queryToken;

  // 2. Authorization 헤더에서 추출: Bearer xxx
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Verify EOB JWT token
 * Returns payload if valid, null otherwise
 */
export async function verifyEOBToken(token: string): Promise<EOBJWTPayload | null> {
  try {
    const secret = process.env.EOB_JWT_SECRET;
    const algorithm = process.env.EOB_JWT_ALGORITHM || 'HS256';

    if (!secret) {
      console.error('EOB_JWT_SECRET is not configured');
      return null;
    }

    // JWT 검증
    const payload = jwt.verify(token, secret, {
      algorithms: [algorithm as jwt.Algorithm],
    }) as EOBJWTPayload;

    // 토큰 타입 확인
    if (payload.type !== 'jarvis') {
      console.warn('Invalid token type:', payload.type);
      return null;
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('Invalid token:', error.message);
    } else {
      console.error('Token verification error:', error);
    }
    return null;
  }
}

/**
 * Check if EOB JWT validation is enabled
 */
export function isEOBAuthEnabled(): boolean {
  return process.env.EOB_JWT_VALIDATION_ENABLED?.toLowerCase() === 'true';
}

/**
 * Return 401 Unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized: Invalid or missing token') {
  return NextResponse.json(
    { error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

/**
 * Middleware helper: Verify token from request
 * Returns payload if valid, or 401 response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ payload: EOBJWTPayload } | NextResponse> {
  // EOB 인증이 비활성화된 경우 통과
  if (!isEOBAuthEnabled()) {
    return {
      payload: {
        sub: 'dev-user',
        email: 'dev@example.com',
        role: 'ADMIN',
        type: 'jarvis',
        exp: Date.now() + 3600000,
      },
    };
  }

  const token = extractTokenFromRequest(request);

  if (!token) {
    return unauthorizedResponse('Token is required');
  }

  const payload = await verifyEOBToken(token);

  if (!payload) {
    return unauthorizedResponse('Invalid or expired token');
  }

  return { payload };
}
```

### 3.4 API 라우트에 인증 추가

**패턴**: 기존 `readonly.ts`와 동일한 방식으로 적용

#### 예시 1: GET 엔드포인트 (읽기)

**파일**: `/mnt/d/00.Dev/javis.gerald/src/javis-viewer/src/app/api/roadmap/visions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

export async function GET(request: NextRequest) {
  // 인증 확인
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult; // 401 Unauthorized
  }

  const { payload } = authResult;
  console.log('Authenticated user:', payload.email);

  // 기존 로직...
  const pool = getPool();
  const result = await pool.query('SELECT * FROM roadmap_visions ORDER BY created_at DESC');
  return NextResponse.json(result.rows);
}

export async function POST(request: NextRequest) {
  // 인증 확인
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult; // 401 Unauthorized
  }

  // Read-only 모드 확인
  if (isReadOnlyMode()) {
    return readOnlyResponse();
  }

  const { payload } = authResult;
  const body = await request.json();

  // 기존 로직...
}
```

#### 예시 2: 모든 API 라우트에 적용

**필수 수정 파일들** (약 30개):
- `/app/api/roadmap/visions/route.ts`
- `/app/api/roadmap/milestones/route.ts`
- `/app/api/roadmap/epics/route.ts`
- `/app/api/members/route.ts`
- `/app/api/members/[id]/route.ts`
- `/app/api/operations/route.ts`
- ... (모든 API 라우트)

**패턴**:
```typescript
// 1. Import 추가
import { requireAuth } from '@/lib/auth';

// 2. 각 HTTP 메서드 시작 부분에 추가
export async function GET/POST/PUT/DELETE(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { payload } = authResult;
  // ... 기존 로직
}
```

### 3.5 프론트엔드: 토큰 처리 (선택사항)

Jarvis는 Server-Side Rendering을 사용하므로, 토큰을 쿠키나 localStorage에 저장할 수 있습니다.

#### 옵션 A: 쿼리 파라미터에서 쿠키로 전환

**파일**: `/mnt/d/00.Dev/javis.gerald/src/javis-viewer/src/app/page.tsx` (메인 페이지)

```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function HomePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  // ?token=xxx가 있으면 쿠키에 저장하고 리다이렉트
  if (searchParams.token) {
    const cookieStore = await cookies();
    cookieStore.set('eob_token', searchParams.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10분 (EOB 토큰 만료 시간과 동일)
    });
    redirect('/dashboard');
  }

  // 기존 대시보드 로직...
}
```

#### 옵션 B: Client-side localStorage 저장

**파일**: `/mnt/d/00.Dev/javis.gerald/src/javis-viewer/src/app/layout.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function TokenHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('eob_token', token);
      // URL에서 token 제거 (보안)
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TokenHandler />
        <ReadOnlyProvider>
          {children}
        </ReadOnlyProvider>
      </body>
    </html>
  );
}
```

### 3.6 인증 Context 생성 (선택사항 - 고도화)

**파일**: `/mnt/d/00.Dev/javis.gerald/src/javis-viewer/src/contexts/AuthContext.tsx` (신규)

```typescript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { EOBJWTPayload } from '@/lib/auth';

interface AuthContextType {
  user: EOBJWTPayload | null;
  token: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EOBJWTPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('eob_token');
    if (storedToken) {
      setToken(storedToken);
      // 토큰 디코딩 (검증은 서버에서)
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        setUser(payload);
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('eob_token');
    setToken(null);
    setUser(null);
    window.location.href = '/'; // 또는 EOB 로그인 페이지
  };

  return (
    <AuthContext.Provider value={{ user, token, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 3.7 검증 체크리스트

Jarvis 구현 완료 후 확인할 사항:

- [ ] `npm install jsonwebtoken` 완료
- [ ] `.env`에 `EOB_JWT_SECRET` 추가 (EOB와 동일한 값)
- [ ] `/lib/auth.ts` 생성 및 검증 로직 구현
- [ ] 모든 API 라우트에 `requireAuth()` 추가
- [ ] 쿼리 파라미터 `?token=xxx` 처리 확인
- [ ] 토큰 만료 시 401 응답 확인
- [ ] 토큰 타입 `"jarvis"` 검증 확인
- [ ] EOB에서 Jarvis 링크 클릭 → 인증 성공 확인

## Security Considerations

### 1. Secret Key 분리
- **EOB SECRET_KEY**: EOB 내부 인증용 (Access/Refresh Token)
- **JARVIS_SECRET_KEY**: Jarvis 전용, 별도 관리
- 이유: 키 유출 시 피해 범위 최소화

### 2. 토큰 만료 시간
- 권장: 10분 (단발성 전달용)
- 사용자가 클릭 후 즉시 소비되는 짧은 수명

### 3. HTTPS 필수
- Production 환경에서는 HTTPS 사용 필수
- HTTP 환경에서는 토큰이 URL에 노출되어 보안 위험

### 4. Payload 최소화
- 필수 정보만 전달: user_id, email, role
- 민감한 정보 (password hash, 상세 권한 등) 제외

### 5. Rate Limiting (향후 고려)
- `/auth/jarvis-token` 엔드포인트에 rate limiting 적용
- 예: 사용자당 분당 5회 제한

## Testing & Verification

### Backend Testing

**1. 엔드포인트 수동 테스트 (curl)**

```bash
# 1. Login to get access token
curl -X POST "http://localhost:8004/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@edwards.com&password=password"

# 2. Get Jarvis token
curl -X GET "http://localhost:8004/api/auth/jarvis-token" \
  -H "Authorization: Bearer <access_token>"

# Expected Response:
# {
#   "jarvis_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "jarvis_url": "http://jarvis.10.182.252.32.sslip.io",
#   "expires_in": 600
# }
```

**2. JWT 디코딩 검증 (jwt.io)**

토큰을 jwt.io에 붙여넣어 payload 확인:
```json
{
  "sub": "user-uuid-here",
  "email": "admin@edwards.com",
  "role": "ADMIN",
  "type": "jarvis",
  "exp": 1234567890
}
```

### Frontend Testing

**시나리오**:
1. EOB 로그인 (http://localhost:3004)
2. Sidebar에서 "Integrations" 섹션 확인
3. "Jarvis AI Assistant" 클릭
4. 새 탭에서 Jarvis 열림 (URL: `http://jarvis.10.182.252.32.sslip.io?token=xxx`)
5. 로딩 없이 즉시 열림 확인

**에러 케이스**:
- 토큰 요청 실패 시 toast 에러 메시지 표시
- Network 에러 처리 확인

## Critical Files to Modify

### EOB Backend (5 files)

1. **`backend/.env.example`**
   - Jarvis 환경변수 3개 추가

2. **`backend/app/core/config.py`**
   - Settings 클래스에 JARVIS_* 필드 추가

3. **`backend/app/core/security.py`**
   - `create_jarvis_token()` 함수 추가

4. **`backend/app/schemas/auth.py`**
   - `JarvisTokenResponse` 스키마 추가

5. **`backend/app/api/endpoints/auth.py`**
   - `/auth/jarvis-token` GET 엔드포인트 추가
   - Import 추가

### EOB Frontend (3 files)

1. **`frontend/src/api/client.ts`**
   - `getJarvisToken()` API 함수 추가
   - `JarvisTokenResponse` 타입 정의

2. **`frontend/src/components/layout/Sidebar.tsx`**
   - Import 추가
   - Integrations 섹션 추가
   - `handleJarvisClick` 핸들러 추가
   - `renderNavItem` 수정

3. **`frontend/public/locales/{en,ko}/navigation.json`**
   - Jarvis 관련 번역 추가

### Jarvis (최소 4 files, 선택사항 +3 files)

#### 필수 수정 파일

1. **`.env`** (루트)
   - EOB JWT 환경변수 추가 (EOB_JWT_SECRET, EOB_JWT_VALIDATION_ENABLED)

2. **`src/javis-viewer/package.json`**
   - `jsonwebtoken` 또는 `jose` 라이브러리 추가

3. **`src/javis-viewer/src/lib/auth.ts`** (신규 생성)
   - JWT 검증 유틸리티 함수
   - `extractTokenFromRequest()`, `verifyEOBToken()`, `requireAuth()`

4. **`src/javis-viewer/src/app/api/*/route.ts`** (약 30개 파일)
   - 모든 API 라우트에 `requireAuth()` 추가
   - Import 추가

#### 선택사항 (고도화)

5. **`src/javis-viewer/src/contexts/AuthContext.tsx`** (신규)
   - 인증 상태 관리 Context

6. **`src/javis-viewer/src/app/layout.tsx`**
   - AuthContext Provider 추가
   - TokenHandler 추가

7. **`src/javis-viewer/src/app/page.tsx`**
   - 쿼리 파라미터 `?token=xxx` 처리
   - 쿠키 저장 또는 리다이렉트

## Deployment Steps

### 1. EOB Development Environment

```bash
# Backend
cd /mnt/d/00.Dev/7.myApplication/engineering.resource.management/backend
# .env에 Jarvis 환경변수 추가
source .venv/bin/activate
uvicorn app.main:app --reload --port 8004

# Frontend
cd /mnt/d/00.Dev/7.myApplication/engineering.resource.management/frontend
pnpm dev --port 3004
```

### 2. Jarvis Development Environment

```bash
# Jarvis
cd /mnt/d/00.Dev/javis.gerald/src/javis-viewer

# 1. 패키지 설치
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken

# 2. .env 파일 업데이트
echo "EOB_JWT_SECRET=jarvis-integration-secret-key-change-in-production" >> ../../.env
echo "EOB_JWT_VALIDATION_ENABLED=true" >> ../../.env

# 3. 개발 서버 실행
npm run dev
# Port 3009에서 실행됨
```

### 3. Production Environment

#### EOB Production 배포

```bash
cd /mnt/d/00.Dev/7.myApplication/engineering.resource.management

# 1. 환경변수 설정 (.env 업데이트)
JARVIS_URL=http://jarvis.10.182.252.32.sslip.io
JARVIS_SECRET_KEY=<strong-random-key>
JARVIS_TOKEN_EXPIRE_MINUTES=10

# 2. Docker 빌드 및 배포
./run.py all
```

#### Jarvis Production 배포

```bash
cd /mnt/d/00.Dev/javis.gerald

# 1. 환경변수 설정 (.env 또는 .env.local)
EOB_JWT_SECRET=<same-as-EOB-JARVIS_SECRET_KEY>
EOB_JWT_VALIDATION_ENABLED=true
NODE_ENV=production

# 2. 빌드
cd src/javis-viewer
npm run build

# 3. 배포 (Docker 또는 PM2)
npm run start
# 또는
docker build -t jarvis-viewer .
docker run -p 3009:3009 --env-file .env jarvis-viewer
```

### 4. 통합 테스트 및 검증

#### 단계 1: Secret Key 공유
1. EOB `.env`에서 `JARVIS_SECRET_KEY` 값 확인
2. Jarvis `.env`에 동일한 값을 `EOB_JWT_SECRET`으로 설정
3. **보안**: 키는 안전한 채널을 통해 공유 (Slack DM, 암호화된 메시지 등)

#### 단계 2: End-to-End 테스트
```bash
# 1. EOB 로그인
curl -X POST "http://localhost:8004/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@edwards.com&password=password"

# 2. Jarvis 토큰 발급
curl -X GET "http://localhost:8004/api/auth/jarvis-token" \
  -H "Authorization: Bearer <eob_access_token>"

# 3. Jarvis API 호출 (토큰 포함)
curl -X GET "http://localhost:3009/api/roadmap/visions?token=<jarvis_token>"

# 성공 시: 200 OK + 데이터 반환
# 실패 시: 401 Unauthorized
```

#### 단계 3: UI 플로우 테스트
1. EOB 로그인 (http://localhost:3004)
2. Sidebar → "Integrations" → "Jarvis AI Assistant" 클릭
3. 새 탭에서 Jarvis 열림 (http://localhost:3009?token=xxx)
4. Jarvis 대시보드 정상 로드 확인
5. Jarvis API 호출 성공 확인 (Network 탭)

### 5. 모니터링 및 로그

#### EOB 로그 확인
```bash
# Jarvis 토큰 발급 로그
tail -f backend/logs/app.log | grep "Generated Jarvis token"
```

#### Jarvis 로그 확인
```bash
# 인증 성공/실패 로그
cd /mnt/d/00.Dev/javis.gerald/src/javis-viewer
npm run dev 2>&1 | grep "Authenticated user"
```

### 6. 롤백 계획

#### EOB 롤백
```bash
# Git 이전 버전으로 복구
git checkout <previous-commit>
./run.py all
```

#### Jarvis 롤백
```bash
# 환경변수로 인증 비활성화
EOB_JWT_VALIDATION_ENABLED=false

# 또는 Git 복구
git checkout <previous-commit>
npm run build && npm run start
```

## Success Criteria

### EOB 구현 완료 기준:

1. ✅ **Backend 엔드포인트**: `/auth/jarvis-token` GET 요청 시 JWT 토큰 정상 반환
2. ✅ **JWT Payload**: 올바른 구조로 생성 (`sub`, `email`, `role`, `type`, `exp`)
3. ✅ **Frontend UI**: Sidebar에 "Integrations" 섹션 표시
4. ✅ **링크 동작**: "Jarvis AI Assistant" 클릭 시 새 탭에서 Jarvis 열림
5. ✅ **토큰 전달**: URL에 JWT 토큰 포함 (`?token=xxx`)
6. ✅ **에러 처리**: 토큰 요청 실패 시 toast 에러 메시지 표시
7. ✅ **환경변수**: `.env`에 `JARVIS_SECRET_KEY` 설정 완료

### Jarvis 구현 완료 기준:

1. ✅ **패키지 설치**: `jsonwebtoken` 라이브러리 설치 완료
2. ✅ **환경변수**: `.env`에 `EOB_JWT_SECRET` 설정 (EOB와 동일한 값)
3. ✅ **인증 유틸리티**: `/lib/auth.ts` 생성 및 검증 함수 구현
4. ✅ **API 보호**: 모든 API 라우트에 `requireAuth()` 추가
5. ✅ **토큰 검증**: 유효한 토큰으로 API 호출 시 200 OK
6. ✅ **토큰 없음**: 토큰 없이 API 호출 시 401 Unauthorized
7. ✅ **토큰 만료**: 만료된 토큰으로 API 호출 시 401 Unauthorized
8. ✅ **토큰 타입**: `type !== "jarvis"` 토큰 거부

### 통합 테스트 완료 기준:

1. ✅ **E2E 플로우**: EOB 로그인 → Jarvis 링크 클릭 → Jarvis 대시보드 로드
2. ✅ **API 호출**: Jarvis에서 API 호출 시 정상 동작 (401 없음)
3. ✅ **토큰 갱신**: 토큰 만료 후 EOB에서 재발급 → Jarvis 재접속 성공
4. ✅ **보안**: 잘못된 토큰으로 Jarvis 접근 시 401 응답
5. ✅ **로그**: EOB/Jarvis 양쪽 로그에서 인증 성공 확인

## Notes & Best Practices

### 보안

- **Secret Key 분리**: EOB와 Jarvis는 별도의 Secret Key를 사용하여 보안 격리
- **HTTPS 필수**: Production 환경에서는 HTTPS 사용 필수 (토큰 URL 노출 방지)
- **Token Reuse**: 현재 구현은 stateless (토큰 재사용 가능). 향후 일회용 토큰으로 고도화 가능 (Redis 블랙리스트 등)
- **Rate Limiting**: EOB `/auth/jarvis-token` 엔드포인트에 rate limiting 적용 권장

### 모니터링

- **토큰 발급 로그**: EOB에서 Jarvis 토큰 발급 시 로그 기록
- **인증 실패 로그**: Jarvis에서 401 응답 시 로그 기록
- **메트릭 수집**: Jarvis 토큰 발급 횟수, 인증 실패율 모니터링

### 유지보수

- **환경변수 관리**: Production에서는 `.env.local` 또는 환경변수로 관리
- **키 로테이션**: 정기적으로 `JARVIS_SECRET_KEY` 변경 (분기별 또는 반기별)
- **문서화**: Jarvis 개발팀에게 JWT 검증 가이드 문서 제공

### 향후 개선 사항

1. **SSO 통합**: EOB와 Jarvis가 공통 SSO 제공자 사용 시 JWT 중계 불필요
2. **Token Introspection**: Jarvis가 토큰 유효성을 EOB에 재확인하는 엔드포인트 추가
3. **Fine-grained Permissions**: 현재는 role만 전달, 향후 세밀한 권한 정보 추가 고려
4. **Audit Log**: Jarvis 접속 이력 DB 기록, 보안 감사 및 사용 통계 분석
5. **토큰 갱신**: Refresh token 메커니즘 추가 (현재는 10분 후 EOB에서 재발급 필요)

### CORS

- **불필요**: Jarvis가 EOB API를 직접 호출하지 않으므로 CORS 설정 불필요
- **단방향 흐름**: EOB → Jarvis 토큰 전달, Jarvis ← EOB API 호출 없음

### 개발 환경 vs Production

| 항목 | 개발 환경 | Production |
|------|----------|------------|
| **EOB_JWT_SECRET** | 테스트용 키 | 강력한 랜덤 키 (32+ chars) |
| **EOB_JWT_VALIDATION_ENABLED** | `false` (선택) | `true` (필수) |
| **HTTPS** | HTTP 허용 | HTTPS 필수 |
| **토큰 만료 시간** | 60분 (테스트용) | 10분 (권장) |
| **로그 레벨** | DEBUG | INFO/WARNING |

---

**문서 버전**: 1.0
**작성일**: 2026-02-10
**작성자**: Claude Code
**상태**: 구현 대기중
