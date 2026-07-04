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
  } else if ('mockFetch' in step) {
    await applyMockFetch(page, step.mockFetch);
  } else {
    throw new Error(`unknown step: ${JSON.stringify(step)}`);
  }
}

// Turn a `urlPattern` into `{ source, flags }` for an in-page `new RegExp(...)`. A pattern wrapped in
// slashes ("/…/flags") is a JS regex used verbatim; anything else is a URL glob (`*` matches within a
// path segment, `**` across segments, `?` a single char), anchored and matched against the FULL request
// URL — under the file:// gate that is e.g. `file:///api/map`.
function toMatcherParts(pattern) {
  const m = /^\/(.*)\/([a-z]*)$/is.exec(pattern);
  // Only treat a slash-wrapped pattern as a regex if it actually compiles — otherwise a natural glob
  // like "/api/map" (which happens to start and end with a slash) would be mis-read as the regex
  // `/api/map` with flags "map", throw "Invalid flags", and silently fall through to the real fetch.
  if (m) {
    try {
      // eslint-disable-next-line no-new
      new RegExp(m[1], m[2]);
      return { source: m[1], flags: m[2] };
    } catch { /* not a valid regex — fall through and treat the pattern as a glob */ }
  }
  let source = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') { source += '.*'; i++; } else { source += '[^/]*'; }
    } else if (c === '?') {
      source += '[^/]';
    } else {
      source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return { source: source + '$', flags: '' };
}

// Install a browser-side response mock for the NEXT request(s) matching `urlPattern`. This is how a
// widget with a network-gated flow (e.g. a "Create shared map" POST) is exercised end-to-end under the
// offline gate.
//
// *** Why an in-page window.fetch shim, not page.route ***
// The gates load the widget over `file://`. A `file://` page cannot fetch anything — the browser rejects
// `fetch('/api/map')` (it resolves to `file:///api/map`) with "URL scheme file is not supported" — and
// Playwright's network-layer `page.route` does NOT intercept `file://` requests at all. So the ONLY way
// to answer such a request without real network is to intercept `fetch` itself, in the page: we wrap
// `window.fetch` to return a canned `Response` for matching calls and delegate everything else to the
// real fetch. It is a pure browser-side hook (no request ever leaves the page), so it works identically
// under `egress: none`, and it is strictly more general than page.route — it also catches the relative
// `file://` fetches that page.route cannot reach.
//
// Shape (declarative JSON, no inline JS): { urlPattern, method?, status?, body?, contentType?, headers? }
//   urlPattern  glob ("**/api/map") or regex ("/\\/api\\/map$/") matched against the full URL
//   method      optional — only intercept this HTTP verb; other verbs fall through to any other mock/real
//   status      response status (default 200)
//   body        response body: an object/array is JSON-stringified; a string is sent verbatim
//   contentType / headers  optional response header overrides
//
// Scope: the harness gives every (state × viewport × scheme) cell its own fresh browser context + page,
// so the shim + its rules are torn down with that page and can never leak into a later state. Multiple
// mockFetch steps in one state stack onto one shim: registering method-scoped mocks (e.g. POST create +
// PUT sync) lets each verb be answered independently, matched most-recent-first.
async function applyMockFetch(page, mock) {
  if (mock === null || typeof mock !== 'object' || Array.isArray(mock) || typeof mock.urlPattern !== 'string') {
    throw new Error(`mockFetch requires an object with a string urlPattern: ${JSON.stringify(mock)}`);
  }
  const { source, flags } = toMatcherParts(mock.urlPattern);
  const isJsonBody = mock.body !== undefined && mock.body !== null && typeof mock.body === 'object';
  const rule = {
    source,
    flags,
    method: typeof mock.method === 'string' ? mock.method.toUpperCase() : null,
    status: typeof mock.status === 'number' ? mock.status : 200,
    body: mock.body === undefined ? '' : (typeof mock.body === 'string' ? mock.body : JSON.stringify(mock.body)),
    contentType: mock.contentType || (isJsonBody ? 'application/json' : 'text/plain'),
    headers: mock.headers || null,
  };

  // Install (once) an in-page window.fetch wrapper and push this rule onto its registry. Rules are matched
  // most-recent-first; a request matching no rule falls through to the widget's real fetch.
  await page.evaluate((r) => {
    const w = window;
    // Signal that a browser-side fetch mock is now installed. Widgets that deliberately suppress all real
    // network under file:// (so a fresh offline visit never logs a console error) can read this flag to
    // opt a mocked journey back into their network path — matching requests are answered in-page, and any
    // request matching no rule still falls through to the widget's real fetch.
    w.__journeyMockFetch = true;
    if (!w.__journeyFetchMocks) {
      w.__journeyFetchMocks = [];
      const orig = typeof w.fetch === 'function' ? w.fetch.bind(w) : null;
      // Statuses that MUST have a null body — `new Response('', { status })` throws for these.
      const NULL_BODY = { 101: 1, 204: 1, 205: 1, 304: 1 };
      w.fetch = function (input, init) {
        try {
          const url = typeof input === 'string' ? input : (input && input.url) || String(input);
          const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          const mocks = w.__journeyFetchMocks;
          for (let i = mocks.length - 1; i >= 0; i--) {
            const m = mocks[i];
            if (m.method && m.method !== method) continue;
            if (!new RegExp(m.source, m.flags).test(url)) continue;
            const headers = Object.assign({ 'Content-Type': m.contentType }, m.headers || {});
            return Promise.resolve(new Response(NULL_BODY[m.status] ? null : m.body, { status: m.status, headers }));
          }
        } catch (e) {
          /* a shim error must never mask the real fetch — fall through */
        }
        if (orig) return orig(input, init);
        return Promise.reject(new TypeError('fetch is not available'));
      };
    }
    w.__journeyFetchMocks.push(r);
  }, rule);
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

          // a11y snapshot once per state on the canonical light/desktop-ish cell. Uses ariaSnapshot()
          // (roles + accessible names, as a YAML string) — `page.accessibility` was removed in modern
          // Playwright, so the previous `page.accessibility.snapshot()` silently caught to null on every
          // run. Record the error text instead of null so a future breakage is visible, not swallowed.
          if (scheme === 'light' && (vp.name === 'desktop' || a11yByState[state.label] === undefined)) {
            try {
              a11yByState[state.label] = await page.locator('body').ariaSnapshot();
            } catch (err) { a11yByState[state.label] = `<<a11y snapshot failed: ${(err && err.message) || err}>>`; }
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
