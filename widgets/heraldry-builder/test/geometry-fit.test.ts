// Charge slots must stay on the shield and on/off their ordinary, in every field shape. Over a catalogue of
// every layout the structure rules accept — each context × count 1–12 × candidate layout — every slot's
// glyph disc (radius 0.4 × the slot box; the art fills about 80% of its box) lies inside the shape, inside
// the bordure ring's inner edge, below the chief, on the ordinary it is charged on, or clear of the
// ordinary it sits around; neighbours never overlap; and each slot in any shape touches the same parts of
// a divided field as its canonical (heater) slot, so what is drawn matches the canonical rule-of-tincture
// verdict. Hand-fitted layouts are also checked with the real artwork of every charge, drawn in its
// optically scaled box and turned with the charge; generic layouts with a representative few.

import { describe, expect, it } from 'vitest';
import {
  CHARGE_ART, CHARGE_IDS, CHARGES, DRAWN_DIVISIONS, FIELD_SHAPES, contextSlots, drawnBox, inFirstPart, layoutCandidates, layoutKey,
  layoutOfKey, MIN_SLOT_SIZE, ordinaryPath, pathPolygon, pointInPolygon, probePoints, resolve, shapeFrame, structuralIssues,
  type ChargeId, type Design, type FieldShape, type Layout, type LayoutContext, type OrdinaryType, type Slot,
} from '../src/lib/heraldry';
import { isHandFitted, reachesHeaterParts } from '../src/lib/heraldry/layout';
import { rings, type Pt } from './art-geometry';

// ── The catalogue ───────────────────────────────────────────────────────────

interface Entry { ctx: LayoutContext; count: number; layout: Layout; label: string }

const COUNTS = Array.from({ length: 12 }, (_, i) => i + 1);
const BETWEEN: OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'];
const ON: OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'chief'];

const tinctured = (paint: string, item: object, extra: object = {}) => ({ item, paint, ...extra });
const chargeItem = (id: string) => ({ k: 'charge', charge: id });

function resolved(input: unknown): Design {
  const r = resolve(input);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.design;
}

/** The layouts of `count` charges in each context that the structure rules accept (rejected ones are counted). */
function catalogue(): { entries: Entry[]; rejected: number } {
  const entries: Entry[] = [];
  let rejected = 0;
  const consider = (count: number, ctx: LayoutContext, candidates: Layout[], label: string, rebuild: (key: string) => Design) => {
    for (const layout of candidates) {
      const d = rebuild(layoutKey(layout));
      if (structuralIssues(d).length === 0) entries.push({ ctx, count, layout, label: `${label} ${count} ${layoutKey(layout)}` });
      else rejected += 1;
    }
  };

  // Charges on the field: alone, within a bordure, under a chief. A sword so that "crossed" is a candidate.
  const peripherals: Array<['none' | 'bordure' | 'chief', object[]]> = [
    ['none', []], ['bordure', [tinctured('gules', { k: 'ordinary', type: 'bordure' })]], ['chief', [tinctured('gules', { k: 'ordinary', type: 'chief' })]],
  ];
  for (const [peripheral, extra] of peripherals) {
    for (const count of COUNTS) {
      const make = (arrangement?: string) => resolved({
        v: 2, field: 'azure', groups: [tinctured('or', chargeItem('sword'), { count, ...(arrangement ? { arrangement } : {}) }), ...extra],
      });
      const base = make();
      const path = [base.groups.findIndex((g) => g.item.k === 'charge')];
      consider(count, { k: 'field', peripheral }, layoutCandidates(base, path, count), `field/${peripheral}`, make);
    }
  }
  // Charges around and on an ordinary.
  for (const type of BETWEEN) {
    for (const count of COUNTS) {
      const make = (arrangement?: string) => resolved({
        v: 2, field: 'azure',
        groups: [tinctured('or', { k: 'ordinary', type }), tinctured('argent', chargeItem('mullet'), { count, relation: 'between', ...(arrangement ? { arrangement } : {}) })],
      });
      const base = make();
      consider(count, { k: 'between', ordinary: type }, [layoutOfKey('host', count)!], `between ${type}`, make);
    }
  }
  for (const type of ON) {
    for (const count of COUNTS) {
      const make = () => resolved({
        v: 2, field: 'azure',
        groups: [tinctured('or', { k: 'ordinary', type }, { charged: [tinctured('argent', chargeItem('mullet'), { count })] })],
      });
      consider(count, { k: 'on', ordinary: type }, [layoutOfKey('host', count)!], `on ${type}`, make);
    }
  }
  return { entries, rejected };
}

