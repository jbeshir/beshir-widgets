// The slot engine and the structure rules that depend on it: hand-fitted rows first, the generic engine
// for everything else, capacity ("how many fit"), and the chief rule on a field divided per fess.

import { describe, expect, it } from 'vitest';
import {
  MIN_SLOT_SIZE, minSlotSize, canonicalSlots, contextSlots, fieldContext, groupSlots, inFirstPart, layoutOfKey, ordinaryGeometry, plainSpec, defaultOrdinaryFrame, pathPolygon, pointInPolygon, probePoints,
  capacityIssue, shapeFrame, slotTransform, structuralIssues, FIELD_SHAPES, type FieldShape, type GroundContext, type Layout, type LayoutContext, type OrdinarySpec, type OrdinaryType, type Slot,
} from '../src/lib/heraldry';
import type { Pt } from '../src/lib/heraldry/geometry';
import { fits, groundFor, isHandFitted, type Ground } from '../src/lib/heraldry/layout';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const layout = (key: string, count: number): Layout => layoutOfKey(key, count)!;
const field = fieldContext('none');
const slotsOf = (ctx: LayoutContext, count: number, key: string, shape: 'heater' | 'banner' | 'round' | 'lozenge' = 'heater') =>
  contextSlots(ctx, count, layout(key, count), shape);

describe('hand-fitted rows', () => {
  it('keep the heater look of the original tables', () => {
    expect(slotsOf(field, 1, 'single')).toEqual([{ x: 50, y: 54, size: 90, rotation: 0 }]);
    expect(slotsOf(field, 3, 'rows-2-1').map((s) => [s.x, s.y, s.size])).toEqual([[27, 29, 44], [73, 29, 44], [50, 77, 44]]);
    expect(slotsOf(field, 6, 'rows-3-2-1').map((s) => s.size)).toEqual([31, 31, 31, 31, 31, 31]);
    expect(slotsOf(fieldContext('bordure'), 1, 'single')).toEqual([{ x: 50, y: 55 + (54 - 55) * 0.86, size: 77.4, rotation: 0 }]);
    expect(slotsOf({ k: 'between', ordinary: plainSpec('fess'), peripheral: 'none', keepOut: [] }, 3, 'host').map((s) => [s.x, s.y, s.size])).toEqual([[28, 19, 30], [72, 19, 30], [50, 86, 30]]);
    expect(slotsOf({ k: 'on', ordinary: plainSpec('fess'), peripheral: 'none', keepOut: [] }, 3, 'host').map((s) => [s.x, s.y, s.size])).toEqual([[22, 50, 27], [50, 50, 27], [78, 50, 27]]);
  });

  it('are fitted for the other shapes with the same slot counts', () => {
    expect(slotsOf(field, 1, 'single', 'banner')).toEqual([{ x: 50, y: 63.75, size: 90, rotation: 0 }]);
    expect(slotsOf(field, 3, 'rows-2-1', 'lozenge')).toHaveLength(3);
    expect(slotsOf({ k: 'on', ordinary: plainSpec('chief'), peripheral: 'none', keepOut: [] }, 2, 'host', 'round')).toHaveLength(2);
  });

  it('put the single charge under a chief across the partition lines of a field', () => {
    const [s] = slotsOf(fieldContext('chief'), 1, 'single');
    expect(s).toEqual({ x: 50, y: 62, size: 60, rotation: 0 });
    const fess = shapeFrame('heater').fessPoint;
    for (const division of ['per-bend', 'per-bend-sinister', 'per-pale', 'per-fess'] as const) {
      const parts = new Set(probePoints(s).map(([x, y]) => inFirstPart(division, fess, x, y)));
      expect(parts.size, division).toBe(2);
    }
  });

  it('turn charges to follow a bend or a chevron limb, and not otherwise', () => {
    expect(slotsOf({ k: 'on', ordinary: plainSpec('bend'), peripheral: 'none', keepOut: [] }, 3, 'host').map((s) => s.rotation)).toEqual([-45, -45, -45]);
    expect(slotsOf({ k: 'on', ordinary: plainSpec('bend-sinister'), peripheral: 'none', keepOut: [] }, 2, 'host').map((s) => s.rotation)).toEqual([45, 45]);
    expect(slotsOf({ k: 'on', ordinary: plainSpec('chevron'), peripheral: 'none', keepOut: [] }, 3, 'host').map((s) => [Math.round(s.x), s.rotation])).toEqual([[50, 0], [24, 45], [76, -45]]);
    expect(slotsOf({ k: 'on', ordinary: plainSpec('fess'), peripheral: 'none', keepOut: [] }, 3, 'host').map((s) => s.rotation)).toEqual([0, 0, 0]);
    expect(slotsOf(field, 2, 'in-bend').map((s) => s.rotation)).toEqual([0, 0]);
  });

  it('give four on a cross or saltire as the five without the centre', () => {
    for (const type of ['cross', 'saltire'] as const) {
      const four = slotsOf({ k: 'on', ordinary: plainSpec(type), peripheral: 'none', keepOut: [] }, 4, 'host'), five = slotsOf({ k: 'on', ordinary: plainSpec(type), peripheral: 'none', keepOut: [] }, 5, 'host');
      expect(four).toEqual(five.filter((_, i) => i !== 2));
    }
  });
});

