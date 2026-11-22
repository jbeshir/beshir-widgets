// Lesson gallery: a screenshot of every step of every lesson, for qualitative review. Not run in CI.
//
//   NODE_PATH=<dir with playwright> node scripts/lesson-gallery.cjs <dist/index.html> <out-dir>
//     [--lessons id|n,id|n] [--steps 1,4,8] [--viewports desktop:1280x800,phone:390x844] [--schemes light,dark]
//     [--scale 1] [--phone-scale 2] [--full-format jpeg|png] [--forced-colors] [--forced-steps 1,first-turn]
//
// Per step and viewport x scheme (<base> = <lessonIndex>-<lessonId>__<stepIndex>-<stepId>) it writes
//   <base>__<viewport>__<scheme>.jpg|png                full page (jpeg by default: the full pages are large)
//   <base>__<viewport>__<scheme>__instrument.png        close-up of the instrument stage, every viewport and scheme
//   <base>__<viewport>__<scheme>__viewport.png          phone only: what is on screen at the top of the page, not full page
// and, with --forced-colors, for a few steps (desktop, light, forced-colors: active)
//   <base>__<viewport>__forced-colors.png and <base>__<viewport>__forced-colors__instrument.png
// Phone viewports (width <= 600) are captured at deviceScaleFactor 2 (--phone-scale), the others at --scale.
// --lessons takes lesson ids or 1-based course positions; --steps takes 1-based step numbers within each lesson.
// index.json: lesson and step ids, headings, copy as rendered, and the in-page audit results
// (window.astrolabe.inspect.auditStep: snapshot, plus the solution state of your-turn steps). Audit failures are recorded, never fatal;
// only a crash exits non-zero.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const positional = args.filter((arg, i) => !arg.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const [distArg, outArg] = positional;
if (!distArg || !outArg) {
  console.error('usage: node scripts/lesson-gallery.cjs <dist/index.html> <out-dir> [--lessons id|n,..] [--steps 1,4,..] [--viewports desktop:1280x800,phone:390x844] [--schemes light,dark] [--scale 1] [--phone-scale 2] [--full-format jpeg|png] [--forced-colors] [--forced-steps 1,first-turn]');
  process.exit(2);
}
const dist = path.resolve(distArg);
const outDir = path.resolve(outArg);
const onlyLessons = flag('lessons', '') ? flag('lessons', '').split(',') : null;
const onlySteps = flag('steps', '') ? flag('steps', '').split(',').map(Number) : null;
const fullFormat = flag('full-format', 'jpeg') === 'png' ? 'png' : 'jpeg';
const fullExt = fullFormat === 'png' ? 'png' : 'jpg';
const forcedColors = args.includes('--forced-colors');
const forcedSteps = flag('forced-steps', '1,first-turn').split(',');
const phoneScale = Number(flag('phone-scale', '2')) || 2;
const schemes = flag('schemes', 'light,dark').split(',');
const viewports = flag('viewports', 'desktop:1280x800,phone:390x844').split(',').map((label) => {
  const m = /^([a-z0-9-]+):(\d+)x(\d+)$/.exec(label);
  if (!m) { console.error(`bad viewport: ${label}`); process.exit(2); }
  return { name: m[1], width: Number(m[2]), height: Number(m[3]) };
});
const scale = Number(flag('scale', '1')) || 1;
const isPhone = (vp) => vp.width <= 600;

const FIXED_EPOCH = 1717200000000; // same frozen clock as scripts/journey.cjs
const FREEZE_CSS = '*,*::before,*::after{transition:none !important;animation:none !important;caret-color:transparent !important;scroll-behavior:auto !important;}';
function determinismInit(epoch) {
  const RealDate = Date;
  let seed = 0x9e3779b9 >>> 0;
  Math.random = function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  function FrozenDate(...a) { return a.length === 0 ? new RealDate(epoch) : new RealDate(...a); }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = () => epoch;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  globalThis.Date = FrozenDate;
  try { performance.now = () => 0; } catch { /* read-only in some engines */ }
}

