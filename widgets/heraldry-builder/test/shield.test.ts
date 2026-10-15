// The Shield component over render layers: one group per layer, transforms from the slots, ids unique
// per instance and per group.

import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { PatternDef, Shield, nextShieldUid } from '../src/components/Shield';
import { gloss, groupSlots, renderLayers, slotTransform, type Design, type FieldShape } from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const render = (design: Design, props: { shape?: FieldShape; hatching?: boolean; size?: number; label?: string | null } = {}) =>
  renderToString(h(Shield, { design, shape: props.shape ?? 'heater', hatching: props.hatching, size: props.size, label: props.label }));

const attrs = (svg: string, name: string) => [...svg.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((m) => m[1]);

/** Two charge groups of one tincture: roses on the field and roses on a chief. */
const two = nd(arms(
  'gules',
  group(charge('rose'), 'or', { count: 3 }),
  group(ordinary('chief'), 'argent', { charged: [group(charge('rose'), 'or', { count: 2 })] }),
));

describe('Shield layers', () => {
  it('draws one group per layer, in order, naming the group', () => {
    const svg = render(two);
    const layers = renderLayers(two, 'heater');
    const drawn = [...svg.matchAll(/<g data-layer="(\w+)"(?: data-group="([\d.]+)")?/g)].map((m) => [m[1], m[2] ?? null]);
    expect(drawn).toEqual([['field', null], ['charges', '0'], ['ordinary', '1'], ['charges', '1.0']]);
    expect(drawn).toHaveLength(layers.length);
  });

  it('places charges with the slot transforms', () => {
    const svg = render(two);
    const layers = renderLayers(two, 'heater');
    for (const l of layers) if (l.k === 'charges') for (const s of l.slots) expect(svg).toContain(`transform="${slotTransform(s)}"`);
    expect(groupSlots(two, [0], 'heater')).toHaveLength(3);
  });

  it('turns charges on a bend', () => {
    const d = nd(arms('azure', group(ordinary('bend'), 'or', { charged: [group(charge('mullet'), 'argent', { count: 3 })] })));
    expect(render(d)).toContain('transform="rotate(-45 ');
  });

  it('names the paint of every painted shape and draws an outline per charge', () => {
    const svg = render(two);
    expect(attrs(svg, 'data-paint')).toEqual(['gu', 'or', 'or', 'or', 'ar', 'or', 'or']);
    expect((svg.match(/stroke-width="0\.75"/g) ?? []).length).toBe(5);
  });

  it('draws every shape', () => {
    for (const shape of ['heater', 'banner', 'round', 'lozenge'] as const) {
      const svg = render(two, { shape });
      expect(svg).toContain(`data-shape="${shape}"`);
      expect(svg).toContain('data-layer="charges"');
    }
  });

  it('draws a counterchanged element per region and only an outline when it cannot be counterchanged', () => {
    const d = nd(arms(div('per-pale', 'or', 'azure'), group(ordinary('fess'), 'counterchanged')));
    const svg = render(d);
    expect(svg).toContain('clip-path="url(#region-clip-');
    expect(attrs(svg, 'id').filter((i) => i.startsWith('region-clip-'))).toHaveLength(2);
    const plain = render(nd(arms('or', group(charge('mullet'), 'counterchanged', { count: 3 }))));
    expect(attrs(plain, 'data-paint')).toEqual(['or']);
    expect(plain).toContain('data-layer="charges"');
  });
});

describe('pattern fills', () => {
  it('define a tile of their ground and marks, scaled by the spec, under an id of this shield', () => {
    const spec = { id: 'dots', width: 4, height: 6, transform: 'scale(2)', ground: { k: 'tincture', t: 'argent' }, marks: [{ d: 'M1 1h2v2h-2z', colour: { k: 'tincture', t: 'sable' } }] } as const;
    const svg = renderToString(h('svg', null, h(PatternDef, { spec, ids: { pattern: (s: typeof spec) => `pattern-s1-${s.id}` } as never })));
    expect(attrs(svg, 'id')).toEqual(['pattern-s1-dots']);
    expect(attrs(svg, 'patternTransform')).toEqual(['scale(2)']);
    expect(attrs(svg, 'fill')).toEqual(['#FFFFFF', '#141414']);
  });
});

describe('Shield labels and sizes', () => {
  it('is named by its gloss unless given a label, and decorative with a null label', () => {
    const named = render(two);
    expect(named).toContain(`aria-label="${gloss(two)}"`);
    expect(named).toContain('role="img"');
    expect(render(two, { label: null })).toContain('aria-hidden="true"');
    const labelled = render(two, { label: 'Gules, three roses' });
    expect(labelled).toContain('aria-label="Gules, three roses"');
    expect(labelled).toContain('role="img"');
  });

  it('sizes the height at 1.2 times the width', () => {
    const svg = render(two, { size: 100 });
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="120"');
  });
});

describe('Shield ids', () => {
  it('hands out unique ids per instance', () => {
    const ids = Array.from({ length: 50 }, () => nextShieldUid());
    expect(new Set(ids).size).toBe(50);
    expect(ids.every((i) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(i))).toBe(true);
  });

  it('gives every id on a shield once, even with two charge groups of one tincture', () => {
    const svg = render(two, { hatching: true });
    const ids = attrs(svg, 'id');
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((i) => i.startsWith('hatch-') && i.includes('-g'))).toEqual(expect.arrayContaining([expect.stringMatching(/-g0-or$/), expect.stringMatching(/-g1\.0-or$/)]));
  });

  it('gives different shields different ids', () => {
    const a = attrs(render(two, { hatching: true }), 'id'), b = attrs(render(two, { hatching: true }), 'id');
    expect(a.filter((i) => b.includes(i))).toEqual([]);
  });

  it('only refers to ids it defines', () => {
    const svg = render(nd(arms(div('per-bend', 'or', 'azure'), group(charge('mullet'), 'counterchanged', { count: 3 }), group(ordinary('chief'), 'gules'))), { hatching: true });
    const defined = new Set(attrs(svg, 'id'));
    for (const ref of [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1])) expect(defined.has(ref), ref).toBe(true);
  });
});

describe('Shield hatching', () => {
  it('overlays patterns only when asked, and not for argent', () => {
    expect(render(two)).not.toContain('<pattern');
    const svg = render(two, { hatching: true });
    expect(svg).toContain('<pattern');
    expect(attrs(svg, 'id').filter((i) => i.endsWith('-argent'))).toHaveLength(0);
    expect(attrs(svg, 'id').filter((i) => i.endsWith('-or'))).toHaveLength(3);
    const gold = render(nd(arms('or', group(charge('rose'), 'gules', { count: 3 }))), { hatching: true });
    expect(attrs(gold, 'id').some((i) => i.endsWith('-or'))).toBe(true);
    expect(attrs(gold, 'id').some((i) => i.includes('-g0-gules'))).toBe(true);
  });
});
