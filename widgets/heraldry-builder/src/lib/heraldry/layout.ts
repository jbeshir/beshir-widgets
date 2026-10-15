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
  AROUND_COUNTS, BETWEEN, HOST_LAYOUT, aroundLayouts, contextOf, defaultLayoutOf, fieldContext, hasBordure, hasChief, hostCounts, layoutKey, layoutWords, positionLayout, sameLayout,
  type Layout, type LayoutContext, type Peripheral, type SecondaryPosition, type Yield,
} from './arrangement';
import {
  CANONICAL_SHAPE, SHIELD_INSET_PATH, inFirstPart, ordinaryPath, pathPolygon, pointInPolygon, probePoints, shapeFrame, type Pt, type Slot,
} from './geometry';
import { HEATER_SLOT_ROWS, SHAPED_SLOT_ROWS, type SlotRow, type SlotRows } from './shape-slots';
import type { FieldShape } from './shape';
import { MAX_DRAWN_COUNT } from './support';

/** The smallest slot (shield units, heater) a charge is drawn in and still reads. */
export const MIN_SLOT_SIZE = 14;
/** The smallest slot of a charge on a bordure: the band is ten units wide on the heater, so charges on it are small. */
const MIN_BORDURE_SLOT_SIZE = 6;

/** Clear space kept between a charge and the shield's edge, and between charges and the band they sit around. */
const MARGIN = 2;
/** Charges on a bordure keep this clear of its two edges: the band is too narrow for more. */
const BORDURE_MARGIN = 1.5;
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
  if (ctx.k === 'position' || ctx.k === 'around') return null;
  if (ctx.k === 'field') {
    if (layout.position !== null || ctx.yields !== 'none' || ctx.share !== null) return null;
    const table = { none: rows.field, bordure: rows.bordure, chief: rows.underChief, 'chief-bordure': null }[ctx.peripheral];
    const row = table?.[`${count}:${layoutKey(layout)}`];
    return row ? slotsOf(row, () => 0) : null;
  }
  if (ctx.peripheral !== 'none') return null;
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
const CANTON_POSITION_AREA = area(4, 4, 36, 36);

/** Where a secondary group set by position stands on the heater; the primary charges keep to the rest of the field. */
const POSITION_AREAS: Record<SecondaryPosition, Area> = { chief: CHIEF_POSITION_AREA, base: BASE_POSITION_AREA, canton: CANTON_POSITION_AREA };
/** What the primary charges keep to on the heater when a secondary group stands in chief, in base or in canton (the canton only takes a corner). */
const YIELDED_AREAS: Record<SecondaryPosition, Area> = { chief: area(0, 36, 100, 120), base: area(0, 0, 100, 74), canton: area(0, 0, 100, 120) };
/**
 * Primary charges with charges set around them keep to a box in the middle of what the peripherals leave (on the heater
 * with none, x 25–75 and y 22–82); the charges around stand in its corners and at its sides, above and below it. Both
 * are written as shares of the free area, so a chief or bordure moves and shrinks them with it. Under a chief the box
 * starts lower, leaving the charges above it room below the chief.
 */
const AROUND_BOX = { x0: 0.23, y0: 0.17, x1: 0.77, y1: 0.72 };
const AROUND_BOX_TOP_UNDER_CHIEF = 0.27;
/** Where charges set around the primary charges stand, as shares of the free area: the corners, the sides, above and below the box. */
type AroundSpot = 'topLeft' | 'topRight' | 'left' | 'right' | 'above' | 'below' | 'bottomLeft' | 'bottomRight';
const AROUND_SPOTS: Record<AroundSpot, Pt> = {
  topLeft: [0.13, 0.11], topRight: [0.87, 0.11], left: [0.1, 0.44], right: [0.9, 0.44],
  above: [0.5, 0.075], below: [0.5, 0.89], bottomLeft: [0.2, 0.78], bottomRight: [0.8, 0.78],
};

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

/** The room a primary leaves for a secondary group set by position, or null when it leaves none (or all around, which has its own layouts). */
const yieldedPosition = (y: Yield): SecondaryPosition | null => (y === 'chief' || y === 'base' || y === 'canton' ? y : null);

/** The point at shares (fx, fy) of an area. */
const share = (a: Area, [fx, fy]: Pt): Pt => [a.x0 + fx * width(a), a.y0 + fy * height(a)];

