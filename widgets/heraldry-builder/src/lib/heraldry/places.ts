// The builder's group-tree vocabulary: every group of a design the builder draws has a structural *place*
// — "the band", "the picture", "the pictures on the band", "the top band", "the border" — that doesn't
// change when its siblings are added, removed or re-sorted. The builder's steps and its tests key on places,
// never on paths, which move with the canonical group order.

import { ORDINARY_KIND, type OrdinaryType } from './ordinaries';
import { groupAt, pathKey, type Design, type Group, type GroupPath } from './design';
import { isSecondaryPosition, primaryCharges } from './arrangement';

/**
 * In step order:
 * ordinary    — the central band or shape; with none, the chief (else the bordure) the design stands on
 * picture     — the top-level charges: primary on the field, or set between the band
 * around      — the charges set around the picture on the field ("a lion between three mullets")
 * in-chief, in-base, in-canton — the charges set beside the band or the picture, along the top, along the bottom or in the top corner
 * on-ordinary — the charges on the ordinary
 * chief, bordure — a chief or bordure set beside the ordinary
 * on-chief, on-bordure — the charges on that chief or bordure (on the ordinary itself when it is the chief or bordure the design stands on)
 */
export const PLACE_KEYS = ['ordinary', 'picture', 'around', 'in-chief', 'in-base', 'in-canton', 'on-ordinary', 'chief', 'on-chief', 'bordure', 'on-bordure'] as const;
export type PlaceKey = (typeof PLACE_KEYS)[number];

export interface Placed { place: PlaceKey; path: GroupPath; group: Group }

const typeOf = (g: Group): OrdinaryType | null => (g.item.k === 'ordinary' ? g.item.type : null);

/** The index of the top-level group that is the design's ordinary: the central one, else the chief, else the bordure. */
function ordinaryIndex(groups: readonly Group[]): number {
  const find = (want: (g: Group) => boolean) => groups.findIndex(want);
  const central = find((g) => g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central');
  if (central >= 0) return central;
  const chief = find((g) => typeOf(g) === 'chief');
  return chief >= 0 ? chief : find((g) => typeOf(g) === 'bordure');
}

/**
 * The groups of the design that have a place, in step order, and the paths of those that don't: a second group of a
 * place, or one the builder has no place for. A design that breaks a structure rule (two groups on the ordinary) has some.
 */
export function placesIn(d: Design): { placed: Placed[]; unplaced: GroupPath[] } {
  const ordinary = ordinaryIndex(d.groups);
  const charges = primaryCharges(d);
  const placed: Placed[] = [];
  const unplaced: GroupPath[] = [];
  const add = (place: PlaceKey, path: GroupPath, group: Group) => {
    if (placed.some((p) => p.place === place)) unplaced.push(path);
    else placed.push({ place, path, group });
  };
  d.groups.forEach((group, i) => {
    const type = typeOf(group);
    if (i === ordinary) add('ordinary', [i], group);
    else if (type === 'chief' || type === 'bordure') add(type, [i], group);
    else if (group.item.k === 'charge' && group.role === 'secondary' && group.relation === 'between' && charges) add('around', [i], group);
    else if (group.item.k === 'charge' && (group.role === 'primary' || (group.role === 'secondary' && group.relation === 'between'))) add('picture', [i], group);
    else if (group.item.k === 'charge' && group.role === 'secondary' && group.relation === 'position' && isSecondaryPosition(group.position)) add(`in-${group.position}`, [i], group);
    else unplaced.push([i]);
    if (i !== ordinary) group.charged.forEach((tertiary, j) => (type === 'chief' || type === 'bordure' ? add(`on-${type}`, [i, j], tertiary) : unplaced.push([i, j])));
  });
  if (ordinary >= 0) d.groups[ordinary].charged.forEach((group, j) => add('on-ordinary', [ordinary, j], group));
  return { placed: placed.sort((a, b) => PLACE_KEYS.indexOf(a.place) - PLACE_KEYS.indexOf(b.place)), unplaced };
}

/** Every group of the design with its place, in step order. Throws a RangeError for a group with no place: designs that follow the structure rules have none. */
export function placesOf(d: Design): Placed[] {
  const { placed, unplaced } = placesIn(d);
  if (unplaced.length > 0) throw new RangeError(`The group at ${pathKey(unplaced[0])} has no place.`);
  return placed;
}

/** The path of the group in this place, or null when the design has none there. */
export function pathOfPlace(d: Design, key: PlaceKey): GroupPath | null {
  return placesIn(d).placed.find((p) => p.place === key)?.path ?? null;
}

/** The place of the group at `path`, or null for a group with none (see `placesIn`). */
export function placeOfPath(d: Design, path: GroupPath): PlaceKey | null {
  groupAt(d, path);
  return placesIn(d).placed.find((p) => pathKey(p.path) === pathKey(path))?.place ?? null;
}