describe('the generic engine', () => {
  it('lays two long charges crossed at one centre, turned both ways', () => {
    const slots = slotsOf(field, 2, 'crossed');
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ x: slots[1].x, y: slots[1].y, size: slots[1].size });
    expect(slots.map((s) => s.rotation).sort()).toEqual([-45, 45]);
    expect(slots[0].size).toBeGreaterThan(40);
  });

  it('places charges in a chief or in base, above the fess point and below it', () => {
    const [top] = slotsOf(field, 1, 'in-chief'), [bottom] = slotsOf(field, 1, 'in-base');
    expect(top.y).toBeLessThan(30);
    expect(bottom.y).toBeGreaterThan(85);
    expect(slotsOf(field, 3, 'in-chief').map((s) => s.y)).toEqual([20, 20, 20]);
  });

  it('sets rows of any count in reading order with one size', () => {
    for (const rows of ['rows-2-2-1', 'rows-3-3-1', 'rows-4-3-2-1']) {
      const slots = slotsOf(field, rows.split('-').slice(1).reduce((a, b) => a + Number(b), 0), rows);
      expect(slots.length, rows).toBeGreaterThan(4);
      expect(new Set(slots.map((s) => s.size)).size).toBe(1);
      expect(slots.map((s) => s.y), rows).toEqual([...slots.map((s) => s.y)].sort((a, b) => a - b));
    }
  });

  it('puts a ring of charges round a circle and an orle round the edge', () => {
    const ring = slotsOf(field, 6, 'in-annulo');
    const cx = ring.reduce((a, s) => a + s.x, 0) / 6, cy = ring.reduce((a, s) => a + s.y, 0) / 6;
    const radii = ring.map((s) => Math.hypot(s.x - cx, s.y - cy));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.1);
    const orle = slotsOf(field, 8, 'in-orle');
    const edge = pathPolygon('M0 0H100V60C100 92 76 110 50 120C24 110 0 92 0 60Z');
    for (const s of orle) expect(pointInPolygon(s.x, s.y, edge)).toBe(true);
    expect(orle.some((s) => s.y < 20)).toBe(true);
    expect(orle.some((s) => s.y > 95)).toBe(true);
  });

  it('sets two charges and a ring of twelve in annulo at a legible size', () => {
    expect(slotsOf(field, 2, 'in-annulo').map((s) => s.x)).toEqual([50, 50]);
    const twelve = slotsOf(field, 12, 'in-annulo');
    expect(twelve).toHaveLength(12);
    expect(twelve[0].size).toBeGreaterThanOrEqual(MIN_SLOT_SIZE);
  });

  it('has no layout for a context or count it does not know', () => {
    expect(slotsOf({ k: 'between', ordinary: plainSpec('cross'), peripheral: 'none', keepOut: [] }, 2, 'host')).toEqual([]);
    expect(slotsOf({ k: 'on', ordinary: plainSpec('pile'), peripheral: 'none', keepOut: [] }, 4, 'host')).toEqual([]);
    expect(slotsOf(field, 13, 'in-pale')).toEqual([]);
    expect(slotsOf(field, 3, 'rows-2-2')).toEqual([]);
    expect(contextSlots(field, 2, { arrangement: { k: 'host' }, position: null }, 'heater')).toEqual([]);
  });

  it('is the same for the same question', () => {
    expect(slotsOf(field, 7, 'rows-3-3-1')).toBe(slotsOf(field, 7, 'rows-3-3-1'));
  });
});

