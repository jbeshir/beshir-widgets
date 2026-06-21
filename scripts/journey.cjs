// Generic, deterministic journey harness — sibling to render.cjs.
//
// Drives a built widget through a matrix of (state × viewport × scheme) cells
// described by a journey.json sidecar (see TESTING.md), capturing a full-page
// screenshot per cell plus correctness signals (console errors, page errors,
// horizontal overflow, accessibility tree). It is BOTH a screenshot generator
// AND a correctness gate: it exits non-zero if any cell produced a page error,
// a console error, or failed to reach its `expect` marker — while still writing
// everything it managed to capture.
//
// Determinism is mandatory: Date.now/new Date and Math.random are frozen via an
// init script before navigation, transitions/animations are disabled, and the
// harness waits on explicit markers (never a settle-timeout).
//
// Usage: node scripts/journey.cjs <abs dist/index.html> <abs journey.json> <out-dir>

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const indexPath = process.argv[2];
const journeyPath = process.argv[3];
const outDir = process.argv[4] || '/out';

if (!indexPath || !journeyPath) {
  console.error('usage: node journey.cjs <abs-path-to-dist/index.html> <abs-path-to-journey.json> <out-dir>');
  process.exit(2);
}

// Browser launch args mirror render.cjs exactly so file:// access behaves the same.
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--allow-file-access-from-files',
];

const FIXED_EPOCH = 1717200000000; // 2024-06-01T00:00:00Z — stable, arbitrary.
const READY_TIMEOUT = 15000;
const EXPECT_TIMEOUT = 15000;
const STEP_TIMEOUT = 10000;

