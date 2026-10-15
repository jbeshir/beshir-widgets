// Ordinary geometry: what about an ordinary group changes its drawing (its spec), where in the shape it is drawn
// (its frame), and what it draws — its body as contours, fill rule, the straight envelopes layout uses, centre, box
// and the points it is sampled at.
// Every renderer, rule and layout reads an ordinary's shape from here.
//
// Lines, treatments, cotises and fimbriation are part of the spec but not drawn yet: support.ts gaps them, and the
// body is the plain one. The envelopes already allow for the lines, so layout can fit charges to any spec.

import { notSupported, type Group, type Lines, type Paint } from './design';
import { CANONICAL_SHAPE, CHEVRON_APEX_RISE, OVER, counterchangedParts, inFirstPart, pathPolygon, pathRings, pointInPath, shapeFrame, type CounterchangePart, type Point, type Pt } from './geometry';
import { contourPath, type Contour } from './contour';
import type { Division } from './divisions';
import { LINE_PROFILE, type Line } from './lines';
import type { OrdinaryMod, OrdinaryType } from './ordinaries';
import type { FieldShape } from './shape';
import type { Box } from './variation-geometry';

/** Everything about an ordinary group that changes its drawing. Built from the group; its JSON is a memo key. */
export interface OrdinarySpec {
  readonly type: OrdinaryType;
  /** Canonical: `b` is `a` on a one-edge host. */
  readonly lines: Lines;
  /** In ORDINARY_MODS order. */
  readonly mods: readonly OrdinaryMod[];
  /** The group's count. */
  readonly count: number;
  readonly cotised: { readonly count: 1 | 2 | 3; readonly line: Line } | null;
  readonly fimbriated: boolean;
}

