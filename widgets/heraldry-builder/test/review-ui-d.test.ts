// Phase-D builder UI review fixes (/workspace/pd/review/findings-ui.md, U-*): the chip rows of "Facing, turning and details…" laid out
// several to a line (U-2; where a refused option's explanation opens, U-1, is pinned by the journey state `explainer-under-row`), plural
// pieces in the gloss (U-4), a star's points before the way it is turned (U-5), the Upright chip (U-6), the Turned row of a charge with no
// set top (U-7, U-10), the natural-colours chips' own heading (U-8) and searching for a head or a demi charge (U-9).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { ChargesStep } from '../src/components/design/BuilderSteps';
import { setCharge, setFacing, setHold, setModifier, setOrientation, setPart, DEFAULT_DESIGN } from '../src/lib/builder';
import { blazon, gloss, orientationChoices, searchCharges, searchesForm, type Design } from '../src/lib/heraldry';
import { setCount } from './helpers';

const noop = () => {};
const render = (d: Design) => renderToString(h(ChargesStep, { onChange: noop, issues: [], accordion: null, shape: 'heater' as const, n: 3, design: d, onAdjust: noop, adjusted: null }));
type Id = Parameters<typeof setCharge>[2];
const pictured = (id: Id) => setCharge(DEFAULT_DESIGN, 'picture', id);
/** The class of each chip row (radiogroup) in the markup, by its test id. */
const rowClasses = (html: string) => Object.fromEntries([...html.matchAll(/<div role="radiogroup" aria-label="[^"]*" data-testid="([^"]*)" class="([^"]*)"/g)].map((m) => [m[1], m[2]]));

describe('U-2: the disclosure\'s chip rows on a phone', () => {
  it('lays word and preview rows in a grid and a star\'s points in one compact row, never one wide chip per line', () => {
    const lion = setHold(setPart(setFacing(pictured('lion'), [0], 'to-sinister'), [0], 'crowned', true), [0], 'sword');
    const classes = rowClasses(render(lion));
    for (const row of ['facing', 'gaze', 'form', 'hold-how']) expect(classes[row], row).toBe('segmented chip-grid');
    expect(render(lion)).toContain('<div class="segmented chip-grid" role="group" aria-label="Drawn">');
    const mullet = setModifier(setOrientation(pictured('mullet'), [0], 'inverted'), [0], 'of-points', true, { count: 6, paint: null });
    const star = rowClasses(render(mullet));
    expect(star.turned).toBe('segmented chip-grid chip-grid-previews');
    expect(star.points).toBe('segmented');
    const disclosure = (html: string) => html.slice(html.indexOf('data-testid="charge-more"'));
    expect(disclosure(render(lion)) + disclosure(render(mullet))).not.toContain('segmented-wide');
  });

  it('fits two word chips, and two previewed chips, in the about 270 px a 390 px phone leaves the nested Details', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    const min = (rule: string) => Number(new RegExp(`\\${rule} \\{[^}]*minmax\\((\\d+)px`).exec(css)![1]);
    for (const rule of ['.chip-grid', '.chip-grid-previews']) expect(2 * min(rule) + 6, rule).toBeLessThanOrEqual(270);
  });
});

describe('U-4: a group\'s pieces in the gloss', () => {
  it('gives two or three charges crowns, collars and stems, one charge one', () => {
    const lions = setCount(setPart(pictured('lion'), [0], 'crowned', true), [0], 2);
    expect(gloss(lions)).toContain('two gold lions rearing up, wearing red crowns');
    expect(gloss(setPart(pictured('lion'), [0], 'crowned', true))).toContain('a gold lion rearing up, wearing a red crown');
    expect(gloss(setCount(setPart(pictured('wolf'), [0], 'collared', true), [0], 3))).toContain('with red collars');
    expect(gloss(setCount(setModifier(pictured('rose'), [0], 'slipped', true), [0], 3))).toContain('on green stems');
  });
});

describe('U-5: a star\'s points come straight after its noun', () => {
  const six = setModifier(pictured('mullet'), [0], 'of-points', true, { count: 6, paint: null });
  it('blazons "a mullet of six points inverted voided", as the SCA armorial does', () => {
    const d = setOrientation(setModifier(six, [0], 'voided', true), [0], 'inverted');
    expect(blazon(d)).toContain('a mullet of six points inverted voided Or');
  });
  it('glosses the way it is turned before its holes', () => {
    const d = setCount(setOrientation(setModifier(six, [0], 'pierced', true), [0], 'inverted'), [0], 3);
    expect(blazon(d)).toContain('three mullets of six points inverted pierced');
    expect(gloss(d)).toContain('six-pointed stars upside down with round holes');
  });
});

describe('U-6, U-7, U-10: the Turned row', () => {
  it('lists a charge with no set top only the ways it is turned, upright saying what it adds', () => {
    expect(orientationChoices(pictured('rose'), [0]).map((c) => c.value)).toEqual([null, 'palewise', 'inverted']);
    const html = render(setOrientation(pictured('mullet'), [0], 'palewise'));
    expect(html).toContain('Upright, even on a band');
    expect(html).not.toContain('looks the same turned');
  });
  it('still blocks, with SCA\'s reason, the ways a charge with a top is not turned', () => {
    const crescent = orientationChoices(pictured('crescent'), [0]);
    expect(crescent.filter((c) => !c.allowed).map((c) => c.reason)).toContain('One crescent has no group to point to the middle of.');
  });
});

describe('U-8: the natural-colours chips', () => {
  it('have a visible heading of their own, apart from the How row and the tinctures', () => {
    expect(render(setHold(pictured('lion'), [0], 'sword'))).toContain('<p class="picker-legend">Natural colours of the sword</p>');
    expect(render(setModifier(pictured('heart'), [0], 'enflamed', true))).toContain('<p class="picker-legend">Natural colours of the flames</p>');
  });
});

describe('U-9: searching for a head or a front half', () => {
  it('finds the charges drawn that way, and says where their Shape row is', () => {
    expect(searchCharges('wolf head')).toContain('wolf');
    expect(searchCharges("wolf's head")).toContain('wolf');
    expect(searchCharges('heads')).toEqual(expect.arrayContaining(['lion', 'wolf']));
    expect(searchCharges('demi')).toEqual(expect.arrayContaining(['lion', 'eagle']));
    expect(searchCharges('demi')).not.toContain('mullet');
    expect(['wolf head', 'demi', 'heads'].map(searchesForm)).toEqual([true, true, true]);
    expect(['wolf', 'star', '', 'skull', 'jambe'].map(searchesForm)).toEqual([false, false, false, false, false]);
  });
});