// Injected before any page script runs: freeze the clock and the RNG so that
// time/random-dependent rendering is identical on every run and every cell.
function determinismInit(epoch) {
  const RealDate = Date;
  const fixed = epoch;
  // Mulberry32 — small deterministic PRNG seeded to a constant.
  let seed = 0x9e3779b9 >>> 0;
  Math.random = function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  function FrozenDate(...args) {
    if (args.length === 0) return new RealDate(fixed);
    return new RealDate(...args);
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = () => fixed;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  // eslint-disable-next-line no-global-assign
  Date = FrozenDate;
  try { performance.now = () => 0; } catch { /* read-only in some engines */ }
}

const FREEZE_CSS = '*,*::before,*::after{transition:none !important;animation:none !important;caret-color:transparent !important;scroll-behavior:auto !important;}';

function parseViewport(label) {
  // "mobile:390x844" → { name: 'mobile', width: 390, height: 844 }
  const m = /^([a-z0-9-]+):(\d+)x(\d+)$/.exec(label);
  if (!m) throw new Error(`bad viewport label: ${label}`);
  return { name: m[1], width: Number(m[2]), height: Number(m[3]) };
}

async function applyStep(page, step) {
  if ('click' in step) {
    await page.click(step.click, { timeout: STEP_TIMEOUT });
  } else if ('clickRole' in step) {
    const { role, name } = step.clickRole;
    await page.getByRole(role, name ? { name } : undefined).first().click({ timeout: STEP_TIMEOUT });
  } else if ('fill' in step) {
    await page.fill(step.fill, String(step.value ?? ''), { timeout: STEP_TIMEOUT });
  } else if ('press' in step) {
    await page.keyboard.press(step.press);
  } else if ('hover' in step) {
    await page.hover(step.hover, { timeout: STEP_TIMEOUT });
  } else if ('waitFor' in step) {
    await page.waitForSelector(step.waitFor, { state: 'visible', timeout: STEP_TIMEOUT });
  } else if ('eval' in step) {
    await page.evaluate((expr) => {
      // Indirect eval of a page-side expression (escape hatch).
      // eslint-disable-next-line no-eval
      return (0, eval)(expr);
    }, step.eval);
  } else {
    throw new Error(`unknown step: ${JSON.stringify(step)}`);
  }
}

async function awaitExpect(page, expect) {
  if (expect && typeof expect.state === 'string') {
    await page.waitForFunction(
      (s) => document.documentElement.dataset.widgetState === s,
      expect.state,
      { timeout: EXPECT_TIMEOUT },
    );
  } else if (expect && typeof expect.selector === 'string') {
    await page.waitForSelector(expect.selector, { state: 'visible', timeout: EXPECT_TIMEOUT });
  } else {
    throw new Error(`bad expect: ${JSON.stringify(expect)}`);
  }
}

(async () => {
  const spec = JSON.parse(fs.readFileSync(journeyPath, 'utf8'));
  const viewports = (spec.matrix && spec.matrix.viewports) || [];
  const schemes = (spec.matrix && spec.matrix.schemes) || ['light'];
  const states = spec.states || [];
  if (viewports.length === 0 || states.length === 0) {
    console.error('journey spec must have matrix.viewports and states');
    process.exit(2);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const fileUrl = 'file://' + path.resolve(indexPath);
  const report = [];
  const a11yByState = {};
  let failures = 0;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    for (const state of states) {
      for (const vpLabel of viewports) {
        const vp = parseViewport(vpLabel);
        for (const scheme of schemes) {
          const cellId = `${state.label}__${vp.name}__${scheme}`;
          const cell = {
            state: state.label,
            viewport: vp.name,
            scheme,
            screenshot: `${cellId}.png`,
            consoleErrors: [],
            pageErrors: [],
            overflow: false,
          };

          const ctx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 2,
            colorScheme: scheme,
            reducedMotion: 'reduce',
          });
          await ctx.addInitScript(`(${determinismInit})(${FIXED_EPOCH});`);
          const page = await ctx.newPage();
          page.on('pageerror', (e) => cell.pageErrors.push(e.message));
          page.on('console', (m) => { if (m.type() === 'error') cell.consoleErrors.push(m.text()); });

          let cellFailed = false;
          let failReason = '';
          try {
            await page.goto(fileUrl, { waitUntil: 'load' });
            await page.waitForSelector('#widget-ready', { state: 'attached', timeout: READY_TIMEOUT });
            await page.addStyleTag({ content: FREEZE_CSS });

            for (const step of (state.steps || [])) {
              await applyStep(page, step);
            }
            await awaitExpect(page, state.expect);
          } catch (err) {
            cellFailed = true;
            failReason = (err && err.message) || String(err);
          }

          // Capture overflow + screenshot regardless of step/expect outcome.
          try {
            cell.overflow = await page.evaluate(
              () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            );
          } catch { /* page may be in a bad state */ }

          // a11y tree once per state on the canonical light/desktop-ish cell.
          if (scheme === 'light' && (vp.name === 'desktop' || a11yByState[state.label] === undefined)) {
            try {
              a11yByState[state.label] = await page.accessibility.snapshot();
            } catch { a11yByState[state.label] = null; }
          }

          try {
            await page.screenshot({ path: path.join(outDir, cell.screenshot), fullPage: true });
          } catch (err) {
            cellFailed = true;
            failReason = failReason || `screenshot failed: ${(err && err.message) || err}`;
          }

          await ctx.close();

          if (cellFailed) { cell.error = failReason; failures++; console.error(`FAIL ${cellId}: ${failReason}`); }
          if (cell.pageErrors.length) { failures++; console.error(`FAIL ${cellId}: pageerror ${JSON.stringify(cell.pageErrors)}`); }
          if (cell.consoleErrors.length) { failures++; console.error(`FAIL ${cellId}: console.error ${JSON.stringify(cell.consoleErrors)}`); }
          if (cell.overflow) console.error(`WARN ${cellId}: horizontal overflow`);

          report.push(cell);
          console.log(`captured ${cellId}${cellFailed ? ' (FAILED)' : ''}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(outDir, 'journey-report.json'),
    JSON.stringify({ index: fileUrl, cells: report, a11y: a11yByState }, null, 2),
  );
  fs.writeFileSync(path.join(outDir, 'journey-ok'), failures === 0 ? 'ok' : 'fail');

  if (failures > 0) {
    console.error(`journey FAILED: ${failures} problem cell(s); report + screenshots written to ${outDir}`);
    process.exit(1);
  }
  console.log(`journey-ok: ${report.length} cell(s) captured to ${outDir}`);
})().catch((err) => {
  console.error('journey harness crashed:', err && err.stack || err);
  process.exit(1);
});
