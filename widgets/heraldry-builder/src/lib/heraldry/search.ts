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
import { NO_FILTERS, filtersToTags, matchesTags, type SearchFilters } from './tags';
import { API_ERROR } from './api-errors';
import { registrationOrder } from './check';
import type { NormDesign } from './design';
import { matchesWords, queryWords, type SearchWord } from './search-terms';

const SEARCH_DEFAULT_LIMIT = 24;
const SEARCH_MAX_LIMIT = 50;
const SEARCH_MAX_OFFSET = 5000;
const SEARCH_MAX_Q = 60;

/** The filter parameter names, in the order the API documents them. */
export const FILTER_PARAMS = ['tincture', 'fieldTincture', 'chargeTincture', 'category', 'charge', 'posture', 'ordinary', 'division'] as const;

/** The search parameters as text, as they appear in a query string; '' = not given. */
export interface SearchParams extends SearchFilters {
  registry: string;
  q: string;
  limit: string;
  offset: string;
}

export const NO_SEARCH_PARAMS: SearchParams = { ...NO_FILTERS, registry: '', q: '', limit: '', offset: '' };

interface SearchQuery {
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
type SearchErrorCode = typeof API_ERROR.badRequest | typeof API_ERROR.unknownParam;

interface SearchFailure {
  ok: false;
  code: SearchErrorCode;
  param: string;
  message: string;
}

type SearchQueryResult = { ok: true; query: SearchQuery } | SearchFailure;

const badParam = (param: string, message: string): SearchFailure => ({ ok: false, code: API_ERROR.badRequest, param, message });

/** The filter parameters of `p`, each mapped through `fn`. */
function filtersOf(p: SearchParams, fn: (value: string, key: (typeof FILTER_PARAMS)[number]) => string): SearchFilters {
  return Object.fromEntries(FILTER_PARAMS.map((k) => [k, fn(p[k], k)])) as unknown as SearchFilters;
}

function boundedInt(raw: string, fallback: number, min: number, max: number): number | null {
  const s = raw.trim();
  if (s === '') return fallback;
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

/** Validate search parameters (filters, q, limit, offset). The registry is resolved by the caller. */
export function parseSearchParams(p: SearchParams): SearchQueryResult {
  const tagResult = filtersToTags(filtersOf(p, (v) => v.trim()));
  if (!tagResult.ok) return badParam(tagResult.param, tagResult.message);

  const q = cleanText(p.q);
  if (textLength(q) > SEARCH_MAX_Q) return badParam('q', `q must be at most ${SEARCH_MAX_Q} characters.`);

  const limit = boundedInt(p.limit, SEARCH_DEFAULT_LIMIT, 1, SEARCH_MAX_LIMIT);
  if (limit == null) return badParam('limit', `limit must be an integer from 1 to ${SEARCH_MAX_LIMIT}.`);
  const offset = boundedInt(p.offset, 0, 0, SEARCH_MAX_OFFSET);
  if (offset == null) return badParam('offset', `offset must be an integer from 0 to ${SEARCH_MAX_OFFSET}.`);

  return { ok: true, query: { tags: tagResult.tags, q, words: queryWords(q), limit, offset } };
}

const SEARCH_PARAM_NAMES: readonly string[] = ['registry', ...FILTER_PARAMS, 'q', 'limit', 'offset'];

type SearchUrlResult = { ok: true; params: SearchParams } | (SearchFailure & { code: typeof API_ERROR.unknownParam });

/** Read the search parameters from a URL query string; a parameter the API does not define is an error. */
export function searchParamsFromUrl(sp: URLSearchParams): SearchUrlResult {
  for (const name of sp.keys()) {
    if (!SEARCH_PARAM_NAMES.includes(name)) {
      return { ok: false, code: API_ERROR.unknownParam, param: name.slice(0, 40), message: `Unknown parameter "${name.slice(0, 40)}".` };
    }
  }
  const text = (name: string) => sp.get(name) ?? '';
  return {
    ok: true,
    params: { registry: text('registry'), q: text('q'), limit: text('limit'), offset: text('offset'), ...filtersOf(NO_SEARCH_PARAMS, (_, k) => text(k)) },
  };
}

/** Build a URL query string from search parameters (blank values omitted). */
export function searchParamsToUrl(p: SearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  const keys = ['registry', ...FILTER_PARAMS, 'q', 'limit', 'offset'] as const;
  for (const k of keys) {
    if (p[k] !== '') sp.set(k, p[k]);
  }
  return sp;
}

/** True when an entry's search text satisfies the free-text part of a query (no `q` = everything). */
function matchesQueryText(searchText: string, query: Pick<SearchQuery, 'q' | 'words'>): boolean {
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
    .sort((a, b) => (a.createdAt === b.createdAt ? registrationOrder(a, b) : registrationOrder(b, a)));
  return { total: hits.length, items: hits.slice(query.offset, query.offset + query.limit) };
}
