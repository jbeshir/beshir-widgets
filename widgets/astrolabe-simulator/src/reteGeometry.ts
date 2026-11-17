/**
 * Pierced-rete construction (Nuremberg/Hartmann style: rings, straight bars
 * and circular arcs). Everything is built in the rete's own catalogue frame
 * (the same frame as `project` / `eclipticPoint`), as polygons and circles of
 * one compound path filled with the `nonzero` rule:
 *
 *   - solid pieces (ring outlines, bars, pointers) wind positively;
 *   - the holes of the Capricorn and ecliptic rings wind negatively.
 *
 * Overlapping solids therefore union cleanly and the open gaps stay open,
 * without a mask or a clip on the rotating layer.
 */
import { capricornRadius, eclipticCircle, equatorRadius, project, type Point } from './geometry';

export interface ReteDimensions {
  rim: number;
  capricornWidth: number;
  eclipticWidth: number;
  barWidth: number;
  equatorWidth: number;
  hubRadius: number;
}

export function reteDimensions(R: number): ReteDimensions {
  return {
    rim: capricornRadius(R),
    capricornWidth: R * 0.047,
    eclipticWidth: R * 0.13,
    barWidth: R * 0.034,
    equatorWidth: R * 0.03,
    hubRadius: R * 0.075,
  };
}

/** The ecliptic band's inner (hole) circle: the ecliptic of a smaller reference radius. */
export function eclipticBandInner(R: number) {
  return eclipticCircle(R - reteDimensions(R).eclipticWidth);
}

type Structure =
  | { kind: 'circle'; cx: number; cy: number; r: number; from?: number; to?: number }
  | { kind: 'segment'; a: Point; b: Point };

/** Centre lines of the structural metal, used to anchor each star pointer. */
export function reteStructure(R: number): Structure[] {
  const d = reteDimensions(R);
  const outer = eclipticCircle(R);
  const inner = eclipticBandInner(R);
  const reach = d.rim - d.capricornWidth / 2;
  const equinoxY = Math.sqrt(outer.r ** 2 - outer.cx ** 2);
  return [
    { kind: 'circle', cx: 0, cy: 0, r: reach },
    { kind: 'circle', cx: (outer.cx + inner.cx) / 2, cy: 0, r: (outer.r + inner.r) / 2 },
    { kind: 'circle', cx: 0, cy: 0, r: equatorRadius(R), from: 0, to: 180 },
    { kind: 'circle', cx: 0, cy: 0, r: d.hubRadius / 2 },
    { kind: 'segment', a: { x: -reach, y: 0 }, b: { x: reach, y: 0 } },
    { kind: 'segment', a: { x: 0, y: -equinoxY }, b: { x: 0, y: equinoxY } },
  ];
}

/** Catalogue angle (right ascension convention) of a point: x = r·sinα, y = r·cosα. */
function raOf(x: number, y: number): number {
  return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
}

function nearestOn(structure: Structure, p: Point): Point {
  if (structure.kind === 'segment') {
    const { a, b } = structure;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return { x: a.x + t * dx, y: a.y + t * dy };
  }
  const { cx, cy, r } = structure;
  let angle = raOf(p.x - cx, p.y - cy);
  if (structure.from !== undefined && structure.to !== undefined) {
    if (angle < structure.from || angle > structure.to) {
      const toFrom = Math.min(Math.abs(angle - structure.from), 360 - Math.abs(angle - structure.from));
      const toTo = Math.min(Math.abs(angle - structure.to), 360 - Math.abs(angle - structure.to));
      angle = toFrom < toTo ? structure.from : structure.to;
    }
  }
  const radians = angle * Math.PI / 180;
  return { x: cx + r * Math.sin(radians), y: cy + r * Math.cos(radians) };
}

