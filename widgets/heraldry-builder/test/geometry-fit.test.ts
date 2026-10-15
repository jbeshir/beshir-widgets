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
  AROUND_COUNTS, ART_ON_BOX, CHARGE_ART, CHARGE_IDS, CHARGES, DRAWN_DIVISIONS, FIELD_SHAPES, SECONDARY_POSITIONS, contextSlots, drawnBox, fieldContext, inFirstPart, layoutCandidates, layoutKey,
  hasBordure, hasChief, layoutContext, layoutOfKey, minSlotSize, onChargeLayouts, ordinaryPath, pathPolygon, pointInPolygon, probePoints, resolve, shapeFrame, structuralIssues,
  type ChargeId, type Design, type FieldShape, type GroundContext, type Layout, type LayoutContext, type OrdinaryType, type Peripheral, type Posture, type SecondaryPosition, type Slot,
} from '../src/lib/heraldry';
import { isHandFitted, reachesHeaterParts } from '../src/lib/heraldry/layout';
import { rings, type Pt } from './art-geometry';
import { log } from './helpers';

// ── The catalogue ───────────────────────────────────────────────────────────

interface Entry { ctx: GroundContext; count: number; layout: Layout; label: string }

const COUNTS = Array.from({ length: 12 }, (_, i) => i + 1);
const BETWEEN: OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'];
const ON: OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'chief', 'bordure'];

const tinctured = (paint: string, item: object, extra: object = {}) => ({ item, paint, ...extra });

const PERIPHERALS: Peripheral[] = ['none', 'chief', 'bordure', 'chief-bordure'];
/** What charges in chief, in base or in canton stand beside: a primary charge (null), or a central ordinary (a sample of the shapes: the sweep is long). */
const POSITION_BESIDE: Array<OrdinaryType | null> = [null, 'fess', 'pale', 'bend', 'chevron', 'saltire'];
/** The counts of primary charges sampled beside them: the small ones and the ends of the range. */
const YIELD_COUNTS = [1, 2, 3, 5, 8, 12];
/** The primaries sampled on the plain field and with a bordure or a chief beside them. */
const AROUND_SAMPLE: Record<'none' | 'bordure' | 'chief', readonly string[]> = {
  none: ['lion', 'swords in-pale', 'swords crossed'], bordure: ['lion', 'swords crossed'], chief: ['lion', 'swords in-fess'],
};
/** The chief and bordure groups that make a design's peripheral. */
const peripheralGroups = (peripheral: Peripheral): object[] => [
  ...(hasChief(peripheral) ? [tinctured('gules', { k: 'ordinary', type: 'chief' })] : []),
  ...(hasBordure(peripheral) ? [tinctured('gules', { k: 'ordinary', type: 'bordure' })] : []),
];
const chargeItem = (id: string) => ({ k: 'charge', charge: id });
/** The primary charges other charges are set around: a lion alone, and two swords in fess, in pale and crossed. */
const AROUND_PRIMARIES: Array<[string, object]> = [
  ['lion', tinctured('or', chargeItem('lion'))],
  ...['in-fess', 'in-pale', 'crossed'].map((arrangement): [string, object] => [`swords ${arrangement}`, tinctured('or', chargeItem('sword'), { count: 2, arrangement })]),
];

function resolved(input: unknown): Design {
  const r = resolve(input);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.design;
}

