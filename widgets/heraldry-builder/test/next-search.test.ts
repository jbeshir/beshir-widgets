// Registry search over entries built from designs: parameter parsing and URL round-trip, tag filters, the
// plain-English query over blazon, gloss and display name, ordering and paging. (The sample registry's own
// queries are checked with the sample in the SPA suites.)
import { describe, expect, it } from 'vitest';
import {
  FILTER_PARAMS, NO_SEARCH_PARAMS, blazon, buildSearchText, deriveTags, gloss, parseSearchParams, searchEntries, searchParamsFromUrl,
  searchParamsToUrl, type Design, type SearchParams, type SearchableEntry,
} from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';

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
