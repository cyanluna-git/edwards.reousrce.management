# Entra ID SSO Configuration Request

**Date**: February 6, 2026  
**Application**: Edwards PCAS Engineering Management Platform  
**Requestor**: Gerald Park (gerald.park@edwardsvacuum.com)

---

## Application Information

```
Application Name: Edwards PCAS Engineering Management Platform
Application URL: https://eob.10.182.252.32.sslip.io
Environment: Production
VM: VTISAZUAPP218 (10.182.252.32)
```

---

## SAML 2.0 Configuration

### Required Settings

```
1. Identifier (Entity ID):
   https://eob.10.182.252.32.sslip.io

2. Reply URL (Assertion Consumer Service URL):
   https://eob.10.182.252.32.sslip.io/api/v1/auth/sso/callback

3. Sign-on URL (Optional):
   https://eob.10.182.252.32.sslip.io

4. Logout URL (Optional):
   https://eob.10.182.252.32.sslip.io/api/v1/auth/logout
```

### Protocol Details

```
Protocol: SAML 2.0
NameID Format: EmailAddress (preferred) or Persistent
Binding: HTTP-POST
```

---

## User Attributes Mapping

Please configure the following SAML attribute mappings:

| SAML Attribute | User Property | Required |
|----------------|---------------|----------|
| `email` | user.mail | Yes |
| `name` | user.displayname | Yes |
| `givenname` | user.givenname | Optional |
| `surname` | user.surname | Optional |
| `groups` | user.groups | Optional |

---

## Access Control

```
User Access: [Please specify allowed users/groups]
Options:
  - All company users
  - Specific AD group: [Group name]
  - Specific users only
```

---

## Required Information from SSO Administrator

After completing the Entra ID configuration, please provide:

1. **Azure AD Identifier (Issuer URL)**
   - Example: `https://sts.windows.net/{tenant-id}/`

2. **Login URL (SAML SSO Endpoint)**
   - Example: `https://login.microsoftonline.com/{tenant-id}/saml2`

3. **Logout URL (Optional)**
   - Example: `https://login.microsoftonline.com/{tenant-id}/saml2`

4. **X.509 Certificate**
   - Base64 encoded certificate for SAML response verification
   - Or: Certificate download URL from Azure Portal

---

## Testing Plan

After configuration:
1. Test SSO login with test user
2. Verify user attributes are correctly mapped
3. Test logout functionality
4. Confirm access control rules

---

## Contact Information

**Technical Contact:**
- Name: Gerald Park
- Email: gerald.park@edwardsvacuum.com
- VM: VTISAZUAPP218

**Application Details:**
- Resource Group: rg-p-app-10010689
- Subscription: vt-hybrid-production-01
- Location: West Europe

---

## Notes

- The application is currently using a self-signed SSL certificate
- SSO is being configured for internal company use
- Application backend API is running on port 8004 (Docker container)
- Frontend application is accessible via HTTPS on port 443

---

**Status**: Awaiting SSO Configuration  
**Priority**: Normal  
**Expected Completion**: [Please provide timeline]
