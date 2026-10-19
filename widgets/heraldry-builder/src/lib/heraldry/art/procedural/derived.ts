// Drawings computed from another drawing of the same charge (PLAN-D §0.3.1, §2.6): a demi charge is the top of its rampant (or default)
// drawing cut off and fitted to the box again, an erased head its couped head with the neck's straight edge torn into tufts, a fish urinant
// its haurient drawing turned upside down. Computed when first asked for and memoised by the source path, and undefined while that path is
// not there.

import { CHARGES, type ChargeId, type Posture } from '../../charges';
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
    return source && derivedMemo(`demi|${cut}|${source}`, () => ringsPath(fitRings(clipRingsHalfPlane(pathRings(source), cut + 0.05))));
  }
  const source = pathFor(id, 'head'), neck = CHARGES[id].drawings.head?.neck;
  return source && neck ? derivedMemo(`erased|${neck.y}|${neck.x0}|${neck.x1}|${source}`, () => ringsPath(eraseEdge(pathRings(source), neck))) : undefined;
}