/** The layouts of `count` charges in each context that the structure rules accept (rejected ones are counted). */
function catalogue(): { entries: Entry[]; rejected: number } {
  const entries: Entry[] = [];
  let rejected = 0;
  const consider = (count: number, ctx: GroundContext, candidates: Layout[], label: string, rebuild: (key: string) => Design) => {
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
      consider(count, fieldContext(peripheral), layoutCandidates(base, path, count), `field/${peripheral}`, make);
    }
  }
  // Charges around and on an ordinary, alone and with a chief and/or a bordure beside it.
  for (const peripheral of PERIPHERALS) {
    const beside = peripheralGroups(peripheral);
    const suffix = peripheral === 'none' ? '' : `/${peripheral}`;
    for (const type of BETWEEN) {
      for (const count of COUNTS) {
        const make = () => resolved({
          v: 2, field: 'azure',
          groups: [tinctured('or', { k: 'ordinary', type }), tinctured('argent', chargeItem('mullet'), { count, relation: 'between' }), ...beside],
        });
        consider(count, { k: 'between', ordinary: type, peripheral }, [layoutOfKey('host', count)!], `between ${type}${suffix}`, make);
      }
    }
    for (const type of ON) {
      // A chief can't have a chief beside it, nor a bordure a bordure.
      if ((type === 'chief' && hasChief(peripheral)) || (type === 'bordure' && hasBordure(peripheral))) continue;
      // What lies beside a bordure doesn't change where its charges go.
      const hostPeripheral: Peripheral = type === 'bordure' ? 'none' : peripheral;
      for (const count of COUNTS) {
        const make = () => resolved({
          v: 2, field: 'azure',
          groups: [tinctured('or', { k: 'ordinary', type }, { charged: [tinctured('argent', chargeItem('mullet'), { count })] }), ...beside],
        });
        consider(count, { k: 'on', ordinary: type, peripheral: hostPeripheral }, [layoutOfKey('host', count)!], `on ${type}${suffix}`, make);
      }
    }
  }
  // Charges set in chief, in base or in canton beside a lion or a central ordinary, and the primary charges that leave them room.
  for (const [peripheral, extra] of peripherals) {
    for (const position of SECONDARY_POSITIONS) {
      if (position !== 'base' && peripheral === 'chief') continue;
      for (const type of POSITION_BESIDE) {
        const primary = type ? tinctured('or', { k: 'ordinary', type }) : tinctured('or', chargeItem('lion'));
        for (const count of COUNTS) {
          // Swords, so that two crossed are a candidate.
          const make = (arrangement?: string) => resolved({
            v: 2, field: 'azure', groups: [primary, tinctured('argent', chargeItem('sword'), { count, position, ...(arrangement ? { arrangement } : {}) }), ...extra],
          });
          const base = make();
          const path = [base.groups.findIndex((g) => g.role === 'secondary')];
          consider(count, { k: 'position', position, ordinary: type, peripheral }, layoutCandidates(base, path, count), `in ${position} beside ${type ?? 'lion'}/${peripheral}`, make);
        }
      }
      for (const count of YIELD_COUNTS) {
        const make = (arrangement?: string) => resolved({
          v: 2, field: 'azure',
          groups: [tinctured('or', chargeItem('sword'), { count, ...(arrangement ? { arrangement } : {}) }), tinctured('argent', chargeItem('mullet'), { position }), ...extra],
        });
        const base = make();
        const path = [base.groups.findIndex((g) => g.role === 'primary')];
        consider(count, { ...fieldContext(peripheral), yields: position }, layoutCandidates(base, path, count), `field/${peripheral}/${position}`, make);
      }
    }
  }
  // Charges set around a lion or two swords, and the primary charges in the box they leave.
  for (const [peripheral, extra] of peripherals) {
    // A sample of the primaries on each ground (the sweep is long in the round shapes).
    for (const [name, primary] of AROUND_PRIMARIES.filter(([name]) => AROUND_SAMPLE[peripheral].includes(name))) {
      for (const count of AROUND_COUNTS) {
        const make = (arrangement?: string) => resolved({
          v: 2, field: 'azure', groups: [primary, tinctured('argent', chargeItem('mullet'), { count, relation: 'between', ...(arrangement ? { arrangement } : {}) }), ...extra],
        });
        const base = make();
        const at = base.groups.findIndex((g) => g.role === 'primary');
        const layout = { arrangement: base.groups[at].arrangement, position: base.groups[at].position };
        const path = [base.groups.findIndex((g) => g.role === 'secondary')];
        consider(count, { k: 'around', peripheral, primary: { count: base.groups[at].count, layout } }, layoutCandidates(base, path, count), `around ${name}/${peripheral}`, make);
      }
      const base = resolved({ v: 2, field: 'azure', groups: [primary, tinctured('argent', chargeItem('mullet'), { count: 3, relation: 'between' }), ...extra] });
      const g = base.groups.find((x) => x.role === 'primary')!;
      consider(g.count, { ...fieldContext(peripheral), yields: 'around' }, [{ arrangement: g.arrangement, position: g.position }], `field/${peripheral}/around ${name}`, () => base);
    }
  }
  return { entries, rejected };
}

const t0 = Date.now();
const { entries: CATALOGUE, rejected: REJECTED } = catalogue();
log(`layout catalogue: ${CATALOGUE.length} legal layouts (${REJECTED} rejected) in ${Date.now() - t0} ms`);

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
  fessY: number;
  poly: (t: OrdinaryType) => Pt[];
}

function shapeGeometry(shape: FieldShape): ShapeGeometry {
  const frame = shapeFrame(shape);
  return {
    shape, outline: pathPolygon(frame.outline), inset: pathPolygon(frame.inset), chiefBase: frame.chiefBase, fessY: frame.fessPoint.y,
    poly: (t) => pathPolygon(ordinaryPath(t, shape)),
  };
}
const SHAPES = FIELD_SHAPES.map(shapeGeometry);

