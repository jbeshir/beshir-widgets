// Plain-English search over the sample registry: the query parser, whole-word matching, the search
// text, the typed URL/param errors, and the offline store answering exactly as the library does.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sample from '../src/data/sample-registry.json';
import {
  FILTER_PARAMS, buildSearchText, deriveTags, matchesWords, normaliseWords, parseSearchParams, queryWords, searchEntries,
  searchParamsFromUrl, type SearchParams,
} from '../src/lib/heraldry';
import * as store from '../src/store';
import { designOf, sampleSearchEntries, searchEntryOf } from './sample-search-entries';

function ids(params: SearchParams): string[] {
  const parsed = parseSearchParams({ ...params, limit: 50 });
  if (!parsed.ok) throw new Error(parsed.message);
  return searchEntries(sampleSearchEntries, parsed.query).items.map((i) => i.id);
}
const find = (q: string) => ids({ q });

describe('search text', () => {
  it('is blazon, gloss and display name as lowercase words, padded with a space at each end', () => {
    const cass = sampleSearchEntries.find((e) => e.id === 'demo-003')!;
    expect(cass.searchText).toBe(
      ' cass merriweather per pale azure and vert a wolf passant argent a shield split vertically blue on the left and green on the right with a white wolf walking ',
    );
  });

  it('normalises case, accents and punctuation (hyphens separate words)', () => {
    expect(normaliseWords("Zoë O'Brien-Smith, Or!")).toBe('zoe o brien smith or');
    expect(normaliseWords('fleurs-de-lis')).toBe('fleurs de lis');
  });

  it('holds neither contact, email nor field shape', () => {
    for (const e of sample.entries) {
      const text = buildSearchText({ displayName: e.displayName, blazon: e.blazon, design: designOf(e.design) });
      if (e.contact.discord) expect(text).not.toContain(e.contact.discord.replace(/\W/g, ' '));
      expect(text).not.toContain('@');
      for (const shape of ['heater', 'banner', 'lozenge']) expect(text).not.toContain(` ${shape} `);
    }
  });
});

describe('query words', () => {
  const alternatives = (q: string) => queryWords(q).map((w) => [...w]);

  it('drops stopwords, and a query of nothing but stopwords or punctuation has no words', () => {
    expect(alternatives('the one with a')).toEqual([]);
    expect(alternatives('%_ !')).toEqual([]);
    expect(alternatives('wolf on a bend')).toHaveLength(2);
  });

  it('reduces plurals to the singular and keeps the plural forms', () => {
    expect(alternatives('wolves')[0]).toEqual(expect.arrayContaining(['wolves', 'wolf']));
    expect(alternatives('fishes')[0]).toContain('fish');
    expect(alternatives('roses')[0]).toContain('rose');
    expect(alternatives('mullets')[0]).toContain('mullet');
    expect(alternatives('fleurs-de-lis')[0]).toEqual(expect.arrayContaining(['fleurs de lis', 'fleur de lis']));
  });

  it('expands everyday words to the blazon term, and the term to the everyday word', () => {
    const cases: Array<[string, string]> = [
      ['yellow', 'or'], ['gold', 'or'], ['white', 'argent'], ['silver', 'argent'], ['red', 'gules'], ['blue', 'azure'],
      ['green', 'vert'], ['black', 'sable'], ['purple', 'purpure'], ['cyan', 'celestine'], ['sky blue', 'celestine'],
      ['light blue', 'celestine'], ['turquoise', 'celestine'], ['star', 'mullet'], ['border', 'bordure'], ['stripe', 'fess'],
      ['stripe', 'pale'], ['stripe', 'bend'], ['x', 'saltire'], ['cross-shaped', 'saltire'], ['moon', 'crescent'], ['fire', 'flame'],
      ['cog', 'gear'], ['dog', 'wolf'], ['deer', 'stag'], ['rabbit', 'hare'], ['bird', 'eagle'], ['bird', 'owl'], ['animal', 'lion'],
      ['animal', 'unicorn'], ['lily', 'fleur de lis'], ['Gules', 'red'], ['Or', 'gold'],
    ];
    for (const [typed, term] of cases) expect(alternatives(typed)[0], `${typed} → ${term}`).toContain(term);
  });

  it('reads multi-word synonyms as one word', () => {
    expect(alternatives('sky blue')).toHaveLength(1);
    expect(alternatives('light blue crescent')).toHaveLength(2);
    expect(alternatives('blue')[0]).not.toContain('celestine');
    expect(alternatives('cyanotype')[0]).not.toContain('celestine');
  });

  it('maps a posture word to its whole group and keeps other groups apart', () => {
    for (const typed of ['passant', 'statant', 'walking', 'standing', 'courant', 'trippant']) {
      expect(alternatives(typed)[0], typed).toEqual(expect.arrayContaining(['passant', 'statant', 'walking', 'standing']));
    }
    for (const typed of ['rampant', 'segreant', 'rearing']) {
      expect(alternatives(typed)[0], typed).toEqual(expect.arrayContaining(['rampant', 'rearing']));
      expect(alternatives(typed)[0], typed).not.toContain('passant');
    }
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
    expect(matchesWords(text, queryWords('morgan'))).toBe(true);
    expect(matchesWords(text, queryWords('morg'))).toBe(false);
    expect(matchesWords(text, queryWords('le fay'))).toBe(true);
    expect(matchesWords(text, queryWords('fay le'))).toBe(true);
  });

  it('needs every word of the query', () => {
    expect(matchesWords(text, queryWords('black border'))).toBe(true);
    expect(matchesWords(text, queryWords('black wolf'))).toBe(false);
  });
});

