// A band or picture lying across everything ("a fess and overall a lion", SENA App I4): resolve and the structure
// rules, the rule of tincture (judged on the field alone), the blazon, where it is drawn and in what order, how it
// differs from other arms, and the builder's layer for it.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, addLayer, blazon, canonicalJson, contextSlots, differences, gloss, groupAt, layerChoices, layerItemChoices, layerPath, normalise, pathOfPlace, placesOf,
  removeLayer, renderLayers, setLayerItem, signature, structuralIssues, tinctureIssues, unsupportedIssues, walkGroups, MIN_SLOT_SIZE, fieldContext, type Design,
} from '../src/lib/heraldry';
import { setCharge, setOrdinary } from '../src/lib/builder';
import { builderPath } from './builder-path';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const lion = (paint = 'argent', extra: object = {}) => group(charge('lion'), paint, extra);
const over = (item: object, paint: string, extra: object = {}) => group(item, paint, { role: 'overall', ...extra });
const structure = (input: unknown) => structuralIssues(nd(input)).map((i) => (i.code === 'structure' ? `${i.rule}: ${i.message}` : i.message));

describe('what lies overall', () => {
  it('is a band over a picture, a picture over a band, or crossed swords over a picture', () => {
    expect(structure(arms('azure', lion(), over(ordinary('bend'), 'gules')))).toEqual([]);
    expect(structure(arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'or')))).toEqual([]);
    expect(structure(arms('argent', group(charge('rose'), 'gules'), over(charge('sword'), 'sable', { count: 2, arrangement: 'crossed' })))).toEqual([]);
    expect(structure(arms('azure', lion(), over(charge('sword'), 'gules')))).toEqual([]);
  });

  it('is the last-painted group but the peripherals, whatever order the input gives', () => {
    const d = nd(arms('gules', group(ordinary('bordure'), 'argent'), over(charge('lion'), 'or'), group(ordinary('fess'), 'argent'), group(ordinary('chief'), 'argent')));
    expect(d.groups.map((g) => g.role)).toEqual(['primary', 'overall', 'peripheral', 'peripheral']);
    const layers = renderLayers(d, 'heater').map((l) => l.k);
    expect(layers).toEqual(['field', 'ordinary', 'charges', 'ordinary', 'ordinary']);
  });

  it('needs a main band or picture to lie over', () => {
    expect(structure(arms('argent', over(ordinary('bend'), 'gules')))).toEqual([expect.stringMatching(/^overall: Something overall lies over/)]);
    expect(structure(arms('argent', group(ordinary('chief'), 'sable'), over(ordinary('bend'), 'gules')))).toEqual([expect.stringMatching(/^overall: Something overall/)]);
  });

  it('is only one group', () => {
    expect(structure(arms('azure', lion(), over(ordinary('bend'), 'gules'), over(charge('sword'), 'or')))).toEqual([expect.stringMatching(/^overall: There can be only one group overall/)]);
  });

  it('needs a band or a long charge on one side (App I4)', () => {
    expect(structure(arms('azure', lion(), over(charge('rose'), 'gules')))).toEqual([expect.stringMatching(/^overall: A rose overall must lie over a band/)]);
    expect(structure(arms('azure', group(ordinary('bend'), 'or'), over(charge('rose'), 'gules')))).toEqual([]);
  });

  it('is one charge over several primary charges: several overall must surmount a single one (App I4)', () => {
    const swords = over(charge('sword'), 'sable', { count: 2, arrangement: 'crossed' });
    const several = /^overall: Two swords overall can only lie over a single main picture or band/;
    expect(structure(arms('argent', group(charge('rose'), 'gules', { count: 3 }), swords))).toEqual([expect.stringMatching(several)]);
    expect(structure(arms('argent', group(charge('rose'), 'gules'), group(charge('lion'), 'gules'), swords))).toEqual([expect.stringMatching(several)]);
    expect(structure(arms('argent', group(charge('rose'), 'gules', { count: 3 }), over(charge('sword'), 'sable')))).toEqual([]);
    expect(structure(arms('argent', group(ordinary('fess'), 'gules'), swords))).toEqual([]);
  });

  it("can't be the main band's own kind, or a charge the field already has", () => {
    expect(structure(arms('azure', group(ordinary('fess'), 'or'), over(ordinary('fess'), 'argent')))).toEqual([expect.stringMatching(/^overall: The fess can't lie overall over another fess/)]);
    expect(structure(arms('azure', group(charge('sword'), 'argent'), over(charge('sword'), 'or')))).toEqual([expect.stringMatching(/^same-type: A sword can't be used again/)]);
  });

  it('draws bands that cross the middle and one charge, or two long ones crossed, and gaps the rest', () => {
    const gaps = (input: unknown) => unsupportedIssues(nd(input)).map((i) => `${i.gap.category}:${i.gap.detail}`);
    expect(gaps(arms('azure', lion(), over(ordinary('pile'), 'argent')))).toEqual(['placement:overall-pile']);
    expect(gaps(arms('azure', lion(), over(ordinary('chief'), 'argent')))).toEqual(['placement:overall-chief']);
    expect(gaps(arms('azure', group(ordinary('bend'), 'or'), over(charge('rose'), 'gules', { count: 3 })))).toEqual(['placement:overall-3']);
    expect(gaps(arms('azure', group(ordinary('bend'), 'or'), over(charge('rose'), 'gules', { count: 2 })))).toEqual(['placement:overall-2']);
    expect(gaps(arms('azure', lion(), over(ordinary('bend'), 'gules', { charged: [group(charge('rose'), 'argent')] })))).toEqual(['multiple-groups:tertiary-on-overall']);
    expect(gaps(arms('azure', group(ordinary('bend'), 'or'), over(charge('sword'), 'argent', { charged: [group(charge('rose'), 'gules')] })))).toEqual(['multiple-groups:tertiary-on-overall']);
  });

  it('does not make the other groups secondary', () => {
    const d = nd(arms('azure', lion(), over(ordinary('bend'), 'gules')));
    expect(d.groups.map((g) => g.role)).toEqual(['primary', 'overall']);
    expect(placesOf(d).map((p) => p.place)).toEqual(['picture', 'overall']);
    const band = nd(arms('azure', over(ordinary('bend'), 'gules'), group(ordinary('fess'), 'or')));
    expect(placesOf(band).map((p) => p.place)).toEqual(['ordinary', 'overall']);
  });
});

describe('the rule of tincture overall', () => {
  it('judges a group overall against the field, not against what it lies over (A3B4a)', () => {
    // The lion is argent, the bend argent too: touching charges need not contrast, but both must contrast with the field.
    expect(tinctureIssues(nd(arms('gules', lion(), over(ordinary('bend'), 'argent'))))).toEqual([]);
    expect(tinctureIssues(nd(arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'argent'))))).toEqual([]);
    expect(tinctureIssues(nd(arms('azure', lion(), over(ordinary('bend'), 'gules')))).map((i) => i.message)).toEqual(['Gules bend on Azure field: colour on colour']);
  });

  it('is never forced into one part of a divided field', () => {
    const d = nd(arms(div('per-pale', 'argent', 'sable'), group(ordinary('fess'), 'gules'), over(charge('lion'), 'argent')));
    expect(unsupportedIssues(d)).toEqual([]);
    expect(tinctureIssues(d).map((i) => i.code)).toEqual(['tincture']);
  });

  it('may be counterchanged where it crosses the line of division', () => {
    const d = nd(arms(div('per-pale', 'argent', 'sable'), group(ordinary('fess'), 'gules'), over(ordinary('chevron'), 'counterchanged')));
    expect(tinctureIssues(d)).toEqual([]);
  });
});

describe('the blazon and its words', () => {
  it('says "and overall" after what it lies over, before a chief or bordure', () => {
    expect(blazon(nd(arms('argent', group(ordinary('saltire'), 'purpure'), over(charge('lion'), 'sable'))))).toBe('Argent, a saltire purpure and overall a lion sable.');
    expect(blazon(nd(arms('azure', group(ordinary('bend'), 'argent'), over(charge('open-book'), 'or'))))).toBe('Azure, a bend argent and overall an open book Or.');
    expect(blazon(nd(arms(div('per-pale', 'gules', 'sable'), lion(), over(ordinary('fess'), 'or'))))).toBe('Per pale gules and sable, a lion argent and overall a fess Or.');
    expect(blazon(nd(arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'or'), group(ordinary('bordure'), 'argent'))))).toBe('Gules, a fess argent and overall a lion Or, a bordure argent.');
  });

  it('states two crossed swords and leaves a single charge unstated', () => {
    expect(blazon(nd(arms('argent', group(charge('rose'), 'gules'), over(charge('sword'), 'sable', { count: 2, arrangement: 'crossed' }))))).toBe('Argent, a rose gules and overall two swords in saltire sable.');
    expect(blazon(nd(arms('argent', group(charge('rose'), 'gules'), over(charge('sword'), 'sable'))), { stateDefaults: true })).toBe('Argent, a rose gules and overall a sword sable.');
  });

  it('shares a tincture with what comes before and after it', () => {
    expect(blazon(nd(arms('azure', group(ordinary('bend'), 'argent'), over(charge('lion'), 'argent'))))).toBe('Azure, a bend and overall a lion argent.');
    expect(blazon(nd(arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'argent'), group(ordinary('bordure'), 'argent'))))).toBe('Gules, a fess and overall a lion and a bordure argent.');
  });

  it('is glossed and signed', () => {
    const d = nd(arms('argent', group(ordinary('saltire'), 'purpure'), over(charge('lion'), 'sable')));
    expect(gloss(d)).toBe('A white shield with a purple X-shaped cross and across all of it, a black lion rearing up.');
    expect(signature(d)).toBe('arms|ar|P:o.saltire:1:single:pu|O:c.lion.rampant:1:single:sa');
  });
});

