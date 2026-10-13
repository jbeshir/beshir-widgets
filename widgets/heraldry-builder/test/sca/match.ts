// SCA blazon → widget Design, by propose-and-verify. A small, loose parser of the part of SCA blazon
// the widget can express proposes candidate designs; a candidate is accepted only when the widget's
// own blazon() of it (after the widget's own normalise()) equals the SCA blazon, both passed through
// normaliseBlazon. The text comparison is what accepts: the parser only proposes, so a design the
// widget words differently from the SCA can never be matched, however the parser reads it.
//
// Text equality alone is not quite enough, though, because the two conventions sometimes use the
// same words for different designs: the widget writes "Or, two mullets Gules" for two mullets in
// pale, but to the SCA "two mullets" alone on a plain field is unspecified, and on a field per pale
// they stand one in each half — in fess. So the parser reads SCA conventions, not the widget's:
// where an SCA blazon leaves an arrangement unstated, the candidate takes the SCA default
// (scaDefaultArrangement, after SCA Glossary of Terms Table 7), and where the SCA has no default
// (or one the widget can't draw) no candidate is proposed at all (status 'unstated'). A candidate
// whose SCA reading differs from the widget's then blazons differently and fails the comparison.
import { CHARGES, CHARGE_IDS, type ChargeId, type Posture } from '../../src/lib/heraldry/charges';
import {
  ORDINARY_NAME, ORDINARY_TYPES, chargeContext, type Arrangement, type ChargeGroup, type Count, type Design, type Division, type Issue, type NormDesign,
  type Ordinary, type OrdinaryType, type Placement,
} from '../../src/lib/heraldry/design';
import { blazon } from '../../src/lib/heraldry/blazon';
import { normalise } from '../../src/lib/heraldry/validate';
import { contrastFailure } from '../../src/lib/heraldry/tincture-rule';
import { TINCTURES, type ChargeTincture, type Tincture } from '../../src/lib/heraldry/tinctures';
import { normaliseBlazon } from './normalise';

/** A proposed design and what the widget makes of it. */
export interface Candidate {
  /** The design as proposed (SCA reading, defaults possibly omitted). */
  raw: Design;
  /** The widget's resolved design (every default filled), even when it breaks a rule. */
  design: NormDesign;
  /** The widget's structural and rule-of-tincture issues for it; [] = registrable in the widget. */
  issues: Issue[];
  /** normaliseBlazon(blazon(design)). */
  normalised: string;
}

/**
 * fieldless  — "(Fieldless) …": the widget always has a field
 * vocabulary — a word outside the widget's blazon vocabulary (`unknownWord`)
 * unparsed   — every word known, but not in a shape the widget writes
 * unstated   — parsed, but the SCA leaves the arrangement unstated and has no default the widget
 *              can draw (e.g. two charges alone on a plain field; five charges, whose default is
 *              two, two and one)
 * near-miss  — candidates proposed, none blazons identically
 * match      — `match` blazons identically
 */
export type MatchStatus = 'fieldless' | 'vocabulary' | 'unparsed' | 'unstated' | 'near-miss' | 'match';

export interface MatchResult {
  status: MatchStatus;
  /** normaliseBlazon of the SCA text. */
  normalised: string;
  unknownWord?: string;
  /**
   * For a near-miss: 'arrangement-wording' when the blazons differ only in arrangement words — the
   * widget can draw the SCA design but words its arrangement differently (it omits its own
   * defaults, which the SCA states, and states arrangements the SCA leaves to a default); else 'other'.
   */
  nearMiss?: 'arrangement-wording' | 'other';
  /** For an arrangement-wording near-miss: the candidate whose blazon differs only in arrangement words. */
  wordingCandidate?: Candidate;
  candidates: Candidate[];
  match: Candidate | null;
}

// ── Vocabulary ──────────────────────────────────────────────────────────────

