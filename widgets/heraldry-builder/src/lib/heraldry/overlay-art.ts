// The pieces a charge's parts and details add to its drawing (PLAN-D §0.3.5; art batch A3): a wing behind a beast (a pair rising from a
// heart), flames all round, a stem with leaves under a flower, a collar round the neck and a crown on the head. Each piece is placed at an
// anchor of the drawing (a square of its 100-box: centre, side and turn clockwise) and given in the charge's own 100-box, so that it is
// drawn with the charge's slot and pose. A charge whose pieces under it reach out of the box is drawn smaller with them, to fit it; a crown
// or a collar never moves it (one may reach a unit past the box's top), so a crowned or collared charge keeps its on-box.

import { CHARGES } from './charges';
import type { Charge, Modifier, Paint, PartPaint } from './design';
import { pathRings, pointInPolygon, type Pt } from './geometry';
import { bboxOf, ringDepths, ringsPath } from './art/geometry';
import { pathFor } from './art/paths/index';
import { OVERLAY_PIECES } from './art/paths/pieces';
import type { AnchorId, ArtPlace, DrawingMeta } from './art/types';
import { artKeyOf, chargePath } from './charge-art';
import { boundedMemo } from './memo';

/** What an overlay piece is, in the order they are drawn: the first four under the charge, the collar and crown over it. */
const OVERLAY_PARTS = ['wings', 'flames', 'slip', 'leaves', 'collar', 'crown'] as const;
export type OverlayPart = (typeof OVERLAY_PARTS)[number];

/** The pieces drawn under the charge: they seem to come from behind it. */
const UNDER: readonly OverlayPart[] = ['wings', 'flames', 'slip', 'leaves'];

/** A piece drawn with a charge: its path in the charge's 100-box, whether it lies under the charge, and its paint. */
export interface ArtOverlay { part: OverlayPart; d: string; under: boolean; paint: Paint }

/** A charge's drawing with its pieces: the art (the charge's own, or drawn smaller to make room for them) and the pieces. */
export interface OverlaidArt { art: string; overlays: ArtOverlay[] }

/** The anchor each piece is placed at; flames go all round the outline. */
const PIECE_ANCHOR: Record<OverlayPart, AnchorId | null> = { wings: 'wings', flames: null, slip: 'slip', leaves: 'slip', collar: 'collar', crown: 'crown' };

/** What draws each piece: a modifier with its paint (winged, enflamed, slipped, leaved) or a part (crowned, collared). */
const PIECE_OF: Record<OverlayPart, Modifier['id'] | PartPaint['part']> = {
  wings: 'winged', flames: 'enflamed', slip: 'slipped', leaves: 'leaved', collar: 'collared', crown: 'crowned',
};

/** The modifiers drawn as pieces: each needs its own paint ("winged Or", "enflamed proper"). */
export const OVERLAY_MODIFIERS: readonly Modifier['id'][] = ['winged', 'enflamed', 'slipped', 'leaved'];

/** A collar is a band across its anchor's square through the middle, this share of the side thick, clipped to the outline (A3 ruling). */
const COLLAR_THICKNESS = 0.28;

/**
 * The two leaves of a slip, either side of its stem: offset (shares of its square's side) and turn from the square's; each 0.7 of the side (half
 * in art batch A3's preview, too small to read on a 48 px shield).
 */
const LEAVES: ReadonlyArray<{ dx: number; dy: number; turn: number }> = [{ dx: -0.3, dy: 0.05, turn: -60 }, { dx: 0.3, dy: 0.3, turn: 60 }];
const LEAF_SIZE = 0.7;

/**
 * Flames (PLAN-D §2.6): this many glyphs of the flame charge's art, this many units tall (20, not §2.6's 16: at 16 they are specks on a 48 px
 * shield), evenly round the outline, each sunk a little under it.
 */
const FLAMES = 7;
const FLAME_SIZE = 20;
const FLAME_SINK = 0.15;

/** How far from the middle of its box a charge with the pieces under it may reach before it is drawn smaller: to the box's edge. */
const REACH = 50;

