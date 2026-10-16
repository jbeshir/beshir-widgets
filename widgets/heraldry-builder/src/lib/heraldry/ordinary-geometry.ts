// Ordinary geometry: what about an ordinary group changes its drawing (its spec), where in the shape it is drawn
// (its frame), and what it draws — its body as contours, fill rule, the straight envelopes layout uses, centre, box
// and the points it is sampled at.
// Every renderer, rule and layout reads an ordinary's shape from here.
//
// Lines of partition are drawn on the edges of the ten ordinaries (a band's two edges sharing their periods, a band
// with a complex line drawn wider), and the treatments that change their outline: inverted (reflected top to bottom),
// couped (cut short inside the shape, ends straight), throughout (a chevron's apex or a pile's point on the edge),
// enhanced and abased (moved toward chief or base), voided (its middle cut out, straight-edged inside its lines). Cotises (thin bands
// beside each long edge, with a line of their own) and fimbriation (a narrow band round the body, under it) are trims drawn as parts of
// their own, each with the points it lies on.
//
// The peripherals beside the chief and bordure — base, point pointed, canton, quarter, gyron (sinister: mirrored), the orle and tressure
// (rings inside each shape's own inset), the flaunches and gore (curves), and the dexter and sinister points (drawn to be refused) — are
// drawn here too; a base or point leaves the ordinaries in the field a frame whose bottom is its top.

import { notSupported, type Design, type Group, type Lines, type Paint } from './design';
import {
  CANONICAL_SHAPE, CHEVRON_APEX_RISE, CURVE_STEPS, OVER, counterchangedParts, inFirstPart, pathPolygon, pathRings, pts, shapeFrame, type CounterchangePart, type Point, type Pt, type ShapeFrame,
} from './geometry';
import { contourPath, type Contour, type ContourEdge } from './contour';
import type { Division } from './divisions';
import { LINE_PROFILE, PROFILE_REACH, featureMiddle, fieldSide, profileSwing, fitPeriod, isStraightLine, runAlong, visibleSpan, type ComplexLine, type EdgeRun, type Line } from './lines';
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

/** What the rest of the field leaves for an ordinary: the whole shape, its lines crossing at the fess point, above any base. */
export interface OrdinaryFrame {
  readonly shape: FieldShape;
  /** Where fess, pale, bend and cross lines cross: the shape's fess point. */
  readonly centre: Point;
  /**
   * Where the free field ends below: the foot of the shape's box, or the top of a base or point pointed. An ordinary is drawn on under
   * the base (which is painted over it) but lies only above it: its samples stop here.
   */
  readonly bottom: number;
}

export function defaultOrdinaryFrame(shape: FieldShape): OrdinaryFrame {
  const f = shapeFrame(shape);
  return { shape, centre: f.fessPoint, bottom: f.box.y1 };
}

/** The peripherals that rise from the base of the shield and so end the free field below. */
const FROM_BASE: readonly OrdinaryType[] = ['base', 'point'];

/** The frame the design's peripherals leave its other ordinaries in a shape: its bottom the highest line a base or point pointed always covers. */
export function ordinaryFrameOf(d: Design, shape: FieldShape): OrdinaryFrame {
  const frame = defaultOrdinaryFrame(shape);
  const tops = d.groups.flatMap((g) => (g.role === 'peripheral' && g.item.k === 'ordinary' && FROM_BASE.includes(g.item.type)
    ? ordinaryGeometry(specOf(g), frame).envelope.inner.flat().map(([, y]) => y) : []));
  return tops.length === 0 ? frame : { ...frame, bottom: Math.min(frame.bottom, ...tops) };
}

/** A trim drawn with an ordinary's body (its fimbriation, its cotises): its path, and the step-2 grid of the shape's points that show it — what it lies on. */
export interface OrdinaryTrim { readonly d: string; readonly fillRule: 'nonzero' | 'evenodd'; readonly samples: readonly Pt[] }

