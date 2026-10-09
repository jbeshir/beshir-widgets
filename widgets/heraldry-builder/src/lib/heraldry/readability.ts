// Readability score (FINDINGS §4.8): a nudge towards designs that read at nametag size.
// Busy designs stay registrable.

import { isAnimate } from './charges';
import { fieldTinctures, type NormDesign } from './design';
import { chargeSlotContacts } from './tincture-rule';
import type { Tincture } from './tinctures';

export type ReadabilityBand = 'bold' | 'fine' | 'busy';
export type ReadabilityFactor = 'tinctures' | 'division' | 'ordinary' | 'charges' | 'on-ordinary' | 'count' | 'animate' | 'split';

export interface Readability {
  score: number;
  band: ReadabilityBand;
  /** Every factor in table order, including those scoring 0 (the UI may hide zeros). */
  breakdown: Array<{ factor: ReadabilityFactor; label: string; points: number }>;
}

export const BAND_LABEL: Record<ReadabilityBand, string> = { bold: 'Bold', fine: 'Fine', busy: 'Busy' };

export function designTinctures(nd: NormDesign): Tincture[] {
  const ts = new Set<Tincture>(fieldTinctures(nd.field));
  if (nd.ordinary) ts.add(nd.ordinary.tincture);
  // Counterchanged charges are drawn in the field's own tinctures.
  if (nd.charges && nd.charges.tincture !== 'counterchanged') ts.add(nd.charges.tincture);
  return [...ts];
}

/** Counterchanged charges cut in two by a partition line: each one reads as two shapes from afar. */
function splitCharges(nd: NormDesign): boolean {
  return nd.charges?.tincture === 'counterchanged' && chargeSlotContacts(nd).some((cs) => cs.length > 1);
}

export function readabilityBand(score: number): ReadabilityBand {
  return score <= 3 ? 'bold' : score <= 6 ? 'fine' : 'busy';
}

export function readability(nd: NormDesign): Readability {
  const n = designTinctures(nd).length;
  const f = nd.field;
  const division = f.kind === 'plain' ? 0 : f.division === 'quarterly' || f.division === 'per-saltire' ? 2 : 1;
  const c = nd.charges;
  const count = !c ? 0 : c.count === 1 ? 0 : c.count <= 3 ? 1 : 2;
  const breakdown: Readability['breakdown'] = [
    { factor: 'tinctures', label: `${n} tinctures`, points: Math.max(0, n - 2) },
    { factor: 'division', label: f.kind === 'plain' ? 'Plain field' : 'Divided field', points: division },
    { factor: 'ordinary', label: 'Ordinary', points: nd.ordinary ? 1 : 0 },
    { factor: 'charges', label: 'Charges', points: c ? 1 : 0 },
    { factor: 'on-ordinary', label: 'Charges on the ordinary', points: c && c.placement === 'ordinary' ? 1 : 0 },
    { factor: 'count', label: c ? `${c.count} ${c.count === 1 ? 'charge' : 'charges'}` : 'No charges', points: count },
    { factor: 'animate', label: 'Detailed creature', points: c && isAnimate(c.charge) ? 1 : 0 },
    { factor: 'split', label: 'Charges split by the field line', points: splitCharges(nd) ? 1 : 0 },
  ];
  const score = breakdown.reduce((s, b) => s + b.points, 0);
  return { score, band: readabilityBand(score), breakdown };
}
