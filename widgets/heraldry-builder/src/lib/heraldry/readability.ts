// Readability score: a nudge towards designs that read at nametag size. Lower is easier to spot.
// Busy designs stay registrable. Points come from how many tinctures there are, how the field is
// divided, how well neighbouring tinctures contrast, how many and how small the charges are, and how
// much detail each charge carries.

import { TINCTURE_CLASS, TINCTURE_WORD, type Tincture } from './tinctures';
import { capitalise, numberWord } from './words';
import { CHARGES } from './charges';
import { defaultLayoutOf } from './arrangement';
import { fieldTinctures, replaceGroup, walkGroups, type Design, type Group, type WalkedGroup } from './design';
import { drawnBox } from './geometry';
import { canonicalSlots } from './layout';
import { chargeWords, ordinaryWords } from './plain-words';
import { designTinctures } from './render';
import { structuralIssues } from './structure';
import { groundContacts } from './tincture-rule';
import { tinctureSurface } from './surface';

/**
 * Stored band ids (the registry's readability column and the sample data). They are storage values, not
 * display text: the words people see are in BAND_LABEL, so renaming a label never needs a migration.
 */
export type ReadabilityBand = 'bold' | 'fine' | 'busy';
type ReadabilityFactor =
  | 'tinctures' | 'division' | 'touching' | 'straddle' | 'ordinary' | 'tertiary' | 'count' | 'detail' | 'split';

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
  'touching', 'straddle', 'count', 'detail', 'tinctures', 'split', 'tertiary', 'ordinary', 'division',
];

function readabilityBand(score: number): ReadabilityBand {
  return score <= 2 ? 'bold' : score <= 4 ? 'fine' : 'busy';
}

/** The tinctures `top` is drawn on that are of its own class, when it also lies on some of the other class. */
function lookAlikeContacts(top: Tincture, contacts: readonly Tincture[]): Tincture[] {
  const alike = contacts.filter((c) => tinctureSurface(c).cls === tinctureSurface(top).cls);
  return alike.length > 0 && alike.length < contacts.length ? alike : [];
}

interface Straddle { subject: string; plural: boolean; tincture: Tincture; weak: Tincture }

/** The first ordinary or charge that lies half on a tincture of its own class, so only half of it shows up. */
function straddle(d: Design, entries: readonly WalkedGroup[]): Straddle | null {
  for (const { path, group } of entries) {
    if (group.paint.k !== 'tincture') continue;
    const tincture = group.paint.t;
    for (const contacts of groundContacts(d, path)) {
      const [weak] = lookAlikeContacts(tincture, contacts);
      if (weak) {
        return group.item.k === 'ordinary'
          ? { subject: ordinaryWords(group.item.type), plural: false, tincture, weak }
          : { subject: chargeWords(group.item.charge, group.count), plural: group.count > 1, tincture, weak };
      }
    }
  }
  return null;
}

/** Counterchanged groups cut in two by a partition line: each one reads as two shapes from afar. */
function split(d: Design, entries: readonly WalkedGroup[]): boolean {
  return entries.some(({ path, group }) => group.paint.k === 'counterchanged' && groundContacts(d, path).some((cs) => cs.length > 1));
}

/** The fewer charges worth suggesting: three if that is allowed here, else the nearest smaller legal count. */
function lighterCount(d: Design, { path, group, host }: WalkedGroup): number | null {
  const fewer = Array.from({ length: group.count - 1 }, (_, i) => i + 1).filter((n) => {
    const lighter: Group = { ...group, count: n, ...defaultLayoutOf(d, group, host, n) };
    return structuralIssues(replaceGroup(d, path, lighter)).every((i) => i.at.k !== 'group' || i.at.path.join() !== path.join());
  });
  return fewer.filter((n) => n <= 3).pop() ?? fewer[0] ?? null;
}