/** The spec of an ordinary group. */
export function specOf(group: Group): OrdinarySpec {
  const { item } = group;
  if (item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  return {
    type: item.type, lines: item.lines, mods: item.mods, count: group.count,
    cotised: item.cotised && { count: item.cotised.count, line: item.cotised.line }, fimbriated: item.fimbriated !== null,
  };
}

/** An ordinary with plain lines, no treatment, one of it, neither cotised nor fimbriated. */
export function plainSpec(type: OrdinaryType): OrdinarySpec {
  return { type, lines: { a: 'plain', b: 'plain' }, mods: [], count: 1, cotised: null, fimbriated: false };
}

/** Whether the spec is a plain ordinary: what hand-fitted layouts and the other fast paths keyed by type alone apply to. */
export const isPlainSpec = (s: OrdinarySpec): boolean =>
  s.lines.a === 'plain' && s.lines.b === 'plain' && s.mods.length === 0 && s.count === 1 && s.cotised === null && !s.fimbriated;

/** What the rest of the field leaves for an ordinary: today the whole shape, its lines crossing at the fess point. */
export interface OrdinaryFrame {
  readonly shape: FieldShape;
  /** Where fess, pale, bend and cross lines cross: the shape's fess point. */
  readonly centre: Point;
}

export function defaultOrdinaryFrame(shape: FieldShape): OrdinaryFrame {
  return { shape, centre: shapeFrame(shape).fessPoint };
}

/** What an ordinary draws in a frame. */
export interface OrdinaryGeometry {
  /** All its pieces as subpaths. */
  readonly body: string;
  /** evenodd for a ring (the bordure); nonzero otherwise. */
  readonly fillRule: 'nonzero' | 'evenodd';
  /**
   * Straight polygons about the body (rings in the body's fill rule): `outer` holds all of it, lines and all, and `inner` lies wholly
   * in it. Layout keeps charges between an ordinary clear of `outer` and charges on it inside `inner`.
   */
  readonly envelope: { readonly outer: readonly Pt[][]; readonly inner: readonly Pt[][] };
  /** Where a division of the ordinary runs through it: the middle of a chief's band, the fess point for every other ordinary. */
  readonly centre: Point;
  /** What its own pattern (barry, checky …) is laid out over: its bounding box within the shape's. */
  readonly box: Box;
  /** A step-4 grid of the shape's points inside the body (offset by one so none sits on a partition line): what it lies on. */
  readonly samples: readonly Pt[];
}

const BAND_HALF = 15;                   // fess and pale: 30 wide
const BEND_HALF = 15 * Math.SQRT2;      // 30-wide band, measured perpendicular to a 45° line
/** How tall the chief is: its lower edge is `chiefBase`. */
const CHIEF_HEIGHT = 30;
const CROSS_HALF = 12;                  // 24-wide arms
const SALTIRE_HALF = 12 * Math.SQRT2;   // 24-wide arms
const CHEVRON_THICK = 22 * Math.SQRT2;  // 22-wide band, measured perpendicular to its limbs

/** How far a chevron astride a field's per-chevron line is raised: half its thickness, so the line runs down its middle. */
const CHEVRON_ASTRIDE_LIFT = CHEVRON_THICK / 2;

/** Grid step of the points an ordinary is sampled at. */
const SAMPLE_STEP = 4;

/** A closed outline of straight edges through the points. */
const straight = ([start, ...rest]: readonly Pt[]): Contour => ({ start, edges: rest.map((to) => ({ via: [], to, run: null })) });

/** Which of the spec's lines an outline's edge runs along: `a`, `b`, or null for an edge the shape cuts off. */
type EdgeLine = 'a' | 'b' | null;

/** An ordinary drawn as a polygon: `lines[i]` is the line of the edge from `points[i]` to the next point (the last one closes it). */
interface Outline { readonly points: readonly Pt[]; readonly lines: readonly EdgeLine[] }

/** How wide each polygon ordinary's band is, across its edges: what caps how deep a line on it is cut (the pile's as a fess's). */
const BAND_WIDTH = {
  fess: 2 * BAND_HALF, pale: 2 * BAND_HALF, bend: 2 * BAND_HALF, 'bend-sinister': 2 * BAND_HALF, chevron: CHEVRON_THICK / Math.SQRT2,
  cross: 2 * CROSS_HALF, saltire: 2 * SALTIRE_HALF / Math.SQRT2, chief: CHIEF_HEIGHT, pile: 2 * BAND_HALF,
} as const;
/** How wide the bordure is (the lozenge's a little narrower). */
const BORDURE_WIDTH = 10;

/** The straight outline of an ordinary, its chevron raised `lift` above its usual place; null for the bordure (a ring with curves). */
function outlineOf(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number): Outline | null {
  const f = shapeFrame(frame.shape);
  const { x: cx, y: cy } = frame.centre;
  const { x0, x1, y0, y1 } = OVER;
  const d = BEND_HALF, sd = SALTIRE_HALF, c = CROSS_HALF;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE - lift;
  const reach = 80; // limbs and saltire arms run this far (horizontally) from their centre
  const outline = (points: readonly Pt[], lines: readonly EdgeLine[]): Outline => ({ points, lines });
  // a band's upper edge is `a` and its lower edge `b`; its ends lie outside the shape
  const band = (points: readonly Pt[]) => outline(points, ['a', null, 'b', null]);
  switch (spec.type) {
    case 'fess': return band([[x0, cy - BAND_HALF], [x1, cy - BAND_HALF], [x1, cy + BAND_HALF], [x0, cy + BAND_HALF]]);
    case 'pale': return outline([[cx - BAND_HALF, y0], [cx + BAND_HALF, y0], [cx + BAND_HALF, y1], [cx - BAND_HALF, y1]], [null, 'b', null, 'a']);
    case 'bend': return band([[cx - reach, bend(cx - reach) - d], [cx + reach, bend(cx + reach) - d], [cx + reach, bend(cx + reach) + d], [cx - reach, bend(cx - reach) + d]]);
    case 'bend-sinister': return band([[cx - reach, sinister(cx - reach) - d], [cx + reach, sinister(cx + reach) - d], [cx + reach, sinister(cx + reach) + d], [cx - reach, sinister(cx - reach) + d]]);
    case 'chevron': return outline([
      [cx - reach, apexY + reach], [cx, apexY], [cx + reach, apexY + reach],
      [cx + reach, apexY + reach + CHEVRON_THICK], [cx, apexY + CHEVRON_THICK], [cx - reach, apexY + reach + CHEVRON_THICK],
    ], ['a', 'a', null, 'b', 'b', null]);
    case 'cross': return outline([
      [cx - c, y0], [cx + c, y0], [cx + c, cy - c], [x1, cy - c], [x1, cy + c], [cx + c, cy + c],
      [cx + c, y1], [cx - c, y1], [cx - c, cy + c], [x0, cy + c], [x0, cy - c], [cx - c, cy - c],
    ], [null, 'a', 'a', null, 'a', 'a', null, 'a', 'a', null, 'a', 'a']);
    case 'saltire': return outline([
      [cx, cy - sd], [cx + reach, cy - reach - sd], [cx + reach, cy - reach + sd], [cx + sd, cy], [cx + reach, cy + reach - sd], [cx + reach, cy + reach + sd],
      [cx, cy + sd], [cx - reach, cy + reach + sd], [cx - reach, cy + reach - sd], [cx - sd, cy], [cx - reach, cy - reach + sd], [cx - reach, cy - reach - sd],
    ], ['a', null, 'a', 'a', null, 'a', 'a', null, 'a', 'a', null, 'a']);
    case 'chief': return outline([[x0, y0], [x1, y0], [x1, f.chiefBase], [x0, f.chiefBase]], [null, null, 'a', null]);
    case 'pile': return outline(f.pile, [null, 'a', 'a']);
    case 'bordure': return null;
    default: return notSupported({ category: 'ordinary', detail: spec.type });
  }
}

/** The body path of an ordinary, its chevron raised `lift` above its usual place. */
function bodyOf(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number): string {
  const outline = outlineOf(spec, frame, lift);
  if (outline) return contourPath(straight(outline.points));
  // the bordure: the outline and its inset, curves and all, as subpaths of one ring
  const f = shapeFrame(frame.shape);
  return f.outline + f.inset;
}

/**
 * How far a line takes an edge of a band this wide off its straight line, either way at most: its profile's depth, cut to 0.3 of
 * the band (RULES-C §A.4). Every profile keeps within its depth of the line, on whichever side it runs.
 */
const edgeReach = (line: Line, width: number): number => (line === 'plain' ? 0 : Math.min(LINE_PROFILE[line].depth, 0.3 * width));

/** The polygon (each corner listed once) with edge i moved `by[i]` outward (negative: inward), each corner where its two moved edges meet. */
function offsetPolygon(points: readonly Pt[], by: readonly number[]): Pt[] {
  const n = points.length;
  let area = 0;
  for (let i = 0; i < n; i++) area += points[i][0] * points[(i + 1) % n][1] - points[(i + 1) % n][0] * points[i][1];
  // The outward normal of each edge: the polygon runs clockwise on the page when its signed area is positive.
  const turn = area > 0 ? 1 : -1;
  const normals = points.map(([ax, ay], i): Pt => {
    const [bx, bY] = points[(i + 1) % n];
    const len = Math.hypot(bx - ax, bY - ay) || 1;
    return [(turn * (bY - ay)) / len, (turn * (ax - bx)) / len];
  });
  return points.map(([x, y], i): Pt => {
    const j = (i + n - 1) % n; // the edge that ends at this corner
    const [ux, uy] = normals[j], [vx, vy] = normals[i];
    const cross = ux * vy - uy * vx;
    // A corner between (nearly) parallel edges, as on a flattened curve, moves along their normal.
    if (Math.abs(cross) < 1e-6) return [x + vx * by[i], y + vy * by[i]];
    // The point p with p·u = (x, y)·u + by[j] and p·v = (x, y)·v + by[i].
    const p = x * ux + y * uy + by[j], q = x * vx + y * vy + by[i];
    return [(p * vy - q * uy) / cross, (ux * q - vx * p) / cross];
  });
}

/**
 * The straight polygons a body with lines stays within (`outer`: each lined edge moved out by its reach) and always covers
 * (`inner`: moved in) — what layout keeps charges clear of or inside, never the toothed body. With plain lines, the body's rings.
 */
function envelopeOf(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number, body: string): OrdinaryGeometry['envelope'] {
  if (spec.lines.a === 'plain' && spec.lines.b === 'plain') return { outer: pathRings(body), inner: pathRings(body) };
  const outline = outlineOf(spec, frame, lift);
  if (!outline) {
    // The bordure's line runs along its inner edge: the inset moves inward (the ring grows) for `outer`, outward for `inner`.
    const f = shapeFrame(frame.shape);
    const [ring, inset] = [pathPolygon(f.outline), pathPolygon(f.inset)];
    const reach = edgeReach(spec.lines.a, BORDURE_WIDTH);
    // A flattened curve ends on its first point: list it once.
    const corners = inset.filter((p, i) => i === 0 || p[0] !== inset[i - 1][0] || p[1] !== inset[i - 1][1]);
    if (corners[0][0] === corners[corners.length - 1][0] && corners[0][1] === corners[corners.length - 1][1]) corners.pop();
    return { outer: [ring, offsetPolygon(corners, corners.map(() => -reach))], inner: [ring, offsetPolygon(corners, corners.map(() => reach))] };
  }
  const width = BAND_WIDTH[spec.type as keyof typeof BAND_WIDTH];
  const reach = outline.lines.map((l) => (l === null ? 0 : edgeReach(spec.lines[l], width)));
  return { outer: [offsetPolygon(outline.points, reach)], inner: [offsetPolygon(outline.points, reach.map((r) => -r))] };
}

const geometryCache = new Map<string, OrdinaryGeometry>();

function build(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number): OrdinaryGeometry {
  const key = JSON.stringify([spec, frame, lift]);
  let g = geometryCache.get(key);
  if (!g) {
    const f = shapeFrame(frame.shape);
    const body = bodyOf(spec, frame, lift);
    const rings = pathRings(body), outline = pathRings(f.outline);
    const points = rings.flat(), xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const samples: Pt[] = [];
    for (let x = 1; x < 100; x += SAMPLE_STEP) {
      for (let y = 1; y < 120; y += SAMPLE_STEP) if (pointInPath(outline, x, y) && pointInPath(rings, x, y)) samples.push([x, y]);
    }
    g = {
      body,
      fillRule: spec.type === 'bordure' ? 'evenodd' : 'nonzero',
      envelope: envelopeOf(spec, frame, lift, body),
      centre: spec.type === 'chief' ? { x: frame.centre.x, y: f.chiefBase - CHIEF_HEIGHT / 2 } : frame.centre,
      box: { x0: Math.max(f.box.x0, Math.min(...xs)), y0: Math.max(f.box.y0, Math.min(...ys)), x1: Math.min(f.box.x1, Math.max(...xs)), y1: Math.min(f.box.y1, Math.max(...ys)) },
      samples,
    };
    geometryCache.set(key, g);
  }
  return g;
}

/** What an ordinary draws in a frame (memoised by spec and frame). */
export function ordinaryGeometry(spec: OrdinarySpec, frame: OrdinaryFrame): OrdinaryGeometry {
  return build(spec, frame, 0);
}

/** Whether an ordinary of this paint lies astride its field's line: a counterchanged chevron on a field per chevron. */
export const liesAstride = (field: Paint, spec: OrdinarySpec, paint: Paint): boolean =>
  spec.type === 'chevron' && paint.k === 'counterchanged' && field.k === 'divided' && field.division === 'per-chevron';

/**
 * What an ordinary of this paint draws on the field: a chevron astride the field's line is raised so that the line runs down the
 * middle of it (drawn in its usual place it would lie wholly below the line and show one tincture).
 */
export function fieldOrdinaryGeometry(field: Paint, spec: OrdinarySpec, paint: Paint, frame: OrdinaryFrame): OrdinaryGeometry {
  return build(spec, frame, liesAstride(field, spec, paint) ? CHEVRON_ASTRIDE_LIFT : 0);
}

/** The parts of a counterchanged ordinary on the field: the regions it overlaps (a chief on a field per fess lies on one only). */
export function counterchangedOrdinaryParts(field: Paint, spec: OrdinarySpec, frame: OrdinaryFrame): CounterchangePart[] {
  return counterchangedParts(field, fieldOrdinaryGeometry(field, spec, { k: 'counterchanged' }, frame).samples, frame.shape);
}

/** Whether a division through the ordinary's centre runs through it, so that both its parts show. */
export function divisionCutsOrdinary(division: Division, spec: OrdinarySpec): boolean {
  const { centre, samples } = ordinaryGeometry(spec, defaultOrdinaryFrame(CANONICAL_SHAPE));
  const first = samples.filter(([x, y]) => inFirstPart(division, centre, x, y)).length;
  return first > 0 && first < samples.length;
}
