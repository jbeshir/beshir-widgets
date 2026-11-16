const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const file = path.resolve(process.argv[2] || 'dist/index.html');
  const html = fs.readFileSync(file, 'utf8');
  if (/window\.gameTest|GAME_TEST_BUILD/.test(html)) throw new Error('production contains test hooks');
  if (/<script[^>]+src=|<link[^>]+stylesheet/.test(html)) throw new Error('production is not self-contained');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  if (await page.evaluate(() => 'gameTest' in window)) throw new Error('test API exposed');
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('production-validation-ok');
})().catch(e => { console.error(e); process.exit(1); });