export function readability(d: Design): Readability {
  const entries = walkGroups(d);
  const charges = entries.filter(({ group }) => group.item.k === 'charge');
  const ordinaries = entries.filter(({ group }) => group.item.k === 'ordinary');
  const tertiaries = entries.filter(({ group }) => group.role === 'tertiary');
  const n = designTinctures(d).length;
  const parts = fieldTinctures(d);
  const divided = d.kind === 'arms' && d.field.k === 'divided';
  const touching = divided && parts.length === 2 && tinctureSurface(parts[0]).cls === tinctureSurface(parts[1]).cls;
  const crossing = straddle(d, entries);

  // The largest charge group sets the count score; each further group adds a point.
  const biggest = charges.reduce<WalkedGroup | null>((best, e) => (best === null || e.group.count > best.group.count ? e : best), null);
  const sizes = charges.flatMap(({ path, group: { item } }) =>
    item.k === 'charge' ? canonicalSlots(d, path).map((s) => drawnBox(s, item.charge).size) : []);
  const smallest = Math.min(Infinity, ...sizes);
  const sizePoints = (c: number) => (c === 1 ? 0 : c <= 3 ? 1 : c <= 5 ? 2 : 3);
  const count = (biggest ? sizePoints(biggest.group.count) : 0) + Math.max(0, charges.length - 1) + (smallest < SMALL_CHARGE ? 1 : 0);
  const lighter = biggest ? lighterCount(d, biggest) : null;
  const detailed = charges.reduce<{ points: number; entry: WalkedGroup | null }>((best, e) => {
    const points = e.group.item.k === 'charge' ? CHARGES[e.group.item.charge].detail : 0;
    return points > best.points ? { points, entry: e } : best;
  }, { points: 0, entry: null });
  const biggestMeta = biggest && biggest.group.item.k === 'charge' ? CHARGES[biggest.group.item.charge] : null;
  const detailMeta = detailed.entry && detailed.entry.group.item.k === 'charge' ? CHARGES[detailed.entry.group.item.charge] : null;
  const firstOrdinary = ordinaries[0]?.group.item;

  const rows: Array<{ factor: ReadabilityFactor; label: string; points: number; advice: string | null }> = [
    {
      factor: 'tinctures', label: `${n} colours`, points: Math.max(0, n - 2),
      advice: 'Too many colours — try using only two',
    },
    {
      factor: 'division', label: divided ? 'Split background' : 'Plain background', points: divided ? 1 : 0,
      advice: 'Try a plain background instead of a split one',
    },
    {
      factor: 'touching', label: 'Neighbouring colours look alike', points: touching ? 2 : 0,
      advice: touching ? `${capitalise(TINCTURE_WORD[parts[0]])} on ${TINCTURE_WORD[parts[1]]} is hard to see — try a ${TINCTURE_CLASS[parts[0]] === 'metal' ? 'colour' : 'metal'}` : null,
    },
    {
      factor: 'straddle', label: 'Half of it lies on a look-alike colour', points: crossing ? 1 : 0,
      advice: crossing
        ? `The ${TINCTURE_WORD[crossing.tincture]} ${crossing.subject} ${crossing.plural ? 'are' : 'is'} hard to see against the ${TINCTURE_WORD[crossing.weak]} part of the background — try a plain background`
        : null,
    },
    {
      factor: 'ordinary', label: 'Band or shape', points: ordinaries.length,
      advice: firstOrdinary?.k === 'ordinary' ? `Try without the ${ordinaryWords(firstOrdinary.type)}` : null,
    },
    {
      factor: 'tertiary', label: 'Pictures on the band', points: tertiaries.length > 0 ? 1 : 0,
      advice: tertiaries.length > 0 && firstOrdinary?.k === 'ordinary'
        ? `Try putting the ${tertiaries[0].group.item.k === 'charge' ? chargeWords(tertiaries[0].group.item.charge, tertiaries[0].group.count) : 'pictures'} on the background instead of on the ${ordinaryWords(firstOrdinary.type)}`
        : null,
    },
    {
      factor: 'count',
      label: biggest ? `${biggest.group.count} ${biggest.group.count === 1 ? 'picture' : 'pictures'}${smallest < SMALL_CHARGE ? ', drawn small' : ''}` : 'No pictures',
      points: count,
      advice: !biggest || !biggestMeta ? null
        : lighter !== null
          ? `Try ${lighter === 1 ? `a single ${chargeWords(biggestMeta.id, 1)}` : `${numberWord(lighter)} ${chargeWords(biggestMeta.id, lighter)}`} instead of ${numberWord(biggest.group.count)}`
          : biggest.group.role === 'tertiary' && firstOrdinary?.k === 'ordinary' ? `The ${chargeWords(biggestMeta.id, 1)} is small on the ${ordinaryWords(firstOrdinary.type)} — try putting it on the background instead`
          : null,
    },
    {
      factor: 'detail', label: 'Detailed picture', points: detailed.points,
      advice: detailMeta ? `${capitalise(detailMeta.article)} ${chargeWords(detailMeta.id, 1)} has fine detail — a simpler picture reads better at a distance` : null,
    },
    {
      factor: 'split', label: 'Pictures split by the background line', points: split(d, entries) ? 1 : 0,
      advice: 'The background line cuts through the pictures — try a plain background or another colour',
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