/** The box primary charges keep to when charges are set around them, in a shape. */
function aroundBox(peripheral: Peripheral, shape: FieldShape): Area {
  const free = shapeFreeArea(peripheral, shape);
  const [x0, y0] = share(free, [AROUND_BOX.x0, hasChief(peripheral) ? AROUND_BOX_TOP_UNDER_CHIEF : AROUND_BOX.y0]), [x1, y1] = share(free, [AROUND_BOX.x1, AROUND_BOX.y1]);
  return area(x0, y0, x1, y1);
}

/** The areas primary charges are laid out in: what the peripherals leave, less the room left for a secondary group. */
function primaryAreas(ctx: Extract<LayoutContext, { k: 'field' }>): { straight: Area; bend: Area } {
  const areas = FIELD_AREAS[ctx.peripheral];
  if (ctx.yields === 'around') {
    const box = aroundBox(ctx.peripheral, CANONICAL_SHAPE);
    return { straight: box, bend: box };
  }
  const yielded = yieldedPosition(ctx.yields);
  if (!yielded) return areas;
  const rest = YIELDED_AREAS[yielded];
  return { straight: within(areas.straight, rest), bend: within(areas.bend, rest) };
}

function fieldCentres(ctx: Extract<LayoutContext, { k: 'field' }>, count: number, layout: Layout): Centre[] | null {
  const areas = primaryAreas(ctx);
  const a = layout.position === 'chief' ? CHIEF_POSITION_AREA
    : layout.position === 'base' ? BASE_POSITION_AREA
    : areas.straight;
  const [cx, cy] = centreOf(a);
  const reach = Math.min(width(a), height(a));
  const arr = layout.arrangement;
  if (layout.position !== null && arr.k !== 'single' && !(arr.k === 'line' && arr.dir === 'fess')) return null;
  switch (arr.k) {
    case 'single': return count === 1 ? [at(cx, cy)] : null;
    case 'line': {
      if (count < 2) return null;
      const bend = arr.dir === 'bend' || arr.dir === 'bend-sinister';
      return lineIn(layout.position === null && bend ? areas.bend : a, count, arr.dir);
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

/** The part of `a` inside `bounds`: an area of no height or width where they don't meet. */
function within(a: Area, bounds: Area): Area {
  const x0 = Math.max(a.x0, bounds.x0), y0 = Math.max(a.y0, bounds.y0);
  return area(x0, y0, Math.max(x0, Math.min(a.x1, bounds.x1)), Math.max(y0, Math.min(a.y1, bounds.y1)));
}

/** `m` centres evenly along the part of a segment inside `bounds` (none when the segment misses it). */
function alongWithin(from: Pt, to: Pt, m: number, bounds: Area): Centre[] {
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[from[0], to[0] - from[0], bounds.x0, bounds.x1], [from[1], to[1] - from[1], bounds.y0, bounds.y1]] as const) {
    if (d === 0) {
      if (p < lo || p > hi) return [];
      continue;
    }
    const [a, b] = [(lo - p) / d, (hi - p) / d].sort((x, y) => x - y);
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  if (t0 >= t1) return [];
  const at01 = (t: number): Pt => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  return along(at01(t0), at01(t1), m);
}

/** What the peripherals leave of the field to set charges in (the whole heater when there are none). */
const freeArea = (peripheral: Peripheral): Area => FIELD_AREAS[peripheral].straight;

/**
 * Charges set between a central ordinary. With a chief or bordure the lines they are strung along keep to the
 * free area; where the ordinary leaves nothing there the slots come out too small and the structure rules say so.
 */
function betweenCentres(ordinary: OrdinaryType, count: number, peripheral: Peripheral): Centre[] | null {
  const split = BETWEEN[ordinary]?.[count]?.split;
  if (!split) return null;
  const [first, second] = split;
  const free = freeArea(peripheral);
  const zone = (a: Area): Area => (peripheral === 'none' ? a : within(a, free));
  const slanted = (from: Pt, to: Pt, m: number) => (peripheral === 'none' ? along(from, to, m) : alongWithin(from, to, m, free));
  switch (ordinary) {
    case 'fess': return [...lineIn(zone(area(4, 4, 96, 33)), first, 'fess'), ...lineIn(zone(area(4, 67, 96, 104)), second, 'fess')];
    case 'pale': return [...lineIn(zone(area(4, 4, 33, 96)), first, 'pale'), ...lineIn(zone(area(67, 4, 96, 96)), second, 'pale')];
    // Two lines parallel to the bend, 40 above and below it.
    case 'bend': return [...slanted([48, 8], [92, 52], first), ...slanted([8, 48], [52, 92], second)];
    case 'bend-sinister': return mirrored([...slanted([48, 8], [92, 52], first), ...slanted([8, 48], [52, 92], second)]);
    case 'chevron': {
      // Under a chief the charges beside the apex lie in the band below it.
      const above = hasChief(peripheral) ? area(4, free.y0, 96, free.y0 + 30) : area(4, 4, 96, 36);
      return [...lineIn(zone(above), first, 'fess'), ...rowsIn(zone(area(30, 84, 70, 116)), second === 1 ? [1] : [2, 1])];
    }
    default: return null;
  }
}

/** A secondary group set by position: one charge in the middle of its place, a row across it, rows, or two crossed, kept within the bordure. */
function positionCentres(ctx: Extract<LayoutContext, { k: 'position' }>, count: number, layout: Layout): Centre[] | null {
  if (layout.position !== ctx.position) return null;
  const a = within(POSITION_AREAS[ctx.position], freeArea(ctx.peripheral));
  const [cx, cy] = centreOf(a);
  const arr = layout.arrangement;
  switch (arr.k) {
    case 'single': return count === 1 ? [at(cx, cy)] : null;
    case 'line': return count >= 2 && arr.dir === 'fess' ? lineIn(a, count, 'fess') : null;
    case 'rows': return arr.rows.reduce((x, y) => x + y, 0) === count ? rowsIn(a, arr.rows) : null;
    case 'crossed': return count === 2 ? [at(cx, cy, -45), at(cx, cy, 45)] : null;
    default: return null;
  }
}

/** The radius of a ring of charges in annulo round the primary charges, as a share of the free area's width. */
const AROUND_ANNULO_REACH = 0.42;

/** How far (heater units) a spot around the primary charges may move to where it has the most room. */
const SETTLE_REACH = 14;

/**
 * The spot near `c` with the most clear room on a ground: furthest from the field's edge, the chief and the primary charges
 * (nearest to `c` among equals). A spot off the field (a heater's corner in a lozenge) is first drawn in towards `towards`.
 * A spot on the middle line moves only up or down; one right of it is the mirror of its partner on the left, so the layout
 * stays symmetric.
 */
function settle(spot: Centre, ground: Ground, towards: Pt): Centre {
  if (spot.x > 50) {
    const m = settle(at(100 - spot.x, spot.y), ground, [100 - towards[0], towards[1]]);
    return at(100 - m.x, m.y);
  }
  const room = (x: number, y: number): number => {
    if (!pointInPolygon(x, y, ground.contain) || ground.avoid.some((poly) => pointInPolygon(x, y, poly))) return -Infinity;
    return Math.min(edgeDistance(ground.contain, x, y), y - ground.minTop, ...ground.avoid.map((poly) => edgeDistance(poly, x, y)));
  };
  let c = spot;
  for (let t = 0.05; t < 1 && room(c.x, c.y) === -Infinity; t += 0.05) c = at(spot.x + (towards[0] - spot.x) * t, spot.y + (towards[1] - spot.y) * t);
  let best = { x: c.x, y: c.y, room: room(c.x, c.y), moved: 0 };
  // Every second unit across the reach, then every unit round the best of those.
  const search = (x0: number, y0: number, reach: number, step: number) => {
    const across = c.x === 50 ? 0 : reach;
    for (let dx = -across; dx <= across; dx += step) {
      for (let dy = -reach; dy <= reach; dy += step) {
        const x = x0 + dx, y = y0 + dy;
        const r = room(x, y), moved = Math.hypot(x - c.x, y - c.y);
        if (r > best.room || (r === best.room && moved < best.moved)) best = { x, y, room: r, moved };
      }
    }
  };
  search(c.x, c.y, SETTLE_REACH, 2);
  search(best.x, best.y, 1, 1);
  return at(best.x, best.y);
}

/**
 * What the peripherals leave of a shape to set charges in, as an area: the bounds of the field (or the bordure's inner
 * edge) less a margin, below the chief. On the heater these are `FIELD_AREAS`' straight areas.
 */
function shapeFreeArea(peripheral: Peripheral, shape: FieldShape): Area {
  const frame = shapeFrame(shape);
  const ring = pathPolygon(hasBordure(peripheral) ? frame.inset : frame.outline);
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const [side, foot] = hasBordure(peripheral) ? [2, 6] : [4, 8];
  return area(Math.min(...xs) + side, hasChief(peripheral) ? frame.chiefBase + 3 : Math.min(...ys) + side, Math.max(...xs) - side, Math.max(...ys) - foot);
}

/**
 * Charges set around the primary charges, laid out in each shape's own field (charges round a box in the middle don't map
 * well from the heater's corners): in the box's corners, at its sides, above and below it (each settled where it has most
 * room), or in a ring round the edge; no larger than on the heater. Where that would touch other parts of a divided field
 * than the heater's slots do, the heater's slots are mapped into the shape instead, as for other generic layouts.
 */
function aroundSlots(ctx: Extract<LayoutContext, { k: 'around' }>, count: number, layout: Layout, shape: FieldShape): Slot[] {
  const own = aroundIn(ctx, count, layout, shape);
  if (shape === CANONICAL_SHAPE) return own;
  const heater = contextSlots(ctx, count, layout, CANONICAL_SHAPE);
  if (heater.length === 0) return [];
  return own.length === count && samePartsAsHeater(heater, own, shape) ? own : mappedFromHeater(heater, groundFor(ctx, shape), false, shape);
}

/** The slots of charges set around the primary charges laid out in a shape's own field. */
function aroundIn(ctx: Extract<LayoutContext, { k: 'around' }>, count: number, layout: Layout, shape: FieldShape): Slot[] {
  if (!aroundLayouts(count, ctx.peripheral).some((l) => sameLayout(l, layout))) return [];
  const free = shapeFreeArea(ctx.peripheral, shape);
  const ground = groundFor(ctx, shape);
  const spots = (...names: AroundSpot[]): Centre[] => names.map((n) => { const [x, y] = share(free, AROUND_SPOTS[n]); return settle(at(x, y), ground, centreOf(free)); });
  const arr = layout.arrangement;
  const centres = ((): Centre[] => {
    switch (arr.k) {
      case 'line': return { fess: () => spots('left', 'right'), pale: () => spots('above', 'below'), bend: () => spots('topLeft', 'bottomRight'), 'bend-sinister': () => spots('topRight', 'bottomLeft') }[arr.dir]();
      // Two and one, or two and two in the box's corners.
      case 'rows': return arr.rows.length === 2 && arr.rows[1] === 2 ? spots('topLeft', 'topRight', 'bottomLeft', 'bottomRight') : spots('topLeft', 'topRight', 'below');
      case 'pattern': {
        if (arr.pattern === 'saltire') return spots('topLeft', 'topRight', 'bottomLeft', 'bottomRight');
        if (arr.pattern === 'cross') return spots('above', 'left', 'right', 'below');
        if (arr.pattern === 'annulo') {
          // In a ring round the box, from the top.
          const [bx, by] = centreOf(aroundBox(ctx.peripheral, shape));
          const r = AROUND_ANNULO_REACH * width(free);
          return Array.from({ length: count }, (_, i) => at(bx + r * Math.sin((2 * Math.PI * i) / count), by - r * Math.cos((2 * Math.PI * i) / count)));
        }
        // In orle: evenly round the bordure's line of the shape, drawn in a little.
        const [cx, cy] = centreOf(free);
        return evenlyFromTop(pathPolygon(shapeFrame(shape).inset), count).map(([x, y]) => at(cx + ORLE_SCALE * (x - cx), cy + ORLE_SCALE * (y - cy)));
      }
      default: throw new RangeError(`No layout around the primary charges is ${layoutKey(layout)}.`);
    }
  })();
  const heater = shape === CANONICAL_SHAPE ? MAX_SLOT_SIZE : contextSlots(ctx, count, layout, CANONICAL_SHAPE)[0]?.size ?? 0;
  const size = Math.min(heater, largestSize(centres, ground, false));
  return size < 1 ? [] : toSlots(centres, size);
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

/** The chief's axis moves down to the middle of what a bordure leaves of it. */
const BORDURED_CHIEF_AXIS: { from: Pt; to: Pt } = { from: [6, 20], to: [94, 20] };

function onCentres(ordinary: OrdinaryType, count: number, peripheral: Peripheral): Centre[] | null {
  const axis = ordinary === 'chief' && hasBordure(peripheral) ? BORDURED_CHIEF_AXIS : ON_AXIS[ordinary];
  if (axis) return peripheral === 'none' ? along(axis.from, axis.to, count) : alongWithin(axis.from, axis.to, count, freeArea(peripheral));
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

/** Where the hand rows of a context without peripherals put its slots: the nominal centres of the ordinaries the engine has no rule for. */
function handCentres(ctx: Extract<LayoutContext, { k: 'between' | 'on' }>, count: number): Centre[] | null {
  const slots = handSlots({ ...ctx, peripheral: 'none' }, count, HOST_LAYOUT, CANONICAL_SHAPE);
  return slots && slots.map((s) => at(s.x, s.y, s.rotation));
}

function nominalCentres(ctx: Exclude<LayoutContext, { k: 'around' }>, count: number, layout: Layout): Centre[] | null {
  if (ctx.k === 'field') return fieldCentres(ctx, count, layout);
  if (ctx.k === 'position') return positionCentres(ctx, count, layout);
  if (layout.arrangement.k !== 'host' || layout.position !== null || !hostCounts(ctx.k, ctx.ordinary).includes(count)) return null;
  const ruled = ctx.k === 'between' ? betweenCentres(ctx.ordinary, count, ctx.peripheral) : onCentres(ctx.ordinary, count, ctx.peripheral);
  return ruled ?? (ctx.peripheral === 'none' ? null : handCentres(ctx, count));
}

// ── Charges on a bordure ────────────────────────────────────────────────────

/** The ring moved outwards by half its distance from `edge` (each corner along its bisector): the middle of the band between them. */
function midline(path: readonly Pt[], edge: readonly Pt[]): Pt[] {
  // A flattened closed path ends on its first point; the ring has it once.
  const ring = path.filter((p, i) => i === 0 || p[0] !== path[i - 1][0] || p[1] !== path[i - 1][1]);
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  const area = ring.reduce((sum, [x, y], i) => { const [nx, ny] = ring[(i + 1) % ring.length]; return sum + x * ny - nx * y; }, 0);
  const outward = (a: Pt, b: Pt): Pt => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [dx, dy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return area > 0 ? [dy, -dx] : [-dy, dx];
  };
  return ring.map((p, i) => {
    const before = outward(ring[(i + ring.length - 1) % ring.length], p), after = outward(p, ring[(i + 1) % ring.length]);
    const sum: Pt = [before[0] + after[0], before[1] + after[1]];
    const len = Math.hypot(sum[0], sum[1]) || 1;
    const normal: Pt = [sum[0] / len, sum[1] / len];
    const half = edgeDistance(edge, p[0], p[1]) / 2;
    // A corner is moved along its bisector far enough that both sides move by `half`.
    const reach = half / Math.max(0.5, normal[0] * after[0] + normal[1] * after[1]);
    return [p[0] + normal[0] * reach, p[1] + normal[1] * reach];
  });
}

/** `m` points evenly by arc length along a closed polyline, the first at the top of it on the vertical axis, going clockwise. */
function evenlyFromTop(ring: readonly Pt[], m: number): Pt[] {
  const closed = [...ring, ring[0]];
  const lengths = closed.slice(1).map((p, i) => Math.hypot(p[0] - closed[i][0], p[1] - closed[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const area = ring.reduce((sum, [x, y], i) => { const [nx, ny] = ring[(i + 1) % ring.length]; return sum + x * ny - nx * y; }, 0);
  // Where the ring crosses x = 50 highest up.
  let top = { y: Infinity, at: 0 }, before = 0;
  closed.slice(1).forEach((p, i) => {
    const [a, b] = [closed[i], p];
    if ((a[0] - 50) * (b[0] - 50) <= 0 && a[0] !== b[0]) {
      const t = (50 - a[0]) / (b[0] - a[0]), y = a[1] + (b[1] - a[1]) * t;
      if (y < top.y) top = { y, at: before + t * lengths[i] };
    }
    before += lengths[i];
  });
  return Array.from({ length: m }, (_, k) => {
    // The polylines run clockwise on the page when their signed area is positive.
    let rest = (((top.at + (area > 0 ? 1 : -1) * (k / m) * total) % total) + total) % total, i = 0;
    while (rest > lengths[i]) rest -= lengths[i++];
    const t = rest / lengths[i];
    return [closed[i][0] + (closed[i + 1][0] - closed[i][0]) * t, closed[i][1] + (closed[i + 1][1] - closed[i][1]) * t];
  });
}

/** Upright charges evenly along the middle of the bordure of a shape: the arrangement follows the bordure. */
function bordureCentres(count: number, shape: FieldShape): Centre[] {
  const frame = shapeFrame(shape);
  const centre = midline(pathPolygon(frame.inset), pathPolygon(frame.outline));
  return evenlyFromTop(centre, count).map(([x, y]) => at(x, y));
}

/** Charges on a bordure are laid out in each shape's own bordure, not mapped from the heater's. */
function bordureSlots(count: number, shape: FieldShape): Slot[] {
  const centres = bordureCentres(count, shape);
  const size = largestSize(centres, groundFor({ k: 'on', ordinary: 'bordure', peripheral: 'none' }, shape), false);
  return size < 1 ? [] : toSlots(centres, size);
}

// ── Generic engine: fitting ─────────────────────────────────────────────────

/** What the slots must stay inside and clear of, in one shape. */
export interface Ground {
  contain: readonly Pt[];
  /** How far a slot's glyph disc keeps from the edges of `contain` and from the polygons it avoids. */
  margin: number;
  /** Slots lie below this line (under a chief). */
  minTop: number;
  /** Polygons the slots stay clear of (the ordinary they are set between). */
  avoid: readonly (readonly Pt[])[];
  /** A polygon the slots stay inside (the ordinary they are set on), if any. */
  within: readonly Pt[] | null;
}

/** The part of a shape the peripherals leave to the field: inside the bordure, below the chief. */
function frameGround(peripheral: Peripheral, shape: FieldShape): Pick<Ground, 'contain' | 'margin' | 'minTop'> {
  const frame = shapeFrame(shape);
  return {
    contain: pathPolygon(hasBordure(peripheral) ? frame.inset : frame.outline),
    margin: MARGIN,
    minTop: hasChief(peripheral) ? frame.chiefBase : -Infinity,
  };
}

/**
 * The room a secondary group set by position stands in, in a shape: above a line across the chief, below one across the
 * base, or the top corner left of a line down from the chief's. The heater's lines are those of `POSITION_AREAS`; other
 * shapes move them with their chief and fess point.
 */
function positionRoom(position: SecondaryPosition, shape: FieldShape): Pt[] {
  const frame = shapeFrame(shape);
  const chiefLine = frame.chiefBase + CHIEF_POSITION_AREA.y1 - shapeFrame(CANONICAL_SHAPE).chiefBase;
  const baseLine = frame.fessPoint.y + BASE_POSITION_AREA.y0 - shapeFrame(CANONICAL_SHAPE).fessPoint.y;
  const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  switch (position) {
    case 'chief': return rect(-10, -10, 110, chiefLine);
    case 'base': return rect(-10, baseLine, 110, 130);
    case 'canton': return rect(-10, -10, CANTON_POSITION_AREA.x1, chiefLine);
  }
}

/** A polygon round a slot's glyph disc (its corners on the circle's outside), for keeping other charges clear of it. */
function discPolygon(s: Slot): Pt[] {
  const r = (GLYPH_RADIUS * s.size) / Math.cos(Math.PI / 24);
  return Array.from({ length: 24 }, (_, k): Pt => [s.x + r * Math.cos((k * Math.PI) / 12), s.y + r * Math.sin((k * Math.PI) / 12)]);
}

/** How much smaller the box of the primary charges is in a shape than on the heater: the shapes with less room in their corners give the charges around more. */
const AROUND_ROOM_SCALE: Record<FieldShape, number> = { heater: 1, banner: 0.9, round: 0.8, lozenge: 0.65 };

/** The box of `aroundBox` in a shape, shrunk about its centre where the shape has less room in its corners. */
function aroundRoom(peripheral: Peripheral, shape: FieldShape): Pt[] {
  const box = aroundBox(peripheral, shape);
  const k = AROUND_ROOM_SCALE[shape];
  const [cx, cy] = centreOf(box);
  const x0 = cx - (k * width(box)) / 2, x1 = cx + (k * width(box)) / 2, y0 = cy - (k * height(box)) / 2, y1 = cy + (k * height(box)) / 2;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

export function groundFor(ctx: LayoutContext, shape: FieldShape): Ground {
  if (ctx.k === 'field') {
    if (ctx.yields === 'around') return { ...frameGround(ctx.peripheral, shape), avoid: [], within: aroundRoom(ctx.peripheral, shape) };
    const yielded = yieldedPosition(ctx.yields);
    return { ...frameGround(ctx.peripheral, shape), avoid: yielded ? [positionRoom(yielded, shape)] : [], within: null };
  }
  if (ctx.k === 'position') {
    const avoid = ctx.ordinary ? [pathPolygon(ordinaryPath(ctx.ordinary, shape))] : [];
    return { ...frameGround(ctx.peripheral, shape), avoid, within: positionRoom(ctx.position, shape) };
  }
  if (ctx.k === 'around') {
    // Clear of each primary charge as it is drawn in this shape.
    const primary = contextSlots({ ...fieldContext(ctx.peripheral), yields: 'around' }, ctx.primary.count, ctx.primary.layout, shape);
    return { ...frameGround(ctx.peripheral, shape), avoid: primary.map(discPolygon), within: null };
  }
  if (ctx.k === 'on' && ctx.ordinary === 'bordure') {
    // On the ring: inside the outline, outside the inner edge.
    const frame = shapeFrame(shape);
    return { contain: pathPolygon(frame.outline), margin: BORDURE_MARGIN, minTop: -Infinity, avoid: [pathPolygon(frame.inset)], within: null };
  }
  const polygon = pathPolygon(ordinaryPath(ctx.ordinary, shape));
  return {
    ...frameGround(ctx.peripheral, shape),
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
    if (!pointInPolygon(c.x, c.y, ground.contain) || edgeDistance(ground.contain, c.x, c.y) < r + ground.margin) return false;
    if (c.y - r - ground.margin < ground.minTop) return false;
    if (ground.within && (!pointInPolygon(c.x, c.y, ground.within) || edgeDistance(ground.within, c.x, c.y) < r)) return false;
    if (ground.avoid.some((poly) => pointInPolygon(c.x, c.y, poly) || edgeDistance(poly, c.x, c.y) < r + ground.margin)) return false;
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

function heaterGeneric(ctx: Exclude<LayoutContext, { k: 'around' }>, count: number, layout: Layout): Slot[] {
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
function genericIn(ctx: Exclude<LayoutContext, { k: 'around' }>, count: number, layout: Layout, shape: FieldShape): Slot[] {
  const heater = heaterGeneric(ctx, count, layout);
  if (shape === CANONICAL_SHAPE || heater.length === 0) return heater;
  return mappedFromHeater(heater, groundFor(ctx, shape), layout.arrangement.k === 'crossed', shape);
}

/** The heater's slots drawn in another shape on its ground, as `genericIn` describes. */
function mappedFromHeater(heater: readonly Slot[], ground: Ground, crossed: boolean, shape: FieldShape): Slot[] {
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
    slots = ctx.k === 'around' ? aroundSlots(ctx, count, layout, shape)
      : ctx.k === 'on' && ctx.ordinary === 'bordure' ? bordureSlots(count, shape)
      : handSlots(ctx, count, layout, shape) ?? genericIn(ctx, count, layout, shape);
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

/** The smallest slot (heater units) the charges of a context are drawn in. */
export const minSlotSize = (ctx: LayoutContext): number => (ctx.k === 'on' && ctx.ordinary === 'bordure' ? MIN_BORDURE_SLOT_SIZE : MIN_SLOT_SIZE);

/** The most charges, counting up from one, that fit legibly in a context; `layoutFor` says how n charges are laid out. */
export function largestFittingCount(ctx: LayoutContext, layoutFor: (n: number) => Layout): number {
  let n = 0;
  while (n < MAX_DRAWN_COUNT) {
    const slots = contextSlots(ctx, n + 1, layoutFor(n + 1), CANONICAL_SHAPE);
    if (slots.length !== n + 1 || slots[0].size < minSlotSize(ctx)) break;
    n += 1;
  }
  return n;
}

/** The most charges that fit legibly around the primary charges, in some layout of their count. */
function largestAroundCount(ctx: Extract<LayoutContext, { k: 'around' }>): number {
  const fitting = AROUND_COUNTS.filter((n) => aroundLayouts(n, ctx.peripheral).some((layout) => {
    const slots = contextSlots(ctx, n, layout, CANONICAL_SHAPE);
    return slots.length === n && slots[0].size >= minSlotSize(ctx);
  }));
  return Math.max(0, ...fitting);
}

/** What the peripherals beside a group of charges do to where they sit, as a trailing phrase. */
function peripheralWords(peripheral: Peripheral): string {
  return peripheral === 'chief-bordure' ? ', within the bordure and under the chief' : hasChief(peripheral) ? ', under the chief' : hasBordure(peripheral) ? ', within the bordure' : '';
}

function whereWords(ctx: LayoutContext, layout: Layout): string {
  if (layout.position) return `in ${layout.position}`;
  switch (ctx.k) {
    case 'field': return ctx.peripheral === 'chief-bordure' ? 'within the bordure, under the chief' : hasChief(ctx.peripheral) ? 'under the chief' : hasBordure(ctx.peripheral) ? 'within the bordure' : 'on the field';
    case 'between': return `around the ${ORDINARY_NAME[ctx.ordinary]}${peripheralWords(ctx.peripheral)}`;
    case 'position': return `in ${ctx.position}`;
    case 'around': return `around the ${ctx.primary.count === 1 ? 'charge' : 'charges'} in the middle${peripheralWords(ctx.peripheral)}`;
    case 'on': return `on the ${ORDINARY_NAME[ctx.ordinary]}${peripheralWords(ctx.peripheral)}`;
  }
}

/** Whether a group's charges fit where they sit at a size that reads; false for a layout the count doesn't have. Groups that sit where this builder has no layout have nothing to fit, so they do. */
export function hasRoom(d: Design, path: GroupPath): boolean {
  const l = layoutOf(d, path);
  if (!l) return true;
  const slots = contextSlots(l.ctx, l.count, l.layout, CANONICAL_SHAPE);
  return slots.length === l.count && slots[0].size >= minSlotSize(l.ctx);
}

/** Why a group's charges don't fit where they sit (the most that would, and where), or null when they do (or when they sit nowhere this builder lays out). Only meaningful once the layout itself is legal. */
export function capacityIssue(d: Design, path: GroupPath): { most: number; where: string; message: string } | null {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (contextOf(d, group, host) === null) return null;
  const l = layoutOf(d, path);
  if (!l || hasRoom(d, path)) return null;
  // A count with no layout around the primary charges is a gap (support.ts), not a want of room.
  if (l.ctx.k === 'around' && !AROUND_COUNTS.includes(l.count)) return null;
  const { id } = l;
  const layoutFor = (n: number): Layout => {
    const a = group.arrangement;
    if (n === group.count) return l.layout;
    if (l.ctx.k === 'position') return positionLayout(l.ctx.position, n);
    if (l.ctx.k !== 'field') return HOST_LAYOUT;
    if (n === 1) return { arrangement: { k: 'single' }, position: group.position };
    if (a.k === 'line' || a.k === 'single') return { arrangement: { k: 'line', dir: a.k === 'line' ? a.dir : 'fess' }, position: group.position };
    return defaultLayoutOf(d, group, host, n);
  };
  // Around the primary charges only some counts have a layout: the most is the largest of those that fits.
  const most = l.ctx.k === 'around' ? largestAroundCount(l.ctx) : largestFittingCount(l.ctx, layoutFor);
  const where = whereWords(l.ctx, l.layout);
  // Around the primary charges as many may fit in another layout of their count.
  const message = most === 0
    ? `${capitalise(CHARGES[id].plural)} can't be set ${where} like this.`
    : most >= l.count ? `There isn't room for ${chargePhrase(id, l.count)} ${layoutWords(l.layout)} ${where} — choose another layout.`
    : `There isn't room for ${chargePhrase(id, l.count)} ${where} — at most ${most} fit.`;
  return { most, where, message };
}