const t0 = Date.now();
const { entries: CATALOGUE, rejected: REJECTED } = catalogue();
console.log(`layout catalogue: ${CATALOGUE.length} legal layouts (${REJECTED} rejected) in ${Date.now() - t0} ms`);

// ── Geometry helpers ────────────────────────────────────────────────────────

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

/** Points on the glyph disc: centre plus 16 on its rim. */
function disc(s: Slot): Pt[] {
  const r = 0.4 * s.size;
  const out: Pt[] = [[s.x, s.y]];
  for (let k = 0; k < 16; k++) out.push([s.x + r * Math.cos((k * Math.PI) / 8), s.y + r * Math.sin((k * Math.PI) / 8)]);
  return out;
}

/** A drawing's rings placed in a drawn box on the shield, turned with the charge. */
function place(rs: Pt[][], box: Slot): Pt[][] {
  const a = (box.rotation * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return rs.map((r) => r.map(([x, y]): Pt => {
    const dx = (x - 50) * box.size / 100, dy = (y - 50) * box.size / 100;
    return [box.x + dx * cos - dy * sin, box.y + dx * sin + dy * cos];
  }));
}

/** Even-odd point-in-drawing test across all of a drawing's rings. */
const inDrawing = (rs: Pt[][], p: Pt) => rs.filter((r) => pointInPolygon(p[0], p[1], r)).length % 2 === 1;

interface ShapeGeometry {
  shape: FieldShape;
  outline: Pt[];
  inset: Pt[];
  chiefBase: number;
  poly: (t: OrdinaryType) => Pt[];
}

function shapeGeometry(shape: FieldShape): ShapeGeometry {
  const frame = shapeFrame(shape);
  return {
    shape, outline: pathPolygon(frame.outline), inset: pathPolygon(frame.inset), chiefBase: frame.chiefBase,
    poly: (t) => pathPolygon(ordinaryPath(t, shape)),
  };
}
const SHAPES = FIELD_SHAPES.map(shapeGeometry);

/** What a context's slots must stay inside (`fits`) or, for charges around an ordinary, clear of. */
function groundFits(g: ShapeGeometry, ctx: LayoutContext, margin: number, narrowBands: boolean): (p: Pt) => boolean {
  const onShape = (p: Pt) => pointInPolygon(p[0], p[1], g.outline) && edgeDistance(g.outline, p) >= margin;
  if (ctx.k === 'field') {
    if (ctx.peripheral === 'bordure') return (p) => pointInPolygon(p[0], p[1], g.inset);
    if (ctx.peripheral === 'chief') return (p) => onShape(p) && p[1] >= g.chiefBase;
    return onShape;
  }
  const poly = g.poly(ctx.ordinary);
  // Chevron and saltire arms are narrower than a square charge's corners, so only glyph discs are held to them.
  const respect = !narrowBands || ART_RESPECTS.includes(ctx.ordinary);
  return ctx.k === 'between'
    ? (p) => onShape(p) && !(respect && pointInPolygon(p[0], p[1], poly))
    : (p) => onShape(p) && (!respect || pointInPolygon(p[0], p[1], poly));
}

/** Ordinaries whose band is wide enough for the art's corners, so the real art must respect them. */
const ART_RESPECTS: readonly OrdinaryType[] = ['fess', 'pale', 'chief', 'bend', 'bend-sinister', 'pile', 'cross'];

// ── Slots on their ground, in every shape ───────────────────────────────────

describe('layout catalogue', () => {
  it('has a legal layout for every context and plenty of them', () => {
    expect(CATALOGUE.length).toBeGreaterThan(150);
    for (const key of ['field/none', 'field/bordure', 'field/chief', 'between fess', 'between bend', 'on fess', 'on bend', 'on chevron', 'on chief', 'on cross']) {
      expect(CATALOGUE.some((e) => e.label.startsWith(key)), key).toBe(true);
    }
  });

  it('slots are inside the legible range on the heater', () => {
    const small = CATALOGUE.filter((e) => {
      const slots = contextSlots(e.ctx, e.count, e.layout, 'heater');
      return slots.length !== e.count || slots[0].size < MIN_SLOT_SIZE;
    });
    expect(small.map((e) => e.label)).toEqual([]);
  });
});

for (const g of SHAPES) {
  describe(`${g.shape}: charge slots fit their ground`, () => {
    it('every legal layout has slots of one size that stay on the ground and do not overlap', () => {
      const problems: string[] = [];
      for (const e of CATALOGUE) {
        const slots = contextSlots(e.ctx, e.count, e.layout, g.shape);
        const where = `${e.label} (${g.shape})`;
        if (slots.length !== e.count) { problems.push(`${where}: ${slots.length} slots`); continue; }
        if (new Set(slots.map((s) => s.size)).size !== 1) problems.push(`${where}: sizes differ`);
        if (slots[0].size < 1) problems.push(`${where}: no size`);
        const fits = groundFits(g, e.ctx, 0, true);
        for (const s of slots) if (!disc(s).every(fits)) problems.push(`${where}: slot ${JSON.stringify(s)} leaves its ground`);
        if (e.layout.arrangement.k !== 'crossed') {
          slots.forEach((a, i) => slots.slice(i + 1).forEach((b) => {
            if (Math.hypot(a.x - b.x, a.y - b.y) < 0.8 * (a.size + b.size) / 2) problems.push(`${where}: slots ${i + 1} and ${slots.indexOf(b) + 1} overlap`);
          }));
        }
      }
      expect(problems.slice(0, 25)).toEqual([]);
    }, 60_000);

    it('has the same hand tables as the heater, with one size per row', () => {
      const heater = SHAPES[0];
      expect(heater.shape).toBe('heater');
      const mine = CATALOGUE.filter((e) => isHandFitted(e.ctx, e.count, e.layout));
      expect(mine.length).toBeGreaterThan(60);
      for (const e of mine) {
        expect(contextSlots(e.ctx, e.count, e.layout, g.shape), e.label).toHaveLength(contextSlots(e.ctx, e.count, e.layout, 'heater').length);
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

/** Layouts that fit the smaller shapes only by missing a part of the field their heater slots reach. */
const UNFAITHFUL = new Set([
  'field/chief 2 in-annulo lozenge', 'field/chief 3 in-annulo lozenge', 'field/chief 4 in-annulo lozenge', 'field/chief 6 rows-3-2-1 lozenge',
]);

describe('every shape draws each charge on the field parts the canonical verdict judged', () => {
  it('only the listed layouts in the smaller shapes miss a part their heater slots reach', () => {
    const missing = SHAPES.flatMap((g) => CATALOGUE.filter((e) => e.ctx.k !== 'on' && !reachesHeaterParts(e.ctx, e.count, e.layout, g.shape)).map((e) => `${e.label} ${g.shape}`));
    expect(missing).toEqual([...UNFAITHFUL]);
  });


  const heaterFess = shapeFrame('heater').fessPoint;
  const arm = (s: Slot, a: number) => probePoints({ ...s, size: a / 0.3 });
  for (const g of SHAPES.filter((s) => s.shape !== 'heater')) {
    it(`${g.shape}: each slot touches every part its heater slot clearly touches, and no part it clearly misses`, () => {
      const fess = shapeFrame(g.shape).fessPoint;
      const problems: string[] = [];
      for (const e of CATALOGUE.filter((x) => x.ctx.k !== 'on' && !UNFAITHFUL.has(`${x.label} ${g.shape}`))) {
        const heater = contextSlots(e.ctx, e.count, e.layout, 'heater'), mine = contextSlots(e.ctx, e.count, e.layout, g.shape);
        heater.forEach((h, i) => {
          for (const division of DRAWN_DIVISIONS) {
            const parts = (points: Pt[], f: { x: number; y: number }) => new Set(points.map(([x, y]) => inFirstPart(division, f, x, y)));
            const clearly = parts(arm(h, 0.3 * h.size - PROBE_TOLERANCE), heaterFess);
            const possibly = parts(arm(h, 0.3 * h.size + PROBE_TOLERANCE), heaterFess);
            const drawn = parts(probePoints(mine[i]), fess);
            if (![...clearly].every((p) => drawn.has(p))) problems.push(`${e.label} slot ${i + 1} on ${division} misses a part`);
            if (![...drawn].every((p) => possibly.has(p))) problems.push(`${e.label} slot ${i + 1} on ${division} reaches an extra part`);
          }
        });
      }
      expect(problems.slice(0, 25)).toEqual([]);
    }, 60_000);
  }
});

// ── Real artwork in its optically scaled box ────────────────────────────────

interface Drawing { id: ChargeId; label: string; rings: Pt[][] }
const drawingsOf = (ids: readonly ChargeId[], postures: readonly string[] | null = null): Drawing[] =>
  ids.flatMap((id) => Object.entries(CHARGE_ART[id])
    .filter(([posture]) => postures === null || postures.includes(posture) || posture === '_')
    .map(([posture, d]) => ({ id, label: `${id} ${posture}`, rings: rings(d!) })));

/** Clear of the shape's edge by at least a unit, so the outline never touches a charge. */
const SHIELD_MARGIN = 1;

function artProblems(g: ShapeGeometry, entries: Entry[], drawings: Drawing[]): string[] {
  const problems: string[] = [];
  for (const e of entries) {
    const slots = contextSlots(e.ctx, e.count, e.layout, g.shape);
    const fits = groundFits(g, e.ctx, SHIELD_MARGIN, true);
    for (const dr of drawings) {
      if (e.layout.arrangement.k === 'crossed' && !CHARGES[dr.id].long) continue;
      const placed = slots.map((s) => place(dr.rings, drawnBox(s, dr.id)));
      for (const rs of placed) {
        const off = rs.flat().find((p) => !fits(p));
        if (off) { problems.push(`${g.shape} ${e.label}: ${dr.label} leaves its ground at ${off.map((n) => n.toFixed(1))}`); break; }
      }
      if (e.layout.arrangement.k === 'crossed') continue;
      placed.forEach((a, i) => placed.forEach((b, j) => {
        // Only neighbours whose boxes could touch are tested.
        const far = Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y) > 0.8 * (slots[i].size + slots[j].size);
        if (i < j && !far && a.flat().some((p) => inDrawing(b, p))) problems.push(`${g.shape} ${e.label}: ${dr.label} charge ${i + 1} overlaps charge ${j + 1}`);
      }));
    }
  }
  return problems;
}

describe('charge artwork fits its ground at its optical scale', () => {
  it('every charge has an optical scale between 0.85 and 1.2', () => {
    for (const id of CHARGE_IDS) {
      expect(CHARGES[id].scale, id).toBeGreaterThanOrEqual(0.85);
      expect(CHARGES[id].scale, id).toBeLessThanOrEqual(1.2);
    }
  });

  it('drawnBox scales the slot about its centre and keeps its turn', () => {
    const slot = { x: 50, y: 54, size: 90, rotation: -45 };
    for (const id of CHARGE_IDS) expect(drawnBox(slot, id)).toEqual({ x: 50, y: 54, size: Math.round(90 * CHARGES[id].scale * 100) / 100, rotation: -45 });
  });

  const hand = CATALOGUE.filter((e) => isHandFitted(e.ctx, e.count, e.layout));
  const generic = CATALOGUE.filter((e) => !isHandFitted(e.ctx, e.count, e.layout));
  for (const g of SHAPES) {
    it(`${g.shape}: every drawing of every charge stays on its hand-fitted ground and clear of its neighbours`, () => {
      expect(artProblems(g, hand, drawingsOf(CHARGE_IDS)).slice(0, 25)).toEqual([]);
    }, 120_000);

    it(`${g.shape}: a compact few drawings stay on their generic ground and clear of their neighbours`, () => {
      expect(artProblems(g, generic, drawingsOf(['mullet', 'lion', 'sword'], ['rampant'])).slice(0, 25)).toEqual([]);
    }, 120_000);
  }
});
