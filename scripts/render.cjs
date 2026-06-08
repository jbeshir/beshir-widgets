const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const indexPath = process.argv[2];
const markerId = process.argv[3] || 'widget-ready';
const outDir = process.argv[4] || '/out';

if (!indexPath) {
  console.error('usage: node render.cjs <abs-path-to-dist/index.html> [marker-id] [out-dir]');
  process.exit(2);
}

(async () => {
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--allow-file-access-from-files',
    ],
  });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror:', e.message));
    page.on('console', (m) => console.log('console:', m.type(), m.text()));
    await page.goto('file://' + path.resolve(indexPath), { waitUntil: 'load' });
    await page.waitForSelector('#' + markerId, { state: 'attached', timeout: 15000 });
    fs.mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });
    fs.writeFileSync(path.join(outDir, 'render-ok'), 'ok');
    console.log('render-ok: marker #' + markerId + ' found, screenshot saved to ' + path.join(outDir, 'screenshot.png'));
  } catch (err) {
    console.error('render failed:', err && err.stack || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
