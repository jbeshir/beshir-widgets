import { describe, expect, it } from 'vitest';

const { readFileSync } = await import(/* @vite-ignore */ ['node', 'fs'].join(':')) as { readFileSync: (path: URL, encoding: 'utf8') => string };
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

/** The declarations of every rule inside the forced-colors media blocks, as [selector, body] pairs. */
function forcedColorRules(): [string, string][] {
  const rules: [string, string][] = [];
  for (const media of styles.matchAll(/@media \(forced-colors: active\) \{/g)) {
    let depth = 1;
    let end = (media.index ?? 0) + media[0].length;
    while (depth > 0 && end < styles.length) { const ch = styles[end]; if (ch === '{') depth += 1; else if (ch === '}') depth -= 1; end += 1; }
    const block = styles.slice((media.index ?? 0) + media[0].length, end - 1).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push([rule[1].trim(), rule[2]]);
  }
  return rules;
}

/**
 * The forced-colours pass (IR-14, L07-08-15): a highlighted line or curve is redrawn above its halo as a copy
 * (`.astro-hl-mark`), and a `fill` on that copy paints the area inside the horizon, an almucantar or the
 * equation-of-time loop solid black. Journey cells cannot emulate forced colours, so the rule is checked here:
 * only text marks may take a fill.
 */
describe('forced-colours highlight marks', () => {
  const fills = forcedColorRules().filter(([selector, body]) => /\.astro-hl-mark/.test(selector) && /(^|[;\s])fill\s*:/.test(body));
  it('has a fill rule for the redrawn text marks', () => {
    expect(fills.length).toBeGreaterThan(0);
  });
  it('gives a fill only to text marks, never to line or curve marks', () => {
    for (const [selector] of fills) {
      for (const part of selector.split(',')) {
        if (/\.astro-hl-mark/.test(part)) expect(part.trim(), `selector "${part.trim()}"`).toMatch(/^text\.astro-hl-mark/);
      }
    }
  });
});
