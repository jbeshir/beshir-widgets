// The slot engine: where the charges of a group are drawn. Hand-fitted rows first (shape-slots.ts, the
// heater's look from before), then a generic engine for every other (context, count, layout) on the
// heater, mapped into the other shapes about their fess points. A layout the engine can't place at a
// legible size is a capacity problem the structure rules report.

import { capitalise } from './words';
import { CHARGES, chargePhrase, type ChargeId } from './charges';
import { groupAt, hostOf, type Design, type GroupPath } from './design';
import { DRAWN_DIVISIONS } from './divisions';
import { ORDINARY_NAME, type OrdinaryType } from './ordinaries';
import {
  BETWEEN, HOST_LAYOUT, contextOf, defaultLayoutOf, hasBordure, hasChief, hostCounts, layoutKey, type Layout, type LayoutContext, type Peripheral,
} from './arrangement';
import {
  CANONICAL_SHAPE, SHIELD_INSET_PATH, inFirstPart, ordinaryPath, pathPolygon, pointInPolygon, probePoints, shapeFrame, type Pt, type Slot,
} from './geometry';
import { HEATER_SLOT_ROWS, SHAPED_SLOT_ROWS, type SlotRow, type SlotRows } from './shape-slots';
import type { FieldShape } from './shape';
import { MAX_DRAWN_COUNT } from './support';

/** The smallest slot (shield units, heater) a charge is drawn in and still reads. */
export const MIN_SLOT_SIZE = 14;

/** Clear space kept between a charge and the shield's edge, and between charges and the band they sit around. */
const MARGIN = 2;
/** Charges are drawn no larger than a lone charge on the field. */
const MAX_SLOT_SIZE = 90;
/** Two crossed long charges share a centre, so they are kept smaller. */
const MAX_CROSSED_SIZE = 72;
/** A slot's glyph disc, as a share of its size: charges are drawn within their box, a little beyond it at an optical scale above 1. */
const GLYPH_RADIUS = 0.5;
/** Slots are drawn no larger than this share of the distance between neighbours. */
const PITCH_SHARE = 0.92;


// ── Hand-fitted rows ────────────────────────────────────────────────────────

/** Degrees a charge on an ordinary is turned to follow it (GoT Table 7: oriented to follow). */
function followRotation(ordinary: OrdinaryType, x: number): number {
  switch (ordinary) {
    case 'bend': return -45;
    case 'bend-sinister': return 45;
    case 'chevron': return x < 50 ? 45 : x > 50 ? -45 : 0;
    default: return 0;
  }
}

function slotsOf([size, ...xy]: SlotRow, rotation: (x: number) => number, skip: number | null = null): Slot[] {
  return xy.filter((_, i) => i !== skip).map(([x, y]) => ({ x, y, size, rotation: rotation(x) }));
}

const handRows = (shape: FieldShape): SlotRows => (shape === 'heater' ? HEATER_SLOT_ROWS : SHAPED_SLOT_ROWS[shape]);

/** The hand-fitted slots for a context, count and layout, or null when they come from the generic engine. */
function handSlots(ctx: LayoutContext, count: number, layout: Layout, shape: FieldShape): Slot[] | null {
  const rows = handRows(shape);
  if (ctx.k === 'field') {
    if (layout.position !== null || ctx.yields !== 'none' || ctx.share !== null) return null;
    const table = { none: rows.field, bordure: rows.bordure, chief: rows.underChief, 'chief-bordure': null }[ctx.peripheral];
    const row = table?.[`${count}:${layoutKey(layout)}`];
    return row ? slotsOf(row, () => 0) : null;
  }
  const turn = (x: number) => (ctx.k === 'on' ? followRotation(ctx.ordinary, x) : 0);
  if (ctx.k === 'on' && count === 4 && (ctx.ordinary === 'cross' || ctx.ordinary === 'saltire')) {
    // One on each arm: the five-charge rows without the centre.
    return slotsOf(rows.on[`${ctx.ordinary}:5`], turn, 2);
  }
  const row = (ctx.k === 'between' ? rows.between : rows.on)[`${ctx.ordinary}:${count}`];
  return row ? slotsOf(row, turn) : null;
}