export function pointerBase(tip: Point, R: number): Point {
  let best: Point = { x: 0, y: 0 };
  let bestDistance = Infinity;
  for (const structure of reteStructure(R)) {
    const candidate = nearestOn(structure, tip);
    const distance = Math.hypot(candidate.x - tip.x, candidate.y - tip.y);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function signedArea(points: readonly Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function polygonPath(points: readonly Point[], positive = true): string {
  const ordered = (signedArea(points) > 0) === positive ? points : [...points].reverse();
  return `${ordered.map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')} Z`;
}

/** A full circle contour; sweep 1 winds positively in SVG's y-down space. */
function circlePath(cx: number, cy: number, r: number, positive: boolean): string {
  const sweep = positive ? 1 : 0;
  return `M${(cx + r).toFixed(2)} ${cy.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 1 ${sweep} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 1 ${sweep} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} Z`;
}

function barPath(a: Point, b: Point, width: number): string {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / length * width / 2;
  const ny = (b.x - a.x) / length * width / 2;
  return polygonPath([
    { x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny },
  ]);
}

function arcBandPath(r: number, width: number, fromRa: number, toRa: number): string {
  const steps = Math.ceil(Math.abs(toRa - fromRa) / 2);
  const along = (radius: number) => Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (fromRa + (toRa - fromRa) * index / steps) * Math.PI / 180;
    return { x: radius * Math.sin(angle), y: radius * Math.cos(angle) };
  });
  return polygonPath([...along(r + width / 2), ...along(r - width / 2).reverse()]);
}

/** Width of a named blade pointer (the name is engraved along it) and of an unnamed one. */
export const BLADE_WIDTH = 17;
const PLAIN_BLADE_WIDTH = 10;
const PLAIN_BLADE_LENGTH = 26;
/** Length of the point: from the star to where the blade reaches full width. */
const BLADE_POINT = 13;
/** Room left at the blade's tail end after the name. */
const BLADE_TAIL = 6;
const STEM_WIDTH = 6.4;
/** Font size of .astro-star-label (styles.css) and a bold mixed-case advance per character. */
export const STAR_NAME_FONT = 12;
const STAR_NAME_ADVANCE = 0.64 * STAR_NAME_FONT;

/**
 * Star pointers are blades. Each lies wholly on the side of the radial line
 * through its star that the front rule leaves open (the rule's body lies
 * clockwise of its fiducial edge, so the blade is laid counter-clockwise),
 * with one straight side on that line ending in a point exactly at the star.
 * Laying the rule's edge on the star therefore lays it along the blade's
 * straight side: the point, and the name engraved along the blade, stay in
 * view. A short stem joins the blade's tail to the nearest structural bar.
 *
 * The rete frame maps to the screen by a proper rotation (the orientation
 * mirror and the single y flip cancel), so "counter-clockwise" can be worked
 * out here, in catalogue coordinates, with the screen's y-down convention.
 */
export interface RetePointer {
  tip: Point;
  /** Blade outline: the tip first, then round the blade back to the line through the tip. */
  outline: Point[];
  /** Blade plus stem, as positively wound contours. */
  path: string;
  /** Unit vector along the blade, from the tip towards its tail. */
  along: Point;
  /** Unit vector across the blade, from its straight side into the metal. */
  across: Point;
  /** Centre of the engraved name (when the star is named). */
  labelAt?: Point;
  /**
   * Direction (degrees, atan2 in this frame) from the tip towards the start of the engraved name:
   * the side on which the star's locator ring is left open (tutorial/highlights.ts).
   */
  nameSide?: number;
}

/** The name side lies this far round from the blade's straight side, into the blade. */
const NAME_SIDE_TURN = 25 * Math.PI / 180;
const NAME_COS = Math.cos(NAME_SIDE_TURN);
const NAME_SIN = Math.sin(NAME_SIDE_TURN);

export function starNameLength(name: string): number {
  return name.length * STAR_NAME_ADVANCE;
}

export function starBlade(tip: Point, R: number, name?: string): RetePointer {
  const d = reteDimensions(R);
  const r = Math.hypot(tip.x, tip.y) || 1;
  const outward = { x: tip.x / r, y: tip.y / r };
  // Counter-clockwise on screen (y down): the side the front rule leaves open.
  const across = { x: outward.y, y: -outward.x };
  const width = name ? BLADE_WIDTH : PLAIN_BLADE_WIDTH;
  const length = name ? BLADE_POINT + starNameLength(name) + BLADE_TAIL : PLAIN_BLADE_LENGTH;
  // Run the blade inwards unless that would reach the hub; then outwards (inside the Capricorn ring).
  const inwards = r - length - BLADE_TAIL > d.hubRadius + 12 || r + length + BLADE_TAIL > d.rim - d.capricornWidth;
  const along = inwards ? { x: -outward.x, y: -outward.y } : outward;
  const at = (s: number, w: number): Point => ({ x: tip.x + along.x * s + across.x * w, y: tip.y + along.y * s + across.y * w });
  const outline = [
    { x: tip.x, y: tip.y },
    at(BLADE_POINT, width),
    at(length, width),
    at(length + BLADE_TAIL, width / 2),
    at(length, 0),
  ];
  const tail = at(length + BLADE_TAIL, width / 2);
  const anchor = pointerBase(tail, R);
  const stem = Math.hypot(anchor.x - tail.x, anchor.y - tail.y) > 1
    ? ` ${barPath(at(length, width / 2), anchor, STEM_WIDTH)}` : '';
  return {
    tip: { x: tip.x, y: tip.y },
    outline,
    path: `${polygonPath(outline)}${stem}`,
    along,
    across,
    ...(name ? {
      labelAt: at(BLADE_POINT + starNameLength(name) / 2 + 1, width / 2),
      nameSide: Math.atan2(along.y * NAME_COS + across.y * NAME_SIN, along.x * NAME_COS + across.x * NAME_SIN) * 180 / Math.PI,
    } : {}),
  };
}

export function retePointers(stars: readonly { raDeg: number; decDeg: number; name?: string; label?: boolean }[], R: number): RetePointer[] {
  return stars.map((star) => {
    const projected = project(star.raDeg, star.decDeg, R);
    return starBlade({ x: projected.x, y: projected.y }, R, star.label ? star.name : undefined);
  });
}

/** The ecliptic band alone (outer true ecliptic, inner hole), for highlighting. */
export function eclipticBandPath(R: number): string {
  const outer = eclipticCircle(R);
  const inner = eclipticBandInner(R);
  return `${circlePath(outer.cx, outer.cy, outer.r, true)} ${circlePath(inner.cx, inner.cy, inner.r, false)}`;
}

/** All rete metal as one compound path (fill-rule nonzero). */
export function reteMetalPath(R: number, pointers: readonly RetePointer[] = []): string {
  const d = reteDimensions(R);
  const reach = d.rim - d.capricornWidth / 2;
  const outer = eclipticCircle(R);
  const equinoxY = Math.sqrt(outer.r ** 2 - outer.cx ** 2);
  return [
    circlePath(0, 0, d.rim, true),
    circlePath(0, 0, d.rim - d.capricornWidth, false),
    eclipticBandPath(R),
    arcBandPath(equatorRadius(R), d.equatorWidth, 0, 180),
    barPath({ x: -reach, y: 0 }, { x: reach, y: 0 }, d.barWidth),
    barPath({ x: 0, y: -equinoxY }, { x: 0, y: equinoxY }, d.barWidth * 0.8),
    circlePath(0, 0, d.hubRadius, true),
    ...pointers.map((pointer) => pointer.path),
  ].join(' ');
}
