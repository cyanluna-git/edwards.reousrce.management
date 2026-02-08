# HTTPS Setup & SAML SSO Integration

## Goal
Enable secure HTTPS communication within the internal network using a self-signed certificate and prepare the backend and frontend for Entra ID (Azure AD) SAML 2.0 SSO integration.

## Background
- The application was previously served over HTTP (Port 80).
- User authentication relied solely on local email/password login.
- Enterprise requirement to support Single Sign-On (SSO) for internal users using company accounts.
- The server is located in an internal network (10.182.252.32) behind an Nginx reverse proxy.

## Changes

### 1. HTTPS Configuration (Nginx)

**Certificate Generation:**
Generated a 10-year self-signed certificate on the remote server:
- Path: `/etc/nginx/ssl/nginx-selfsigned.crt` & `.key`
- Subject: `CN=*.10.182.252.32.sslip.io`

**Nginx Config (`nginx_remote_proxy.conf`):**
- Added `listen 443 ssl` to all server blocks.
- Configured SSL certificate paths and basic security settings.
- Added a global HTTP → HTTPS redirect.
- Maintained WebSocket support for Coolify and Portainer.

### 2. SAML SSO Backend Integration

**Library:** Added `python3-saml` to `backend/requirements.txt`.

**New SSO Service (`backend/app/services/sso_service.py`):**
- Encapsulates OneLogin's SAML library logic.
- `get_saml_settings()`: Maps application settings to SAML SP/IdP configuration.
- `extract_user_attributes()`: Parses Entra ID claims (email, name) into a standard dictionary.

**Auth Endpoints (`backend/app/api/endpoints/auth.py`):**
- `GET /auth/sso/login`: Redirects user to IdP (Entra ID) login page.
- `POST /auth/sso/callback`: 
  - Validates SAML response from IdP.
  - Matches the returned email with an existing user in the database.
  - Issues JWT (access/refresh) tokens upon successful match.
  - Redirects back to the frontend with tokens in the URL.

**Configuration (`backend/app/core/config.py`):**
- Added `SAML_*` settings to the `Settings` class with default values matching the internal VM environment.

### 3. Frontend SSO Integration

**Login Page (`frontend/src/pages/LoginPage.tsx`):**
- Added a "Sign in with Microsoft SSO" button.
- Styled with the Microsoft logo and integrated into the existing login flow.
- Redirects to `VITE_API_URL/auth/sso/login`.

**Authentication Hook (`frontend/src/hooks/useAuth.tsx`):**
- Added a URL parameter check in `useEffect` to capture `token` and `refresh` parameters.
- If tokens are present (callback from SSO), they are stored in `localStorage`, and the user is automatically logged in.
- URL is cleaned up immediately after token extraction using `window.history.replaceState`.

### 4. Documentation Migration
Copied critical SSL and SSO documentation from the related `aibrain.bot` project to maintain operational consistency:
- `docs/SSL_QUICK_REFERENCE.md`: Operational guide for certificate management.
- `docs/SSO_CONFIGURATION_REQUEST.md`: Technical details for SSO administrators.
- `docs/SSO_EMAIL_TEMPLATE.txt`: Communication template for IT requests.

## Files Changed

| File | Changes |
|------|---------|
| `nginx_remote_proxy.conf` | Enabled SSL (443) and HTTP redirect |
| `backend/requirements.txt` | Added `python3-saml` |
| `backend/app/core/config.py` | Added SAML settings |
| `backend/app/services/sso_service.py` | NEW — SAML integration logic |
| `backend/app/api/endpoints/auth.py` | Added SSO login and callback endpoints |
| `frontend/src/pages/LoginPage.tsx` | Added SSO login button |
| `frontend/src/hooks/useAuth.tsx` | Added URL token parsing for SSO |
| `.env.example` | Added SSO configuration section |
| `docs/SSL_QUICK_REFERENCE.md` | Copied from aibrain.bot |
| `docs/SSO_CONFIGURATION_REQUEST.md` | Copied from aibrain.bot |
| `docs/SSO_EMAIL_TEMPLATE.txt` | Copied from aibrain.bot |

## Lessons Learned

1. **Nginx Directive Conflicts**: Some SSL directives (like `ssl_protocols`) might already be defined in the main `nginx.conf`. It's safer to keep the site-specific config minimal or ensure no duplicates to prevent restart failures.
2. **SAML and Ports**: When running behind a proxy, it's crucial to correctly pass the port and scheme (HTTPS) to the SAML library, otherwise, signature validation might fail due to URI mismatch.
3. **Frontend Token Capture**: Using URL parameters for the final redirect after SSO is a simple way to pass JWTs from backend to frontend without complex cookie/session sharing between different subdomains if needed.

## Next Steps

- [ ] Receive IdP Metadata/Certificate from IT Administrator.
- [ ] Update `.env.remote` with real IdP values.
- [ ] Set `SAML_ENABLED=True` and redeploy.
- [ ] Verify SSO login flow with a real company account.
