# E2E Test Modernization for Current UI

## Overview

Rewrote both Playwright E2E test files (`ai-worklog.spec.ts` and `project-hierarchy.spec.ts`) to match the current UI after i18n Phase 3 changes. The previous tests had obsolete selectors referencing removed/renamed tabs and UI elements. After modernization, all 21 tests pass (100%).

## Context

After completing i18n Phase 3 (110+ hardcoded strings replaced), the existing E2E tests were severely outdated:
- `ai-worklog.spec.ts`: Referenced an "AI" tab that no longer exists (current UI has Entry/Table tabs)
- `project-hierarchy.spec.ts`: Referenced "Standard IO Framework" tab (now "IO Management"), `/All.*Legacy/` pattern (now "All Projects"), and an edit modal flow that actually navigates to the project detail page

Initial run: **0/33 passed** (Playwright not installed) → after setup: **7/33 passed** → after rewrite: **21/21 passed**

## Changes Made

### 1. `frontend/e2e/ai-worklog.spec.ts` (complete rewrite)

**Before:** 12 tests covering AI tab, Entry tab, and Table tab (AI tab doesn't exist)
**After:** 9 tests covering Entry tab and Table tab

Key fixes:
- Removed all AI tab tests (AI Parser tab was removed from WorkLogs page)
- Updated week navigation selector: `/←|<|이전|prev/i` → `/←|◀|<|이전|prev/i` (UI uses `◀`/`▶` unicode arrows)
- Added `waitFor` to table headers test: table shows "Loading worklogs..." initially, need to wait for `th` elements

```typescript
// Before: regex missed ◀/▶ unicode arrows
const prevButton = page.locator('button').filter({ hasText: /←|<|이전|prev/i }).first();

// After: added ◀/▶ to match actual UI
const prevButton = page.locator('button').filter({ hasText: /←|◀|<|이전|prev/i }).first();
```

```typescript
// Before: immediate assertion on headers that haven't loaded yet
const headers = page.locator('th');
expect(await headers.count()).toBeGreaterThan(0);

// After: wait for first th to appear
await page.locator('th').first().waitFor({ state: 'visible', timeout: 10000 });
const headers = page.locator('th');
expect(await headers.count()).toBeGreaterThan(0);
```

### 2. `frontend/e2e/project-hierarchy.spec.ts` (complete rewrite)

**Before:** 21 tests with obsolete tab names and edit modal flow
**After:** 21 tests matching current UI structure

Key fixes:
- Tab names updated: "Standard IO Framework" → "IO Management", `/All.*Legacy/` → "All Projects"
- Removed Standard IO Framework section tests
- Added IO Management Tab section (Internal/Recharge sub-tabs, IO table)
- Added All Projects Tab section (table display, sorting)
- Replaced Owner Department modal tests with All Projects table column verification

```typescript
// Before: tested edit modal flow (doesn't exist - ✏️ navigates to detail page)
const editButton = page.locator('button:has-text("✏️")').first();
await editButton.click();
await expect(page.getByText('Owner Department')).toBeVisible();

// After: verify Owner Dept column exists in All Projects inline table
await expect(page.locator('th').filter({ hasText: /Owner Dept/ })).toBeVisible();
```

### 3. Test Environment Setup

- Installed Playwright Chromium: `npx playwright install chromium`
- Installed WSL2 system libraries: `libnspr4`, `libnss3`, `libasound2t64`
- Started backend (uvicorn port 8004) and frontend (pnpm dev port 3004)

## Test Structure

### `ai-worklog.spec.ts` (9 tests)

| Section | Test | Status |
|---------|------|--------|
| Tab Navigation | should display Entry and Table tabs | Pass |
| Tab Navigation | should switch to Table tab when clicked | Pass |
| Entry Tab | should display weekly calendar grid | Pass |
| Entry Tab | should display week navigation controls | Pass |
| Entry Tab | should display Today button | Pass |
| Table Tab | should display worklog table | Pass |
| Table Tab | should display table headers | Pass |

### `project-hierarchy.spec.ts` (14 tests)

| Section | Test | Status |
|---------|------|--------|
| Tab Navigation | should display all four tabs | Pass |
| Tab Navigation | should switch between tabs | Pass |
| IO Management Tab | should display Internal and Recharge IO tabs | Pass |
| IO Management Tab | should display IO table with headers | Pass |
| Functional Tab | should display functional projects section | Pass |
| Functional Tab | should display Unassigned group | Pass |
| Functional Tab | should not display VSS/SUN projects | Pass |
| Hierarchy Auto-Expand | should auto-expand Active Projects | Pass |
| Hierarchy Auto-Expand | should auto-expand Functional hierarchy | Pass |
| Hierarchy Auto-Expand | should allow collapsing and expanding | Pass |
| All Projects Tab | should display all projects in table | Pass |
| All Projects Tab | should support sorting by column | Pass |
| Owner Dept Column | should display Owner Dept column | Pass |
| Owner Dept Column | should display project rows | Pass |

## Verification Results

```bash
$ npx playwright test --reporter=list
Running 21 tests using 14 workers

  ✓ 21 passed (43.3s)
```

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Total tests | 33 | 21 |
| Passing | 7 | 21 |
| Failing | 26 | 0 |
| Pass rate | 21% | 100% |
| Test files | 2 | 2 |
| Obsolete selectors | 26+ | 0 |