describe('the plain-English queries over the sample registry', () => {
  const hasTag = (tag: string) => sampleSearchEntries.filter((e) => deriveTags(e.design).includes(tag)).map((e) => e.id).sort();

  it('"yellow" finds every entry with gold in it', () => {
    expect(find('yellow').slice().sort()).toEqual(hasTag('tincture:or'));
    expect(find('yellow').length).toBeGreaterThan(0);
  });

  it('"gold lion" finds nothing here: the sample has no lion', () => {
    expect(find('gold lion')).toEqual([]);
  });

  it('"passant wolf" and "wolf passant" find both wolves, including the one registered as passant', () => {
    expect(find('passant wolf')).toEqual(['demo-004', 'demo-003']);
    expect(find('wolf passant')).toEqual(['demo-004', 'demo-003']);
  });

  it('a posture search finds the other postures of its group: "standing goat" and "walking" find passant and statant', () => {
    expect(find('passant goat')).toEqual(['demo-014']);
    expect(find('walking')).toEqual(['demo-014', 'demo-004', 'demo-003']);
  });

  it('"bird" finds nothing here: the sample has no bird', () => {
    expect(find('bird')).toEqual([]);
  });

  it('"white border" finds the two entries with a white border', () => {
    expect(find('white border')).toEqual(['demo-014', 'demo-004']);
  });

  it('"star" finds the mullets', () => {
    expect(find('star')).toEqual(['demo-018', 'demo-005']);
  });

  it('"wolves" finds the wolf', () => {
    expect(find('wolves')).toEqual(['demo-004', 'demo-003']);
    expect(find('wolf')).toEqual(find('wolves'));
  });

  it('"Or" matches the tincture only, never "bordure" or "Morgan"', () => {
    const orArms = find('Or');
    expect(orArms.slice().sort()).toEqual(hasTag('tincture:or'));
    expect(orArms).not.toContain('demo-014'); // Argent, a goat Azure within a bordure Gules
    const morgan = searchEntryOf({ ...sample.entries[13], id: 'x-morgan', displayName: 'Morgan Fay', registeredAt: '2026-03-01T00:00:00Z' });
    const parsed = parseSearchParams({ q: 'or' });
    if (!parsed.ok) throw new Error(parsed.message);
    expect(searchEntries([morgan], parsed.query).total).toBe(0);
  });

  it('"yellow animal on black with a white border" finds exactly the gold wolf on black within a white border', () => {
    // Words are ANDed: yellow ∧ animal ∧ black ∧ white ∧ border. "on", "with" and "a" are ignored.
    expect(find('yellow animal on black with a white border')).toEqual(['demo-004']);
  });

  it('finds celestine by cyan, sky blue, light blue and turquoise', () => {
    for (const q of ['cyan', 'sky blue', 'light blue', 'turquoise', 'Celestine']) expect(find(q), q).toEqual(['demo-017']);
  });

  it('answers the other everyday words', () => {
    expect(find('moon')).toEqual(['demo-017']);
    expect(find('fire')).toEqual(['demo-015']);
    expect(find('cog')).toEqual(['demo-013']);
    expect(find('x')).toEqual(['demo-013']);
    expect(find('red dragon')).toEqual(['demo-008']);
    expect(find('purple anchor')).toEqual(['demo-011']);
  });

  it('matches display names by whole word', () => {
    expect(find('Ada')).toEqual(['demo-001']);
    expect(find('Brightwater Ada')).toEqual(['demo-001']);
    expect(find('Bright')).toEqual([]);
  });

  it('matches nothing for a query with no searchable word, and everything for none', () => {
    expect(find('the')).toEqual([]);
    expect(find('%')).toEqual([]);
    expect(ids({})).toHaveLength(sample.entries.length);
  });

  it('filters by category and field tincture, together with text', () => {
    expect(ids({ category: 'monster' }).slice().sort()).toEqual(['demo-002', 'demo-008']);
    expect(ids({ fieldTincture: 'sable' }).slice().sort()).toEqual(['demo-004', 'demo-010']);
    expect(ids({ category: 'beast', q: 'white' })).toEqual(['demo-019', 'demo-014', 'demo-004', 'demo-003']);
  });
});

