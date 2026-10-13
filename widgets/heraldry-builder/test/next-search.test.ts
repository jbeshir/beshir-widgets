// Registry search over entries built from designs: parameter parsing and URL round-trip, tag filters, the
// plain-English query over blazon, gloss and display name, ordering and paging. The sample registry's own queries
// and the offline store's answers close the file.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sample from '../src/data/sample-registry.json';
import * as store from '../src/store';
import {
  FILTER_PARAMS, NO_SEARCH_PARAMS, blazon, buildSearchText, deriveTags, gloss, parseSearchParams, searchEntries, searchParamsFromUrl,
  searchParamsToUrl, type Design, type SearchParams, type SearchableEntry,
} from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';
import { sampleSearchEntries, searchEntryOf } from './next-sample-search-entries';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);

interface Entry extends SearchableEntry { displayName: string }

function entry(id: string, displayName: string, createdAt: string, design: Design): Entry {
  return { id, displayName, design, createdAt, searchText: buildSearchText({ displayName, blazon: blazon(design), design }) };
}

const ENTRIES: Entry[] = [
  entry('e1', 'Ada Brightwater', '2026-01-01T00:00:00Z', nd(arms('sable', chg('wolf', 'or'), ord('bordure', 'argent')))),
  entry('e2', 'Morgan Fay', '2026-01-02T00:00:00Z', nd(arms(div('per-pale', 'azure', 'vert'), chg('wolf', 'argent', {}, { posture: 'statant' })))),
  entry('e3', 'Cass Merriweather', '2026-01-03T00:00:00Z', nd(arms('gules', chg('mullet', 'argent', { count: 3 })))),
  entry('e4', 'Dag Thorsen', '2026-01-04T00:00:00Z', nd(arms('azure', chg('dragon', 'or')))),
  entry('e5', 'Eli Vance', '2026-01-04T00:00:00Z', nd(arms('vert', ord('chevron', 'or'), chg('rose', 'argent', { count: 3 })))),
  entry('e6', 'Fen Oakes', '2026-01-05T00:00:00Z', nd(arms('azure', chg('eagle', 'or')))),
];

const params = (args: Partial<Record<keyof SearchParams, string | number>> = {}): SearchParams =>
  ({ ...NO_SEARCH_PARAMS, ...Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)])) });

function ids(args: Partial<Record<keyof SearchParams, string | number>>): string[] {
  const parsed = parseSearchParams(params({ limit: 50, ...args }));
  if (!parsed.ok) throw new Error(parsed.message);
  return searchEntries(ENTRIES, parsed.query).items.map((i) => i.id);
}

describe('search text', () => {
  it('is blazon, gloss and display name as lowercase words, padded with a space at each end', () => {
    const d = nd(arms(div('per-pale', 'azure', 'vert'), chg('wolf', 'argent', {}, { posture: 'statant' })));
    expect(buildSearchText({ displayName: 'Morgan Fay', blazon: blazon(d), design: d })).toBe(
      ` morgan fay ${blazon(d).toLowerCase().replace(/[.,]/g, '')} ${gloss(d).toLowerCase().replace(/[.,]/g, '')} `,
    );
  });
});

describe('searchEntries', () => {
  it('lists newest first, entries registered together in registration order (by id)', () => {
    expect(ids({})).toEqual(['e6', 'e4', 'e5', 'e3', 'e2', 'e1']);
  });

  it('pages with limit and offset and reports the total', () => {
    const parsed = parseSearchParams(params({ limit: 2, offset: 1 }));
    if (!parsed.ok) throw new Error(parsed.message);
    const page = searchEntries(ENTRIES, parsed.query);
    expect(page.total).toBe(6);
    expect(page.items.map((i) => i.id)).toEqual(['e4', 'e5']);
  });

  it('finds words in the blazon, the gloss and the display name, as whole words', () => {
    expect(ids({ q: 'wolf' })).toEqual(['e2', 'e1']);
    expect(ids({ q: 'wolves' })).toEqual(['e2', 'e1']);
    expect(ids({ q: 'white border' })).toEqual(['e1']);
    expect(ids({ q: 'Ada' })).toEqual(['e1']);
    expect(ids({ q: 'Bright' })).toEqual([]);
    expect(ids({ q: 'star' })).toEqual(['e3']);
    expect(ids({ q: 'bird' })).toEqual(['e6']);
  });

  it('"Or" is the tincture, never part of another word', () => {
    expect(ids({ q: 'Or' }).sort()).toEqual(['e1', 'e4', 'e5', 'e6']);
  });

  it('matches nothing for a query with no searchable word, everything for none', () => {
    expect(ids({ q: 'the' })).toEqual([]);
    expect(ids({ q: '%' })).toEqual([]);
    expect(ids({})).toHaveLength(ENTRIES.length);
  });

  it('applies the tag filters, together with text', () => {
    expect(ids({ category: 'monster' })).toEqual(['e4']);
    expect(ids({ fieldTincture: 'sable' })).toEqual(['e1']);
    expect(ids({ ordinary: 'chevron' })).toEqual(['e5']);
    expect(ids({ division: 'per-pale' })).toEqual(['e2']);
    expect(ids({ posture: 'statant' })).toEqual(['e2']);
    expect(ids({ category: 'beast', q: 'white' })).toEqual(['e2', 'e1']);
    expect(ids({ charge: 'wolf', chargeTincture: 'or' })).toEqual(['e1']);
  });

  it('every filter agrees with the tags of the design', () => {
    for (const tincture of ['or', 'argent', 'azure']) {
      expect(ids({ tincture }).sort()).toEqual(ENTRIES.filter((e) => deriveTags(e.design).includes(`tincture:${tincture}`)).map((e) => e.id).sort());
    }
  });
});