/** Whether a layout is placed by a hand-fitted row (those are checked against the real art; the rest against glyph discs). */
export function isHandFitted(ctx: LayoutContext, count: number, layout: Layout): boolean {
  return handSlots(ctx, count, layout, CANONICAL_SHAPE) !== null;
}

// ── Generic engine: nominal centres ─────────────────────────────────────────

interface Area { x0: number; y0: number; x1: number; y1: number }
interface Centre { x: number; y: number; rotation: number }

const at = (x: number, y: number, rotation = 0): Centre => ({ x, y, rotation });
const area = (x0: number, y0: number, x1: number, y1: number): Area => ({ x0, y0, x1, y1 });

const FIELD_AREA = area(4, 4, 96, 112);
const BORDURE_AREA = area(12, 12, 88, 104);
const UNDER_CHIEF_AREA = area(4, 33, 96, 112);
const BORDURE_UNDER_CHIEF_AREA = area(12, 33, 88, 104);
const CHIEF_POSITION_AREA = area(4, 4, 96, 36);
const BASE_POSITION_AREA = area(10, 74, 90, 114);
/** Lines in bend run corner to corner of a square the shield's narrowing base leaves room for. */
const BEND_AREA = area(10, 10, 90, 90);
const BORDURE_BEND_AREA = area(18, 18, 82, 82);
const UNDER_CHIEF_BEND_AREA = area(14, 40, 86, 112);
const BORDURE_UNDER_CHIEF_BEND_AREA = area(18, 40, 82, 82);

/** The areas charges set on the field are laid out in, by the peripherals the design has: straight, and for lines in bend. */
const FIELD_AREAS: Record<Peripheral, { straight: Area; bend: Area }> = {
  none: { straight: FIELD_AREA, bend: BEND_AREA },
  chief: { straight: UNDER_CHIEF_AREA, bend: UNDER_CHIEF_BEND_AREA },
  bordure: { straight: BORDURE_AREA, bend: BORDURE_BEND_AREA },
  'chief-bordure': { straight: BORDURE_UNDER_CHIEF_AREA, bend: BORDURE_UNDER_CHIEF_BEND_AREA },
};

