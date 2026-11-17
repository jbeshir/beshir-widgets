import { describe, expect, it } from 'vitest';
import { chainTransforms, contrast, haloKind, haloLayer, layerFor, locatorGapOffset, luminance, redrawsMark, wantsLocator } from './highlightLayout';

// theme.css is read as text (the test runs in Node; the module name is built so the browser build never sees it).
const { readFileSync } = await import(/* @vite-ignore */ ['node', 'fs'].join(':')) as { readFileSync: (path: URL, encoding: 'utf8') => string };
const theme = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const match = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`no --${name} in theme.css`);
  return match[1];
};
const INSTRUMENT_TONES = [...theme.matchAll(/--(astro-(?:brass|gilt|steel)-[a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => ({ name: m[1], hex: m[2] }));

describe('highlight halo colours', () => {
  const rim = token('astro-highlight');
  const core = token('astro-hl-core');
  it('measures luminance the WCAG way', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 10);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 10);
  });
  it('has >= 3:1 against every brass, gilt and steel tone in one of its two tones', () => {
    expect(INSTRUMENT_TONES.length).toBeGreaterThan(15);
    for (const tone of INSTRUMENT_TONES) {
      expect(Math.max(contrast(rim, tone.hex), contrast(core, tone.hex)), tone.name).toBeGreaterThanOrEqual(3);
    }
  });
  it('matches the measured figures quoted in theme.css', () => {
    expect(contrast(rim, token('astro-brass-low'))).toBeGreaterThanOrEqual(3.49);
    expect(contrast(rim, token('astro-brass-shadow'))).toBeLessThan(2);
    expect(contrast(core, token('astro-brass-shadow'))).toBeGreaterThanOrEqual(6.8);
    expect(contrast(rim, core)).toBeGreaterThanOrEqual(12.9);
  });
});

describe('highlight halo placement', () => {
  it('tells text, strokes, metal bodies and highlight-only outlines apart', () => {
    expect(haloKind({ tag: 'text', fill: 'rgb(30, 21, 10)', outline: false })).toBe('text');
    expect(haloKind({ tag: 'line', fill: 'rgb(0, 0, 0)', outline: false })).toBe('stroke');
    expect(haloKind({ tag: 'use', fill: 'none', outline: false })).toBe('body');
    expect(haloKind({ tag: 'path', fill: 'url("#limb-roll")', outline: false })).toBe('body');
    expect(haloKind({ tag: 'path', fill: 'none', outline: true })).toBe('outline');
  });
  it('redraws engraving above its halo in its own colours, never metal', () => {
    expect(redrawsMark('text')).toBe(true);
    expect(redrawsMark('stroke')).toBe(true);
    expect(redrawsMark('body')).toBe(false);
    expect(redrawsMark('outline')).toBe(false);
  });
  it('puts metal halos beneath moving metal, and single point-like marks above the moving parts', () => {
    expect(haloLayer('body', 'rule', false)).toBe('under');
    expect(haloLayer('body', 'base', true)).toBe('over');
    expect(haloLayer('stroke', 'base', true)).toBe('top');
    expect(haloLayer('text', 'rete', true)).toBe('top');
    // A plate line (not point-like) stays on the plate, under the rete, so the rete's ticks over it stay visible.
    expect(haloLayer('stroke', 'base', false)).toBe('over');
    // A star blade stays in the rete, under the rule (IR-09); only its locator ring is lifted.
    expect(haloLayer('outline', 'rete', true)).toBe('over');
    expect(layerFor('top', 'alidade')).toBe('over');
    expect(layerFor('top', 'rete')).toBe('top');
  });
  it('draws the band round a whole scale beneath a static face\'s engraving, and over a moving part\'s metal', () => {
    expect(haloLayer('outline', 'base', false, true)).toBe('under');
    expect(haloLayer('outline', 'alidade', false, true)).toBe('over');
  });
  it('opens a locator ring\'s gap towards the given direction', () => {
    // Dash 0..260 of a 360 pattern; with offset D, path position s is at pattern position s + D: the gap's centre is 310.
    for (const gap of [0, 25, 90, 200, -120, 359]) {
      const at = (((gap + locatorGapOffset(gap)) % 360) + 360) % 360;
      expect(at).toBeCloseTo(310, 9);
    }
  });
  it('locates point-like single marks only', () => {
    expect(wantsLocator([{ tag: 'line', anchored: false }])).toBe(true);
    expect(wantsLocator([{ tag: 'text', anchored: false }])).toBe(true);
    expect(wantsLocator([{ tag: 'g', anchored: true }])).toBe(true);
    expect(wantsLocator([{ tag: 'circle', anchored: false }, { tag: 'text', anchored: false }])).toBe(false);
    expect(wantsLocator([])).toBe(false);
  });
  it('composes ancestor transforms outermost first', () => {
    expect(chainTransforms(['scale(1,-1)', null, ' translate(3 4) ', ''])).toBe('scale(1,-1) translate(3 4)');
  });
});
