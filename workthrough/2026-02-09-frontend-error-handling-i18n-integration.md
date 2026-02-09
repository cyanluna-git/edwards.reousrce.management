# Frontend Error Handling i18n Integration (Phase 2.5)

## Overview

Integrated the backend's standardized error codes (`{ code: "ERROR_CODE", message: "..." }`) with the frontend's i18n system. Created a `useApiError` custom hook and replaced 20+ hardcoded English error strings across 8 components with localized, code-based error messages. This bridges the gap between Phase 2's error code standardization and actual frontend usage.

## Context

- Phase 2 standardized 126 backend errors to `{ code: "ERROR_CODE", message: "..." }` format
- Phase 2 also added `getApiError()` utility and `errors.json` locale files with 50 error code mappings
- **Problem**: `getApiError()` was exported but used by 0 components
- 11+ locations used `error.response?.data?.detail || 'hardcoded English string'` pattern
- Backend error codes were displayed raw without i18n translation

## Changes Made

### 1. New File: `useApiError` Custom Hook

**File: `frontend/src/hooks/useApiError.ts`**

A one-line helper hook combining `getApiError()` + `t('errors:code.XXX')`:

```typescript
// frontend/src/hooks/useApiError.ts
import { useTranslation } from 'react-i18next';
import { getApiError } from '@/api/client';

export function useApiError() {
  const { t } = useTranslation('errors');

  return (error: unknown): string => {
    const apiError = getApiError(error);
    return t(`code.${apiError.code}`, { defaultValue: apiError.message });
  };
}
```

**Usage pattern** (consistent across all modified files):
```typescript
const getErrorMessage = useApiError();

// In mutation onError:
onError: (error: unknown) => {
    setModalError(getErrorMessage(error));
}

// In catch block:
catch (error: unknown) {
    alert(getErrorMessage(error));
}
```

### 2. TeamsTab.tsx — 9 Error Handlers

**File: `frontend/src/components/organization/TeamsTab.tsx`**

Replaced all 9 `onError` callbacks across Division/Department/SubTeam CRUD mutations:

| Mutation | Before | After |
|----------|--------|-------|
| `createL0` | `error.response?.data?.detail \|\| 'Failed to create Division'` | `getErrorMessage(error)` |
| `updateL0` | `error.response?.data?.detail \|\| 'Failed to update Division'` | `getErrorMessage(error)` |
| `deleteL0` | `error.response?.data?.detail \|\| t('teams.deleteFailed')` | `getErrorMessage(error)` |
| `createL1` | `error.response?.data?.detail \|\| 'Failed to create Department'` | `getErrorMessage(error)` |
| `updateL1` | `error.response?.data?.detail \|\| 'Failed to update Department'` | `getErrorMessage(error)` |
| `deleteL1` | `error.response?.data?.detail \|\| t('teams.deleteFailed')` | `getErrorMessage(error)` |
| `createL2` | `error.response?.data?.detail \|\| 'Failed to create SubTeam'` | `getErrorMessage(error)` |
| `updateL2` | `error.response?.data?.detail \|\| 'Failed to update SubTeam'` | `getErrorMessage(error)` |
| `deleteL2` | `error.response?.data?.detail \|\| t('teams.deleteFailed')` | `getErrorMessage(error)` |

Also improved type safety: `error: any` → `error: unknown`.

### 3. ProjectHierarchyEditor.tsx — 1 Error Handler

**File: `frontend/src/components/projects/ProjectHierarchyEditor.tsx`**

- Added `useApiError` import and initialization
- `deleteBuMutation.onError`: `error.response?.data?.detail || 'Failed to delete Business Unit'` → `getErrorMessage(error)`

### 4. IOManagementTab.tsx — 2 Error Handlers

**File: `frontend/src/components/projects/IOManagementTab.tsx`**

- Added `useApiError` import and initialization
- `deleteInternalMutation.onError`: `'Failed to delete Internal IO'` → `getErrorMessage(error)`
- `deleteRechargeMutation.onError`: `'Failed to delete Recharge IO'` → `getErrorMessage(error)`

### 5. useInlineProjectEdit.ts — 1 Catch Block

**File: `frontend/src/hooks/useInlineProjectEdit.ts`**

- Added `useApiError` import and initialization
- `saveEdit` catch block: `'Failed to save changes. Please try again.'` → `getErrorMessage(error)`
- Added `getErrorMessage` to `useCallback` dependency array

### 6. WorklogDrilldownModal.tsx — 3 Hardcoded Strings

**File: `frontend/src/components/resource-matrix/WorklogDrilldownModal.tsx`**

- Added `useTranslation` import and initialization
- `Loading worklogs...` → `{t('common:status.loading')}`
- `Failed to load details. Please try again.` → `{t('errors:code.SERVER_INTERNAL_ERROR', { defaultValue: 'Failed to load details.' })}`
- `No worklogs found for this selection.` → `{t('worklogs:noData', { defaultValue: 'No worklogs found for this selection.' })}`

### 7. WorkLogsPage.tsx — 3 Alert Patterns

**File: `frontend/src/pages/WorkLogsPage.tsx`**