const DIVISION_WORDS: Record<string, Division> = {
  'per pale': 'per-pale', 'per fess': 'per-fess', 'per bend sinister': 'per-bend-sinister', 'per bend': 'per-bend',
  'per saltire': 'per-saltire', 'per chevron': 'per-chevron', quarterly: 'quarterly',
};
const ORDINARY_WORDS: Record<string, OrdinaryType> = Object.fromEntries(ORDINARY_TYPES.map((t) => [ORDINARY_NAME[t], t]));
const ARRANGEMENT_WORDS: Record<string, Arrangement> = {
  'in pale': 'in-pale', 'in fess': 'in-fess', 'in bend sinister': 'in-bend-sinister', 'in bend': 'in-bend',
  'in cross': 'in-cross', 'in saltire': 'in-saltire', 'two and one': 'two-and-one', 'two and two': 'two-and-two',
  'three, two and one': 'three-two-one', 'three, two, and one': 'three-two-one',
};
const COUNT_WORDS: Record<string, Count> = { a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Charge noun → [charge, count is plural]. "fish" is both. */
const NOUNS = new Map<string, { id: ChargeId; plural: boolean; singular: boolean }>();
for (const id of CHARGE_IDS) {
  const m = CHARGES[id];
  NOUNS.set(m.name, { id, singular: true, plural: m.plural === m.name });
  if (m.plural !== m.name) NOUNS.set(m.plural, { id, singular: false, plural: true });
}

/** Posture word → posture, for a charge: its own term first ("segreant"), else the plain posture id. */
function postureFor(id: ChargeId, word: string): Posture | null {
  const m = CHARGES[id];
  for (const p of m.postures ?? []) if ((m.postureWording[p]?.term ?? p) === word) return p;
  for (const p of m.postures ?? []) if (p === word) return p;
  return null;
}
const POSTURE_WORDS = new Set<string>();
for (const id of CHARGE_IDS) {
  for (const p of CHARGES[id].postures ?? []) {
    POSTURE_WORDS.add(p);
    POSTURE_WORDS.add(CHARGES[id].postureWording[p]?.term ?? p);
  }
}

const alt = (words: Iterable<string>) => [...new Set(words)].sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

const T = `(${TINCTURES.join('|')})`;
const CT = `(${TINCTURES.join('|')}|counterchanged)`;
const FIELD = `(?:${T}|(${alt(Object.keys(DIVISION_WORDS))}) ${T} and ${T})`;
const ORD = `(${alt(Object.keys(ORDINARY_WORDS))})`;
const GROUP = `(${alt(Object.keys(COUNT_WORDS))}) (${alt(NOUNS.keys())})(?: (${alt(POSTURE_WORDS)}))?(?: (${alt(Object.keys(ARRANGEMENT_WORDS))}))? ${CT}`;

/** Every word the widget's blazons can contain; anything else can't be matched. */
const VOCABULARY = new Set<string>(
  [
    ...TINCTURES, 'counterchanged', 'and', 'a', 'an', 'on', 'between', 'within', 'chief', 'bordure', 'one',
    ...Object.keys(DIVISION_WORDS), ...Object.keys(ORDINARY_WORDS), ...Object.keys(ARRANGEMENT_WORDS),
    ...Object.keys(COUNT_WORDS), ...NOUNS.keys(), ...POSTURE_WORDS,
  ].flatMap((w) => w.split(/[ ,]+/)).filter(Boolean),
);

// ── SCA defaults ────────────────────────────────────────────────────────────

/** Two charges, one in each half of a field divided in two (they stand across the line of division). */
const ONE_IN_EACH_HALF: Partial<Record<Division, Arrangement>> = {
  'per-pale': 'in-fess', 'per-fess': 'in-pale', 'per-bend': 'in-bend-sinister', 'per-bend-sinister': 'in-bend', 'per-chevron': 'in-pale',
};

/**
 * The SCA's arrangement for a primary group (on the field, under a chief or within a bordure)
 * blazoned without one — SCA Glossary of Terms, Table 7, whose first applicable row is the default —
 * or null when the SCA has no default or its default is not one the widget can draw:
 *   2: field divided in two → one in each section; divided in four → one in each of the two
 *      sections it contrasts with, none if it contrasts with all four; any other field → none.
 *   3: two and one (per chevron included).
 *   4: field divided in four → one in each section (quarterly: two and two; per saltire: in cross);
 *      any other field → none.
 *   5: identical charges → two, two and one (not a widget arrangement).
 *   6: undivided field → three, two and one; any other field → none.
 * Charges on or between an ordinary are placed by it in both conventions (Table 7's secondary and
 * tertiary rows agree with the widget's slots), so they never need this.
 */
function scaDefaultArrangement(count: Count, field: Design['field'], tincture: ChargeTincture): Arrangement | null {
  if (count === 1) return 'single';
  if (count === 3) return 'two-and-one';
  if (field.kind === 'plain') return count === 6 ? 'three-two-one' : null;
  const fourParts = field.division === 'quarterly' || field.division === 'per-saltire';
  if (count === 2) {
    if (!fourParts) return ONE_IN_EACH_HALF[field.division] ?? null;
    if (tincture === 'counterchanged') return null;
    // Which of the two tinctures (1st/4th quarters or top/bottom; 2nd/3rd or left/right) it shows on.
    const [onFirst, onSecond] = field.tinctures.map((t) => contrastFailure(tincture, [t]) === null);
    if (onFirst === onSecond) return null;
    if (field.division === 'quarterly') return onFirst ? 'in-bend' : 'in-bend-sinister';
    return onFirst ? 'in-pale' : 'in-fess';
  }
  if (count === 4 && fourParts) return field.division === 'quarterly' ? 'two-and-two' : 'in-cross';
  return null;
}

// ── Parser ──────────────────────────────────────────────────────────────────

type GroupMatch = [count: string, noun: string, posture: string | undefined, arrangement: string | undefined, tincture: string];

function parseField(m: RegExpExecArray, at: number): Design['field'] {
  if (m[at]) return { kind: 'plain', tincture: m[at] as Tincture };
  return { kind: 'divided', division: DIVISION_WORDS[m[at + 1]], tinctures: [m[at + 2] as Tincture, m[at + 3] as Tincture] };
}

/**
 * The group as the SCA reads it; null when count and noun disagree or the posture is unknown;
 * 'unstated' when the arrangement is left to an SCA default the widget lacks.
 */
function parseGroup(g: GroupMatch, field: Design['field'], ordinary: Ordinary | null, placement: Placement): ChargeGroup | 'unstated' | null {
  const [countWord, noun, postureWord, arrWord, tincture] = g;
  const count = COUNT_WORDS[countWord];
  const n = NOUNS.get(noun)!;
  if (count === 1 ? !n.singular : !n.plural) return null;
  if (count === 1 && countWord !== CHARGES[n.id].article) return null;
  let posture: Posture | null = null;
  if (postureWord) {
    posture = postureFor(n.id, postureWord);
    if (!posture) return null;
  }
  const ctx = chargeContext(ordinary, placement);
  const fixed = count === 1 || ctx === 'on' || ctx === 'between';
  const arrangement = arrWord ? ARRANGEMENT_WORDS[arrWord] : fixed ? null : scaDefaultArrangement(count, field, tincture as ChargeTincture);
  if (!fixed && !arrangement) return 'unstated';
  return { charge: n.id, count, placement, arrangement, posture, tincture: tincture as ChargeTincture };
}

const ord = (type: string, tincture: string): Ordinary => ({ type: ORDINARY_WORDS[type], tincture: tincture as Tincture });

/** One body shape per widget blazon form (blazon.ts), each a regexp over the normalised text. */
const SHAPES: readonly { re: RegExp; build: (m: RegExpExecArray, field: Design['field']) => Design | 'unstated' | null }[] = [
  { re: new RegExp(`^${FIELD}$`), build: (_m, field) => ({ v: 1, field }) },
  { re: new RegExp(`^${FIELD}, a ${ORD} ${T}$`), build: (m, field) => ({ v: 1, field, ordinary: ord(m[5], m[6]) }) },
  {
    re: new RegExp(`^${FIELD}, ${GROUP}$`),
    build: (m, field) => withGroup(field, null, m.slice(5, 10) as GroupMatch, 'field'),
  },
  {
    re: new RegExp(`^${FIELD}, on a ${ORD} ${T} ${GROUP}$`),
    build: (m, field) => withGroup(field, ord(m[5], m[6]), m.slice(7, 12) as GroupMatch, 'ordinary'),
  },
  {
    re: new RegExp(`^${FIELD}, a ${ORD} ${T} between ${GROUP}$`),
    build: (m, field) => withGroup(field, ord(m[5], m[6]), m.slice(7, 12) as GroupMatch, 'field'),
  },
  {
    re: new RegExp(`^${FIELD}, ${GROUP}, a chief ${T}$`),
    build: (m, field) => withGroup(field, ord('chief', m[10]), m.slice(5, 10) as GroupMatch, 'field'),
  },
  {
    re: new RegExp(`^${FIELD}, ${GROUP} within a bordure ${T}$`),
    build: (m, field) => withGroup(field, ord('bordure', m[10]), m.slice(5, 10) as GroupMatch, 'field'),
  },
];

function withGroup(field: Design['field'], ordinary: Ordinary | null, g: GroupMatch, placement: Placement): Design | 'unstated' | null {
  const charges = parseGroup(g, field, ordinary, placement);
  return charges && charges !== 'unstated' ? { v: 1, field, ordinary, charges } : charges;
}

/**
 * Candidate designs for normalised SCA text (usually zero or one); `unstated` when a parse was
 * dropped because the SCA leaves its arrangement to a default the widget can't draw.
 */
function proposeDesigns(normalisedText: string): { designs: Design[]; unstated: boolean } {
  const designs: Design[] = [];
  let unstated = false;
  for (const { re, build } of SHAPES) {
    const m = re.exec(normalisedText);
    if (!m) continue;
    const d = build(m, parseField(m, 1));
    if (d === 'unstated') unstated = true;
    else if (d) designs.push(d);
  }
  return { designs, unstated };
}

/** What the widget makes of a proposed design, or null if it rejects its shape outright. */
function verify(raw: Design): Candidate | null {
  const r = normalise(raw);
  if (!r.design) return null;
  return { raw, design: r.design, issues: r.ok ? [] : r.errors, normalised: normaliseBlazon(blazon(r.design)) };
}

// ── API ─────────────────────────────────────────────────────────────────────

const ARRANGEMENT_PHRASE = new RegExp(` (?:${alt(Object.keys(ARRANGEMENT_WORDS))})(?= )`, 'g');
const withoutArrangement = (s: string) => s.replace(ARRANGEMENT_PHRASE, '');

/** The arrangement phrases ("in pale", "two and one", …) in normalised blazon text. */
export const arrangementPhrases = (normalisedText: string): string[] => (normalisedText.match(ARRANGEMENT_PHRASE) ?? []).map((p) => p.trim());

/** Full outcome for one SCA blazon: status, candidates and the matching one. */
export function explainMatch(scaBlazon: string): MatchResult {
  const normalised = normaliseBlazon(scaBlazon);
  if (normalised.startsWith('(fieldless)')) return { status: 'fieldless', normalised, candidates: [], match: null };
  const unknownWord = normalised.split(/[ ,]+/).find((w) => w && !VOCABULARY.has(w));
  if (unknownWord !== undefined) return { status: 'vocabulary', normalised, unknownWord, candidates: [], match: null };
  const proposed = proposeDesigns(normalised);
  const candidates = proposed.designs.map(verify).filter((c): c is Candidate => c !== null);
  if (!candidates.length) return { status: proposed.unstated ? 'unstated' : 'unparsed', normalised, candidates, match: null };
  const match = candidates.find((c) => c.normalised === normalised) ?? null;
  if (match) return { status: 'match', normalised, candidates, match };
  const bare = withoutArrangement(normalised);
  const wordingCandidate = candidates.find((c) => withoutArrangement(c.normalised) === bare);
  if (wordingCandidate) return { status: 'near-miss', normalised, nearMiss: 'arrangement-wording', wordingCandidate, candidates, match };
  return { status: 'near-miss', normalised, nearMiss: 'other', candidates, match };
}
