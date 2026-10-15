// Two groups of charges that are together the main picture ("a unicorn and a rose", SENA App I1): resolve and the
// structure rules, where they are drawn (all their charges laid out as one group, the first group first), the rule of
// tincture, the blazon, how they differ from other arms, and the builder's layer for the second picture.

import { describe, expect, it } from 'vitest';
import {
  addLayer, blazon, candidateKey, contextSlots, deriveTags, differences, gloss, groupAt, isClear, keysMayConflict, layerChoices, layerPath, layoutCandidates, layoutContext, normalise, pathOfPlace,
  placesOf, removeLayer, signature, simpleParts, structuralIssues, tinctureIssues, unsupportedIssues, walkGroups, type Design,
} from '../src/lib/heraldry';
import { setCharge } from '../src/lib/builder';
import { arms, charge, div, group, nd, ordinary, setCount } from './helpers';

const pair = (field: unknown, a: object, b: object, ...rest: object[]) => arms(field, a, b, ...rest);
const lion = (paint = 'argent', extra: object = {}) => group(charge('lion'), paint, extra);
const rose = (paint = 'gules', extra: object = {}) => group(charge('rose'), paint, extra);
const gaps = (input: unknown) => unsupportedIssues(nd(input)).map((i) => `${i.gap.category}:${i.gap.detail}`);
const structure = (input: unknown) => structuralIssues(nd(input)).map((i) => (i.code === 'structure' ? `${i.rule}: ${i.message}` : i.message));
/** The heater slots of the group at `path`. */
const slots = (d: Design, path: number[]) => {
  const g = groupAt(d, path);
  return contextSlots(layoutContext(d, path), g.count, { arrangement: g.arrangement, position: g.position }, 'heater');
};

