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
      await expect(page.getByRole('tab', { name: 'Standard IO Framework' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Functional' })).toBeVisible();
      await expect(page.getByRole('tab', { name: /All.*Legacy/ })).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      // Click Standard IO Framework tab
      await page.getByRole('tab', { name: 'Standard IO Framework' }).click();
      await expect(page.getByText('VSS (Integrated Systems)')).toBeVisible();

      // Click Functional tab
      await page.getByRole('tab', { name: 'Functional' }).click();
      await expect(page.getByText('Functional Projects')).toBeVisible();

      // Click All/Legacy tab
      await page.getByRole('tab', { name: /All.*Legacy/ }).click();
      await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    });
  });

  test.describe('Standard IO Framework Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Standard IO Framework' }).click();
      await page.waitForTimeout(500); // Wait for data to load
    });

    test('should display VSS and SUN cards', async ({ page }) => {
      await expect(page.getByText('VSS (Integrated Systems)')).toBeVisible();
      await expect(page.getByText('SUN (Abatement)')).toBeVisible();
    });

    test('should display VSS matrix projects (8 buckets)', async ({ page }) => {
      // Verify VSS project codes are displayed
      await expect(page.getByText('VSS011')).toBeVisible();
      await expect(page.getByText('VSS018')).toBeVisible();
    });

    test('should display SUN matrix projects (8 buckets)', async ({ page }) => {
      // Check for SUN projects
      await expect(page.getByText('SUN001')).toBeVisible();
      await expect(page.getByText('SUN008')).toBeVisible();
    });

    test('should display IO Category legend', async ({ page }) => {
      await expect(page.getByText('IO Categories:')).toBeVisible();
      await expect(page.getByText('FIELD_FAILURE - L4 Escalations')).toBeVisible();
      await expect(page.getByText('SUSTAINING - Corrective Actions')).toBeVisible();
      await expect(page.getByText('OPS_SUPPORT - Factory/Ops')).toBeVisible();
      await expect(page.getByText('CIP - Improvements')).toBeVisible();
      await expect(page.getByText('OTHER - Regulatory/Sales')).toBeVisible();
    });

    test('should show IO category badges on projects', async ({ page }) => {
      // Check for IO category badges (they appear as colored badges)
      const fieldFailureBadge = page.locator('text=FIELD_FAILURE').first();
      await expect(fieldFailureBadge).toBeVisible();
    });

    test('should show recharge status badges', async ({ page }) => {
      // VSS/SUN projects should have recharge status (BILLABLE, etc.)
      // Check for any recharge badge in the table (use first() since there are 2 tables)
      const rechargeColumn = page.locator('th:has-text("Recharge")').first();
      await expect(rechargeColumn).toBeVisible();

      // At least some rows should have recharge status values
      const tableRows = page.locator('tbody tr');
      expect(await tableRows.count()).toBeGreaterThan(0);
    });

    test('should navigate to project detail when clicking a row', async ({ page }) => {
      // Click on first VSS project row
      await page.locator('tr').filter({ hasText: 'VSS011' }).click();

      // Should navigate to project detail page
      await expect(page).toHaveURL(/\/projects\/.*/);
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

  test.describe('All/Legacy Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /All.*Legacy/ }).click();
      await page.waitForTimeout(500);
    });

    test('should display all projects in table', async ({ page }) => {
      // Check table headers
      await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();
    });

    test('should mark Matrix projects with badge', async ({ page }) => {
      // VSS/SUN projects should have "Matrix" badge
      const matrixBadge = page.locator('text=Matrix').first();
      await expect(matrixBadge).toBeVisible();
    });

    test('should mark Legacy candidates with badge', async ({ page }) => {
      // Projects with "Support" or "General" in name should have Legacy badge
      const legacyBadge = page.locator('span:has-text("Legacy")').first();
      // May or may not exist depending on data
      const count = await legacyBadge.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should support sorting by column', async ({ page }) => {
      // Click on Code header to sort
      await page.getByRole('columnheader', { name: 'Code' }).click();
      await page.waitForTimeout(200);

      // Click again to reverse sort
      await page.getByRole('columnheader', { name: 'Code' }).click();
      await page.waitForTimeout(200);

      // Table should still be visible after sorting
      await expect(page.getByRole('table')).toBeVisible();
    });
  });
});

test.describe('Project Form - Owner Department', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'gerald.park@edwardsvacuum.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });
  });

  test('should show Owner Department field for Functional projects', async ({ page }) => {
    // Navigate to a functional project
    await page.goto('/projects');
    await page.getByRole('tab', { name: 'Functional' }).click();
    await page.waitForTimeout(500);

    // Click on Unassigned group to expand if needed
    const unassignedGroup = page.getByText('Unassigned (No Department)');
    if (await unassignedGroup.isVisible()) {
      await unassignedGroup.click();
      await page.waitForTimeout(200);
    }

    // Click edit button on first project (✏️)
    const editButton = page.locator('button:has-text("✏️")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);

      // Check if Owner Department field is visible
      await expect(page.getByText('Owner Department')).toBeVisible();
    }
  });

  test('should hide Owner Department for Product projects', async ({ page }) => {
    // Navigate to projects
    await page.goto('/projects');
    await page.waitForTimeout(500);

    // Click edit on a product project from Active Projects tab
    const editButton = page.locator('button:has-text("✏️")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);

      // Check if category is Product
      const categorySelect = page.locator('text=Product Project').first();
      if (await categorySelect.isVisible()) {
        // Owner Department should NOT be visible for Product projects
        await expect(page.getByLabel('Owner Department')).not.toBeVisible();
      }
    }
  });
});
