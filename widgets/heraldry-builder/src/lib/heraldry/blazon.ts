// Blazon generation (FINDINGS §4.4): every tincture capitalised, every element states its own
// tincture, posture always stated, default arrangements omitted, no trailing full stop.

import { CHARGES, postureTerm } from './charges';
import {
  ARRANGEMENT_WORD, DEFAULT_ARR, DIVISION_NAME, NUMBER_WORD, ORDINARY_NAME, bodyKind,
  type Field, type NormChargeGroup, type NormDesign, type Ordinary,
} from './design';
import { TINCTURE_NAME } from './tinctures';

export function fieldBlazon(field: Field): string {
  if (field.kind === 'plain') return TINCTURE_NAME[field.tincture];
  return `${DIVISION_NAME[field.division]} ${TINCTURE_NAME[field.tinctures[0]]} and ${TINCTURE_NAME[field.tinctures[1]]}`;
}

/** "three lions passant in pale Or": number → name → posture → arrangement → tincture. */
export function groupBlazon(c: NormChargeGroup): string {
  const meta = CHARGES[c.charge];
  const parts = [c.count === 1 ? meta.article : NUMBER_WORD[c.count], c.count === 1 ? meta.name : meta.plural];
  if (c.posture) parts.push(postureTerm(c.charge, c.posture));
  if (c.placement === 'field' && c.arrangement !== 'single' && c.arrangement !== 'forced'
      && c.count !== 1 && c.arrangement !== DEFAULT_ARR[c.count]) {
    parts.push(ARRANGEMENT_WORD[c.arrangement]);
  }
  parts.push(TINCTURE_NAME[c.tincture]);
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
    case 'chargesOnly': return `${field}, ${groupBlazon(c!)}`;
    case 'onOrd': return `${field}, on a ${ord(o!)} ${groupBlazon(c!)}`;
    case 'between': return `${field}, a ${ord(o!)} between ${groupBlazon(c!)}`;
    case 'withChief': return `${field}, ${groupBlazon(c!)}, a chief ${TINCTURE_NAME[o!.tincture]}`;
    case 'withBordure': return `${field}, ${groupBlazon(c!)} within a bordure ${TINCTURE_NAME[o!.tincture]}`;
  }
}