const width = (a: Area) => a.x1 - a.x0;
const height = (a: Area) => a.y1 - a.y0;
const centreOf = (a: Area): Pt => [(a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2];

/** `m` centres evenly spaced along a segment, each in the middle of its share of it. */
function along(from: Pt, to: Pt, m: number): Centre[] {
  return Array.from({ length: m }, (_, i) => {
    const t = (i + 0.5) / m;
    return at(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
  });
}

/** A line of `m` charges in an area, running pale, fess, bend or bend sinister. */
function lineIn(a: Area, m: number, dir: 'pale' | 'fess' | 'bend' | 'bend-sinister'): Centre[] {
  const [cx, cy] = centreOf(a);
  const side = Math.min(width(a), height(a));
  switch (dir) {
    case 'pale': return along([cx, a.y0], [cx, a.y1], m);
    case 'fess': return along([a.x0, cy], [a.x1, cy], m);
    case 'bend': return along([cx - side / 2, cy - side / 2], [cx + side / 2, cy + side / 2], m);
    case 'bend-sinister': return along([cx + side / 2, cy - side / 2], [cx - side / 2, cy + side / 2], m);
  }
}

/** Rows of charges, top row first, each centred with a common pitch. */
function rowsIn(a: Area, rows: readonly number[]): Centre[] {
  const [cx] = centreOf(a);
  const pitch = width(a) / Math.max(...rows);
  return rows.flatMap((n, j) => {
    const y = a.y0 + ((j + 0.5) * height(a)) / rows.length;
    return Array.from({ length: n }, (_, i) => at(cx + (i - (n - 1) / 2) * pitch, y));
  });
}

/** Evenly by arc length along a closed polygon, from `start` (a vertex) clockwise. */
function aroundRing(ring: readonly Pt[], m: number): Pt[] {
  const closed = [...ring, ring[0]];
  const lengths = closed.slice(1).map((p, i) => Math.hypot(p[0] - closed[i][0], p[1] - closed[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  return Array.from({ length: m }, (_, k) => {
    let rest = (k / m) * total, i = 0;
    while (rest > lengths[i]) rest -= lengths[i++];
    const t = rest / lengths[i];
    return [closed[i][0] + (closed[i + 1][0] - closed[i][0]) * t, closed[i][1] + (closed[i + 1][1] - closed[i][1]) * t];
  });
}

/** The heater's bordure ring starting at top centre and running clockwise. */
const ORLE_RING: Pt[] = (() => {
  const ring = pathPolygon(SHIELD_INSET_PATH);
  return [[50, ring[0][1]], ...ring.slice(1), ring[0]];
})();
const ORLE_SCALE = 0.92;

function fieldCentres(ctx: Extract<LayoutContext, { k: 'field' }>, count: number, layout: Layout): Centre[] | null {
  const a = layout.position === 'chief' ? CHIEF_POSITION_AREA
    : layout.position === 'base' ? BASE_POSITION_AREA
    : FIELD_AREAS[ctx.peripheral].straight;
  const [cx, cy] = centreOf(a);
  const reach = Math.min(width(a), height(a));
  const arr = layout.arrangement;
  if (layout.position !== null && arr.k !== 'single' && !(arr.k === 'line' && arr.dir === 'fess')) return null;
  switch (arr.k) {
    case 'single': return count === 1 ? [at(cx, cy)] : null;
    case 'line': {
      if (count < 2) return null;
      const bend = arr.dir === 'bend' || arr.dir === 'bend-sinister';
      return lineIn(layout.position === null && bend ? FIELD_AREAS[ctx.peripheral].bend : a, count, arr.dir);
    }
    case 'rows': return count >= 2 && arr.rows.reduce((x, y) => x + y, 0) === count ? rowsIn(a, arr.rows) : null;
    case 'crossed': return count === 2 ? [at(cx, cy, -45), at(cx, cy, 45)] : null;
    case 'pattern': {
      switch (arr.pattern) {
        case 'cross': {
          if (count !== 4 && count !== 5) return null;
          const r = 0.36 * reach;
          return [at(cx, cy - r), at(cx - r, cy), ...(count === 5 ? [at(cx, cy)] : []), at(cx + r, cy), at(cx, cy + r)];
        }
        case 'saltire': {
          if (count !== 4 && count !== 5) return null;
          const r = 0.3 * reach;
          return [at(cx - r, cy - r), at(cx + r, cy - r), ...(count === 5 ? [at(cx, cy)] : []), at(cx - r, cy + r), at(cx + r, cy + r)];
        }
        case 'annulo': {
          if (count < 2) return null;
          // A bigger ring from nine charges on, so twelve still reach the smallest legible size.
          const r = (count > 8 ? 0.36 : 0.33) * reach;
          return Array.from({ length: count }, (_, i) => {
            const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
            return at(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
          });
        }
        case 'orle': {
          if (count < 5 || ctx.peripheral !== 'none') return null;
          return aroundRing(ORLE_RING, count).map(([x, y]) => at(cx + ORLE_SCALE * (x - cx), cy + ORLE_SCALE * (y - cy)));
        }
        default: return null;
      }
    }
    default: return null;
  }
}

const mirrored = (cs: Centre[]): Centre[] => cs.map((c) => at(100 - c.x, c.y));

function betweenCentres(ordinary: OrdinaryType, count: number): Centre[] | null {
  const split = BETWEEN[ordinary]?.[count]?.split;
  if (!split) return null;
  const [first, second] = split;
  switch (ordinary) {
    case 'fess': return [...lineIn(area(4, 4, 96, 33), first, 'fess'), ...lineIn(area(4, 67, 96, 104), second, 'fess')];
    case 'pale': return [...lineIn(area(4, 4, 33, 96), first, 'pale'), ...lineIn(area(67, 4, 96, 96), second, 'pale')];
    // Two lines parallel to the bend, 40 above and below it.
    case 'bend': return [...along([48, 8], [92, 52], first), ...along([8, 48], [52, 92], second)];
    case 'bend-sinister': return mirrored([...along([48, 8], [92, 52], first), ...along([8, 48], [52, 92], second)]);
    case 'chevron': return [...lineIn(area(4, 4, 96, 36), first, 'fess'), ...rowsIn(area(30, 84, 70, 116), second === 1 ? [1] : [2, 1])];
    default: return null;
  }
}

/** Where along an ordinary's axis charges on it are strung: a centre, a direction and the half-length. */
const ON_AXIS: Partial<Record<OrdinaryType, { from: Pt; to: Pt }>> = {
  fess: { from: [6, 50], to: [94, 50] },
  pale: { from: [50, 6], to: [50, 104] },
  chief: { from: [6, 15], to: [94, 15] },
  bend: { from: [13, 13], to: [87, 87] },
  'bend-sinister': { from: [87, 13], to: [13, 87] },
};

/** The heater chevron's centre line at its apex, and how far along a limb charges are spread at most. */
const CHEVRON_APEX: Pt = [50, 55.56];
const LIMB_REACH = 46;
const LIMB_PITCH = 36.8;

function onCentres(ordinary: OrdinaryType, count: number): Centre[] | null {
  const axis = ON_AXIS[ordinary];
  if (axis) return along(axis.from, axis.to, count);
  if (ordinary !== 'chevron') return null;
  // The apex takes the middle charge of an odd count; the rest are shared equally along the two limbs.
  const perLimb = Math.floor(count / 2);
  const odd = count % 2 === 1;
  const pitch = Math.min(LIMB_PITCH, LIMB_REACH / (odd ? perLimb : perLimb - 0.5));
  const centres = odd ? [at(CHEVRON_APEX[0], CHEVRON_APEX[1])] : [];
  for (let j = 1; j <= perLimb; j++) {
    const d = (odd ? j : j - 0.5) * pitch * Math.SQRT1_2;
    centres.push(at(CHEVRON_APEX[0] - d, CHEVRON_APEX[1] + d), at(CHEVRON_APEX[0] + d, CHEVRON_APEX[1] + d));
  }
  return centres;
}

function nominalCentres(ctx: LayoutContext, count: number, layout: Layout): Centre[] | null {
  if (ctx.k === 'field') return fieldCentres(ctx, count, layout);
  if (layout.arrangement.k !== 'host' || layout.position !== null || !hostCounts(ctx).includes(count)) return null;
  return (ctx.k === 'between' ? betweenCentres(ctx.ordinary, count) : onCentres(ctx.ordinary, count));
}

// ── Generic engine: fitting ─────────────────────────────────────────────────

/** What the slots must stay inside and clear of, in one shape. */
export interface Ground {
  contain: readonly Pt[];
  /** Slots lie below this line (under a chief). */
  minTop: number;
  /** Polygons the slots stay clear of (the ordinary they are set between). */
  avoid: readonly (readonly Pt[])[];
  /** A polygon the slots stay inside (the ordinary they are set on), if any. */
  within: readonly Pt[] | null;
}

/** The part of a shape the peripherals leave to the field: inside the bordure, below the chief. */
function frameGround(peripheral: Peripheral, shape: FieldShape): Pick<Ground, 'contain' | 'minTop'> {
  const frame = shapeFrame(shape);
  return {
    contain: pathPolygon(hasBordure(peripheral) ? frame.inset : frame.outline),
    minTop: hasChief(peripheral) ? frame.chiefBase : -Infinity,
  };
}

export function groundFor(ctx: LayoutContext, shape: FieldShape): Ground {
  if (ctx.k === 'field') return { ...frameGround(ctx.peripheral, shape), avoid: [], within: null };
  const polygon = pathPolygon(ordinaryPath(ctx.ordinary, shape));
  return {
    ...frameGround('none', shape),
    avoid: ctx.k === 'between' ? [polygon] : [],
    within: ctx.k === 'on' ? polygon : null,
  };
}

function edgeDistance(poly: readonly Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i];
    const len = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const t = len ? Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / len)) : 0;
    best = Math.min(best, (x - x1 - t * (x2 - x1)) ** 2 + (y - y1 - t * (y2 - y1)) ** 2);
  }
  return Math.sqrt(best);
}

/** Whether slots of this size at these centres sit on their ground without touching each other. */
export function fits(centres: readonly Centre[], size: number, ground: Ground, crossed: boolean): boolean {
  const r = GLYPH_RADIUS * size;
  for (const c of centres) {
    if (!pointInPolygon(c.x, c.y, ground.contain) || edgeDistance(ground.contain, c.x, c.y) < r + MARGIN) return false;
    if (c.y - r - MARGIN < ground.minTop) return false;
    if (ground.within && (!pointInPolygon(c.x, c.y, ground.within) || edgeDistance(ground.within, c.x, c.y) < r)) return false;
    if (ground.avoid.some((poly) => pointInPolygon(c.x, c.y, poly) || edgeDistance(poly, c.x, c.y) < r + MARGIN)) return false;
  }
  if (!crossed) {
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        if (Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y) < 2 * r + MARGIN) return false;
      }
    }
  }
  return true;
}