describe('capacity', () => {
  const fits = (ctx: LayoutContext, count: number, key: string) => {
    const slots = slotsOf(ctx, count, key);
    return slots.length === count && slots[0].size >= MIN_SLOT_SIZE;
  };
  const between = (ordinary: OrdinaryType): LayoutContext => ({ k: 'between', ordinary: plainSpec(ordinary), peripheral: 'none', keepOut: [] });

  it('fits six charges around a fess, a bend and a bend sinister', () => {
    for (const type of ['fess', 'bend', 'bend-sinister'] as const) expect(fits(between(type), 6, 'host'), type).toBe(true);
  });

  it('fits four on a bend, five on a fess and four on a saltire', () => {
    expect(fits({ k: 'on', ordinary: plainSpec('bend'), peripheral: 'none', keepOut: [] }, 4, 'host')).toBe(true);
    expect(fits({ k: 'on', ordinary: plainSpec('fess'), peripheral: 'none', keepOut: [] }, 5, 'host')).toBe(true);
    expect(fits({ k: 'on', ordinary: plainSpec('saltire'), peripheral: 'none', keepOut: [] }, 4, 'host')).toBe(true);
  });

  it('fits six under a chief in three, two and one', () => {
    expect(fits(fieldContext('chief'), 6, 'rows-3-2-1')).toBe(true);
  });

  it('sets charges in chief, base or canton in their room, clear of the band, and the primary charges in what is left', () => {
    const d = nd(arms('azure', group(charge('lion'), 'or', { count: 3 }), group(charge('mullet'), 'argent', { count: 3, position: 'chief' })));
    const chief = groupSlots(d, [1], 'heater'), lions = groupSlots(d, [0], 'heater');
    expect(chief.map((s) => s.y)).toEqual([20, 20, 20]);
    expect(chief.every((s) => s.y + s.size / 2 <= 36)).toBe(true);
    expect(lions.every((s) => s.y - s.size / 2 >= 36)).toBe(true);
    for (const shape of ['banner', 'round', 'lozenge'] as const) {
      const top = Math.max(...groupSlots(d, [1], shape).map((s) => s.y + s.size / 2));
      expect(Math.min(...groupSlots(d, [0], shape).map((s) => s.y - s.size / 2)), shape).toBeGreaterThan(top);
    }
    const base = nd(arms('azure', group(ordinary('chevron'), 'or'), group(charge('mullet'), 'argent', { position: 'base' })));
    expect(groupSlots(base, [1], 'heater')).toEqual([{ x: 50, y: 93, size: 26.5, rotation: 0 }]);
    const canton = nd(arms('azure', group(charge('lion'), 'or'), group(charge('mullet'), 'argent', { position: 'canton' })));
    expect(groupSlots(canton, [1], 'heater')).toEqual([{ x: 20, y: 20, size: 31.5, rotation: 0 }]);
  });

  it('has no room for charges in chief across a pale, and room for three above a fess', () => {
    const d = nd(arms('azure', group(ordinary('pale'), 'or'), group(charge('mullet'), 'argent', { count: 3, position: 'chief' })));
    expect(capacityIssue(d, [1])?.message).toBe("Mullets can't be set in chief like this.");
    expect(structuralIssues(nd(arms('azure', group(ordinary('fess'), 'or'), group(charge('mullet'), 'argent', { count: 3, position: 'chief' }))))).toEqual([]);
  });

  it('sets charges around a primary charge clear of it, in its corners, at its sides or in a ring, in every shape', () => {
    const d = (primary: object, count: number, arrangement?: string) => nd(arms('azure', group(charge('sword'), 'or', primary), group(charge('mullet'), 'argent', { count, relation: 'between', ...(arrangement ? { arrangement } : {}) })));
    const three = d({}, 3);
    expect(groupSlots(three, [0], 'heater')).toEqual([{ x: 50, y: 52.06, size: 49.5, rotation: 0 }]);
    expect(groupSlots(three, [1], 'heater').map((s) => [s.x, s.y, s.size])).toEqual([[19.96, 19.88, 34], [80.04, 19.88, 34], [50, 98.12, 34]]);
    for (const design of [three, d({ count: 2, arrangement: 'in-pale' }, 2, 'in-fess'), d({ count: 2, arrangement: 'crossed' }, 4, 'in-saltire'), d({}, 8, 'in-orle')]) {
      for (const shape of FIELD_SHAPES) {
        const primary = groupSlots(design, [0], shape), around = groupSlots(design, [1], shape);
        expect(around.length, shape).toBe(design.groups[1].count);
        for (const s of around) for (const p of primary) expect(Math.hypot(s.x - p.x, s.y - p.y), shape).toBeGreaterThan((s.size + p.size) / 2 * 0.5);
      }
    }
  });

  it('does not fit twelve in pale', () => {
    expect(fits(field, 12, 'in-pale')).toBe(false);
  });

  it('reports a group that does not fit, and how many do', () => {
    const d = nd(arms('azure', group(charge('sword'), 'or', { count: 12, arrangement: 'in-pale' })));
    const issues = structuralIssues(d);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'structure', rule: 'capacity', at: { k: 'group', path: [0] }, slots: [] });
    const capacity = capacityIssue(d, [0]);
    expect(capacity).toMatchObject({ where: 'on the field' });
    expect(capacity!.most).toBeLessThan(12);
    expect(issues[0].message).toBe(`There isn't room for twelve swords on the field — at most ${capacity!.most} fit.`);
  });

  it('says where the charges do not fit', () => {
    const under = nd(arms('azure', group(charge('sword'), 'or', { count: 12, arrangement: 'in-pale' }), group(ordinary('chief'), 'gules')));
    expect(structuralIssues(under)[0].message).toContain('under the chief');
    const on = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('mullet'), 'argent', { count: 9 })] })));
    expect(structuralIssues(on)[0].message).toBe("There isn't room for nine mullets on the fess — at most 6 fit.");
    const around = nd(arms('azure', group(ordinary('chevron'), 'or'), group(charge('mullet'), 'argent', { count: 4, relation: 'between' })));
    expect(structuralIssues(around)[0].message).toBe("Mullets can't be set around the chevron like this.");
  });

  it('accepts every count the builder offers at its default layout on a plain field', () => {
    for (const count of [1, 2, 3, 4, 5, 6]) {
      expect(structuralIssues(nd(arms('azure', group(charge('mullet'), 'or', { count })))), String(count)).toEqual([]);
    }
  });

  it('does not report capacity for a layout that is already illegal', () => {
    const d = nd(arms('azure', group(charge('mullet'), 'or', { count: 2, arrangement: 'crossed' })));
    expect(structuralIssues(d).map((i) => i.message)).toEqual(['Only long charges such as swords, keys and anchors can be crossed.']);
  });
});

