// Shield geometry: the outline of every field shape in one shared viewBox (0 0 100 120), the regions of a
// divided field (built from contours) and which part a point lies in, slot transforms and the probes the rule
// of tincture relies on. All paths are SVG path strings; renderers clip everything to the shape's outline.
// Ordinaries are ordinary-geometry.ts; where charges go is layout.ts.
//
// The heater shield is the canonical layout: the rule of tincture is judged on it alone, so a design
// gets the same verdict in every shape. The other shapes reuse the heater's construction (lines
// through the fess point, bands of the same width) around their own fess point and outline.

import { CHARGES, type ChargeId } from './charges';
import { DRAWN_DIVISIONS, type Division } from './divisions';
import { asSemy, asTreated, asVariation, notSupported, PLAIN_LINES, type Lines, type Paint, type VariationPaint } from './design';
import { inFirstRegion, variationRegions, type Box } from './variation-geometry';
import { contoursPath, type Contour, type ContourEdge } from './contour';
import type { EdgeRun, Line } from './lines';
import { surfaceOf, type Surface } from './surface';
import type { FieldShape } from './shape';

export const SHIELD_VIEWBOX = '0 0 100 120';

export type Pt = [number, number];
export interface Point { x: number; y: number }

/** Heater shield: straight top and sides to y=60, then two curves meeting at the base point. */
export const SHIELD_PATH = 'M0 0H100V60C100 92 76 110 50 120C24 110 0 92 0 60Z';
/** The heater inset by 10 units — the inner edge of its bordure. */
export const SHIELD_INSET_PATH = 'M10 10H90V60C90 86 70 102 50 110C30 102 10 86 10 60Z';

/** The layout every verdict is computed on. */
export const CANONICAL_SHAPE: FieldShape = 'heater';