const pad = (n) => String(n).padStart(2, '0');
const refText = (ref) => {
  if (typeof ref === 'string') return ref;
  const { part, ...rest } = ref;
  const [key, value] = Object.entries(rest)[0] ?? [];
  return key ? `${part}[${key}=${value}]` : part;
};
const checkText = (check) => {
  if (!check) return null;
  if (check.kind === 'choice') return `choice: ${check.prompt}`;
  if (check.kind === 'allOf') return `allOf(${check.predicates.map(checkText).join(', ')})`;
  const { kind, ...rest } = check;
  return `${kind} ${JSON.stringify(rest)}`;
};

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'],
  });
  const url = 'file://' + dist;
  const index = { generatedAt: new Date().toISOString(), dist, viewports: viewports.map((v) => `${v.name}:${v.width}x${v.height}`), schemes, lessons: [] };
  const entries = new Map(); // `${lesson}/${step}` -> index entry, filled by the first context and extended by the rest
  let shots = 0;
  try {
    for (const vp of viewports) {
      for (const scheme of schemes) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: isPhone(vp) ? phoneScale : scale, colorScheme: scheme, reducedMotion: 'reduce',
        });
        await ctx.addInitScript(`(${determinismInit})(${FIXED_EPOCH});`);
        const page = await ctx.newPage();
        let consoleErrors = [];
        page.on('pageerror', (e) => consoleErrors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForSelector('#widget-ready', { state: 'attached', timeout: 15000 });
        await page.addStyleTag({ content: FREEZE_CSS });

        const catalog = await page.evaluate(() => window.astrolabe.inspect.catalog());
        for (const [lessonIndex, lesson] of catalog.entries()) {
          if (onlyLessons && !onlyLessons.includes(lesson.id) && !onlyLessons.includes(String(lessonIndex + 1))) continue;
          if (!index.lessons.some((l) => l.id === lesson.id)) {
            index.lessons.push({ index: lessonIndex + 1, id: lesson.id, title: lesson.title, summary: lesson.summary, prerequisites: lesson.prerequisites, steps: [] });
          }
          const lessonEntry = index.lessons.find((l) => l.id === lesson.id);
          for (const [stepIndex, step] of lesson.steps.entries()) {
            if (onlySteps && !onlySteps.includes(stepIndex + 1)) continue;
            const key = `${lesson.id}/${step.id}`;
            const base = `${pad(lessonIndex + 1)}-${lesson.id}__${pad(stepIndex + 1)}-${step.id}`;
            consoleErrors = [];
            await page.evaluate(([l, s]) => window.astrolabe.inspect.openStep(l, s), [lesson.id, stepIndex]);
            const audit = await page.evaluate(([l, s]) => window.astrolabe.inspect.auditStep(l, s, { visibility: true }), [lesson.id, stepIndex]);
            let entry = entries.get(key);
            if (!entry) {
              entry = {
                index: stepIndex + 1, id: step.id, title: step.title, mode: step.mode, face: step.snapshot.face, purpose: step.purpose, body: step.body,
                stopCue: step.stopCue ?? null, result: step.result, introduces: step.introduces, uses: step.uses, highlights: step.highlights.map(refText),
                check: checkText(step.check), demonstration: step.demonstration ?? null,
                url: `?lesson=${lesson.id}&step=${step.id}&lv=1`,
                heading: audit.heading, renderedText: audit.renderedText, audit: {}, screenshots: {}, consoleErrors: [],
              };
              entries.set(key, entry);
              lessonEntry.steps.push(entry);
            }
            const cell = `${vp.name}-${scheme}`;
            const { renderedText, heading, ...auditResult } = audit;
            entry.audit[cell] = auditResult;
            for (const message of consoleErrors) entry.consoleErrors.push(`${cell}: ${message}`);

            await page.evaluate(() => window.scrollTo(0, 0));
            const file = `${base}__${vp.name}__${scheme}.${fullExt}`;
            await page.screenshot({ path: path.join(outDir, file), fullPage: true, type: fullFormat, ...(fullFormat === 'jpeg' ? { quality: 85 } : {}) });
            entry.screenshots[cell] = file;
            shots += 1;
            if (isPhone(vp)) {
              await page.evaluate(() => window.scrollTo(0, 0));
              const view = `${base}__${vp.name}__${scheme}__viewport.png`;
              await page.screenshot({ path: path.join(outDir, view) });
              entry.screenshots[`${cell}-viewport`] = view;
              shots += 1;
            }
            const close = `${base}__${vp.name}__${scheme}__instrument.png`;
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.locator('.instrument-stage').screenshot({ path: path.join(outDir, close) });
            entry.screenshots[`${cell}-instrument`] = close;
            shots += 1;
          }
        }
        await ctx.close();
        console.log(`done ${vp.name} ${scheme}`);
      }
    }
    if (forcedColors) {
      // Forced colours (desktop, light): which steps — step numbers, or "first-turn" for each lesson's first your-turn step.
      const vp = viewports.find((v) => !isPhone(v)) ?? viewports[0];
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: scale, colorScheme: 'light', forcedColors: 'active', reducedMotion: 'reduce',
      });
      await ctx.addInitScript(`(${determinismInit})(${FIXED_EPOCH});`);
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#widget-ready', { state: 'attached', timeout: 15000 });
      await page.addStyleTag({ content: FREEZE_CSS });
      const catalog = await page.evaluate(() => window.astrolabe.inspect.catalog());
      for (const [lessonIndex, lesson] of catalog.entries()) {
        if (onlyLessons && !onlyLessons.includes(lesson.id) && !onlyLessons.includes(String(lessonIndex + 1))) continue;
        const turn = lesson.steps.findIndex((step) => step.mode === 'your-turn') + 1;
        const wanted = new Set(forcedSteps.map((item) => (item === 'first-turn' ? turn : Number(item))).filter((n) => n > 0));
        for (const [stepIndex, step] of lesson.steps.entries()) {
          if (!wanted.has(stepIndex + 1) || (onlySteps && !onlySteps.includes(stepIndex + 1))) continue;
          const base = `${pad(lessonIndex + 1)}-${lesson.id}__${pad(stepIndex + 1)}-${step.id}`;
          await page.evaluate(([l, i]) => window.astrolabe.inspect.openStep(l, i), [lesson.id, stepIndex]);
          await page.evaluate(() => window.scrollTo(0, 0));
          const entry = entries.get(`${lesson.id}/${step.id}`);
          const full = `${base}__${vp.name}__forced-colors.${fullExt}`;
          await page.screenshot({ path: path.join(outDir, full), fullPage: true, type: fullFormat, ...(fullFormat === 'jpeg' ? { quality: 85 } : {}) });
          const close = `${base}__${vp.name}__forced-colors__instrument.png`;
          await page.locator('.instrument-stage').screenshot({ path: path.join(outDir, close) });
          if (entry) { entry.screenshots[`${vp.name}-forced-colors`] = full; entry.screenshots[`${vp.name}-forced-colors-instrument`] = close; }
          shots += 2;
        }
      }
      await ctx.close();
      console.log('done forced-colors');
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  const failures = index.lessons.flatMap((l) => l.steps.flatMap((s) => Object.values(s.audit).flatMap((a) => a.failures)));
  console.log(`gallery: ${shots} screenshots, ${index.lessons.reduce((n, l) => n + l.steps.length, 0)} steps, ${failures.length} audit failures recorded -> ${outDir}`);
})().catch((err) => {
  console.error('lesson-gallery crashed:', (err && err.stack) || err);
  process.exit(1);
});
