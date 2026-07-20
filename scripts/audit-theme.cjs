// Rendered theme audit for built file:// widgets. It deliberately reads computed
// colours and composites only CSS colour layers; gradients/raster imagery are
// reported as manual-review surfaces instead of producing invented contrast ratios.
// Usage: NODE_PATH=<widget>/node_modules node scripts/audit-theme.cjs <slug> <dist/index.html> <out-dir>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [slug, indexPath, outDir = '/out'] = process.argv.slice(2);
const repositoryDir = path.resolve(__dirname, '..');
const widgetsDir = path.join(repositoryDir, 'widgets');
const localThemeWidgets = [
  'function-plotter',
  'image-comparison-table',
  'japanese-verb-tower',
  'labour-burden',
  'long-thaw',
  'pennsic-mapper',
  'pennsic-planner',
  'starfall-reliquary',
];
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'theme-audit-manifest.json'), 'utf8'));
const manifestWidgets = Object.keys(manifest.widgets || {}).sort();
if (!slug || !indexPath || !manifest.widgets[slug] ||
  manifestWidgets.length !== localThemeWidgets.length ||
  manifestWidgets.some((widget, index) => widget !== localThemeWidgets[index])) {
  console.error('usage: audit-theme.cjs <widget-slug> <abs-dist-index.html> <out-dir>');
  process.exit(2);
}

function readImportSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(/\bimport\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
  for (const match of source.matchAll(/@import\s+(?:url\(\s*)?(?:['"]([^'"]+)['"]|([^\s);]+))/g)) specifiers.push(match[1] || match[2]);
  return specifiers;
}

function isWithin(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertLocalThemeOwnership() {
  if (!localThemeWidgets.includes(slug)) throw new Error(`${slug}: not one of the six local-theme widgets`);
  if (fs.existsSync(path.join(repositoryDir, 'shared', 'theme.css'))) throw new Error('shared/theme.css must not exist');
  const widgetPath = path.join(widgetsDir, slug);
  const themePath = path.join(widgetPath, 'src', 'theme.css');
  const entrypointPath = path.join(widgetPath, 'src', 'main.tsx');
  if (!fs.lstatSync(themePath).isFile()) throw new Error(`${slug}: missing regular local src/theme.css`);
  const entrypoint = fs.readFileSync(entrypointPath, 'utf8');
  if (readImportSpecifiers(entrypoint).filter((specifier) => specifier === './theme.css').length !== 1) {
    throw new Error(`${slug}: src/main.tsx must import './theme.css' exactly once`);
  }
  const sourceFiles = [];
  const visit = (directory) => {
    for (const child of fs.readdirSync(directory, { withFileTypes: true })) {
      const childPath = path.join(directory, child.name);
      if (child.isDirectory()) visit(childPath);
      else if (child.isFile() && /\.(?:[cm]?[jt]sx?|css)$/.test(child.name)) sourceFiles.push(childPath);
    }
  };
  visit(path.join(widgetPath, 'src'));
  for (const sourcePath of sourceFiles) {
    for (const specifier of readImportSpecifiers(fs.readFileSync(sourcePath, 'utf8'))) {
      if (specifier.includes('theme.css') && !(sourcePath === entrypointPath && specifier === './theme.css')) {
        throw new Error(`${slug}: ${path.relative(widgetPath, sourcePath)} imports a non-local theme '${specifier}'`);
      }
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(sourcePath), specifier);
      if (isWithin(resolved, path.join(repositoryDir, 'shared'))) throw new Error(`${slug}: imports shared dependency '${specifier}'`);
      if (isWithin(resolved, widgetsDir) && !isWithin(resolved, widgetPath)) throw new Error(`${slug}: imports another widget '${specifier}'`);
    }
  }
}