describe('two groups that are together the main picture', () => {
  it('are both primary, in the order they were written', () => {
    const d = nd(pair('azure', rose(), lion()));
    expect(d.groups.map((g) => (g.item.k === 'charge' ? g.item.charge : g.item.type))).toEqual(['rose', 'lion']);
    expect(d.groups.map((g) => g.role)).toEqual(['primary', 'primary']);
    expect(placesOf(d).map((p) => p.place)).toEqual(['picture', 'co-primary']);
  });

  it('are supported for up to three charges between them', () => {
    expect(gaps(pair('azure', lion('or'), rose('argent')))).toEqual([]);
    expect(gaps(pair('azure', lion('or', { count: 2 }), rose('argent')))).toEqual([]);
    expect(gaps(pair('azure', lion('or', { count: 2 }), rose('argent', { count: 2 })))).toEqual(['multiple-groups:co-primary-count']);
  });

  it('are gapped beside a third group or a band, or with charges around, on or across them', () => {
    expect(gaps(pair('azure', lion('or'), rose('argent'), group(charge('heart'), 'argent')))).toEqual(['multiple-groups:co-primary-3']);
        expect(gaps(arms('gules', group(ordinary('bend'), 'argent', { role: 'primary' }), group(charge('lion'), 'or', { role: 'primary' })))).toEqual(['multiple-groups:co-primary-ordinary']);
    expect(gaps(pair('azure', lion('or'), rose('argent'), group(charge('mullet'), 'argent', { count: 3, relation: 'between' })))).toEqual(['multiple-groups:co-primary-around']);
    expect(gaps(pair('azure', lion('or'), rose('argent', { charged: [group(charge('heart'), 'azure')] })))).toEqual(['multiple-groups:tertiary-on-co-primary']);
    expect(gaps(pair('azure', lion('or'), rose('argent'), group(ordinary('bend'), 'gules', { role: 'overall' })))).toEqual(['multiple-groups:co-primary-overall']);
  });

  it('are posed alike when they can be (SENA A3D2c)', () => {
    const beast = (id: string, posture: string, paint: string) => group(charge(id, { posture }), paint);
    expect(structure(pair('azure', beast('lion', 'rampant', 'or'), beast('wolf', 'passant', 'argent')))).toEqual([expect.stringMatching(/^relation: Two main pictures that can be posed alike/)]);
    expect(structure(pair('azure', beast('lion', 'rampant', 'or'), beast('wolf', 'rampant', 'argent')))).toEqual([]);
    expect(structure(pair('azure', beast('lion', 'passant', 'or'), beast('wolf', 'statant', 'argent')))).toEqual([]);
    expect(structure(pair('azure', beast('lion', 'rampant', 'or'), rose('argent', { arrangement: 'in-fess' })))).toEqual([]);
  });

  it('may not use one charge twice (A3D1a)', () => {
    expect(structure(pair('azure', lion('or'), lion('argent')))).toEqual([expect.stringMatching(/^same-type: A lion can't be used again/)]);
  });
});

describe('where they are drawn', () => {
  it('are laid out as one group, the first group taking the first slots', () => {
    const d = nd(pair(div('per-pale', 'argent', 'azure'), lion('sable'), rose('or')));
    // Table 7: one in each part of a field divided in two.
    expect(groupAt(d, [0]).arrangement).toEqual({ k: 'line', dir: 'fess' });
    expect(groupAt(d, [1]).arrangement).toEqual({ k: 'line', dir: 'fess' });
    const [a] = slots(d, [0]), [b] = slots(d, [1]);
    expect(a.x).toBeLessThan(50);
    expect(b.x).toBeGreaterThan(50);
    expect(a.size).toBe(b.size);
  });

  it('are two and one for three on a plain field, the first group first', () => {
    const d = nd(pair('azure', lion('or', { count: 2 }), rose('argent')));
    expect(groupAt(d, [0]).arrangement).toEqual({ k: 'rows', rows: [2, 1] });
    expect(slots(d, [0]).map((s) => s.y)).toEqual([slots(d, [0])[0].y, slots(d, [0])[0].y]);
    expect(slots(d, [1])[0].y).toBeGreaterThan(slots(d, [0])[0].y);
  });

  it('must be arranged when they are two on a plain field, and share the arrangement', () => {
    expect(layoutCandidates(nd(pair('azure', lion('or'), rose('argent'))), [0], 1).map((l) => l.arrangement.k === 'line' ? l.arrangement.dir : l.arrangement.k)[0]).toBe('fess');
    const d = nd(pair('azure', lion('or'), rose('argent', { arrangement: 'in-pale' })));
    expect(d.groups.map((g) => g.arrangement)).toEqual([{ k: 'line', dir: 'pale' }, { k: 'line', dir: 'pale' }]);
    expect(structure(pair('azure', lion('or', { arrangement: 'in-pale' }), rose('argent', { arrangement: 'in-fess' })))).toEqual([expect.stringMatching(/^layout: Two main pictures are arranged together/)]);
    expect(structure(pair('azure', lion('or', { arrangement: 'crossed' }), rose('argent')))).toEqual([expect.stringMatching(/^layout: Two main pictures together can be arranged/), expect.stringMatching(/^layout: Two main pictures together can be arranged/)]);
  });
});

describe('the rule of tincture', () => {
  it('judges each group where its slots lie', () => {
    // Gules on the gules half fails, Or on it passes: the rose goes second, on the azure... argent half.
    expect(tinctureIssues(nd(pair(div('per-pale', 'gules', 'argent'), group(charge('lion'), 'argent'), group(charge('rose'), 'gules'))))).toEqual([]);
    expect(tinctureIssues(nd(pair(div('per-pale', 'gules', 'argent'), group(charge('rose'), 'gules'), group(charge('lion'), 'argent'))))).toHaveLength(2);
  });

  it('may be counterchanged together, each in one part of the field (SENA A5G3a)', () => {
    const d = nd(pair(div('per-fess', 'argent', 'sable'), group(charge('sun'), 'counterchanged'), group(charge('fleur-de-lis'), 'counterchanged')));
    expect(tinctureIssues(d)).toEqual([]);
    // One alone, lying wholly in one part, would simply be the other tincture.
    expect(tinctureIssues(nd(arms(div('per-fess', 'argent', 'sable'), group(charge('sun'), 'counterchanged', { arrangement: 'single', position: 'chief' })))).map((i) => i.code)).toEqual(['tincture']);
  });
});

describe('the blazon and its words', () => {
  it('joins the groups with "and" and says the tincture once when they share it', () => {
    expect(blazon(nd(pair('azure', lion('or'), rose('argent', { arrangement: 'in-fess' }))))).toBe('Azure, in fess a lion Or and a rose argent.');
    expect(blazon(nd(pair('azure', lion('or'), rose('or', { arrangement: 'in-pale' }))))).toBe('Azure, in pale a lion and a rose Or.');
    expect(blazon(nd(pair(div('per-chevron', 'argent', 'sable'), lion('or', { count: 2 }), rose('azure'))))).toBe('Per chevron argent and sable, two lions Or and a rose azure.');
  });

  it('leaves out what Table 7 gives and states it for the comparison', () => {
    const d = nd(pair(div('per-pale', 'argent', 'azure'), lion('sable'), rose('or')));
    expect(blazon(d)).toBe('Per pale argent and azure, a lion sable and a rose Or.');
    expect(blazon(d, { stateDefaults: true })).toBe('Per pale argent and azure, in fess a lion rampant sable and a rose Or.');
  });

  it('is tagged for search as both charges and as two main pictures', () => {
    const tags = deriveTags(nd(pair('azure', lion('or'), rose('argent', { arrangement: 'in-fess' }))));
    expect(tags).toEqual(expect.arrayContaining(['charge:lion', 'charge:rose', 'placement:co-primary', 'layout:in-fess']));
    expect(deriveTags(nd(arms('azure', lion('or'))))).not.toContain('placement:co-primary');
  });

  it('is glossed and signed', () => {
    const d = nd(pair(div('per-pale', 'argent', 'azure'), lion('sable'), rose('or')));
    expect(gloss(d)).toBe('A shield split vertically, white on the left and blue on the right, with a black lion rearing up and a gold rose, in a row.');
    expect(signature(d)).toContain('P:c.lion.rampant:1:in-fess:sa|P:c.rose:1:in-fess:or');
  });
});

describe('how they differ', () => {
  const key = (d: Design) => candidateKey(d);
  it('are one primary group: a shared type is not a substantial change', () => {
    const lr = nd(pair('azure', lion('or'), rose('argent', { arrangement: 'in-fess' })));
    const lw = nd(pair('azure', lion('or'), group(charge('mullet'), 'argent', { arrangement: 'in-fess' })));
    expect(differences(lr, lw).map((x) => `${x.attr}:${x.kind}`)).toEqual(['type:dc']);
    const wolfBoar = nd(pair('azure', group(charge('wolf'), 'or'), group(charge('boar'), 'argent', { arrangement: 'in-fess' })));
    expect(differences(lr, wolfBoar).some((x) => x.attr === 'type' && x.kind === 'sc')).toBe(true);
  });

  it('differ from one picture by the total number of pictures', () => {
    const two = nd(pair('azure', lion('or'), rose('argent', { arrangement: 'in-fess' })));
    const one = nd(arms('azure', lion('or')));
    expect(differences(two, one).map((x) => x.attr)).toContain('number');
    expect(isClear(differences(two, one))).toBe(true);
    const three = nd(pair('azure', lion('or', { count: 2 }), rose('argent')));
    expect(isClear(differences(two, three))).toBe(true);
  });

  it('key the registry by any primary, so entries with a primary may conflict', () => {
    const two = nd(pair('azure', lion('or'), rose('argent', { arrangement: 'in-fess' })));
    const one = nd(arms('azure', lion('or')));
    const bend = nd(arms('azure', group(ordinary('bend'), 'or')));
    const fieldOnly = nd(arms('azure', group(ordinary('chief'), 'or')));
    expect(key(two).primary).toBe('*');
    expect(keysMayConflict(key(two), key(one))).toBe(true);
    expect(keysMayConflict(key(one), key(two))).toBe(true);
    expect(keysMayConflict(key(two), key(bend))).toBe(true);
    expect(keysMayConflict(key(one), key(bend))).toBe(false);
    expect(keysMayConflict(key(two), key(nd(arms(div('per-pale', 'or', 'azure'), lion('sable')))))).toBe(false);
    expect(fieldOnly).toBeTruthy();
  });
});

describe('the builder', () => {
  const start = nd(arms('azure', group(charge('lion'), 'or')));

  it('adds a second picture beside the first, laid out with it', () => {
    const choice = layerChoices(start).find((c) => c.value === 'co-primary');
    expect(choice).toEqual({ value: 'co-primary', allowed: true });
    const two = addLayer(start, 'co-primary');
    expect(placesOf(two).map((p) => p.place)).toEqual(['picture', 'co-primary']);
    expect(structuralIssues(two)).toEqual([]);
    expect(tinctureIssues(two)).toEqual([]);
    expect(unsupportedIssues(two)).toEqual([]);
    expect(layerPath(two, 'co-primary')).toEqual([1]);
  });

  it('keeps the two laid out together when a count changes, and refuses more than three charges', () => {
    const two = addLayer(start, 'co-primary');
    const three = setCount(two, pathOfPlace(two, 'picture')!, 2);
    expect(three.groups.map((g) => g.count)).toEqual([2, 1]);
    expect(three.groups[0].arrangement).toEqual(three.groups[1].arrangement);
    expect(structuralIssues(three)).toEqual([]);
    const four = setCount(three, pathOfPlace(three, 'co-primary')!, 2);
    expect(four).toEqual(three);
  });

  it('removes the second picture, or promotes it when the first goes', () => {
    const two = addLayer(start, 'co-primary');
    expect(removeLayer(two, 'co-primary')).toEqual(start);
    const only = setCharge(two, 'picture', null);
    expect(only.groups).toHaveLength(1);
    expect(structuralIssues(only)).toEqual([]);
    expect(simpleParts(only).coPrimary).toBeNull();
  });

  it('is not offered beside a band, around the picture or with pictures on it', () => {
    const band = nd(arms('azure', group(ordinary('fess'), 'or'), group(charge('rose'), 'argent')));
    expect(layerChoices(band).find((c) => c.value === 'co-primary')).toMatchObject({ allowed: false });
    const around = addLayer(start, 'around');
    expect(layerChoices(around).find((c) => c.value === 'co-primary')).toMatchObject({ allowed: false, reason: expect.stringMatching(/around/) });
    const carried = addLayer(start, 'on-picture');
    expect(layerChoices(carried).find((c) => c.value === 'co-primary')).toMatchObject({ allowed: false });
    // And two main pictures take none of those.
    expect(layerChoices(addLayer(start, 'co-primary')).filter((c) => ['around', 'on-picture', 'overall'].includes(c.value)).every((c) => !c.allowed)).toBe(true);
  });

  it('normalises like any design', () => {
    const d = addLayer(start, 'co-primary');
    expect(normalise(d).ok).toBe(true);
    expect(walkGroups(d)).toHaveLength(2);
  });
});
