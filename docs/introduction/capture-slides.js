const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'playwright'));

const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = path.join(SCRIPT_DIR, 'slide-screenshots');

(async () => {
  const fs = require('fs');
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // Retina quality (3840x2160 actual pixels)
  });
  const page = await context.newPage();

  // Open the HTML file
  const htmlPath = path.join(SCRIPT_DIR, 'slides.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Capture each slide
  for (let i = 1; i <= 8; i++) {
    const selector = `#slide${i}`;
    const element = await page.$(selector);
    if (!element) {
      console.error(`Slide ${i} not found!`);
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, `slide${i}.png`);
    await element.screenshot({ path: outputPath });
    console.log(`Captured slide ${i} -> ${outputPath}`);
  }

  await browser.close();
  console.log(`\nAll slides captured to ${OUTPUT_DIR}`);
})();
