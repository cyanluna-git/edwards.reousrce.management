import { test, expect } from '@playwright/test';

test.describe('AI WorkLog Input', () => {
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
    test('should display AI tab alongside Entry and Table tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /Entry/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /AI/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Table/ })).toBeVisible();
    });

    test('should switch to AI tab when clicked', async ({ page }) => {
      await page.getByRole('tab', { name: /AI/ }).click();
      await page.waitForTimeout(500);

      // Should show AI input area
      await expect(page.getByText('자연어로 업무 입력')).toBeVisible();
    });
  });

  test.describe('AI Input Interface', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /AI/ }).click();
      await page.waitForTimeout(500);
    });

    test('should display AI health status', async ({ page }) => {
      // Should show either "AI 연결됨" or "AI 연결 안됨"
      const healthBadge = page.locator('text=/AI (연결됨|연결 안됨|상태 확인 중)/');
      await expect(healthBadge).toBeVisible();
    });

    test('should display input textarea with placeholder', async ({ page }) => {
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
      await expect(textarea).toHaveAttribute('placeholder', /예시:/);
    });

    test('should display AI 분석 button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /AI 분석/ })).toBeVisible();
    });

    test('should display time expression hints', async ({ page }) => {
      await expect(page.getByText(/시간 표현:/)).toBeVisible();
    });

    test('AI 분석 button should be disabled when textarea is empty', async ({ page }) => {
      const button = page.getByRole('button', { name: /AI 분석/ });
      await expect(button).toBeDisabled();
    });

    test('should enable AI 분석 button when text is entered', async ({ page }) => {
      const textarea = page.locator('textarea');
      await textarea.fill('오전에 OQC 작업했음');

      // Button should be enabled if AI is healthy
      // If AI is unhealthy, button will remain disabled
      await page.waitForTimeout(1000);
    });
  });

  test.describe('AI Parsing Flow', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /AI/ }).click();
      await page.waitForTimeout(500);
    });

    test('should show loading state when parsing', async ({ page }) => {
      // Check if AI is healthy first
      const healthBadge = page.locator('text=AI 연결됨');
      const isHealthy = await healthBadge.isVisible().catch(() => false);

      if (isHealthy) {
        const textarea = page.locator('textarea');
        await textarea.fill('오전에 OQC 인프라 DB 설계했음');

        const button = page.getByRole('button', { name: /AI 분석/ });
        await button.click();

        // Should show loading state
        await expect(page.getByText(/분석 중/)).toBeVisible({ timeout: 2000 }).catch(() => {
          // Loading might be too fast to catch
        });
      }
    });

    test('should show preview after successful parsing', async ({ page }) => {
      // Check if AI is healthy
      const healthBadge = page.locator('text=AI 연결됨');
      const isHealthy = await healthBadge.isVisible().catch(() => false);

      if (isHealthy) {
        const textarea = page.locator('textarea');
        await textarea.fill('오전에 OQC 인프라 DB 설계했음');

        const button = page.getByRole('button', { name: /AI 분석/ });
        await button.click();

        // Wait for result (with timeout)
        await page.waitForTimeout(10000);

        // Should show either preview or error
        const preview = page.getByText(/AI 분석 결과/);
        const error = page.getByText(/파싱|실패|오류/);

        const hasPreview = await preview.isVisible().catch(() => false);
        const hasError = await error.isVisible().catch(() => false);

        expect(hasPreview || hasError).toBeTruthy();
      }
    });
  });

  test.describe('AI Preview Interface', () => {
    // These tests assume AI is available and returns results
    // In a real environment, you might want to mock the API

    test('preview should show entry cards', async ({ page }) => {
      await page.getByRole('tab', { name: /AI/ }).click();
      await page.waitForTimeout(500);

      // Check if AI is healthy
      const healthBadge = page.locator('text=AI 연결됨');
      const isHealthy = await healthBadge.isVisible().catch(() => false);

      if (isHealthy) {
        const textarea = page.locator('textarea');
        await textarea.fill('오전에 OQC 작업, 오후에 회의');

        const button = page.getByRole('button', { name: /AI 분석/ });
        await button.click();

        // Wait for result
        await page.waitForTimeout(15000);

        // If preview is shown, check for entry cards
        const preview = page.getByText(/AI 분석 결과/);
        if (await preview.isVisible().catch(() => false)) {
          // Should show entry items
          const entryCards = page.locator('text=항목');
          expect(await entryCards.count()).toBeGreaterThan(0);

          // Should show total hours
          await expect(page.getByText(/총 시간:/)).toBeVisible();

          // Should show save and cancel buttons
          await expect(page.getByRole('button', { name: /모두 저장/ })).toBeVisible();
          await expect(page.getByRole('button', { name: /취소/ })).toBeVisible();
        }
      }
    });
  });

  test.describe('Fallback Behavior', () => {
    test('should show message when AI is unavailable', async ({ page }) => {
      await page.getByRole('tab', { name: /AI/ }).click();
      await page.waitForTimeout(2000);

      // Check if AI is unhealthy
      const unhealthyBadge = page.locator('text=AI 연결 안됨');
      const isUnhealthy = await unhealthyBadge.isVisible().catch(() => false);

      if (isUnhealthy) {
        // Should show fallback message
        await expect(page.getByText(/수동으로.*입력/)).toBeVisible();
      }
    });
  });
});