describe('canonical and group slots', () => {
  it('are the heater slots of a charge group and none for an ordinary', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('mullet'), 'argent', { count: 3 })] })));
    expect(canonicalSlots(d, [0, 0])).toHaveLength(3);
    expect(groupSlots(d, [0], 'heater')).toEqual([]);
    expect(groupSlots(d, [0, 0], 'round')).toHaveLength(3);
  });
});

describe('geometry helpers', () => {
  it('slotTransform is a plain translate and scale when upright and turns about the centre otherwise', () => {
    expect(slotTransform({ x: 50, y: 54, size: 90, rotation: 0 })).toBe('translate(5 9) scale(0.9)');
    expect(slotTransform({ x: 50, y: 50, size: 20, rotation: -45 })).toBe('rotate(-45 50 50) translate(40 40) scale(0.2)');
  });

  it('probePoints turn with the charge', () => {
    const upright = probePoints({ x: 50, y: 50, size: 10, rotation: 0 });
    expect(upright).toEqual([[50, 50], [47, 50], [53, 50], [50, 47], [50, 53]]);
    const turned = probePoints({ x: 50, y: 50, size: 10, rotation: 90 });
    expect(turned[1]).toEqual([50, 47]);
    expect(turned[3]).toEqual([53, 50]);
  });

  it('an ordinary lies on the field parts under it', () => {
    const above = (type: OrdinaryType) => ordinaryGeometry(plainSpec(type), defaultOrdinaryFrame('heater')).samples.filter(([, y]) => y < 50).length;
    expect(above('chief')).toBe(ordinaryGeometry(plainSpec('chief'), defaultOrdinaryFrame('heater')).samples.length);
    expect(ordinaryGeometry(plainSpec('bordure'), defaultOrdinaryFrame('heater')).samples.some(([x]) => x < 50)).toBe(true);
    expect(ordinaryGeometry(plainSpec('bordure'), defaultOrdinaryFrame('heater')).samples.some(([x]) => x > 50)).toBe(true);
    expect(ordinaryGeometry(plainSpec('fess'), defaultOrdinaryFrame('heater')).samples.length).toBeGreaterThan(100);
    expect(ordinaryGeometry(plainSpec('fess'), defaultOrdinaryFrame('heater')).samples).toBe(ordinaryGeometry(plainSpec('fess'), defaultOrdinaryFrame('heater')).samples);
  });
});

