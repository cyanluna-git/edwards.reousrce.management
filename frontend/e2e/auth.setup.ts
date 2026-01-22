import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Go to login page
  await page.goto('/login');

  // Fill in credentials
  await page.fill('input[type="email"]', 'gerald.park@edwardsvacuum.com');
  await page.fill('input[type="password"]', 'password');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL('/', { timeout: 10000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