type Transform = (p: Pt) => Pt;

const turned = (deg: number): Transform => {
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
};

/** A piece's 100-box placed on an anchor's square: centre, side and turn. */
const placed = (a: ArtPlace): Transform => {
  const turn = turned(a.rotation), s = a.size / 100;
  return ([x, y]) => {
    const [u, v] = turn([(x - 50) * s, (y - 50) * s]);
    return [a.x + u, a.y + v];
  };
};

const mirrored: Transform = ([x, y]) => [100 - x, y];
const map = (rings: readonly (readonly Pt[])[], f: Transform): Pt[][] => rings.map((r) => r.map(f));

/** A wing behind a beast is the dexter wing piece mirrored, its root on the shoulder and its feathers trailing back (A3 ruling); a heart's is a pair. */
function wings(a: ArtPlace, paired: boolean): Pt[][] {
  const one = map(map(pathRings(pathFor('wing', '_')!), mirrored), placed(a));
  return paired ? [...one, ...map(one, mirrored)] : one;
}

/** The outward normal of a ring at a point on its edge from `p` to `q`. */
function outward(ring: readonly Pt[], [px, py]: Pt, [qx, qy]: Pt): Pt {
  const len = Math.hypot(qx - px, qy - py), n: Pt = [(qy - py) / len, -(qx - px) / len];
  const mx = (px + qx) / 2, my = (py + qy) / 2;
  return pointInPolygon(mx + n[0], my + n[1], ring) ? [-n[0], -n[1]] : n;
}

/** Flames round a drawing's outline: `FLAMES` glyphs of the flame's art set evenly along its outer ring from its foot, each pointing out. */
function flames(rings: readonly (readonly Pt[])[]): Pt[][] {
  const depths = ringDepths(rings);
  const area = (r: readonly Pt[]) => { const b = bboxOf(r); return (b.x1 - b.x0) * (b.y1 - b.y0); };
  const outer = rings.filter((_, i) => depths[i] === 0).reduce((a, b) => (area(b) > area(a) ? b : a));
  const foot = outer.reduce((best, p, i) => (p[1] > outer[best][1] ? i : best), 0);
  const ring = [...outer.slice(foot), ...outer.slice(0, foot)];
  const edges = ring.map((p, i) => ({ p, q: ring[(i + 1) % ring.length], len: Math.hypot(ring[(i + 1) % ring.length][0] - p[0], ring[(i + 1) % ring.length][1] - p[1]) }));
  const total = edges.reduce((s, e) => s + e.len, 0);
  const glyph = pathRings(pathFor('flame', '_')!);
  const box = bboxOf(glyph.flat()), s = FLAME_SIZE / (box.y1 - box.y0), base: Pt = [(box.x0 + box.x1) / 2, box.y1 - FLAME_SINK * (box.y1 - box.y0)];
  return Array.from({ length: FLAMES }, (_, k) => {
    let at = ((k + 0.5) / FLAMES) * total, e = 0;
    while (at > edges[e].len) at -= edges[e++].len;
    const { p, q, len } = edges[e], t = at / len, point: Pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const [nx, ny] = outward(outer, p, q), turn = turned((Math.atan2(nx, -ny) * 180) / Math.PI);
    return map(glyph, ([x, y]) => { const [u, v] = turn([(x - base[0]) * s, (y - base[1]) * s]); return [point[0] + u, point[1] + v]; });
  }).flat();
}

/** A collar: a band through the middle of its square, as wide as the square (clipped to the outline where it is drawn). */
function collar(a: ArtPlace): Pt[][] {
  const h = (a.size * COLLAR_THICKNESS) / 2, w = a.size / 2, turn = turned(a.rotation);
  return [[[-w, -h], [w, -h], [w, h], [-w, h]].map((p) => { const [u, v] = turn(p as Pt); return [a.x + u, a.y + v] as Pt; })];
}