const floorHalf = (n: number) => Math.floor(n * 2) / 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The largest slot size (to half a unit) that fits, 0 when none does. */
function largestSize(centres: readonly Centre[], ground: Ground, crossed: boolean): number {
  let cap = crossed ? MAX_CROSSED_SIZE : MAX_SLOT_SIZE;
  if (!crossed && centres.length > 1) {
    let pitch = Infinity;
    centres.forEach((a, i) => centres.slice(i + 1).forEach((b) => { pitch = Math.min(pitch, Math.hypot(a.x - b.x, a.y - b.y)); }));
    cap = Math.min(cap, PITCH_SHARE * pitch);
  }
  if (fits(centres, cap, ground, crossed)) return floorHalf(cap);
  let lo = 0, hi = cap;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (fits(centres, mid, ground, crossed)) lo = mid; else hi = mid;
  }
  return floorHalf(lo);
}

const toSlots = (centres: readonly Centre[], size: number): Slot[] =>
  [...centres]
    .sort((a, b) => (Math.abs(a.y - b.y) < 0.01 ? a.x - b.x : a.y - b.y))
    .map((c) => ({ x: r2(c.x), y: r2(c.y), size, rotation: c.rotation }));

function heaterGeneric(ctx: LayoutContext, count: number, layout: Layout): Slot[] {
  const centres = nominalCentres(ctx, count, layout);
  if (!centres) return [];
  const crossed = layout.arrangement.k === 'crossed';
  const size = largestSize(centres, groundFor(ctx, CANONICAL_SHAPE), crossed);
  if (size < 1) return [];
  return toSlots(centres, size);
}

