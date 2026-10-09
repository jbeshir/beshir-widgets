// Search tags (FINDINGS §4.7), derived from a NormDesign and stored in arms_tags. A search is an
// AND of tags; filtersToTags() maps the public search parameters onto that vocabulary so the Worker
// and the offline sample search share one implementation.

import { CHARGES, POSTURE_GROUP, isChargeId, isPosture } from './charges';
import { fieldTinctures, isBetweenOrdinary, isDivision, isOrdinaryType, type NormDesign } from './design';
import { readability } from './readability';
import { isTincture, type Tincture } from './tinctures';

/** Deterministic, de-duplicated tag list (derivation order). */
export function deriveTags(nd: NormDesign): string[] {
  const tags: string[] = [];
  const add = (t: string) => { if (!tags.includes(t)) tags.push(t); };
  const all = new Set<Tincture>();

  if (nd.field.kind === 'plain') add('field:plain');
  else add(`division:${nd.field.division}`);
  for (const t of fieldTinctures(nd.field)) { add(`field-tincture:${t}`); all.add(t); }

  const o = nd.ordinary;
  if (o) {
    add(`ordinary:${o.type}`);
    add(`ordinary-tincture:${o.tincture}`);
    all.add(o.tincture);
  }

  const c = nd.charges;
  if (c) {
    add(`charge:${c.charge}`);
    add(`charge-category:${CHARGES[c.charge].category}`);
    add(`charge-tincture:${c.tincture}`);
    add(`charge-count:${c.count}`);
    if (c.posture) {
      add(`posture:${c.posture}`);
      add(`posture-group:${POSTURE_GROUP[c.posture]}`);
    }
    add(`arrangement:${c.arrangement}`);
    if (c.placement === 'ordinary') add('placement:on-ordinary');
    else if (o && isBetweenOrdinary(o.type)) add('placement:between');
    all.add(c.tincture);
  }

  for (const t of all) add(`tincture:${t}`);
  add(`readability:${readability(nd).band}`);
  return tags;
}

/** Public search filters (query parameters of GET /api/arms and the offline registry search). */
export interface SearchFilters {
  tincture?: string | null;
  chargeTincture?: string | null;
  charge?: string | null;
  posture?: string | null;
  ordinary?: string | null;
  /** A division id, or 'plain' for undivided fields. */
  division?: string | null;
}

export type FilterTagsResult = { ok: true; tags: string[] } | { ok: false; param: keyof SearchFilters; message: string };

/** Map filters to required tags, validating each value against its vocabulary. Blank values are ignored. */
export function filtersToTags(f: SearchFilters): FilterTagsResult {
  const tags: string[] = [];
  const check = (param: keyof SearchFilters, ok: (v: string) => boolean, tag: (v: string) => string): FilterTagsResult | null => {
    const v = f[param];
    if (v === undefined || v === null || v === '') return null;
    if (!ok(v)) return { ok: false, param, message: `Unknown ${param} "${v}".` };
    tags.push(tag(v));
    return null;
  };
  const bad =
    check('tincture', isTincture, (v) => `tincture:${v}`) ??
    check('chargeTincture', isTincture, (v) => `charge-tincture:${v}`) ??
    check('charge', isChargeId, (v) => `charge:${v}`) ??
    check('posture', isPosture, (v) => `posture:${v}`) ??
    check('ordinary', isOrdinaryType, (v) => `ordinary:${v}`) ??
    check('division', (v) => v === 'plain' || isDivision(v), (v) => (v === 'plain' ? 'field:plain' : `division:${v}`));
  return bad ?? { ok: true, tags };
}

/** True when the design carries every required tag. */
export function matchesTags(nd: NormDesign, required: readonly string[]): boolean {
  if (!required.length) return true;
  const have = new Set(deriveTags(nd));
  return required.every((t) => have.has(t));
}