/** A slip's two leaves, either side of its stem. */
function leaves(a: ArtPlace): Pt[][] {
  const leaf = pathRings(OVERLAY_PIECES.leaf), at = placed(a);
  return LEAVES.flatMap(({ dx, dy, turn }) => {
    const own = placed({ x: 50 + dx * 100, y: 50 + dy * 100, size: LEAF_SIZE * 100, rotation: turn });
    return map(map(leaf, own), at);
  });
}

function pieceRings(part: OverlayPart, a: ArtPlace | null, art: readonly (readonly Pt[])[], paired: boolean): Pt[][] {
  switch (part) {
    case 'wings': return wings(a!, paired);
    case 'flames': return flames(art);
    case 'slip': return map(pathRings(OVERLAY_PIECES.slip), placed(a!));
    case 'leaves': return leaves(a!);
    case 'collar': return collar(a!);
    case 'crown': return map(pathRings(OVERLAY_PIECES.crown), placed(a!));
  }
}

/** The anchors of the drawing a charge is drawn with: none on a drawing derived from another but a head erased (a demi charge, urinant). */
function drawingAnchors(c: Pick<Charge, 'charge' | 'form' | 'posture' | 'gaze'>): DrawingMeta['anchors'] {
  return CHARGES[c.charge].drawings[artKeyOf(c)]?.anchors ?? {};
}

/** Whether a charge's drawing has the anchor the piece of a part or modifier is placed at (flames go round any outline). */
export function pieceAnchored(c: Pick<Charge, 'charge' | 'form' | 'posture' | 'gaze'>, of: Modifier['id'] | PartPaint['part']): boolean {
  const anchor = PIECE_ANCHOR[OVERLAY_PARTS.find((part) => PIECE_OF[part] === of)!];
  return anchor === null || drawingAnchors(c)[anchor] !== undefined;
}

/** The pieces a charge's parts and details draw, in drawing order, each with its paint: those with a paint and their anchor (support.ts). */
function pieces(c: Charge, anchors: DrawingMeta['anchors']): Array<{ part: OverlayPart; paint: Paint }> {
  return OVERLAY_PARTS.flatMap((part) => {
    const paint = c.mods.find((m) => m.id === PIECE_OF[part])?.paint ?? c.parts.find((p) => p.part === PIECE_OF[part])?.paint ?? null;
    const anchor = PIECE_ANCHOR[part];
    return paint && (anchor === null || anchors[anchor]) ? [{ part, paint }] : [];
  });
}

const overlaidMemo = boundedMemo<{ art: string; pieces: string[] }>(500);

/** A charge's drawing with the pieces its parts and details draw, given in its 100-box, drawn smaller together where they reach out of it. */
export function overlaidArt(c: Charge): OverlaidArt {
  const art = chargePath(c);
  const anchors = drawingAnchors(c), paired = CHARGES[c.charge].pairedWings;
  const wanted = pieces(c, anchors);
  if (wanted.length === 0) return { art, overlays: [] };
  const drawn = overlaidMemo(`${wanted.map((p) => p.part).join()}|${paired}|${JSON.stringify(anchors)}|${art}`, () => {
    const rings = pathRings(art);
    const placedPieces = wanted.map(({ part }) => {
      const anchor = PIECE_ANCHOR[part];
      return pieceRings(part, anchor && anchors[anchor]!, rings, paired);
    });
    const reach = Math.max(...[rings, ...placedPieces.filter((_, i) => UNDER.includes(wanted[i].part))].flat(2).map(([x, y]) => Math.max(Math.abs(x - 50), Math.abs(y - 50))));
    const k = Math.min(1, REACH / reach);
    const fit = (rs: Pt[][]) => ringsPath(k === 1 ? rs : map(rs, ([x, y]) => [50 + (x - 50) * k, 50 + (y - 50) * k]));
    return { art: k === 1 ? art : fit(rings), pieces: placedPieces.map(fit) };
  });
  return { art: drawn.art, overlays: wanted.map(({ part, paint }, i) => ({ part, d: drawn.pieces[i], under: UNDER.includes(part), paint })) };
}
