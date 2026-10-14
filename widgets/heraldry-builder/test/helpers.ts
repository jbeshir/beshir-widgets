// Builders shared by the tests of the design model: loose design input, and the resolved design it makes.

import {
  NO_FILTERS, NO_SEARCH_PARAMS, countChoices, layoutChoices, placementChoices, resolve,
  type Design, type GroupPath, type LayoutChoice, type LayoutKey, type Placement, type SearchFilters, type SearchParams,
} from '../src/lib/heraldry';
import { setLayout } from '../src/lib/builder';

/** The design a count or placement choice leads to; a blocked (or unknown) one changes nothing. */
function chosenDesign<T>(d: Design, choices: LayoutChoice<T>[], value: T): Design {
  const c = choices.find((x) => x.value === value);
  return c?.allowed ? c.design : d;
}

/** A new count, bringing the placement along when only the other placement takes it (see countChoices). */
export function setCount(d: Design, path: GroupPath, count: number): Design {
  return chosenDesign(d, countChoices(d, path), count);
}

/** A new placement, bringing the nearest count it takes along when the current one doesn't fit (see placementChoices). */
export function setPlacement(d: Design, path: GroupPath, placement: Placement): Design {
  return chosenDesign(d, placementChoices(d, path), placement);
}

/** The resolved design of loose input; throws with the reasons if it doesn't resolve. */
export function nd(input: unknown): Design {
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

export const plain = (tincture: string) => ({ k: 'tincture', t: tincture });

/** A divided paint of two tinctures given as shorthand names. */
export const div = (division: string, ...parts: string[]) => ({ k: 'divided', division, parts });

export const ordinary = (type: string, extra: object = {}) => ({ k: 'ordinary', type, ...extra });

export const charge = (id: string, extra: object = {}) => ({ k: 'charge', charge: id, ...extra });

/** A group of loose input: the item and paint, plus whichever other keys the test cares about. */
export function group(item: object, paint: unknown, extra: object = {}) {
  return { item, paint, ...extra };
}

/** Loose arms input: the field and the groups. */
export function arms(field: unknown, ...groups: object[]) {
  return { v: 2, field, groups };
}

export type LayoutAction =
  | { kind: 'count'; count: number }
  | { kind: 'placement'; placement: Placement }
  | { kind: 'layout'; layout: LayoutKey };

/** Every allowed choice of the count, placement and layout controls of the group at `path`, with the design the builder makes of it. */
export function layoutMoves(d: Design, path: GroupPath): Array<{ action: LayoutAction; design: Design }> {
  const layouts = layoutChoices(d, path);
  return [
    ...countChoices(d, path).filter((c) => c.allowed)
      .map((c) => ({ action: { kind: 'count', count: c.value } as const, design: setCount(d, path, c.value) })),
    ...placementChoices(d, path).filter((c) => c.allowed)
      .map((c) => ({ action: { kind: 'placement', placement: c.value } as const, design: setPlacement(d, path, c.value) })),
    ...(layouts.mode === 'choose' ? layouts.choices.filter((c) => c.allowed) : [])
      .map((c) => ({ action: { kind: 'layout', layout: c.value } as const, design: setLayout(d, path, c.value) })),
  ];
}

/** Progress lines of the long sweeps; silent unless VERBOSE is set. */
export function log(line: string): void {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  if (env?.VERBOSE) console.log(line);
}
