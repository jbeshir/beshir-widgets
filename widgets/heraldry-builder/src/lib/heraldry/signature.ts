// Canonical signature (FINDINGS §4.6), computed only from a NormDesign. Equivalent inputs normalise
// to the same signature, so "you can't blazon your way out" of a duplicate.

import type { Field, NormDesign } from './design';
import { TINCTURE_CODE } from './tinctures';

function fieldSig(f: Field): string {
  return f.kind === 'plain'
    ? `plain:${TINCTURE_CODE[f.tincture]}`
    : `${f.division}:${TINCTURE_CODE[f.tinctures[0]]}:${TINCTURE_CODE[f.tinctures[1]]}`;
}

export function signature(nd: NormDesign): string {
  const o = nd.ordinary ? `${nd.ordinary.type}:${TINCTURE_CODE[nd.ordinary.tincture]}` : '-';
  const c = nd.charges;
  const chg = c
    ? `${c.charge}:${c.count}:${c.placement}:${c.arrangement}:${c.posture ?? '-'}:${TINCTURE_CODE[c.tincture]}`
    : '-';
  return `v1|F:${fieldSig(nd.field)}|O:${o}|C:${chg}`;
}
