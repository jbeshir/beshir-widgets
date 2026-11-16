// The search vocabulary: the text an entry is searched through and the parser that turns a typed query into
// words with alternatives. Matching whole entries against a registry is P4's.

import { describe, expect, it } from 'vitest';
import { blazon, buildSearchText, matchesWords, normaliseWords, queryWords } from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const alternatives = (q: string) => queryWords(q).map((w) => [...w]);
const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);

describe('search text', () => {
  it('is blazon, gloss and display name as lowercase words, padded with a space at each end', () => {
    const design = nd(arms(div('per-pale', 'azure', 'vert'), chg('wolf', 'argent')));
    expect(buildSearchText({ displayName: 'Cass Merriweather', blazon: blazon(design), design })).toBe(
      ' cass merriweather per pale azure and vert a wolf passant argent a shield split vertically blue on the left and green on the right with a white wolf walking ',
    );
  });

  it('normalises case, accents and punctuation (hyphens separate words)', () => {
    expect(normaliseWords("Zoë O'Brien-Smith, Or!")).toBe('zoe o brien smith or');
    expect(normaliseWords('fleurs-de-lys')).toBe('fleurs de lys');
  });
});

describe('query words', () => {
  it('drops stopwords, and a query of nothing but stopwords or punctuation has no words', () => {
    expect(alternatives('the one with a')).toEqual([]);
    expect(alternatives('%_ !')).toEqual([]);
    expect(alternatives('wolf on a bend')).toHaveLength(2);
  });

  it('reduces plurals to the singular and keeps the plural forms', () => {
    expect(alternatives('wolves')[0]).toEqual(expect.arrayContaining(['wolves', 'wolf']));
    expect(alternatives('fishes')[0]).toContain('fish');
    expect(alternatives('roses')[0]).toContain('rose');
    expect(alternatives('cogwheels')[0]).toContain('cogwheel');
  });

  it('expands everyday words to the blazon term, and the term to the everyday word', () => {
    const cases: Array<[string, string]> = [
      ['yellow', 'or'], ['gold', 'or'], ['white', 'argent'], ['silver', 'argent'], ['red', 'gules'], ['blue', 'azure'],
      ['green', 'vert'], ['black', 'sable'], ['purple', 'purpure'], ['cyan', 'celestine'], ['sky blue', 'celestine'],
      ['star', 'mullet'], ['border', 'bordure'], ['stripe', 'fess'], ['x', 'saltire'], ['moon', 'crescent'], ['fire', 'flame'],
      ['cog', 'cogwheel'], ['gear', 'cogwheel'], ['dog', 'wolf'], ['rabbit', 'hare'], ['bird', 'eagle'], ['animal', 'lion'],
      ['lily', 'fleur de lys'], ['Gules', 'red'], ['Or', 'gold'],
    ];
    for (const [typed, term] of cases) expect(alternatives(typed)[0], `${typed} → ${term}`).toContain(term);
  });

  it('maps a posture word to its family and keeps other families apart', () => {
    for (const typed of ['passant', 'statant', 'walking', 'standing', 'courant', 'trippant', 'running']) {
      expect(alternatives(typed)[0], typed).toEqual(expect.arrayContaining(['passant', 'statant', 'courant', 'walking', 'standing']));
    }
    for (const typed of ['rampant', 'segreant', 'rearing']) {
      expect(alternatives(typed)[0], typed).toEqual(expect.arrayContaining(['rampant', 'rearing']));
      expect(alternatives(typed)[0], typed).not.toContain('passant');
    }
    expect(alternatives('sejant')[0]).not.toContain('rampant');
  });

  it('knows the splendor and layout words', () => {
    expect(alternatives('splendour')[0]).toContain('splendor');
    expect(alternatives('ring')[0]).toEqual(expect.arrayContaining(['annulo', 'orle']));
  });

  it('animal means beasts and monsters, bird means birds', () => {
    const animal = alternatives('animal')[0];
    expect(animal).toEqual(expect.arrayContaining(['wolf', 'unicorn', 'dragon']));
    expect(animal).not.toContain('eagle');
    expect(alternatives('bird')[0]).not.toContain('wolf');
  });
});

describe('whole-word matching', () => {
  const text = ' morgan le fay sable a bordure argent a black shield with a white border ';

  it('matches words and phrases, never parts of words', () => {
    expect(matchesWords(text, queryWords('Or'))).toBe(false);
    expect(matchesWords(text, queryWords('border'))).toBe(true);
    expect(matchesWords(text, queryWords('borders'))).toBe(true);
    expect(matchesWords(text, queryWords('bord'))).toBe(false);
    expect(matchesWords(text, queryWords('le fay'))).toBe(true);
    expect(matchesWords(text, queryWords('black border'))).toBe(true);
    expect(matchesWords(text, queryWords('black wolf'))).toBe(false);
  });
});

describe('the new wording is found', () => {
  const find = (design: unknown, q: string) => {
    const d = nd(design);
    return matchesWords(buildSearchText({ displayName: 'Wren', blazon: blazon(d), design: d }), queryWords(q));
  };

  it('finds a cogwheel by gear, cog and cogwheel, a sun with a face by splendour and a hare by courant and running', () => {
    const gear = arms('gules', chg('gear', 'or'));
    for (const q of ['gear', 'cog', 'cogwheel', 'gold cogwheel']) expect(find(gear, q), q).toBe(true);
    const sun = arms('azure', chg('sun', 'or', {}, { mods: [{ id: 'in-splendour' }] }));
    for (const q of ['splendour', 'splendor', 'sun face']) expect(find(sun, q), q).toBe(true);
    const hare = arms('argent', chg('hare', 'sable', {}, { posture: 'courant' }));
    for (const q of ['courant hare', 'running rabbit', 'passant hare']) expect(find(hare, q), q).toBe(true);
  });

  it('finds a band by its place', () => {
    expect(find(arms('gules', group(ordinary('chief'), 'or')), 'chief')).toBe(true);
  });
});
