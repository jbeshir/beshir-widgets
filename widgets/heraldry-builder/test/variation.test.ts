// Field variations: barry, paly, bendy, checky and the rest on the field — what is drawn, how it is blazoned and judged and
// told apart from other fields, how the builder offers it, and that the SCA records it unlocks are built.


import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PIECES, explainDifferences, VARIATIONS, VARIATION_PIECES, asVariation, blazon, deriveTags, differences, fieldRegions, fillCode, gloss, inFirstRegion, pointInPolygon, pathRings,
  groupVariationChoices, groupVariationTinctureChoices, joinGroup, ordinaryBox, renderLayers, setGroupVariation, setGroupVariationPieces, setGroupVariationTincture, shapeFrame, signature, structuralIssues, tinctureIssues, unsupportedIssues, variationRegions, candidateKey,
  type Design, type Variation,
} from '../src/lib/heraldry';
import { setPlainField, setVariation, setVariationPieces, setVariationTincture } from '../src/lib/builder';
import { builderPath } from './builder-path';
import { checkBlazon } from './sca/classify';
import { explainMatch } from './sca/match';
import { arms, charge, div, group, nd, ordinary } from './helpers';


const varied = (variation: string, a: string, b: string, pieces: number | null = null) => ({ k: 'variation', variation, pieces, parts: [a, b] });
const lion = (paint: unknown, extra: object = {}) => group(charge('lion'), paint, extra);
const messages = (d: Design) => [...structuralIssues(d), ...tinctureIssues(d)].map((i) => i.message);
const gaps = (d: unknown) => unsupportedIssues(nd(d)).map((i) => `${i.gap.category}:${i.gap.detail}`);
const between = (a: unknown, b: unknown) => differences(nd(a), nd(b)).map((d) => `${d.attr}:${d.kind}:${d.rule}`);


describe('what is supported', () => {
  it('draws every variation of two tinctures on the field, with the counts the builder offers', () => {
    for (const v of VARIATIONS) {
      expect(gaps(arms(varied(v, 'argent', 'azure'), lion('gules')))).toEqual([]);
    }
    for (const n of VARIATION_PIECES) expect(gaps(arms(varied('barry', 'argent', 'azure', n), lion('gules')))).toEqual([]);
  });


  it('leaves other counts, furs in the stripes and a varied part of the field as gaps', () => {
    expect(gaps(arms(varied('barry', 'argent', 'azure', 5), lion('gules')))).toEqual(['field-treatment:barry-pieces']);
    expect(gaps(arms({ k: 'variation', variation: 'paly', parts: [{ k: 'fur', fur: 'ermine' }, 'azure'] }, lion('gules')))).toEqual(['field-treatment:paly-fur']);
    expect(gaps(arms('azure', group(ordinary('bend'), varied('barry', 'argent', 'sable', 5))))).toEqual(['field-treatment:barry-pieces']);
    expect(gaps(arms({ k: 'divided', division: 'per-pale', parts: ['azure', varied('barry', 'argent', 'sable')] }, lion('gules')))).toEqual(['field-treatment:barry']);
  });
});


describe('the canonical form of a variation', () => {
  const fieldOf = (d: Design) => (d.kind === 'arms' ? asVariation(d.field) : null);
  const field = (v: string, pieces: number | null) => fieldOf(nd(arms(varied(v, 'argent', 'azure', pieces), lion('gules'))))!;


  it('counts the usual six stripes when none is given, and no stripes for a pattern with no count', () => {
    expect(field('barry', null).pieces).toBe(DEFAULT_PIECES);
    expect(field('barry', 8).pieces).toBe(8);
    expect(field('checky', null).pieces).toBeNull();
    expect(field('checky', 8).pieces).toBeNull();
  });
});


