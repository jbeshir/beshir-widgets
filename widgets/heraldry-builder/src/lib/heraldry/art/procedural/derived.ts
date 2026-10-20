// Drawings computed from another drawing of the same charge (PLAN-D §0.3.1, §2.6): a demi charge is the top of its rampant (or default)
// drawing cut off and fitted to the box again, an erased head its couped head with the neck's straight edge torn into tufts, a fish urinant
// its haurient drawing turned upside down. Computed when first asked for and memoised by the source path, and undefined while that path is
// not there. The alias charges (hawk, rapier, dagger, coney, rabbit, vol, coronet; PLAN-D §2.4) have no drawings of their own: each is drawn from
// another charge's, as it is or reshaped.

import { ALIAS_SOURCE, CHARGES, isAliasId, type AliasId, type ChargeId, type Posture } from '../../charges';
import { boundedMemo } from '../../memo';
import { pathRings, type Pt } from '../../geometry';
import { pathFor } from '../paths/index';
import type { ArtKey, NeckEdge } from '../types';
import { clipRingsHalfPlane, fitRings, ringsPath } from '../geometry';

/** The postures drawn as another posture's drawing turned upside down (§2.6): urinant, a fish diving head down, is haurient turned 180°. */
export const TURNED_POSTURES = { urinant: 'haurient' } as const satisfies Partial<Record<Posture, Posture>>;
export type TurnedPosture = keyof typeof TURNED_POSTURES;
export const isTurnedPosture = (key: string): key is TurnedPosture => Object.prototype.hasOwnProperty.call(TURNED_POSTURES, key);

/** The drawings derived from others: a demi charge, an erased head, and a posture turned from another. */
type DerivedKey = 'demi' | 'erased-head' | TurnedPosture;

type Rings = readonly (readonly Pt[])[];

/** The sword drawing's cross guard: its y (the blade is above it, the point at SWORD_POINT) and how far out its blade, grip and pommel reach (the guard's quillons reach further). */
const SWORD_GUARD = 63;
const SWORD_POINT = 7;
const SWORD_HILT_HALF = 10;

/** A rapier: its blade, grip and pommel slimmer than the sword's, its blade longer, its quillons as long as the sword's. */
const RAPIER = { width: 0.6, blade: 1.3 };
/** A dagger: the share of the blade it keeps, how much narrower it is (so its guard is short), and its blade's width at the point against at the guard. */
const DAGGER = { blade: 0.5, width: 0.55, tip: 0.5 };

const along = (y: number, share: number) => (y < SWORD_GUARD ? SWORD_GUARD - (SWORD_GUARD - y) * share : y);

/** The middle of the wing drawing's root, the straight edge at x 93 by which the wing joins its bird. */
const WING_ROOT: Pt = [93, 66];
/**
 * How a vol's dexter wing is made from the wing: turned clockwise about its root by `turn` degrees, so its tip rises to chief; its lower
 * part leaned in by `lean` per unit down, so the roots meet low; narrowed to `width`; `gap` from its mirror image.
 */
const VOL = { turn: 60, lean: 0.5, width: 0.75, gap: 2 };

