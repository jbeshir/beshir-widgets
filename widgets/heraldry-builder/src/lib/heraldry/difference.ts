// Uniqueness: exact duplicate by signature, otherwise "too close" when two designs
// are not different enough. Each difference scores a point when it is clear and half a point when it
// is minor (a look-alike charge, a mirror image, swapped colours…); two designs are different enough
// at one point, so one clear difference or two minor ones. Same code on client (instant feedback) and
// Worker (authoritative).

import {
  CHARGES, chargeGroup, chargesInGroup, postureGloss, postureGroup, postureTerm,
  type ChargeId, type Posture, type SimilarityGroup,
} from './charges';
import {
  ARRANGEMENT_WORD, DIVISION_NAME, ORDINARY_NAME, fieldDivision, fieldTinctures,
  type Arrangement, type Count, type Division, type Field, type NormDesign, type Ordinary, type OrdinaryType,
} from './design';
import { CHARGE_TINCTURE_NAME, TINCTURE_NAME } from './tinctures';
import { capitalise, joinAnd } from './words';

export type DiffAttr =
  | 'field-division' | 'field-tincture'
  | 'ordinary-presence' | 'ordinary-type' | 'ordinary-tincture'
  | 'charges-presence' | 'charge-type' | 'charge-tincture' | 'charge-count'
  | 'charge-placement' | 'charge-arrangement' | 'charge-posture';

const DIFF_ATTRS: readonly DiffAttr[] = [
  'field-division', 'field-tincture', 'ordinary-presence', 'ordinary-type', 'ordinary-tincture',
  'charges-presence', 'charge-type', 'charge-tincture', 'charge-count', 'charge-placement',
  'charge-arrangement', 'charge-posture',
];

export function isDiffAttr(v: unknown): v is DiffAttr {
  return typeof v === 'string' && (DIFF_ATTRS as readonly string[]).includes(v);
}

/** Why a difference counts only half. */
export type MinorReason =
  | 'similar-charges'   // two charges of one similarity group
  | 'similar-postures'  // passant ↔ statant
  | 'mirrored'          // dexter ↔ sinister: a division, an ordinary or an arrangement
  | 'swapped-tinctures' // the same two field tinctures on swapped sides
  | 'many-charges'      // two counts of four or more
  | 'pattern-with-count'; // a different pattern alongside a different count

type Weight = 'clear' | 'minor';

export type Diff =
  | { attr: DiffAttr; weight: 'clear' }
  | { attr: DiffAttr; weight: 'minor'; reason: MinorReason };

export const POINTS: Record<Weight, number> = { clear: 1, minor: 0.5 };

/** The score at which two designs are different enough: one clear difference, or two minor ones. */
const DISTINCT_SCORE = 1;

// ── Mirror images ───────────────────────────────────────────────────────────

const DIVISION_MIRROR: Partial<Record<Division, Division>> = { 'per-bend': 'per-bend-sinister', 'per-bend-sinister': 'per-bend' };
const ORDINARY_MIRROR: Partial<Record<OrdinaryType, OrdinaryType>> = { bend: 'bend-sinister', 'bend-sinister': 'bend' };
const ARRANGEMENT_MIRROR: Partial<Record<Arrangement, Arrangement>> = { 'in-bend': 'in-bend-sinister', 'in-bend-sinister': 'in-bend' };

/** A division with its mirror image folded onto the dexter form: per bend sinister → per bend. */
export function divisionGroup(field: Field): 'plain' | Division {
  const d = fieldDivision(field);
  return d === 'per-bend-sinister' ? 'per-bend' : d;
}

/** An ordinary type with its mirror image folded onto the dexter form: bend sinister → bend. */
export function ordinaryGroup(ordinary: Ordinary | null): OrdinaryType | null {
  if (!ordinary) return null;
  return ordinary.type === 'bend-sinister' ? 'bend' : ordinary.type;
}

/**
 * Across different counts, four set two and two and five in saltire share the same four corners —
 * the fifth only adds a centre, just as five in cross adds one to four in cross — so they are the
 * same pattern.
 */
const crossCountPattern = (a: Arrangement): Arrangement => (a === 'in-saltire' ? 'two-and-two' : a);

const isFixed = (a: Arrangement) => a === 'single' || a === 'forced';
const isMany = (n: Count) => n >= 4;

// ── Differences ─────────────────────────────────────────────────────────────

