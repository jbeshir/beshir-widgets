// A band or picture divided in two tinctures ("a heart per pale azure and Or", "a cross quarterly Or and gules"):
// what is drawn, how it is blazoned and judged, how the builder offers it, and that the SCA records it unlocks are built.

import { describe, expect, it } from 'vitest';
import {
  asParty, blazon, canonicalJson, deriveTags, differences, fillCode, gloss, groupAt, normalise, partyDivisionChoices, partyTinctureChoices, renderLayers, setPartyDivision,
  setPartyTincture, signature, splitGroup, structuralIssues, tinctureIssues, unsupportedIssues, type Design,
} from '../src/lib/heraldry';
import { setGroupTincture } from '../src/lib/builder';
import { builderPath } from './builder-path';
import { checkBlazon } from './sca/classify';
import { renderShieldSvg } from './sca/widget-checks';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const party = (division: string, a: string, b: string) => div(division, a, b);
const heart = (paint: unknown, extra: object = {}) => group(charge('heart'), paint, extra);
const messages = (d: Design) => [...structuralIssues(d), ...tinctureIssues(d)].map((i) => i.message);

describe('what is supported', () => {
  it('draws a band or picture divided by any drawn division into two plain tinctures', () => {
    expect(unsupportedIssues(nd(arms('gules', heart(party('per-pale', 'azure', 'or')))))).toEqual([]);
    expect(unsupportedIssues(nd(arms('sable', group(ordinary('cross'), party('quarterly', 'or', 'gules')))))).toEqual([]);
    expect(unsupportedIssues(nd(arms('gules', group(ordinary('bordure'), party('per-saltire', 'or', 'azure')))))).toEqual([]);
  });

  it('leaves a division, line, piece count or part the builder does not draw as a gap', () => {
    const gaps = (paint: unknown) => unsupportedIssues(nd(arms('gules', heart(paint)))).map((i) => `${i.gap.category}:${i.gap.detail}`);
    expect(gaps(party('gyronny', 'azure', 'or'))).toEqual(['division:gyronny']);
    expect(gaps({ k: 'divided', division: 'per-pale', lines: { a: 'wavy' }, parts: ['azure', 'or'] })).toEqual(['line-of-partition:wavy']);
    expect(gaps({ k: 'divided', division: 'per-pale', parts: [{ k: 'fur', fur: 'ermine' }, 'or'] })).toEqual(['fur:party']);
    expect(gaps({ k: 'divided', division: 'per-pale', parts: ['azure', 'counterchanged'] })).toEqual(['tincture:counterchanged']);
  });
});

describe('the design text', () => {
  const d = nd(arms('gules', heart(party('per-pale', 'azure', 'or'))));

  it('blazons a divided group as the College writes it, each charge divided when there are several', () => {
    expect(blazon(d)).toBe('Gules, a heart per pale azure and Or.');
    expect(blazon(nd(arms('or', heart(party('per-pale', 'gules', 'sable'), { count: 3 }))))).toBe('Or, three hearts each per pale gules and sable.');
    expect(blazon(nd(arms(party('quarterly', 'sable', 'or'), group(ordinary('cross'), party('quarterly', 'or', 'gules'))))))
      .toBe('Quarterly sable and Or, a cross quarterly Or and gules.');
    expect(blazon(nd(arms(party('per-pale', 'sable', 'argent'), group(ordinary('bordure'), party('per-pale', 'argent', 'azure'))))))
      .toBe('Per pale sable and argent, a bordure per pale argent and azure.');
  });

  it('glosses the split in plain words', () => {
    expect(gloss(d)).toBe('A red shield with a heart split vertically, blue on the left and gold on the right.');
    expect(gloss(nd(arms('or', group(ordinary('fess'), party('per-fess', 'gules', 'sable'))))))
      .toBe('A gold shield with a horizontal band across the middle split horizontally, red on top and black below.');
  });

  it('is told apart in the signature, the tags and the differences', () => {
    const swapped = nd(arms('gules', heart(party('per-pale', 'or', 'azure'))));
    const fess = nd(arms('gules', heart(party('per-fess', 'azure', 'or'))));
    expect(new Set([signature(d), signature(swapped), signature(fess)]).size).toBe(3);
    expect(deriveTags(d)).toEqual(expect.arrayContaining(['charge-tincture:azure', 'charge-tincture:or', 'tincture:azure', 'tincture:or']));
    // CC-12: swapping the two tinctures, or the way they are divided, is a distinct change.
    expect(differences(d, swapped).map((x) => `${x.attr}:${x.kind}`)).toEqual(['tincture:dc']);
    expect(differences(d, fess).map((x) => `${x.attr}:${x.kind}`)).toEqual(['tincture:dc']);
    expect(differences(d, d)).toEqual([]);
  });
});

