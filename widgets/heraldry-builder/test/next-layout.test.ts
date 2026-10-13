// The slot engine and the structure rules that depend on it: hand-fitted rows first, the generic engine
// for everything else, capacity ("how many fit"), and the chief rule on a field divided per fess.

import { describe, expect, it } from 'vitest';
import {
  MIN_SLOT_SIZE, canonicalSlots, contextSlots, groupSlots, inFirstPart, layoutOfKey, ordinarySamplePoints, pathPolygon, pointInPolygon, probePoints,
  shapeFrame, slotTransform, structuralIssues, type Layout, type LayoutContext, type OrdinaryType,
} from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';

const layout = (key: string, count: number): Layout => layoutOfKey(key, count)!;
const field: LayoutContext = { k: 'field', peripheral: 'none' };
const slotsOf = (ctx: LayoutContext, count: number, key: string, shape: 'heater' | 'banner' | 'round' | 'lozenge' = 'heater') =>
  contextSlots(ctx, count, layout(key, count), shape);

describe('hand-fitted rows', () => {
  it('keep the heater look of the original tables', () => {
    expect(slotsOf(field, 1, 'single')).toEqual([{ x: 50, y: 54, size: 90, rotation: 0 }]);
    expect(slotsOf(field, 3, 'rows-2-1').map((s) => [s.x, s.y, s.size])).toEqual([[27, 29, 44], [73, 29, 44], [50, 77, 44]]);
    expect(slotsOf(field, 6, 'rows-3-2-1').map((s) => s.size)).toEqual([31, 31, 31, 31, 31, 31]);
    expect(slotsOf({ k: 'field', peripheral: 'bordure' }, 1, 'single')).toEqual([{ x: 50, y: 55 + (54 - 55) * 0.86, size: 77.4, rotation: 0 }]);
    expect(slotsOf({ k: 'between', ordinary: 'fess' }, 3, 'host').map((s) => [s.x, s.y, s.size])).toEqual([[28, 19, 30], [72, 19, 30], [50, 86, 30]]);
    expect(slotsOf({ k: 'on', ordinary: 'fess' }, 3, 'host').map((s) => [s.x, s.y, s.size])).toEqual([[22, 50, 27], [50, 50, 27], [78, 50, 27]]);
  });

  it('are fitted for the other shapes with the same slot counts', () => {
    expect(slotsOf(field, 1, 'single', 'banner')).toEqual([{ x: 50, y: 63.75, size: 90, rotation: 0 }]);
    expect(slotsOf(field, 3, 'rows-2-1', 'lozenge')).toHaveLength(3);
    expect(slotsOf({ k: 'on', ordinary: 'chief' }, 2, 'host', 'round')).toHaveLength(2);
  });

  it('put the single charge under a chief across the partition lines of a field', () => {
    const [s] = slotsOf({ k: 'field', peripheral: 'chief' }, 1, 'single');
    expect(s).toEqual({ x: 50, y: 62, size: 60, rotation: 0 });
    const fess = shapeFrame('heater').fessPoint;
    for (const division of ['per-bend', 'per-bend-sinister', 'per-pale', 'per-fess'] as const) {
      const parts = new Set(probePoints(s).map(([x, y]) => inFirstPart(division, fess, x, y)));
      expect(parts.size, division).toBe(2);
    }
  });

  it('turn charges to follow a bend or a chevron limb, and not otherwise', () => {
    expect(slotsOf({ k: 'on', ordinary: 'bend' }, 3, 'host').map((s) => s.rotation)).toEqual([-45, -45, -45]);
    expect(slotsOf({ k: 'on', ordinary: 'bend-sinister' }, 2, 'host').map((s) => s.rotation)).toEqual([45, 45]);
    expect(slotsOf({ k: 'on', ordinary: 'chevron' }, 3, 'host').map((s) => [Math.round(s.x), s.rotation])).toEqual([[50, 0], [24, 45], [76, -45]]);
    expect(slotsOf({ k: 'on', ordinary: 'fess' }, 3, 'host').map((s) => s.rotation)).toEqual([0, 0, 0]);
    expect(slotsOf(field, 2, 'in-bend').map((s) => s.rotation)).toEqual([0, 0]);
  });

  it('give four on a cross or saltire as the five without the centre', () => {
    for (const type of ['cross', 'saltire'] as const) {
      const four = slotsOf({ k: 'on', ordinary: type }, 4, 'host'), five = slotsOf({ k: 'on', ordinary: type }, 5, 'host');
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

  it('has no layout for a context or count it does not know', () => {
    expect(slotsOf({ k: 'between', ordinary: 'cross' }, 2, 'host')).toEqual([]);
    expect(slotsOf({ k: 'on', ordinary: 'pile' }, 4, 'host')).toEqual([]);
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
  const between = (ordinary: OrdinaryType): LayoutContext => ({ k: 'between', ordinary });

  it('fits six charges around a fess, a bend and a bend sinister', () => {
    for (const type of ['fess', 'bend', 'bend-sinister'] as const) expect(fits(between(type), 6, 'host'), type).toBe(true);
  });

  it('fits four on a bend, five on a fess and four on a saltire', () => {
    expect(fits({ k: 'on', ordinary: 'bend' }, 4, 'host')).toBe(true);
    expect(fits({ k: 'on', ordinary: 'fess' }, 5, 'host')).toBe(true);
    expect(fits({ k: 'on', ordinary: 'saltire' }, 4, 'host')).toBe(true);
  });

  it('fits six under a chief in three, two and one', () => {
    expect(fits({ k: 'field', peripheral: 'chief' }, 6, 'rows-3-2-1')).toBe(true);
  });

  it('does not fit twelve in pale', () => {
    expect(fits(field, 12, 'in-pale')).toBe(false);
  });

  it('reports a group that does not fit, and how many do', () => {
    const d = nd(arms('azure', group(charge('sword'), 'or', { count: 12, arrangement: 'in-pale' })));
    const issues = structuralIssues(d);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'structure', at: { k: 'group', path: [0] }, slots: [] });
    expect(issues[0].message).toMatch(/^There isn't room for twelve swords on the field — at most \d+ fit\.$/);
  });

  it('says where the charges do not fit', () => {
    const under = nd(arms('azure', group(charge('sword'), 'or', { count: 12, arrangement: 'in-pale' }), group(ordinary('chief'), 'gules')));
    expect(structuralIssues(under)[0].message).toContain('under the chief');
    const on = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('mullet'), 'argent', { count: 9 })] })));
    expect(structuralIssues(on)[0].message).toBe("There isn't room for nine mullets on the fess — at most 5 fit.");
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
  it('slotTransform is the v1 transform when upright and turns about the centre otherwise', () => {
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
    const above = (type: OrdinaryType) => ordinarySamplePoints(type).filter(([, y]) => y < 50).length;
    expect(above('chief')).toBe(ordinarySamplePoints('chief').length);
    expect(ordinarySamplePoints('bordure').some(([x]) => x < 50)).toBe(true);
    expect(ordinarySamplePoints('bordure').some(([x]) => x > 50)).toBe(true);
    expect(ordinarySamplePoints('fess').length).toBeGreaterThan(100);
    expect(ordinarySamplePoints('fess')).toBe(ordinarySamplePoints('fess'));
  });
});

describe('a chief on a field divided per fess (SENA A3D1c)', () => {
  const perFess = div('per-fess', 'argent', 'sable');
  const message = 'A chief on a field divided per fess needs a charge across the line (SENA A3D1c).';

  it('needs a primary group across the line', () => {
    expect(structuralIssues(nd(arms(perFess, group(ordinary('chief'), 'gules'))))).toEqual([
      { code: 'structure', at: { k: 'group', path: [0] }, message, slots: [] },
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
