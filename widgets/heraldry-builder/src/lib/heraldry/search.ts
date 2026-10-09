// Registry search shared by the Worker (GET /api/arms parameter parsing → SQL) and the offline
// sample search in the SPA store, so both accept the same parameters, validate them against the
// same vocabularies (via filtersToTags) and match with the same semantics:
//   - every component filter is a required tag (AND), derived exactly as stored in arms_tags;
//   - `q` is split into words (see queryWords): stopwords dropped, plurals and everyday words
//     expanded, and every word must appear as a whole word in the entry's search text (blazon,
//     gloss and display name). A query with no searchable word matches nothing;
//   - parameters this API does not define are rejected;
//   - order is newest first, ties by id; `limit`/`offset` are bounded.

import { cleanText, textLength } from './text';
import { filtersToTags, matchesTags, type SearchFilters } from './tags';
import type { NormDesign } from './design';
import { matchesWords, queryWords, type SearchWord } from './search-terms';

export const SEARCH_DEFAULT_LIMIT = 24;
export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_MAX_OFFSET = 5000;
export const SEARCH_MAX_Q = 60;

/** The filter parameter names, in the order the API documents them. */
export const FILTER_PARAMS = ['tincture', 'fieldTincture', 'chargeTincture', 'category', 'charge', 'posture', 'ordinary', 'division'] as const;

export interface SearchParams extends SearchFilters {
  registry?: string | null;
  q?: string | null;
  limit?: number | string | null;
  offset?: number | string | null;
}

export interface SearchQuery {
  /** Required tags (AND). */
  tags: string[];
  /** Cleaned free-text query ('' = none). */
  q: string;
  /** The words of `q` (AND), each a list of alternatives; empty when `q` has no searchable word. */
  words: SearchWord[];
  limit: number;
  offset: number;
}

/** `unknown_param`: a query parameter this API does not define; `bad_request`: a defined one with a bad value. */
export type SearchErrorCode = 'bad_request' | 'unknown_param';

export interface SearchFailure {
  ok: false;
  code: SearchErrorCode;
  param: string;
  message: string;
}

export type SearchQueryResult = { ok: true; query: SearchQuery } | SearchFailure;

const badParam = (param: string, message: string): SearchFailure => ({ ok: false, code: 'bad_request', param, message });

function boundedInt(raw: number | string | null | undefined, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const s = String(raw).trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

/** Validate search parameters (filters, q, limit, offset). The registry is resolved by the caller. */
export function parseSearchParams(p: SearchParams): SearchQueryResult {
  const filters: SearchFilters = {};
  for (const k of FILTER_PARAMS) filters[k] = p[k] == null ? null : String(p[k]).trim();
  const tagResult = filtersToTags(filters);
  if (!tagResult.ok) return badParam(tagResult.param, tagResult.message);

  const q = p.q == null ? '' : cleanText(String(p.q));
  if (textLength(q) > SEARCH_MAX_Q) return badParam('q', `q must be at most ${SEARCH_MAX_Q} characters.`);

  const limit = boundedInt(p.limit, SEARCH_DEFAULT_LIMIT, 1, SEARCH_MAX_LIMIT);
  if (limit == null) return badParam('limit', `limit must be an integer from 1 to ${SEARCH_MAX_LIMIT}.`);
  const offset = boundedInt(p.offset, 0, 0, SEARCH_MAX_OFFSET);
  if (offset == null) return badParam('offset', `offset must be an integer from 0 to ${SEARCH_MAX_OFFSET}.`);

  return { ok: true, query: { tags: tagResult.tags, q, words: queryWords(q), limit, offset } };
}

const SEARCH_PARAM_NAMES: readonly string[] = ['registry', ...FILTER_PARAMS, 'q', 'limit', 'offset'];

export type SearchUrlResult = { ok: true; params: SearchParams } | (SearchFailure & { code: 'unknown_param' });

/** Read the search parameters from a URL query string; a parameter the API does not define is an error. */
export function searchParamsFromUrl(sp: URLSearchParams): SearchUrlResult {
  for (const name of sp.keys()) {
    if (!SEARCH_PARAM_NAMES.includes(name)) {
      return { ok: false, code: 'unknown_param', param: name.slice(0, 40), message: `Unknown parameter "${name.slice(0, 40)}".` };
    }
  }
  const params: SearchParams = {
    registry: sp.get('registry'),
    q: sp.get('q'),
    limit: sp.get('limit'),
    offset: sp.get('offset'),
  };
  for (const k of FILTER_PARAMS) params[k] = sp.get(k);
  return { ok: true, params };
}

/** Build a URL query string from search parameters (blank values omitted). */
export function searchParamsToUrl(p: SearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  const keys = ['registry', ...FILTER_PARAMS, 'q', 'limit', 'offset'] as const;
  for (const k of keys) {
    const v = p[k];
    if (v !== undefined && v !== null && String(v) !== '') sp.set(k, String(v));
  }
  return sp;
}

/** True when an entry's search text satisfies the free-text part of a query (no `q` = everything). */
export function matchesQueryText(searchText: string, query: Pick<SearchQuery, 'q' | 'words'>): boolean {
  return !query.q || (query.words.length > 0 && matchesWords(searchText, query.words));
}

export interface SearchableEntry {
  id: string;
  /** The entry's search text (buildSearchText). */
  searchText: string;
  design: NormDesign;
  /** ISO-8601; newest first. */
  createdAt: string;
}

/** Run a validated query over in-memory entries (the offline sample), exactly as the Worker would. */
export function searchEntries<T extends SearchableEntry>(entries: readonly T[], query: SearchQuery): { total: number; items: T[] } {
  const hits = entries
    .filter((e) => matchesTags(e.design, query.tags) && matchesQueryText(e.searchText, query))
    .sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.createdAt < b.createdAt ? 1 : -1));
  return { total: hits.length, items: hits.slice(query.offset, query.offset + query.limit) };
}
