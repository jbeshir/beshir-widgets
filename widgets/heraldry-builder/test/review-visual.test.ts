// The drawing fixes of the phase-C UI review (findings U-1 … U-9, /workspace/pc/review/findings-ui.md, and K-22 of findings-code.md): a
// bevilled line broken by a palewise step with its second half offset, a chevron rompu with its point cut off and raised, legible complex
// lines on a bordure, a lined canton in the round and the lozenge, no spikes at a couped end, enough teeth on a cross's arms, and the note
// beside a shape that can't draw a design's charges at a size that reads.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, LINE_PROFILE, crampedInShape, divisionRegions, laidSide, lineChoices, ordinaryGeometry, defaultOrdinaryFrame, outlineChoices, pathPolygon, pathRings, plainSpec,
  shapeFrame, toggleChoices, unsupportedIssues, type FieldShape, type Line, type OrdinarySpec,
} from '../src/lib/heraldry';
import { arms, charge, group, nd, ordinary, selfCrossings } from './helpers';

type P = readonly [number, number];
const lined = (type: OrdinarySpec['type'], line: Line, extra: Partial<OrdinarySpec> = {}): OrdinarySpec => ({ ...plainSpec(type), lines: { a: line, b: line }, ...extra });
const ringsOf = (spec: OrdinarySpec, shape: FieldShape) => pathRings(ordinaryGeometry(spec, defaultOrdinaryFrame(shape)).body);
/** The edges of a ring as [from, to]. */
const edgesOf = (ring: readonly P[]) => ring.map((p, i): [P, P] => [p, ring[(i + 1) % ring.length]]);
/** The steep edges of a ring (within 20° of palewise) at least `length` long inside the shape's box (a band's ends lie past it): a bevilled line's step. */
const palewise = (ring: readonly P[], length: number) => edgesOf(ring).filter(([a, b]) => a[0] > 0 && a[0] < 100 && Math.abs(b[0] - a[0]) < 0.36 * Math.abs(b[1] - a[1]) && Math.abs(b[1] - a[1]) >= length);

describe('bevilled: the line broken by a short palewise step, the half beyond it offset (U-1)', () => {
  it('turns its step palewise however the line is laid, dexter or sinister', () => {
    const s = Math.SQRT1_2;
    expect([laidSide('bevilled', [s, s], 1), laidSide('bevilled', [-s, -s], -1), laidSide('bevilled', [s, -s], 1), laidSide('bevilled', [-s, s], -1)]).toEqual([1, 1, -1, -1]);
    expect(laidSide('wavy', [s, -s], 1)).toBe(1);
    expect(LINE_PROFILE.bevilled.symmetric).toBe(false);
  });

  it('a bend bevilled steps on both edges, so the lower half of the bend is moved by the step; per bend steps once', () => {
    const depth = LINE_PROFILE.bevilled.depth;
    for (const shape of FIELD_SHAPES) {
      for (const type of ['bend', 'bend-sinister'] as const) {
        const [ring] = ringsOf(lined(type, 'bevilled'), shape);
        expect([shape, type, palewise(ring, depth).length]).toEqual([shape, type, 2]);
      }
      for (const division of ['per-bend', 'per-bend-sinister'] as const) {
        const [first] = divisionRegions(division, { a: 'bevilled', b: 'bevilled' }, null, shape);
        expect([shape, division, palewise(pathRings(first)[0], depth).length]).toEqual([shape, division, 1]);
      }
    }
  });
});

describe('a chevron rompu: its limbs cut palewise and its point raised (U-2)', () => {
  it('raises the point between the cuts and leaves the limbs beyond them where a plain chevron lies, in one piece', () => {
    for (const shape of FIELD_SHAPES) {
      const top = (spec: OrdinarySpec, x: number) => {
        const ring = ringsOf(spec, shape)[0];
        const ys = edgesOf(ring).flatMap(([a, b]) => ((a[0] - x) * (b[0] - x) < 0 ? [a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])] : []));
        return Math.min(...ys);
      };
      const rompu = lined('chevron', 'rompu'), plain = plainSpec('chevron');
      expect(ringsOf(rompu, shape)).toHaveLength(1);
      const centre = shapeFrame(shape).fessPoint.x;
      expect(top(plain, centre + 5) - top(rompu, centre + 5)).toBeGreaterThan(10);
      expect(Math.abs(top(plain, centre + 30) - top(rompu, centre + 30))).toBeLessThan(1e-6);
      // each limb broken by a step on both its edges
      expect(palewise(ringsOf(rompu, shape)[0], 10)).toHaveLength(4);
    }
  });
});

describe('a chevron rompu couped and cotised is not drawn, its inner cotise folded under the point (verify V-6)', () => {
  it('is a gap, and the builder blocks the outline, the toggle and the line that would make it', () => {
    const rompu = (extra: object) => nd(arms('azure', group(ordinary('chevron', { lines: { a: 'rompu', b: 'rompu' }, ...extra }), 'or')));
    expect(unsupportedIssues(rompu({ mods: ['couped'], cotised: { count: 1, paint: 'argent' } })).map((i) => `${i.gap.category}:${i.gap.detail}`)).toEqual(['ordinary-treatment:cotised-couped-rompu']);
    expect(outlineChoices(rompu({ mods: ['couped'] }), [0]).find((c) => c.value === 'cotised')).toMatchObject({ allowed: false });
    expect(toggleChoices(rompu({ cotised: { count: 1, paint: 'argent' } }), [0]).find((c) => c.value === 'couped')).toMatchObject({ allowed: false });
    const couped = nd(arms('azure', group(ordinary('chevron', { mods: ['couped'], cotised: { count: 1, paint: 'argent' } }), 'or')));
    expect(lineChoices(couped, { k: 'group', path: [0] }).find((c) => c.value === 'rompu')).toMatchObject({ allowed: false });
    expect(outlineChoices(rompu({}), [0]).find((c) => c.value === 'cotised')).toMatchObject({ allowed: true });
  });
});

