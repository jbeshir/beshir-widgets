// Shield geometry: the outline of every field shape in one shared viewBox (0 0 100 120), the regions of a
// divided field (built from contours) and which part a point lies in, slot transforms and the probes the rule
// of tincture relies on. All paths are SVG path strings; renderers clip everything to the shape's outline.
// Ordinaries are ordinary-geometry.ts; where charges go is layout.ts.
//
// The heater shield is the canonical layout: the rule of tincture is judged on it alone, so a design
// gets the same verdict in every shape. The other shapes reuse the heater's construction (lines
// through the fess point, bands of the same width) around their own fess point and outline.

import { boundedMemo } from './memo';
import { DEFAULT_GYRONNY_PIECES, DRAWN_DIVISIONS, partCount, type Division } from './divisions';
import { asSemy, asTreated, asVariation, notSupported, PLAIN_LINES, type Lines, type Paint, type VariationPaint } from './design';
import { inFirstRegion, variationRegions, type Box } from './variation-geometry';
import { contoursPath, type Contour, type ContourEdge } from './contour';
import { ARRONDI_SAGITTA, LINE_PROFILE, PROFILE_REACH, featureMiddle, fieldSide, fitPeriod, laidSide, profileSides, runAlong, visibleSpan, type ComplexLine, type EdgeRun, type LaidLine, type Line } from './lines';
import { surfaceOf, type Surface } from './surface';
import type { FieldShape } from './shape';

export const SHIELD_VIEWBOX = '0 0 100 120';

export type Pt = [number, number];
export interface Point { x: number; y: number }

/** Heater shield: straight top and sides to y=60, then two curves meeting at the base point. */
export const SHIELD_PATH = 'M0 0H100V60C100 92 76 110 50 120C24 110 0 92 0 60Z';
/** The heater inset by 10 units — the inner edge of its bordure. */
export const SHIELD_INSET_PATH = 'M10 10H90V60C90 86 70 102 50 110C30 102 10 86 10 60Z';
/** The heater inset by 15 units — the inner edge of a bordure that carries charges. */
const SHIELD_CHARGED_INSET_PATH = 'M15 15H85V60C85 83 67 98 50 105C33 98 15 83 15 60Z';

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

const pathMemo = boundedMemo<Pt[][]>(50_000);

/** Steps a cubic is flattened into. */
export const CURVE_STEPS = 16;

/** Every subpath of a path made of M, L, H, V, C and Z, flattened into polygons (memoised). */
export function pathRings(d: string): Pt[][] {
  return pathMemo(d, () => flattenedPath(d));
}

function flattenedPath(d: string): Pt[][] {
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
  /** Inner edge of a bordure that carries charges: half as far in again, so that they read (RULES-C §F.2: about a sixth of the shield). */
  chargedInset: string;
  /** Where the partition lines and the arms of a cross or saltire meet. */
  fessPoint: Point;
  /** Lower edge of the chief. */
  chiefBase: number;
  /** The pile: two corners on the top edge and its point. */
  pile: [[number, number], [number, number], [number, number]];
  /** How steep a per chevron throughout's limbs fall from its apex on the top of the box: 45° (1), steeper than the edges of the lozenge's point. */
  throughoutSlope: number;
}

