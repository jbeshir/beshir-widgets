// Readability score: a nudge towards designs that read at nametag size. Lower is easier to spot.
// Busy designs stay registrable. Points come from how many tinctures there are, how the field is
// divided, how well neighbouring tinctures contrast, how many and how small the charges are, and how
// much detail each charge carries.

import { CHARGES } from './charges';
import { fieldTinctures, NUMBER_WORD, ORDINARY_NAME, chargeContext, chargeNoun, type Count, type NormDesign } from './design';
import { chargeSlots, drawnBox } from './geometry';
import { countChoices } from './options';
import { chargeSlotContacts, ordinaryContacts } from './tincture-rule';
import { TINCTURE_CLASS, TINCTURE_WORD, type Tincture } from './tinctures';

/**
 * Stored band ids (the registry's readability column and the sample data). They are storage values, not
 * display text: the words people see are in BAND_LABEL, so renaming a label never needs a migration.
 */
export type ReadabilityBand = 'bold' | 'fine' | 'busy';
type ReadabilityFactor =
  | 'tinctures' | 'division' | 'touching' | 'straddle' | 'ordinary' | 'on-ordinary' | 'count' | 'detail' | 'split';

export interface Readability {
  score: number;
  band: ReadabilityBand;
  /** Every factor in table order, including those scoring 0 (the UI may hide zeros). */
  breakdown: Array<{ factor: ReadabilityFactor; label: string; points: number }>;
  /** What to change first, naming the single biggest factor; null for an easy-to-spot design. */
  nudge: string | null;
}

export const BAND_LABEL: Record<ReadabilityBand, string> = { bold: 'Easy to spot', fine: 'OK', busy: 'Hard to read' };

export function isReadabilityBand(value: unknown): value is ReadabilityBand {
  return typeof value === 'string' && Object.hasOwn(BAND_LABEL, value);
}

/** Score ranges shown beside each band. */
export const BAND_RANGE: Record<ReadabilityBand, string> = { bold: '0–2', fine: '3–4', busy: '5+' };

/** Charges drawn smaller than this (shield units, after the charge's optical scale) cost a point. */
const SMALL_CHARGE = 32;

/** Breaks ties between equally heavy factors: the first listed is the one worth fixing first. */
const NUDGE_PRIORITY: readonly ReadabilityFactor[] = [
  'touching', 'straddle', 'count', 'detail', 'tinctures', 'split', 'on-ordinary', 'ordinary', 'division',
];

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

function readabilityBand(score: number): ReadabilityBand {
  return score <= 2 ? 'bold' : score <= 4 ? 'fine' : 'busy';
}

/** The tinctures `top` is drawn on that are of its own class, when it also lies on some of the other class. */
function lookAlikeContacts(top: Tincture, contacts: readonly Tincture[]): Tincture[] {
  const alike = contacts.filter((c) => TINCTURE_CLASS[c] === TINCTURE_CLASS[top]);
  return alike.length > 0 && alike.length < contacts.length ? alike : [];
}

interface Straddle { subject: string; plural: boolean; tincture: Tincture; weak: Tincture }