/** What an ordinary draws in a frame. */
export interface OrdinaryGeometry {
  /** All its pieces as subpaths; a voided one, its outline and its voiding. */
  readonly body: string;
  /** evenodd for a ring (the bordure) and a voided ordinary; nonzero otherwise. */
  readonly fillRule: 'nonzero' | 'evenodd';
  /** The body grown by FIMBRIATION_WIDTH with its lines, drawn under it; its samples lie in the band that shows round the body. */
  readonly fimbriation: OrdinaryTrim | null;
  /** Every cotise beside each long edge, as subpaths. */
  readonly cotises: OrdinaryTrim | null;
  /**
   * Straight polygons about the body (rings in the body's fill rule): `outer` holds all of it, lines, fimbriation and cotises and all,
   * and `inner` lies wholly in the body. Layout keeps charges between an ordinary clear of `outer` and charges on it inside `inner`.
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

/** How tall the base is on the heater (whose narrowing foot leaves little of a lower one); in another shape as much taller as its chief is. */
const BASE_HEIGHT = 28;
/** How high the point pointed rises on the heater (its apex); in another shape the same share of its box above its foot. */
const POINT_TOP = 80;
/** How far the sides of the point pointed bow toward the base in their middles: it is ployé by default (RULES-C §C.3). */
const POINT_SAG = 5;
/**
 * How much of the shape's box, across and down, a canton and a quarter take from its dexter chief corner (RULES-C §C.3: a third and a
 * half); the lozenge's canton more, or its sloping top edge would leave a sliver of it.
 */
const cornerShare = (type: OrdinaryType, shape: FieldShape): number => (type === 'quarter' ? 1 / 2 : shape === 'lozenge' ? 0.4 : 1 / 3);

/** How far a chevron astride a field's per-chevron line is raised: half its thickness, so the line runs down its middle. */
const CHEVRON_ASTRIDE_LIFT = CHEVRON_THICK / 2;

/** Grid step of the points an ordinary is sampled at. */
const SAMPLE_STEP = 4;

/** Which of the spec's lines an outline's edge runs along, and the course it is laid on (an index into the outline's courses); null for an edge the shape cuts off. */
type OutlineEdge = { readonly line: 'a' | 'b'; readonly course: number } | null;

/**
 * A straight line the lined edges along one band, limb or arm are laid on, so that they share their periods (RULES-C §A.4): distances
 * run from `origin` along the unit `dir`. A band (`junction` null) is laid centred on the chord the shape shows of the line; limbs and
 * arms are laid out from where they meet, their periods starting `junction` line depths past the inner end of each edge so that the
 * features of two edges meeting there keep clear of each other. `plus` is the side of `dir` a parallel or single profile puts its +
 * side on, on every edge of the course (`'outward'`: each edge's own outside, so a pile's sides mirror each other). `cut` is where a
 * couped band or arm starts and stops along it (null: it runs off the shape): its lines are laid between those ends alone.
 */
interface Course {
  readonly origin: Pt;
  readonly dir: Pt;
  readonly junction: number | null;
  readonly plus: 1 | -1 | 'outward';
  readonly cut: readonly [number, number] | null;
}

/** An ordinary drawn as a polygon: `edges[i]` is the edge from `points[i]` to the next point (the last one closes it). */
interface Outline { readonly points: readonly Pt[]; readonly edges: readonly OutlineEdge[]; readonly courses: readonly Course[] }

/** The bands and arms drawn wider with a line on an edge: "an ordinary with a complex line … will be somewhat wider" (RULES-C §A.4). */
const WIDENED: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'];
const WIDENING = 1.2;

/** How wide each polygon ordinary is across its lined edges, drawn plain: what caps how deep a line on it is cut (the pile's as a fess's). */
const PLAIN_WIDTH = {
  fess: 2 * BAND_HALF, pale: 2 * BAND_HALF, bend: 2 * BAND_HALF, 'bend-sinister': 2 * BAND_HALF, chevron: CHEVRON_THICK / Math.SQRT2,
  cross: 2 * CROSS_HALF, saltire: 2 * SALTIRE_HALF / Math.SQRT2, chief: CHIEF_HEIGHT, pile: 2 * BAND_HALF,
  base: BASE_HEIGHT, canton: 100 / 3, quarter: 50, gyron: 2 * BAND_HALF,
} as const;
/** How wide the bordure is (the lozenge's a little narrower). */
const BORDURE_WIDTH = 10;

/** Whether an edge of the spec carries a line other than a straight one (enarched and ployé bow a band, they don't widen it). */
const hasComplexLine = (spec: OrdinarySpec): boolean => !isStraightLine(spec.lines.a) || !isStraightLine(spec.lines.b);

/** How wide a cotise is beside its band — about a quarter of it — and how far it lies from the band and from the next cotise: its own width (RULES-C §D.5). */
const COTISE_SHARE = 1 / 4;
/** How wide the fimbriation round a fimbriated ordinary is (RULES-C §D.4). */
const FIMBRIATION_WIDTH = 2;
/** How wide a voided ordinary's border round its voiding is at least: the voiding's straight edges lie this far inside the body's, past what its lines take in. */
const VOIDED_BORDER = 4;
/** How far past a corner of a grown outline its mitre may reach, in widths grown: a sharp point (an engrailed cusp, a flame's tip) is cut off there. */
const MITRE_LIMIT = 2;
/** Cross and saltire arms cotised are drawn narrower still than bands: with four arms, their cotises would take the field. */
const COTISED_ARMS = 0.75;

/**
 * How much wider than plain the spec is drawn: a band with a complex line wider; a band doubly or triply cotised narrower, so that it and
 * its cotises take as much of the field as a band cotised once.
 */
const bandScale = (spec: OrdinarySpec): number => (WIDENED.includes(spec.type) && hasComplexLine(spec) ? WIDENING : 1) * cotisedScale(spec);

/** How much narrower a cotised band is drawn (a cross's and a saltire's arms narrower still). */
const cotisedScale = (spec: OrdinarySpec): number =>
  (spec.cotised ? (2 / (1 + spec.cotised.count)) * (spec.type === 'cross' || spec.type === 'saltire' ? COTISED_ARMS : 1) : 1);

/** How wide the ordinary is drawn across its lined edges. */
function drawnWidth(spec: OrdinarySpec): number {
  if (spec.type === 'bordure') return BORDURE_WIDTH;
  const plain = PLAIN_WIDTH[spec.type as keyof typeof PLAIN_WIDTH] ?? notSupported({ category: 'ordinary', detail: spec.type });
  return plain * bandScale(spec);
}

/**
 * How deep a line is cut on an edge of an ordinary this wide (RULES-C §A.4): its profile's depth, at most 0.3 of its width (a bordure's
 * too: half its width, as RULES-C suggests, leaves the lozenge's narrower bordure no room for charges). A single feature (enarched, ployé)
 * bows the whole band by its own depth, both edges alike.
 */
function edgeDepth(line: ComplexLine, width: number): number {
  const p = LINE_PROFILE[line];
  return p.kind === 'single' ? p.depth : Math.min(p.depth, 0.3 * width);
}

/** How far a line takes an edge off its straight line, either way at most: its depth times how far its profile swings (`profileSwing`). */
const edgeReach = (line: Line, width: number): number => (line === 'plain' ? 0 : edgeDepth(line, width) * profileSwing(line));

/**
 * How far a line on an ordinary's edge cuts into the body (its + side outward, as a one-sided profile's is): none for the lines whose features
 * stand out of it (indented, invected, bretessed), its whole depth for engrailed, half for the lines that swing either way.
 */
function inwardReach(line: Line, width: number): number {
  if (line === 'plain') return 0;
  const middle = featureMiddle(line);
  return edgeDepth(line, width) * (profileSwing(line) - Math.abs(middle) - middle);
}

const unit = ([x, y]: Pt): Pt => {
  const len = Math.hypot(x, y);
  return [x / len, y / len];
};

/** How far inside the shape a couped band or arm stops (RULES-C §D.2): its ends are cut straight, lines and all. */
const COUPED_INSET = 12;
/** How far an enhanced or abased band moves toward chief or base, across its length (RULES-C §D.6). */
const BAND_SHIFT = 12;

/** How far down the page an enhanced (up: negative) or abased band is moved: BAND_SHIFT across a fess, the same across a bend or a chevron's limbs. */
export function bandShift(spec: OrdinarySpec): number {
  const sign = spec.mods.includes('enhanced') ? -1 : spec.mods.includes('abased') ? 1 : 0;
  return sign * BAND_SHIFT * (spec.type === 'fess' ? 1 : Math.SQRT2);
}

/** How far below the fess point a band or shape is turned upside down about: on the heater, the middle of its box (a pile inverted rises as far as a pile falls). */
const FLIP_DROP = 10;

/** The line a band or shape turned upside down is reflected about; every shape's sits as far below its fess point as the heater's, so layouts map from the heater's. */
export const flipAxis = (frame: OrdinaryFrame): number => frame.centre.y + FLIP_DROP;

/** The ordinary's own centre: the fess point, moved with an enhanced or abased band and reflected with an inverted shape. */
function ordinaryCentre(spec: OrdinarySpec, frame: OrdinaryFrame): Point {
  const y = spec.mods.includes('inverted') ? 2 * flipAxis(frame) - frame.centre.y : frame.centre.y;
  return { x: frame.centre.x, y: y + bandShift(spec) };
}

/**
 * Where a couped band or arm laid along `dir` from `origin` starts and stops: COUPED_INSET inside the shape on its middle line and on both its
 * edges (`half` either side), so its straight ends lie inside the shape (each shape is convex). Distances from `origin`.
 */
function coupedCut(origin: Pt, dir: Pt, half: number, shape: readonly Pt[]): [number, number] {
  const n: Pt = [-dir[1], dir[0]];
  const spans = [-half, 0, half].map((o) => {
    const from: Pt = [origin[0] + n[0] * o, origin[1] + n[1] * o];
    return visibleSpan(from, [from[0] + dir[0] * COURSE_REACH, from[1] + dir[1] * COURSE_REACH], shape) ?? [0, 0];
  });
  return [Math.max(...spans.map(([a]) => a)) + COUPED_INSET, Math.min(...spans.map(([, b]) => b)) - COUPED_INSET];
}

/** A point `s` along a course from its origin and `o` to the left of it (in page coordinates). */
const at = (origin: Pt, dir: Pt, s: number, o: number): Pt => [origin[0] + dir[0] * s + dir[1] * o, origin[1] + dir[1] * s - dir[0] * o];

/** The outline reflected top to bottom about y = `axis`: its edges keep their lines, `a` and `b` swapping (a chevron inverted's upper edge is its inner one). */
function reflected(outline: Outline, axis: number): Outline {
  const flip = ([x, y]: Pt): Pt => [x, 2 * axis - y];
  return {
    points: outline.points.map(flip),
    edges: outline.edges.map((e) => e && { line: e.line === 'a' ? 'b' : 'a', course: e.course }),
    courses: outline.courses.map((c) => {
      const dir: Pt = [c.dir[0], -c.dir[1]];
      return { ...c, origin: flip(c.origin), dir, plus: c.plus === 'outward' ? 'outward' : fieldSide(dir) };
    }),
  };
}

/** The outline mirrored left to right about x = `axis`: a canton, quarter or gyron sinister. Its edges keep their lines. */
function mirrored(outline: Outline, axis: number): Outline {
  const flip = ([x, y]: Pt): Pt => [2 * axis - x, y];
  return {
    ...outline,
    points: outline.points.map(flip),
    courses: outline.courses.map((c) => {
      const dir: Pt = [-c.dir[0], c.dir[1]];
      return { ...c, origin: flip(c.origin), dir, plus: c.plus === 'outward' ? 'outward' : fieldSide(dir) };
    }),
  };
}

/** The straight outline of an ordinary, its chevron raised `lift` above its usual place; null for the ordinaries drawn as rings (`RINGS`) or curves (the flaunches, the gore). */
function outlineOf(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number): Outline | null {
  const inverted = spec.mods.includes('inverted');
  const upright = uprightOutline(spec, frame, lift);
  const turned = upright && inverted ? reflected(upright, flipAxis(frame)) : upright;
  return turned && spec.mods.includes('sinister') ? mirrored(turned, frame.centre.x) : turned;
}

/** The top of the base in a shape: BASE_HEIGHT above the foot of its box on the heater, as much more as the shape's chief is taller. */
const baseTop = (f: ShapeFrame): number => f.box.y1 - (BASE_HEIGHT * (f.chiefBase - f.box.y0)) / CHIEF_HEIGHT;

/**
 * The point pointed in a shape: from the lower corners of its box up to an apex in the middle, POINT_TOP high on the heater, its sides
 * bowed toward the base (each a quadratic curve, flattened), and closed below the shape.
 */
function pointPoints(f: ShapeFrame): Pt[] {
  const { x0, x1, y0, y1 } = f.box;
  const apex: Pt = [(x0 + x1) / 2, y1 - ((120 - POINT_TOP) * (y1 - y0)) / 120];
  const side = (foot: Pt): Pt[] => {
    // the control point twice the sag below the chord's middle bows the curve's middle by the sag
    const control: Pt = [(apex[0] + foot[0]) / 2, (apex[1] + foot[1]) / 2 + 2 * POINT_SAG];
    return Array.from({ length: CURVE_STEPS * 2 }, (_, i) => {
      const t = (i + 1) / (CURVE_STEPS * 2), u = 1 - t;
      return [u * u * apex[0] + 2 * u * t * control[0] + t * t * foot[0], u * u * apex[1] + 2 * u * t * control[1] + t * t * foot[1]];
    });
  };
  const right = side([x1, y1]), left = side([x0, y1]).reverse();
  return [apex, ...right, [x1, OVER.y1], [x0, OVER.y1], ...left];
}

/** Where the line of a dexter point leaves the dexter side of the shape's box (a share of its height down) and meets its foot (a share of its width across). */
const SIDE_POINT_TOP = 0.6;
const SIDE_POINT_FOOT = 0.7;

/**
 * The point dexter: the dexter base of the shape cut off by a straight line from the dexter side of its box, SIDE_POINT_TOP down, to its
 * foot past the middle (RULES-C §C.3 says no more of it: it was not used in period, and is drawn only to be refused).
 */
function sidePoint(f: ShapeFrame): Outline {
  const { x0, x1, y0, y1 } = f.box;
  const top: Pt = [x0, y0 + SIDE_POINT_TOP * (y1 - y0)], foot: Pt = [x0 + SIDE_POINT_FOOT * (x1 - x0), y1];
  const points: Pt[] = [top, foot, [foot[0], OVER.y1], [OVER.x0, OVER.y1], [OVER.x0, top[1]]];
  return { points, edges: points.map(() => null), courses: [] };
}

/** The outline before it is turned upside down (`reflected`): a band moved up or down, a band or arm couped, a chevron or pile throughout. */
function uprightOutline(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number): Outline | null {
  const f = shapeFrame(frame.shape);
  const shape = pathPolygon(f.outline);
  const { x: cx } = frame.centre;
  // an inverted shape is moved the other way before it is turned over
  const cy = frame.centre.y + (spec.mods.includes('inverted') ? -1 : 1) * bandShift(spec);
  const couped = spec.mods.includes('couped'), throughout = spec.mods.includes('throughout');
  // the edge a shape throughout reaches, where it lies before an inverted one is turned over: the top, or (once turned) the base
  const edgeAt = (y: number) => (spec.mods.includes('inverted') ? 2 * flipAxis(frame) - y : y);
  const { x0, x1, y0, y1 } = OVER;
  const k = bandScale(spec);
  const h = BAND_HALF * k, d = BEND_HALF * k, sd = SALTIRE_HALF * k, c = CROSS_HALF * k, thick = CHEVRON_THICK * k;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  // a widened chevron grows both ways from the middle of its band; one throughout has its apex on the top of the shape
  const apexY = throughout ? edgeAt(spec.mods.includes('inverted') ? f.box.y1 : f.box.y0) : cy - CHEVRON_APEX_RISE - lift - (thick - CHEVRON_THICK) / 2;
  const reach = 80; // limbs and saltire arms run this far (horizontally) from their centre
  const centre: Pt = [cx, cy];
  const A = (course: number): OutlineEdge => ({ line: 'a', course }), B = (course: number): OutlineEdge => ({ line: 'b', course });
  // a band is laid centred along its middle line, `plus` toward chief (or dexter): its upper edge is `a` and its lower edge `b`
  const band = (origin: Pt, dir: Pt, cut: [number, number] | null = null): Course => ({ origin, dir, junction: null, plus: fieldSide(dir), cut });
  // arms laid out from the centre, `plus` the left of each (so the four arms turn into each other)
  const arm = (dir: Pt, cut: [number, number] | null = null): Course => ({ origin: centre, dir: unit(dir), junction: 1, plus: 1, cut });
  /** A band couped across its length: its corners `half` either side of its middle line, its ends straight. */
  const coupedBand = (origin: Pt, dir: Pt, half: number): Outline => {
    const cut = coupedCut(origin, dir, half, shape);
    const [s0, s1] = cut;
    return { points: [at(origin, dir, s0, half), at(origin, dir, s1, half), at(origin, dir, s1, -half), at(origin, dir, s0, -half)], edges: [A(0), null, B(0), null], courses: [band(origin, dir, cut)] };
  };
  switch (spec.type) {
    case 'fess':
      if (couped) return coupedBand([x0, cy], [1, 0], h);
      return { points: [[x0, cy - h], [x1, cy - h], [x1, cy + h], [x0, cy + h]], edges: [A(0), null, B(0), null], courses: [band([x0, cy], [1, 0])] };
    case 'pale': {
      if (!couped) return { points: [[cx - h, y0], [cx + h, y0], [cx + h, y1], [cx - h, y1]], edges: [null, B(0), null, A(0)], courses: [band([cx, y0], [0, 1])] };
      // laid downward, its left (on the page) is the sinister edge: the dexter edge `a` is on the right of the course
      const cut = coupedCut([cx, y0], [0, 1], h, shape);
      const [s0, s1] = cut;
      return { points: [[cx - h, y0 + s0], [cx + h, y0 + s0], [cx + h, y0 + s1], [cx - h, y0 + s1]], edges: [null, B(0), null, A(0)], courses: [band([cx, y0], [0, 1], cut)] };
    }
    case 'bend': {
      const origin: Pt = [cx - reach, bend(cx - reach)];
      if (couped) return coupedBand(origin, unit([1, 1]), h);
      return {
        points: [[cx - reach, bend(cx - reach) - d], [cx + reach, bend(cx + reach) - d], [cx + reach, bend(cx + reach) + d], [cx - reach, bend(cx - reach) + d]],
        edges: [A(0), null, B(0), null], courses: [band(origin, unit([1, 1]))],
      };
    }
    case 'bend-sinister': {
      const origin: Pt = [cx - reach, sinister(cx - reach)];
      if (couped) return coupedBand(origin, unit([1, -1]), h);
      return {
        points: [[cx - reach, sinister(cx - reach) - d], [cx + reach, sinister(cx + reach) - d], [cx + reach, sinister(cx + reach) + d], [cx - reach, sinister(cx - reach) + d]],
        edges: [A(0), null, B(0), null], courses: [band(origin, unit([1, -1]))],
      };
    }
    // each limb laid out from the apex; `plus` toward chief on both, so the limbs mirror each other
    case 'chevron': {
      const apex: Pt = [cx, apexY];
      const dirs: [Pt, Pt] = [unit([-1, 1]), unit([1, 1])];
      // a couped limb stops short of the shape on its outer and its inner edge, both cut square across the limb
      const t = thick / Math.SQRT2;
      const cuts = dirs.map((dir): [number, number] | null => (couped ? [0, coupedCut(at(apex, dir, 0, (dir[0] < 0 ? 1 : -1) * t / 2), dir, t / 2, shape)[1]] : null));
      const limb = (i: number): Course => ({ origin: apex, dir: dirs[i], junction: 1, plus: fieldSide(dirs[i]), cut: cuts[i] });
      const ends = dirs.map((dir, i): [Pt, Pt] => {
        const cut = cuts[i];
        // the inner edge lies to the right of the left limb and to the left of the right one (on the page)
        const inward = dir[0] < 0 ? t : -t;
        return cut ? [at(apex, dir, cut[1], 0), at(apex, dir, cut[1], inward)] : [[cx + Math.sign(dir[0]) * reach, apexY + reach], [cx + Math.sign(dir[0]) * reach, apexY + reach + thick]];
      });
      return {
        points: [ends[0][0], apex, ends[1][0], ends[1][1], [cx, apexY + thick], ends[0][1]],
        edges: [A(0), A(1), null, B(1), B(0), null], courses: [limb(0), limb(1)],
      };
    }
    case 'cross': {
      if (!couped) {
        return {
          points: [
            [cx - c, y0], [cx + c, y0], [cx + c, cy - c], [x1, cy - c], [x1, cy + c], [cx + c, cy + c],
            [cx + c, y1], [cx - c, y1], [cx - c, cy + c], [x0, cy + c], [x0, cy - c], [cx - c, cy - c],
          ],
          edges: [null, A(0), A(1), null, A(1), A(2), null, A(2), A(3), null, A(3), A(0)],
          courses: [arm([0, -1]), arm([1, 0]), arm([0, 1]), arm([-1, 0])],
        };
      }
      // each arm's end, then the corner where its right edge meets the next arm's left one
      const dirs: Pt[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const cuts = dirs.map((dir): [number, number] => [0, coupedCut(centre, dir, c, shape)[1]]);
      return {
        points: dirs.flatMap((dir, i): Pt[] => [at(centre, dir, cuts[i][1], c), at(centre, dir, cuts[i][1], -c), at(centre, dir, c, -c)]),
        edges: [null, A(0), A(1), null, A(1), A(2), null, A(2), A(3), null, A(3), A(0)],
        courses: dirs.map((dir, i) => arm(dir, cuts[i])),
      };
    }
    case 'saltire': {
      if (!couped) {
        return {
          points: [
            [cx, cy - sd], [cx + reach, cy - reach - sd], [cx + reach, cy - reach + sd], [cx + sd, cy], [cx + reach, cy + reach - sd], [cx + reach, cy + reach + sd],
            [cx, cy + sd], [cx - reach, cy + reach + sd], [cx - reach, cy + reach - sd], [cx - sd, cy], [cx - reach, cy - reach + sd], [cx - reach, cy - reach - sd],
          ],
          edges: [A(0), null, A(0), A(1), null, A(1), A(2), null, A(2), A(3), null, A(3)],
          courses: [arm([1, -1]), arm([1, 1]), arm([-1, 1]), arm([-1, -1])],
        };
      }
      // the corner where the last arm's right edge meets this one's left edge, then this arm's end; arms 12 wide each side across them
      const w = sd / Math.SQRT2;
      const dirs: Pt[] = [unit([1, -1]), unit([1, 1]), unit([-1, 1]), unit([-1, -1])];
      const cuts = dirs.map((dir): [number, number] => [0, coupedCut(centre, dir, w, shape)[1]]);
      const notches: Pt[] = [[cx, cy - sd], [cx + sd, cy], [cx, cy + sd], [cx - sd, cy]];
      return {
        points: dirs.flatMap((dir, i): Pt[] => [notches[i], at(centre, dir, cuts[i][1], w), at(centre, dir, cuts[i][1], -w)]),
        edges: [A(0), null, A(0), A(1), null, A(1), A(2), null, A(2), A(3), null, A(3)],
        courses: dirs.map((dir, i) => arm(dir, cuts[i])),
      };
    }
    case 'chief': return {
      points: [[x0, y0], [x1, y0], [x1, f.chiefBase], [x0, f.chiefBase]], edges: [null, null, A(0), null], courses: [band([x0, f.chiefBase], [1, 0])],
    };
    // each side laid out from the point, clear of the other by as much as their angle there needs; a lined pile, one throughout and one
    // to be turned upside down run off the top (an inverted pile issues from the base, whatever its shape)
    case 'pile': {
      const [left, right, drawnPoint] = f.pile;
      const point: Pt = throughout ? [drawnPoint[0], edgeAt(spec.mods.includes('inverted') ? f.box.y0 : f.box.y1)] : drawnPoint;
      const sides = [unit([left[0] - point[0], left[1] - point[1]]), unit([right[0] - point[0], right[1] - point[1]])];
      const half = Math.acos(sides[0][0] * sides[1][0] + sides[0][1] * sides[1][1]) / 2;
      const courses = sides.map((dir): Course => ({ origin: point, dir, junction: 1 / Math.tan(half), plus: 'outward', cut: null }));
      // its corners on the top of the shape, or past it (far enough to lie past the base once turned over)
      const past = (dir: Pt): Pt => [point[0] + (dir[0] * (y0 - point[1])) / dir[1], y0];
      const corners = spec.lines.a !== 'plain' || spec.mods.includes('inverted') ? sides.map(past) : [left, right];
      return { points: [corners[0], corners[1], point], edges: [null, A(1), A(0)], courses };
    }
    case 'bordure': case 'orle': case 'tressure': case 'flaunches': case 'gore': return null;
    // its upper edge laid like a chief's lower one
    case 'base': {
      const top = baseTop(f);
      return { points: [[x0, top], [x1, top], [x1, y1], [x0, y1]], edges: [A(0), null, null, null], courses: [band([x0, top], [1, 0])] };
    }
    // ployé, and it takes no line
    case 'point': {
      const points = pointPoints(f);
      return { points, edges: points.map(() => null), courses: [] };
    }
    // its two inner edges laid out from the corner where they meet, each with its features outward (as a pile's sides)
    case 'canton': case 'quarter': {
      const share = cornerShare(spec.type, frame.shape);
      const corner: Pt = [f.box.x0 + share * (f.box.x1 - f.box.x0), f.box.y0 + share * (f.box.y1 - f.box.y0)];
      const from = (dir: Pt): Course => ({ origin: corner, dir, junction: 1, plus: 'outward', cut: null });
      return { points: [[x0, y0], [corner[0], y0], corner, [x0, corner[1]]], edges: [null, A(0), A(1), null], courses: [from([0, -1]), from([-1, 0])] };
    }
    // from the dexter chief corner of the box to the fess point, and across to the dexter flank: both edges laid out from the fess point
    case 'gyron': {
      const point: Pt = [frame.centre.x, frame.centre.y];
      const up = unit([f.box.x0 - point[0], f.box.y0 - point[1]]);
      const far: Pt = [x0, point[1] + (up[1] * (x0 - point[0])) / up[0]];
      const half = Math.acos(-up[0]) / 2;
      const from = (dir: Pt): Course => ({ origin: point, dir, junction: 1 / Math.tan(half), plus: 'outward', cut: null });
      return { points: [far, point, [x0, point[1]]], edges: [A(0), A(1), null], courses: [from(up), from([-1, 0])] };
    }
    // cut off by a straight line from the dexter flank to the base beyond its middle; it takes no line
    case 'point-dexter': return sidePoint(f);
    case 'point-sinister': return mirrored(sidePoint(f), frame.centre.x);
    default: return notSupported({ category: 'ordinary', detail: spec.type });
  }
}

/** Twice the signed area of a polygon: positive when it runs clockwise on the page (y down). */
function signedArea(points: readonly Pt[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) area += points[i][0] * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * points[i][1];
  return area;
}

/** How far along a course a point lies. */
const along = (course: Course, [x, y]: Pt): number => (x - course.origin[0]) * course.dir[0] + (y - course.origin[1]) * course.dir[1];

/** The longest a course runs: past any shape from any origin. */
const COURSE_REACH = 400;

/**
 * How an outline other than the body's (a cotise's edge) draws its lines: laid on the body's outline
 * (`laidOn`), so that its periods line up with the body's; cut as deep as on a band `width` wide; a mirrored profile's + side turned
 * in (`facing` −1) on a cotise's edge toward the body, so that both edges of the cotise point out of it.
 */
interface Laying { readonly laidOn: Outline; readonly width: number; readonly facing: 1 | -1 }

/**
 * The runs each edge of an outline is drawn with (null: straight). The edges along one course share its period and anchor, fitted to the
 * chord of the course the shape shows (RULES-C §A.4); a band's two edges pair as their profile says (`pairing`: mirrored ones opposed, the
 * others in phase), each edge's features run off the shape at its ends, and a mirrored profile's + side is the edge's outside.
 */
function edgeRuns(spec: OrdinarySpec, outline: Outline, shape: readonly Pt[], laying: Laying = { laidOn: outline, width: drawnWidth(spec), facing: 1 }): (EdgeRun | null)[] {
  const { points, edges, courses } = outline;
  const { laidOn, width, facing } = laying;
  const turn = signedArea(points) > 0 ? 1 : -1;
  const ends = (o: Outline, i: number): [Pt, Pt] => [o.points[i], o.points[(i + 1) % o.points.length]];
  const laid = new Map<string, { period: number; anchor: number } | null>();
  /** The period and anchor of a line along a course. */
  const lay = (index: number, line: ComplexLine, depth: number): { period: number; anchor: number } | null => {
    const key = `${index}|${line}`;
    if (laid.has(key)) return laid.get(key) ?? null;
    const course = courses[index];
    const [c0, c1] = course.cut ?? visibleSpan(course.origin, [course.origin[0] + course.dir[0] * COURSE_REACH, course.origin[1] + course.dir[1] * COURSE_REACH], shape) ?? [0, 0];
    let out: { period: number; anchor: number } | null = null;
    if (course.junction === null) {
      if (c1 > c0) out = { period: fitPeriod(line, c1 - c0, 1), anchor: (c0 + c1) / 2 };
    } else {
      // the first period starts clear of the junction on the edge (of the outline it is laid on) whose inner end lies nearest it
      const start = Math.min(...laidOn.edges.flatMap((e, i) => (e?.course === index && spec.lines[e.line] === line ? [Math.min(...ends(laidOn, i).map((p) => along(course, p)))] : []))) + depth * course.junction;
      if (c1 > start) {
        // a profile that overhangs its period (dovetails, nebuly) starts that much further out
        const overhang = -Math.min(0, PROFILE_REACH[line][0]);
        const period = fitPeriod(line, (c1 - start) / (1 + overhang), 1);
        out = { period, anchor: start + (overhang + 0.5) * period };
      }
    }
    laid.set(key, out);
    return out;
  };
  return edges.map((e, i): EdgeRun | null => {
    if (e === null) return null;
    const line = spec.lines[e.line];
    if (line === 'plain') return null;
    const course = courses[e.course];
    const [from, to] = ends(outline, i);
    const visible = visibleSpan(from, to, shape);
    if (visible === null) return null;
    const depth = edgeDepth(line, width);
    const sFrom = along(course, from), sTo = along(course, to), inner = Math.min(sFrom, sTo);
    const forward = sTo >= sFrom ? 1 : -1;
    const [v0, v1] = [sFrom + forward * visible[0], sFrom + forward * visible[1]].sort((p, q) => p - q);
    // a single feature on a limb bows each edge from its own inner end to where it leaves the shape
    const single = LINE_PROFILE[line].kind === 'single';
    const fit = single && course.junction !== null ? { period: v1 - inner, anchor: (inner + v1) / 2 } : lay(e.course, line, depth);
    if (fit === null) return null;
    // a couped edge's features stop at its straight ends; elsewhere they run off the shape
    const span: [number, number] = course.junction === null ? (course.cut ? [v0, v1] : [v0 - fit.period, v1 + fit.period])
      : single ? [inner, v1] : [inner + depth * course.junction, course.cut ? course.cut[1] : v1 + fit.period];
    // the side of the course's direction the edge's outside lies on: its left when it runs along the course round a clockwise outline
    const outward: 1 | -1 = turn * forward > 0 ? 1 : -1;
    const side = LINE_PROFILE[line].pairing === 'mirrored' || course.plus === 'outward' ? (outward * facing > 0 ? 1 : -1) : course.plus;
    // a bow on a limb rises as far for its length as a fess's for the shield's width, so a limb's two edges curve alike
    const drawn = single && course.junction !== null ? (depth * fit.period) / 100 : depth;
    return runAlong({ origin: course.origin, dir: course.dir, run: { line, side, depth: drawn, period: fit.period, anchor: fit.anchor, span } }, from, to);
  });
}

/** A closed outline through the points, its edges drawn with the runs (null: straight); a run on the closing edge makes it an explicit edge. */
function contourOf(points: readonly Pt[], runs: readonly (EdgeRun | null)[]): Contour {
  const [start, ...rest] = points;
  const edges = rest.map((to, i): ContourEdge => ({ via: [], to, run: runs[i] }));
  const closing = runs[points.length - 1];
  return { start, edges: closing ? [...edges, { via: [], to: start, run: closing }] : edges };
}

/** The bordure's inner edge as a ring of points (a flattened curve's repeated last point dropped), clockwise or not as the shape draws it. */
function insetRing(shape: FieldShape): Pt[] {
  const inset = pathPolygon(shapeFrame(shape).inset);
  const ring = inset.filter((p, i) => i === 0 || p[0] !== inset[i - 1][0] || p[1] !== inset[i - 1][1]);
  if (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  return ring;
}

/** The ring started at its highest point on the vertical through x (put in when it falls between two points), so its periods are laid out from the top middle. */
function ringFromTop(ring: readonly Pt[], x: number): Pt[] {
  let best: { i: number; p: Pt } | null = null;
  ring.forEach(([ax, ay], i) => {
    const [bx, by] = ring[(i + 1) % ring.length];
    if (ax === bx ? ax !== x : (ax - x) * (bx - x) > 0) return;
    const y = ax === bx ? Math.min(ay, by) : ay + ((by - ay) * (x - ax)) / (bx - ax);
    if (best === null || y < best.p[1]) best = { i, p: [x, y] };
  });
  if (best === null) return [...ring];
  const { i, p } = best as { i: number; p: Pt };
  const after = [...ring.slice(i + 1), ...ring.slice(0, i + 1)];
  return after[after.length - 1][0] === p[0] && after[after.length - 1][1] === p[1] ? [p, ...after.slice(0, -1)] : after[0][0] === p[0] && after[0][1] === p[1] ? after : [p, ...after];
}

/** How long a polyline is (a ring: with its closing edge). */
function polylineLength(points: readonly Pt[], ring: boolean): number {
  const all = ring ? [...points, points[0]] : points;
  let length = 0;
  for (let i = 1; i < all.length; i++) length += Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]);
  return length;
}

/** The side of a ring's way round that is its outside: the left of a ring run clockwise on the page. */
const outsideOf = (ring: readonly Pt[]): 1 | -1 => (signedArea(ring) > 0 ? 1 : -1);

/**
 * A ring drawn with a line all the way round from its first point, its + side on `side` of the way it runs, whole periods: `periods` of
 * them when given (so two rings of one band keep in step), else as many as fit its length. Straight when the line is plain.
 */
function ringPath(ring: readonly Pt[], line: Line, side: 1 | -1, depth: number, periods: number | null): string {
  if (line === 'plain') return pts(ring);
  const length = polylineLength(ring, true);
  const period = periods === null ? fitPeriod(line, length, 1) : length / periods;
  const run: EdgeRun = { line, side, depth, period, anchor: period / 2, span: [0, length] };
  return contourPath({ start: ring[0], edges: [{ via: ring.slice(1), to: ring[0], run }] });
}

/** A bordure's body: the shape's outline and, inside it, its inset — drawn with the line all the way round, its features toward the field, whole periods from the top middle. */
function bordureBody(spec: OrdinarySpec, frame: OrdinaryFrame): string {
  const f = shapeFrame(frame.shape);
  const line = spec.lines.a;
  if (line === 'plain') return f.outline + f.inset;
  const ring = ringFromTop(insetRing(frame.shape), frame.centre.x);
  return f.outline + ringPath(ring, line, outsideOf(ring) === 1 ? -1 : 1, edgeDepth(line, BORDURE_WIDTH), null);
}

/**
 * How far inside the bordure's inner edge (the shape's inset: 10 in from the outline, the lozenge's 8) an orle's outer and inner edges lie:
 * on the heater 12 and 20 in from the outline, so that the orle and the field either side of it are about as wide (RULES-C §C.3, Draco de
 * Euruic 09/2006). Every shape's orle follows its own inset.
 */
const ORLE_EDGES = [2, 10] as const;
/** A tressure is a narrow orle: each of its rings this wide, the first this far inside the bordure's inner edge, the next (double, triple) as far again inside it. */
const TRESSURE_WIDTH = 3;
const TRESSURE_START = 3;

/** Where segments p→q and r→s cross (not at their ends), or null. */
function crossing(p: Pt, q: Pt, r: Pt, s: Pt): Pt | null {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-12) return null;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9 ? [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])] : null;
}

