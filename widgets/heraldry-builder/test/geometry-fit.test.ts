// Charge slots must stay on the shield and on/off their ordinary, in every field shape: every slot's
// glyph disc (radius 0.4 × the slot box — the art fills ~80% of its box) lies inside the shape,
// inside the bordure ring's inner edge, on the ordinary it is charged on, or clear of the ordinary it
// sits between. The same holds for the real artwork: every vertex of every drawing, drawn in its
// optically scaled box, stays on the shape (clear of its edge) and neighbouring charges never
// overlap. Art also stays on, or clear of, a fess, pale, chief, bend, pile or cross; the chevron's
// and saltire's arms are narrower than a square charge's corners, so for those the glyph disc above
// is the check. Finally, a slot in any shape never touches a part of a divided field that its
// canonical (heater) slot clearly misses, and always reaches the parts it clearly touches, so what is
// drawn matches the canonical rule-of-tincture verdict.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_ART, CHARGE_IDS, DIVISIONS, FIELD_SHAPES, ORDINARY_TYPES, SHAPE_LAYOUT, drawnBox, inFirstPart,
  probePoints, slotsFor, type ChargeId, type FieldShape, type Slot,
} from '../src/lib/heraldry';
import type { Count, OrdinaryType } from '../src/lib/heraldry';

type Pt = [number, number];

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Parse the M/H/V/L/C/Z subset the shield and ordinary paths use into one polygon. */
function polygon(d: string): Pt[] {
  const tok = d.match(/[MHVLCZ]|-?\d+(?:\.\d+)?/g)!;
  const pts: Pt[] = [];
  let i = 0, cmd = '';
  let x = 0, y = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[A-Z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z') continue;
    if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); pts.push([x, y]); }
    else if (cmd === 'H') { x = num(); pts.push([x, y]); }
    else if (cmd === 'V') { y = num(); pts.push([x, y]); }
    else if (cmd === 'C') {
      const c1: Pt = [num(), num()], c2: Pt = [num(), num()], e: Pt = [num(), num()];
      pts.push(...bezier([x, y], c1, c2, e));
      [x, y] = e;
    }
  }
  return pts;
}

function inside(poly: Pt[], [px, py]: Pt): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Points on the glyph disc: centre plus 16 on its rim. */
function disc(s: Slot): Pt[] {
  const r = 0.4 * s.size;
  const out: Pt[] = [[s.x, s.y]];
  for (let k = 0; k < 16; k++) out.push([s.x + r * Math.cos((k * Math.PI) / 8), s.y + r * Math.sin((k * Math.PI) / 8)]);
  return out;
}

/** One shape's outline, bordure inset and ordinaries (first subpath) as polygons, plus its slot tables. */
function shapeGeometry(shape: FieldShape) {
  const l = SHAPE_LAYOUT[shape];
  const ordinaries = Object.fromEntries(ORDINARY_TYPES.map((t) => [t, polygon(l.ordinaries[t].split('M').filter(Boolean).map((s) => `M${s}`)[0])])) as Record<OrdinaryType, Pt[]>;
  return { shape, outline: polygon(l.outline), inset: polygon(l.inset), poly: (t: OrdinaryType) => ordinaries[t], slots: l.slots };
}
type ShapeGeometry = ReturnType<typeof shapeGeometry>;
const SHAPES = FIELD_SHAPES.map(shapeGeometry);

