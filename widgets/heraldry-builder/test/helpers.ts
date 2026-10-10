// Builders shared by the tests: loose design input and the resolved design it makes.

import { NO_FILTERS, NO_SEARCH_PARAMS, resolve, type NormDesign, type SearchFilters, type SearchParams } from '../src/lib/heraldry';

export const plain = (tincture: string) => ({ kind: 'plain', tincture });

export const div = (division: string, t1: string, t2: string) => ({ kind: 'divided', division, tinctures: [t1, t2] });

/** The resolved design of loose input; throws with the reasons if it doesn't resolve. */
export function nd(input: unknown): NormDesign {
  const r = resolve(input);
  if (!r.ok) throw new Error(`resolve failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.design;
}

/** Search parameters as a test writes them: only the ones it cares about, numbers allowed. */
export type SearchArgs = Partial<{ [K in keyof SearchParams]: string | number }>;

export function searchParams(args: SearchArgs = {}): SearchParams {
  return { ...NO_SEARCH_PARAMS, ...Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)])) };
}

/** Search filters with only the given ones set. */
export function filters(args: Partial<SearchFilters> = {}): SearchFilters {
  return { ...NO_FILTERS, ...args };
}
