// Places: every group of a design the builder draws has one, and it survives the group order changing.

import { describe, expect, it } from 'vitest';
import { PLACE_KINDS, isPeripheralPlace, pathKey, pathOfPlace, placeKind, placeOfPath, placesIn, placesOf, walkGroups, type PlaceKey } from '../src/lib/heraldry';
import { generatedPeripheralDesigns, generatedRichDesigns } from './design-generator';
import { arms, charge, group, nd, ordinary } from './helpers';

const rose = (count = 1, extra: object = {}) => group(charge('rose'), 'gules', { count, ...extra });
const names = (d: ReturnType<typeof nd>): Array<[PlaceKey, string]> =>
  placesOf(d).map((p) => [p.place, p.group.item.k === 'ordinary' ? p.group.item.type : p.group.item.charge]);

describe('places of a design', () => {
  it('cover every group of every generated design exactly once, and map back to their paths', () => {
    const designs = generatedRichDesigns(7, 500);
    let layered = 0, positioned = 0, around = 0, onPicture = 0;
    for (const d of designs) {
      const placed = placesOf(d);
      expect(placed.map((p) => pathKey(p.path)).sort(), JSON.stringify(d)).toEqual(walkGroups(d).map((w) => pathKey(w.path)).sort());
      expect(new Set(placed.map((p) => p.place)).size).toBe(placed.length);
      for (const p of placed) {
        expect(placeOfPath(d, p.path)).toBe(p.place);
        expect(pathOfPlace(d, p.place)).toEqual(p.path);
      }
      expect(placed.map((p) => PLACE_KINDS.indexOf(placeKind(p.place)))).toEqual(placed.map((p) => PLACE_KINDS.indexOf(placeKind(p.place))).sort((a, b) => a - b));
      if (placed.some((p) => p.place === 'chief' || p.place === 'bordure')) layered++;
      if (placed.some((p) => p.place === 'in-chief' || p.place === 'in-base' || p.place === 'in-canton')) positioned++;
      if (placed.some((p) => p.place === 'around')) around++;
      if (placed.some((p) => p.place === 'on-picture')) onPicture++;
    }
    expect(layered).toBeGreaterThan(35);
    expect(positioned).toBeGreaterThan(20);
    expect(around).toBeGreaterThan(20);
    expect(onPicture).toBeGreaterThan(20);
  });

  it('cover every group of designs with corner and edge shapes, which are a list in canonical order', () => {
    let listed = 0, several = 0;
    for (const d of generatedPeripheralDesigns(3, 200)) {
      const placed = placesOf(d);
      expect(placed.map((p) => pathKey(p.path)).sort(), JSON.stringify(d)).toEqual(walkGroups(d).map((w) => pathKey(w.path)).sort());
      for (const p of placed) {
        expect(placeOfPath(d, p.path)).toBe(p.place);
        expect(pathOfPlace(d, p.place)).toEqual(p.path);
      }
      const corners = placed.filter((p) => isPeripheralPlace(p.place));
      expect(corners.map((p) => p.place)).toEqual(corners.map((_, i) => `peripheral-${i}`));
      expect(corners.map((p) => p.path[0])).toEqual(corners.map((p) => p.path[0]).sort((a, b) => a - b));
      if (corners.length > 0) listed++;
      if (corners.length > 1) several++;
    }
    expect(listed).toBeGreaterThan(40);
    expect(several).toBeGreaterThan(10);
  });

  it('give a lone corner or edge shape the place of the band, and set one beside a band, a picture, a chief or another as a list', () => {
    const base = group(ordinary('base'), 'or'), canton = group(ordinary('canton'), 'argent'), chief = group(ordinary('chief'), 'gules');
    expect(names(nd(arms('azure', base)))).toEqual([['ordinary', 'base']]);
    expect(names(nd(arms('azure', group(charge('mullet'), 'sable'), base)))).toEqual([['ordinary', 'base'], ['picture', 'mullet']]);
    expect(names(nd(arms('azure', group(ordinary('bend'), 'or'), canton)))).toEqual([['ordinary', 'bend'], ['peripheral-0', 'canton']]);
    // A base or canton picked as the band stays the band beside a chief.
    expect(names(nd(arms('azure', chief, canton)))).toEqual([['ordinary', 'canton'], ['chief', 'chief']]);
    expect(names(nd(arms('azure', group(ordinary('fess'), 'or'), canton, chief, base, group(ordinary('gyron', { mods: ['sinister'] }), 'gules')))))
      .toEqual([['ordinary', 'fess'], ['chief', 'chief'], ['peripheral-0', 'base'], ['peripheral-1', 'gyron'], ['peripheral-2', 'canton']]);
  });

  it('names the picture and the pictures on it, which are not the pictures on the band', () => {
    const d = nd(arms('azure', group(charge('heart'), 'argent', { charged: [group(charge('lion'), 'azure')] }), group(ordinary('chief'), 'or')));
    expect(names(d)).toEqual([['ordinary', 'chief'], ['picture', 'heart'], ['on-picture', 'lion']]);
    expect(pathOfPlace(d, 'on-picture')).toEqual([0, 0]);
    // Charges on a charge set around a band have no place: the builder draws none.
    const beside = nd(arms('azure', group(ordinary('fess'), 'or'), group(charge('rose'), 'argent', { count: 2, charged: [group(charge('mullet'), 'gules')] })));
    expect(placesIn(beside).unplaced).toEqual([[1, 0]]);
  });

  it('names the band, the picture, the pictures on the band, the top band and the border', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [rose(3, { paint: 'gules' })] }), group(charge('mullet'), 'argent', { count: 2 }),
      group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'gules')));
    expect(names(d)).toEqual([['ordinary', 'fess'], ['picture', 'mullet'], ['on-ordinary', 'rose'], ['chief', 'chief'], ['bordure', 'bordure']]);
    expect(pathOfPlace(d, 'on-ordinary')).toEqual([0, 0]);
  });

  it('keep their names when the input order changes', () => {
    const parts = [group(ordinary('bend'), 'or'), group(charge('mullet'), 'argent', { count: 2 }), group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'gules')];
    const orders = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1]];
    const results = orders.map((o) => JSON.stringify(names(nd(arms('azure', ...o.map((i) => parts[i]))))));
    expect(new Set(results).size).toBe(1);
  });

  it('give the chief, else the bordure, the place of the band when there is no central one', () => {
    const chief = group(ordinary('chief'), 'argent'), bordure = group(ordinary('bordure'), 'gules');
    expect(names(nd(arms('azure', bordure)))).toEqual([['ordinary', 'bordure']]);
    expect(names(nd(arms('azure', chief)))).toEqual([['ordinary', 'chief']]);
    expect(names(nd(arms('azure', bordure, chief)))).toEqual([['ordinary', 'chief'], ['bordure', 'bordure']]);
    expect(names(nd(arms('azure', group(charge('lion'), 'or'), bordure, chief)))).toEqual([['ordinary', 'chief'], ['picture', 'lion'], ['bordure', 'bordure']]);
  });

  it('name the pictures on a chief or a bordure beside the band, or the band with pictures on it when that is the chief or bordure itself', () => {
    const on = (n: number) => ({ charged: [group(charge('mullet'), 'or', { count: n })] });
    const beside = nd(arms('azure', group(ordinary('fess'), 'argent'), group(ordinary('chief'), 'gules', on(3)), group(ordinary('bordure'), 'gules', on(8))));
    expect(names(beside)).toEqual([['ordinary', 'fess'], ['chief', 'chief'], ['on-chief', 'mullet'], ['bordure', 'bordure'], ['on-bordure', 'mullet']]);
    expect(pathOfPlace(beside, 'on-chief')).toEqual([1, 0]);
    expect(pathOfPlace(beside, 'on-bordure')).toEqual([2, 0]);
    const standing = nd(arms('azure', group(ordinary('chief'), 'gules', on(3)), group(ordinary('bordure'), 'gules', on(8))));
    expect(names(standing)).toEqual([['ordinary', 'chief'], ['on-ordinary', 'mullet'], ['bordure', 'bordure'], ['on-bordure', 'mullet']]);
    const border = nd(arms('azure', group(ordinary('bordure'), 'argent', on(8))));
    expect(names(border)).toEqual([['ordinary', 'bordure'], ['on-ordinary', 'mullet']]);
  });

  it('name the charges set in chief, in base or in canton beside the band or the picture', () => {
    expect(names(nd(arms('azure', group(charge('lion'), 'or'), group(charge('mullet'), 'argent', { count: 3, position: 'chief' }), group(ordinary('bordure'), 'gules')))))
      .toEqual([['ordinary', 'bordure'], ['picture', 'lion'], ['in-chief', 'mullet']]);
    const banded = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [rose(3)] }), group(charge('mullet'), 'argent', { position: 'canton' })));
    expect(names(banded)).toEqual([['ordinary', 'fess'], ['in-canton', 'mullet'], ['on-ordinary', 'rose']]);
    expect(pathOfPlace(banded, 'in-canton')).toEqual([1]);
    // Charges in chief with nothing central are the picture.
    expect(names(nd(arms('azure', group(charge('mullet'), 'argent', { count: 3, position: 'chief' }))))).toEqual([['picture', 'mullet']]);
  });

  it('call a chief with charges on it the band with pictures on it', () => {
    const d = nd(arms('azure', group(ordinary('chief'), 'argent', { charged: [rose(3)] })));
    expect(names(d)).toEqual([['ordinary', 'chief'], ['on-ordinary', 'rose']]);
  });

  it('throw for a group with no place, while placesIn reports it', () => {
    const twoOverall = nd(arms('azure', group(ordinary('bend'), 'or'), rose(1, { role: 'overall' }), group(charge('sword'), 'argent', { role: 'overall' })));
    expect(() => placesOf(twoOverall)).toThrow(RangeError);
    expect(placesIn(twoOverall)).toMatchObject({ unplaced: [[2]] });
    const crowded = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [rose(2), group(charge('mullet'), 'argent', { count: 2 })] })));
    expect(placesIn(crowded).unplaced).toEqual([[0, 1]]);
    expect(placeOfPath(crowded, [0, 1])).toBeNull();
  });
});