describe('where it is drawn', () => {
  const overall = (design: Design) => walkGroups(design).find((w) => w.group.role === 'overall')!.path;

  it('stands as a lone primary charge does, in what the chief and bordure leave', () => {
    for (const peripheral of ['none', 'chief', 'bordure', 'chief-bordure'] as const) {
      for (const shape of FIELD_SHAPES) {
        const slots = contextSlots({ k: 'overall', peripheral }, 1, { arrangement: { k: 'single' }, position: null }, shape);
        expect(slots, `${peripheral} ${shape}`).toEqual(contextSlots(fieldContext(peripheral), 1, { arrangement: { k: 'single' }, position: null }, shape));
        expect(slots[0].size).toBeGreaterThanOrEqual(MIN_SLOT_SIZE);
      }
    }
  });

  it('fits two crossed swords in every shape', () => {
    const crossed = { arrangement: { k: 'crossed' }, position: null } as const;
    for (const shape of FIELD_SHAPES) expect(contextSlots({ k: 'overall', peripheral: 'none' }, 2, crossed, shape)).toHaveLength(2);
  });

  it('draws the band with the ordinary path and the charge in its slot, over the primary', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'argent'), over(charge('lion'), 'gules')));
    const layers = renderLayers(d, 'heater');
    expect(layers.map((l) => l.k)).toEqual(['field', 'ordinary', 'charges']);
    expect(layers[2]).toMatchObject({ k: 'charges', path: overall(d) });
  });
});