describe('a chief on a field divided per fess (SENA A3D1c)', () => {
  const perFess = div('per-fess', 'argent', 'sable');
  const message = 'A chief on a field divided per fess needs a charge across the line (SENA A3D1c).';

  it('needs a primary group across the line', () => {
    expect(structuralIssues(nd(arms(perFess, group(ordinary('chief'), 'gules'))))).toEqual([
      { code: 'structure', rule: 'crosses-line', at: { k: 'group', path: [0] }, message, slots: [] },
    ]);
  });

  it('is satisfied by a charge across the line, even under the chief', () => {
    expect(structuralIssues(nd(arms(perFess, group(charge('rose'), 'gules'), group(ordinary('chief'), 'gules'))))).toEqual([]);
  });

  it('is satisfied by an ordinary across the line, not by one on a single part', () => {
    expect(structuralIssues(nd(arms(perFess, group(ordinary('bend'), 'gules'), group(ordinary('chief'), 'or'))))).toEqual([]);
    expect(structuralIssues(nd(arms(perFess, group(ordinary('pale'), 'gules'), group(ordinary('chief'), 'or'))))).toEqual([]);
  });

  it('applies to per fess only', () => {
    for (const division of ['per-pale', 'per-bend', 'per-chevron']) {
      expect(structuralIssues(nd(arms(div(division, 'argent', 'sable'), group(ordinary('chief'), 'gules')))), division).toEqual([]);
    }
  });

  it('lets a rose and a chief stand on a field per bend', () => {
    const d = nd(arms(div('per-bend', 'argent', 'sable'), group(charge('rose'), 'gules'), group(ordinary('chief'), 'gules')));
    expect(structuralIssues(d)).toEqual([]);
  });
});

describe('grounds', () => {
  const square = (x: number, y: number): Pt[] => [[x, y], [x + 10, y], [x + 10, y + 10], [x, y + 10]];
  const base = groundFor(fieldContext('none'), 'heater');

  it('keeps a disc clear of every polygon to avoid', () => {
    const ground: Ground = { ...base, avoid: [square(30, 40), square(60, 40)] };
    expect(fits([{ x: 50, y: 45, rotation: 0 }], 10, ground, false)).toBe(true);
    expect(fits([{ x: 33, y: 45, rotation: 0 }], 10, ground, false)).toBe(false);
    expect(fits([{ x: 65, y: 45, rotation: 0 }], 10, ground, false)).toBe(false);
    expect(fits([{ x: 50, y: 45, rotation: 0 }, { x: 66, y: 45, rotation: 0 }], 4, ground, false)).toBe(false);
  });

  it('puts a chief and a bordure together: inside the bordure inset and below the chief', () => {
    const both = groundFor(fieldContext('chief-bordure'), 'heater');
    expect(both.contain).toEqual(groundFor(fieldContext('bordure'), 'heater').contain);
    expect(both.minTop).toBe(shapeFrame('heater').chiefBase);
    expect(groundFor(fieldContext('none'), 'heater').minTop).toBe(-Infinity);
  });
});

