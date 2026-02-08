# SSO (SAML 2.0) Integration & Troubleshooting Workthrough

**Date**: 2026-02-08  
**Status**: Completed  
**Goal**: Finalize Entra ID (Azure AD) SSO integration and ensure seamless login on the production server.

## Overview of Challenges & Solutions

### 1. Redirect URL Consistency (Local vs. Production)
*   **Issue**: The backend was hardcoded to redirect to a specific URL after SSO success, which didn't work for both local development (`localhost:3004`) and production.
*   **Solution**: Updated `auth.py` to use `settings.DEBUG` to switch the redirection target dynamically.

### 2. Environment Variables in Docker
*   **Issue**: `SAML_ENABLED=true` was set in `.env` but not reflected inside the `edwards-api` container.
*   **Solution**: Modified `docker-compose.yml` to include `env_file: .env` for the backend service, ensuring all SAML settings are passed to the application.

### 3. Azure AD Reply URL Mismatch (The /v1 trap)
*   **Issue**: Azure AD was configured with a Reply URL containing `/api/v1/...`, while the backend router was set to `/api/...`. This caused `AADSTS50011` error.
*   **Solution**: 
    *   Added a router alias in `app/main.py` to support both `/api/auth` and `/api/v1/auth`.
    *   Updated `SAML_ACS_URL` in `.env.remote` to match the Azure configuration.

### 4. Method Not Allowed (405) on Callback
*   **Issue 1 (Nginx)**: Host Nginx was intercepting API requests and failing to handle POST requests from Azure. 
    *   **Fix**: Added direct `/api` routing in the host Nginx to bypass the frontend container.
*   **Issue 2 (HTTP 307 vs 302)**: FastAPI's default `RedirectResponse` uses **307**, which preserves the **POST** method. When redirecting to the frontend's `index.html`, Nginx threw a 405 error because static files cannot receive POST requests.
    *   **Fix**: Explicitly set the status code to **302 Found** in `auth.py` to force a **GET** request to the frontend.

### 5. Case-Sensitivity in Email Matching
*   **Issue**: Azure AD sent emails like `May.Kwon@...`, but the database lookup was case-sensitive and failed to find users stored in lowercase.
*   **Solution**: Updated the user lookup logic in `auth.py` to use SQLAlchemy's `func.lower()` for both the column and the search term.

### 6. Database Integrity & Recovery
*   **Action**: To ensure a clean state for production, the remote database was backed up locally, recreated from scratch to fix password/sequence issues, and restored with 108k+ worklog records.

## Final Status
*   **SSO Login**: Fully functional for all assigned users.
*   **Seamless Transition**: Users already logged into Microsoft accounts enter the system automatically.
*   **Data Consistency**: Production data is fully restored and accessible.

## Files Modified
- `backend/app/main.py`: Added `/api/v1/auth` alias.
- `backend/app/api/endpoints/auth.py`: Fixed 302 redirect & case-insensitive matching.
- `backend/app/services/sso_service.py`: Improved request data extraction.
- `frontend/src/pages/LoginPage.tsx`: Fixed SSO button path construction.
- `frontend/nginx.conf`: Improved API proxying.
- `docker-compose.yml`: Added `env_file` mapping.
- `nginx_remote_proxy.conf`: Added direct API routing on the host.
- `.env.remote`: Updated with production-ready SAML & AI settings.
- `backup_remote_db.py`: Created for remote data maintenance.