/** How each alias's drawing is made from the drawing of the charge it is drawn from (ALIAS_SOURCE), or null when it is that drawing as it is. */
export const ALIAS_RESHAPE: Record<AliasId, ((rings: Rings) => Pt[][]) | null> = {
  hawk: null,
  coney: null,
  rabbit: null,
  coronet: null,
  // a rapier is a sword with a slimmer, longer blade and the same long quillons, fitted to the box again
  rapier: (rings) => fitRings(rings.map((r) => r.map(([x, y]): Pt => [Math.abs(x - 50) < SWORD_HILT_HALF ? 50 + (x - 50) * RAPIER.width : x, along(y, RAPIER.blade)]))),
  // a dagger is a narrower sword with half the blade, tapering to its point, and a short guard (not to be read as a Latin cross), fitted to the box again
  dagger: (rings) => fitRings(rings.map((r) => r.map(([x, y]): Pt => {
    const taper = y < SWORD_GUARD ? DAGGER.tip + (1 - DAGGER.tip) * (y - SWORD_POINT) / (SWORD_GUARD - SWORD_POINT) : 1;
    return [50 + (x - 50) * DAGGER.width * taper, along(y, DAGGER.blade)];
  }))),
  // a vol is a pair of wings joined at their roots, tips up (elevated): the dexter one the wing raised about its root, the bow inside and the
  // feathers fanning out to dexter, as an eagle displayed holds its wings; the sinister one its mirror image. A wing turned over (its y
  // flipped) or left as drawn (the pair "in lure") would not do.
  vol: (rings) => {
    const a = (VOL.turn * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    const raised = rings.map((r) => r.map(([x, y]): Pt => {
      const [dx, dy] = [x - WING_ROOT[0], y - WING_ROOT[1]], down = dx * sin + dy * cos;
      return [dx * cos - dy * sin + VOL.lean * down, down];
    }));
    const inner = Math.max(...raised.flat().map(([x]) => x));
    const dexter = raised.map((r) => r.map(([x, y]): Pt => [50 - VOL.gap / 2 - (inner - x) * VOL.width, y]));
    return fitRings([...dexter, ...dexter.map((r) => r.map(([x, y]): Pt => [100 - x, y]))]);
  },
};

/** Where a demi charge is cut off when its sidecar row gives no `demiCut`, as y in its drawing's box. */
const DEMI_CUT = 58;

/** How many tufts an erased neck is torn into, and how deep they are from notch to tip. */
export const ERASED_TEETH = 6;
const ERASED_DEPTH = 6;

const derivedMemo = boundedMemo<string>(200);

/** The drawing a demi charge is cut from: its rampant one, else its default posture's. */
const demiSource = (id: ChargeId): ArtKey => (CHARGES[id].drawings.rampant ? 'rampant' : CHARGES[id].defaultPosture ?? '_');

/**
 * The rings of a head with its neck's straight edge (`neck`, on the outer ring) torn into `ERASED_TEETH` tufts: the edge runs down to a tip
 * half of `ERASED_DEPTH` below the line and up to a notch as far above it, tip after notch, each tip a little past the middle of its tuft.
 */
function eraseEdge(rings: readonly (readonly Pt[])[], neck: NeckEdge): Pt[][] {
  const [outer, ...rest] = rings;
  const at = outer.findIndex((p, i) => {
    const q = outer[(i + 1) % outer.length];
    return p[1] === neck.y && q[1] === neck.y && Math.min(p[0], q[0]) === neck.x0 && Math.max(p[0], q[0]) === neck.x1;
  });
  if (at < 0) throw new RangeError('The head has no neck edge.');
  const [x0, x1] = [outer[at][0], outer[(at + 1) % outer.length][0]];
  const w = (x1 - x0) / ERASED_TEETH, half = ERASED_DEPTH / 2;
  const torn = Array.from({ length: ERASED_TEETH }, (_, k): Pt[] => [
    [x0 + (k + 0.65) * w, neck.y + half],
    ...(k < ERASED_TEETH - 1 ? [[x0 + (k + 1) * w, neck.y - half] as Pt] : []),
  ]).flat();
  return [[...outer.slice(0, at + 1), ...torn, ...outer.slice(at + 1)], ...rest.map((r) => [...r])];
}

/** The share of the largest piece's area that another piece the cut leaves needs for a demi charge to keep it. */
const DEMI_PIECE_SHARE = 0.15;

/** The area a ring encloses (shoelace). */
const ringArea = (r: readonly Pt[]) => Math.abs(r.reduce((s, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return s + x * v - u * y; }, 0)) / 2;

/**
 * What a demi charge keeps of its drawing: what lies above the cut, less the slivers the cut leaves apart from the body — the tip of a hind
 * leg or tail joined to the body only below the cut would float beside it. Of the pieces with an edge on the cut, those of at least
 * `DEMI_PIECE_SHARE` of the largest one's area are kept (the body and a foreleg the cut leaves apart from it); the rings that lie wholly above
 * the cut are kept.
 */
function demiRings(rings: Rings, cut: number): Pt[][] {
  const above = clipRingsHalfPlane(rings, cut);
  const pieces = above.filter((r) => r.some(([, y]) => y === cut));
  const body = Math.max(...pieces.map(ringArea));
  return above.filter((r) => !pieces.includes(r) || ringArea(r) >= DEMI_PIECE_SHARE * body);
}

/** The drawing of an alias charge, from the drawing of the charge it is drawn from; undefined for any other charge or while that is not loaded. */
export function aliasPath(id: ChargeId, key: ArtKey): string | undefined {
  if (!isAliasId(id)) return undefined;
  const source = pathFor(ALIAS_SOURCE[id], key), reshape = ALIAS_RESHAPE[id];
  return source && reshape ? derivedMemo(`alias|${id}|${source}`, () => ringsPath(reshape(pathRings(source)))) : source;
}

/** A derived drawing of a charge, or undefined while the drawing it is computed from is not loaded. */
export function derivedPath(id: ChargeId, key: DerivedKey): string | undefined {
  if (isTurnedPosture(key)) {
    const source = pathFor(id, TURNED_POSTURES[key]);
    return source && derivedMemo(`turned|${source}`, () => ringsPath(pathRings(source).map((r) => r.map(([x, y]): Pt => [100 - x, 100 - y]))));
  }
  if (key === 'demi') {
    const source = pathFor(id, demiSource(id));
    const cut = CHARGES[id].demiCut ?? DEMI_CUT;
    // cut between the drawing's points, which lie on a grid of tenths
    return source && derivedMemo(`demi|${cut}|${source}`, () => ringsPath(fitRings(demiRings(pathRings(source), cut + 0.05))));
  }
  const source = pathFor(id, 'head'), neck = CHARGES[id].drawings.head?.neck;
  return source && neck ? derivedMemo(`erased|${neck.y}|${neck.x0}|${neck.x1}|${source}`, () => ringsPath(eraseEdge(pathRings(source), neck))) : undefined;
}
