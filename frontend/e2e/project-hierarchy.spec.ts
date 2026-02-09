import { test, expect } from '@playwright/test';

test.describe('Project Hierarchy Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'gerald.park@edwardsvacuum.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });

    // Navigate to projects page
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Tab Navigation', () => {
    test('should display all four tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: 'Active Projects' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Functional' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'All Projects' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'IO Management' })).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      // Click Functional tab
      await page.getByRole('tab', { name: 'Functional' }).click();
      await expect(page.getByText('Functional Projects')).toBeVisible();

      // Click All Projects tab
      await page.getByRole('tab', { name: 'All Projects' }).click();
      await page.waitForTimeout(500);
      await expect(page.getByRole('table')).toBeVisible();

      // Click IO Management tab
      await page.getByRole('tab', { name: 'IO Management' }).click();
      await page.waitForTimeout(500);
    });
  });

  test.describe('IO Management Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'IO Management' }).click();
      await page.waitForTimeout(500);
    });

    test('should display Internal and Recharge IO tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /Internal/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Recharge/ })).toBeVisible();
    });

    test('should display IO table with headers', async ({ page }) => {
      // Should show a table with IO data
      await expect(page.getByRole('table')).toBeVisible();
    });
  });

  test.describe('Functional Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Functional' }).click();
      await page.waitForTimeout(500);
    });

    test('should display functional projects section', async ({ page }) => {
      await expect(page.getByText('Functional Projects (Department > Project)')).toBeVisible();
    });

    test('should display Unassigned group for projects without department', async ({ page }) => {
      // Check for Unassigned group
      await expect(page.getByText('Unassigned (No Department)')).toBeVisible();
    });

    test('should not display VSS/SUN projects in Functional tab', async ({ page }) => {
      // VSS/SUN projects should be excluded from Functional tab
      const vssProject = page.locator('text=VSS011');
      await expect(vssProject).not.toBeVisible();

      const sunProject = page.locator('text=SUN001');
      await expect(sunProject).not.toBeVisible();
    });
  });

  test.describe('Hierarchy Auto-Expand', () => {
    test('should auto-expand Active Projects hierarchy on load', async ({ page }) => {
      // Active Projects tab should be default
      await expect(page.getByRole('tab', { name: 'Active Projects' })).toHaveAttribute('data-state', 'active');

      // Check that folders are expanded (showing 📂 not 📁)
      const expandedFolders = page.locator('text=📂');
      expect(await expandedFolders.count()).toBeGreaterThan(0);
    });

    test('should auto-expand Functional hierarchy when tab is selected', async ({ page }) => {
      await page.getByRole('tab', { name: 'Functional' }).click();
      await page.waitForTimeout(500);

      // Department groups should be expanded
      const expandedFolders = page.locator('text=📂');
      expect(await expandedFolders.count()).toBeGreaterThan(0);
    });

    test('should allow collapsing and expanding items', async ({ page }) => {
      // Find an expanded item and click to collapse
      const expandedFolder = page.locator('text=📂').first();
      await expandedFolder.click();

      // After click, it should show collapsed icon
      await page.waitForTimeout(200);
      const collapsedFolders = page.locator('text=📁');
      expect(await collapsedFolders.count()).toBeGreaterThan(0);
    });
  });

  test.describe('All Projects Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'All Projects' }).click();
      await page.waitForTimeout(500);
    });

    test('should display all projects in table', async ({ page }) => {
      await expect(page.getByRole('table')).toBeVisible();
      const tableRows = page.locator('tbody tr');
      expect(await tableRows.count()).toBeGreaterThan(0);
    });

    test('should support sorting by column', async ({ page }) => {
      // Click on a header to sort
      const header = page.locator('th').first();
      await header.click();
      await page.waitForTimeout(200);

      // Table should still be visible after sorting
      await expect(page.getByRole('table')).toBeVisible();
    });
  });
});

test.describe('All Projects Table - Owner Department Column', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'gerald.park@edwardsvacuum.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });

    // Navigate to projects > All Projects tab
    await page.goto('/projects');
    await page.getByRole('tab', { name: 'All Projects' }).click();
    await page.waitForTimeout(500);
  });

  test('should display Owner Dept column in All Projects table', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible();
    // The inline table has an "Owner Dept" column header
    await expect(page.locator('th').filter({ hasText: /Owner Dept/ })).toBeVisible();
  });

  test('should display project rows in All Projects table', async ({ page }) => {
    const tableRows = page.locator('tbody tr');
    expect(await tableRows.count()).toBeGreaterThan(0);
  });
});
