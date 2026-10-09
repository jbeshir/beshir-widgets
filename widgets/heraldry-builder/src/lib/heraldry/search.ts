// Registry search shared by the Worker (GET /api/arms parameter parsing → SQL) and the offline
// sample search in the SPA store, so both accept the same parameters, validate them against the
// same vocabularies (via filtersToTags) and match with the same semantics:
//   - every component filter is a required tag (AND), derived exactly as stored in arms_tags;
//   - `q` is a case-insensitive (ASCII, like SQLite LIKE) substring of the display name or blazon;
//   - order is newest first, ties by id; `limit`/`offset` are bounded.

import { cleanText, textLength } from './text';
import { filtersToTags, matchesTags, type SearchFilters } from './tags';
import type { NormDesign } from './design';

export const SEARCH_DEFAULT_LIMIT = 24;
export const SEARCH_MAX_LIMIT = 50;
export const SEARCH_MAX_OFFSET = 5000;
export const SEARCH_MAX_Q = 60;

/** The filter parameter names, in the order the API documents them. */
export const FILTER_PARAMS = ['tincture', 'chargeTincture', 'charge', 'posture', 'ordinary', 'division'] as const;

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
  limit: number;
  offset: number;
}

export type SearchQueryResult =
  | { ok: true; query: SearchQuery }
  | { ok: false; param: keyof SearchParams; message: string };

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
  if (!tagResult.ok) return tagResult;

  const q = p.q == null ? '' : cleanText(String(p.q));
  if (textLength(q) > SEARCH_MAX_Q) return { ok: false, param: 'q', message: `q must be at most ${SEARCH_MAX_Q} characters.` };

  const limit = boundedInt(p.limit, SEARCH_DEFAULT_LIMIT, 1, SEARCH_MAX_LIMIT);
  if (limit == null) return { ok: false, param: 'limit', message: `limit must be an integer from 1 to ${SEARCH_MAX_LIMIT}.` };
  const offset = boundedInt(p.offset, 0, 0, SEARCH_MAX_OFFSET);
  if (offset == null) return { ok: false, param: 'offset', message: `offset must be an integer from 0 to ${SEARCH_MAX_OFFSET}.` };

  return { ok: true, query: { tags: tagResult.tags, q, limit, offset } };
}

/** Read the search parameters from a URL query string. */
export function searchParamsFromUrl(sp: URLSearchParams): SearchParams {
  const out: SearchParams = {
    registry: sp.get('registry'),
    q: sp.get('q'),
    limit: sp.get('limit'),
    offset: sp.get('offset'),
  };
  for (const k of FILTER_PARAMS) out[k] = sp.get(k);
  return out;
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

/** ASCII-only lowercase, matching SQLite's case-insensitive LIKE. */
function asciiLower(s: string): string {
  return s.replace(/[A-Z]+/g, (m) => m.toLowerCase());
}

/** SQL LIKE pattern for `q` (use with `ESCAPE '\'`): %, _ and \ are matched literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function matchesQueryText(entry: { displayName: string; blazon: string }, q: string): boolean {
  if (!q) return true;
  const needle = asciiLower(q);
  return asciiLower(entry.displayName).includes(needle) || asciiLower(entry.blazon).includes(needle);
}

export interface SearchableEntry {
  id: string;
  displayName: string;
  blazon: string;
  design: NormDesign;
  /** ISO-8601; newest first. */
  createdAt: string;
}

/** Run a validated query over in-memory entries (the offline sample), exactly as the Worker would. */
export function searchEntries<T extends SearchableEntry>(entries: readonly T[], query: SearchQuery): { total: number; items: T[] } {
  const hits = entries
    .filter((e) => matchesTags(e.design, query.tags) && matchesQueryText(e, query.q))
    .sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.createdAt < b.createdAt ? 1 : -1));
  return { total: hits.length, items: hits.slice(query.offset, query.offset + query.limit) };
}