describe('the larger counts on the ordinaries Table 7 gives them', () => {
  const sizeOf = (k: 'between' | 'on', ordinary: OrdinaryType, count: number) => {
    const slots = slotsOf(k === 'between' ? { k, ordinary: plainSpec(ordinary), peripheral: 'none', keepOut: [] } : { k, ordinary: plainSpec(ordinary), peripheral: 'none', keepOut: [] }, count, 'host');
    return slots.length === count ? slots[0].size : 0;
  };

  it('draw six between a chevron, four to six on one, and six on a fess or a chief, at a size that reads', () => {
    expect(sizeOf('between', 'chevron', 6)).toBeGreaterThanOrEqual(MIN_SLOT_SIZE);
    for (const count of [4, 5, 6]) expect(sizeOf('on', 'chevron', count), `chevron ${count}`).toBeGreaterThanOrEqual(MIN_SLOT_SIZE);
    for (const type of ['fess', 'chief'] as const) expect(sizeOf('on', type, 6), type).toBeGreaterThanOrEqual(MIN_SLOT_SIZE);
  });

  it('keep the three under a chevron clear of its limbs and the charges on one off each other', () => {
    const below = slotsOf({ k: 'between', ordinary: plainSpec('chevron'), peripheral: 'none', keepOut: [] }, 6, 'host').filter((s) => s.y > 71);
    expect(below).toHaveLength(3);
    const chevron = pathPolygon(ordinaryGeometry(plainSpec('chevron'), defaultOrdinaryFrame('heater')).body);
    for (const s of below) expect(pointInPolygon(s.x, s.y, chevron)).toBe(false);
    const on = slotsOf({ k: 'on', ordinary: plainSpec('chevron'), peripheral: 'none', keepOut: [] }, 6, 'host');
    for (const a of on) for (const b of on) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.size);
  });
});

describe('around and on an ordinary with a chief and a bordure beside it', () => {
  const heater = shapeFrame('heater');
  const inset = pathPolygon(heater.inset);
  const ctx = (k: 'between' | 'on', ordinary: OrdinaryType, peripheral: 'chief' | 'bordure' | 'chief-bordure'): GroundContext =>
    (k === 'between' ? { k, ordinary: plainSpec(ordinary), peripheral, keepOut: [] } : { k, ordinary: plainSpec(ordinary), peripheral, keepOut: [] });
  const MARGIN = 0;

  it('keep the slots below the chief and inside the bordure, at a size that reads', () => {
    const cases: Array<[GroundContext, number]> = [
      [ctx('between', 'pale', 'chief'), 4], [ctx('between', 'bend', 'chief-bordure'), 2], [ctx('between', 'chevron', 'bordure'), 3],
      [ctx('between', 'chevron', 'chief'), 3], [ctx('on', 'fess', 'bordure'), 4], [ctx('on', 'bend', 'chief'), 3], [ctx('on', 'chief', 'bordure'), 3],
    ];
    for (const [c, count] of cases) {
      const slots = slotsOf(c, count, 'host');
      const where = JSON.stringify([c, count]);
      expect(slots, where).toHaveLength(count);
      expect(slots[0].size, where).toBeGreaterThanOrEqual(MIN_SLOT_SIZE);
      if (c.k === 'field' || c.peripheral === 'none') continue;
      for (const s of slots) {
        if (c.peripheral === 'chief' || c.peripheral === 'chief-bordure') expect(s.y - s.size / 2, where).toBeGreaterThanOrEqual(heater.chiefBase - MARGIN);
        if (c.peripheral === 'bordure' || c.peripheral === 'chief-bordure') expect(pointInPolygon(s.x, s.y, inset), where).toBe(true);
      }
    }
  });

  it('have no room where the ordinary leaves none: a fess between charges under a chief', () => {
    const slots = slotsOf(ctx('between', 'fess', 'chief'), 3, 'host');
    expect(slots.length !== 3 || slots[0].size < MIN_SLOT_SIZE).toBe(true);
  });

  it('are the same as with no peripheral when there is none', () => {
    const fessBetween = ctx('between', 'fess', 'chief');
    expect(slotsOf({ ...fessBetween, peripheral: 'none', keepOut: [] }, 3, 'host')).toEqual(slotsOf({ k: 'between', ordinary: plainSpec('fess'), peripheral: 'none', keepOut: [] }, 3, 'host'));
  });

  it('lay out the ordinaries with only hand rows from them: four around a cross, kept off a bordure', () => {
    const slots = slotsOf(ctx('between', 'cross', 'bordure'), 4, 'host');
    expect(slots.length === 4 ? slots[0].size : 0).toBeLessThan(slotsOf({ k: 'between', ordinary: plainSpec('cross'), peripheral: 'none', keepOut: [] }, 4, 'host')[0].size);
  });

  it('compose the ground of a context from its peripheral and the ordinary it sits around or on', () => {
    const around = groundFor(ctx('between', 'pale', 'chief-bordure'), 'heater');
    expect(around.minTop).toBe(heater.chiefBase);
    expect(around.avoid).toHaveLength(1);
    expect(around.contain.length).toBe(pathPolygon(heater.inset).length);
    expect(groundFor(ctx('on', 'fess', 'chief'), 'heater').within).not.toBeNull();
  });

  it('say where charges sit in a capacity message', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or'), group(charge('rose'), 'argent', { count: 3 }), group(ordinary('chief'), 'argent')));
    expect(capacityIssue(d, [1])?.message).toMatch(/around the fess, under the chief/);
  });
});