describe('the design text', () => {
  it('blazons each variation as the College writes it, with a count only when it is not six', () => {
    const words: Array<[string, number | null, string]> = [
      ['barry', null, 'Barry argent and azure, a lion gules.'],
      ['barry', 6, 'Barry argent and azure, a lion gules.'],
      ['barry', 8, 'Barry of eight argent and azure, a lion gules.'],
      ['paly', 4, 'Paly of four argent and azure, a lion gules.'],
      ['bendy', null, 'Bendy argent and azure, a lion gules.'],
      ['bendy-sinister', null, 'Bendy sinister argent and azure, a lion gules.'],
      ['chevronny', null, 'Chevronelly argent and azure, a lion gules.'],
      ['checky', null, 'Checky argent and azure, a lion gules.'],
      ['lozengy', null, 'Lozengy argent and azure, a lion gules.'],
      ['fusily', null, 'Fusily argent and azure, a lion gules.'],
      ['pily', null, 'Pily argent and azure, a lion gules.'],
      ['barry-bendy', null, 'Barry bendy argent and azure, a lion gules.'],
      ['paly-bendy', null, 'Paly bendy argent and azure, a lion gules.'],
    ];
    for (const [v, pieces, text] of words) expect(blazon(nd(arms(varied(v, 'argent', 'azure', pieces), lion('gules'))))).toBe(text);
  });


  it('tags the field, glosses it, and names the tinctures', () => {
    const d = nd(arms(varied('barry', 'argent', 'azure'), lion('gules')));
    expect(deriveTags(d)).toEqual(expect.arrayContaining(['field:barry', 'field-tincture:argent', 'field-tincture:azure']));
    expect(gloss(d)).toMatch(/^A shield of 6 horizontal stripes, white on top alternating with blue, with a /);
  });
});


describe('the rule of tincture', () => {
  it('judges a charge on the whole variation, which is neutral when it has a metal and a colour', () => {
    expect(messages(nd(arms(varied('barry', 'argent', 'azure'), lion('gules'))))).toEqual([]);
    expect(messages(nd(arms(varied('barry', 'argent', 'azure'), lion('or'))))).toEqual([]);
    expect(messages(nd(arms(varied('barry', 'argent', 'azure'), lion('azure'))))).toEqual(['Azure lion on Barry Argent and Azure field: same tincture']);
  });


  it('lets a band share a tincture with the stripes or cells, a charge not (SENA A3B4b)', () => {
    expect(messages(nd(arms(varied('lozengy', 'or', 'azure'), group(ordinary('chief'), 'azure'))))).toEqual([]);
    expect(messages(nd(arms(varied('pily', 'or', 'sable'), group(ordinary('bordure'), { k: 'divided', division: 'per-fess', parts: ['sable', 'or'] }))))).toEqual([]);
    expect(messages(nd(arms(varied('barry', 'argent', 'gules'), lion('sable'), group(ordinary('bordure'), 'gules'))))).toEqual([]);
    expect(messages(nd(arms(varied('checky', 'or', 'sable'), group(ordinary('bend'), 'or'))))).toEqual([]);
    expect(messages(nd(arms(varied('checky', 'or', 'sable'), lion('or'))))).toEqual(['Or lion on Checky Or and Sable field: same tincture']);
  });


  it('needs a metal and a colour for the stripes (SENA A3B3d)', () => {
    expect(messages(nd(arms(varied('barry', 'argent', 'or'), lion('gules'))))).toEqual(['Barry Argent and Or needs a metal and a colour — both are metals.']);
    expect(messages(nd(arms(varied('paly', 'azure', 'gules'), lion('or'))))).toEqual(['Paly Azure and Gules needs a metal and a colour — both are colours.']);
    expect(messages(nd(arms(varied('paly', 'azure', 'azure'), lion('or'))))).toEqual(['Paly Azure and Azure needs two different tinctures — both are Azure.']);
  });


  it('lets a central ordinary be counterchanged across simple stripes, and nothing else (CC-2, CC-3)', () => {
    expect(messages(nd(arms(varied('paly', 'sable', 'or'), group(ordinary('bend'), 'counterchanged'))))).toEqual([]);
    expect(messages(nd(arms(varied('barry', 'sable', 'or'), group(ordinary('saltire'), 'counterchanged'))))).toEqual([]);
    expect(messages(nd(arms(varied('barry', 'sable', 'or'), group(ordinary('fess'), 'counterchanged'))))[0]).toMatch(/along the stripes/);
    expect(messages(nd(arms(varied('paly', 'sable', 'or'), lion('counterchanged'))))[0]).toMatch(/CC-3/);
    expect(messages(nd(arms(varied('lozengy', 'sable', 'or'), group(ordinary('bend'), 'counterchanged'))))[0]).toMatch(/grid/);
    expect(messages(nd(arms(varied('pily', 'sable', 'or'), group(ordinary('bordure'), 'counterchanged'))))).toEqual([]);
    expect(messages(nd(arms(varied('barry', 'sable', 'or'), group(ordinary('bordure'), 'counterchanged'))))[0]).toMatch(/CC-9/);
  });


  it('draws a counterchanged bend in the other tinctures over each stripe it crosses', () => {
    const d = nd(arms(varied('paly', 'sable', 'or', 6), group(ordinary('bend'), 'counterchanged')));
    const fills = renderLayers(d, 'heater').map((l) => (l.k === 'ordinary' ? fillCode(l.fill) : ''));
    expect(fills.find(Boolean)).toBe('split(or,sa)');
  });
});


