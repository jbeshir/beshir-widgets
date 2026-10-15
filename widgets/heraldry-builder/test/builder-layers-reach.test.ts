// Designs with several groups, built purely through choices the builder offers and allows, and the layers
// they are made of surviving the edits made beneath them. The level-0 reachability sweep is
// builder-controls-reach-every-legal-design.test.ts; this file starts where it stops.

import { describe, expect, it } from 'vitest';
import {
  LAYER_KEYS, addLayer, blazon, canonicalJson, countChoices, layerChoices, normalise, pathOfPlace, placementChoices, placesOf, removeLayer,
  type Design, type LayerKey, type PlaceKey,
} from '../src/lib/heraldry';
import { picturePath, setCharge, setDivision, setFieldTincture, setOrdinary, setPlainField } from '../src/lib/builder';
import { builderPath } from './builder-path';
import { generatedRichDesigns } from './design-generator';
import { arms, charge, div, group, ordinary } from './helpers';

const built = (input: unknown): Design => {
  const r = normalise(input);
  if (!r.design || !r.ok) throw new Error(`not a valid design: ${JSON.stringify(r)}`);
  return r.design;
};

const rose = (count: number, paint = 'gules') => group(charge('rose'), paint, { count });

// A representative design per construct of the multi-group tree built so far, each as the SCA blazons it.
const REPRESENTATIVE: Array<[string, unknown, string]> = [
  ['a chevron between charges inside a bordure (O&A 45741)', arms('sable', group(ordinary('chevron'), 'argent'), group(charge('crescent'), 'argent', { count: 3 }), group(ordinary('bordure'), 'argent')),
    'Sable, a chevron between three crescents and a bordure argent.'],
  ['a band with a chief and a bordure', arms('or', group(ordinary('pale'), 'sable'), group(ordinary('chief'), 'gules'), group(ordinary('bordure'), 'gules')),
    'Or, a pale sable, a chief and a bordure gules.'],
  ['a chief and a bordure on a field with a picture', arms('azure', group(charge('lion'), 'or'), group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'argent')),
    'Azure, a lion Or, a chief and a bordure argent.'],
  ['a band with charges on it and a bordure', arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('mullet'), 'azure', { count: 3 })] }), group(ordinary('bordure'), 'argent')),
    'Azure, on a fess Or three mullets azure, a bordure argent.'],
  ['a band between charges, with charges on it, under a chief', arms('azure', group(ordinary('bend'), 'or', { charged: [group(charge('mullet'), 'azure', { count: 2 })] }), group(charge('rose'), 'argent', { count: 2 }), group(ordinary('chief'), 'argent')),
    'Azure, on a bend Or between two roses argent two mullets azure, a chief argent.'],
  ['charges on a chief within a bordure', arms('gules', group(ordinary('chief'), 'argent', { charged: [rose(3, 'gules')] }), group(ordinary('bordure'), 'argent')),
    'Gules, on a chief argent three roses gules, a bordure argent.'],
  ['a divided field with a band and both peripherals', arms(div('per-pale', 'argent', 'sable'), group(ordinary('pale'), 'gules'), group(ordinary('chief'), 'or'), group(ordinary('bordure'), 'or')),
    'Per pale argent and sable, a pale gules, a chief and a bordure Or.'],
  ['charges on a chief beside a chevron between charges (O&A 51815)', arms('azure', group(ordinary('chevron'), 'argent'), group(charge('sun'), 'or', { count: 3 }), group(ordinary('chief'), 'argent', { charged: [group(charge('crescent'), 'azure', { count: 3 })] })),
    'Azure, a chevron argent between three suns Or, on a chief argent three crescents azure.'],
  ['charges on a chief beside a band', arms('azure', group(ordinary('fess'), 'or'), group(ordinary('chief'), 'argent', { charged: [rose(3)] })),
    'Azure, a fess Or, on a chief argent three roses gules.'],
  ['a picture with charges on a bordure', arms('azure', group(charge('lion'), 'or'), group(ordinary('bordure'), 'argent', { charged: [group(charge('mullet'), 'sable', { count: 8 })] })),
    'Azure, a lion Or, on a bordure argent eight mullets sable.'],
  ['charges on a bordure alone', arms('gules', group(ordinary('bordure'), 'or', { charged: [rose(6, 'azure')] })),
    'Gules, on a bordure Or six roses azure.'],
  ['charges on a chief and on a bordure beside a band', arms('azure', group(ordinary('pale'), 'or'), group(ordinary('chief'), 'argent', { charged: [rose(2)] }), group(ordinary('bordure'), 'argent', { charged: [group(charge('mullet'), 'gules', { count: 10 })] })),
    'Azure, a pale Or, on a chief argent two roses gules, on a bordure argent ten mullets gules.'],
  ['charges on a chief within a bordure with charges', arms('gules', group(ordinary('chief'), 'argent', { charged: [rose(3, 'gules')] }), group(ordinary('bordure'), 'or', { charged: [group(charge('mullet'), 'azure', { count: 7 })] })),
    'Gules, on a chief argent three roses gules, on a bordure Or seven mullets azure.'],
  ['a charge and charges in chief (O&A 2381)', arms('purpure', group(charge('bee'), 'or'), group(charge('mullet'), 'argent', { count: 3, position: 'chief' })),
    'Purpure, a bee Or and in chief three mullets argent.'],
  ['a band and charges in chief (O&A 9806, with mullets)', arms('argent', group(ordinary('chevron'), 'sable'), group(charge('mullet'), 'sable', { count: 3, position: 'chief' })),
    'Argent, a chevron and in chief three mullets sable.'],
  ['a band on a divided field and a charge in base (O&A 23819)', arms(div('per-pale', 'sable', 'gules'), group(ordinary('chevron'), 'argent'), group(charge('mullet'), 'argent', { position: 'base' })),
    'Per pale sable and gules, a chevron and in base a mullet argent.'],
  ['a charge and a charge in canton, within a bordure (O&A 105412)', arms('sable', group(charge('dragon'), 'argent'), group(charge('crescent'), 'argent', { position: 'canton' }), group(ordinary('bordure'), 'argent')),
    'Sable, a dragon and in canton a crescent and a bordure argent.'],
  ['charges on a band and charges in base', arms('azure', group(ordinary('fess'), 'or', { charged: [rose(3)] }), group(charge('crescent'), 'argent', { count: 2, position: 'base' })),
    'Azure, on a fess Or three roses gules and in base two crescents argent.'],
  ['a charge between charges (O&A 1347, the fish naiant)', arms('purpure', group(charge('fish'), 'or'), group(charge('crescent'), 'or', { count: 3, relation: 'between' })),
    'Purpure, a fish between three crescents Or.'],
  ['two charges between charges (O&A 2290)', arms('purpure', group(charge('sword'), 'argent', { count: 2, arrangement: 'in-fess' }), group(charge('anchor'), 'or', { count: 3, relation: 'between' })),
    'Purpure, in fess two swords argent between three anchors Or.'],
  ['a charge between charges on a divided field (O&A 10536)', arms(div('per-fess', 'vert', 'sable'), group(charge('eagle'), 'argent'), group(charge('rose'), 'argent', { count: 3, relation: 'between' })),
    'Per fess vert and sable, an eagle between three roses argent.'],
  ['two crossed between four in saltire, within a bordure', arms('sable', group(charge('sword'), 'or', { count: 2, arrangement: 'crossed' }), group(charge('mullet'), 'argent', { count: 4, relation: 'between', arrangement: 'in-saltire' }), group(ordinary('bordure'), 'or')),
    'Sable, two swords in saltire Or between four mullets in saltire argent, a bordure Or.'],
  ['a charge between charges in orle', arms('gules', group(charge('heart'), 'argent'), group(charge('mullet'), 'or', { count: 6, relation: 'between', arrangement: 'in-orle' })),
    'Gules, a heart argent between six mullets in orle Or.'],
  ['a charge between two in pale, under a chief with charges', arms('azure', group(charge('bee'), 'or'), group(charge('rose'), 'argent', { count: 2, relation: 'between', arrangement: 'in-pale' }), group(ordinary('chief'), 'or', { charged: [rose(3)] })),
    'Azure, a bee Or between in pale two roses argent, on a chief Or three roses gules.'],
  ['charges and charges in base under a chief with charges', arms('vert', group(charge('mullet'), 'or'), group(charge('heart'), 'or', { position: 'base' }), group(ordinary('chief'), 'argent', { charged: [rose(3)] })),
    'Vert, a mullet and in base a heart Or, on a chief argent three roses gules.'],
];