describe('charges on a bordure', () => {
  const onBordure: LayoutContext = { k: 'on', ordinary: plainSpec('bordure'), peripheral: 'none', keepOut: [] };
  const SHAPES = ['heater', 'banner', 'round', 'lozenge'] as const;

  it('lie along the middle of the band in every shape: evenly, upright, one size, the first at the top', () => {
    for (const shape of SHAPES) {
      const frame = shapeFrame(shape);
      const ring = pathPolygon(frame.outline), inset = pathPolygon(frame.inset);
      for (const count of [1, 2, 3, 5, 8, 12]) {
        const slots = slotsOf(onBordure, count, 'host', shape);
        expect(slots, `${shape} ${count}`).toHaveLength(count);
        expect(new Set(slots.map((s) => s.size)).size).toBe(1);
        for (const s of slots) {
          expect(s.rotation).toBe(0);
          expect(pointInPolygon(s.x, s.y, ring), `${shape} ${count} inside`).toBe(true);
          expect(pointInPolygon(s.x, s.y, inset), `${shape} ${count} outside the inner edge`).toBe(false);
        }
        expect(Math.min(...slots.map((s) => s.y))).toBeLessThan(frame.chiefBase / 2);
      }
    }
  });

  it('are as small as the band makes them, and still legible on the heater at every count', () => {
    for (let count = 1; count <= 12; count++) {
      const [slot] = slotsOf(onBordure, count, 'host');
      expect(slot.size, String(count)).toBeLessThan(MIN_SLOT_SIZE);
      expect(slot.size, String(count)).toBeGreaterThanOrEqual(minSlotSize(onBordure));
    }
    expect(minSlotSize(onBordure)).toBeLessThan(minSlotSize(field));
  });

  it('are not moved by what lies beside the bordure', () => {
    const d = nd(arms('azure', group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'or', { charged: [group(charge('mullet'), 'gules', { count: 8 })] })));
    expect(groupSlots(d, [1, 0], 'heater')).toEqual(slotsOf(onBordure, 8, 'host'));
  });

  it('compose a ground that is the ring: inside the outline, clear of the inner edge', () => {
    const ground = groundFor(onBordure, 'heater');
    expect(ground.avoid).toHaveLength(1);
    expect(ground.within).toBeNull();
    const [top] = slotsOf(onBordure, 1, 'host');
    expect(fits([{ x: top.x, y: top.y, rotation: 0 }], top.size, ground, false)).toBe(true);
    expect(fits([{ x: 50, y: 60, rotation: 0 }], top.size, ground, false)).toBe(false);
  });
});