describe('the rule of tincture for a divided group', () => {
  it('judges a heart per pale azure and Or as neutral: it stands out on gules, not on azure', () => {
    expect(messages(nd(arms('gules', heart(party('per-pale', 'azure', 'or')))))).toEqual([]);
    expect(messages(nd(arms('azure', heart(party('per-pale', 'azure', 'or'))))))
      .toEqual(['Per pale Azure and Or heart on Azure field: same tincture']);
  });

  it('judges two colours as a colour and two metals as a metal', () => {
    expect(messages(nd(arms('or', heart(party('per-pale', 'azure', 'gules')))))).toEqual([]);
    expect(messages(nd(arms('sable', heart(party('per-pale', 'azure', 'gules')))))).toEqual(['Per pale Azure and Gules heart on Sable field: colour on colour']);
    expect(messages(nd(arms('argent', heart(party('per-fess', 'argent', 'or')))))).toEqual(['Per fess Argent and Or heart on Argent field: same tincture']);
    expect(messages(nd(arms('vert', heart(party('per-fess', 'argent', 'or')))))).toEqual([]);
  });

  it('lets each part stand on the section of a divided field it lies on, where the divisions line up', () => {
    // A3B4b: each part contrasts with the section under it.
    expect(messages(nd(arms(party('per-pale', 'sable', 'argent'), group(ordinary('bordure'), party('per-pale', 'argent', 'azure')))))).toEqual([]);
    expect(messages(nd(arms(party('quarterly', 'sable', 'or'), group(ordinary('cross'), party('quarterly', 'or', 'gules')))))).toEqual([]);
    // Cut the other way, the argent half lies on argent as well as on sable.
    expect(messages(nd(arms(party('per-pale', 'sable', 'argent'), group(ordinary('bordure'), party('per-fess', 'argent', 'azure'))))))
      .toEqual(['Per fess Argent and Azure bordure lies on the Argent part of the field: same tincture']);
  });

  it('judges what lies on a divided band against the band as a whole', () => {
    const on = (rose: string) => nd(arms('gules', group(ordinary('fess'), party('per-pale', 'argent', 'azure'), { charged: [group(charge('mullet'), rose, { count: 2 })] })));
    expect(messages(on('or'))).toEqual([]);
    expect(messages(on('azure'))).toEqual(['Azure mullets on the Per pale Argent and Azure fess: same tincture']);
  });
});

describe('the structure of a divided group', () => {
  it('needs two different tinctures', () => {
    expect(structuralIssues(nd(arms('gules', heart(party('per-pale', 'azure', 'azure'))))).map((i) => i.message))
      .toEqual(['A divided heart needs two different tinctures — both parts are Azure.']);
  });

  it('needs a division that cuts across a band', () => {
    expect(messages(nd(arms('azure', group(ordinary('chief'), party('per-fess', 'argent', 'or')))))).toEqual([]);
    expect(messages(nd(arms('azure', group(ordinary('chief'), party('per-pale', 'argent', 'or')))))).toEqual([]);
    expect(messages(nd(arms('azure', group(ordinary('pile'), party('per-fess', 'argent', 'or')))))).toEqual([]);
    expect(messages(nd(arms('azure', group(ordinary('chief'), party('per-saltire', 'argent', 'or'))))).length).toBe(0);
  });

  it('does not divide a long charge per chevron (RULES CC-11)', () => {
    expect(messages(nd(arms('azure', group(charge('sword'), party('per-chevron', 'argent', 'or'))))))
      .toEqual(["A long sword can't be divided per chevron — it would read as per fess (RULES CC-11)."]);
    expect(messages(nd(arms('azure', group(charge('sword'), party('per-pale', 'argent', 'or')))))).toEqual([]);
  });
});

describe('the drawing', () => {
  it('splits an ordinary through its fess point and each charge through its own centre', () => {
    const fess = renderLayers(nd(arms('gules', group(ordinary('fess'), party('per-pale', 'argent', 'azure')))), 'heater')[1];
    expect(fess.k === 'ordinary' && fillCode(fess.fill)).toBe('split(ar,az)');
    const hearts = renderLayers(nd(arms('gules', heart(party('per-pale', 'azure', 'or'), { count: 3 }))), 'heater')[1];
    expect(hearts.k === 'charges' && hearts.fills.map((f) => [fillCode(f.fill), f.slots])).toEqual([['split(az,or)', [0]], ['split(az,or)', [1]], ['split(az,or)', [2]]]);
  });

  it('is in the markup of the shield, with each part clipped', () => {
    const svg = renderShieldSvg(nd(arms('gules', heart(party('per-pale', 'azure', 'or')))));
    expect(svg).toContain('data-paint="az"');
    expect(svg).toContain('data-paint="or"');
  });

  it('turns the split with a charge that is turned', () => {
    const d = nd(arms('azure', group(ordinary('bend'), 'argent', { charged: [group(charge('mullet'), party('per-pale', 'gules', 'sable'), { count: 2 })] })));
    const layer = renderLayers(d, 'heater').find((l) => l.k === 'charges');
    const first = layer?.k === 'charges' ? layer.fills[0].fill : null;
    expect(first?.k === 'split' && first.parts[0].clip).not.toBe('');
  });
});