describe('designs with a chief and a bordure beside the band are built by clicks the builder allows', () => {
  for (const [label, input] of REPRESENTATIVE) {
    it(label, () => {
      const goal = built(input);
      const path = builderPath(goal);
      expect(path.problems).toEqual([]);
      expect(canonicalJson(path.design)).toBe(canonicalJson(goal));
    });
  }

  it('and the blazons are the ones the College would write', () => {
    for (const [, input, text] of REPRESENTATIVE) expect(blazon(built(input))).toBe(text);
  });

  it('every generated rich design is built too', () => {
    const designs = generatedRichDesigns(11, 150);
    const problems = designs.flatMap((d) => {
      const path = builderPath(d);
      return path.problems.length ? [`${blazon(d)}: ${path.problems.join('; ')}`] : [];
    });
    expect(problems).toEqual([]);
  }, 60_000);
});

// ── Layers survive edits beneath them ───────────────────────────────────────

/** The groups of the layers (not the band or the picture), as place → item and paint. */
function layersOf(d: Design): Map<PlaceKey, string> {
  return new Map(placesOf(d)
    .filter((p) => (LAYER_KEYS as readonly PlaceKey[]).includes(p.place))
    .map((p) => [p.place, JSON.stringify([p.group.item, p.group.paint])]));
}

