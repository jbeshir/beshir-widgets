// Builders shared by the tests: loose design input and the resolved design it makes, and the charge
// layout controls as the builder applies them.

import {
  NO_FILTERS, NO_SEARCH_PARAMS, arrangementChoices, countChoices, placementChoices, resolve,
  type Arrangement, type Count, type NormDesign, type Placement, type SearchFilters, type SearchParams,
} from '../src/lib/heraldry';
import { setArrangement, setCount, setPlacement } from '../src/lib/builder';

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

/** A click on one of the charge layout controls: how many, where it goes, or the layout select. */
export type LayoutAction =
  | { kind: 'count'; count: Count }
  | { kind: 'placement'; placement: Placement }
  | { kind: 'arrangement'; arrangement: Arrangement };

/** Every allowed choice of the count, placement and layout controls, with the design the builder makes of it. */
export function layoutMoves(d: NormDesign): Array<{ action: LayoutAction; design: NormDesign }> {
  const arr = arrangementChoices(d);
  return [
    ...countChoices(d).filter((c) => c.allowed)
      .map((c) => ({ action: { kind: 'count', count: c.value } as const, design: setCount(d, c.value) })),
    ...placementChoices(d).filter((c) => c.allowed)
      .map((c) => ({ action: { kind: 'placement', placement: c.value } as const, design: setPlacement(d, c.value) })),
    ...(arr.mode === 'choose' ? arr.choices.filter((c) => c.allowed) : [])
      .map((c) => ({ action: { kind: 'arrangement', arrangement: c.value } as const, design: setArrangement(d, c.value) })),
  ];
}