- Added `useApiError` import and initialization
- `handleModalSubmit` catch: `error?.response?.data?.detail || t('errors.generic')` → `getErrorMessage(error)`
- `handleCopyWeek` catch: `error?.response?.data?.detail || t('errors.copyFailed')` → `getErrorMessage(error)`
- `handleLeaveSubmit` catch: `error?.response?.data?.detail || t('errors.leaveFailed')` → `getErrorMessage(error)`
- All `error: any` → `error: unknown`

### 8. ProfilePage.tsx — 1 Catch Block

**File: `frontend/src/pages/ProfilePage.tsx`**

- Added `useApiError` import and initialization
- `handlePasswordChange` catch: `error.response?.data?.detail || t('errors.passwordChangeFailed')` → `getErrorMessage(error)`
- `error: any` → `error: unknown`

### 9. LoginPage.tsx — Error Handling Simplification

**File: `frontend/src/pages/LoginPage.tsx`**

Before (complex status-based switch):
```typescript
catch (err: any) {
  if (err.response) {
    const detail = err.response?.data?.detail;
    if (err.response.status === 401) {
      setError(t('errors.invalidCredentials'));
    } else if (err.response.status === 422) {
      setError(t('errors.invalidDataFormat'));
    } else if (typeof detail === 'string') {
      setError(detail);
    } else {
      setError(t('errors.serverError', { status: err.response.status }));
    }
  } else {
    setError(t('errors.loginFailed'));
  }
}
```

After (simplified with error code lookup):
```typescript
catch (err: unknown) {
  if (axios.isAxiosError(err) && err.response) {
    setError(getErrorMessage(err));
  } else {
    setError(t('errors.loginFailed'));
  }
}
```

The backend now sends `AUTH_INVALID_CREDENTIALS`, `AUTH_INACTIVE_USER`, etc. which map to `errors:code.AUTH_INVALID_CREDENTIALS` in the locale files — no need for status code switching.

## Verification Results

### TypeScript Check
```bash
$ cd frontend && npx tsc --noEmit
# (no output — clean pass)
```

### Production Build
```bash
$ npx vite build
✓ 2961 modules transformed
✓ built in 1m 36s
```

### Hardcoded Error String Verification
```bash
$ grep -r '"Failed to' frontend/src/ --include="*.tsx" --include="*.ts"
# 0 results — all hardcoded "Failed to" strings eliminated
```

### useApiError Usage Verification
```
useApiError imported in 8 files:
- hooks/useApiError.ts (definition)
- components/organization/TeamsTab.tsx
- components/projects/ProjectHierarchyEditor.tsx
- components/projects/IOManagementTab.tsx
- hooks/useInlineProjectEdit.ts
- pages/WorkLogsPage.tsx
- pages/ProfilePage.tsx
- pages/LoginPage.tsx
```

### Remaining `detail` References (Out of Scope)
3 files still use `error.response?.data?.detail` pattern but were not in Phase 2.5 scope:
- `pages/RegisterPage.tsx`
- `components/resource-plans/TbdAssignmentModal.tsx`
- `components/worklogs/AIWorklogPreview.tsx`

## Error Flow Architecture

```
Backend Error                    Frontend Hook                    UI Display
─────────────────────────────────────────────────────────────────────────
{ code: "DEPENDENCY_HAS_USERS",  getApiError() extracts code →   useApiError() looks up
  message: "Cannot delete..." }  { code, message }               t('errors:code.DEPENDENCY_HAS_USERS')
                                                                  → "사용자가 연결되어 있어 삭제할 수 없습니다." (ko)
                                                                  → "Cannot delete: users are associated with this item." (en)
```

## File Summary

| Action | File | Changes |
|--------|------|---------|
| New | `frontend/src/hooks/useApiError.ts` | useApiError hook |
| Modify | `frontend/src/components/organization/TeamsTab.tsx` | 9 onError → getErrorMessage |
| Modify | `frontend/src/components/projects/ProjectHierarchyEditor.tsx` | 1 onError → getErrorMessage |
| Modify | `frontend/src/components/projects/IOManagementTab.tsx` | 2 onError → getErrorMessage |
| Modify | `frontend/src/hooks/useInlineProjectEdit.ts` | 1 catch → getErrorMessage |
| Modify | `frontend/src/components/resource-matrix/WorklogDrilldownModal.tsx` | 3 strings → t() |
| Modify | `frontend/src/pages/WorkLogsPage.tsx` | 3 alert → getErrorMessage |
| Modify | `frontend/src/pages/ProfilePage.tsx` | 1 catch → getErrorMessage |
| Modify | `frontend/src/pages/LoginPage.tsx` | simplify error handling |
| New | `workthrough/2026-02-09-frontend-error-handling-i18n-integration.md` | this document |
| **Total** | **10 files** | **20+ error handler changes** |

## Next Steps

Potential Phase 3 follow-ups:
- Migrate remaining 3 `detail` references (`RegisterPage`, `TbdAssignmentModal`, `AIWorklogPreview`)
- Add error boundary component with i18n support
- Add toast notification system using `useApiError` for non-blocking error display