/**
 * A ring with the small loops cut out that moving a curved ring inward makes where it bends more sharply than it is moved (the heater's
 * foot): each loop between two edges that cross is replaced by the point where they cross, the shorter way round.
 */
function withoutLoops(ring: readonly Pt[]): Pt[] {
  let out = [...ring];
  for (let changed = true; changed;) {
    changed = false;
    const n = out.length;
    for (let i = 0; i < n && !changed; i++) {
      for (let j = i + 2; j < n && !changed; j++) {
        if (i === 0 && j === n - 1) continue;
        const at = crossing(out[i], out[(i + 1) % n], out[j], out[(j + 1) % n]);
        if (!at) continue;
        // the loop is the run of points between the two edges, or the rest of the ring, whichever is shorter
        out = j - i <= n / 2 ? [...out.slice(0, i + 1), at, ...out.slice(j + 1)] : [at, ...out.slice(i + 1, j + 1)];
        changed = true;
      }
    }
  }
  return out;
}

/** The bands of an orle (one) or a tressure (one, two or three), each as its outer and inner edge: the shape's inset moved in, rings started at the top middle. */
function ringBands(spec: OrdinarySpec, frame: OrdinaryFrame): Array<{ outer: Pt[]; inner: Pt[]; width: number }> {
  const inset = insetRing(frame.shape);
  const inBy = (by: number) => ringFromTop(withoutLoops(offsetPolygon(inset, inset.map(() => -by))), frame.centre.x);
  if (spec.type === 'orle') return [{ outer: inBy(ORLE_EDGES[0]), inner: inBy(ORLE_EDGES[1]), width: ORLE_EDGES[1] - ORLE_EDGES[0] }];
  return Array.from({ length: spec.count }, (_, k) => {
    const from = TRESSURE_START + 2 * k * TRESSURE_WIDTH;
    return { outer: inBy(from), inner: inBy(from + TRESSURE_WIDTH), width: TRESSURE_WIDTH };
  });
}