describe('search parameters', () => {
  it('rejects a parameter the API does not define, naming it', () => {
    expect(searchParamsFromUrl(new URLSearchParams('q=wolf&colour=red'))).toMatchObject({ ok: false, code: 'unknown_param', param: 'colour' });
    expect(searchParamsFromUrl(new URLSearchParams('Q=wolf'))).toMatchObject({ ok: false, code: 'unknown_param', param: 'Q' });
  });

  it('accepts every defined parameter, and round-trips the ones given', () => {
    const all = ['registry', 'q', 'limit', 'offset', ...FILTER_PARAMS].map((k) => `${k}=1`).join('&');
    expect(searchParamsFromUrl(new URLSearchParams(all)).ok).toBe(true);
    const given = params({ q: 'wolf', category: 'beast', limit: 5 });
    const url = searchParamsToUrl(given);
    expect(url.toString()).toBe('category=beast&q=wolf&limit=5');
    expect(searchParamsFromUrl(url)).toEqual({ ok: true, params: given });
  });

  it('reports a bad value for a defined parameter as bad_request', () => {
    expect(parseSearchParams(params({ category: 'fish' }))).toMatchObject({ ok: false, code: 'bad_request', param: 'category' });
    expect(parseSearchParams(params({ fieldTincture: 'pink' }))).toMatchObject({ ok: false, code: 'bad_request', param: 'fieldTincture' });
    expect(parseSearchParams(params({ limit: 0 }))).toMatchObject({ ok: false, param: 'limit' });
    expect(parseSearchParams(params({ limit: 51 }))).toMatchObject({ ok: false, param: 'limit' });
    expect(parseSearchParams(params({ offset: 5001 }))).toMatchObject({ ok: false, param: 'offset' });
    expect(parseSearchParams(params({ q: 'x'.repeat(61) }))).toMatchObject({ ok: false, param: 'q' });
  });
});

