const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const suite = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios.json'), 'utf8'));
const gallery = path.join(root, 'artifacts/gallery');
const reportPath = path.join(root, 'artifacts/playtest-report.json');
const fileUrl = `file://${path.join(root, 'dist-test/index.html')}`;
fs.mkdirSync(gallery, { recursive: true });

const inputs = {
  up: { code: 'KeyW', key: 'w' }, down: { code: 'KeyS', key: 's' },
  left: { code: 'KeyA', key: 'a' }, right: { code: 'KeyD', key: 'd' },
  pause: { code: 'Escape', key: 'Escape' }, interact: { code: 'Enter', key: 'Enter' },
  mute: { code: 'KeyM', key: 'm' },
};

function initScheduler() {
  let now = 0, sequence = 1, timers = [], rafs = [];
  Math.random = (() => { let seed = 0x12345678; return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; })();
  Date.now = () => Math.floor(now);
  try { Object.defineProperty(performance, 'now', { value: () => now }); } catch {}
  const addTimer = (callback, delay, interval) => { const id = sequence++; timers.push({ id, callback, due: now + (Number(delay) || 0), interval, sequence: id }); return id; };
  window.setTimeout = (fn, delay, ...args) => addTimer(() => fn(...args), delay, 0);
  window.setInterval = (fn, delay, ...args) => addTimer(() => fn(...args), delay, Math.max(1, Number(delay) || 0));
  window.clearTimeout = window.clearInterval = id => { timers = timers.filter(timer => timer.id !== id); };
  window.requestAnimationFrame = fn => { const id = sequence++; rafs.push({ id, fn, sequence: id }); return id; };
  window.cancelAnimationFrame = id => { rafs = rafs.filter(raf => raf.id !== id); };
  window.__step = () => {
    now += 1000 / 60;
    let drains = 0;
    while (true) {
      const timer = timers.filter(item => item.due <= now).sort((a, b) => a.due - b.due || a.sequence - b.sequence)[0];
      if (!timer) break;
      if (++drains > 10000) throw new Error('virtual timer runaway');
      if (timer.interval) timer.due += timer.interval;
      else timers = timers.filter(item => item !== timer);
      timer.callback();
    }
    const frame = rafs.sort((a, b) => a.sequence - b.sequence);
    rafs = [];
    for (const raf of frame) raf.fn(now);
  };
}

async function step(page, frames = 1) {
  if (!Number.isInteger(frames) || frames < 0 || frames > 10000) throw new Error(`invalid frame count ${frames}`);
  for (let i = 0; i < frames; i++) await page.evaluate(() => window.__step());
}