const SHAPE_FRAME: Record<FieldShape, ShapeFrame> = {
  heater: {
    outline: SHIELD_PATH, box: { x0: 0, y0: 0, x1: 100, y1: 120 }, inset: SHIELD_INSET_PATH, chargedInset: SHIELD_CHARGED_INSET_PATH, fessPoint: { x: 50, y: 50 }, chiefBase: 30,
    pile: [[20, 0], [80, 0], [50, 95]], throughoutSlope: 1,
  },
  banner: {
    outline: 'M0 10H100V110H0Z', box: { x0: 0, y0: 10, x1: 100, y1: 110 }, inset: 'M10 20H90V100H10Z', chargedInset: 'M15 25H85V95H15Z', fessPoint: { x: 50, y: 60 }, chiefBase: 40,
    pile: [[20, 10], [80, 10], [50, 105]], throughoutSlope: 1,
  },
  round: {
    outline: circlePath(50, 60, 50), box: { x0: 0, y0: 10, x1: 100, y1: 110 }, inset: circlePath(50, 60, 40), chargedInset: circlePath(50, 60, 35), fessPoint: { x: 50, y: 60 }, chiefBase: 40,
    pile: [[20, 10], [80, 10], [50, 105]], throughoutSlope: 1,
  },
  lozenge: {
    outline: lozengePath(50, 60, 50, 60, 0), box: { x0: 0, y0: 0, x1: 100, y1: 120 }, inset: lozengePath(50, 60, 50, 60, 8), chargedInset: lozengePath(50, 60, 50, 60, 12), fessPoint: { x: 50, y: 60 }, chiefBase: 46,
    pile: [[16, 0], [84, 0], [50, 110]], throughoutSlope: 1.72,
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
type DrawnField =
  | { k: 'plain'; paint: FieldPaint }
  | { k: 'divided'; division: Division; lines: Lines; pieces: number | null; paints: readonly FieldPaint[] }
  | { k: 'varied'; paint: VariationPaint };
export type DividedField = Extract<DrawnField, { k: 'divided' }>;
export type VariedField = Extract<DrawnField, { k: 'varied' }>;

function drawnField(field: Paint): DrawnField {
  if (isFieldPaint(field)) return { k: 'plain', paint: field };
  if (field.k === 'divided' && DRAWN_DIVISIONS.includes(field.division) && field.parts.length === partCount(field.division)) {
    const paints = field.parts.filter(isFieldPaint);
    if (paints.length === field.parts.length) return { k: 'divided', division: field.division, lines: field.lines, pieces: field.pieces, paints };
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
    case 'per-chevron-inverted': return dy < CHEVRON_APEX_RISE - Math.abs(dx);
    default: return notSupported({ category: 'division', detail: division });
  }
}

/** Where a gyronny's first line lies, as the SVG angle runs (clockwise on the page, in degrees): due dexter, so one line is always fesswise (Prec 02/2003). */
const GYRONNY_START = 180;

/** The sector (0-based, clockwise from the dexter fess line) of a gyronny of `pieces` that (x,y) lies in, around its centre. */
function gyronnySector(pieces: number, centre: Point, x: number, y: number): number {
  const turn = ((Math.atan2(y - centre.y, x - centre.x) * 180) / Math.PI - GYRONNY_START + 720) % 360;
  return Math.floor(turn / (360 / pieces));
}

/** How far a per pall's arm (or a per pall inverted's) rises (falls) for each unit it runs out from the centre, on the side of (x): toward the top corner of the box on that side. */
function pallSlope({ fessPoint: { x: cx, y: cy }, box }: ShapeFrame, x: number): number {
  return (cy - box.y0) / (x < cx ? cx - box.x0 : box.x1 - cx);
}

/** The two lines of a tierced division: a middle third of the box's width (or height) centred on the fess point. */
function tiercedLines(division: 'tierced-per-pale' | 'tierced-per-fess', centre: Point, box: Box): [number, number] {
  const third = division === 'tierced-per-pale' ? (box.x1 - box.x0) / 3 : (box.y1 - box.y0) / 3;
  const middle = division === 'tierced-per-pale' ? centre.x : centre.y;
  return [middle - third / 2, middle + third / 2];
}

/**
 * The part (0-based) a point lies in of a divided field with plain lines in a shape: `inFirstPart`, and the divisions that need the
 * shape's proportions or a piece count, or have three parts. Points exactly on a line count as the later part.
 */
function partIndexIn(f: DividedField, frame: ShapeFrame, x: number, y: number): number {
  const { x: cx, y: cy } = frame.fessPoint;
  switch (f.division) {
    case 'per-chevron-throughout': return y < frame.box.y0 + frame.throughoutSlope * Math.abs(x - cx) ? 0 : 1;
    case 'gyronny': return gyronnySector(f.pieces ?? DEFAULT_GYRONNY_PIECES, frame.fessPoint, x, y) % 2;
    // the chief part between the arms, then dexter and sinister of the line down the middle
    case 'per-pall': return y < cy - pallSlope(frame, x) * Math.abs(x - cx) ? 0 : x < cx ? 1 : 2;
    // dexter and sinister of the line up the middle, then the base part between the arms
    case 'per-pall-inverted': return y >= cy + pallSlope(frame, x) * Math.abs(x - cx) ? 2 : x < cx ? 0 : 1;
    case 'tierced-per-pale': case 'tierced-per-fess': {
      const [first, second] = tiercedLines(f.division, frame.fessPoint, frame.box);
      const at = f.division === 'tierced-per-pale' ? x : y;
      return at < first ? 0 : at < second ? 1 : 2;
    }
    case 'per-pale': case 'per-fess': case 'per-bend': case 'per-bend-sinister': case 'per-saltire': case 'quarterly': case 'per-chevron': case 'per-chevron-inverted':
      return inFirstPart(f.division, frame.fessPoint, x, y) ? 0 : 1;
    default: return f.division satisfies never;
  }
}

/** Partition regions and ordinaries run this far past the frame; the outline clips them. */
export const OVER = { x0: -40, x1: 140, y0: -40, y1: 160 };

/** A corner of a region, and the partition line the edge from it to the next corner runs along (null: the edge of the frame, or a plain line). */
type Corner = readonly [Pt, LaidLine | null];

/** A closed region through its corners; a line on the closing edge is drawn as an explicit last edge. */
function region(corners: readonly Corner[]): Contour {
  const run = (i: number, to: Pt): EdgeRun | null => {
    const [from, laid] = corners[i];
    return laid && runAlong(laid, from, to);
  };
  const edges = corners.slice(1).map(([to], i): ContourEdge => ({ via: [], to, run: run(i, to) }));
  const closing = run(corners.length - 1, corners[0][0]);
  return { start: corners[0][0], edges: closing ? [...edges, { via: [], to: corners[0][0], run: closing }] : edges };
}

/** Where a laid line's periods start: centred on the chord the shape shows (a line across the field), or clear of the other lines laid out from where they meet at its start (`Junction`). */
type LineStart = 'centred' | Junction;

/**
 * The lines that meet one laid out from where they meet: the angle (radians) to the nearest on its left and on its right as it runs out (in
 * SVG coordinates; null: none within a half-turn), and whether they cross there (`crossing`) or end there (a chevron's limbs at its apex).
 * Its periods start far enough out that its features keep off the middle line of each angle — their reach that way over the tangent of half
 * the angle (per chevron inverted, gyronny of twelve) — and, where lines cross, half a period out at least.
 */
interface Junction { readonly left: number | null; readonly right: number | null; readonly crossing: boolean }

/** How the lines laid out from `from` to `others` meet the one from `from` to `to`. */
function junctionOf(from: Pt, to: Pt, others: readonly Pt[], crossing = true): Junction {
  const heading = ([x, y]: Pt) => Math.atan2(y - from[1], x - from[0]);
  const turns = others.map((o) => {
    const t = heading(o) - heading(to);
    return Math.atan2(Math.sin(t), Math.cos(t));
  });
  // y runs down the page, so a positive turn is clockwise as drawn: to the right
  const nearest = (angles: number[]) => (angles.length === 0 ? null : Math.min(...angles));
  return { left: nearest(turns.filter((t) => t < 0).map((t) => -t)), right: nearest(turns.filter((t) => t > 0)), crossing };
}

/**
 * How far apart the features of two lines meeting at a junction keep at least: a feature that reaches just to the middle line would meet
 * the other's and pinch off a sliver between them. Where a chevron's limbs meet, half a line depth, so that the notch at the apex reads as a
 * feature of its own.
 */
const JUNCTION_GAP = 1.5;

/** How far out from a junction a line's features start so that they keep clear of the lines beside it (`Junction`). */
function junctionClearance(line: ComplexLine, side: 1 | -1, depth: number, { left, right, crossing }: Junction): number {
  const [minus, plus] = profileSides(line);
  // from an apex a profile that swings both ways swings out first, to its + side, and is half a period along before it swings back
  const back = crossing || plus === 0 ? minus : 0;
  // the + side of the profile is the run's `side`: +1 its left
  const toward = (way: 1 | -1, angle: number | null) => {
    const reach = (way === side ? plus : back) * depth;
    // a feature at s along, reaching r across, lies s·sin − r·cos of half the angle from its middle line
    return angle === null || reach === 0 ? 0 : reach / Math.tan(angle / 2) + (crossing ? JUNCTION_GAP : depth / 2) / 2 / Math.sin(angle / 2);
  };
  return Math.max(toward(1, left), toward(-1, right));
}

/** Lays a partition line from `from` to `to`; null for a plain line. */
type Lay = (line: Line, from: Pt, to: Pt, start: LineStart) => LaidLine | null;

/** Lines of the field: fitted to the chord of the shape's outline each one crosses (RULES-C §A.4), features toward chief or dexter (§A.2). */
function layOn(outline: readonly Pt[]): Lay {
  return (line, from, to, start) => {
    if (line === 'plain') return null;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const dir: Pt = [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
    const [c0, c1] = visibleSpan(from, to, outline) ?? [0, length];
    const chord = c1 - c0;
    // every arrondi line curves the same rotational way (to the left as it runs outward from where the lines meet), by a tenth of its length
    const [side, depth] = line === 'arrondi' ? [1 as const, ARRONDI_SAGITTA * chord] : [laidSide(line, dir, fieldSide(dir)), LINE_PROFILE[line].depth];
    const periodic = LINE_PROFILE[line].kind === 'periodic', junction = typeof start === 'object';
    // lines laid out from a junction keep a lead-in straight (half a period, or what keeps their features clear of the lines beside them)
    // plus whatever a period overhangs it by, and the period is fitted to what is left, so a short arm still shows a whole number of
    // periods (at least two) instead of none
    const half = junction && start.crossing ? 0.5 : 0, clear = junction && periodic ? junctionClearance(line, side, depth, start) : 0;
    const overhang = -Math.min(0, PROFILE_REACH[line][0]);
    const straight = (period: number) => Math.max(half * period, clear);
    const lead = (period: number) => (start === 'centred' ? 0 : straight(period) + overhang * period);
    let period = fitPeriod(line, chord, 1);
    // a line across a short chord (the lozenge's diagonals) still shows three periods, the middle one centred
    if (start === 'centred' && periodic) period = Math.min(period, chord / 3);
    if (start !== 'centred' && periodic) {
      const fitted = fitPeriod(line, chord - lead(period), 1);
      const turns = Math.max(2, Math.round((chord - lead(fitted)) / fitted));
      period = chord / (turns + half + overhang);
      if (clear > half * period) period = Math.max(0, chord - clear) / (turns + overhang);
    }
    const anchor = start === 'centred' ? (c0 + c1) / 2 : lead(period) + period / 2;
    // a line with nothing to keep clear of at its start (a chevron's limb whose features turn out of the angle) is drawn from before it
    const span: [number, number] = [half > 0 || clear > 0 ? straight(period) : c0 - period, c1 + period];
    return { origin: from, dir, run: { line, side, depth, period, anchor, span } };
  };
}

/** Straight lines only: the party paints of bands and charges. */
const layPlain: Lay = () => null;

/** How far a line of the field moves toward base or sinister to straddle its nominal line (`featureMiddle`): 0 for plain. */
const straddleShift = (line: Line): number => (line === 'plain' ? 0 : featureMiddle(line) * LINE_PROFILE[line].depth);

/**
 * The point a division's lines meet at, moved so that every one-sided line straddles where it would run plain: an upright line moves
 * sideways, a level one down, and lines at 45° (bends, the chevron's limbs, the saltire) move down by √2 times as much.
 */
function straddlingCentre(division: Division, { a, b }: Lines, { x, y }: Point): Point {
  switch (division) {
    case 'per-pale': return { x: x + straddleShift(a), y };
    case 'per-fess': return { x, y: y + straddleShift(a) };
    case 'per-bend': case 'per-bend-sinister': case 'per-chevron': case 'per-chevron-inverted': case 'per-saltire': return { x, y: y + Math.SQRT2 * straddleShift(a) };
    case 'quarterly': return { x: x + straddleShift(a), y: y + straddleShift(b) };
    // both of a tierced division's lines move with the centre they are laid about
    case 'tierced-per-pale': return { x: x + straddleShift(a), y };
    case 'tierced-per-fess': return { x, y: y + straddleShift(a) };
    // the apex is on the edge of the shape, and the lines of a gyronny or a per pall meet in several directions: none can be moved to straddle
    case 'per-chevron-throughout': case 'gyronny': case 'per-pall': case 'per-pall-inverted': return { x, y };
    default: return division satisfies never;
  }
}

/** What a division is cut by beyond its lines and centre: a gyronny's piece count, the slope of a per chevron throughout, and the box a per chevron throughout's apex, a per pall's arms and the tierced divisions' thirds are measured on. */
interface Cut { pieces: number; box: Box; slope: number }

/** The cut of the party paints of bands and charges, which are never a gyronny, throughout, per pall or tierced. */
const PARTY_CUT: Cut = { pieces: DEFAULT_GYRONNY_PIECES, box: { x0: 0, y0: 0, x1: 100, y1: 120 }, slope: 1 };

/** How far from its centre a gyronny's lines run: past every shape, so a sector reaches the whole frame. */
const GYRONNY_REACH = 300;

/** The contours of each part of a division whose lines meet at `fess`, turned `turn` degrees clockwise about it, covering the whole frame. */
function partitionAt(division: Division, lines: Lines, fess: Point, turn: number, lay: Lay, cut: Cut): Contour[][] {
  const { x: cx, y: cy } = fess;
  const at = ([x, y]: Pt): Pt => (turn === 0 ? [x, y] : turned({ x: cx, y: cy, size: 0, rotation: turn }, x, y));
  const part = (...regions: Array<Array<[Pt, LaidLine | null]>>): Contour[] => regions.map((r) => region(r.map(([p, l]): Corner => [at(p), l])));
  const { x0, x1, y0, y1 } = OVER;
  const { a, b } = lines;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE;
  const k = 100;
  const centre: Pt = [cx, cy];
  switch (division) {
    case 'per-pale': {
      const A = lay(a, [cx, y0], [cx, y1], 'centred');
      return [
        part([[[x0, y0], null], [[cx, y0], A], [[cx, y1], null], [[x0, y1], null]]),
        part([[[cx, y0], null], [[x1, y0], null], [[x1, y1], null], [[cx, y1], A]]),
      ];
    }
    case 'per-fess': {
      const A = lay(a, [x0, cy], [x1, cy], 'centred');
      return [
        part([[[x0, y0], null], [[x1, y0], null], [[x1, cy], A], [[x0, cy], null]]),
        part([[[x0, cy], A], [[x1, cy], null], [[x1, y1], null], [[x0, y1], null]]),
      ];
    }
    case 'per-bend': {
      const A = lay(a, [x0, bend(x0)], [x1, bend(x1)], 'centred');
      return [
        part([[[x0, y0], null], [[x1, y0], null], [[x1, bend(x1)], A], [[x0, bend(x0)], null]]),
        part([[[x0, bend(x0)], A], [[x1, bend(x1)], null], [[x1, y1], null], [[x0, y1], null]]),
      ];
    }
    case 'per-bend-sinister': {
      const A = lay(a, [x0, sinister(x0)], [x1, sinister(x1)], 'centred');
      return [
        part([[[x0, y0], null], [[x1, y0], null], [[x1, sinister(x1)], A], [[x0, sinister(x0)], null]]),
        part([[[x0, sinister(x0)], A], [[x1, sinister(x1)], null], [[x1, y1], null], [[x0, y1], null]]),
      ];
    }
    // four arms laid out from where the lines cross
    case 'per-saltire': {
      const [tl, tr, br, bl]: Pt[] = [[cx - k, cy - k], [cx + k, cy - k], [cx + k, cy + k], [cx - k, cy + k]];
      const [TL, TR, BR, BL] = [tl, tr, br, bl].map((end, i, ends) => lay(a, centre, end, junctionOf(centre, end, ends.filter((_, j) => j !== i))));
      return [
        part([[tl, null], [tr, TR], [centre, TL]], [[centre, BR], [br, null], [bl, BL]]),
        part([[tl, TL], [centre, BL], [bl, null]], [[tr, null], [br, BR], [centre, TR]]),
      ];
    }
    // the two limbs, laid out from the apex, their features clear of the other limb's: below the centre for the inverted one (the upper
    // part first), on the top edge for the one throughout
    case 'per-chevron': case 'per-chevron-inverted': case 'per-chevron-throughout': {
      const throughout = division === 'per-chevron-throughout', fall = division === 'per-chevron-inverted' ? -1 : 1;
      const apex: Pt = [cx, throughout ? cut.box.y0 : fall === 1 ? apexY : cy + CHEVRON_APEX_RISE];
      const end = (x: number): Pt => [x, apex[1] + fall * (throughout ? cut.slope : 1) * Math.abs(x - cx)];
      const D = lay(a, apex, end(x0), junctionOf(apex, end(x0), [end(x1)], false)), S = lay(a, apex, end(x1), junctionOf(apex, end(x1), [end(x0)], false));
      return [
        part([[[x0, y0], null], [[x1, y0], null], [end(x1), S], [apex, D], [end(x0), null]]),
        part([[end(x0), D], [apex, S], [end(x1), null], [[x1, y1], null], [[x0, y1], null]]),
      ];
    }
    // the lines run out from the centre, each laid out from where they meet (an arrondi one on its own chord); the sectors alternate
    case 'gyronny': {
      const step = 360 / cut.pieces;
      const outs = Array.from({ length: cut.pieces }, (_, k): Pt => {
        const angle = ((GYRONNY_START + k * step) * Math.PI) / 180;
        return [cx + GYRONNY_REACH * Math.cos(angle), cy + GYRONNY_REACH * Math.sin(angle)];
      });
      const rays = outs.map((out, k): [Pt, LaidLine | null] => [out, lay(a, centre, out, a === 'arrondi' ? 'centred' : junctionOf(centre, out, outs.filter((_, j) => j !== k)))]);
      const sectors = rays.map(([out, laid], j): Array<[Pt, LaidLine | null]> => [[centre, laid], [out, null], rays[(j + 1) % rays.length]]);
      return [part(...sectors.filter((_, j) => j % 2 === 0)), part(...sectors.filter((_, j) => j % 2 === 1))];
    }
    // three arms laid out from the centre: two to the top corners of the box and one straight down (a per pall inverted: up, and the
    // two mirrored below the centre); the parts are the one between the two arms first, then dexter and sinister (dexter, sinister, base)
    case 'per-pall': case 'per-pall-inverted': {
      const fall = division === 'per-pall' ? -1 : 1;
      const out = ([x, y]: Pt): Pt => {
        const length = Math.hypot(x - cx, y - cy);
        return [cx + (GYRONNY_REACH * (x - cx)) / length, cy + (GYRONNY_REACH * (y - cy)) / length];
      };
      const D = out([cut.box.x0, cy + fall * (cy - cut.box.y0)]), S = out([cut.box.x1, cy + fall * (cy - cut.box.y0)]), M: Pt = [cx, cy - fall * GYRONNY_REACH];
      const [DL, SL, ML] = [D, S, M].map((end, i, ends) => lay(a, centre, end, junctionOf(centre, end, ends.filter((_, j) => j !== i))));
      const between = part([[D, null], [S, SL], [centre, DL]]);
      const dexter = part([[D, DL], [centre, ML], [M, null], [[D[0], M[1]], null]]);
      const sinister = part([[S, null], [[S[0], M[1]], null], [M, ML], [centre, SL]]);
      return fall === -1 ? [between, dexter, sinister] : [dexter, sinister, between];
    }
    // two lines a third of the box apart, each laid out on its own chord
    case 'tierced-per-pale': {
      const [p, q] = tiercedLines(division, fess, cut.box);
      const [P, Q] = [lay(a, [p, y0], [p, y1], 'centred'), lay(a, [q, y0], [q, y1], 'centred')];
      return [
        part([[[x0, y0], null], [[p, y0], P], [[p, y1], null], [[x0, y1], null]]),
        part([[[p, y0], null], [[q, y0], Q], [[q, y1], null], [[p, y1], P]]),
        part([[[q, y0], null], [[x1, y0], null], [[x1, y1], null], [[q, y1], Q]]),
      ];
    }
    case 'tierced-per-fess': {
      const [p, q] = tiercedLines(division, fess, cut.box);
      const [P, Q] = [lay(a, [x0, p], [x1, p], 'centred'), lay(a, [x0, q], [x1, q], 'centred')];
      return [
        part([[[x0, y0], null], [[x1, y0], null], [[x1, p], P], [[x0, p], null]]),
        part([[[x0, p], P], [[x1, p], null], [[x1, q], Q], [[x0, q], null]]),
        part([[[x0, q], Q], [[x1, q], null], [[x1, y1], null], [[x0, y1], null]]),
      ];
    }
    // the per pale line is `a`, the per fess line `b`: four arms laid out from the fess point
    case 'quarterly': {
      const [n, e, s, w]: Pt[] = [[cx, y0], [x1, cy], [cx, y1], [x0, cy]];
      const arms: Pt[] = [n, e, s, w], from = (end: Pt) => junctionOf(centre, end, arms.filter((p) => p !== end));
      const [N, E, S, W] = [lay(a, centre, n, from(n)), lay(b, centre, e, from(e)), lay(a, centre, s, from(s)), lay(b, centre, w, from(w))];
      return [
        part([[[x0, y0], null], [n, N], [centre, W], [w, null]], [[centre, E], [e, null], [[x1, y1], null], [s, S]]),
        part([[n, null], [[x1, y0], null], [e, E], [centre, N]], [[w, W], [centre, S], [s, null], [[x0, y1], null]]),
      ];
    }
    default: return division satisfies never;
  }
}

/** Every part of a divided field as its contours (per saltire and quarterly: two for a part), in part order, around the shape's fess point; its lines drawn as `lines` say. */
export function partitionContours(division: Division, lines: Lines, pieces: number | null, frame: ShapeFrame): readonly (readonly Contour[])[] {
  const cut: Cut = { pieces: pieces ?? DEFAULT_GYRONNY_PIECES, box: frame.box, slope: frame.throughoutSlope };
  return partitionAt(division, lines, straddlingCentre(division, lines, frame.fessPoint), 0, layOn(pathPolygon(frame.outline)), cut);
}

/** Region paths [first part, second part] for straight lines meeting at `fess` (turned `turn` degrees clockwise about it), covering the whole frame: a party charge's or band's. */
export function partitionRegions(division: Division, fess: Point, turn = 0): [string, string] {
  const [first, second] = partitionAt(division, PLAIN_LINES, fess, turn, layPlain, PARTY_CUT).map(contoursPath);
  return [first, second];
}

const divisionMemo = boundedMemo<readonly string[]>(5_000);

/** The region paths of a divided field in a shape, one per part in part order. */
export function divisionRegions(division: Division, lines: Lines, pieces: number | null, shape: FieldShape): readonly string[] {
  return divisionMemo(`${division}|${lines.a}|${lines.b}|${pieces}|${shape}`, () => partitionContours(division, lines, pieces, SHAPE_FRAME[shape]).map(contoursPath));
}

/** The region paths of a divided or varied field in a shape, in part order. */
function regionsOf(f: DividedField | VariedField, shape: FieldShape): readonly string[] {
  if (f.k === 'divided') return divisionRegions(f.division, f.lines, f.pieces, shape);
  const v = f.paint;
  return variationRegions(v.variation, v.pieces, v.lines, SHAPE_FRAME[shape].box);
}

const plainLines = (l: Lines): boolean => l.a === 'plain' && l.b === 'plain';

/**
 * The part (0-based) of a divided or varied field a point lies in, in a shape: the analytic test for plain lines (points exactly on a
 * line count as the later part), else the first region whose drawn outline holds it.
 */
export function partIndexAt(f: DividedField | VariedField, shape: FieldShape, x: number, y: number): number {
  const frame = SHAPE_FRAME[shape];
  if (f.k === 'divided' && plainLines(f.lines)) return partIndexIn(f, frame, x, y);
  if (f.k === 'varied' && plainLines(f.paint.lines)) return inFirstRegion(f.paint.variation, f.paint.pieces, frame.box, x, y) ? 0 : 1;
  const regions = regionsOf(f, shape);
  const index = regions.slice(0, -1).findIndex((d) => pointInPath(pathRings(d), x, y));
  return index < 0 ? regions.length - 1 : index;
}

/** The points the heater's area is measured on: a grid two units apart, those inside the outline. */
let areaPoints: readonly Pt[] | null = null;
const AREA_STEP = 2;

const partGridMemo = boundedMemo<readonly number[]>(1_000);

/**
 * The part (0-based) of a division with plain lines that each of the heater's area points lies in, in one fixed order of points, so that
 * two divisions' grids compare point by point: what the share of a field whose tincture changes is measured on (RULES-C §E.2).
 */
export function divisionPartGrid(division: Division, pieces: number | null): readonly number[] {
  return partGridMemo(`${division}|${pieces}`, () => {
    const outline = pathPolygon(SHIELD_PATH);
    areaPoints ??= Array.from({ length: 50 }, (_, i) => Array.from({ length: 60 }, (__, j): Pt => [AREA_STEP * (i + 0.5), AREA_STEP * (j + 0.5)])).flat().filter(([x, y]) => pointInPolygon(x, y, outline));
    const f: DividedField = { k: 'divided', division, lines: PLAIN_LINES, pieces, paints: [] };
    return areaPoints.map(([x, y]) => partIndexAt(f, CANONICAL_SHAPE, x, y));
  });
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

/** How a charge's art is posed in its slot, on top of the slot's own turn: mirrored first, then scaled and turned about the middle of its box. */
export interface ArtPose {
  /** Drawn mirrored about the art's upright middle line: a charge facing to sinister (contourny), one of a pair, or reversed. */
  mirror: boolean;
  /** Degrees clockwise the art is turned within its slot (a charge fesswise, bendwise, inverted…). */
  turn: number;
  /** The scale that keeps the turned art's long side as upright (`turnFit`); 1 unturned. */
  fit: number;
}

/** The art as it is drawn. */
export const UPRIGHT: ArtPose = { mirror: false, turn: 0, fit: 1 };

/** The art mirrored: facing the other way. */
export const MIRRORED: ArtPose = { mirror: true, turn: 0, fit: 1 };

/** The SVG transform that draws a charge's art in a slot in a pose: the slot's, then the pose about the middle of the art's box. */
export function chargeTransform(s: Slot, pose: ArtPose): string {
  const turn = pose.turn === 0 ? '' : ` rotate(${pose.turn} 50 50)`;
  const scale = pose.mirror || pose.fit !== 1 ? ` translate(50 50) scale(${pose.mirror ? -pose.fit : pose.fit} ${pose.fit}) translate(-50 -50)` : '';
  return `${slotTransform(s)}${turn}${scale}`;
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
