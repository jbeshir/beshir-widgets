// The paint-ordered layers of a design: order, fills, counterchanged elements, and the art variants.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, MIRRORED, ORIENTATION_ANGLE, UPRIGHT, artPose, chargePath, chargeTransform, orientationTurns, pathRings, turnFit, designTinctures, drawnBox, fieldRegions, fillCode, fillHatchTinctures, groupSlots, renderLayers, slotTransform, solidFill,
  type Charge, type ChargeId, type Design, type FieldShape, type Fill, type Layer, type Orientation, type Posture,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

/** The drawing of a whole charge in a posture with its modifiers. */
const art = (id: ChargeId, posture: Posture | null, mods: Charge['mods']) => chargePath({ charge: id, form: null, posture, gaze: null, mods });

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
    expect(l.parts[0].fill).toEqual(solidFill('or'));
    expect(l.parts[0].fillRule).toBe('evenodd');
    expect(layer(nd(arms('azure', group(ordinary('fess'), 'or'))), 1, 'ordinary').parts[0].fillRule).toBe('nonzero');
  });

  it('fill a counterchanged ordinary once for each field region it lies on', () => {
    const fess = layer(nd(arms(div('per-pale', 'or', 'azure'), group(ordinary('fess'), 'counterchanged'))), 1, 'ordinary');
    expect(painted(fess.parts[0].fill).map((f) => f.tincture)).toEqual(['azure', 'or']);
    expect(painted(fess.parts[0].fill).every((f) => f.clip !== null)).toBe(true);
    const chief = layer(nd(arms(div('per-fess', 'or', 'azure'), group(ordinary('chief'), 'counterchanged'))), 1, 'ordinary');
    expect(painted(chief.parts[0].fill).map((f) => f.tincture)).toEqual(['azure']);
  });

  it('paint nothing when counterchanged on a plain field', () => {
    expect(painted(layer(nd(arms('or', group(ordinary('fess'), 'counterchanged'))), 1, 'ordinary').parts[0].fill)).toEqual([]);
  });
});

