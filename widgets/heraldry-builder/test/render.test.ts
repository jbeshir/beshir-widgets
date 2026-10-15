// The paint-ordered layers of a design: order, fills, counterchanged elements, and the art variants.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, chargePath, designTinctures, drawnBox, fieldRegions, fillCode, fillHatchTinctures, groupSlots, renderLayers, slotTransform, solidFill,
  type Design, type FieldShape, type Fill, type Layer,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const kinds = (d: Design, shape: FieldShape = 'heater') => renderLayers(d, shape).map((l) => (l.k === 'field' ? 'field' : `${l.k}:${l.path.join('.')}`));
const layer = <K extends Layer['k']>(d: Design, i: number, k: K, shape: FieldShape = 'heater') => {
  const l = renderLayers(d, shape)[i];
  expect(l.k).toBe(k);
  return l as Extract<Layer, { k: K }>;
};

/** What a flat or split fill paints: each solid part with the clip path it is cut to (null: not cut). */
const painted = (f: Fill): Array<{ tincture: string; clip: string | null }> => {
  if (f.k === 'solid') return [{ tincture: f.colour.k === 'tincture' ? f.colour.t : f.colour.hex, clip: null }];
  if (f.k === 'split') return f.parts.flatMap((p) => painted(p.fill).map((x) => ({ tincture: x.tincture, clip: p.clip })));
  throw new RangeError('A pattern has no single tincture.');
};

describe('layer order', () => {
  it('draws the field first, then the groups in canonical order, each followed by what is on it', () => {
    expect(kinds(nd(arms('azure')))).toEqual(['field']);
    expect(kinds(nd(arms('azure', group(ordinary('bend'), 'or'))))).toEqual(['field', 'ordinary:0']);
    expect(kinds(nd(arms('azure', group(ordinary('bend'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] })))))
      .toEqual(['field', 'ordinary:0', 'charges:0.0']);
    expect(kinds(nd(arms('vert', group(ordinary('chevron'), 'or'), group(charge('rose'), 'argent', { count: 3, relation: 'between' })))))
      .toEqual(['field', 'ordinary:0', 'charges:1']);
    expect(kinds(nd(arms('gules', group(charge('mullet'), 'argent', { count: 3 }), group(ordinary('chief'), 'or')))))
      .toEqual(['field', 'charges:0', 'ordinary:1']);
    expect(kinds(nd(arms('sable', group(charge('lion'), 'or'), group(ordinary('bordure'), 'argent')))))
      .toEqual(['field', 'charges:0', 'ordinary:1']);
    expect(kinds(nd(arms('gules', group(charge('mullet'), 'argent', { count: 3 }), group(ordinary('chief'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] })))))
      .toEqual(['field', 'charges:0', 'ordinary:1', 'charges:1.0']);
  });

  it('lists every group with a layer whatever its shape', () => {
    for (const shape of ['heater', 'banner', 'round', 'lozenge'] as const) {
      const d = nd(arms(div('per-pale', 'or', 'azure'), group(ordinary('fess'), 'gules', { charged: [group(charge('mullet'), 'argent', { count: 3 })] })));
      expect(kinds(d, shape), shape).toEqual(['field', 'ordinary:0', 'charges:0.0']);
    }
  });

  it('draws a badge as its charges alone, whatever the shape', () => {
    for (const shape of ['heater', 'banner', 'round', 'lozenge'] as const) {
      expect(kinds(nd({ v: 2, kind: 'badge', groups: [group(charge('lion'), 'or', { charged: [group(charge('rose'), 'gules')] })] }), shape), shape).toEqual(['charges:0', 'charges:0.0']);
    }
    expect(renderLayers({ v: 2, kind: 'badge', field: null, groups: [] }, 'heater')).toEqual([]);
  });
});

