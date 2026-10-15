// Ordinary geometry: what about an ordinary group changes its drawing (its spec), where in the shape it is drawn
// (its frame), and what it draws — its body as contours, fill rule, centre, box and the points it is sampled at.
// Every renderer, rule and layout reads an ordinary's shape from here.
//
// Lines, treatments, cotises and fimbriation are part of the spec but not drawn yet: support.ts gaps them, and the
// body is the plain one.

import { notSupported, type Group, type Lines, type Paint } from './design';
import { CANONICAL_SHAPE, CHEVRON_APEX_RISE, OVER, counterchangedParts, inFirstPart, pathRings, pointInPath, shapeFrame, type CounterchangePart, type Point, type Pt } from './geometry';
import { contourPath, type Contour } from './contour';
import type { Division } from './divisions';
import type { Line } from './lines';
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

/** The body path of an ordinary, its chevron raised `lift` above its usual place. */
function bodyOf(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number): string {
  const f = shapeFrame(frame.shape);
  const { x: cx, y: cy } = frame.centre;
  const { x0, x1, y0, y1 } = OVER;
  const d = BEND_HALF, sd = SALTIRE_HALF, c = CROSS_HALF;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE - lift;
  const reach = 80; // limbs and saltire arms run this far (horizontally) from their centre
  const polygon = (p: readonly Pt[]) => contourPath(straight(p));
  switch (spec.type) {
    case 'fess': return polygon([[x0, cy - BAND_HALF], [x1, cy - BAND_HALF], [x1, cy + BAND_HALF], [x0, cy + BAND_HALF]]);
    case 'pale': return polygon([[cx - BAND_HALF, y0], [cx + BAND_HALF, y0], [cx + BAND_HALF, y1], [cx - BAND_HALF, y1]]);
    case 'bend': return polygon([[cx - reach, bend(cx - reach) - d], [cx + reach, bend(cx + reach) - d], [cx + reach, bend(cx + reach) + d], [cx - reach, bend(cx - reach) + d]]);
    case 'bend-sinister': return polygon([[cx - reach, sinister(cx - reach) - d], [cx + reach, sinister(cx + reach) - d], [cx + reach, sinister(cx + reach) + d], [cx - reach, sinister(cx - reach) + d]]);
    case 'chevron': return polygon([
      [cx - reach, apexY + reach], [cx, apexY], [cx + reach, apexY + reach],
      [cx + reach, apexY + reach + CHEVRON_THICK], [cx, apexY + CHEVRON_THICK], [cx - reach, apexY + reach + CHEVRON_THICK],
    ]);
    case 'cross': return polygon([
      [cx - c, y0], [cx + c, y0], [cx + c, cy - c], [x1, cy - c], [x1, cy + c], [cx + c, cy + c],
      [cx + c, y1], [cx - c, y1], [cx - c, cy + c], [x0, cy + c], [x0, cy - c], [cx - c, cy - c],
    ]);
    case 'saltire': return polygon([
      [cx, cy - sd], [cx + reach, cy - reach - sd], [cx + reach, cy - reach + sd], [cx + sd, cy], [cx + reach, cy + reach - sd], [cx + reach, cy + reach + sd],
      [cx, cy + sd], [cx - reach, cy + reach + sd], [cx - reach, cy + reach - sd], [cx - sd, cy], [cx - reach, cy - reach + sd], [cx - reach, cy - reach - sd],
    ]);
    case 'chief': return polygon([[x0, y0], [x1, y0], [x1, f.chiefBase], [x0, f.chiefBase]]);
    // the outline and its inset, curves and all, as subpaths of one ring
    case 'bordure': return f.outline + f.inset;
    case 'pile': return polygon(f.pile);
    default: return notSupported({ category: 'ordinary', detail: spec.type });
  }
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