describe('the plain-English queries over the sample registry', () => {
  const find = (q: string) => idsOf({ q });
  function idsOf(args: Partial<Record<keyof SearchParams, string | number>>): string[] {
    const parsed = parseSearchParams(params({ limit: 50, ...args }));
    if (!parsed.ok) throw new Error(parsed.message);
    return searchEntries(sampleSearchEntries, parsed.query).items.map((i) => i.id);
  }
  const hasTag = (tag: string) => sampleSearchEntries.filter((e) => deriveTags(e.design).includes(tag)).map((e) => e.id).sort();

  it('"yellow" finds every entry with gold in it', () => {
    expect(find('yellow').slice().sort()).toEqual(hasTag('tincture:or'));
    expect(find('yellow').length).toBeGreaterThan(0);
  });

  it('"gold lion" finds nothing here: the sample has a counterchanged lion but no gold one', () => {
    expect(find('gold lion')).toEqual([]);
  });

  it('"passant wolf" and "wolf passant" find both wolves, including the one registered as passant', () => {
    expect(find('passant wolf')).toEqual(['demo-004', 'demo-003']);
    expect(find('wolf passant')).toEqual(['demo-004', 'demo-003']);
  });

  it('a posture search finds the other postures of its group: "walking" finds passant and statant', () => {
    expect(find('passant goat')).toEqual(['demo-014']);
    expect(find('walking')).toEqual(['demo-014', 'demo-004', 'demo-003']);
  });

  it('"bird" finds nothing here: the sample has no bird', () => {
    expect(find('bird')).toEqual([]);
  });

  it('"white border" finds the two entries with a white border', () => {
    expect(find('white border')).toEqual(['demo-014', 'demo-004']);
  });

  it('"star" finds the mullets, the new chief entry included', () => {
    expect(find('star')).toEqual(['demo-018', 'demo-005']);
  });

  it('finds the new constructs by their words', () => {
    expect(find('key')).toEqual(['demo-009']);
    expect(find('bee')).toEqual(['demo-016']);
    expect(find('rose')).toEqual(['demo-020', 'demo-006', 'demo-005']);
    expect(find('chief')).toEqual(['demo-016', 'demo-005']); // bees in chief, and the chief itself
  });

  it('"wolves" finds the wolf', () => {
    expect(find('wolves')).toEqual(['demo-004', 'demo-003']);
    expect(find('wolf')).toEqual(find('wolves'));
  });

  it('"Or" matches the tincture only, never "bordure" or "Morgan"', () => {
    const orArms = find('Or');
    expect(orArms.slice().sort()).toEqual(hasTag('tincture:or'));
    expect(orArms).not.toContain('demo-014'); // Argent, a goat azure, a bordure gules
    const morgan = searchEntryOf({ ...sample.entries[13], id: 'x-morgan', displayName: 'Morgan Fay', registeredAt: '2026-03-01T00:00:00Z' });
    const parsed = parseSearchParams(params({ q: 'or' }));
    if (!parsed.ok) throw new Error(parsed.message);
    expect(searchEntries([morgan], parsed.query).total).toBe(0);
  });

  it('"yellow animal on black with a white border" finds exactly the gold wolf on black within a white border', () => {
    // Words are ANDed: yellow ∧ animal ∧ black ∧ white ∧ border. "on", "with" and "a" are ignored.
    expect(find('yellow animal on black with a white border')).toEqual(['demo-004']);
  });

  it('finds celestine by cyan, sky blue, light blue and turquoise, and keeps plain "blue" for azure', () => {
    for (const q of ['cyan', 'sky blue', 'light blue', 'turquoise', 'Celestine']) expect(find(q), q).toEqual(['demo-017']);
    expect(find('blue')).not.toContain('demo-017');
    expect(find('blue sky blue')).toEqual([]);
  });

  it('answers the other everyday words', () => {
    expect(find('moon')).toEqual(['demo-017']);
    expect(find('fire')).toEqual(['demo-015']);
    expect(find('cog')).toEqual(['demo-013']);
    expect(find('x')).toEqual(['demo-013', 'demo-009']); // the saltire, and the keys crossed in saltire
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
    expect(idsOf({})).toHaveLength(sample.entries.length);
  });

  it('filters by category and field tincture, together with text', () => {
    expect(idsOf({ category: 'monster' }).slice().sort()).toEqual(['demo-002', 'demo-008']);
    expect(idsOf({ fieldTincture: 'sable' }).slice().sort()).toEqual(['demo-004', 'demo-010']);
    expect(idsOf({ category: 'beast', q: 'white' })).toEqual(['demo-019', 'demo-014', 'demo-004', 'demo-003']);
  });
});

describe('the offline store answers like the library', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { protocol: 'file:', origin: 'null', pathname: '/', search: '' });
  });
  afterEach(() => vi.unstubAllGlobals());

  const find = (q: string) => {
    const parsed = parseSearchParams(params({ q, limit: 50 }));
    if (!parsed.ok) throw new Error(parsed.message);
    return searchEntries(sampleSearchEntries, parsed.query).items.map((i) => i.id);
  };

  const QUERIES = [
    'yellow', 'gold lion', 'passant wolf', 'wolf passant', 'bird', 'white border', 'star', 'wolves', 'Or',
    'yellow animal on black with a white border', 'cyan', 'sky blue', 'walking', 'the', '%', 'Bright', 'key', 'chief',
  ];

  it('returns the same ids in the same order, for every query', async () => {
    for (const q of QUERIES) {
      const r = await store.search(params({ q, limit: 50 }));
      expect(r.ok && r.page.items.map((i) => i.id), q).toEqual(find(q));
    }
  });

  it('filters by category and field tincture, and refuses an unknown value with a typed code', async () => {
    const r = await store.search(params({ category: 'monster', fieldTincture: 'vert' }));
    expect(r.ok && r.page.items.map((i) => i.id)).toEqual([]);
    const bad = await store.search(params({ category: 'fish' }));
    expect(bad).toMatchObject({ ok: false, status: 400, code: 'bad_request', culprit: { kind: 'param', name: 'category' } });
  });
});