/** How far a probe arm may differ from the canonical one before the parts it reaches must agree. */
const PROBE_TOLERANCE = 2;

/** Whether each slot reaches the same parts of every divided field as its heater slot (to a tolerance at the arms' ends). */
function samePartsAsHeater(heater: readonly Slot[], mapped: readonly Slot[], shape: FieldShape): boolean {
  const heaterFess = shapeFrame(CANONICAL_SHAPE).fessPoint, fess = shapeFrame(shape).fessPoint;
  const probesAt = (s: Slot, arm: number): Pt[] => probePoints({ ...s, size: arm / 0.3 });
  return DRAWN_DIVISIONS.every((division) => heater.every((h, i) => {
    const parts = (points: Pt[], f: { x: number; y: number }) => new Set(points.map(([x, y]) => inFirstPart(division, f, x, y)));
    const clearly = parts(probesAt(h, 0.3 * h.size - PROBE_TOLERANCE), heaterFess);
    const possibly = parts(probesAt(h, 0.3 * h.size + PROBE_TOLERANCE), heaterFess);
    const drawn = parts(probePoints(mapped[i]), fess);
    return [...clearly].every((p) => drawn.has(p)) && [...drawn].every((p) => possibly.has(p));
  }));
}

/** How the heater's centres are moved into another shape: spread about the fess points by kx and ky, then shifted down by dy. */
type Spread = readonly [kx: number, ky: number, dy: number];