/** The first ordinary or charge that lies half on a tincture of its own class, so only half of it shows up. */
function straddle(nd: NormDesign): Straddle | null {
  const { field, ordinary, charges } = nd;
  if (ordinary) {
    const [weak] = lookAlikeContacts(ordinary.tincture, ordinaryContacts(field, ordinary.type));
    if (weak) return { subject: ORDINARY_NAME[ordinary.type], plural: false, tincture: ordinary.tincture, weak };
  }
  if (charges && charges.tincture !== 'counterchanged') {
    for (const contacts of chargeSlotContacts(nd)) {
      const [weak] = lookAlikeContacts(charges.tincture, contacts);
      if (weak) return { subject: chargeNoun(charges.charge, charges.count), plural: charges.count > 1, tincture: charges.tincture, weak };
    }
  }
  return null;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The fewer charges worth suggesting: three if that is allowed here, else the nearest smaller legal count. */
function lighterCount(nd: NormDesign): Count | null {
  const fewer = countChoices(nd).filter((c) => c.allowed && c.value < nd.charges!.count).map((c) => c.value);
  return fewer.filter((n) => n <= 3).pop() ?? fewer[0] ?? null;
}

export function readability(nd: NormDesign): Readability {
  const n = designTinctures(nd).length;
  const f = nd.field;
  const c = nd.charges;
  const meta = c ? CHARGES[c.charge] : null;
  const [t1, t2] = fieldTinctures(f);
  const touching = f.kind === 'divided' && TINCTURE_CLASS[t1] === TINCTURE_CLASS[t2];
  const crossing = straddle(nd);
  const smallest = c ? Math.min(...chargeSlots(nd).map((s) => drawnBox(s, c.charge).size)) : Infinity;
  const countPoints = !c ? 0 : c.count === 1 ? 0 : c.count <= 3 ? 1 : c.count <= 5 ? 2 : 3;
  const count = countPoints + (smallest < SMALL_CHARGE ? 1 : 0);
  const lighter = c ? lighterCount(nd) : null;

  const rows: Array<{ factor: ReadabilityFactor; label: string; points: number; advice: string | null }> = [
    {
      factor: 'tinctures', label: `${n} tinctures`, points: Math.max(0, n - 2),
      advice: 'Too many tinctures — try using only two',
    },
    {
      factor: 'division', label: f.kind === 'plain' ? 'Plain field' : 'Split field', points: f.kind === 'plain' ? 0 : 1,
      advice: 'Try a plain field instead of a split one',
    },
    {
      factor: 'touching', label: 'Neighbouring tinctures look alike', points: touching ? 2 : 0,
      advice: touching ? `${cap(TINCTURE_WORD[t1])} on ${TINCTURE_WORD[t2]} is hard to see — try a ${TINCTURE_CLASS[t1] === 'metal' ? 'colour' : 'metal'}` : null,
    },
    {
      factor: 'straddle', label: 'Half of it lies on a look-alike tincture', points: crossing ? 1 : 0,
      advice: crossing
        ? `The ${TINCTURE_WORD[crossing.tincture]} ${crossing.subject} ${crossing.plural ? 'are' : 'is'} hard to see against the ${TINCTURE_WORD[crossing.weak]} part of the field — try a plain field`
        : null,
    },
    {
      factor: 'ordinary', label: 'Ordinary', points: nd.ordinary ? 1 : 0,
      advice: nd.ordinary ? `Try without the ${ORDINARY_NAME[nd.ordinary.type]}` : null,
    },
    {
      factor: 'on-ordinary', label: 'Charges on the ordinary', points: c && c.placement === 'ordinary' ? 1 : 0,
      advice: nd.ordinary ? `Try putting the ${c ? chargeNoun(c.charge, c.count) : 'charges'} on the field instead of on the ${ORDINARY_NAME[nd.ordinary.type]}` : null,
    },
    {
      factor: 'count', label: c ? `${c.count} ${c.count === 1 ? 'charge' : 'charges'}${smallest < SMALL_CHARGE ? ', drawn small' : ''}` : 'No charges', points: count,
      advice: !c || !meta ? null
        : lighter !== null
          ? `Try ${lighter === 1 ? `a single ${meta.name}` : `${NUMBER_WORD[lighter]} ${meta.plural}`} instead of ${NUMBER_WORD[c.count]}`
          : chargeContext(nd.ordinary, c.placement) === 'on' ? `The ${meta.name} is small on the ${nd.ordinary ? ORDINARY_NAME[nd.ordinary.type] : 'ordinary'} — try putting it on the field instead`
          : null,
    },
    {
      factor: 'detail', label: 'Detailed picture', points: meta?.detail ?? 0,
      advice: meta ? `${cap(meta.article)} ${meta.name} has fine detail — a simpler picture reads better at a distance` : null,
    },
    {
      factor: 'split', label: 'Charges split by the field line', points: splitCharges(nd) ? 1 : 0,
      advice: 'The field line cuts through the charges — try a plain field or another tincture',
    },
  ];

  const score = rows.reduce((s, r) => s + r.points, 0);
  const band = readabilityBand(score);
  const heaviest = rows
    .filter((r) => r.points > 0 && r.advice !== null)
    .sort((a, b) => b.points - a.points || NUDGE_PRIORITY.indexOf(a.factor) - NUDGE_PRIORITY.indexOf(b.factor))[0];
  return {
    score,
    band,
    breakdown: rows.map(({ factor, label, points }) => ({ factor, label, points })),
    nudge: band === 'bold' ? null : heaviest?.advice ?? null,
  };
}
