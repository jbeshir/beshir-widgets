// Interactive render: drive the breakdown flow with a deep form and screenshot.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const indexPath = process.argv[2];
const outDir = process.argv[3] || '/out';
const input = process.argv[4] || '見たくなくなってきた';

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--allow-file-access-from-files'],
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror:', e.message));
    page.on('console', (m) => console.log('console:', m.type(), m.text()));
    await page.goto('file://' + path.resolve(indexPath), { waitUntil: 'load' });
    await page.waitForSelector('#widget-ready', { state: 'attached', timeout: 15000 });
    console.log('widget-ready found');
    fs.mkdirSync(outDir, { recursive: true });

    // 1) switch to Break down mode (the 2nd mode button, by text)
    await page.getByRole('tab', { name: 'Break down' }).click();
    await page.waitForSelector('.breakdown-input', { timeout: 5000 });

    // 2) type the deep form and run
    await page.fill('.breakdown-input', input);
    await page.click('.breakdown-btn');

    // 3) single parse → auto-applies → build-mode tower; multiple → candidate picker.
    await page.waitForTimeout(900);
    const picker = await page.$('.candidate-picker');
    const tiers = await page.$$('.tier, .tower-tier, [class*="tier"]');
    console.log('candidate-picker present:', !!picker, '| tier-like nodes:', tiers.length);

    await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });
    fs.writeFileSync(path.join(outDir, 'render-ok'), 'ok');
    console.log('render-ok: screenshot saved to', path.join(outDir, 'screenshot.png'), 'for input', input);
  } catch (err) {
    console.error('render failed:', err && err.stack || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
