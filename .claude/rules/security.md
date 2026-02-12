# Security & Environment Variables

> **Created**: 2026-02-12 (Thu) 00:35 UTC

## Environment Variables

### Setup

1. **Copy example file:**
   ```bash
   cp .env.example .env
   cp .env.remote.example .env.remote  # For production
   ```

2. **Never commit .env files** (already in .gitignore)

3. **Keep .env.example updated** for new developers

### Database

```bash
DATABASE_URL=postgresql://user:password@localhost:5434/dbname
POSTGRES_USER=dbuser
POSTGRES_PASSWORD=securepassword
POSTGRES_DB=edwards_db
DB_PORT=5434
```

### Security

```bash
SECRET_KEY=your-secret-key-min-32-chars-random
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
REGISTRATION_TOKEN_EXPIRE_HOURS=24
```

**Generate SECRET_KEY:**
```python
import secrets
print(secrets.token_urlsafe(32))
```

### API Keys (AI Providers)

```bash
# Groq (Llama 3.3)
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key

# Google Gemini (2.0 Flash)
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key

# PCAS (Internal)
AI_PROVIDER=pcas
```

### SSO / SAML 2.0

```bash
SAML_ENABLED=true
SAML_ENTITY_ID=https://your-domain.com/metadata
SAML_IDP_SSO_URL=https://login.microsoftonline.com/tenant-id/saml2
SAML_IDP_X509_CERT=-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----
SAML_ACS_URL=https://your-domain.com/auth/saml/acs
```

### Service Ports

```bash
BACKEND_PORT=8004
FRONTEND_PORT=3004
DB_PORT=5434
```

## Authentication Flow

### JWT Tokens

**Access Token:**
- Lifetime: 30 minutes
- Used in `Authorization: Bearer {token}` header
- Short-lived for security

**Refresh Token:**
- Lifetime: 7 days
- Stored in HTTP-only cookie
- Used to obtain new access token
- Long-lived to reduce login frequency

**Registration Token:**
- Lifetime: 24 hours
- For email verification link
- One-time use

### Frontend Token Management

```typescript
// src/hooks/useAuth.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(() => 
    localStorage.getItem('refreshToken')
  );

  // Auto-refresh on 401
  client.interceptors.response.use(
    response => response,
    async error => {
      if (error.response?.status === 401) {
        const newAccessToken = await refreshAccessToken(refreshToken);
        setToken(newAccessToken);
        localStorage.setItem('token', newAccessToken);
        // Retry original request
      }
      return Promise.reject(error);
    }
  );

  return (
    <AuthContext.Provider value={{ token, refreshToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Backend Token Validation

```python
# app/core/security.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
import jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthCredentials = Depends(security)
) -> str:
    """Extract and validate JWT token."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

## Role-Based Access Control (RBAC)

### Roles

| Role | Description | Can Write |
|------|-------------|----------|
| ADMIN | Full system access | Yes |
| PM | Project Manager | Yes |
| FM | Financial Manager | Yes |
| USER | Standard user | Yes |
| GUEST | Guest access | No |
| VIEWER | Read-only viewer | No |

### Authorization

```python
from app.core.security import require_role, require_write_permission

# Require specific roles
@router.post("/")
async def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_role(["ADMIN"]))
):
    service = UserService(db)
    return service.create(**data.dict())

# Require write permission (blocks GUEST/VIEWER)
@router.put("/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_write_permission())
):
    service = UserService(db)
    return service.update(user_id, **data.dict(exclude_unset=True))
```

## Password Hashing

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

## Secrets in Code

**NEVER commit secrets.** If exposed:

1. Immediately rotate the secret
2. Update all systems using it
3. Review Git history for accidental commits
4. Use Git hooks to prevent future leaks:
   ```bash
   pip install detect-secrets
   detect-secrets scan --baseline .secrets.baseline
   ```

## CORS Configuration

```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # ["http://localhost:3004"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