describe('search parameters', () => {
  it('rejects a parameter the API does not define, naming it', () => {
    const r = searchParamsFromUrl(new URLSearchParams('q=wolf&colour=red'));
    expect(r).toMatchObject({ ok: false, code: 'unknown_param', param: 'colour' });
    expect(searchParamsFromUrl(new URLSearchParams('Q=wolf'))).toMatchObject({ ok: false, code: 'unknown_param', param: 'Q' });
  });

  it('accepts every defined parameter', () => {
    const all = ['registry', 'q', 'limit', 'offset', ...FILTER_PARAMS].map((k) => `${k}=1`).join('&');
    expect(searchParamsFromUrl(new URLSearchParams(all)).ok).toBe(true);
    expect(FILTER_PARAMS).toEqual(expect.arrayContaining(['category', 'fieldTincture']));
  });

  it('reports a bad value for a defined parameter as bad_request', () => {
    expect(parseSearchParams({ category: 'fish' })).toMatchObject({ ok: false, code: 'bad_request', param: 'category' });
    expect(parseSearchParams({ fieldTincture: 'pink' })).toMatchObject({ ok: false, code: 'bad_request', param: 'fieldTincture' });
  });
});

describe('the offline store answers like the library', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { protocol: 'file:', origin: 'null', pathname: '/', search: '' });
  });
  afterEach(() => vi.unstubAllGlobals());

  const QUERIES = [
    'yellow', 'gold lion', 'passant wolf', 'wolf passant', 'bird', 'white border', 'star', 'wolves', 'Or',
    'yellow animal on black with a white border', 'cyan', 'sky blue', 'walking', 'the', '%', 'Bright',
  ];

  it('returns the same ids in the same order, for every query', async () => {
    for (const q of QUERIES) {
      const r = await store.search({ q, limit: 50 });
      expect(r.ok && r.page.items.map((i) => i.id), q).toEqual(find(q));
    }
  });

  it('filters by category and field tincture, and refuses an unknown value with a typed code', async () => {
    const r = await store.search({ category: 'monster', fieldTincture: 'vert' });
    expect(r.ok && r.page.items.map((i) => i.id)).toEqual([]);
    const bad = await store.search({ category: 'fish' });
    expect(bad).toMatchObject({ ok: false, status: 400, code: 'bad_request', param: 'category' });
  });
});
