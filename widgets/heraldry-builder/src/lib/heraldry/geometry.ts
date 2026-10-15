// Shield geometry: the outline of every field shape in one shared viewBox (0 0 100 120), partition-line
// regions, ordinary shapes, slot transforms and the probes the rule of tincture relies on. All paths are
// SVG path strings; renderers clip everything to the shape's outline. Where charges go is layout.ts.
//
// The heater shield is the canonical layout: the rule of tincture is judged on it alone, so a design
// gets the same verdict in every shape. The other shapes reuse the heater's construction (lines
// through the fess point, bands of the same width) around their own fess point and outline.

import { CHARGES, type ChargeId } from './charges';
import { DRAWN_DIVISIONS, type Division } from './divisions';
import { asSemy, asTreated, asVariation, notSupported, type Paint, type VariationPaint } from './design';
import { inFirstRegion, variationRegions, type Box } from './variation-geometry';
import type { OrdinaryType } from './ordinaries';
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

const r2 = (n: number) => Math.round(n * 100) / 100;
const pts = (p: Array<[number, number]>) => `M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;

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
const CURVE_STEPS = 16;

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
function pointInPath(rings: readonly Pt[][], x: number, y: number): boolean {
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

const isFieldPaint = (p: Paint): p is FieldPaint => p.k === 'tincture' || p.k === 'fur' || asTreated(p) !== null || asSemy(p) !== null;

/** The field as geometry draws it: plain, one of the drawn divisions of two parts, or a variation of two tinctures. */
type DrawnField =
  | { k: 'plain'; paint: FieldPaint }
  | { k: 'divided'; division: Division; paints: [FieldPaint, FieldPaint] }
  | { k: 'varied'; variation: VariationPaint; paints: [FieldPaint, FieldPaint] };


function drawnField(field: Paint): DrawnField {
  if (isFieldPaint(field)) return { k: 'plain', paint: field };
  if (field.k === 'divided' && DRAWN_DIVISIONS.includes(field.division) && field.parts.length === 2) {
    const [a, b] = field.parts;
    if (isFieldPaint(a) && isFieldPaint(b)) return { k: 'divided', division: field.division, paints: [a, b] };
  }
  const variation = asVariation(field);
  if (variation) return { k: 'varied', variation, paints: variation.parts };
  return notSupported({ category: 'field-treatment', detail: field.k });
}


/** The surface of the field at (x,y) in the canonical layout; points exactly on a line count as the second part. A variation is one surface everywhere (SENA A3B1). */
export function fieldSurfaceAt(field: Paint, x: number, y: number): Surface {
  const f = drawnField(field);
  switch (f.k) {
    case 'plain': return surfaceOf(f.paint, null);
    case 'varied': return surfaceOf(field, null);
    case 'divided': return surfaceOf(inFirstPart(f.division, SHAPE_FRAME[CANONICAL_SHAPE].fessPoint, x, y) ? f.paints[0] : f.paints[1], null);
    default: return f satisfies never;
  }
}


/** How far the chevron's apex (and the per-chevron line's) sits above the fess point. */
const CHEVRON_APEX_RISE = 10;

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
const OVER = { x0: -40, x1: 140, y0: -40, y1: 160 };

/** Region paths [first part, second part] for lines meeting at `fess` (turned `turn` degrees clockwise about it), covering the whole frame. */
export function partitionRegions(division: Division, fess: Point, turn = 0): [string, string] {
  const { x: cx, y: cy } = fess;
  const poly = (p: Array<[number, number]>) => pts(turn === 0 ? p : p.map(([x, y]) => turned({ x: cx, y: cy, size: 0, rotation: turn }, x, y)));
  const { x0, x1, y0, y1 } = OVER;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE;
  const limb = apexY + (x1 - cx);
  const k = 100;
  switch (division) {
    case 'per-pale': return [poly([[x0, y0], [cx, y0], [cx, y1], [x0, y1]]), poly([[cx, y0], [x1, y0], [x1, y1], [cx, y1]])];
    case 'per-fess': return [poly([[x0, y0], [x1, y0], [x1, cy], [x0, cy]]), poly([[x0, cy], [x1, cy], [x1, y1], [x0, y1]])];
    case 'per-bend': return [
      poly([[x0, y0], [x1, y0], [x1, bend(x1)], [x0, bend(x0)]]),
      poly([[x0, bend(x0)], [x1, bend(x1)], [x1, y1], [x0, y1]]),
    ];
    case 'per-bend-sinister': return [
      poly([[x0, y0], [x1, y0], [x1, sinister(x1)], [x0, sinister(x0)]]),
      poly([[x0, sinister(x0)], [x1, sinister(x1)], [x1, y1], [x0, y1]]),
    ];
    case 'per-saltire': return [
      poly([[cx - k, cy - k], [cx + k, cy - k], [cx, cy]]) + poly([[cx, cy], [cx + k, cy + k], [cx - k, cy + k]]),
      poly([[cx - k, cy - k], [cx, cy], [cx - k, cy + k]]) + poly([[cx + k, cy - k], [cx + k, cy + k], [cx, cy]]),
    ];
    case 'per-chevron': return [
      poly([[x0, y0], [x1, y0], [x1, limb], [cx, apexY], [x0, limb]]),
      poly([[x0, limb], [cx, apexY], [x1, limb], [x1, y1], [x0, y1]]),
    ];
    case 'quarterly': return [
      poly([[x0, y0], [cx, y0], [cx, cy], [x0, cy]]) + poly([[cx, cy], [x1, cy], [x1, y1], [cx, y1]]),
      poly([[cx, y0], [x1, y0], [x1, cy], [cx, cy]]) + poly([[x0, cy], [cx, cy], [cx, y1], [x0, y1]]),
    ];
    default: return notSupported({ category: 'division', detail: division });
  }
}

/** The region paths [first part, second part] of a divided or varied field in a shape. */
function regionsOf(f: Exclude<DrawnField, { k: 'plain' }>, frame: ShapeFrame): [string, string] {
  return f.k === 'divided' ? partitionRegions(f.division, frame.fessPoint) : variationRegions(f.variation.variation, f.variation.pieces, frame.box);
}


/** Whether (x,y) lies in the first part of a divided or varied field in a shape. */
function inFirstOf(f: Exclude<DrawnField, { k: 'plain' }>, frame: ShapeFrame, x: number, y: number): boolean {
  return f.k === 'divided' ? inFirstPart(f.division, frame.fessPoint, x, y) : inFirstRegion(f.variation.variation, f.variation.pieces, frame.box, x, y);
}


/** Field as paint-filled regions, in paint order. */
export function fieldRegions(field: Paint, shape: FieldShape): Array<{ paint: FieldPaint; d: string }> {
  const f = drawnField(field);
  const frame = SHAPE_FRAME[shape];
  if (f.k === 'plain') return [{ paint: f.paint, d: frame.outline }];
  const [a, b] = regionsOf(f, frame);
  return [{ paint: f.paints[0], d: a }, { paint: f.paints[1], d: b }];
}

// ── Ordinaries ──────────────────────────────────────────────────────────────

const BAND_HALF = 15;                   // fess and pale: 30 wide
const BEND_HALF = 15 * Math.SQRT2;      // 30-wide band, measured perpendicular to a 45° line
/** How tall the chief is: its lower edge is `chiefBase`. */
const CHIEF_HEIGHT = 30;
const CROSS_HALF = 12;                  // 24-wide arms
const SALTIRE_HALF = 12 * Math.SQRT2;   // 24-wide arms
const CHEVRON_THICK = 22 * Math.SQRT2;  // 22-wide band, measured perpendicular to its limbs

function ordinaryPathIn(type: OrdinaryType, f: ShapeFrame): string {
  const { x: cx, y: cy } = f.fessPoint;
  const { x0, x1, y0, y1 } = OVER;
  const d = BEND_HALF, sd = SALTIRE_HALF, c = CROSS_HALF;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE;
  const reach = 80; // limbs and saltire arms run this far (horizontally) from their centre
  switch (type) {
    case 'fess': return pts([[x0, cy - BAND_HALF], [x1, cy - BAND_HALF], [x1, cy + BAND_HALF], [x0, cy + BAND_HALF]]);
    case 'pale': return pts([[cx - BAND_HALF, y0], [cx + BAND_HALF, y0], [cx + BAND_HALF, y1], [cx - BAND_HALF, y1]]);
    case 'bend': return pts([[cx - reach, bend(cx - reach) - d], [cx + reach, bend(cx + reach) - d], [cx + reach, bend(cx + reach) + d], [cx - reach, bend(cx - reach) + d]]);
    case 'bend-sinister': return pts([[cx - reach, sinister(cx - reach) - d], [cx + reach, sinister(cx + reach) - d], [cx + reach, sinister(cx + reach) + d], [cx - reach, sinister(cx - reach) + d]]);
    case 'chevron': return pts([
      [cx - reach, apexY + reach], [cx, apexY], [cx + reach, apexY + reach],
      [cx + reach, apexY + reach + CHEVRON_THICK], [cx, apexY + CHEVRON_THICK], [cx - reach, apexY + reach + CHEVRON_THICK],
    ]);
    case 'cross': return pts([
      [cx - c, y0], [cx + c, y0], [cx + c, cy - c], [x1, cy - c], [x1, cy + c], [cx + c, cy + c],
      [cx + c, y1], [cx - c, y1], [cx - c, cy + c], [x0, cy + c], [x0, cy - c], [cx - c, cy - c],
    ]);
    case 'saltire': return pts([
      [cx, cy - sd], [cx + reach, cy - reach - sd], [cx + reach, cy - reach + sd], [cx + sd, cy], [cx + reach, cy + reach - sd], [cx + reach, cy + reach + sd],
      [cx, cy + sd], [cx - reach, cy + reach + sd], [cx - reach, cy + reach - sd], [cx - sd, cy], [cx - reach, cy - reach + sd], [cx - reach, cy - reach - sd],
    ]);
    case 'chief': return pts([[x0, y0], [x1, y0], [x1, f.chiefBase], [x0, f.chiefBase]]);
    case 'bordure': return f.outline + f.inset;
    case 'pile': return pts(f.pile);
    default: return notSupported({ category: 'ordinary', detail: type });
  }
}

const ordinaryCache = new Map<string, string>();

/** The path of an ordinary in a shape. */
export function ordinaryPath(type: OrdinaryType, shape: FieldShape): string {
  const key = `${shape}:${type}`;
  let d = ordinaryCache.get(key);
  if (d === undefined) {
    d = ordinaryPathIn(type, SHAPE_FRAME[shape]);
    ordinaryCache.set(key, d);
  }
  return d;
}

/** The bordure is a ring (outline minus inset) and needs evenodd; everything else is nonzero. */
export function ordinaryFillRule(type: OrdinaryType): 'nonzero' | 'evenodd' {
  return type === 'bordure' ? 'evenodd' : 'nonzero';
}

const samplePointCache = new Map<OrdinaryType, Pt[]>();

/** Grid step of the points an ordinary is sampled at (offset by one so none sits on a partition line). */
const SAMPLE_STEP = 4;

/** A step-4 grid of the heater points inside the ordinary and the shield: what the ordinary lies on. */
export function ordinarySamplePoints(type: OrdinaryType): Pt[] {
  let points = samplePointCache.get(type);
  if (!points) {
    const outline = pathRings(SHIELD_PATH), ring = pathRings(ordinaryPath(type, CANONICAL_SHAPE));
    points = [];
    for (let x = 1; x < 100; x += SAMPLE_STEP) {
      for (let y = 1; y < 120; y += SAMPLE_STEP) {
        if (pointInPath(outline, x, y) && pointInPath(ring, x, y)) points.push([x, y]);
      }
    }
    samplePointCache.set(type, points);
  }
  return points;
}

/** The box an ordinary's own pattern (barry, checky …) is laid out over: its bounding box within the shape's. */
export function ordinaryBox(type: OrdinaryType, shape: FieldShape): Box {
  const frame = SHAPE_FRAME[shape].box;
  const points = pathRings(ordinaryPath(type, shape)).flat();
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return { x0: Math.max(frame.x0, Math.min(...xs)), y0: Math.max(frame.y0, Math.min(...ys)), x1: Math.min(frame.x1, Math.max(...xs)), y1: Math.min(frame.y1, Math.max(...ys)) };
}

/** Whether (x,y) lies in the first part of a division through `centre`, turned `turn` degrees clockwise about it. */
export function inFirstPartTurned(division: Division, centre: Point, turn: number, x: number, y: number): boolean {
  const [px, py] = turned({ ...centre, size: 0, rotation: -turn }, x, y);
  return inFirstPart(division, centre, px, py);
}

/** Where a division of an ordinary runs through it: the middle of a chief's band, the fess point for every other ordinary. */
export function ordinaryCentre(type: OrdinaryType, shape: FieldShape): Point {
  const { fessPoint, chiefBase } = SHAPE_FRAME[shape];
  return type === 'chief' ? { x: fessPoint.x, y: chiefBase - CHIEF_HEIGHT / 2 } : fessPoint;
}

/** Whether a division through the ordinary's centre runs through it, so that both its parts show. */
export function divisionCutsOrdinary(division: Division, type: OrdinaryType): boolean {
  const centre = ordinaryCentre(type, CANONICAL_SHAPE);
  const first = ordinarySamplePoints(type).filter(([x, y]) => inFirstPart(division, centre, x, y)).length;
  return first > 0 && first < ordinarySamplePoints(type).length;
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
export interface CounterchangePart { region: 0 | 1; d: string; paint: FieldPaint }

/** Grid steps across a drawn box when finding the regions it overlaps (corners and edges included). */
const PART_GRID = 8;

/** What a counterchanged element shows of a part of the field: its paint, but not the charges strewn on it (a semy is not counterchanged across a charge or band, RULES CC-6). */
const shownOf = (p: FieldPaint): FieldPaint => asSemy(p)?.ground ?? p;


/** The parts of a counterchanged element that covers these points of a divided or varied field in a shape; [] unless the field is one. */
function partsAt(field: Paint, points: readonly Pt[], shape: FieldShape): CounterchangePart[] {
  const f = drawnField(field);
  if (f.k === 'plain') return [];
  const frame = SHAPE_FRAME[shape];
  const [d1, d2] = regionsOf(f, frame);
  const firsts = new Set(points.map(([x, y]) => inFirstOf(f, frame, x, y)));
  const parts: CounterchangePart[] = [];
  if (firsts.has(true)) parts.push({ region: 0, d: d1, paint: shownOf(f.paints[1]) });
  if (firsts.has(false)) parts.push({ region: 1, d: d2, paint: shownOf(f.paints[0]) });
  return parts;
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
  return partsAt(field, grid, shape);
}

/** The same for a counterchanged ordinary: the regions it overlaps (a chief on a field per fess lies on one only). */
export function counterchangedOrdinaryParts(field: Paint, type: OrdinaryType, shape: FieldShape): CounterchangePart[] {
  const frame = SHAPE_FRAME[shape];
  const outline = pathRings(frame.outline), ring = pathRings(ordinaryPath(type, shape));
  const points: Pt[] = [];
  for (let x = 1; x < 100; x += SAMPLE_STEP) {
    for (let y = 1; y < 120; y += SAMPLE_STEP) if (pointInPath(outline, x, y) && pointInPath(ring, x, y)) points.push([x, y]);
  }
  return partsAt(field, points, shape);
}