for (const g of SHAPES) {
  describe(`${g.shape}: charge slots fit their ground`, () => {
    it('field slots stay inside the shape and do not overlap each other', () => {
      for (const table of [g.slots.field, g.slots.underChief]) {
        for (const [key, slots] of Object.entries(table)) {
          for (const s of slots) expect(disc(s).every((p) => inside(g.outline, p)), `${key} ${JSON.stringify(s)}`).toBe(true);
          slots.forEach((a, i) => slots.slice(i + 1).forEach((b) => {
            expect(Math.hypot(a.x - b.x, a.y - b.y), `${key} overlap`).toBeGreaterThanOrEqual(0.8 * (a.size + b.size) / 2);
          }));
        }
      }
    });

    it('bordure charges stay inside the bordure', () => {
      for (const [key, slots] of Object.entries(g.slots.field)) {
        const [count, arrangement] = key.split(':');
        const placed = slotsFor({ type: 'bordure', tincture: 'argent' }, 'field', Number(count) as Count, arrangement as never, g.shape);
        for (const s of placed) expect(disc(s).every((p) => inside(g.inset, p)), `bordure ${key} ${JSON.stringify(s)}`).toBe(true);
        expect(placed.length === 0 || placed.length === slots.length).toBe(true);
      }
    });

    it('charges on an ordinary stay on it', () => {
      for (const [key, slots] of Object.entries(g.slots.on)) {
        const t = key.split(':')[0] as OrdinaryType;
        for (const s of slots) {
          expect(disc(s).every((p) => inside(g.poly(t), p) && inside(g.outline, p)), `${key} ${JSON.stringify(s)}`).toBe(true);
        }
      }
    });

    it('charges between an ordinary stay clear of it and on the shape', () => {
      for (const [key, slots] of Object.entries(g.slots.between)) {
        const t = key.split(':')[0] as OrdinaryType;
        for (const s of slots) {
          expect(disc(s).every((p) => inside(g.outline, p) && !inside(g.poly(t), p)), `${key} ${JSON.stringify(s)}`).toBe(true);
        }
      }
    });

    it('has the same tables as the heater, with slots in the same order and of one size per group', () => {
      const heater = SHAPE_LAYOUT.heater.slots;
      for (const ctx of ['field', 'bordure', 'underChief', 'between', 'on'] as const) {
        expect(Object.keys(g.slots[ctx]).sort(), ctx).toEqual(Object.keys(heater[ctx]).filter((k) => heater[ctx][k].length).sort());
        for (const [key, slots] of Object.entries(g.slots[ctx])) {
          expect(slots, `${ctx} ${key}`).toHaveLength(heater[ctx][key].length);
          expect(new Set(slots.map((s) => s.size)).size, `${ctx} ${key}`).toBe(1);
        }
      }
    });
  });
}

// ── Same field parts as the canonical layout ────────────────────────────────

/**
 * How far a probe arm may differ from the canonical one before it must agree: a part the heater's
 * probe reaches only within this distance of its arm's end (or misses by less) may go either way.
 */
const PROBE_TOLERANCE = 2;

describe('every shape draws each charge on the field parts the canonical verdict judged', () => {
  const heater = SHAPE_LAYOUT.heater;
  const probe = (s: Slot, arm: number): Pt[] => [[s.x, s.y], [s.x - arm, s.y], [s.x + arm, s.y], [s.x, s.y - arm], [s.x, s.y + arm]];
  for (const g of SHAPES.filter((s) => s.shape !== 'heater')) {
    it(`${g.shape}: each slot touches every part its heater slot clearly touches, and no part it clearly misses`, () => {
      const l = SHAPE_LAYOUT[g.shape];
      for (const ctx of ['field', 'bordure', 'underChief', 'between'] as const) {
        for (const [key, slots] of Object.entries(l.slots[ctx])) {
          slots.forEach((s, i) => {
            const c = heater.slots[ctx][key][i];
            for (const division of DIVISIONS) {
              const parts = (pts: Pt[], fess: { x: number; y: number }) => new Set(pts.map(([x, y]) => inFirstPart(division, fess, x, y)));
              const clearly = parts(probe(c, 0.3 * c.size - PROBE_TOLERANCE), heater.fessPoint);
              const possibly = parts(probe(c, 0.3 * c.size + PROBE_TOLERANCE), heater.fessPoint);
              const drawn = parts(probePoints(s), l.fessPoint);
              const where = `${ctx} ${key} slot ${i + 1} on ${division}`;
              expect([...clearly].every((p) => drawn.has(p)), `${where} misses a part`).toBe(true);
              expect([...drawn].every((p) => possibly.has(p)), `${where} reaches an extra part`).toBe(true);
            }
          });
        }
      }
    });
  }
});

// ── Real artwork in its optically scaled box ────────────────────────────────

/** Each drawing as rings of points in its 0–100 box (the art is M/L/Z polygons only). */
function rings(d: string): Pt[][] {
  return d.split('M').filter(Boolean).map((sub) => {
    const n = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
    return Array.from({ length: n.length / 2 }, (_, i): Pt => [n[2 * i], n[2 * i + 1]]);
  });
}