describe('charge layers', () => {
  it('draw the drawn boxes of the group in its paint', () => {
    const d = nd(arms('azure', group(charge('sword'), 'or', { count: 2, arrangement: 'in-fess' })));
    const l = layer(d, 1, 'charges');
    expect(l.slots).toEqual(groupSlots(d, [0], 'heater').map((s) => drawnBox(s, { charge: 'sword', form: null, posture: null, gaze: null })));
    expect(l.slots.map(slotTransform)).toHaveLength(2);
    expect(l.fills).toEqual([{ fill: solidFill('or'), slots: [0, 1] }]);
    expect(l.art).toBe(art('sword', null, []));
    expect(l.poses).toEqual([UPRIGHT, UPRIGHT]);
  });

  it('draw the art upright as the slot places it', () => {
    for (const s of [{ x: 50, y: 54, size: 90, rotation: 0 }, { x: 30, y: 40, size: 20, rotation: -45 }]) expect(chargeTransform(s, UPRIGHT)).toBe(slotTransform(s));
  });

  it('draw the art mirrored about the middle of its box, inside the slot\'s own placing and turn', () => {
    const s = { x: 30, y: 40, size: 20, rotation: -45 };
    expect(chargeTransform(s, MIRRORED)).toBe(`${slotTransform(s)} translate(50 50) scale(-1 1) translate(-50 -50)`);
  });

  it('turn the art about the middle of its box and scale it, inside the slot\'s own placing and turn, mirrored first', () => {
    const s = { x: 30, y: 40, size: 20, rotation: -45 };
    expect(chargeTransform(s, { mirror: false, turn: 90, fit: 1 })).toBe(`${slotTransform(s)} rotate(90 50 50)`);
    expect(chargeTransform(s, { mirror: true, turn: -45, fit: 0.8 })).toBe(`${slotTransform(s)} rotate(-45 50 50) translate(50 50) scale(-0.8 0.8) translate(-50 -50)`);
  });

  it('refit a turned drawing so that its bounding box is no longer than upright, and turned off its axis within its slot\'s disc', () => {
    const blade = 'M40 7L60 7L60 93L40 93Z', square = 'M7 7L93 7L93 93L7 93Z';
    expect([turnFit(blade, 0), turnFit(blade, 90), turnFit(blade, 180)]).toEqual([1, 1, 1]);
    expect(turnFit(blade, 45)).toBe(1);
    expect(turnFit(square, -45)).toBe(0.707);
    expect(artPose(square, true, 45, 1)).toEqual({ mirror: true, turn: 45, fit: 0.707 });
    expect(artPose(blade, false, 90, 1.15)).toEqual({ mirror: false, turn: 90, fit: Math.floor(45_000 / (Math.hypot(10, 43) * 1.15)) / 1000 });
    expect(artPose(blade, false, 180, 1.15).fit).toBe(1);
  });

  it('turn each charge by its orientation less the slot\'s own turn, and to center slot by slot', () => {
    const slots = [{ x: 50, y: 30, size: 20, rotation: 0 }, { x: 30, y: 50, size: 20, rotation: 0 }, { x: 70, y: 50, size: 20, rotation: 0 }, { x: 50, y: 70, size: 20, rotation: 0 }];
    expect(orientationTurns('to-center', CHARGES.sword.orient, slots)).toEqual([180, 90, -90, 0]);
    expect(orientationTurns('fesswise', CHARGES.sword.orient, [{ x: 50, y: 50, size: 20, rotation: -45 }])).toEqual([-45]);
    expect(orientationTurns('bendwise-sinister-inverted', CHARGES.sword.orient, slots.slice(0, 1))).toEqual([ORIENTATION_ANGLE['bendwise-sinister-inverted']]);
    expect(orientationTurns(null, CHARGES.sword.orient, slots)).toEqual([0, 0, 0, 0]);
    // GoT Table 5: an arrow and a pheon are drawn point to base, so their base points to center; a feather fesswise lies quill to dexter
    expect(orientationTurns('to-center', CHARGES.arrow.orient, slots)).toEqual([0, -90, 90, 180]);
    expect(orientationTurns('to-center', CHARGES.pheon.orient, slots)).toEqual([0, -90, 90, 180]);
    expect(orientationTurns('to-center', CHARGES.arrow.orient, [{ x: 50, y: 50, size: 20, rotation: 0 }])).toEqual([0]);
    expect(orientationTurns('fesswise', CHARGES.arrow.orient, slots.slice(0, 1))).toEqual([-90]);
    expect(['fesswise', 'fesswise-reversed', 'bendwise', 'bendwise-sinister', 'inverted'].map((o) => orientationTurns(o as Orientation, CHARGES.feather.orient, slots.slice(0, 1))[0]))
      .toEqual([90, -90, 135, -135, 180]);
  });

  it('draw arrows in annulo points to center with each head nearer the middle than its nock (rules review R-1)', () => {
    const d = nd(arms('argent', group(charge('arrow', { orientation: 'to-center' }), 'sable', { count: 8, arrangement: 'in-annulo' })));
    const { art: drawing, slots, poses } = layer(d, 1, 'charges');
    const points = pathRings(drawing).flat();
    const [head, nock] = [points.reduce((a, p) => (p[1] > a[1] ? p : a)), points.reduce((a, p) => (p[1] < a[1] ? p : a))];
    const middle = { x: slots.reduce((n, s) => n + s.x, 0) / slots.length, y: slots.reduce((n, s) => n + s.y, 0) / slots.length };
    // a point of the drawing where it lies on the shield: turned about the middle of its box, then the slot's turn and place
    const onShield = ([x, y]: readonly number[], s: (typeof slots)[number], turn: number) => {
      const a = ((turn + s.rotation) * Math.PI) / 180, dx = (x - 50) * s.size / 100, dy = (y - 50) * s.size / 100;
      return { x: s.x + dx * Math.cos(a) - dy * Math.sin(a), y: s.y + dx * Math.sin(a) + dy * Math.cos(a) };
    };
    const far = (p: { x: number; y: number }) => Math.hypot(p.x - middle.x, p.y - middle.y);
    expect(slots).toHaveLength(8);
    slots.forEach((s, i) => expect(far(onShield(head, s, poses[i].turn)), `slot ${i}`).toBeLessThan(far(onShield(nock, s, poses[i].turn))));
  });

  it('pose a turned or reversed charge, and leave the follow turn of charges on a bend as it was', () => {
    const poses = (item: object, extra: object = {}) => layer(nd(arms('azure', group(charge('sword', item), 'or', extra))), 1, 'charges').poses;
    expect(poses({ orientation: 'fesswise' })).toEqual([artPose(art('sword', null, []), false, -90, CHARGES.sword.scale)]);
    expect(poses({ orientation: 'reversed' })).toEqual([MIRRORED]);
    expect(poses({ orientation: 'to-center' }, { count: 4, arrangement: 'in-cross' }).map((p) => p.turn)).toEqual([180, 90, -90, 0]);
    const onBend = (item: object) => layer(nd(arms('azure', group(ordinary('bend'), 'argent', { charged: [group(charge('sword', item), 'gules', { count: 3 })] }))), 2, 'charges').poses;
    expect(onBend({})).toEqual([UPRIGHT, UPRIGHT, UPRIGHT]);
    expect(onBend({ orientation: 'bendwise' }).map((p) => p.turn)).toEqual([0, 0, 0]);
    expect(onBend({ orientation: 'palewise' }).map((p) => p.turn)).toEqual([45, 45, 45]);
  });

  it('turn the division of a turned charge and the split of a proper one with it', () => {
    const fills = (paint: unknown, item: object) => layer(nd(arms('azure', group(charge('sword', item), paint))), 1, 'charges').fills;
    expect(fills(div('per-pale', 'or', 'argent'), { orientation: 'fesswise' })).not.toEqual(fills(div('per-pale', 'or', 'argent'), {}));
    const flame = (item: object) => layer(nd(arms('azure', group(charge('flame', item), 'proper'))), 1, 'charges').fills;
    expect(flame({ orientation: 'inverted' })).not.toEqual(flame({}));
  });

  it('mirror every charge facing to sinister (contourny), and nothing else', () => {
    expect(layer(nd(arms('azure', group(charge('lion', { facing: 'to-sinister' }), 'or', { count: 3 }))), 1, 'charges').poses).toEqual([MIRRORED, MIRRORED, MIRRORED]);
    expect(layer(nd(arms('azure', group(charge('lion'), 'or', { count: 2 }))), 1, 'charges').poses).toEqual([UPRIGHT, UPRIGHT]);
  });

  it('lay a pair out as two in fess, the dexter one first, and mirror the dexter one facing in, the sinister one addorsed', () => {
    const pair = (word: string, ...before: object[]) => nd(arms('azure', ...before, group(charge('lion'), 'or', { count: 2, arrangement: { k: 'pair', pair: word } })));
    const fess = nd(arms('azure', group(charge('lion'), 'or', { count: 2, arrangement: 'in-fess' })));
    for (const word of ['combattant', 'addorsed']) expect(groupSlots(pair(word), [0], 'heater')).toEqual(groupSlots(fess, [0], 'heater'));
    const [dexter, sinister] = groupSlots(pair('combattant'), [0], 'heater');
    expect(dexter.x).toBeLessThan(sinister.x);
    expect(layer(pair('combattant'), 1, 'charges').poses).toEqual([MIRRORED, UPRIGHT]);
    expect(layer(pair('addorsed'), 1, 'charges').poses).toEqual([UPRIGHT, MIRRORED]);
    // around a pale, too: the dexter one first
    const pale = pair('addorsed', group(ordinary('pale'), 'argent'));
    const [left, right] = groupSlots(pale, [1], 'heater');
    expect(left.x).toBeLessThan(right.x);
    expect(layer(pale, 2, 'charges').poses).toEqual([UPRIGHT, MIRRORED]);
  });

  it('turn each of a pair facing each other toward the other and each of a pair back to back away from it: whole, heads and demi charges', () => {
    // The art faces dexter (house style), a head's too: its mouth is on its dexter side.
    for (const id of ['lion', 'wolf'] as const) expect(CHARGES[id].drawings.head!.anchors.mouth!.x, id).toBeLessThan(50);
    for (const form of [null, 'head', 'demi'] as const) {
      const pair = (word: string) => nd(arms('azure', group(charge('lion', { form }), 'or', { count: 2, arrangement: { k: 'pair', pair: word } })));
      for (const word of ['combattant', 'respectant']) {
        const [dexter, sinister] = groupSlots(pair(word), [0], 'heater');
        expect(dexter.x, `${form} ${word}`).toBeLessThan(sinister.x);
        // the dexter one mirrored to face sinister, toward the other; the sinister one as drawn, facing dexter
        expect(layer(pair(word), 1, 'charges').poses, `${form} ${word}`).toEqual([MIRRORED, UPRIGHT]);
      }
      expect(layer(pair('addorsed'), 1, 'charges').poses, `${form} addorsed`).toEqual([UPRIGHT, MIRRORED]);
    }
  });

  it('mirror the line of a divided or striped charge with it, its tinctures dexter or chief first', () => {
    const fills = (paint: unknown, item: object = {}) => layer(nd(arms('azure', group(charge('lion', item), paint))), 1, 'charges').fills;
    const contourny = { facing: 'to-sinister' };
    expect(fills(div('per-bend', 'or', 'argent'), contourny)).toEqual(fills(div('per-bend-sinister', 'or', 'argent')));
    expect(fills(div('per-pale', 'or', 'argent'), contourny)).toEqual(fills(div('per-pale', 'or', 'argent')));
    const bendy = (variation: string) => ({ k: 'variation', variation, parts: ['or', 'argent'] });
    expect(fills(bendy('bendy'), contourny)).toEqual(fills(bendy('bendy-sinister')));
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
    expect(art('hare', 'courant', [])).not.toBe(art('hare', 'sejant', []));
    expect(art('hare', 'courant', []).startsWith('M7 67.1')).toBe(true);
  });

  it('draws a sun in splendour as the sun with a face cut out', () => {
    const plain = art('sun', null, []);
    const splendour = art('sun', null, [{ id: 'in-splendour', count: null, paint: null }]);
    expect(splendour.startsWith(plain)).toBe(true);
    expect(splendour.length).toBeGreaterThan(plain.length);
    // Two eyes and a mouth: three more subpaths.
    expect(splendour.split('M').length - plain.split('M').length).toBe(3);
    expect(art('sun', null, [])).toBe(plain);
  });

  it('draws a sun in splendour on the shield', () => {
    const d = nd(arms('azure', group({ k: 'charge', charge: 'sun', mods: [{ id: 'in-splendour' }] }, 'or')));
    expect(layer(d, 1, 'charges').art).toBe(art('sun', null, [{ id: 'in-splendour', count: null, paint: null }]));
  });

  it('falls back to the default posture and then to the posture-less drawing', () => {
    expect(art('lion', 'statant-erect', [])).toBe(art('lion', 'rampant', []));
    expect(art('rose', null, [])).toBe(art('rose', 'rampant', []));
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
