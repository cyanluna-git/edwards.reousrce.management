# SSO Troubleshooting & Final Deployment Plan (2026-02-07)

## Current Status (as of 2026-02-06 PM)
- **Backend**: SAML SSO logic implemented, `python3-saml` library installed.
- **Frontend**: SSO login button added, URL token parsing logic implemented.
- **Infrastructure**: HTTPS enabled on the remote server with a self-signed certificate.
- **SSO Config**: Metadata received from IT and applied to both remote `.env.remote` and local `.env`.
- **Issue**: Clicking the SSO button in the local environment results in an unexpected redirection (likely back to the landing page or to the remote server).

## Troubleshooting Steps for Tomorrow

### 1. Verify Backend Logs
Check the `uvicorn` terminal output when the SSO button is clicked:
- Look for `GET /api/v1/auth/sso/login`.
- If it returns `302`, it's generating the SAML request.
- Check if any `400` or `500` errors appear.

### 2. Validate Environment Variables
Confirm the backend is actually using the SSO settings:
- Add a temporary print or log in `app/api/endpoints/auth.py` to check `settings.SAML_ENABLED`.
- Ensure the local `.env` is being loaded correctly by `uvicorn` (check pathing).

### 3. Analyze the Redirection
Identify exactly where the browser is redirected:
- **Case A: Redirect to Microsoft**: This means the SP (our app) is working, but the IdP (Azure) might be redirecting back to the remote server's URL instead of localhost.
- **Case B: Immediate redirect to `/`**: This suggests `SAML_ENABLED` might be `False` or an exception is caught silently.

### 4. Port/Protocol Check
- Ensure `SAML_ENTITY_ID` and `SAML_ACS_URL` in `.env` match the protocol (HTTP vs HTTPS) and port (`8004`) used in the local environment.

## Final Deployment Steps
Once local verification is complete:
1.  **Full Build**: Run `python3 build_and_compress.py`.
2.  **Deploy**: Run `.un_full_deploy.ps1 -SkipBackup`.
3.  **Verify Remote**: Test the SSO flow on the actual server URL: `https://eob.10.182.252.32.sslip.io`.

## Reference Links
- [SSO Configuration Request](../docs/SSO_CONFIGURATION_REQUEST.md)
- [HTTPS & SSO Implementation Workthrough](./2026-02-06_https-and-sso-integration.md)