describe('the builder offers the split', () => {
  const base = nd(arms('gules', heart('azure')));
  const path = [0];

  it('splits a picture into the first division and tinctures that work, keeping its own', () => {
    const split = splitGroup(base, path)!;
    expect(blazon(split)).toBe('Gules, a heart per pale azure and Or.');
    expect(messages(split)).toEqual([]);
  });

  it('keeps one part when the other changes, and moves the other only when it would no longer stand out', () => {
    const split = splitGroup(base, path)!;
    expect(blazon(setPartyTincture(split, path, 1, 'argent'))).toBe('Gules, a heart per pale azure and argent.');
    // Part one to sable: Or stays (sable and Or stand out on gules).
    expect(blazon(setPartyTincture(split, path, 0, 'sable'))).toBe('Gules, a heart per pale sable and Or.');
    // Part one to gules would share the field's tincture: that choice is blocked.
    expect(partyTinctureChoices(split, path, 0).find((c) => c.value === 'gules')).toMatchObject({ allowed: false });
  });

  it('blocks the other part’s tincture, and a division that misses the band', () => {
    const split = splitGroup(base, path)!;
    const blocked = partyTinctureChoices(split, path, 1).find((c) => c.value === 'azure');
    expect(blocked).toEqual({ value: 'azure', allowed: false, reason: 'The other part is already Azure — a divided heart needs two different tinctures.' });
    const chief = splitGroup(nd(arms('gules', group(ordinary('chief'), 'or'))), path)!;
    expect(partyDivisionChoices(chief, path).every((c) => c.allowed)).toBe(true);
    const sword = splitGroup(nd(arms('gules', group(charge('sword'), 'or'))), path)!;
    expect(partyDivisionChoices(sword, path).find((c) => c.value === 'per-chevron')).toMatchObject({ allowed: false });
  });

  it('changes the division, and joins back into one tincture when one colour is picked', () => {
    const split = setPartyDivision(splitGroup(base, path)!, path, 'per-fess');
    expect(asParty(groupAt(split, path).paint)?.division).toBe('per-fess');
    expect(blazon(setGroupTincture(split, path, 'or'))).toBe('Gules, a heart Or.');
  });
});

describe('every design is built by clicks the builder offers and allows', () => {
  const designs: Array<[string, unknown, string]> = [
    ['a heart per pale azure and Or (O&A 40141)', arms('gules', heart(party('per-pale', 'azure', 'or'))), 'Gules, a heart per pale azure and Or.'],
    ['a fleur-de-lys per pale argent and Or on a divided field (O&A 24062)', arms(party('per-pale', 'sable', 'vert'), group(charge('fleur-de-lis'), party('per-pale', 'argent', 'or'))),
      'Per pale sable and vert, a fleur-de-lys per pale argent and Or.'],
    ['a cross quarterly Or and gules on a quarterly field (O&A 28795)', arms(party('quarterly', 'sable', 'or'), group(ordinary('cross'), party('quarterly', 'or', 'gules'))),
      'Quarterly sable and Or, a cross quarterly Or and gules.'],
    ['a bordure per pale (O&A 56201)', arms(party('per-pale', 'sable', 'argent'), group(ordinary('bordure'), party('per-pale', 'argent', 'azure'))),
      'Per pale sable and argent, a bordure per pale argent and azure.'],
    ['a swapped pair of tinctures', arms('or', heart(party('per-bend', 'gules', 'azure'))), 'Or, a heart per bend gules and azure.'],
    ['three hearts each divided', arms('or', heart(party('per-pale', 'gules', 'sable'), { count: 3 })), 'Or, three hearts each per pale gules and sable.'],
    ['a chief per fess', arms('azure', group(charge('lion'), 'or'), group(ordinary('chief'), party('per-fess', 'argent', 'gules'))),
      'Azure, a lion Or, a chief per fess argent and gules.'],
  ];

  for (const [label, input, text] of designs) {
    it(label, () => {
      const goal = nd(input);
      expect(blazon(goal)).toBe(text);
      const path = builderPath(goal);
      expect(path.problems).toEqual([]);
      expect(canonicalJson(path.design)).toBe(canonicalJson(goal));
      expect(normalise(goal).ok).toBe(true);
    });
  }
});

describe('the SCA records it unlocks', () => {
  it.each([
    ['Gules, a heart per pale azure and Or.'],
    ['Per pale sable and vert, a fleur-de-lys per pale argent and Or.'],
    ['Quarterly sable and Or, a cross quarterly Or and gules.'],
    ['Per pale gules and Or, a fleur-de-lys counterchanged Or and sable.'],
    ['Or, three hearts each per pale gules and sable.'],
  ])('%s', (text) => {
    expect(checkBlazon(text).failures).toEqual([]);
  });
});
