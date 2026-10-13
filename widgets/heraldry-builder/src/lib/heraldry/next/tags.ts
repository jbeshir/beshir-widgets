// Search tags, derived from a Design and stored in arms_tags. A search is an AND of tags; filtersToTags()
// maps the public search parameters onto that vocabulary so the Worker and the offline sample search
// share one implementation.

import { isChargeTincture, isTincture, type Tincture } from '../tinctures';
import { CHARGES, isChargeCategory, isChargeId, isPosture } from './charges';
import { isDivision } from './divisions';
import { fieldTinctures, walkGroups, type Design } from './design';
import { isOrdinaryType } from './ordinaries';
import { layoutKey } from './arrangement';
import { readability } from './readability';

/** Deterministic, de-duplicated tag list (derivation order). */
export function deriveTags(d: Design): string[] {
  const tags: string[] = [];
  const add = (t: string) => { if (!tags.includes(t)) tags.push(t); };
  const all = new Set<Tincture>();

  if (d.kind === 'arms') add(d.field.k === 'divided' ? `division:${d.field.division}` : 'field:plain');
  for (const t of fieldTinctures(d)) { add(`field-tincture:${t}`); all.add(t); }

  for (const { group, host } of walkGroups(d)) {
    const paint = group.paint.k === 'counterchanged' ? 'counterchanged' : group.paint.k === 'tincture' ? group.paint.t : null;
    if (group.item.k === 'ordinary') {
      add(`ordinary:${group.item.type}`);
      if (paint) add(`ordinary-tincture:${paint}`);
    } else {
      const { charge, posture } = group.item;
      add(`charge:${charge}`);
      add(`charge-category:${CHARGES[charge].category}`);
      if (paint) add(`charge-tincture:${paint}`);
      add(`charge-count:${group.count}`);
      if (posture) add(`posture:${posture}`);
      add(`layout:${layoutKey({ arrangement: group.arrangement, position: group.position })}`);
      if (host) add(host.item.k === 'ordinary' && host.item.type === 'chief' ? 'placement:on-chief' : 'placement:on-ordinary');
      else if (group.relation === 'between') add('placement:between');
    }
    if (group.paint.k === 'tincture') all.add(group.paint.t);
  }

  for (const t of all) add(`tincture:${t}`);
  add(`readability:${readability(d).band}`);
  return tags;
}

/** Public search filters (query parameters of GET /api/arms and the offline registry search); '' = not filtering. */
export interface SearchFilters {
  tincture: string;
  /** A tincture of the field (either half of a divided field). */
  fieldTincture: string;
  /** The charges' tincture, or 'counterchanged'. */
  chargeTincture: string;
  charge: string;
  /** A charge category: beast, monster, bird, plant, geometric, object or modern. */
  category: string;
  posture: string;
  ordinary: string;
  /** A division id, or 'plain' for undivided fields. */
  division: string;
}

export const NO_FILTERS: SearchFilters = {
  tincture: '', fieldTincture: '', chargeTincture: '', charge: '', category: '', posture: '', ordinary: '', division: '',
};

type FilterTagsResult = { ok: true; tags: string[] } | { ok: false; param: keyof SearchFilters; message: string };

/** Map filters to required tags, validating each value against its vocabulary. Blank values are ignored. */
export function filtersToTags(f: SearchFilters): FilterTagsResult {
  const tags: string[] = [];
  const check = (param: keyof SearchFilters, ok: (v: string) => boolean, tag: (v: string) => string): FilterTagsResult | null => {
    const v = f[param];
    if (v === '') return null;
    if (!ok(v)) return { ok: false, param, message: `Unknown ${param} "${v}".` };
    tags.push(tag(v));
    return null;
  };
  const bad =
    check('tincture', isTincture, (v) => `tincture:${v}`) ??
    check('fieldTincture', isTincture, (v) => `field-tincture:${v}`) ??
    check('chargeTincture', isChargeTincture, (v) => `charge-tincture:${v}`) ??
    check('charge', isChargeId, (v) => `charge:${v}`) ??
    check('category', isChargeCategory, (v) => `charge-category:${v}`) ??
    check('posture', isPosture, (v) => `posture:${v}`) ??
    check('ordinary', isOrdinaryType, (v) => `ordinary:${v}`) ??
    check('division', (v) => v === 'plain' || isDivision(v), (v) => (v === 'plain' ? 'field:plain' : `division:${v}`));
  return bad ?? { ok: true, tags };
}

/** True when the design carries every required tag. */
export function matchesTags(d: Design, required: readonly string[]): boolean {
  if (!required.length) return true;
  const have = new Set(deriveTags(d));
  return required.every((t) => have.has(t));
}
