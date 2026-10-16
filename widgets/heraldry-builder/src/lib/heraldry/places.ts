// The builder's group-tree vocabulary: every group of a design the builder draws has a structural *place*
// — "the band", "the picture", "the pictures on the band", "the top band", "the border", "the first corner or edge shape" — that doesn't
// change when its siblings are added, removed or re-sorted (the corner and edge shapes beside the band are a list, numbered in canonical order). The builder's steps and its tests key on places,
// never on paths, which move with the canonical group order.

import { ORDINARY_KIND, type OrdinaryType } from './ordinaries';
import { groupAt, pathKey, type Design, type Group, type GroupPath } from './design';
import { isSecondaryPosition, primaryCharges } from './arrangement';

/**
 * In step order:
 * ordinary    — the central band or shape; with none, the corner or edge shape (base, canton …), else the chief, else the bordure the design stands on
 * picture     — the top-level charges: primary on the field, or set between the band
 * co-primary  — the second main picture, laid out together with the first ("a lion and a rose")
 * on-picture  — the charges on each of the primary charges
 * around      — the charges set around the picture on the field ("a lion between three mullets")
 * in-chief, in-base, in-canton — the charges set beside the band or the picture, along the top, along the bottom or in the top corner
 * on-ordinary — the charges on the ordinary
 * chief, bordure — a chief or bordure set beside the ordinary
 * on-chief, on-bordure — the charges on that chief or bordure (on the ordinary itself when it is the chief or bordure the design stands on)
 * peripheral  — an element along an edge of the field beside the main band or picture (a base, point, canton, quarter or gyron): any
 *               number of them, each a place of its own (`peripheral-0`, `peripheral-1` … in canonical order)
 * overall — the one band or charge lying across the middle of everything else
 */
export const PLACE_KINDS = ['ordinary', 'picture', 'co-primary', 'on-picture', 'around', 'in-chief', 'in-base', 'in-canton', 'on-ordinary', 'chief', 'on-chief', 'bordure', 'on-bordure', 'peripheral', 'overall'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/** The place of the n-th corner or edge shape beside the band or picture (from 0, in canonical order). */
export type PeripheralPlace = `peripheral-${number}`;
/** A place of a design: one of each kind, but any number of corner and edge shapes. */
export type PlaceKey = Exclude<PlaceKind, 'peripheral'> | PeripheralPlace;

export const peripheralPlace = (n: number): PeripheralPlace => `peripheral-${n}`;
export const isPeripheralPlace = (key: PlaceKey): key is PeripheralPlace => key.startsWith('peripheral-');
/** The kind of a place: `peripheral` for every corner or edge shape. */
export const placeKind = (key: PlaceKey): PlaceKind => (isPeripheralPlace(key) ? 'peripheral' : key);
/** Places in step order: by kind, the corner and edge shapes in their own order. */
const placeOrder = (key: PlaceKey): number => PLACE_KINDS.indexOf(placeKind(key)) * 1000 + (isPeripheralPlace(key) ? Number(key.slice('peripheral-'.length)) : 0);

export interface Placed { place: PlaceKey; path: GroupPath; group: Group }

const typeOf = (g: Group): OrdinaryType | null => (g.item.k === 'ordinary' ? g.item.type : null);

/** A corner or edge shape: a peripheral ordinary other than the chief and the bordure, which have places of their own. */
const isCornerOrEdge = (g: Group): boolean => {
  const type = typeOf(g);
  return type !== null && type !== 'chief' && type !== 'bordure' && ORDINARY_KIND[type] !== 'central';
};

/**
 * The index of the top-level group that is the design's ordinary: the central one, else the first corner or edge shape (so a base or
 * canton picked as the band stays the band beside a chief), else the chief, else the bordure (a group overall is none of these).
 */
function ordinaryIndex(groups: readonly Group[]): number {
  const find = (want: (g: Group) => boolean) => groups.findIndex((g) => g.role !== 'overall' && want(g));
  const central = (g: Group) => g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central';
  for (const want of [central, isCornerOrEdge,(g: Group) => typeOf(g) === 'chief', (g: Group) => typeOf(g) === 'bordure']) {
    const i = find(want);
    if (i >= 0) return i;
  }
  return -1;
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
  let corners = 0;
  d.groups.forEach((group, i) => {
    const type = typeOf(group);
    // The second main picture is the co-primary; a third has no place.
    const mainPlace: PlaceKey = placed.some((p) => p.place === 'picture') ? 'co-primary' : 'picture';
    if (group.role === 'overall') add('overall', [i], group);
    else if (i === ordinary) add('ordinary', [i], group);
    else if (type === 'chief' || type === 'bordure') add(type, [i], group);
    else if (group.role === 'peripheral' && isCornerOrEdge(group)) add(peripheralPlace(corners++), [i], group);
    else if (group.item.k === 'charge' && group.role === 'secondary' && group.relation === 'between' && charges) add('around', [i], group);
    else if (group.item.k === 'charge' && group.role === 'primary') add(mainPlace, [i], group);
    else if (group.item.k === 'charge' && group.role === 'secondary' && group.relation === 'between') add('picture', [i], group);
    else if (group.item.k === 'charge' && group.role === 'secondary' && group.relation === 'position' && isSecondaryPosition(group.position)) add(`in-${group.position}`, [i], group);
    else unplaced.push([i]);
    if (i !== ordinary) {
      group.charged.forEach((tertiary, j) => {
        if (group.role === 'overall') unplaced.push([i, j]);
        else if (type === 'chief' || type === 'bordure') add(`on-${type}`, [i, j], tertiary);
        // Only the first main picture carries pictures.
        else if (group.item.k === 'charge' && group.role === 'primary' && mainPlace === 'picture') add('on-picture', [i, j], tertiary);
        else unplaced.push([i, j]);
      });
    }
  });
  if (ordinary >= 0) d.groups[ordinary].charged.forEach((group, j) => add('on-ordinary', [ordinary, j], group));
  return { placed: placed.sort((a, b) => placeOrder(a.place) - placeOrder(b.place)), unplaced };
}

/** Every group of the design with its place, in step order. Throws a RangeError for a group with no place: designs that follow the structure rules have none. */
export function placesOf(d: Design): Placed[] {
  const { placed, unplaced } = placesIn(d);
  if (unplaced.length > 0) throw new RangeError(`The group at ${pathKey(unplaced[0])} has no place.`);
  return placed;
}

/** The corner and edge shapes beside the band or picture, in order. */
export function peripheralPlacesOf(d: Design): PeripheralPlace[] {
  return placesIn(d).placed.flatMap((p) => (isPeripheralPlace(p.place) ? [p.place] : []));
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