const FULL = built(arms('azure',
  group(ordinary('pale'), 'or', { charged: [group(charge('mullet'), 'gules', { count: 2 })] }),
  group(charge('rose'), 'argent', { count: 2 }),
  group(ordinary('chief'), 'argent'),
  group(ordinary('bordure'), 'argent')));

// The same with pictures on the chief and on the bordure (a little less on the band, which they leave room for).
const FULLER = built(arms('azure',
  group(ordinary('pale'), 'or', { charged: [group(charge('mullet'), 'gules', { count: 2 })] }),
  group(charge('rose'), 'argent', { count: 2 }),
  group(ordinary('chief'), 'argent', { charged: [group(charge('crescent'), 'azure', { count: 3 })] }),
  group(ordinary('bordure'), 'argent', { charged: [group(charge('heart'), 'gules', { count: 8 })] })));

describe('layers kept through the edits of the layers beneath them', () => {
  const designs: Array<[string, Design]> = [
    ['a band with pictures on it and beside it, and a chief and a bordure with pictures on them', FULLER],
    ['a band with pictures on it and beside it, a chief and a bordure', FULL],
    ['a picture on the field with a chief and a bordure', built(arms('azure', group(charge('lion'), 'or'), group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'argent')))],
    ['a band between charges with a bordure', built(arms('gules', group(ordinary('pale'), 'argent'), group(charge('mullet'), 'or', { count: 2 }), group(ordinary('bordure'), 'argent')))],
    ['a picture with pictures in chief and a bordure', built(arms('azure', group(charge('lion'), 'or'), group(charge('crescent'), 'argent', { count: 2, position: 'chief' }), group(ordinary('bordure'), 'argent')))],
    ['a picture with pictures around it and a bordure', built(arms('azure', group(charge('lion'), 'or'), group(charge('crescent'), 'argent', { count: 3, relation: 'between' }), group(ordinary('bordure'), 'argent')))],
  ];

  it('the full design has every layer', () => {
    expect([...layersOf(FULL).keys()]).toEqual(['on-ordinary', 'chief', 'bordure']);
    expect([...layersOf(FULLER).keys()]).toEqual(['on-ordinary', 'chief', 'on-chief', 'bordure', 'on-bordure']);
  });

  for (const [label, d] of designs) {
    it(`${label}: changing the picture's charge, count or placement, or the field, keeps every layer exactly`, () => {
      const before = layersOf(d);
      const path = picturePath(d)!;
      const results: Array<[string, Design]> = [
        ['a new charge', setCharge(d, 'picture', 'sword')],
        ['a plain field', setPlainField(d)],
        ['a divided field', setDivision(d, 'per-pale')],
        ['a new field tincture', setFieldTincture(d, 0, 'vert')],
        ...countChoices(d, path).flatMap((c): Array<[string, Design]> => (c.allowed ? [[`count ${c.value}`, c.design]] : [])),
        ...placementChoices(d, path).flatMap((c): Array<[string, Design]> => (c.allowed ? [[`placement ${c.value}`, c.design]] : [])),
      ];
      expect(results.length).toBeGreaterThan(5);
      for (const [what, result] of results) {
        const after = layersOf(result);
        // A picture moved onto the band becomes that band's pictures: the layer map gains one, and no other changes.
        for (const [place, group] of before) expect(after.get(place), `${label}: ${what}: ${place}`).toBe(group);
      }
    });
  }

  it('changing the band keeps the layers it can still sit beside, and drops the pictures on a band that cannot carry them', () => {
    const before = layersOf(FULL);
    // (Some of these leave the pictures with no room beside the chief and bordure: the violation panel says so, nothing is dropped.)
    for (const type of ['pale', 'bend', 'chevron', 'fess', 'pile'] as const) {
      const after = layersOf(setOrdinary(FULL, type));
      expect(after.get('chief'), type).toBe(before.get('chief'));
      expect(after.get('bordure'), type).toBe(before.get('bordure'));
      expect(after.get('on-ordinary'), type).toBe(before.get('on-ordinary'));
    }
    // Around a cross or saltire the pictures fit only without the chief and bordure, which are what the builder then can't draw: they give way.
    for (const type of ['cross', 'saltire'] as const) {
      const after = layersOf(setOrdinary(FULL, type));
      expect([...after.keys()], type).toEqual(['on-ordinary']);
      expect(after.get('on-ordinary'), type).toBe(before.get('on-ordinary'));
    }
    // A chief as the band takes the place of the top band; the pictures on it stay; the border stays.
    const chiefly = layersOf(setOrdinary(FULL, 'chief'));
    expect(chiefly.get('bordure')).toBe(before.get('bordure'));
    expect(chiefly.has('chief')).toBe(false);
    // A border cannot carry pictures: they go, the chief stays; with no band the chief stands in its place.
    const bordered = layersOf(setOrdinary(FULL, 'bordure'));
    expect(bordered.has('on-ordinary')).toBe(false);
    expect(placesOf(setOrdinary(FULL, null)).map((p) => [p.place, p.group.item.k === 'ordinary' ? p.group.item.type : 'charge'])).toEqual([['ordinary', 'chief'], ['picture', 'charge'], ['bordure', 'bordure']]);
  });

  it('adds and removes the pictures on a chief and a bordure, and they follow the top band and border away', () => {
    const base = addLayer(addLayer(built(arms('azure', group(ordinary('pale'), 'argent'), group(charge('mullet'), 'or', { count: 2 }))), 'chief'), 'bordure');
    expect(layerChoices(base).filter((c) => c.allowed).map((c) => c.value)).toEqual(['on-ordinary', 'on-chief', 'on-bordure']);
    for (const key of ['on-chief', 'on-bordure'] as const) {
      const added = addLayer(base, key);
      expect(pathOfPlace(added, key), key).not.toBeNull();
      expect(canonicalJson(removeLayer(added, key)), key).toBe(canonicalJson(base));
    }
    const carried = addLayer(addLayer(base, 'on-chief'), 'on-bordure');
    expect([...layersOf(carried).keys()]).toEqual(['chief', 'on-chief', 'bordure', 'on-bordure']);
    expect(canonicalJson(removeLayer(carried, 'chief'))).toBe(canonicalJson(removeLayer(addLayer(base, 'on-bordure'), 'chief')));
    expect(layerChoices(removeLayer(carried, 'chief')).find((c) => c.value === 'on-chief')).toMatchObject({ allowed: false });
  });

  it('adding and removing a layer undoes itself, and leaves the others exactly as they were', () => {
    const base = built(arms('azure', group(ordinary('pale'), 'argent'), group(charge('mullet'), 'or', { count: 2 })));
    for (const key of ['chief', 'bordure'] as const satisfies readonly LayerKey[]) {
      const added = addLayer(base, key);
      expect(pathOfPlace(added, key), key).not.toBeNull();
      expect(canonicalJson(removeLayer(added, key)), key).toBe(canonicalJson(base));
    }
    const both = addLayer(addLayer(base, 'chief'), 'bordure');
    expect([...layersOf(both).keys()]).toEqual(['chief', 'bordure']);
    expect(layersOf(removeLayer(both, 'chief')).get('bordure')).toBe(layersOf(both).get('bordure'));
    expect(canonicalJson(removeLayer(removeLayer(both, 'chief'), 'bordure'))).toBe(canonicalJson(base));
  });

  it('refuses a layer it cannot draw, with the reason, and never drops one silently', () => {
    const choices = layerChoices(built(arms('azure', group(ordinary('fess'), 'or'), group(charge('mullet'), 'argent', { count: 2 }))));
    const chief = choices.find((c) => c.value === 'chief')!;
    expect(chief.allowed).toBe(false);
    expect(!chief.allowed && chief.reason).toMatch(/can't be set around the fess/);
  });
});
