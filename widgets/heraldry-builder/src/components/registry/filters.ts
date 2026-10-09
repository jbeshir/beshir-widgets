// Registry search filters: state shape, option lists and chip labels. DOM-free.

import {
  CATEGORY_LABEL, CHARGES, CHARGE_CATEGORIES, DIVISIONS, DIVISION_NAME, ORDINARY_NAME, ORDINARY_TYPES, POSTURES, TINCTURES,
  TINCTURE_GLOSS, TINCTURE_NAME, chargesInCategory, type SearchParams,
} from '../../lib/heraldry';

export const FILTER_KEYS = ['charge', 'posture', 'ordinary', 'division', 'tincture', 'chargeTincture'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Record<FilterKey, string>;

/** Always visible; the rest sit behind "More filters" on narrow screens. */
export const PRIMARY_FILTERS: FilterKey[] = ['charge', 'ordinary'];

export const isTinctureFilter = (k: FilterKey) => k === 'tincture' || k === 'chargeTincture';

export const EMPTY_FILTERS: Filters = { charge: '', posture: '', ordinary: '', division: '', tincture: '', chargeTincture: '' };

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface FilterSpec {
  key: FilterKey;
  testid: string;
  label: string;
  /** Label of the empty option. */
  any: string;
  options: Array<{ value: string; label: string; group?: string }>;
}

const tinctureOptions = TINCTURES.map((t) => ({ value: t, label: `${TINCTURE_NAME[t]} (${TINCTURE_GLOSS[t]})` }));

export const FILTER_SPECS: FilterSpec[] = [
  {
    key: 'charge', testid: 'filter-charge', label: 'Charge', any: 'Any',
    options: CHARGE_CATEGORIES.flatMap((cat) =>
      chargesInCategory(cat).map((m) => ({ value: m.id, label: cap(m.name), group: CATEGORY_LABEL[cat] })),
    ),
  },
  { key: 'posture', testid: 'filter-posture', label: 'Posture', any: 'Any', options: POSTURES.map((p) => ({ value: p, label: cap(p) })) },
  { key: 'ordinary', testid: 'filter-ordinary', label: 'Ordinary', any: 'Any', options: ORDINARY_TYPES.map((o) => ({ value: o, label: cap(ORDINARY_NAME[o]) })) },
  {
    key: 'division', testid: 'filter-division', label: 'Field', any: 'Any',
    options: [{ value: 'plain', label: 'Plain (undivided)' }, ...DIVISIONS.map((d) => ({ value: d, label: DIVISION_NAME[d] }))],
  },
  { key: 'tincture', testid: 'filter-tincture', label: 'Tincture (anywhere)', any: 'Any', options: tinctureOptions },
  { key: 'chargeTincture', testid: 'filter-charge-tincture', label: 'Charge tincture', any: 'Any', options: tinctureOptions },
];

export function chipLabel(spec: FilterSpec, value: string): string {
  const o = spec.options.find((x) => x.value === value);
  const text = o ? o.label.replace(/ \(.*\)$/, '') : value;
  return `${spec.key === 'tincture' ? 'Tincture' : spec.label}: ${text}`;
}

export function activeFilters(f: Filters): FilterKey[] {
  return FILTER_KEYS.filter((k) => f[k] !== '');
}

export function toSearchParams(registry: string | null, q: string, f: Filters, offset = 0): SearchParams {
  return { registry, q: q.trim() || null, offset: offset || null, ...f };
}

/** One-line name of a charge id for headings. */
export function chargeName(id: string): string {
  return id in CHARGES ? cap(CHARGES[id as keyof typeof CHARGES].name) : id;
}