const DRAWINGS = CHARGE_IDS.flatMap((id) => Object.entries(CHARGE_ART[id]).map(([posture, d]) => ({ id, label: `${id} ${posture}`, rings: rings(d!) })));

const place = (rs: Pt[][], box: Slot): Pt[][] =>
  rs.map((r) => r.map(([x, y]): Pt => [box.x + (x - 50) * box.size / 100, box.y + (y - 50) * box.size / 100]));

/** Even-odd point-in-drawing test across all of a drawing's rings. */
const inDrawing = (rs: Pt[][], p: Pt) => rs.filter((r) => inside(r, p)).length % 2 === 1;

/** Distance from p to the nearest edge of a polygon. */
function edgeDistance(poly: Pt[], [px, py]: Pt): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i];
    const L = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const t = L ? Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / L)) : 0;
    best = Math.min(best, Math.hypot(px - x1 - t * (x2 - x1), py - y1 - t * (y2 - y1)));
  }
  return best;
}

/** Clear of the shape's edge by at least a unit, so the outline never touches a charge. */
const SHIELD_MARGIN = 1;

interface Ground { name: string; slots: Slot[]; fits: (p: Pt) => boolean }

/** Ordinaries whose band is wide enough for the art's corners, so the real art must respect them. */
const ART_RESPECTS: readonly OrdinaryType[] = ['fess', 'pale', 'chief', 'bend', 'bend-sinister', 'pile', 'cross'];
const respects = (t: OrdinaryType) => ART_RESPECTS.includes(t);

function grounds(g: ShapeGeometry): Ground[] {
  const onShape = (p: Pt) => inside(g.outline, p) && edgeDistance(g.outline, p) >= SHIELD_MARGIN;
  const out: Ground[] = [];
  for (const [key, slots] of Object.entries(g.slots.field)) out.push({ name: `field ${key}`, slots, fits: onShape });
  for (const [key, slots] of Object.entries(g.slots.bordure)) out.push({ name: `bordure ${key}`, slots, fits: (p) => inside(g.inset, p) });
  for (const [key, slots] of Object.entries(g.slots.underChief)) out.push({ name: `under chief ${key}`, slots, fits: (p) => onShape(p) && !inside(g.poly('chief'), p) });
  for (const [key, slots] of Object.entries(g.slots.between)) {
    const t = key.split(':')[0] as OrdinaryType;
    out.push({ name: `between ${key}`, slots, fits: (p) => onShape(p) && !(respects(t) && inside(g.poly(t), p)) });
  }
  for (const [key, slots] of Object.entries(g.slots.on)) {
    const t = key.split(':')[0] as OrdinaryType;
    out.push({ name: `on ${key}`, slots, fits: (p) => onShape(p) && (!respects(t) || inside(g.poly(t), p)) });
  }
  return out;
}

describe('charge artwork fits its ground at its optical scale', () => {
  it('every charge has an optical scale between 0.85 and 1.2', () => {
    for (const id of CHARGE_IDS) {
      expect(CHARGES[id].scale, id).toBeGreaterThanOrEqual(0.85);
      expect(CHARGES[id].scale, id).toBeLessThanOrEqual(1.2);
    }
  });

  it('drawnBox scales the slot about its centre', () => {
    const slot = { x: 50, y: 54, size: 90 };
    for (const id of CHARGE_IDS) expect(drawnBox(slot, id)).toEqual({ x: 50, y: 54, size: Math.round(90 * CHARGES[id].scale * 100) / 100 });
  });

  for (const g of SHAPES) {
    for (const ground of grounds(g)) {
      it(`${g.shape} ${ground.name}: every drawing stays on its ground and clear of its neighbours`, () => {
        for (const dr of DRAWINGS) {
          const placed = ground.slots.map((s) => place(dr.rings, drawnBox(s, dr.id as ChargeId)));
          for (const rs of placed) {
            const off = rs.flat().find((p) => !ground.fits(p));
            expect(off, `${dr.label} leaves its ground at ${off}`).toBeUndefined();
          }
          placed.forEach((a, i) => placed.forEach((b, j) => {
            if (i === j) return;
            const hit = a.flat().find((p) => inDrawing(b, p));
            expect(hit, `${dr.label}: charge ${i + 1} overlaps charge ${j + 1} at ${hit}`).toBeUndefined();
          }));
        }
      });
    }
  }
});