export function differences(a: NormDesign, b: NormDesign): Diff[] {
  const d: Diff[] = [];
  const clear = (attr: DiffAttr) => d.push({ attr, weight: 'clear' });
  const minor = (attr: DiffAttr, reason: MinorReason) => d.push({ attr, weight: 'minor', reason });

  // field
  const da = fieldDivision(a.field), db = fieldDivision(b.field);
  const mirroredDivision = da !== 'plain' && DIVISION_MIRROR[da] === db;
  if (da !== db && !mirroredDivision) clear('field-division');
  else {
    if (mirroredDivision) minor('field-division', 'mirrored');
    const ta = fieldTinctures(a.field), tb = fieldTinctures(b.field);
    if (ta.join() !== tb.join()) {
      if (ta.length === 2 && ta[0] === tb[1] && ta[1] === tb[0]) minor('field-tincture', 'swapped-tinctures');
      else clear('field-tincture');
    }
  }

  // ordinary
  const oa = a.ordinary, ob = b.ordinary;
  if (!!oa !== !!ob) clear('ordinary-presence');
  else if (oa && ob) {
    if (ORDINARY_MIRROR[oa.type] === ob.type) minor('ordinary-type', 'mirrored');
    else if (oa.type !== ob.type) clear('ordinary-type');
    if (oa.tincture !== ob.tincture) clear('ordinary-tincture');
  }

  // charges
  const ca = a.charges, cb = b.charges;
  if (!!ca !== !!cb) clear('charges-presence');
  else if (ca && cb) {
    // Charges are the same shape when they are the same charge or share a similarity group.
    const sameShape = chargeGroup(ca.charge) === chargeGroup(cb.charge);
    if (ca.charge !== cb.charge) {
      if (sameShape) minor('charge-type', 'similar-charges');
      else clear('charge-type');
    }
    if (ca.tincture !== cb.tincture) clear('charge-tincture');
    if (ca.placement !== cb.placement) clear('charge-placement');
    if (ca.count !== cb.count) {
      if (isMany(ca.count) && isMany(cb.count)) minor('charge-count', 'many-charges');
      else clear('charge-count');
    }
    // A single charge, or charges placed by an ordinary, have no pattern of their own: when only
    // one side is fixed the count, placement or ordinary already differs (and is compared above).
    if (ca.arrangement !== cb.arrangement && !isFixed(ca.arrangement) && !isFixed(cb.arrangement)) {
      if (ARRANGEMENT_MIRROR[ca.arrangement] === cb.arrangement) minor('charge-arrangement', 'mirrored');
      else if (ca.count === cb.count) clear('charge-arrangement');
      else if (crossCountPattern(ca.arrangement) !== crossCountPattern(cb.arrangement)) minor('charge-arrangement', 'pattern-with-count');
    }
    // Postures are compared whenever the shapes count as the same, even across charge types.
    if (sameShape && ca.posture && cb.posture && ca.posture !== cb.posture) {
      if (postureGroup(ca.posture) === postureGroup(cb.posture)) minor('charge-posture', 'similar-postures');
      else clear('charge-posture');
    }
  }
  return d;
}

/** Total points of a set of differences: 1 per clear difference, ½ per minor one. */
export function score(diffs: readonly { weight: Weight }[]): number {
  return diffs.reduce((n, x) => n + POINTS[x.weight], 0);
}

/** Whether two designs are different enough to both be registered. */
export function areDistinct(a: NormDesign, b: NormDesign): boolean {
  return score(differences(a, b)) >= DISTINCT_SCORE;
}

/** A registry entry as seen by the uniqueness check (scan order = registration order). */
export interface RegistryEntryLike { id: string; signature: string; design: NormDesign }

/** An entry and the differences between it and the checked design. */
export interface Comparison { of: string; differences: Diff[] }

export type Verdict =
  | { kind: 'ok'; closest: Comparison | null }
  | { kind: 'duplicate'; of: string }
  | ({ kind: 'too-close' } & Comparison);

/**
 * First exact duplicate, else first entry the design is not different enough from, else ok. An ok
 * verdict names the first entry it is different enough from only by adding up minor differences
 * (none of them clear), so the UI can show how narrowly it passed. `excludeId` skips self on edit.
 */