/** What a context's slots must stay inside (`fits`) or, for charges around an ordinary, clear of. */
function groundFits(g: ShapeGeometry, ctx: GroundContext, margin: number, narrowBands: boolean): (p: Pt) => boolean {
  const onShape = (p: Pt) => pointInPolygon(p[0], p[1], g.outline) && edgeDistance(g.outline, p) >= margin;
  // What the chief and bordure beside the group leave: inside the bordure's inner edge, below the chief.
  const inFrame = (p: Pt) => (hasBordure(ctx.peripheral) ? pointInPolygon(p[0], p[1], g.inset) : onShape(p)) && (!hasChief(ctx.peripheral) || p[1] >= g.chiefBase);
  // The room left for charges in chief, in base or in canton: above a line six below the chief's, below one 24 below the fess point, or the corner left of x = 36.
  const inRoom = (position: SecondaryPosition) => ([x, y]: Pt) => (position === 'base' ? y >= g.fessY + 24 : y <= g.chiefBase + 6 && (position === 'chief' || x <= 36));
  if (ctx.k === 'field') {
    if (ctx.yields !== 'chief' && ctx.yields !== 'base' && ctx.yields !== 'canton') return inFrame;
    const yielded = inRoom(ctx.yields);
    return (p) => inFrame(p) && !yielded(p);
  }
  if (ctx.k === 'around') {
    // Clear of the primary charges' glyph discs as they are drawn in this shape.
    const primary = contextSlots({ ...fieldContext(ctx.peripheral), yields: 'around' }, ctx.primary.count, ctx.primary.layout, g.shape);
    return (p) => inFrame(p) && primary.every((s) => Math.hypot(p[0] - s.x, p[1] - s.y) >= 0.4 * s.size);
  }
  if (ctx.k === 'position') {
    const room = inRoom(ctx.position);
    const poly = ctx.ordinary && g.poly(ctx.ordinary);
    const respect = ctx.ordinary !== null && (!narrowBands || ART_RESPECTS.includes(ctx.ordinary));
    return (p) => inFrame(p) && room(p) && !(respect && poly !== null && pointInPolygon(p[0], p[1], poly));
  }
  // On the bordure: inside the shape and outside the bordure's inner edge.
  if (ctx.k === 'on' && ctx.ordinary === 'bordure') return (p) => onShape(p) && !pointInPolygon(p[0], p[1], g.inset);
  const poly = g.poly(ctx.ordinary);
  // Chevron and saltire arms are narrower than a square charge's corners, so only glyph discs are held to them.
  const respect = !narrowBands || ART_RESPECTS.includes(ctx.ordinary);
  return ctx.k === 'between'
    ? (p) => inFrame(p) && !(respect && pointInPolygon(p[0], p[1], poly))
    : (p) => inFrame(p) && (!respect || pointInPolygon(p[0], p[1], poly));
}

/** Ordinaries whose band is wide enough for the art's corners, so the real art must respect them. */
const ART_RESPECTS: readonly OrdinaryType[] = ['fess', 'pale', 'chief', 'bend', 'bend-sinister', 'pile', 'cross'];

// ── Slots on their ground, in every shape ───────────────────────────────────