/**
 * An orle's or tressure's body: each band's outer edge with line `a`, its inner edge with `b` (RULES-C §0, L3), both edges of a band laid
 * from the top middle with as many periods as its outer edge takes; a mirrored profile's features out of the band on both edges, the
 * others in step (a wavy orle snakes).
 */
function ringBandsBody(spec: OrdinarySpec, frame: OrdinaryFrame): string {
  return ringBands(spec, frame).map(({ outer, inner, width }) => {
    const { a, b } = spec.lines;
    const out = outsideOf(outer);
    const side = (line: Line, edge: 'outer' | 'inner'): 1 | -1 => (line !== 'plain' && LINE_PROFILE[line].pairing === 'mirrored' && edge === 'inner' ? (out === 1 ? -1 : 1) : out);
    const periods = a === 'plain' ? null : Math.max(1, Math.round(polylineLength(outer, true) / fitPeriod(a, polylineLength(outer, true), 1)));
    const depth = (line: Line) => (line === 'plain' ? 0 : edgeDepth(line, width));
    return ringPath(outer, a, side(a, 'outer'), depth(a), periods) + ringPath(inner, b, side(b, 'inner'), depth(b), b === a ? periods : null);
  }).join('');
}

/** How far each flaunch bulges into the field, at the middle of its height: a quarter of the shape's box across. */
const FLAUNCH_REACH = 1 / 4;
/** How many straight pieces a flaunch's arc, and each curve of a gore, is flattened into. */
const ARC_STEPS = 32;