function centresIn(heater: readonly Slot[], [kx, ky, dy]: Spread, shape: FieldShape): Centre[] {
  const f = shapeFrame(shape).fessPoint, h = shapeFrame(CANONICAL_SHAPE).fessPoint;
  return heater.map((s) => at(f.x + kx * (s.x - h.x), f.y + ky * (s.y - h.y) + dy, s.rotation));
}

const SPREAD_STEP = 0.05;
const SPREADS = Array.from({ length: 15 }, (_, i) => 1 - i * SPREAD_STEP);
const SHIFTS = Array.from({ length: 21 }, (_, i) => -20 + 2 * i);

/**
 * A layout with no hand rows in another shape: the heater's slots drawn about the shape's fess point, as
 * close to the heater's spread as the shape allows (the largest slots win, then the first tried), and
 * only where each slot still reaches the field parts its heater slot does. Spreading both ways by the
 * same factor is tried first, then each way on its own, then with the whole group shifted up or down.
 * Where even that can't keep the parts (a ring of charges under a chief in a lozenge), the largest fit wins
 * and `reachesHeaterParts` says so.
 */
function genericIn(ctx: LayoutContext, count: number, layout: Layout, shape: FieldShape): Slot[] {
  const heater = heaterGeneric(ctx, count, layout);
  if (shape === CANONICAL_SHAPE || heater.length === 0) return heater;
  const ground = groundFor(ctx, shape);
  const crossed = layout.arrangement.k === 'crossed';
  const search = (spreads: Spread[], keepParts = true): Slot[] => {
    let best: Slot[] = [];
    for (const spread of spreads) {
      const centres = centresIn(heater, spread, shape);
      const size = Math.min(heater[0].size, largestSize(centres, ground, crossed));
      if (size < 1 || (best.length > 0 && size <= best[0].size)) continue;
      const slots = toSlots(centres, size);
      if (keepParts && !samePartsAsHeater(heater, slots, shape)) continue;
      best = slots;
      if (size === heater[0].size) break;
    }
    return best;
  };
  const stages: Array<() => Spread[]> = [
    () => SPREADS.map((k): Spread => [k, k, 0]),
    () => SPREADS.flatMap((kx) => SPREADS.map((ky): Spread => [kx, ky, 0])),
    () => SHIFTS.flatMap((dy) => SPREADS.flatMap((kx) => SPREADS.map((ky): Spread => [kx, ky, dy]))),
  ];
  for (const stage of stages) {
    const slots = search(stage());
    if (slots.length > 0) return slots;
  }
  return search(stages[2](), false);
}

/** Whether a layout drawn in a shape reaches the field parts its heater slots do (all layouts do but a few in the smaller shapes). */
export function reachesHeaterParts(ctx: LayoutContext, count: number, layout: Layout, shape: FieldShape): boolean {
  const heater = contextSlots(ctx, count, layout, CANONICAL_SHAPE);
  return samePartsAsHeater(heater, contextSlots(ctx, count, layout, shape), shape);
}

// ── Public ──────────────────────────────────────────────────────────────────

const memo = new Map<string, Slot[]>();

/**
 * The slots of a group of `count` charges in a layout in a shape, in reading order; [] when the
 * combination has no layout (structure.ts says why). The arrays are shared: don't change them.
 */
export function contextSlots(ctx: LayoutContext, count: number, layout: Layout, shape: FieldShape): Slot[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_DRAWN_COUNT) return [];
  const key = `${JSON.stringify(ctx)}|${count}|${layoutKey(layout)}|${shape}`;
  let slots = memo.get(key);
  if (!slots) {
    slots = handSlots(ctx, count, layout, shape) ?? genericIn(ctx, count, layout, shape);
    memo.set(key, slots);
  }
  return slots;
}