describe('ordinaries that are not plain', () => {
  const wavy: OrdinarySpec = { ...plainSpec('fess'), lines: { a: 'wavy', b: 'wavy' } };
  /** Points round a slot's glyph disc, just inside its edge. */
  const rim = (s: Slot): Pt[] => Array.from({ length: 24 }, (_, k): Pt => [s.x + 0.49 * s.size * Math.cos((k * Math.PI) / 12), s.y + 0.49 * s.size * Math.sin((k * Math.PI) / 12)]);
  const envelope = (spec: OrdinarySpec, shape: FieldShape) => ordinaryGeometry(spec, defaultOrdinaryFrame(shape)).envelope;

  it('are laid out by the generic engine clear of their envelope', () => {
    const between: LayoutContext = { k: 'between', ordinary: wavy, peripheral: 'none', keepOut: [] };
    const on: LayoutContext = { k: 'on', ordinary: wavy, peripheral: 'none', keepOut: [] };
    expect(isHandFitted(between, 2, layout('host', 2))).toBe(false);
    expect(isHandFitted(on, 3, layout('host', 3))).toBe(false);
    for (const shape of FIELD_SHAPES) {
      const { outer, inner } = envelope(wavy, shape);
      const around = slotsOf(between, 2, 'host', shape);
      expect(around, shape).toHaveLength(2);
      for (const s of around) for (const [x, y] of [[s.x, s.y], ...rim(s)]) expect(outer.some((ring) => pointInPolygon(x, y, ring)), `${shape} between`).toBe(false);
      const along = slotsOf(on, 3, 'host', shape);
      expect(along, shape).toHaveLength(3);
      for (const s of along) for (const [x, y] of [[s.x, s.y], ...rim(s)]) expect(pointInPolygon(x, y, inner[0]), `${shape} on`).toBe(true);
    }
    // The wavy edges leave less room than the plain fess's hand rows.
    expect(slotsOf(on, 3, 'host')[0].size).toBeLessThan(slotsOf({ ...on, ordinary: plainSpec('fess') }, 3, 'host')[0].size);
  });

  it('leave plain specs their hand rows', () => {
    const hand: string[] = [];
    for (const k of ['between', 'on'] as const) {
      for (const type of ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'chief', 'bordure', 'pile'] as const) {
        for (let count = 1; count <= 12; count++) {
          if (isHandFitted({ k, ordinary: plainSpec(type), peripheral: 'none', keepOut: [] }, count, layout('host', count))) hand.push(`${k}-${type}:${count}`);
          expect(isHandFitted({ k, ordinary: { ...plainSpec(type), lines: { a: 'embattled', b: 'embattled' } }, peripheral: 'none', keepOut: [] }, count, layout('host', count))).toBe(false);
        }
      }
    }
    expect(hand).toEqual([
      'between-fess:2', 'between-fess:3', 'between-pale:2', 'between-bend:2', 'between-bend-sinister:2', 'between-chevron:3', 'between-cross:4', 'between-saltire:4', 'between-pile:2',
      'on-fess:1', 'on-fess:2', 'on-fess:3', 'on-pale:1', 'on-pale:2', 'on-pale:3', 'on-bend:1', 'on-bend:2', 'on-bend:3', 'on-bend-sinister:1', 'on-bend-sinister:2', 'on-bend-sinister:3',
      'on-chevron:1', 'on-chevron:2', 'on-chevron:3', 'on-cross:1', 'on-cross:4', 'on-cross:5', 'on-saltire:1', 'on-saltire:4', 'on-saltire:5', 'on-chief:1', 'on-chief:2', 'on-chief:3',
      'on-pile:1', 'on-pile:2', 'on-pile:3',
    ]);
  });

  it('keep charges on a bordure with a line off the ground its inner edge may take', () => {
    const lined: OrdinarySpec = { ...plainSpec('bordure'), lines: { a: 'indented', b: 'indented' } };
    const ctx: LayoutContext = { k: 'on', ordinary: lined, peripheral: 'none', keepOut: [] };
    const [, inset] = envelope(lined, 'heater').inner;
    const slots = slotsOf(ctx, 8, 'host');
    expect(slots).toHaveLength(8);
    for (const s of slots) for (const [x, y] of rim(s)) expect(pointInPolygon(x, y, inset)).toBe(false);
    expect(slots[0].size).toBeLessThan(slotsOf({ ...ctx, ordinary: plainSpec('bordure') }, 8, 'host')[0].size);
  });
});
