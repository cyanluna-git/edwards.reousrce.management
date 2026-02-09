import { test, expect } from '@playwright/test';

test.describe('WorkLog Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'gerald.park@edwardsvacuum.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });

    // Navigate to worklogs page
    await page.goto('/worklogs');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Tab Navigation', () => {
    test('should display Entry and Table tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /Entry/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Table/ })).toBeVisible();
    });

    test('should switch to Table tab when clicked', async ({ page }) => {
      await page.getByRole('tab', { name: /Table/ }).click();
      await page.waitForTimeout(500);

      // Should show table view
      await expect(page.getByRole('table')).toBeVisible();
    });
  });

  test.describe('Entry Tab', () => {
    test('should display weekly calendar grid', async ({ page }) => {
      // Entry tab should be default
      await expect(page.getByRole('tab', { name: /Entry/ })).toHaveAttribute('data-state', 'active');

      // Should show week navigation
      await expect(page.getByText(/Week Total/)).toBeVisible();
    });

    test('should display week navigation controls', async ({ page }) => {
      // Should have previous/next week buttons (◀/▶ unicode arrows)
      const prevButton = page.locator('button').filter({ hasText: /←|◀|<|이전|prev/i }).first();
      const nextButton = page.locator('button').filter({ hasText: /→|▶|>|다음|next/i }).first();

      // At least one navigation mechanism should exist
      const hasPrev = await prevButton.isVisible().catch(() => false);
      const hasNext = await nextButton.isVisible().catch(() => false);
      expect(hasPrev || hasNext).toBeTruthy();
    });

    test('should display Today button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Today|오늘/ })).toBeVisible();
    });
  });

  test.describe('Table Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /Table/ }).click();
      await page.waitForTimeout(500);
    });

    test('should display worklog table', async ({ page }) => {
      await expect(page.getByRole('table')).toBeVisible();
    });

    test('should display table headers', async ({ page }) => {
      // Wait for table to finish loading (may show "Loading worklogs..." initially)
      await page.locator('th').first().waitFor({ state: 'visible', timeout: 10000 });
      const headers = page.locator('th');
      expect(await headers.count()).toBeGreaterThan(0);
    });
  });
});