/**
 * A piece of the flaunches or gore: its curves, each flattened from its first point to its last (the next starting where it ends), and
 * the points round the field's edge that close it.
 */
interface CurvedPiece { readonly curves: readonly (readonly Pt[])[]; readonly closing: readonly Pt[] }

/** The dexter flaunch: a circular arc from the top corner of the shape's box to its foot, bulging FLAUNCH_REACH of its width at mid-height, closed beyond the dexter flank. */
function flaunchPiece(f: ShapeFrame): CurvedPiece {
  const { x0, y0, x1, y1 } = f.box;
  const half = (y1 - y0) / 2, sag = FLAUNCH_REACH * (x1 - x0);
  const r = (half * half + sag * sag) / (2 * sag), cx = x0 + sag - r, cy = (y0 + y1) / 2, swing = Math.asin(half / r);
  const arc = Array.from({ length: ARC_STEPS + 1 }, (_, i): Pt => {
    const t = -swing + (2 * swing * i) / ARC_STEPS;
    return i === 0 ? [x0, y0] : i === ARC_STEPS ? [x0, y1] : [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
  return { curves: [arc], closing: [[OVER.x0, y1], [OVER.x0, y0]] };
}

/** A quadratic curve from `a` to `b` bowed toward `control`, flattened. */
function quadratic(a: Pt, control: Pt, b: Pt): Pt[] {
  return Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
    const t = i / ARC_STEPS, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * control[0] + t * t * b[0], u * u * a[1] + 2 * u * t * control[1] + t * t * b[1]];
  });
}