describe('regions', () => {
  const box = shapeFrame('heater').box;
  const sample = (variation: Variation, pieces: number | null) => {
    const [first, second] = variationRegions(variation, pieces, box).map((d) => pathRings(d));
    let wrong = 0;
    for (let x = 0.5; x < 100; x += 4.3) {
      for (let y = 0.5; y < 120; y += 4.7) {
        const inA = first.some((r) => pointInPolygon(x, y, r)), inB = second.some((r) => pointInPolygon(x, y, r));
        // Points near a boundary may land in both or neither by a hair; every other point is in exactly one, the one the membership test says.
        // Pily's first region is the whole box with the piles cut out of it (turning the other way), which a polygon test can't see: only its piles are tested.
        const inFirst = inFirstRegion(variation, pieces, box, x, y);
        if (variation === 'pily' ? inB === inFirst : inA === inB || inA !== inFirst) wrong++;
      }
    }
    return wrong;
  };


  it('draws the first tincture where the membership test says, and the second everywhere else, for every variation', () => {
    for (const v of VARIATIONS) {
      const pieces = v === 'barry' || v === 'paly' || v === 'bendy' || v === 'bendy-sinister' || v === 'chevronny' ? 6 : null;
      expect(sample(v, pieces), v).toBeLessThanOrEqual(12);
    }
  });


  it('starts barry with the first tincture at the top and paly at the left', () => {
    expect(inFirstRegion('barry', 6, box, 50, 5)).toBe(true);
    expect(inFirstRegion('barry', 6, box, 50, 25)).toBe(false);
    expect(inFirstRegion('paly', 6, box, 5, 50)).toBe(true);
    expect(inFirstRegion('paly', 6, box, 25, 50)).toBe(false);
    expect(inFirstRegion('checky', null, box, 5, 5)).toBe(true);
    expect(inFirstRegion('checky', null, box, 25, 5)).toBe(false);
  });


  it('fills the field with the two tinctures in one split fill, in every shape', () => {
    const d = nd(arms(varied('barry', 'argent', 'azure'), lion('gules')));
    if (d.kind !== 'arms') throw new Error('arms');
    for (const shape of ['heater', 'banner', 'round', 'lozenge'] as const) {
      expect(fieldRegions(d.field, shape).map((r) => r.paint.k)).toEqual(['tincture', 'tincture']);
    }
  });
});