export function checkUnique(nd: NormDesign, sig: string, registry: readonly RegistryEntryLike[], excludeId?: string): Verdict {
  for (const e of registry) if (e.id !== excludeId && e.signature === sig) return { kind: 'duplicate', of: e.id };
  let closest: Comparison | null = null;
  for (const e of registry) {
    if (e.id === excludeId) continue;
    const ds = differences(nd, e.design);
    if (ds.some((x) => x.weight === 'clear')) continue;
    if (score(ds) < DISTINCT_SCORE) return { kind: 'too-close', of: e.id, differences: ds };
    closest ??= { of: e.id, differences: ds };
  }
  return { kind: 'ok', closest };
}

/**
 * The indexed attributes two designs must all share to be a duplicate, too close, or the closest
 * entry of an ok verdict: a change of field division (other than to its mirror image), of ordinary
 * type (other than to its mirror image), or of charge outside its similarity group — including adding
 * or removing an ordinary or charges — is always a clear difference. Tinctures, placement and the
 * rest can be clear too, but are not stored in columns, so `checkUnique` decides those on the
 * candidates. Looking a registry up by this key therefore returns every entry that matters.
 */
interface CandidateKey {
  divisionGroup: 'plain' | Division;
  ordinaryGroup: OrdinaryType | null;
  chargeGroup: SimilarityGroup | ChargeId | null;
}

export function candidateKey(nd: NormDesign): CandidateKey {
  return {
    divisionGroup: divisionGroup(nd.field),
    ordinaryGroup: ordinaryGroup(nd.ordinary),
    chargeGroup: nd.charges ? chargeGroup(nd.charges.charge) : null,
  };
}

// ── Explanations ────────────────────────────────────────────────────────────

const DIFF_LABEL: Record<DiffAttr, string> = {
  'field-division': 'background split',
  'field-tincture': 'background colour',
  'ordinary-presence': 'band or shape',
  'ordinary-type': 'band or shape',
  'ordinary-tincture': 'band colour',
  'charges-presence': 'pictures',
  'charge-type': 'picture',
  'charge-tincture': 'picture colour',
  'charge-count': 'number of pictures',
  'charge-placement': 'placement',
  'charge-arrangement': 'arrangement',
  'charge-posture': 'posture',
};

/** The attributes a too-close design could change to become clear (UI hint). */
export const CLEAR_CHANGE_HINT = 'the background, the band or shape, the picture, a colour, how many pictures there are (1, 2, 3 or 4+), how they are arranged, or the pose';

const groupWords = (g: SimilarityGroup) => joinAnd(chargesInGroup(g).map((id) => CHARGES[id].name));

/** Which changes count only half, in plain English (UI hint under a too-close result). */
export const HALF_DIFFERENCE_HINT =
  `At nametag size ${groupWords('quadruped')} look like the same shape, and so do ${groupWords('round')}. ` +
  'Swapping between those, mirroring something (a band running the other way), swapping the two background colours, ' +
  'standing ↔ walking, or changing one number of four-or-more pictures for another is half a point. ' +
  'Two halves make a full point.';

/** A difference in words: what changed, and for a minor one why it counts only half. */
export type DifferenceNote =
  | { attr: DiffAttr; weight: 'clear'; text: string }
  | { attr: DiffAttr; weight: 'minor'; text: string; why: string };

const postureWord = (id: ChargeId, p: Posture | null) => (p ? postureTerm(id, p) : 'none');

function postureInWords(id: ChargeId, p: Posture | null): string {
  if (!p) return 'none';
  const gloss = postureGloss(id, p);
  return gloss ? `${gloss} (${postureTerm(id, p)})` : postureTerm(id, p);
}

const divisionWord = (f: Field) => (f.kind === 'plain' ? 'plain' : DIVISION_NAME[f.division].toLowerCase());