/** A coordinate rounded to two decimals: every path number is written with it (no exponents). */
export const r2 = (n: number) => Math.round(n * 100) / 100;
/** A closed polygon path through the points. */
export const pts = (p: readonly Pt[]) => `M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;

/** A circle as four cubic arcs (so path parsers that know only M/L/C/Z can read it). */
function circlePath(cx: number, cy: number, r: number): string {
  const k = r2(r * 0.5523);
  return `M${cx} ${cy - r}C${r2(cx + k)} ${cy - r} ${cx + r} ${r2(cy - k)} ${cx + r} ${cy}`
    + `C${cx + r} ${r2(cy + k)} ${r2(cx + k)} ${cy + r} ${cx} ${cy + r}`
    + `C${r2(cx - k)} ${cy + r} ${cx - r} ${r2(cy + k)} ${cx - r} ${cy}`
    + `C${cx - r} ${r2(cy - k)} ${r2(cx - k)} ${cy - r} ${cx} ${cy - r}Z`;
}

/** A lozenge with the given centre and half-diagonals, shrunk so each side moves `inset` inwards. */
function lozengePath(cx: number, cy: number, hx: number, hy: number, inset: number): string {
  const k = 1 - (inset * Math.hypot(hx, hy)) / (hx * hy);
  return pts([[cx, cy - hy * k], [cx + hx * k, cy], [cx, cy + hy * k], [cx - hx * k, cy]]);
}

// ── Paths as polygons ───────────────────────────────────────────────────────

const pathCache = new Map<string, Pt[][]>();

/** Steps a cubic is flattened into. */
export const CURVE_STEPS = 16;

/** Every subpath of a path made of M, L, H, V, C and Z, flattened into polygons (memoised). */
export function pathRings(d: string): Pt[][] {
  const cached = pathCache.get(d);
  if (cached) return cached;
  const tok = d.match(/[MLHVCZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const rings: Pt[][] = [];
  let ring: Pt[] = [];
  let i = 0, cmd = '', x = 0, y = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[A-Z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z') { if (ring.length) rings.push(ring); ring = []; continue; }
    if (cmd === 'M') { if (ring.length) rings.push(ring); ring = []; x = num(); y = num(); ring.push([x, y]); cmd = 'L'; }
    else if (cmd === 'L') { x = num(); y = num(); ring.push([x, y]); }
    else if (cmd === 'H') { x = num(); ring.push([x, y]); }
    else if (cmd === 'V') { y = num(); ring.push([x, y]); }
    else if (cmd === 'C') {
      const p0: Pt = [x, y], p1: Pt = [num(), num()], p2: Pt = [num(), num()], p3: Pt = [num(), num()];
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS, u = 1 - t;
        ring.push([
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ]);
      }
      [x, y] = p3;
    }
  }
  if (ring.length) rings.push(ring);
  pathCache.set(d, rings);
  return rings;
}

/** The first subpath of a path as a polygon: the whole of a path with one subpath. */
export function pathPolygon(d: string): Pt[] {
  return pathRings(d)[0];
}

export function pointInPolygon(x: number, y: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Even-odd containment across all subpaths: right for rings (the bordure) and for plain shapes alike. */
export function pointInPath(rings: readonly Pt[][], x: number, y: number): boolean {
  return rings.filter((r) => pointInPolygon(x, y, r)).length % 2 === 1;
}

// ── Field shapes ────────────────────────────────────────────────────────────

/** The proportions a shape's layout is built from. */
export interface ShapeFrame {
  outline: string;
  /** The bounding box of the outline: what a field variation is laid out over. */
  box: Box;
  /** Inner edge of the bordure: the outline moved inwards (the lozenge's bordure is a little narrower). */
  inset: string;
  /** Where the partition lines and the arms of a cross or saltire meet. */
  fessPoint: Point;
  /** Lower edge of the chief. */
  chiefBase: number;
  /** The pile: two corners on the top edge and its point. */
  pile: [[number, number], [number, number], [number, number]];
}

const SHAPE_FRAME: Record<FieldShape, ShapeFrame> = {
  heater: {
    outline: SHIELD_PATH, box: { x0: 0, y0: 0, x1: 100, y1: 120 }, inset: SHIELD_INSET_PATH, fessPoint: { x: 50, y: 50 }, chiefBase: 30,
    pile: [[20, 0], [80, 0], [50, 95]],
  },
  banner: {
    outline: 'M0 10H100V110H0Z', box: { x0: 0, y0: 10, x1: 100, y1: 110 }, inset: 'M10 20H90V100H10Z', fessPoint: { x: 50, y: 60 }, chiefBase: 40,
    pile: [[20, 10], [80, 10], [50, 105]],
  },
  round: {
    outline: circlePath(50, 60, 50), box: { x0: 0, y0: 10, x1: 100, y1: 110 }, inset: circlePath(50, 60, 40), fessPoint: { x: 50, y: 60 }, chiefBase: 40,
    pile: [[20, 10], [80, 10], [50, 105]],
  },
  lozenge: {
    outline: lozengePath(50, 60, 50, 60, 0), box: { x0: 0, y0: 0, x1: 100, y1: 120 }, inset: lozengePath(50, 60, 50, 60, 8), fessPoint: { x: 50, y: 60 }, chiefBase: 46,
    pile: [[16, 0], [84, 0], [50, 110]],
  },
};

export function shapeFrame(shape: FieldShape): ShapeFrame {
  return SHAPE_FRAME[shape];
}

// ── Field partitions ────────────────────────────────────────────────────────

/** A paint that is one thing over the part of the field it fills: a tincture, a fur, a treated tincture or a strewn one. */
export type FieldPaint = Extract<Paint, { k: 'tincture' | 'fur' | 'treated' | 'semy' }>;

export const isFieldPaint = (p: Paint): p is FieldPaint => p.k === 'tincture' || p.k === 'fur' || asTreated(p) !== null || asSemy(p) !== null;

/** The field as geometry draws it: plain, one of the drawn divisions (a paint per part), or a variation of two tinctures. */
export type DrawnField =
  | { k: 'plain'; paint: FieldPaint }
  | { k: 'divided'; division: Division; lines: Lines; paints: readonly FieldPaint[] }
  | { k: 'varied'; paint: VariationPaint };
export type DividedField = Extract<DrawnField, { k: 'divided' }>;
export type VariedField = Extract<DrawnField, { k: 'varied' }>;

function drawnField(field: Paint): DrawnField {
  if (isFieldPaint(field)) return { k: 'plain', paint: field };
  if (field.k === 'divided' && DRAWN_DIVISIONS.includes(field.division) && field.parts.length === 2) {
    const [a, b] = field.parts;
    if (isFieldPaint(a) && isFieldPaint(b)) return { k: 'divided', division: field.division, lines: field.lines, paints: [a, b] };
  }
  const variation = asVariation(field);
  if (variation) return { k: 'varied', paint: variation };
  return notSupported({ category: 'field-treatment', detail: field.k });
}

/** The paint of each part of a divided or varied field, in part order. */
const partPaints = (f: DividedField | VariedField): readonly FieldPaint[] => (f.k === 'divided' ? f.paints : f.paint.parts);

/** The surface of the field at (x,y) in the canonical layout; points exactly on a line count as the later part. A variation is one surface everywhere (SENA A3B1). */
export function fieldSurfaceAt(field: Paint, x: number, y: number): Surface {
  const f = drawnField(field);
  switch (f.k) {
    case 'plain': return surfaceOf(f.paint, null);
    case 'varied': return surfaceOf(field, null);
    case 'divided': return surfaceOf(f.paints[partIndexAt(f, CANONICAL_SHAPE, x, y)], null);
    default: return f satisfies never;
  }
}

/** How far the chevron's apex (and the per-chevron line's) sits above the fess point. */
export const CHEVRON_APEX_RISE = 10;

/** Whether (x,y) lies in the first part of a division whose lines meet at `fess`. */
export function inFirstPart(division: Division, fess: Point, x: number, y: number): boolean {
  const dx = x - fess.x, dy = y - fess.y;
  switch (division) {
    case 'per-pale': return dx < 0;
    case 'per-fess': return dy < 0;
    case 'per-bend': return dy < dx;
    case 'per-bend-sinister': return dy < -dx;
    case 'per-saltire': return (dy < dx && dy < -dx) || (dy > dx && dy > -dx);
    case 'quarterly': return dx < 0 === dy < 0;
    case 'per-chevron': return dy < Math.abs(dx) - CHEVRON_APEX_RISE;
    default: return notSupported({ category: 'division', detail: division });
  }
}

/** Partition regions and ordinaries run this far past the frame; the outline clips them. */
export const OVER = { x0: -40, x1: 140, y0: -40, y1: 160 };

/** A corner of a region, and the partition line the edge from it to the next corner runs along (null: the edge of the frame). */
type Corner = readonly [Pt, Line | null];

/** How an edge along a partition line is drawn: null for a plain line. Complex lines on the field are drawn from C4a on. */
const lineRun = (line: Line | null): EdgeRun | null =>
  line === null || line === 'plain' ? null : notSupported({ category: 'line-of-partition', detail: line });

/** A closed region through its corners; a line on the closing edge is drawn as an explicit last edge. */
function region(corners: readonly Corner[]): Contour {
  const edges = corners.slice(1).map(([to], i): ContourEdge => ({ via: [], to, run: lineRun(corners[i][1]) }));
  const closing = lineRun(corners[corners.length - 1][1]);
  return { start: corners[0][0], edges: closing ? [...edges, { via: [], to: corners[0][0], run: closing }] : edges };
}

/** The contours of each part of a division whose lines meet at `fess`, turned `turn` degrees clockwise about it, covering the whole frame. */
function partitionAt(division: Division, lines: Lines, fess: Point, turn: number): Contour[][] {
  const { x: cx, y: cy } = fess;
  const at = ([x, y]: Pt): Pt => (turn === 0 ? [x, y] : turned({ x: cx, y: cy, size: 0, rotation: turn }, x, y));
  const part = (...regions: Array<Array<[Pt, Line | null]>>): Contour[] => regions.map((r) => region(r.map(([p, l]): Corner => [at(p), l])));
  const { x0, x1, y0, y1 } = OVER;
  const { a, b } = lines;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE;
  const limb = apexY + (x1 - cx);
  const k = 100;
  switch (division) {
    case 'per-pale': return [
      part([[[x0, y0], null], [[cx, y0], a], [[cx, y1], null], [[x0, y1], null]]),
      part([[[cx, y0], null], [[x1, y0], null], [[x1, y1], null], [[cx, y1], a]]),
    ];
    case 'per-fess': return [
      part([[[x0, y0], null], [[x1, y0], null], [[x1, cy], a], [[x0, cy], null]]),
      part([[[x0, cy], a], [[x1, cy], null], [[x1, y1], null], [[x0, y1], null]]),
    ];
    case 'per-bend': return [
      part([[[x0, y0], null], [[x1, y0], null], [[x1, bend(x1)], a], [[x0, bend(x0)], null]]),
      part([[[x0, bend(x0)], a], [[x1, bend(x1)], null], [[x1, y1], null], [[x0, y1], null]]),
    ];
    case 'per-bend-sinister': return [
      part([[[x0, y0], null], [[x1, y0], null], [[x1, sinister(x1)], a], [[x0, sinister(x0)], null]]),
      part([[[x0, sinister(x0)], a], [[x1, sinister(x1)], null], [[x1, y1], null], [[x0, y1], null]]),
    ];
    case 'per-saltire': return [
      part([[[cx - k, cy - k], null], [[cx + k, cy - k], a], [[cx, cy], a]], [[[cx, cy], a], [[cx + k, cy + k], null], [[cx - k, cy + k], a]]),
      part([[[cx - k, cy - k], a], [[cx, cy], a], [[cx - k, cy + k], null]], [[[cx + k, cy - k], null], [[cx + k, cy + k], a], [[cx, cy], a]]),
    ];
    case 'per-chevron': return [
      part([[[x0, y0], null], [[x1, y0], null], [[x1, limb], a], [[cx, apexY], a], [[x0, limb], null]]),
      part([[[x0, limb], a], [[cx, apexY], a], [[x1, limb], null], [[x1, y1], null], [[x0, y1], null]]),
    ];
    // the per pale line is `a`, the per fess line `b`
    case 'quarterly': return [
      part([[[x0, y0], null], [[cx, y0], a], [[cx, cy], b], [[x0, cy], null]], [[[cx, cy], b], [[x1, cy], null], [[x1, y1], null], [[cx, y1], a]]),
      part([[[cx, y0], null], [[x1, y0], null], [[x1, cy], b], [[cx, cy], a]], [[[x0, cy], b], [[cx, cy], a], [[cx, y1], null], [[x0, y1], null]]),
    ];
    default: return notSupported({ category: 'division', detail: division });
  }
}

/** Every part of a divided field as its contours (per saltire and quarterly: two for a part), in part order, around the shape's fess point. */
export function partitionContours(division: Division, lines: Lines, frame: ShapeFrame): readonly (readonly Contour[])[] {
  return partitionAt(division, lines, frame.fessPoint, 0);
}

/** Region paths [first part, second part] for straight lines meeting at `fess` (turned `turn` degrees clockwise about it), covering the whole frame: a party charge's or band's. */
export function partitionRegions(division: Division, fess: Point, turn = 0): [string, string] {
  const [first, second] = partitionAt(division, PLAIN_LINES, fess, turn).map(contoursPath);
  return [first, second];
}

const divisionCache = new Map<string, readonly string[]>();

/** The region paths of a divided field in a shape, one per part in part order. */
export function divisionRegions(division: Division, lines: Lines, shape: FieldShape): readonly string[] {
  const key = `${division}|${lines.a}|${lines.b}|${shape}`;
  let regions = divisionCache.get(key);
  if (!regions) {
    regions = partitionContours(division, lines, SHAPE_FRAME[shape]).map(contoursPath);
    divisionCache.set(key, regions);
  }
  return regions;
}

/** The region paths of a divided or varied field in a shape, in part order. */
function regionsOf(f: DividedField | VariedField, shape: FieldShape): readonly string[] {
  if (f.k === 'divided') return divisionRegions(f.division, f.lines, shape);
  const v = f.paint;
  if (v.lines.a !== 'plain') return notSupported({ category: 'line-of-partition', detail: v.lines.a });
  return variationRegions(v.variation, v.pieces, SHAPE_FRAME[shape].box);
}

const plainLines = (l: Lines): boolean => l.a === 'plain' && l.b === 'plain';

/**
 * The part (0-based) of a divided or varied field a point lies in, in a shape: the analytic test for plain lines (points exactly on a
 * line count as the later part), else the first region whose drawn outline holds it.
 */
export function partIndexAt(f: DividedField | VariedField, shape: FieldShape, x: number, y: number): number {
  const frame = SHAPE_FRAME[shape];
  if (f.k === 'divided' && plainLines(f.lines)) return inFirstPart(f.division, frame.fessPoint, x, y) ? 0 : 1;
  if (f.k === 'varied' && plainLines(f.paint.lines)) return inFirstRegion(f.paint.variation, f.paint.pieces, frame.box, x, y) ? 0 : 1;
  const index = regionsOf(f, shape).findIndex((d) => pointInPath(pathRings(d), x, y));
  return index < 0 ? partPaints(f).length - 1 : index;
}

/** Field as paint-filled regions, in paint order. */
export function fieldRegions(field: Paint, shape: FieldShape): Array<{ paint: FieldPaint; d: string }> {
  const f = drawnField(field);
  if (f.k === 'plain') return [{ paint: f.paint, d: SHAPE_FRAME[shape].outline }];
  const regions = regionsOf(f, shape);
  return partPaints(f).map((paint, i) => ({ paint, d: regions[i] }));
}

/** Whether (x,y) lies in the first part of a division through `centre`, turned `turn` degrees clockwise about it. */
export function inFirstPartTurned(division: Division, centre: Point, turn: number, x: number, y: number): boolean {
  const [px, py] = turned({ ...centre, size: 0, rotation: -turn }, x, y);
  return inFirstPart(division, centre, px, py);
}

// ── Charge slots ────────────────────────────────────────────────────────────

/** Slot centre and box size in shield units, and how far the charge is turned (degrees clockwise, 0 = upright). */
export interface Slot { x: number; y: number; size: number; rotation: number }

/** The box a charge's art is drawn in: the slot scaled by the charge's optical scale about its centre. */
export function drawnBox(slot: Slot, charge: ChargeId): Slot {
  return { x: slot.x, y: slot.y, size: r2(slot.size * CHARGES[charge].scale), rotation: slot.rotation };
}

/** How far from the edge of the picture a fieldless badge is kept, in shield units. */
const BADGE_MARGIN = 8;

/**
 * The SVG transform that centres drawn boxes in the 100×120 picture and scales them to fill it, keeping their proportions:
 * a fieldless badge has no shield to fill, so its charges are drawn as large as they go. Empty for no boxes.
 */
export function badgeTransform(boxes: readonly Slot[]): string {
  if (boxes.length === 0) return '';
  // Each box is a square turned about its centre, so its reach is half its size times |cos| + |sin|.
  const reach = (s: Slot) => {
    const a = (s.rotation * Math.PI) / 180;
    return (s.size / 2) * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)));
  };
  const x0 = Math.min(...boxes.map((s) => s.x - reach(s))), x1 = Math.max(...boxes.map((s) => s.x + reach(s)));
  const y0 = Math.min(...boxes.map((s) => s.y - reach(s))), y1 = Math.max(...boxes.map((s) => s.y + reach(s)));
  const scale = Math.min((100 - 2 * BADGE_MARGIN) / (x1 - x0), (120 - 2 * BADGE_MARGIN) / (y1 - y0));
  const tx = 50 - scale * ((x0 + x1) / 2), ty = 60 - scale * ((y0 + y1) / 2);
  return `translate(${r2(tx)} ${r2(ty)}) scale(${r2(scale)})`;
}

/** The SVG transform that places the 100×100 art in a slot. */
export function slotTransform(s: Slot): string {
  const place = `translate(${s.x - s.size / 2} ${s.y - s.size / 2}) scale(${s.size / 100})`;
  return s.rotation === 0 ? place : `rotate(${s.rotation} ${s.x} ${s.y}) ${place}`;
}

/** Rotate a point about a slot's centre by the slot's rotation. */
function turned(s: Slot, x: number, y: number): Pt {
  if (s.rotation === 0) return [x, y];
  const a = (s.rotation * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const dx = x - s.x, dy = y - s.y;
  return [r2(s.x + dx * cos - dy * sin), r2(s.y + dx * sin + dy * cos)];
}

/** The five probe points of a slot: centre and ±0.3·size horizontally/vertically, turned with the charge. */
export function probePoints(slot: Slot): Pt[] {
  const p = 0.3 * slot.size;
  return ([[slot.x, slot.y], [slot.x - p, slot.y], [slot.x + p, slot.y], [slot.x, slot.y - p], [slot.x, slot.y + p]] as Pt[])
    .map(([x, y]) => turned(slot, x, y));
}

/** How far from its centre a slot's ground is sampled, in slot sizes: the reach of its probe points. */
const GROUND_REACH = 0.3;
/** How many points a slot's ground is sampled at. */
const GROUND_SAMPLES = 96;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Offsets, in slot sizes, of points spread evenly over the disc a slot's ground is sampled in (a sunflower spiral).
 * A disc needs no turning with the charge, and no point lies on a line through the slot's centre at a multiple of
 * 45°, where partition lines through a charge set on them run, so such a charge comes out about half and half.
 */
const GROUND_OFFSETS: Pt[] = Array.from({ length: GROUND_SAMPLES }, (_, k): Pt => {
  const r = GROUND_REACH * Math.sqrt((k + 0.5) / GROUND_SAMPLES), a = (k + 0.5) * GOLDEN_ANGLE;
  return [r * Math.cos(a), r * Math.sin(a)];
});

/** The points a slot's ground is sampled at, evenly over the middle of the charge: what its area shares are counted on. */
export function groundPoints(slot: Slot): Pt[] {
  return GROUND_OFFSETS.map(([dx, dy]) => [slot.x + dx * slot.size, slot.y + dy * slot.size]);
}

/** Rough vertical/horizontal position words for a slot, used in messages ("upper", "left"). */
export function slotRow(slot: Slot): 'upper' | 'middle' | 'lower' {
  return slot.y < 42 ? 'upper' : slot.y > 66 ? 'lower' : 'middle';
}
export function slotColumn(slot: Slot): 'left' | 'centre' | 'right' {
  return slot.x < 40 ? 'left' : slot.x > 60 ? 'right' : 'centre';
}

// ── Counterchanged elements ─────────────────────────────────────────────────

/** One part of a counterchanged element: a partition region it overlaps, filled with the field's other paint. */
export interface CounterchangePart { region: number; d: string; paint: FieldPaint }

/** Grid steps across a drawn box when finding the regions it overlaps (corners and edges included). */
const PART_GRID = 8;

/** What a counterchanged element shows of a part of the field: its paint, but not the charges strewn on it (a semy is not counterchanged across a charge or band, RULES CC-6). */
const shownOf = (p: FieldPaint): FieldPaint => asSemy(p)?.ground ?? p;

/**
 * The parts of a counterchanged element that covers these points of a divided or varied field in a shape, each filled with the
 * paint of the field's other part; [] unless the field is one.
 */
export function counterchangedParts(field: Paint, points: readonly Pt[], shape: FieldShape): CounterchangePart[] {
  const f = drawnField(field);
  if (f.k === 'plain') return [];
  const regions = regionsOf(f, shape), paints = partPaints(f);
  const found = new Set(points.map(([x, y]) => partIndexAt(f, shape, x, y)));
  return regions.flatMap((d, region) => (found.has(region) ? [{ region, d, paint: shownOf(paints[(region + 1) % paints.length]) }] : []));
}

/**
 * How a counterchanged charge is painted in a shape: the partition regions its (drawn) box overlaps,
 * sampled on a grid that includes the box's corners and edges, each to be filled with the field's other
 * tincture. [] on a plain field.
 */
export function counterchangedSlotParts(field: Paint, box: Slot, shape: FieldShape): CounterchangePart[] {
  const x0 = box.x - box.size / 2, y0 = box.y - box.size / 2, step = box.size / PART_GRID;
  const grid: Pt[] = [];
  for (let i = 0; i <= PART_GRID; i++) {
    for (let j = 0; j <= PART_GRID; j++) grid.push(turned(box, x0 + i * step, y0 + j * step));
  }
  return counterchangedParts(field, grid, shape);
}