describe('conflict', () => {
  const lionOn = (field: unknown) => arms(field, lion('gules'));


  it('puts a variation in the category of the division it multiplies, and the lattices together', () => {
    expect(between(lionOn(varied('barry', 'argent', 'azure')), lionOn(div('per-fess', 'argent', 'azure')))).toEqual(['field-style:dc:A5G1d']);
    expect(between(lionOn(varied('barry', 'argent', 'azure')), lionOn(div('per-pale', 'argent', 'azure')))).toEqual(['field-partition:sc:A5F1']);
    expect(between(lionOn(varied('pily', 'argent', 'azure')), lionOn(varied('paly', 'argent', 'azure')))).toEqual(['field-style:dc:A5G1b']);
    expect(between(lionOn(varied('checky', 'argent', 'azure')), lionOn(varied('lozengy', 'argent', 'azure')))).toEqual(['field-partition:sc:A5F1']);
    expect(between(lionOn(varied('lozengy', 'argent', 'azure')), lionOn(varied('fusily', 'argent', 'azure')))).toEqual([]);
    expect(between(lionOn(varied('barry-bendy', 'argent', 'azure')), lionOn(varied('paly-bendy', 'argent', 'azure')))).toEqual(['field-style:dc:A5G1b']);
    expect(candidateKey(nd(lionOn(varied('barry', 'argent', 'azure')))).partition).toBe(candidateKey(nd(lionOn(div('per-fess', 'argent', 'azure')))).partition);
  });


  it('counts pieces only up to four', () => {
    expect(between(lionOn(varied('barry', 'argent', 'azure', 4)), lionOn(varied('barry', 'argent', 'azure', 6)))).toEqual(['field-style:dc:A5G1d']);
    expect(between(lionOn(varied('barry', 'argent', 'azure', 6)), lionOn(varied('barry', 'argent', 'azure', 8)))).toEqual([]);
  });


  it('words the difference of a pattern or a count', () => {
    const notes = (a: unknown, b: unknown) => explainDifferences(nd(a), nd(b)).map((n) => `${n.text} — ${n.why}`);
    expect(notes(lionOn(varied('barry', 'argent', 'azure')), lionOn(div('per-fess', 'argent', 'azure')))).toEqual([
      'background pattern (barry ↔ per fess) — Backgrounds cut into up to four pieces are told apart by their number of pieces, so a different number is a distinct change (SENA A5G1d).',
    ]);
    expect(notes(lionOn(varied('barry-bendy', 'argent', 'azure')), lionOn(varied('paly-bendy', 'argent', 'azure')))).toEqual([
      'background pattern (barry bendy ↔ paly bendy) — A different pattern of the same kind of background (for example barry bendy and paly bendy) is a distinct change (SENA A5G1b).',
    ]);
  });


  it('tells tinctures apart, but not which of the two comes first beyond four pieces (A5G1a)', () => {
    expect(between(lionOn(varied('barry', 'argent', 'azure')), lionOn(varied('barry', 'argent', 'gules')))).toEqual(['field-tincture:dc:A5G1a']);
    expect(between(lionOn(varied('checky', 'argent', 'azure')), lionOn(varied('checky', 'azure', 'argent')))).toEqual([]);
    expect(between(lionOn(varied('barry', 'argent', 'azure')), lionOn(varied('barry', 'azure', 'argent')))).toEqual([]);
    expect(between(lionOn(varied('barry', 'argent', 'azure', 4)), lionOn(varied('barry', 'azure', 'argent', 4)))).toEqual(['field-tincture:dc:A5G1a']);
    // With one real change, the swap must not make a second: still a conflict.
    const chief = (field: unknown, t: string) => arms(field, lion('gules'), group(ordinary('chief'), t));
    expect(between(chief(varied('barry', 'argent', 'azure'), 'or'), chief(varied('barry', 'azure', 'argent'), 'sable'))).toEqual(['tincture:dc:A5G3']);
    expect(signature(nd(lionOn(varied('checky', 'argent', 'azure'))))).toBe(signature(nd(lionOn(varied('checky', 'azure', 'argent')))));
    expect(signature(nd(lionOn(varied('barry', 'argent', 'azure'))))).not.toBe(signature(nd(lionOn(varied('barry', 'azure', 'argent')))));
  });

  it('does the same for charges, and tells the number of pieces apart up to four (A5G3a, A5G3d)', () => {
    const lions = (paint: unknown) => arms('azure', group(ordinary('chevron'), 'or'), group(charge('lion'), paint, { count: 3, relation: 'between' }));
    expect(between(lions(varied('barry', 'argent', 'gules')), lions(varied('barry', 'gules', 'argent')))).toEqual([]);
    expect(between(lions(varied('barry', 'argent', 'gules', 4)), lions(varied('barry', 'gules', 'argent', 4)))).toEqual(['tincture:dc:A5G3']);
    expect(between(arms('azure', lion(varied('barry', 'argent', 'gules'))), arms('azure', lion(div('per-fess', 'argent', 'gules'))))).toEqual(['tincture:dc:A5G3']);
  });
});


