// Registry search filters: state shape, option lists and chip labels. DOM-free.

import {
  CATEGORY_LABEL, CHARGE_CATEGORIES, DIVISIONS, DIVISION_LABEL, ORDINARY_LABEL, ORDINARY_TYPES, POSTURES, POSTURE_GLOSS,
  TINCTURES, TINCTURE_LABEL, chargeLabel, chargesInCategory, type PlainTerm, type Posture, type SearchParams,
} from '../../lib/heraldry/next';
import { capitalise } from '../../lib/heraldry/words';

export const FILTER_KEYS = ['category', 'charge', 'posture', 'ordinary', 'division', 'fieldTincture', 'tincture', 'chargeTincture'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Record<FilterKey, string>;

/** Always visible; the rest sit behind "More filters" on narrow screens. */
export const PRIMARY_FILTERS: FilterKey[] = ['charge', 'ordinary'];

export const isTinctureFilter = (k: FilterKey) => k === 'tincture' || k === 'fieldTincture' || k === 'chargeTincture';

export const EMPTY_FILTERS: Filters = { category: '', charge: '', posture: '', ordinary: '', division: '', fieldTincture: '', tincture: '', chargeTincture: '' };

interface FilterSpec {
  key: FilterKey;
  testid: string;
  label: string;
  /** Label of the empty option. */
  any: string;
  options: Array<{ value: string; label: string; group?: string }>;
}

/** "Gold (Or)": everyday word first, heraldic term in brackets (which chip labels drop). */
const termed = ({ plain, term }: PlainTerm) => `${plain} (${term})`;

/** Everyday words first, as the builder's posture list: "Standing (statant)". */
function postureOption(p: Posture): string {
  const plain = POSTURE_GLOSS[p] ?? (p === 'displayed' ? 'wings spread' : null);
  return plain ? `${capitalise(plain)} (${p})` : capitalise(p);
}

const tinctureOptions = TINCTURES.map((t) => ({ value: t, label: termed(TINCTURE_LABEL[t]) }));

export const FILTER_SPECS: FilterSpec[] = [
  {
    key: 'category', testid: 'filter-category', label: 'Kind of picture', any: 'Any',
    options: CHARGE_CATEGORIES.map((cat) => ({ value: cat, label: CATEGORY_LABEL[cat] })),
  },
  {
    key: 'charge', testid: 'filter-charge', label: 'Picture', any: 'Any',
    options: CHARGE_CATEGORIES.flatMap((cat) =>
      chargesInCategory(cat).map((m) => ({ value: m.id, label: chargeLabel(m.id), group: CATEGORY_LABEL[cat] })),
    ),
  },
  { key: 'posture', testid: 'filter-posture', label: 'Pose', any: 'Any', options: POSTURES.map((p) => ({ value: p, label: postureOption(p) })) },
  { key: 'ordinary', testid: 'filter-ordinary', label: 'Band or shape', any: 'Any', options: ORDINARY_TYPES.map((o) => ({ value: o, label: termed(ORDINARY_LABEL[o]) })) },
  {
    key: 'division', testid: 'filter-division', label: 'Background split', any: 'Any',
    options: [{ value: 'plain', label: 'Plain (one colour)' }, ...DIVISIONS.map((d) => ({ value: d, label: termed(DIVISION_LABEL[d]) }))],
  },
  { key: 'fieldTincture', testid: 'filter-field-tincture', label: 'Background colour', any: 'Any', options: tinctureOptions },
  { key: 'tincture', testid: 'filter-tincture', label: 'Any colour', any: 'Any', options: tinctureOptions },
  {
    key: 'chargeTincture', testid: 'filter-charge-tincture', label: 'Picture colour', any: 'Any',
    options: [...tinctureOptions, { value: 'counterchanged', label: termed(TINCTURE_LABEL.counterchanged) }],
  },
];

/** The chosen option in everyday words ("Gold", "Border"), without the heraldic term. */
export function chipValue(spec: FilterSpec, value: string): string {
  const o = spec.options.find((x) => x.value === value);
  return o ? o.label.replace(/ \(.*\)$/, '') : value;
}

export function chipLabel(spec: FilterSpec, value: string): string {
  return `${spec.label}: ${chipValue(spec, value)}`;
}

export function activeFilters(f: Filters): FilterKey[] {
  return FILTER_KEYS.filter((k) => f[k] !== '');
}

export function toSearchParams(registry: string, q: string, f: Filters, offset = 0): SearchParams {
  return { registry, q: q.trim(), limit: '', offset: offset ? String(offset) : '', ...f };
}