/** Each difference between `a` (new) and `b` (existing) in words: "posture (passant ↔ statant)". */
export function explainDifferences(a: NormDesign, b: NormDesign, diffs: readonly Diff[] = differences(a, b)): DifferenceNote[] {
  const ca = a.charges, cb = b.charges;
  const text = (attr: DiffAttr): string => {
    const label = DIFF_LABEL[attr];
    const pair = (x: string, y: string) => `${label} (${x} ↔ ${y})`;
    switch (attr) {
      case 'field-division': return pair(divisionWord(a.field), divisionWord(b.field));
      case 'field-tincture':
        return pair(fieldTinctures(a.field).map((t) => TINCTURE_NAME[t]).join('/'), fieldTinctures(b.field).map((t) => TINCTURE_NAME[t]).join('/'));
      case 'ordinary-presence':
        return pair(a.ordinary ? ORDINARY_NAME[a.ordinary.type] : 'none', b.ordinary ? ORDINARY_NAME[b.ordinary.type] : 'none');
      case 'ordinary-type': return pair(ORDINARY_NAME[a.ordinary!.type], ORDINARY_NAME[b.ordinary!.type]);
      case 'ordinary-tincture': return pair(TINCTURE_NAME[a.ordinary!.tincture], TINCTURE_NAME[b.ordinary!.tincture]);
      case 'charges-presence': return pair(ca ? CHARGES[ca.charge].plural : 'none', cb ? CHARGES[cb.charge].plural : 'none');
      case 'charge-type': return pair(CHARGES[ca!.charge].name, CHARGES[cb!.charge].name);
      case 'charge-tincture': return pair(CHARGE_TINCTURE_NAME[ca!.tincture], CHARGE_TINCTURE_NAME[cb!.tincture]);
      case 'charge-count': return pair(String(ca!.count), String(cb!.count));
      case 'charge-placement':
        return pair(ca!.placement === 'ordinary' ? 'on the ordinary' : 'on the field', cb!.placement === 'ordinary' ? 'on the ordinary' : 'on the field');
      case 'charge-arrangement': return pair(ARRANGEMENT_WORD[ca!.arrangement], ARRANGEMENT_WORD[cb!.arrangement]);
      case 'charge-posture': return pair(postureWord(ca!.charge, ca!.posture), postureWord(cb!.charge, cb!.posture));
    }
  };
  const mirrored = (attr: DiffAttr): [string, string] => {
    if (attr === 'field-division') return [divisionWord(a.field), divisionWord(b.field)];
    if (attr === 'ordinary-type') return [`a ${ORDINARY_NAME[a.ordinary!.type]}`, `a ${ORDINARY_NAME[b.ordinary!.type]}`];
    return [ARRANGEMENT_WORD[ca!.arrangement], ARRANGEMENT_WORD[cb!.arrangement]];
  };
  const why = (attr: DiffAttr, reason: MinorReason): string => {
    switch (reason) {
      case 'similar-charges':
        return `${capitalise(CHARGES[ca!.charge].name)} and ${CHARGES[cb!.charge].name} count as the same shape at nametag size — that's only half a difference.`;
      case 'similar-postures':
        return `${capitalise(postureInWords(ca!.charge, ca!.posture))} and ${postureInWords(cb!.charge, cb!.posture)} look almost the same — that's only half a difference.`;
      case 'mirrored': {
        const [x, y] = mirrored(attr);
        return `${capitalise(x)} and ${y} are mirror images; people remember the slant, not which way it runs — that's only half a difference.`;
      }
      case 'swapped-tinctures':
        return "The same two colours with the sides swapped; people remember the colours, not which side was which — that's only half a difference.";
      case 'many-charges':
        return 'Four or more charges all read as "lots" at nametag size, so a different number of them is only half a difference.';
      case 'pattern-with-count':
        return "The pattern changes as well as the number — that's another half a difference.";
    }
  };
  return diffs.map((x) => (x.weight === 'clear'
    ? { attr: x.attr, weight: 'clear', text: text(x.attr) }
    : { attr: x.attr, weight: 'minor', text: text(x.attr), why: why(x.attr, x.reason) }));
}

/** Points in words: 1, ½, 1½. */
export function pointsText(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  if (!half) return String(whole);
  return whole ? `${whole}½` : '½';
}

/** Points as a phrase: "1 point", "half a point", "1½ points". */
export function pointsLabel(n: number): string {
  if (n === 0.5) return 'half a point';
  return `${pointsText(n)} ${n === 1 ? 'point' : 'points'}`;
}

/** The running tally of a comparison: "½ + ½ = 1 point — different enough" or "half a point — not enough (needs 1 point)". */
export function tallyText(diffs: readonly { weight: Weight }[]): string {
  const total = score(diffs);
  const terms = diffs.map((x) => pointsText(POINTS[x.weight]));
  const sum = terms.length > 1 ? `${terms.join(' + ')} = ${pointsLabel(total)}` : pointsLabel(total);
  return total >= DISTINCT_SCORE ? `${sum} — different enough` : `${sum} — not enough (needs ${pointsLabel(DISTINCT_SCORE)})`;
}
