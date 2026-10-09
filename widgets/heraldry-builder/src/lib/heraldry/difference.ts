// Uniqueness (FINDINGS §3.2): exact duplicate by signature, otherwise "too close" when two designs
// have no clear difference. Same code on client (instant feedback) and Worker (authoritative).

import { CHARGES, POSTURE_GROUP, type Posture } from './charges';
import {
  ARRANGEMENT_WORD, DIVISION_NAME, ORDINARY_NAME, fieldDivision, fieldTinctures,
  type Arrangement, type NormDesign,
} from './design';
import { TINCTURE_NAME } from './tinctures';

export type DiffAttr =
  | 'field-division' | 'field-tincture'
  | 'ordinary-presence' | 'ordinary-type' | 'ordinary-tincture'
  | 'charges-presence' | 'charge-type' | 'charge-tincture' | 'charge-count'
  | 'charge-placement' | 'charge-arrangement' | 'charge-posture';

export interface Diff { attr: DiffAttr; clear: boolean }

const isFixed = (a: Arrangement) => a === 'single' || a === 'forced';
const pg = (p: Posture | null) => (p ? POSTURE_GROUP[p] : null);

export function differences(a: NormDesign, b: NormDesign): Diff[] {
  const d: Diff[] = [];
  const push = (attr: DiffAttr, clear = true) => d.push({ attr, clear });
  // field
  if (fieldDivision(a.field) !== fieldDivision(b.field)) push('field-division');
  else if (fieldTinctures(a.field).join() !== fieldTinctures(b.field).join()) push('field-tincture');
  // ordinary
  if (!!a.ordinary !== !!b.ordinary) push('ordinary-presence');
  else if (a.ordinary && b.ordinary) {
    if (a.ordinary.type !== b.ordinary.type) push('ordinary-type');
    if (a.ordinary.tincture !== b.ordinary.tincture) push('ordinary-tincture');
  }
  // charges
  const ca = a.charges, cb = b.charges;
  if (!!ca !== !!cb) push('charges-presence');
  else if (ca && cb) {
    if (ca.charge !== cb.charge) push('charge-type');
    if (ca.tincture !== cb.tincture) push('charge-tincture');
    if (ca.placement !== cb.placement) push('charge-placement');
    if (ca.count !== cb.count) push('charge-count', !(ca.count >= 4 && cb.count >= 4));
    // Table row 11: clear only when neither arrangement is single/forced (a forced arrangement is
    // dictated by the ordinary, which is already compared above); otherwise listed as minor.
    else if (ca.arrangement !== cb.arrangement) push('charge-arrangement', !isFixed(ca.arrangement) && !isFixed(cb.arrangement));
    if (ca.charge === cb.charge && ca.posture !== cb.posture) push('charge-posture', pg(ca.posture) !== pg(cb.posture));
  }
  return d;
}

export function hasClearDifference(a: NormDesign, b: NormDesign): boolean {
  return differences(a, b).some((x) => x.clear);
}

/** A registry entry as seen by the uniqueness check (scan order = registration order). */
export interface RegistryEntryLike { id: string; signature: string; design: NormDesign }

export type Verdict =
  | { kind: 'ok' }
  | { kind: 'duplicate'; of: string }
  | { kind: 'too-close'; of: string; minor: DiffAttr[] };

/** First exact duplicate, else first entry with no clear difference, else ok. `excludeId` skips self on edit. */
export function checkUnique(nd: NormDesign, sig: string, registry: readonly RegistryEntryLike[], excludeId?: string): Verdict {
  for (const e of registry) if (e.id !== excludeId && e.signature === sig) return { kind: 'duplicate', of: e.id };
  for (const e of registry) {
    if (e.id === excludeId) continue;
    const ds = differences(nd, e.design);
    if (!ds.some((x) => x.clear)) return { kind: 'too-close', of: e.id, minor: ds.map((x) => x.attr) };
  }
  return { kind: 'ok' };
}

export const DIFF_LABEL: Record<DiffAttr, string> = {
  'field-division': 'field division',
  'field-tincture': 'field tincture',
  'ordinary-presence': 'ordinary',
  'ordinary-type': 'ordinary type',
  'ordinary-tincture': 'ordinary tincture',
  'charges-presence': 'charges',
  'charge-type': 'charge type',
  'charge-tincture': 'charge tincture',
  'charge-count': 'count',
  'charge-placement': 'placement',
  'charge-arrangement': 'arrangement',
  'charge-posture': 'posture',
};

/** The attributes a too-close design could change to become clear (UI hint). */
export const CLEAR_CHANGE_HINT = 'field, ordinary, charge type, tincture, count (1, 2, 3 or 4+), arrangement or posture group';

/** Human descriptions of each difference between `a` (new) and `b` (existing): "posture (passant ↔ statant)". */
export function explainDifferences(a: NormDesign, b: NormDesign, diffs: readonly Diff[] = differences(a, b)): string[] {
  const ca = a.charges, cb = b.charges;
  return diffs.map(({ attr }) => {
    const label = DIFF_LABEL[attr];
    const pair = (x: string, y: string) => `${label} (${x} ↔ ${y})`;
    switch (attr) {
      case 'field-division':
        return pair(a.field.kind === 'plain' ? 'plain' : DIVISION_NAME[a.field.division].toLowerCase(),
          b.field.kind === 'plain' ? 'plain' : DIVISION_NAME[b.field.division].toLowerCase());
      case 'field-tincture':
        return pair(fieldTinctures(a.field).map((t) => TINCTURE_NAME[t]).join('/'), fieldTinctures(b.field).map((t) => TINCTURE_NAME[t]).join('/'));
      case 'ordinary-presence':
        return pair(a.ordinary ? ORDINARY_NAME[a.ordinary.type] : 'none', b.ordinary ? ORDINARY_NAME[b.ordinary.type] : 'none');
      case 'ordinary-type': return pair(ORDINARY_NAME[a.ordinary!.type], ORDINARY_NAME[b.ordinary!.type]);
      case 'ordinary-tincture': return pair(TINCTURE_NAME[a.ordinary!.tincture], TINCTURE_NAME[b.ordinary!.tincture]);
      case 'charges-presence': return pair(ca ? CHARGES[ca.charge].plural : 'none', cb ? CHARGES[cb.charge].plural : 'none');
      case 'charge-type': return pair(CHARGES[ca!.charge].name, CHARGES[cb!.charge].name);
      case 'charge-tincture': return pair(TINCTURE_NAME[ca!.tincture], TINCTURE_NAME[cb!.tincture]);
      case 'charge-count': return pair(String(ca!.count), String(cb!.count));
      case 'charge-placement':
        return pair(ca!.placement === 'ordinary' ? 'on the ordinary' : 'on the field', cb!.placement === 'ordinary' ? 'on the ordinary' : 'on the field');
      case 'charge-arrangement': return pair(ARRANGEMENT_WORD[ca!.arrangement], ARRANGEMENT_WORD[cb!.arrangement]);
      case 'charge-posture': return pair(ca!.posture ?? 'none', cb!.posture ?? 'none');
    }
  });
}