/**
 * The dexter gore: a curve from the dexter chief corner of the shape's box to the fess point, bowed toward the dexter base, and another
 * from there to the foot of the shape under it, bowed toward the dexter flank — a curved wedge from the dexter side, closed beyond it.
 */
function gorePiece(f: ShapeFrame, frame: OrdinaryFrame): CurvedPiece {
  const { x0, y0, y1 } = f.box;
  const { x: cx, y: cy } = frame.centre;
  const corner: Pt = [x0, y0], point: Pt = [cx, cy], foot: Pt = [cx, y1];
  const curves = [quadratic(corner, [x0 + 0.55 * (cx - x0), y0 + 0.9 * (cy - y0)], point), quadratic(point, [cx - 0.4 * (cx - x0), (cy + y1) / 2], foot)];
  return { curves, closing: [[cx, OVER.y1], [OVER.x0, OVER.y1], [OVER.x0, y0]] };
}

/** How wide a flaunch and a gore are at most, across their curved edges: what caps how deep a line on them is cut. */
const CURVED_WIDTH: Partial<Record<OrdinaryType, number>> = { flaunches: 100 * FLAUNCH_REACH, gore: 2 * BAND_HALF };

/** The pieces of the flaunches (both) or the gore (dexter, or sinister: mirrored about the middle of the shape), each with the side of its curves' way that faces the field. */
function curvedPieces(spec: OrdinarySpec, frame: OrdinaryFrame): Array<{ piece: CurvedPiece; side: 1 | -1 }> {
  const f = shapeFrame(frame.shape);
  const dexter = spec.type === 'flaunches' ? flaunchPiece(f) : gorePiece(f, frame);
  const flip = ([x, y]: Pt): Pt => [2 * frame.centre.x - x, y];
  // each curve runs down the shape: the field lies to its left on the dexter side, to its right once mirrored
  const sinister = { piece: { curves: dexter.curves.map((c) => c.map(flip)), closing: dexter.closing.map(flip) }, side: -1 as const };
  if (spec.type === 'flaunches') return [{ piece: dexter, side: 1 }, sinister];
  return spec.mods.includes('sinister') ? [sinister] : [{ piece: dexter, side: 1 }];
}

/** A piece's points in order round it: its curves (each one's first point dropped after the first) and its closing points. */
const piecePoints = ({ curves, closing }: CurvedPiece): Pt[] => [...curves.flatMap((c, i) => (i === 0 ? c : c.slice(1))), ...closing];

/**
 * The flaunches' or gore's body: each curve drawn with the line (RULES-C §C.3: on the flaunches' inner curves, on both of the gore's), whole
 * periods fitted to it, its features turned toward the field for a mirrored profile and mirrored from one flaunch to the other.
 */
function curvedBody(spec: OrdinarySpec, frame: OrdinaryFrame): string {
  const line = spec.lines.a;
  return curvedPieces(spec, frame).map(({ piece, side }) => {
    if (line === 'plain') return pts(piecePoints(piece));
    const edges = piece.curves.map((curve): ContourEdge => {
      const length = polylineLength(curve, false), period = fitPeriod(line, length, 1);
      const run: EdgeRun = { line, side, depth: edgeDepth(line, CURVED_WIDTH[spec.type]!), period, anchor: length / 2, span: [0, length] };
      return { via: curve.slice(1, -1), to: curve[curve.length - 1], run };
    });
    return contourPath({ start: piece.curves[0][0], edges: [...edges, ...piece.closing.map((to): ContourEdge => ({ via: [], to, run: null }))] });
  }).join('');
}

