const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'playwright'));

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const BASE_URL = 'http://localhost:3004';

const pages = [
  { url: '/dashboard', filename: 'dashboard.png' },
  { url: '/worklogs', filename: 'worklogs.png' },
  { url: '/resource-matrix', filename: 'resource-matrix.png' },
  { url: '/projects', filename: 'projects.png' },
  { url: '/resource-plans', filename: 'resource-plans.png' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  // Fill login form using the exact IDs from LoginPage.tsx
  await page.fill('#email', 'admin@edwards.com');
  await page.fill('#password', 'password');
  await page.click('button[type="submit"]');

  // Wait for navigation after login - the app may redirect to / or /dashboard
  await page.waitForTimeout(5000);

  // Check if we're logged in by seeing if we got redirected away from /login
  const currentUrl = page.url();
  console.log(`Current URL after login: ${currentUrl}`);

  if (currentUrl.includes('/login')) {
    console.error('Login failed - still on login page');
    await browser.close();
    process.exit(1);
  }

  console.log('Login successful!');

  // Capture each page
  for (const { url, filename } of pages) {
    console.log(`Capturing ${url} -> ${filename}`);
    await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000); // Extra wait for data loading and charts

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, filename),
      fullPage: false, // Viewport only (1920x1080)
    });
    console.log(`  Saved ${filename}`);
  }

  await browser.close();
  console.log('All screenshots captured!');
})();