function layoutOf(d: Design, path: GroupPath): { id: ChargeId; ctx: LayoutContext; count: number; layout: Layout } | null {
  const group = groupAt(d, path);
  const ctx = contextOf(d, group, hostOf(d, path));
  if (group.item.k !== 'charge' || ctx === null) return null;
  return { id: group.item.charge, ctx, count: group.count, layout: { arrangement: group.arrangement, position: group.position } };
}

/** Where a group's charges are drawn in a shape; [] for an ordinary or a group that sits where this builder has no layout. */
export function groupSlots(d: Design, path: GroupPath, shape: FieldShape): Slot[] {
  const l = layoutOf(d, path);
  return l ? contextSlots(l.ctx, l.count, l.layout, shape) : [];
}

/** The heater slots of a group: what the rule of tincture probes. */
export function canonicalSlots(d: Design, path: GroupPath): Slot[] {
  return groupSlots(d, path, CANONICAL_SHAPE);
}

/** The most charges, counting up from one, that fit legibly in a context; `layoutFor` says how n charges are laid out. */
export function largestFittingCount(ctx: LayoutContext, layoutFor: (n: number) => Layout): number {
  let n = 0;
  while (n < MAX_DRAWN_COUNT) {
    const slots = contextSlots(ctx, n + 1, layoutFor(n + 1), CANONICAL_SHAPE);
    if (slots.length !== n + 1 || slots[0].size < MIN_SLOT_SIZE) break;
    n += 1;
  }
  return n;
}

function whereWords(ctx: LayoutContext, layout: Layout): string {
  if (layout.position) return `in ${layout.position}`;
  switch (ctx.k) {
    case 'field': return ctx.peripheral === 'chief-bordure' ? 'within the bordure, under the chief' : hasChief(ctx.peripheral) ? 'under the chief' : hasBordure(ctx.peripheral) ? 'within the bordure' : 'on the field';
    case 'between': return `around the ${ORDINARY_NAME[ctx.ordinary]}`;
    case 'on': return `on the ${ORDINARY_NAME[ctx.ordinary]}`;
  }
}

/** Whether a group's charges fit where they sit at a size that reads; false for a layout the count doesn't have. Groups that sit where this builder has no layout have nothing to fit, so they do. */
export function hasRoom(d: Design, path: GroupPath): boolean {
  const l = layoutOf(d, path);
  if (!l) return true;
  const slots = contextSlots(l.ctx, l.count, l.layout, CANONICAL_SHAPE);
  return slots.length === l.count && slots[0].size >= MIN_SLOT_SIZE;
}

/** Why a group's charges don't fit where they sit (the most that would, and where), or null when they do (or when they sit nowhere this builder lays out). Only meaningful once the layout itself is legal. */
export function capacityIssue(d: Design, path: GroupPath): { most: number; where: string; message: string } | null {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (contextOf(d, group, host) === null) return null;
  const l = layoutOf(d, path);
  if (!l || hasRoom(d, path)) return null;
  const { id } = l;
  const layoutFor = (n: number): Layout => {
    const a = group.arrangement;
    if (n === group.count) return l.layout;
    if (l.ctx.k !== 'field') return HOST_LAYOUT;
    if (n === 1) return { arrangement: { k: 'single' }, position: group.position };
    if (a.k === 'line' || a.k === 'single') return { arrangement: { k: 'line', dir: a.k === 'line' ? a.dir : 'fess' }, position: group.position };
    return defaultLayoutOf(d, group, host, n);
  };
  const most = largestFittingCount(l.ctx, layoutFor);
  const where = whereWords(l.ctx, l.layout);
  const message = most === 0
    ? `${capitalise(CHARGES[id].plural)} can't be set ${where} like this.`
    : `There isn't room for ${chargePhrase(id, l.count)} ${where} — at most ${most} fit.`;
  return { most, where, message };
}