describe('the field layer', () => {
  it('has one region for a plain field and two for a divided one', () => {
    const plain = layer(nd(arms('azure')), 0, 'field');
    expect(plain.fill).toEqual(solidFill('azure'));
    expect(plain.outline).toBe(fieldRegions({ k: 'tincture', t: 'azure' }, 'heater')[0].d);
    const bend = layer(nd(arms(div('per-bend', 'or', 'sable'))), 0, 'field');
    const regions = painted(bend.fill);
    expect(regions.map((r) => r.tincture)).toEqual(['or', 'sable']);
    expect(regions[0].clip).not.toBe(regions[1].clip);
    expect(bend.outline).toBe(plain.outline);
  });
});

describe('ordinary layers', () => {
  it('fill a plain ordinary in one tincture', () => {
    const l = layer(nd(arms('azure', group(ordinary('bordure'), 'or'))), 1, 'ordinary');
    expect(l.fill).toEqual(solidFill('or'));
    expect(l.fillRule).toBe('evenodd');
    expect(layer(nd(arms('azure', group(ordinary('fess'), 'or'))), 1, 'ordinary').fillRule).toBe('nonzero');
  });

  it('fill a counterchanged ordinary once for each field region it lies on', () => {
    const fess = layer(nd(arms(div('per-pale', 'or', 'azure'), group(ordinary('fess'), 'counterchanged'))), 1, 'ordinary');
    expect(painted(fess.fill).map((f) => f.tincture)).toEqual(['azure', 'or']);
    expect(painted(fess.fill).every((f) => f.clip !== null)).toBe(true);
    const chief = layer(nd(arms(div('per-fess', 'or', 'azure'), group(ordinary('chief'), 'counterchanged'))), 1, 'ordinary');
    expect(painted(chief.fill).map((f) => f.tincture)).toEqual(['azure']);
  });

  it('paint nothing when counterchanged on a plain field', () => {
    expect(painted(layer(nd(arms('or', group(ordinary('fess'), 'counterchanged'))), 1, 'ordinary').fill)).toEqual([]);
  });
});

describe('charge layers', () => {
  it('draw the drawn boxes of the group in its paint', () => {
    const d = nd(arms('azure', group(charge('sword'), 'or', { count: 2, arrangement: 'in-fess' })));
    const l = layer(d, 1, 'charges');
    expect(l.slots).toEqual(groupSlots(d, [0], 'heater').map((s) => drawnBox(s, 'sword')));
    expect(l.slots.map(slotTransform)).toHaveLength(2);
    expect(l.fills).toEqual([{ fill: solidFill('or'), slots: [0, 1] }]);
    expect(l.art).toBe(chargePath('sword', null, []));
  });

  it('split counterchanged charges by the region each lies on', () => {
    const d = nd(arms(div('per-pale', 'or', 'azure'), group(charge('mullet'), 'counterchanged', { count: 3 })));
    const l = layer(d, 1, 'charges');
    expect(l.fills.flatMap((f) => painted(f.fill).map((p) => p.tincture)).sort()).toEqual(['azure', 'or']);
    const orFill = l.fills.find((f) => painted(f.fill)[0].tincture === 'or')!;
    expect(painted(orFill.fill)[0].clip).not.toBeNull();
    expect(orFill.slots.length).toBeGreaterThan(0);
    // Every charge is painted in at least one region.
    expect(new Set(l.fills.flatMap((f) => f.slots))).toEqual(new Set([0, 1, 2]));
  });

  it('paint a charge crossing the line in both regions', () => {
    const d = nd(arms(div('per-pale', 'or', 'azure'), group(charge('lion'), 'counterchanged')));
    const l = layer(d, 1, 'charges');
    expect(l.fills.map((f) => f.slots)).toEqual([[0], [0]]);
  });

  it('have no fills when counterchanged on a plain field or on a host', () => {
    expect(layer(nd(arms('or', group(charge('mullet'), 'counterchanged', { count: 3 }))), 1, 'charges').fills).toEqual([]);
    const onHost = nd(arms(div('per-pale', 'or', 'azure'), group(ordinary('fess'), 'gules', { charged: [group(charge('mullet'), 'counterchanged', { count: 3 })] })));
    expect(layer(onHost, 2, 'charges').fills).toEqual([]);
  });

  it('turn charges on a bend with the bend', () => {
    const d = nd(arms('azure', group(ordinary('bend'), 'or', { charged: [group(charge('mullet'), 'argent', { count: 3 })] })));
    expect(layer(d, 2, 'charges').slots.map((s) => s.rotation)).toEqual([-45, -45, -45]);
    expect(layer(d, 2, 'charges').slots.every((s) => slotTransform(s).startsWith('rotate(-45 '))).toBe(true);
  });

  it('scale every slot by the charge', () => {
    const d = nd(arms('azure', group(charge('sword'), 'or')));
    const l = layer(d, 1, 'charges');
    expect(l.slots[0].size).toBeCloseTo(90 * CHARGES.sword.scale, 1);
  });
});