async function resolveTarget(page, grammar) {
  if (grammar.startsWith('@')) {
    const match = grammar.match(/^@(0(?:\.\d+)?|1(?:\.0+)?),(0(?:\.\d+)?|1(?:\.0+)?)$/);
    if (!match) throw new Error(`malformed normalized target ${grammar}`);
    const box = await page.locator('canvas').boundingBox({ timeout: 1000 });
    if (!box) throw new Error('canvas target is not visible');
    return { selector: 'canvas', clientX: box.x + box.width * Number(match[1]), clientY: box.y + box.height * Number(match[2]) };
  }
  if (!grammar || grammar.length > 200) throw new Error(`malformed selector target ${grammar}`);
  const locator = page.locator(grammar).first();
  const box = await locator.boundingBox({ timeout: 1000 });
  if (!box) throw new Error(`target is not visible: ${grammar}`);
  return { selector: grammar, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
}

async function dispatchKey(page, type, input) {
  await page.evaluate(({ type, code, key }) => {
    window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
  }, { type, ...input });
}

async function dispatchAt(page, target, type, init = {}) {
  await page.evaluate(({ target, type, init }) => {
    const element = target.selector === 'canvas' ? document.querySelector('canvas') : document.querySelector(target.selector);
    if (!element) throw new Error(`missing dispatch target ${target.selector}`);
    const common = { bubbles: true, cancelable: true, clientX: target.clientX, clientY: target.clientY, ...init };
    const event = type === 'click' ? new MouseEvent(type, common) : new PointerEvent(type, common);
    element.dispatchEvent(event);
  }, { target, type, init });
}

async function runToken(page, token, activePointers, activeTouches) {
  let match;
  if ((match = token.match(/^hold:(\w+):(\d+)$/))) {
    const input = inputs[match[1]];
    if (!input) throw new Error(`unknown input ${match[1]}`);
    await dispatchKey(page, 'keydown', input); await step(page, Number(match[2])); await dispatchKey(page, 'keyup', input); return;
  }
  if ((match = token.match(/^press:(\w+)$/))) {
    const input = inputs[match[1]];
    if (!input) throw new Error(`unknown input ${match[1]}`);
    await dispatchKey(page, 'keydown', input); await step(page); await dispatchKey(page, 'keyup', input); return;
  }
  if ((match = token.match(/^release:(\w+)$/))) {
    const input = inputs[match[1]];
    if (!input) throw new Error(`unknown input ${match[1]}`);
    await dispatchKey(page, 'keyup', input); return;
  }
  if ((match = token.match(/^wait:(\d+)$/))) { await step(page, Number(match[1])); return; }
  if ((match = token.match(/^tap:(.+)$/))) {
    const target = await resolveTarget(page, match[1]);
    await dispatchAt(page, target, 'pointerdown', { pointerId: 9001, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 });
    await step(page);
    await dispatchAt(page, target, 'pointerup', { pointerId: 9001, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0 });
    await dispatchAt(page, target, 'click', { button: 0, buttons: 0 });
    await step(page); return;
  }
  if ((match = token.match(/^call:(\w+)\((.*)\)$/))) {
    const args = match[2] ? JSON.parse(`[${match[2]}]`) : [];
    await page.evaluate(({ name, args }) => { const fn = window.__game?.[name]; if (typeof fn !== 'function') throw new Error(`unknown hook ${name}`); return fn(...args); }, { name: match[1], args }); return;
  }
  if ((match = token.match(/^pointer:(down|move|up):(\d+):(.+)$/))) {
    const phase = match[1], id = Number(match[2]), target = await resolveTarget(page, match[3]);
    if (phase === 'down' && activePointers.has(id)) throw new Error(`duplicate active pointer ${id}`);
    if (phase !== 'down' && !activePointers.has(id)) throw new Error(`unmatched pointer ${phase} ${id}`);
    await dispatchAt(page, target, `pointer${phase}`, { pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, buttons: phase === 'up' ? 0 : 1 });
    if (phase === 'down') activePointers.add(id); else if (phase === 'up') activePointers.delete(id);
    await step(page); return;
  }
  if ((match = token.match(/^touch:(start|move|end|cancel):(\d+):(.+)$/))) {
    const phase = match[1], id = Number(match[2]), target = await resolveTarget(page, match[3]);
    if (phase === 'start' && activeTouches.has(id)) throw new Error(`duplicate active touch ${id}`);
    if (phase !== 'start' && !activeTouches.has(id)) throw new Error(`unmatched touch ${phase} ${id}`);
    await page.evaluate(({ phase, id, target }) => {
      const element = target.selector === 'canvas' ? document.querySelector('canvas') : document.querySelector(target.selector);
      if (!element) throw new Error(`missing touch target ${target.selector}`);
      const touch = new Touch({ identifier: id, target: element, clientX: target.clientX, clientY: target.clientY });
      const event = new TouchEvent(`touch${phase}`, { bubbles: true, cancelable: true, changedTouches: [touch], touches: phase === 'end' || phase === 'cancel' ? [] : [touch] });
      element.dispatchEvent(event);
    }, { phase, id, target });
    if (phase === 'start') activeTouches.add(id); else if (phase === 'end' || phase === 'cancel') activeTouches.delete(id);
    await step(page); return;
  }
  throw new Error(`unknown or malformed token ${token}`);
}

async function waitReady(page) {
  for (let frame = 0; frame < 180; frame++) {
    if (await page.evaluate(() => !!document.querySelector('#game-ready') && !!window.__game)) return;
    await step(page);
  }
  throw new Error('readiness exceeded 180 stepped frames');
}

(async () => {
  let browser; const results = [];
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'] });
    for (const scenario of suite.scenarios) {
      process.stdout.write(`scenario-start ${scenario.name}\n`);
      let context, page; const consoleErrors = [];
      try {
        context = await browser.newContext({ viewport: { width: 1000, height: 760 } });
        page = await context.newPage();
        page.setDefaultTimeout(1500); page.setDefaultNavigationTimeout(5000);
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', error => consoleErrors.push(error.message));
        await page.addInitScript(initScheduler);
        await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
        if (scenario.start === 'reload') await page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
        await waitReady(page);
        const pointers = new Set(), touches = new Set();
        for (const token of scenario.setup) await runToken(page, token, pointers, touches);
        for (const token of scenario.actions) await runToken(page, token, pointers, touches);
        if (pointers.size || touches.size) throw new Error('scenario ended with active pointer/touch IDs');
        const state = await page.evaluate(() => document.documentElement.dataset.gameState);
        if (state !== scenario.expect.state) throw new Error(`state ${state}, expected ${scenario.expect.state}`);
        for (const selector of scenario.expect.visible) {
          const visible = await page.locator(selector).first().isVisible({ timeout: 1000 });
          if (!visible) throw new Error(`not visible: ${selector}`);
        }
        const check = await page.evaluate(expression => { const g = window.__game, state = document.documentElement.dataset.gameState; return Function('g', 'state', `return (${expression})`)(g, state); }, scenario.expect.check);
        if (check !== true) throw new Error(`expect.check returned ${String(check)}`);
        if (consoleErrors.length) throw new Error(`console/page errors: ${consoleErrors.join('; ')}`);
        const screenshot = path.join(gallery, scenario.screenshot);
        await page.screenshot({ path: screenshot, timeout: 3000 });
        results.push({ scenario: scenario.name, pass: true, state, error: null, consoleErrors: [], screenshot });
        process.stdout.write(`scenario-pass ${scenario.name}\n`);
      } catch (error) {
        results.push({ scenario: scenario.name, pass: false, state: null, error: String(error.stack || error), consoleErrors, screenshot: null });
        process.stdout.write(`scenario-fail ${scenario.name}: ${error.message}\n`);
      } finally { await context?.close(); }
    }
    const pass = results.length === suite.scenarios.length && results.every(result => result.pass);
    const report = { schemaVersion: 1, pass, scenarios: results, error: null };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(`${reportPath}.tmp`, JSON.stringify(report, null, 2)); fs.renameSync(`${reportPath}.tmp`, reportPath);
    if (pass) console.log(`playtest-ok ${results.length}`); else process.exitCode = 1;
  } catch (error) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(`${reportPath}.tmp`, JSON.stringify({ schemaVersion: 1, pass: false, scenarios: results, error: String(error.stack || error) }, null, 2)); fs.renameSync(`${reportPath}.tmp`, reportPath);
    process.exitCode = 1;
  } finally { await browser?.close(); }
})();