describe('layout catalogue', () => {
  it('has a legal layout for every context and plenty of them', () => {
    expect(CATALOGUE.length).toBeGreaterThan(150);
    for (const key of [
      'field/none', 'field/bordure', 'field/chief', 'between fess', 'between bend', 'on fess', 'on bend', 'on chevron', 'on chief', 'on cross',
      'between chevron/bordure', 'between pale/chief', 'between bend/chief-bordure', 'on fess/bordure', 'on bend/chief', 'on chief/bordure', 'on bordure', 'on bordure/chief',
      'in chief beside lion/none', 'in base beside chevron/none', 'in canton beside fess/none', 'in base beside fess/chief', 'in chief beside fess/bordure',
      'field/none/chief', 'field/none/base', 'field/none/canton', 'field/bordure/chief', 'field/chief/base',
      'around lion/none 3 rows-2-1', 'around lion/none 4 in-cross', 'around lion/none 8 in-orle', 'around swords crossed/none 4 in-saltire', 'around swords crossed/bordure 2 in-fess',
      'around lion/chief 3', 'field/none/around lion', 'field/bordure/around swords crossed', 'field/chief/around swords in-fess',
    ]) {
      expect(CATALOGUE.some((e) => e.label.startsWith(key)), key).toBe(true);
    }
  });

  it('slots are inside the legible range on the heater', () => {
    const small = CATALOGUE.filter((e) => {
      const slots = contextSlots(e.ctx, e.count, e.layout, 'heater');
      return slots.length !== e.count || slots[0].size < minSlotSize(e.ctx);
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
  'around lion/none 8 in-orle banner',
  'field/chief 3 in-annulo lozenge', 'field/chief 4 in-annulo lozenge', 'field/chief 6 rows-3-2-1 lozenge',
  'around lion/none 8 in-orle lozenge',
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

// ── Charges on the primary charges ──────────────────────────────────────────

/** The primary charges sampled as hosts: a lone charge, two side by side, and the Table 7 rows of three, five and eight. */
const HOST_LAYOUTS: Array<[number, string]> = [[1, 'single'], [2, 'in-fess'], [3, 'rows-2-1'], [5, 'rows-2-2-1'], [8, 'rows-3-3-2']];
/** The charges on each host sampled: the real art of a bold, a detailed and a tall charge. */
const CARRIED = ['mullet', 'rose', 'lion'] as const;

interface OnChargeEntry { ctx: Extract<LayoutContext, { k: 'on-charge' }>; count: number; layout: Layout; label: string }

/** Every layout the structure rules accept of one to four charges on each of the sampled hosts, for every drawing of every charge that carries charges. */
function onChargeCatalogue(): OnChargeEntry[] {
  const entries: OnChargeEntry[] = [];
  for (const id of CHARGE_IDS) {
    for (const posture of Object.keys(ART_ON_BOX[id])) {
      for (const [hostCount, hostKey] of HOST_LAYOUTS) {
        const host = { charge: id, posture: posture === '_' ? null : (posture as Posture), count: hostCount, layout: layoutOfKey(hostKey, hostCount)!, context: fieldContext('none') };
        for (const count of [1, 2, 3, 4]) {
          for (const layout of onChargeLayouts(count)) {
            const ctx = { k: 'on-charge', host } as const;
            const slots = contextSlots(ctx, count, layout, 'heater');
            if (slots.length === hostCount * count && slots[0].size >= minSlotSize(ctx)) entries.push({ ctx, count, layout, label: `${id} ${posture} ×${hostCount} ← ${count} ${layoutKey(layout)}` });
          }
        }
      }
    }
  }
  return entries;
}

const ON_CHARGE = onChargeCatalogue();

describe('charges on the primary charges fit their hosts', () => {
  it('have plenty of legal layouts on the heater', () => {
    expect(ON_CHARGE.length).toBeGreaterThan(240);
    expect(new Set(ON_CHARGE.map((e) => e.ctx.host.charge)).size).toBe(CHARGE_IDS.length - 5);
  });

  for (const g of SHAPES) {
    it(`${g.shape}: every slot lies on its host's drawing, the slots do not touch and are of one size`, () => {
      const problems: string[] = [];
      for (const e of ON_CHARGE) {
        const { host } = e.ctx;
        const hosts = contextSlots(host.context, host.count, host.layout, g.shape);
        const slots = contextSlots(e.ctx, e.count, e.layout, g.shape);
        const where = `${e.label} (${g.shape})`;
        if (slots.length !== hosts.length * e.count) { problems.push(`${where}: ${slots.length} slots`); continue; }
        if (new Set(slots.map((s) => s.size)).size !== 1 || slots[0].size < 1) { problems.push(`${where}: sizes ${[...new Set(slots.map((s) => s.size))]}`); continue; }
        const key = host.posture ?? '_';
        const drawing = rings((CHARGE_ART[host.charge] as Record<string, string>)[key] ?? CHARGE_ART[host.charge][CHARGES[host.charge].defaultPosture ?? '_']!);
        const drawn = hosts.map((h) => place(drawing, drawnBox(h, host.charge)));
        for (const s of slots) {
          // The on-box is mostly inside the drawing (art-onbox.test.ts), so a glyph disc at its edge may reach a gap in it: most of the disc and its centre lie on the host.
          const inside = disc(s).filter((p) => drawn.some((rs) => inDrawing(rs, p))).length;
          if (!drawn.some((rs) => inDrawing(rs, [s.x, s.y])) || inside < 9) problems.push(`${where}: slot ${JSON.stringify(s)} has ${inside}/17 points on its host`);
        }
        if (e.layout.arrangement.k !== 'crossed') {
          slots.forEach((a, i) => slots.slice(i + 1).forEach((b, j) => {
            if (Math.hypot(a.x - b.x, a.y - b.y) < 0.8 * a.size) problems.push(`${where}: slots ${i + 1} and ${i + j + 2} overlap`);
          }));
        }
      }
      expect(problems.slice(0, 25)).toEqual([]);
    }, 60_000);
  }

  it('draw the real artwork of the charges inside the host’s drawing on the heater', () => {
    const problems: string[] = [];
    const g = SHAPES[0];
    for (const e of ON_CHARGE.filter((x) => x.ctx.host.count <= 3)) {
      const { host } = e.ctx;
      const hosts = contextSlots(host.context, host.count, host.layout, g.shape);
      const slots = contextSlots(e.ctx, e.count, e.layout, g.shape);
      const key = host.posture ?? '_';
      const hostDrawing = rings((CHARGE_ART[host.charge] as Record<string, string>)[key] ?? CHARGE_ART[host.charge][CHARGES[host.charge].defaultPosture ?? '_']!);
      const drawnHosts = hosts.map((h) => place(hostDrawing, drawnBox(h, host.charge)));
      for (const id of CARRIED) {
        const art = rings(CHARGE_ART[id][CHARGES[id].defaultPosture ?? '_']!);
        for (const s of slots) {
          const rs = place(art, drawnBox(s, id)).flat();
          const outside = rs.filter((p) => !drawnHosts.some((h) => inDrawing(h, p) || h.flat().some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.5))).length;
          if (outside > 0.25 * rs.length) problems.push(`${e.label}: ${id} sticks out of its host (${outside}/${rs.length} points)`);
        }
      }
    }
    expect(problems.slice(0, 25)).toEqual([]);
  }, 60_000);
});

describe('charges overall stand as a lone primary charge does', () => {
  for (const g of SHAPES) {
    it(`${g.shape}: one charge, or two swords crossed, are the primary's slots and stay on the ground the chief and bordure leave`, () => {
      const problems: string[] = [];
      for (const peripheral of PERIPHERALS) {
        const ctx: LayoutContext = { k: 'overall', peripheral };
        const on = groundFits(g, fieldContext(peripheral), 0, false);
        for (const layout of [{ arrangement: { k: 'single' }, position: null }, { arrangement: { k: 'crossed' }, position: null }] as const) {
          const count = layout.arrangement.k === 'single' ? 1 : 2;
          const slots = contextSlots(ctx, count, layout, g.shape);
          const where = `${peripheral} ${layoutKey(layout)}`;
          if (slots.length !== count) problems.push(`${where}: ${slots.length} slots`);
          else if (slots[0].size < minSlotSize(ctx)) problems.push(`${where}: too small (${slots[0].size})`);
          else if (!slots.every((s) => disc(s).every(on))) problems.push(`${where}: off the ground`);
          if (JSON.stringify(slots) !== JSON.stringify(contextSlots(fieldContext(peripheral), count, layout, g.shape))) problems.push(`${where}: not the primary's slots`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});

describe('two main pictures are laid out as one group', () => {
  const COUNTS_TOGETHER: ReadonlyArray<readonly [number, number]> = [[1, 1], [2, 1], [1, 2]];
  for (const g of SHAPES) {
    it(`${g.shape}: each takes its slice of the slots of all their charges, on the ground the chief and bordure leave`, () => {
      const problems: string[] = [];
      for (const peripheral of PERIPHERALS) {
        const on = groundFits(g, fieldContext(peripheral), 0, false);
        for (const [a, b] of COUNTS_TOGETHER) {
          const d = resolved({ v: 2, field: 'azure', groups: [tinctured('or', chargeItem('lion'), { count: a }), tinctured('argent', chargeItem('rose'), { count: b }), ...peripheralGroups(peripheral)] });
          const first = layoutContext(d, [0]), second = layoutContext(d, [1]);
          if (first.k !== 'field' || second.k !== 'field') throw new Error('not a field context');
          for (const layout of layoutCandidates(d, [0], a)) {
            const where = `${peripheral} ${a}+${b} ${layoutKey(layout)}`;
            const total = contextSlots({ ...first, share: null }, a + b, layout, g.shape);
            const slots = [...contextSlots(first, a, layout, g.shape), ...contextSlots(second, b, layout, g.shape)];
            if (JSON.stringify(slots) !== JSON.stringify(total)) problems.push(`${where}: not the slices of the whole group's slots`);
            else if (total.length > 0 && !total.every((s) => disc(s).every(on))) problems.push(`${where}: off the ground`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