describe('the builder', () => {
  const start = nd(arms('azure', lion('or')));
  const fieldOf = (d: Design) => (d.kind === 'arms' ? asVariation(d.field) : null);


  it('covers the background in the tinctures it has, with a metal and a colour', () => {
    expect(fieldOf(setVariation(start, 'barry'))).toMatchObject({ variation: 'barry', pieces: 6, parts: [{ t: 'azure' }, { t: 'or' }] });
    expect(fieldOf(setVariation(nd(arms('gules', lion('or'))), 'checky'))?.parts.map((p) => p.t)).toEqual(['gules', 'or']);
    // A colour alone gets a metal to go with it.
    expect(fieldOf(setVariation(nd(arms('gules', lion('or'))), 'paly'))?.parts.map((p) => p.t)).toEqual(['gules', 'or']);
  });


  it('keeps a metal and a colour when a tincture is set, and the count and the stripes when the pattern changes', () => {
    let d = setVariation(start, 'paly');
    d = setVariationPieces(d, 8);
    d = setVariationTincture(d, 1, 'sable');
    // Sable is a colour like azure, so the other tincture gives way to a metal.
    expect(blazon(d)).toBe('Paly of eight Or and sable, a lion Or.');
  });


  it('returns to a plain background', () => {
    const d = setPlainField(setVariation(start, 'paly'));
    expect(d.kind === 'arms' && d.field).toEqual({ k: 'tincture', t: 'azure' });
  });
});


describe('building variations in the builder', () => {
  it('reaches every variation and count from the starting design by allowed clicks', () => {
    for (const v of VARIATIONS) {
      const goal = nd(arms(varied(v, 'argent', 'sable', v === 'barry' ? 8 : null), lion('gules')));
      const built = builderPath(goal);
      expect(built.problems, v).toEqual([]);
    }
  });
});


describe('SCA records', () => {
  it('builds a barry field from its blazon', () => {
    expect(checkBlazon('Barry argent and azure, a lion gules.').failures).toEqual([]);
  });


  it('reads the counts and spellings the College uses', () => {
    for (const text of ['Barry of six argent and azure, a lion gules.', 'Chevronny argent and azure, a lion gules.', 'Paly of four azure and Or, a lion gules.', 'Bendy sinister argent and azure, a lion gules.']) {
      expect(explainMatch(text).status, text).toBe('match');
      expect(checkBlazon(text).failures, text).toEqual([]);
    }
  });
});