describe('complex lines on a bordure keep their shape (U-3)', () => {
  /** The distance from a point to the shape's outline. */
  const toOutline = (shape: FieldShape) => {
    const outline = pathPolygon(shapeFrame(shape).outline);
    return ([x, y]: P) => Math.min(...edgesOf(outline).map(([a, b]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
    }));
  };

  it('cuts grady, potenty and nebuly half the bordure deep, with many short periods, its width never lost', () => {
    for (const shape of FIELD_SHAPES) {
      const distance = toOutline(shape);
      for (const line of ['grady', 'potenty', 'nebuly'] as const) {
        const rings = ringsOf(lined('bordure', line), shape);
        const inner = rings[rings.length - 1].map(distance);
        const mean = inner.reduce((a, b) => a + b, 0) / inner.length;
        const swing = Math.max(...inner) - Math.min(...inner);
        expect([shape, line, swing >= 4]).toEqual([shape, line, true]);
        expect([shape, line, Math.min(...inner) > 3]).toEqual([shape, line, true]);
        // crossings of the mean round the ring: two a period at least, fourteen periods or more round it (the old grady had ten)
        const crossings = inner.filter((d, i) => (d - mean) * (inner[(i + 1) % inner.length] - mean) < 0).length;
        expect([shape, line, crossings >= 28]).toEqual([shape, line, true]);
      }
    }
  });

  it('fits those lines between the inset\'s corners, so no feature folded round one crosses itself (verify V-4)', () => {
    for (const shape of FIELD_SHAPES) {
      for (const line of ['grady', 'potenty', 'nebuly', 'dovetailed', 'raguly'] as const) {
        // the lozenge's bottom point is too sharp for potenty's T-heads (CHANGES-C §5)
        if (shape === 'lozenge' && line === 'potenty') continue;
        const rings = ringsOf(lined('bordure', line), shape);
        expect([shape, line, rings.flatMap((ring) => selfCrossings(ring)).length]).toEqual([shape, line, 0]);
      }
    }
  });
});

describe('a lined canton or quarter in the round and the lozenge (U-5), couped ends (K-22), a cross\'s arms (U-6)', () => {
  it('draws a lined canton or quarter as one piece in every shape, its line stopped short of a slanting edge', () => {
    for (const shape of FIELD_SHAPES) {
      for (const type of ['canton', 'quarter'] as const) {
        for (const line of ['indented', 'embattled', 'wavy'] as const) {
          for (const mods of [[], ['sinister']] as const) {
            const rings = ringsOf(lined(type, line, { mods }), shape);
            expect([shape, type, line, mods.length, rings.length, selfCrossings(rings[0]).length]).toEqual([shape, type, line, mods.length, 1, 0]);
          }
        }
      }
    }
  });

  it('keeps a line off the straight ends of a couped saltire, baton or bend: no spike or sliver past them', () => {
    for (const shape of FIELD_SHAPES) {
      for (const line of ['embattled', 'dovetailed', 'grady'] as const) {
        for (const spec of [lined('saltire', line, { mods: ['couped'] }), lined('baton', line, { count: 1 }), lined('bend', line, { mods: ['couped'], cotised: { count: 3, line: 'plain' } })]) {
          const crossings = ringsOf(spec, shape).flatMap((ring) => selfCrossings(ring));
          expect([shape, line, spec.type, crossings.length]).toEqual([shape, line, spec.type, 0]);
        }
      }
    }
  });

  it('gives each arm of a cross indented three teeth at least', () => {
    for (const shape of ['heater', 'banner', 'round'] as const) {
      const [ring] = ringsOf(lined('cross', 'indented'), shape);
      // two corners a tooth, on each of the eight edges of the arms
      expect([shape, ring.length >= 8 * 3 * 2]).toEqual([shape, true]);
    }
  });
});

describe('a shape that can\'t draw the charges at a size that reads says so (U-4)', () => {
  const chg = (id: string, paint: string, count: number) => group(charge(id), paint, { count, role: 'secondary' });
  it('notes the lozenge\'s dot-sized roses beside a fess and a base, but not the heater\'s nor a design every shape draws', () => {
    const based = nd(arms('argent', group(ordinary('fess'), 'azure'), chg('rose', 'gules', 3), group(ordinary('base'), 'azure', { role: 'peripheral' })));
    expect(crampedInShape(based, 'heater')).toEqual([]);
    expect(crampedInShape(based, 'lozenge')).toEqual(["There isn't room in this shape to draw three roses around the fess at a size that reads — the heater shield shows them in full."]);
    const plain = nd(arms('argent', group(ordinary('chevron'), 'azure'), chg('mullet', 'gules', 3)));
    for (const shape of FIELD_SHAPES) expect(crampedInShape(plain, shape)).toEqual([]);
  });
});