describe('charge art', () => {
  it('draws the hare courant with the running hare and the sejant one sitting', () => {
    expect(chargePath('hare', 'courant', [])).not.toBe(chargePath('hare', 'sejant', []));
    expect(chargePath('hare', 'courant', []).startsWith('M7 67.1')).toBe(true);
  });

  it('draws a sun in splendour as the sun with a face cut out', () => {
    const plain = chargePath('sun', null, []);
    const splendour = chargePath('sun', null, [{ id: 'in-splendour', count: null, paint: null }]);
    expect(splendour.startsWith(plain)).toBe(true);
    expect(splendour.length).toBeGreaterThan(plain.length);
    // Two eyes and a mouth: three more subpaths.
    expect(splendour.split('M').length - plain.split('M').length).toBe(3);
    expect(chargePath('sun', null, [])).toBe(plain);
  });

  it('draws a sun in splendour on the shield', () => {
    const d = nd(arms('azure', group({ k: 'charge', charge: 'sun', mods: [{ id: 'in-splendour' }] }, 'or')));
    expect(layer(d, 1, 'charges').art).toBe(chargePath('sun', null, [{ id: 'in-splendour', count: null, paint: null }]));
  });

  it('falls back to the default posture and then to the posture-less drawing', () => {
    expect(chargePath('lion', 'courant', [])).toBe(chargePath('lion', 'rampant', []));
    expect(chargePath('rose', null, [])).toBe(chargePath('rose', 'rampant', []));
  });
});

describe('fills', () => {
  const split: Fill = { k: 'split', parts: [{ clip: 'M0 0', fill: solidFill('azure') }, { clip: 'M1 1', fill: solidFill('or') }] };
  const pattern: Fill = {
    k: 'pattern',
    spec: { id: 'dots', width: 4, height: 4, transform: null, ground: { k: 'tincture', t: 'argent' }, marks: [{ d: 'M1 1h2v2h-2z', colour: { k: 'tincture', t: 'sable' }, transform: null }] },
  };

  it('are named by a compact code that does not depend on how they are drawn', () => {
    expect(fillCode(solidFill('or'))).toBe('or');
    expect(fillCode(split)).toBe('split(az,or)');
    expect(fillCode(pattern)).toBe('pattern:dots');
    expect(fillCode({ k: 'split', parts: [] })).toBe('split()');
  });

  it('list the tinctures hatching draws for them in order of first use: a pattern only by its ground', () => {
    expect(fillHatchTinctures({ k: 'split', parts: [...split.parts, { clip: 'M2 2', fill: solidFill('azure') }] })).toEqual(['azure', 'or']);
    expect(fillHatchTinctures(pattern)).toEqual(['argent']);
    expect(fillHatchTinctures({ k: 'split', parts: [] })).toEqual([]);
    expect(fillHatchTinctures({ k: 'solid', colour: { k: 'proper', hex: '#8b5a2b' } })).toEqual([]);
  });
});

describe('designTinctures', () => {
  it('lists the tinctures in order of first use and counts counterchanged as none', () => {
    expect(designTinctures(nd(arms(div('per-pale', 'or', 'azure'), group(ordinary('fess'), 'gules'), group(charge('mullet'), 'counterchanged', { count: 3, relation: 'between' }))))).toEqual(['or', 'azure', 'gules']);
    expect(designTinctures(nd(arms('azure', group(charge('rose'), 'azure'))))).toEqual(['azure']);
  });
});