describe('a band or picture in stripes or checks', () => {
  const fess = (paint: unknown) => nd(arms('azure', group(ordinary('fess'), paint)));
  const fessOn = (field: unknown, paint: unknown) => nd(arms(field, group(ordinary('fess'), paint)));


  it('draws any band or picture in any pattern of two tinctures', () => {
    for (const v of VARIATIONS) {
      expect(gaps(arms('azure', group(ordinary('fess'), varied(v, 'argent', 'gules'))))).toEqual([]);
      expect(gaps(arms('azure', lion(varied(v, 'argent', 'gules'))))).toEqual([]);
    }
  });


  it('blazons it, factoring nothing: the pattern names its own tinctures', () => {
    expect(blazon(fessOn('vert', varied('checky', 'or', 'gules')))).toBe('Vert, a fess checky Or and gules.');
    expect(blazon(nd(arms('vert', lion(varied('barry', 'or', 'gules', 8)))))).toBe('Vert, a lion barry of eight Or and gules.');
    expect(gloss(fessOn('vert', varied('barry', 'or', 'gules')))).toBe('A green shield with a horizontal band across the middle in 6 horizontal stripes, gold on top alternating with red.');
  });


  it('judges it as a neutral surface: it needs a tincture neither of its own nor of the ground', () => {
    expect(messages(fessOn('vert', varied('checky', 'or', 'gules')))).toEqual([]);
    expect(messages(nd(arms('gules', lion(varied('checky', 'or', 'gules')))))[0]).toMatch(/same tincture/);
    // A band may share a tincture with the ground when only one of them is in stripes or cells (A3B4b); not when both are.
    expect(messages(fessOn('gules', varied('checky', 'or', 'gules')))).toEqual([]);
    expect(messages(fessOn(varied('barry', 'argent', 'gules'), varied('checky', 'or', 'gules')))[0]).toMatch(/same tincture/);
    expect(messages(fessOn('vert', varied('checky', 'or', 'argent')))).toEqual(['Checky Or and Argent needs a metal and a colour — both are metals.']);
  });


  it('lays the pattern over the band, in its own frame', () => {
    const box = ordinaryBox('fess', 'heater');
    expect(box).toEqual({ x0: 0, y0: 35, x1: 100, y1: 65 });
    const layers = renderLayers(fessOn('azure', varied('barry', 'or', 'argent', 6)), 'heater');
    const band = layers.find((l) => l.k === 'ordinary');
    expect(band && fillCode(band.fill)).toBe('split(or,ar)');
  });


  it('lays the pattern over each charge in its own frame, turned with it', () => {
    const layers = renderLayers(nd(arms('azure', group(charge('mullet'), varied('paly', 'or', 'argent'), { count: 3 }))), 'heater');
    const charges = layers.find((l) => l.k === 'charges');
    expect(charges && charges.fills.map((f) => f.slots.length)).toEqual([1, 1, 1]);
  });


  it('tells a pattern from another and from a tincture, and checky either way round from itself', () => {
    const on = (paint: unknown) => arms('azure', group(ordinary('fess'), paint));
    expect(between(on(varied('checky', 'or', 'gules')), on(varied('checky', 'gules', 'or')))).toEqual([]);
    expect(between(on(varied('barry', 'or', 'gules')), on(varied('paly', 'or', 'gules')))).toEqual(['tincture:dc:A5G3']);
    expect(between(on(varied('barry', 'or', 'gules')), on(varied('barry', 'or', 'sable')))).toEqual(['tincture:dc:A5G3']);
  });


  it('offers the patterns and tinctures that work where the group lies', () => {
    const d = fessOn('azure', 'argent');
    const choices = groupVariationChoices(d, [0]);
    expect(choices.every((c) => c.allowed)).toBe(true);
    const patterned = setGroupVariation(d, [0], 'barry');
    const g = patterned.kind === 'arms' ? asVariation(patterned.groups[0].paint) : null;
    expect(g).toMatchObject({ variation: 'barry', pieces: 6, parts: [{ t: 'argent' }, { t: 'gules' }] });
    // A band may share the ground's tincture; a picture may not.
    expect(groupVariationTinctureChoices(patterned, [0], 0).find((c) => c.value === 'azure')).toMatchObject({ allowed: true });
    const picture = setGroupVariation(nd(arms('azure', lion('argent'))), [0], 'barry');
    expect(groupVariationTinctureChoices(picture, [0], 0).find((c) => c.value === 'azure')).toMatchObject({ allowed: false });
    const eight = setGroupVariationPieces(patterned, [0], 8);
    expect(blazon(eight)).toBe('Azure, a fess barry of eight argent and gules.');
    const recoloured = setGroupVariationTincture(eight, [0], 1, 'vert');
    expect(blazon(recoloured)).toBe('Azure, a fess barry of eight argent and vert.');
    expect(blazon(joinGroup(recoloured, [0]))).toBe('Azure, a fess argent.');
  });


  it('reaches a patterned band and picture from the starting design by allowed clicks', () => {
    for (const input of [
      arms('azure', group(ordinary('fess'), varied('checky', 'or', 'gules'))),
      arms('vert', lion(varied('barry', 'or', 'gules', 8))),
      arms('azure', group(ordinary('chief'), varied('lozengy', 'argent', 'gules')), lion('or')),
    ]) {
      const goal = nd(input);
      const built = builderPath(goal);
      expect(built.problems, blazon(goal)).toEqual([]);
    }
  });


  it('builds the records that name them', () => {
    for (const text of ['Vert, a fess checky Or and gules.', 'Azure, a lion barry Or and gules.', 'Azure, a bordure lozengy argent and gules.']) {
      expect(checkBlazon(text).failures, text).toEqual([]);
    }
  });
});
