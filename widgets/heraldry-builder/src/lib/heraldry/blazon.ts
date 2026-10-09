// Blazon generation (FINDINGS §4.4): every tincture capitalised, every element states its own
// tincture (or "counterchanged"), posture always stated, default arrangements omitted — including
// the only arrangement a place allows — no trailing full stop.

import { CHARGES, postureTerm } from './charges';
import {
  ARRANGEMENT_WORD, DIVISION_NAME, NUMBER_WORD, ORDINARY_NAME, bodyKind, defaultArrangement, legalArrangements,
  type Field, type NormChargeGroup, type NormDesign, type Ordinary,
} from './design';
import { CHARGE_TINCTURE_NAME, TINCTURE_NAME } from './tinctures';

export function fieldBlazon(field: Field): string {
  if (field.kind === 'plain') return TINCTURE_NAME[field.tincture];
  return `${DIVISION_NAME[field.division]} ${TINCTURE_NAME[field.tinctures[0]]} and ${TINCTURE_NAME[field.tinctures[1]]}`;
}

/**
 * Whether the blazon must name the arrangement: only when the place allows a choice and this isn't
 * its default (two charges under a chief can only be in fess, so that goes unsaid).
 */
function statesArrangement(c: NormChargeGroup, ordinary: Ordinary | null): boolean {
  return legalArrangements(ordinary, c.placement, c.count).length > 1
    && c.arrangement !== defaultArrangement(ordinary, c.placement, c.count);
}

/** "three lions passant in pale Or": number → name → posture → arrangement → tincture. */
export function groupBlazon(c: NormChargeGroup, ordinary: Ordinary | null): string {
  const meta = CHARGES[c.charge];
  const parts = [c.count === 1 ? meta.article : NUMBER_WORD[c.count], c.count === 1 ? meta.name : meta.plural];
  if (c.posture) parts.push(postureTerm(c.charge, c.posture));
  if (statesArrangement(c, ordinary)) parts.push(ARRANGEMENT_WORD[c.arrangement]);
  parts.push(CHARGE_TINCTURE_NAME[c.tincture]);
  return parts.join(' ');
}

function ord(o: Ordinary): string {
  return `${ORDINARY_NAME[o.type]} ${TINCTURE_NAME[o.tincture]}`;
}

export function blazon(nd: NormDesign): string {
  const field = fieldBlazon(nd.field);
  const o = nd.ordinary, c = nd.charges;
  switch (bodyKind(nd)) {
    case 'none': return field;
    case 'ordOnly': return `${field}, a ${ord(o!)}`;
    case 'chargesOnly': return `${field}, ${groupBlazon(c!, o)}`;
    case 'onOrd': return `${field}, on a ${ord(o!)} ${groupBlazon(c!, o)}`;
    case 'between': return `${field}, a ${ord(o!)} between ${groupBlazon(c!, o)}`;
    case 'withChief': return `${field}, ${groupBlazon(c!, o)}, a chief ${TINCTURE_NAME[o!.tincture]}`;
    case 'withBordure': return `${field}, ${groupBlazon(c!, o)} within a bordure ${TINCTURE_NAME[o!.tincture]}`;
  }
}