/** The ordinaries drawn as rings, filled even-odd: the bordure, the orle and the tressure. */
const RINGS: readonly OrdinaryType[] = ['bordure', 'orle', 'tressure'];

/** The body of an ordinary with no straight outline. */
function curvedOrdinaryBody(spec: OrdinarySpec, frame: OrdinaryFrame): string {
  if (spec.type === 'bordure') return bordureBody(spec, frame);
  return spec.type === 'orle' || spec.type === 'tressure' ? ringBandsBody(spec, frame) : curvedBody(spec, frame);
}

/** An outline drawn as one contour, its edges with the spec's lines (laid as `laying` says); straight when the spec's lines are plain. */
function linedPath(spec: OrdinarySpec, outline: Outline, shape: readonly Pt[], laying?: Laying): string {
  const plain = spec.lines.a === 'plain' && spec.lines.b === 'plain';
  return contourPath(contourOf(outline.points, plain ? outline.edges.map(() => null) : edgeRuns(spec, outline, shape, laying)));
}

/** The outline with each edge moved `by[i]` outward (negative: inward), keeping its lines and the courses they are laid on. */
const moved = (outline: Outline, by: readonly number[]): Outline => ({ ...outline, points: offsetPolygon(outline.points, by) });

/**
 * The body path of an ordinary, its chevron raised `lift` above its usual place. A voided one is its outline and its voiding, straight-edged,
 * VOIDED_BORDER inside every edge the shape shows and past what the edge's line cuts in (RULES-C §D.3: the outline stays unbroken; a border
 * that followed a square or overhanging line would break at its risers).
 */
function bodyOf(spec: OrdinarySpec, frame: OrdinaryFrame, outline: Outline | null, shape: readonly Pt[]): string {
  if (!outline) return curvedOrdinaryBody(spec, frame);
  const body = linedPath(spec, outline, shape);
  if (!spec.mods.includes('voided')) return body;
  const width = drawnWidth(spec);
  const inset = outline.points.map((p, i) => {
    const e = outline.edges[i];
    return visibleSpan(p, outline.points[(i + 1) % outline.points.length], shape) ? -VOIDED_BORDER - (e ? inwardReach(spec.lines[e.line], width) : 0) : 0;
  });
  return body + pts(offsetPolygon(outline.points, inset));
}

/** How far out from each edge's straight line the body's lines reach (none on the edges the shape cuts off). */
const bodyReach = (spec: OrdinarySpec, outline: Outline): number[] =>
  outline.edges.map((e) => (e === null ? 0 : edgeReach(spec.lines[e.line], drawnWidth(spec))));

/** Where each cotise starts: a cotise's width beyond the reach of the body's line, or beyond the straight edge when the cotise bows with the band. */
function cotiseBase(spec: OrdinarySpec, outline: Outline, cotised: NonNullable<OrdinarySpec['cotised']>): number[] {
  const reach = bodyReach(spec, outline);
  return outline.edges.map((e, i) => {
    if (e === null) return 0;
    const line = spec.lines[e.line];
    return line !== 'plain' && line === cotised.line && LINE_PROFILE[line].kind === 'single' ? 0 : reach[i];
  });
}

/** How wide each cotise is: a quarter of the band. */
const cotiseWidth = (spec: OrdinarySpec): number => drawnWidth(spec) * COTISE_SHARE;

/**
 * How much further from its middle line than a plain one's edges a trimmed ordinary reaches — its outermost cotise, or its fimbriation —
 * across its band (a cotised band is narrower, which gives some back): what charges set beside it make room for. 0 untrimmed.
 */
export function trimGrowth(spec: OrdinarySpec): number {
  const plain = PLAIN_WIDTH[spec.type as keyof typeof PLAIN_WIDTH];
  if (plain === undefined) return 0;
  const { cotised } = spec;
  const cotises = cotised ? plain * cotisedScale(spec) / 2 + edgeReach(spec.lines.a, drawnWidth(spec)) + 2 * cotised.count * cotiseWidth(spec) - plain / 2 : 0;
  return Math.max(0, cotises) + (spec.fimbriated ? FIMBRIATION_WIDTH : 0);
}

/**
 * The cotises of a band: `count` thin bands beside each long edge, a cotise's width apart and from the band, each with the cotises' line on
 * both its edges (laid on the band's courses, so its periods line up with the band's; a mirrored profile pointing out of the cotise on both
 * edges), mitred where the edges of a chevron, cross, saltire or pile meet (RULES-C §D.5). Null when the spec isn't cotised.
 */
function cotisesOf(spec: OrdinarySpec, outline: Outline, shape: readonly Pt[]): string | null {
  const { cotised } = spec;
  if (!cotised) return null;
  const lined: OrdinarySpec = { ...spec, lines: { a: cotised.line, b: cotised.line } };
  const base = cotiseBase(spec, outline, cotised), w = cotiseWidth(spec);
  const at = (k: number) => outline.edges.map((e, i) => (e === null ? 0 : base[i] + k * w));
  return Array.from({ length: cotised.count }, (_, i) =>
    linedPath(lined, moved(outline, at(2 * i + 2)), shape, { laidOn: outline, width: w, facing: 1 })
    + linedPath(lined, moved(outline, at(2 * i + 1)), shape, { laidOn: outline, width: w, facing: -1 })).join('');
}

/**
 * The fimbriation of an ordinary: its body grown FIMBRIATION_WIDTH all round, following its lines (RULES-C §D.4) — every edge of the drawn
 * outline, battlements' sides and all, moved out; null when it isn't fimbriated.
 */
function fimbriationOf(spec: OrdinarySpec, outline: Outline, body: string): string | null {
  if (!spec.fimbriated) return null;
  if (spec.lines.a === 'plain' && spec.lines.b === 'plain') return pts(offsetPolygon(outline.points, outline.points.map(() => FIMBRIATION_WIDTH)));
  const ring = pathRings(body)[0].filter((p, i, all) => { const q = all[(i + 1) % all.length]; return p[0] !== q[0] || p[1] !== q[1]; });
  const grown = offsetPolygon(ring, ring.map(() => FIMBRIATION_WIDTH));
  const limit = MITRE_LIMIT * FIMBRIATION_WIDTH;
  return pts(grown.map(([x, y], i): Pt => {
    const [px, py] = ring[i], far = Math.hypot(x - px, y - py);
    return far > limit ? [px + ((x - px) * limit) / far, py + ((y - py) * limit) / far] : [x, y];
  }));
}