describe('how it differs', () => {
  const base = arms('gules', group(ordinary('fess'), 'argent'));
  it('counts a group overall added or taken away as one distinct change', () => {
    const withLion = nd(arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'or')));
    expect(differences(withLion, nd(base)).map((d) => [d.attr, d.kind])).toEqual([['group-presence', 'dc']]);
  });

  it('compares groups overall with each other', () => {
    const a = nd(arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'or')));
    const b = nd(arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'argent')));
    expect(differences(a, b).map((d) => [d.attr, d.kind])).toEqual([['tincture', 'dc']]);
  });

  it('does not mistake a group overall for a secondary one', () => {
    const overallBend = nd(arms('azure', lion(), over(ordinary('bend'), 'argent')));
    const secondaryBend = nd(arms('azure', lion(), group(ordinary('bend'), 'argent', { role: 'secondary', relation: 'about' })));
    expect(signature(overallBend)).not.toBe(signature(secondaryBend));
  });
});

describe('the builder layer', () => {
  const built = (input: unknown): Design => {
    const r = normalise(input);
    if (!r.ok) throw new Error(JSON.stringify(r));
    return r.design;
  };

  it('is offered once there is a main band or picture, and starts as a picture over a band, a band over a picture', () => {
    const empty = built(arms('azure', group(ordinary('chief'), 'argent')));
    expect(layerChoices(empty).find((c) => c.value === 'overall')).toMatchObject({ allowed: false });
    const onBand = addLayer(built(arms('azure', group(ordinary('fess'), 'argent'))), 'overall');
    expect(groupAt(onBand, layerPath(onBand, 'overall')!).item).toMatchObject({ k: 'charge' });
    const onPicture = addLayer(built(arms('azure', lion())), 'overall');
    expect(groupAt(onPicture, layerPath(onPicture, 'overall')!).item).toMatchObject({ k: 'ordinary', type: 'bend' });
    expect(normalise(onBand).ok && normalise(onPicture).ok).toBe(true);
  });

  it('starts with a picture the field has none of', () => {
    const d = addLayer(built(arms('azure', group(ordinary('fess'), 'argent'), group(charge('mullet'), 'or', { count: 3, position: 'chief' }))), 'overall');
    expect(groupAt(d, layerPath(d, 'overall')!).item).toMatchObject({ charge: 'heart' });
  });

  it('can be changed to another band or picture, and blocks what App I4 does not allow, with its reason', () => {
    const d = addLayer(built(arms('azure', lion())), 'overall');
    const choices = layerItemChoices(d, 'overall');
    const find = (item: object) => choices.find((c) => JSON.stringify(c.value) === JSON.stringify(item))!;
    expect(find({ k: 'ordinary', type: 'fess' })).toMatchObject({ allowed: true });
    expect(find({ k: 'charge', charge: 'sword' })).toMatchObject({ allowed: true });
    expect(find({ k: 'charge', charge: 'rose' })).toMatchObject({ allowed: false, reason: expect.stringContaining('must lie over a band') });
    expect(find({ k: 'charge', charge: 'lion' })).toMatchObject({ allowed: false, reason: expect.stringContaining('already the main picture') });
    const sword = setLayerItem(d, 'overall', { k: 'charge', charge: 'sword' });
    expect(blazon(sword)).toBe('Azure, a lion argent and overall a sword Or.');
    const fess = setLayerItem(sword, 'overall', { k: 'ordinary', type: 'fess' });
    expect(blazon(fess)).toBe('Azure, a lion argent and overall a fess Or.');
  });

  it('goes with the band or picture it lies over: kept through edits, dropped when there is nothing to lie over', () => {
    const d = addLayer(built(arms('azure', lion())), 'overall');
    expect(pathOfPlace(setOrdinary(d, 'fess'), 'overall')).not.toBeNull();
    // Taking the picture away leaves nothing for it to lie over.
    expect(pathOfPlace(setCharge(d, 'picture', null), 'overall')).toBeNull();
    expect(canonicalJson(removeLayer(d, 'overall'))).toBe(canonicalJson(built(arms('azure', lion()))));
  });

  it('is built by clicks the builder allows', () => {
    for (const input of [
      arms('argent', group(ordinary('saltire'), 'purpure'), over(charge('lion'), 'sable')),
      arms('azure', group(ordinary('bend'), 'argent'), over(charge('open-book'), 'or')),
      arms('vert', group(ordinary('chevron'), 'argent'), over(charge('fleur-de-lis'), 'or')),
      arms(div('per-pale', 'gules', 'sable'), lion(), over(ordinary('fess'), 'or')),
      arms('gules', group(ordinary('fess'), 'argent'), over(charge('lion'), 'or'), group(ordinary('bordure'), 'argent')),
      arms('argent', group(charge('rose'), 'gules'), over(charge('sword'), 'sable', { count: 2, arrangement: 'crossed' }), group(ordinary('chief'), 'sable', { charged: [group(charge('rose'), 'argent', { count: 3 })] })),
    ]) {
      const goal = built(input);
      const path = builderPath(goal);
      expect(path.problems, blazon(goal)).toEqual([]);
      expect(canonicalJson(path.design)).toBe(canonicalJson(goal));
    }
  });
});