try {
  assertLocalThemeOwnership();
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const spec = manifest.widgets[slug];
const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    slug, source: path.resolve(indexPath), generatedAt: new Date().toISOString(),
    coverage: { viewports: ['390x844', '768x1024', '1280x800'], modes: ['standalone', 'embedded'], stateEvidence: 'journey-report.json is retained alongside this report' },
    schemes: {}, exceptions: spec.exceptions || [], manualSurfaceChecklist: []
  };
  let failures = 0;
  const browser = await chromium.launch({ args });
  try {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
      await page.goto('file://' + path.resolve(indexPath), { waitUntil: 'load' });
      await page.waitForSelector('#widget-ready', { state: 'attached', timeout: 15000 });
      // This gives the iframe stylesheet branch a deterministic, self-contained
      // embed check without requiring a network-served host document.
      const embedded = await page.evaluate(() => { document.documentElement.classList.add('embedded'); return document.documentElement.classList.contains('embedded'); });
      const result = await page.evaluate((input) => {
        const ratio = (a, b) => {
          const linear = (n) => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
          const lum = (c) => .2126 * linear(c[0]) + .7152 * linear(c[1]) + .0722 * linear(c[2]);
          const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
          return (x + .05) / (y + .05);
        };
        // APCA 0.1.1G-style SAPC approximation. It is a recorded house-style
        // signal only; WCAG below remains the pass/fail contrast gate.
        const apca = (txt, bg) => {
          const y = (c) => { const v = c.map(n => (n / 255) ** 2.4); return .2126729 * v[0] + .7151522 * v[1] + .072175 * v[2]; };
          const t = y(txt), b = y(bg); const polarity = b > t ? 1 : -1;
          const sapc = polarity > 0 ? (b ** .56 - t ** .57) * 1.14 : (b ** .65 - t ** .62) * 1.14;
          const clipped = Math.max(0, Math.abs(sapc) - .027);
          return polarity * clipped * 100;
        };
        const parse = (v) => {
          const m = /^rgba?\(([^)]+)\)$/.exec(v);
          if (!m) return null;
          const n = m[1].split(',').map(Number);
          return [n[0], n[1], n[2], Number.isFinite(n[3]) ? n[3] : 1];
        };
        const composite = (fg, bg) => [
          fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3])
        ];
        const surface = (el) => {
          let base = [255, 255, 255, 1], node = el;
          const chain = [];
          while (node) { chain.push(node); node = node.parentElement; }
          for (const current of chain.reverse()) {
            const s = getComputedStyle(current), c = parse(s.backgroundColor);
            if (s.backgroundImage !== 'none') return { manual: true, reason: 'background-image/gradient' };
            // Opacity belongs to the rendered element group, not each nested
            // background. Applying it here and again to foreground double-dims
            // translucent labels, so keep CSS layer alpha separate.
            if (c && c[3] > 0) base = [...composite(c, base), 1];
          }
          return { rgb: base.slice(0, 3) };
        };
        const first = (sel) => document.querySelector(sel);
        const inspect = (sel, kind) => {
          const el = sel && sel.nodeType ? sel : first(sel); if (!el) return { selector: typeof sel === 'string' ? sel : '(automatic)', kind, skipped: 'not present in initial state' };
          const s = getComputedStyle(el), fg = parse(s.color), bg = surface(el);
          let opacityChain = 1, node = el;
          while (node) { opacityChain *= Number.parseFloat(getComputedStyle(node).opacity); node = node.parentElement; }
          const item = { selector: sel, kind, fontFamily: s.fontFamily, fontSize: Number.parseFloat(s.fontSize), fontWeight: Number.parseInt(s.fontWeight, 10), color: s.color, background: bg, opacity: Number.parseFloat(s.opacity), opacityChain, rect: (() => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; })() };
          if (fg && bg.rgb) {
            const rendered = composite([...fg.slice(0, 3), fg[3] * opacityChain], [...bg.rgb, 1]);
            item.wcag = ratio(rendered, bg.rgb);
            item.apcaLc = apca(rendered, bg.rgb);
          }
          if (bg.manual) item.manualReview = bg.reason;
          if (kind === 'boundary') { const border = parse(s.borderTopColor); if (border && bg.rgb) item.wcagBoundary = ratio(composite(border, [...bg.rgb, 1]), bg.rgb); }
          return item;
        };
        const all = [];
        for (const sel of input.text || []) all.push(inspect(sel, 'text'));
        for (const sel of input.boundaries || []) all.push(inspect(sel, 'boundary'));
        for (const sel of input.status || []) all.push(inspect(sel, 'status'));
        // Audit every visible direct-text surface, not just a hand-selected
        // sample. Ancestors are skipped so a paragraph is measured once.
        const exceptionSelectors = (input.exceptions || []).map(x => x.selector).join(',');
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest('script,style,svg') || (exceptionSelectors && el.matches(exceptionSelectors))) continue;
          if (![...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) continue;
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
          const item = inspect(el, 'automatic-text'); item.selector = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().replace(/\s+/g, '.') : '');
          all.push(item);
        }
        const identity = inspect(input.identity, 'identity');
        const ui = inspect(input.ui, 'ui');
        const focusEl = first(input.focus);
        let focus = { selector: input.focus, skipped: 'not present in initial state' };
        if (focusEl) {
          focusEl.focus(); const s = getComputedStyle(focusEl), outline = parse(s.outlineColor), bg = surface(focusEl);
          focus = { selector: input.focus, outline: s.outlineColor, outlineWidth: Number.parseFloat(s.outlineWidth), boxShadow: s.boxShadow, background: bg };
          if (outline && bg.rgb) focus.wcagBoundary = ratio(composite(outline, [...bg.rgb, 1]), bg.rgb);
        }
        const exceptionHits = (input.exceptions || []).map((x) => ({ ...x, present: !!first(x.selector) }));
        return { checks: all, identity, ui, focus, exceptionHits, overflow: document.documentElement.scrollWidth > window.innerWidth + 1 || document.body.scrollWidth > window.innerWidth + 1 };
      }, spec);
      result.embedded = embedded;
      // Responsive/embed evidence is retained per required cell. The detailed
      // interaction states are captured by the adjacent journey gate; this
      // lightweight pass makes clipping and the iframe CSS branch visible in
      // the same machine-readable audit report.
      result.viewportChecks = [];
      for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(viewport);
        for (const mode of ['standalone', 'embedded']) {
          const check = await page.evaluate((m) => {
            document.documentElement.classList.toggle('embedded', m === 'embedded');
            return {
              mode: m,
              overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1,
              visibleText: [...document.querySelectorAll('body *')].filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
              }).length,
            };
          }, mode);
          result.viewportChecks.push({ viewport: `${viewport.width}x${viewport.height}`, ...check });
          if (check.overflow) failures++;
        }
      }
      // A CSS zoom pass catches the intended 200% reflow/overflow regressions without claiming it is a pixel contrast measurement.
      await page.evaluate(() => { document.body.style.zoom = '2'; });
      result.zoom200Overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth * 2 + 2 || document.body.scrollWidth > window.innerWidth * 2 + 2);
      for (const item of result.checks) {
        if (item.skipped || item.manualReview) continue;
        if ((item.kind === 'text' || item.kind === 'status' || item.kind === 'automatic-text') && item.fontSize < 14) failures++;
        if ((item.kind === 'text' || item.kind === 'status' || item.kind === 'automatic-text') && item.wcag !== undefined && item.wcag < 4.5) failures++;
        if (item.kind === 'boundary' && item.wcagBoundary !== undefined && item.wcagBoundary < 3) failures++;
      }
      if (!result.identity.skipped && !/Schibsted Grotesk/i.test(result.identity.fontFamily)) failures++;
      if (!result.ui.skipped && /Schibsted Grotesk/i.test(result.ui.fontFamily)) failures++;
      if (!result.focus.skipped && result.focus.outlineWidth < 2 && result.focus.boxShadow === 'none') failures++;
      if (!result.focus.skipped && result.focus.wcagBoundary !== undefined && result.focus.wcagBoundary < 3) failures++;
      if (result.overflow || result.zoom200Overflow || errors.length) failures++;
      const manual = (spec.manualSurfaces || []).map((entry) => ({ ...entry, scheme: colorScheme, result: entry.checked === true ? 'pass' : 'fail' }));
      report.manualSurfaceChecklist.push(...manual);
      if (manual.some((entry) => entry.result !== 'pass')) failures++;
      report.schemes[colorScheme] = { ...result, errors, manualSurfaceChecklist: manual };
      await context.close();
    }
  } finally { await browser.close(); }
  report.failures = failures;
  fs.writeFileSync(path.join(outDir, `${slug}-theme-audit.json`), JSON.stringify(report, null, 2));
  if (failures) process.exitCode = 1;
}
main().catch((err) => { console.error(err.stack || err); process.exit(1); });