/** The polygon (each corner listed once) with edge i moved `by[i]` outward (negative: inward), each corner where its two moved edges meet. */
function offsetPolygon(points: readonly Pt[], by: readonly number[]): Pt[] {
  const n = points.length;
  // The outward normal of each edge: the polygon runs clockwise on the page when its signed area is positive.
  const turn = signedArea(points) > 0 ? 1 : -1;
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
 * (`inner`: moved in) — what layout keeps charges clear of or inside, never the toothed body. With straight lines, the body's rings.
 */
function envelopeOf(spec: OrdinarySpec, frame: OrdinaryFrame, outline: Outline | null, body: string): OrdinaryGeometry['envelope'] {
  if (spec.type === 'orle' || spec.type === 'tressure') return ringBandsEnvelope(spec, frame, body);
  // plain, or bowed (enarched, ployé): the body itself, curves flattened — a bow moves the band rather than cutting into it
  const straight = isStraightLine(spec.lines.a) && isStraightLine(spec.lines.b);
  const trimmed = outline !== null && (spec.cotised !== null || spec.fimbriated);
  if (straight && !trimmed) return { outer: pathRings(body), inner: pathRings(body) };
  if (!outline && spec.type !== 'bordure') return curvedEnvelope(spec, frame);
  const width = drawnWidth(spec);
  if (!outline) {
    // The bordure's line runs along its inner edge: the inset moves inward (the ring grows) for `outer`, outward for `inner`.
    const ring = pathPolygon(shapeFrame(frame.shape).outline);
    const corners = insetRing(frame.shape);
    const reach = edgeReach(spec.lines.a, width);
    return { outer: [ring, offsetPolygon(corners, corners.map(() => -reach))], inner: [ring, offsetPolygon(corners, corners.map(() => reach))] };
  }
  const reach = bodyReach(spec, outline);
  // the fimbriation round every edge, the outermost cotise and its line beside each long edge
  const { cotised } = spec;
  const base = cotised && cotiseBase(spec, outline, cotised);
  const outer = outline.edges.map((e, i) => Math.max(
    reach[i] + (spec.fimbriated ? FIMBRIATION_WIDTH : 0),
    cotised && base && e !== null ? base[i] + 2 * cotised.count * cotiseWidth(spec) + edgeReach(cotised.line, cotiseWidth(spec)) : 0,
  ));
  return { outer: [offsetPolygon(outline.points, outer)], inner: straight ? pathRings(body) : [offsetPolygon(outline.points, reach.map((r) => -r))] };
}

/**
 * Where the rows of the sample grid cross a set of rings, as `pointInPolygon` computes each crossing: a point of a row lies in the rings
 * (even-odd over all of them, as `pointInPath`) when an odd number of the crossings lie to its right.
 */
function rowCrossings(rings: readonly Pt[][], y: number): number[] {
  const xs: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  return xs;
}

/** The grid points `step` apart (offset by one) inside both ring sets, column by column: one pass over the rings per row, not per point. */
function gridInside(a: readonly Pt[][], b: readonly Pt[][], step: number = SAMPLE_STEP): Pt[] {
  const rows: Array<{ y: number; a: number[]; b: number[] }> = [];
  for (let y = 1; y < 120; y += step) rows.push({ y, a: rowCrossings(a, y), b: rowCrossings(b, y) });
  const inside = (xs: readonly number[], x: number) => xs.filter((c) => x < c).length % 2 === 1;
  const out: Pt[] = [];
  for (let x = 1; x < 100; x += step) for (const row of rows) if (inside(row.a, x) && inside(row.b, x)) out.push([x, row.y]);
  return out;
}

/** Grid step of the points a trim is sampled at: fine enough to catch the 2-wide fimbriation and the narrowest cotise. */
const TRIM_SAMPLE_STEP = 2;

const geometryCache = new Map<string, OrdinaryGeometry>();

/** How far out a frame round the field is drawn: past every shape. */
const FAR = 1000;

/** The field outside a ring as one polygon: a frame far round the shape with the ring cut out of it, through a slit down from the top to the ring's first point (its top middle). */
function outsideRing(ring: readonly Pt[]): Pt[] {
  const [x] = ring[0];
  return [[x, -FAR], [FAR, -FAR], [FAR, FAR], [-FAR, FAR], [-FAR, -FAR], [x, -FAR], ring[0], ...ring.slice(1).reverse(), ring[0]];
}

/**
 * An orle's or tressure's envelopes: `outer` all of the field outside its innermost edge (moved in by what that edge's line reaches), as
 * one polygon (`outsideRing`), so that charges keep inside the orle; `inner` each band's rings, moved into the band by their lines.
 */
function ringBandsEnvelope(spec: OrdinarySpec, frame: OrdinaryFrame, body: string): OrdinaryGeometry['envelope'] {
  const bands = ringBands(spec, frame);
  const moved = (ring: readonly Pt[], by: number) => withoutLoops(offsetPolygon(ring, ring.map(() => by)));
  const last = bands[bands.length - 1];
  const outer = [outsideRing(moved(last.inner, -edgeReach(spec.lines.b, last.width)))];
  if (isStraightLine(spec.lines.a) && isStraightLine(spec.lines.b)) return { outer, inner: pathRings(body) };
  return { outer, inner: bands.flatMap(({ outer: o, inner: i, width }) => [moved(o, -edgeReach(spec.lines.a, width)), moved(i, edgeReach(spec.lines.b, width))]) };
}

/** The flaunches' or gore's envelopes with a line: each piece with its curve moved out toward the field (`outer`) or into the piece (`inner`) by what the line reaches. */
function curvedEnvelope(spec: OrdinarySpec, frame: OrdinaryFrame): OrdinaryGeometry['envelope'] {
  const reach = edgeReach(spec.lines.a, CURVED_WIDTH[spec.type]!);
  const pieces = curvedPieces(spec, frame).map(({ piece }) => ({ points: piecePoints(piece), curved: piecePoints(piece).length - piece.closing.length - 1 }));
  const grown = (by: number) => pieces.map(({ points, curved }) => offsetPolygon(points, points.map((_, i) => (i < curved ? by : 0))));
  return { outer: grown(reach), inner: grown(-reach) };
}

/** The peripherals whose centre (where a division of one runs through it) is the middle of what the shape shows of them. */
const IN_A_CORNER_OR_BASE: readonly OrdinaryType[] = ['base', 'point', 'canton', 'quarter', 'gyron', 'gore', 'point-dexter', 'point-sinister'];

/** The mean of some points. */
const middleOf = (points: readonly Pt[]): Point => ({ x: points.reduce((a, [x]) => a + x, 0) / points.length, y: points.reduce((a, [, y]) => a + y, 0) / points.length });

function build(spec: OrdinarySpec, frame: OrdinaryFrame, lift: number): OrdinaryGeometry {
  const key = JSON.stringify([spec, frame, lift]);
  let g = geometryCache.get(key);
  if (!g) {
    const f = shapeFrame(frame.shape);
    const shape = pathPolygon(f.outline);
    const drawn = outlineOf(spec, frame, lift);
    const body = bodyOf(spec, frame, drawn, shape);
    const rings = pathRings(body), outline = pathRings(f.outline);
    const points = rings.flat(), xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    // what lies under a base or point pointed doesn't show
    const above = (grid: Pt[]) => grid.filter(([, y]) => y < frame.bottom);
    const samples = above(gridInside(outline, rings));
    const fimbriation = drawn && fimbriationOf(spec, drawn, body), cotises = drawn && cotisesOf(spec, drawn, shape);
    const box = { x0: Math.max(f.box.x0, Math.min(...xs)), y0: Math.max(f.box.y0, Math.min(...ys)), x1: Math.min(f.box.x1, Math.max(...xs)), y1: Math.min(f.box.y1, Math.max(...ys)) };
    g = {
      body,
      fillRule: RINGS.includes(spec.type) || spec.mods.includes('voided') ? 'evenodd' : 'nonzero',
      // the fimbriation shows where it lies outside the body
      fimbriation: fimbriation ? { d: fimbriation, fillRule: 'nonzero', samples: above(gridInside(outline, [...pathRings(fimbriation), ...rings], TRIM_SAMPLE_STEP)) } : null,
      cotises: cotises ? { d: cotises, fillRule: 'evenodd', samples: above(gridInside(outline, pathRings(cotises), TRIM_SAMPLE_STEP)) } : null,
      envelope: envelopeOf(spec, frame, drawn, body),
      centre: spec.type === 'chief' ? { x: frame.centre.x, y: f.chiefBase - CHIEF_HEIGHT / 2 }
        : IN_A_CORNER_OR_BASE.includes(spec.type) ? middleOf(samples) : ordinaryCentre(spec, frame),
      box,
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

/** Whether an ordinary of this paint lies astride its field's line: a counterchanged chevron, neither turned, shortened, moved nor trimmed, on a field per chevron. */
export const liesAstride = (field: Paint, spec: OrdinarySpec, paint: Paint): boolean =>
  spec.type === 'chevron' && spec.mods.length === 0 && spec.cotised === null && !spec.fimbriated && paint.k === 'counterchanged' && field.k === 'divided' && field.division === 'per-chevron';

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

/** The parts of a counterchanged trim of an ordinary on the field (its fimbriation, its cotises): the regions it lies on. */
export function counterchangedTrimParts(field: Paint, trim: OrdinaryTrim, shape: FieldShape): CounterchangePart[] {
  return counterchangedParts(field, trim.samples, shape);
}

/** Whether a division through the ordinary's centre runs through it, so that both its parts show. */
export function divisionCutsOrdinary(division: Division, spec: OrdinarySpec): boolean {
  const { centre, samples } = ordinaryGeometry(spec, defaultOrdinaryFrame(CANONICAL_SHAPE));
  const first = samples.filter(([x, y]) => inFirstPart(division, centre, x, y)).length;
  return first > 0 && first < samples.length;
}
