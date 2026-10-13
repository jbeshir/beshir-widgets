// SCA blazon → widget design, by propose-and-verify. A small, loose parser of the part of SCA blazon
// the widget can express proposes candidate design *inputs* (the format `resolve` reads, with the
// arrangement left out unless the blazon words one, so the library's Table 7 defaults apply); a
// candidate is accepted only when the widget's own blazon() of it equals the SCA blazon, both passed
// through normaliseBlazon. The text comparison is what accepts: the parser only proposes, so a design
// the widget words differently from the SCA can never be matched, however the parser reads it.
//
// Because the widget words arrangements the way the College does (Table 7 defaults are left unsaid,
// everything else is stated), an SCA blazon that leaves out an arrangement gets the College's default
// from the library, and one that states a different arrangement from the default gets exactly that
// one; a blazon the widget cannot reproduce word for word is a near-miss, not a match.
import {
  CHARGES, CHARGE_IDS, DIVISION_NAME, DRAWN_DIVISIONS, DRAWN_ORDINARIES, ORDINARY_NAME, POSTURES, TINCTURES,
  blazon, normalise, postureTerm, type ChargeId, type Design, type Division, type Gap, type Issue, type OrdinaryType, type Posture,
} from '../../src/lib/heraldry';
import { normaliseBlazon } from './normalise';

/** A design input as `resolve` reads it. */
export interface DesignInput {
  v: 2;
  field: unknown;
  groups: unknown[];
}

/** A proposed design and what the widget makes of it. */
export interface Candidate {
  /** The input as proposed (SCA reading, defaults omitted). */
  raw: DesignInput;
  /** The widget's resolved design (every default filled), even when it breaks a rule; null when the widget can't draw it. */
  design: Design | null;
  /** The widget's issues for it; [] = registrable in the widget. */
  issues: Issue[];
  /** normaliseBlazon(blazon(design)); null without a design. */
  normalised: string | null;
}

/**
 * fieldless   — "(Fieldless) …": the widget always has a field
 * vocabulary  — a word outside the widget's blazon vocabulary (`unknownWord`)
 * unparsed    — every word known, but not in a shape the matcher proposes
 * unsupported — proposed, but the widget doesn't draw something in it (`gaps`)
 * near-miss   — candidates proposed, none blazons identically
 * match       — `match` blazons identically
 */
export type MatchStatus = 'fieldless' | 'vocabulary' | 'unparsed' | 'unsupported' | 'near-miss' | 'match';

export interface MatchResult {
  status: MatchStatus;
  /** normaliseBlazon of the SCA text. */
  normalised: string;
  unknownWord?: string;
  /** For an unsupported record: the gaps of the first proposal the widget doesn't draw. */
  gaps?: Gap[];
  /**
   * For a near-miss: 'arrangement-wording' when the blazons differ only in arrangement words — the
   * widget can draw the SCA design but words its arrangement differently (it omits Table 7's defaults,
   * which the SCA states, and states what the SCA leaves to a default); else 'other'.
   */
  nearMiss?: 'arrangement-wording' | 'other';
  /** For an arrangement-wording near-miss: the candidate whose blazon differs only in arrangement words. */
  wordingCandidate?: Candidate;
  candidates: Candidate[];
  match: Candidate | null;
}

// ── Vocabulary ──────────────────────────────────────────────────────────────

const alt = (words: Iterable<string>) => [...new Set(words)].sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

const DIVISION_WORDS = new Map<string, Division>(DRAWN_DIVISIONS.map((d) => [DIVISION_NAME[d], d]));
const ORDINARY_WORDS = new Map<string, OrdinaryType>(DRAWN_ORDINARIES.map((t) => [ORDINARY_NAME[t], t]));
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'] as const;
const COUNT_WORDS = new Map<string, number>([['a', 1], ['an', 1], ...NUMBER_WORDS.map((w, i): [string, number] => [w, i + 1])]);
const LINE_WORDS = ['pale', 'fess', 'bend sinister', 'bend'] as const;
const POSITION_WORDS = ['chief', 'base'] as const;
const PATTERN_WORDS = ['saltire', 'cross', 'orle', 'annulo'] as const;

/** Charge noun → charge and number. "fish" is both. */
const NOUNS = new Map<string, { id: ChargeId; plural: boolean; singular: boolean }>();
for (const id of CHARGE_IDS) {
  const m = CHARGES[id];
  NOUNS.set(m.name, { id, singular: true, plural: m.plural === m.name });
  if (m.plural !== m.name) NOUNS.set(m.plural, { id, singular: false, plural: true });
}

/** Posture word → posture, for a charge: its own term first ("segreant"), else the plain posture id. */
function postureFor(id: ChargeId, word: string): Posture | null {
  const m = CHARGES[id];
  for (const p of m.postures ?? []) if (postureTerm(id, p) === word) return p;
  for (const p of m.postures ?? []) if (p === word) return p;
  return null;
}
const POSTURE_WORDS = new Set<string>(POSTURES);
for (const id of CHARGE_IDS) for (const p of CHARGES[id].postures ?? []) POSTURE_WORDS.add(postureTerm(id, p));

const T = `(?:${TINCTURES.join('|')})`;
const CT = `(?:${TINCTURES.join('|')}|counterchanged)`;
const FIELD = `(?:${T}|(?:${alt(DIVISION_WORDS.keys())}) ${T} and ${T})`;
const ORD = `(?:${alt(ORDINARY_WORDS.keys())})`;
const ROWS = `(?:${alt(NUMBER_WORDS)})(?:, (?:${alt(NUMBER_WORDS)}))* and (?:${alt(NUMBER_WORDS)})`;
/** A group without its tincture, which a later phrase may supply ("a wolf, a bordure argent"). */
const UNTINCTURED = `(?:in (?:${alt([...LINE_WORDS, ...POSITION_WORDS])}) )?(?:${alt(COUNT_WORDS.keys())}) (?:${alt(NOUNS.keys())})`
  + `(?: (?:${alt(POSTURE_WORDS)}))?(?: in splendor)?(?: (?:in (?:${alt(PATTERN_WORDS)})|${ROWS}))?`;
const GROUP = `${UNTINCTURED} ${CT}`;

const GROUP_PARTS = new RegExp(
  `^(?:in (?<lead>${alt([...LINE_WORDS, ...POSITION_WORDS])}) )?(?<count>${alt(COUNT_WORDS.keys())}) (?<noun>${alt(NOUNS.keys())})`
  + `(?: (?<posture>${alt(POSTURE_WORDS)}))?(?<splendor> in splendor)?(?: (?:in (?<pattern>${alt(PATTERN_WORDS)})|(?<rows>${ROWS})))? (?<tincture>${CT})$`,
);

/** Every word the widget's blazons can contain; anything else can't be matched. */
const VOCABULARY = new Set<string>(
  [
    ...TINCTURES, 'counterchanged', 'and', 'a', 'an', 'on', 'between', 'in', 'splendor', 'chief', 'bordure', 'base',
    ...DIVISION_WORDS.keys(), ...ORDINARY_WORDS.keys(), ...LINE_WORDS, ...PATTERN_WORDS, ...NUMBER_WORDS,
    ...NOUNS.keys(), ...POSTURE_WORDS,
  ].flatMap((w) => w.split(/[ ,]+/)).filter(Boolean),
);

// ── Parser ──────────────────────────────────────────────────────────────────

function parseField(text: string): unknown {
  const m = new RegExp(`^(?:(?<plain>${T})|(?<division>${alt(DIVISION_WORDS.keys())}) (?<a>${T}) and (?<b>${T}))$`).exec(text)!;
  const g = m.groups!;
  return g.plain ?? { k: 'divided', division: DIVISION_WORDS.get(g.division), parts: [g.a, g.b] };
}

/** The group input the text words, or null when count and noun disagree or the posture is not the charge's. */
function parseGroup(text: string): { paint: string } | null {
  const g = GROUP_PARTS.exec(text)?.groups;
  if (!g) return null;
  const n = NOUNS.get(g.noun)!;
  const count = COUNT_WORDS.get(g.count)!;
  if (count === 1 ? !n.singular : !n.plural) return null;
  if (count === 1 && g.count !== CHARGES[n.id].article) return null;
  const item: Record<string, unknown> = { k: 'charge', charge: n.id };
  if (g.posture) {
    const posture = postureFor(n.id, g.posture);
    if (!posture) return null;
    item.posture = posture;
  }
  if (g.splendor) item.mods = [{ id: 'in-splendour', count: null, paint: null }];
  const group: Record<string, unknown> = { item, paint: g.tincture, count };
  if (g.lead) group.arrangement = `in-${g.lead.replace(' ', '-')}`;
  if (g.pattern) group.arrangement = g.pattern === 'saltire' && count === 2 && CHARGES[n.id].long ? 'crossed' : `in-${g.pattern}`;
  if (g.rows) group.arrangement = `rows-${g.rows.split(/, | and /).map((w) => NUMBER_WORDS.indexOf(w as (typeof NUMBER_WORDS)[number]) + 1).join('-')}`;
  return group as { paint: string };
}

const ordinaryOf = (word: string, paint: string, extra: object = {}) => ({ item: { k: 'ordinary', type: ORDINARY_WORDS.get(word) }, paint, ...extra });

const input = (field: string, groups: Array<object | null>): DesignInput | null =>
  groups.every((g) => g !== null) ? { v: 2, field: parseField(field), groups: groups as object[] } : null;

/** One body shape per way the widget words a design, each a regexp over the normalised text. */
const SHAPES: readonly { re: RegExp; build: (m: string[]) => DesignInput | null }[] = [
  { re: new RegExp(`^(${FIELD})$`), build: ([, f]) => input(f, []) },
  { re: new RegExp(`^(${FIELD}), a (${ORD}) (${T})$`), build: ([, f, o, t]) => input(f, [ordinaryOf(o, t)]) },
  { re: new RegExp(`^(${FIELD}), (${GROUP})$`), build: ([, f, g]) => input(f, [parseGroup(g)]) },
  {
    re: new RegExp(`^(${FIELD}), on a (${ORD}) (${T}) (${GROUP})$`),
    build: ([, f, o, t, g]) => input(f, [ordinaryOf(o, t, { charged: [parseGroup(g)] })]),
  },
  { re: new RegExp(`^(${FIELD}), a (${ORD}) (${T}) between (${GROUP})$`), build: ([, f, o, t, g]) => input(f, [ordinaryOf(o, t), parseGroup(g)]) },
  {
    // "a chevron between three roses argent": the one tincture serves both.
    re: new RegExp(`^(${FIELD}), a (${ORD}) between (${GROUP})$`),
    build: ([, f, o, g]) => {
      const group = parseGroup(g);
      return input(f, group ? [ordinaryOf(o, group.paint), group] : [null]);
    },
  },
  { re: new RegExp(`^(${FIELD}), (${GROUP}), a (chief|bordure) (${T})$`), build: ([, f, g, o, t]) => input(f, [parseGroup(g), ordinaryOf(o, t)]) },
  {
    // "a wolf and a bordure argent": the one tincture serves both.
    re: new RegExp(`^(${FIELD}), (${UNTINCTURED}), a (chief|bordure) (${T})$`),
    build: ([, f, g, o, t]) => input(f, [parseGroup(`${g} ${t}`), ordinaryOf(o, t)]),
  },
  {
    re: new RegExp(`^(${FIELD}), (${GROUP}), on a chief (${T}) (${GROUP})$`),
    build: ([, f, g, t, on]) => input(f, [parseGroup(g), ordinaryOf('chief', t, { charged: [parseGroup(on)] })]),
  },
];

/** Candidate design inputs for normalised SCA text (usually zero or one). */
function proposeInputs(normalisedText: string): DesignInput[] {
  return SHAPES.flatMap(({ re, build }) => {
    const m = re.exec(normalisedText);
    const proposed = m && build([...m]);
    return proposed ? [proposed] : [];
  });
}

/** What the widget makes of a proposed input. */
function verify(raw: DesignInput): Candidate {
  const r = normalise(raw);
  if (r.ok) return { raw, design: r.design, issues: [], normalised: normaliseBlazon(blazon(r.design)) };
  return { raw, design: r.design, issues: r.errors, normalised: r.design ? normaliseBlazon(blazon(r.design)) : null };
}

// ── API ─────────────────────────────────────────────────────────────────────

const ARRANGEMENT_PHRASE = new RegExp(`(?:\\bin (?:${alt([...LINE_WORDS, ...POSITION_WORDS, ...PATTERN_WORDS])}) | ${ROWS}(?= ))`, 'g');
const withoutArrangement = (s: string) => s.replace(ARRANGEMENT_PHRASE, ' ').replace(/ +/g, ' ');

/** The arrangement phrases ("in pale", "two and one", …) in normalised blazon text. */
export const arrangementPhrases = (normalisedText: string): string[] => (normalisedText.match(ARRANGEMENT_PHRASE) ?? []).map((p) => p.trim());

/** The gaps of a proposal the widget doesn't draw, when it has no design. */
const gapsOf = (c: Candidate): Gap[] => c.issues.flatMap((i) => (i.code === 'unsupported' ? [i.gap] : []));

/** Full outcome for one SCA blazon: status, candidates and the matching one. */
export function explainMatch(scaBlazon: string): MatchResult {
  const normalised = normaliseBlazon(scaBlazon);
  if (normalised.startsWith('(fieldless)')) return { status: 'fieldless', normalised, candidates: [], match: null };
  const unknownWord = normalised.split(/[ ,]+/).find((w) => w && !VOCABULARY.has(w));
  if (unknownWord !== undefined) return { status: 'vocabulary', normalised, unknownWord, candidates: [], match: null };
  const all = proposeInputs(normalised).map(verify);
  const candidates = all.filter((c) => c.design !== null);
  if (!candidates.length) {
    const unsupported = all.find((c) => gapsOf(c).length > 0);
    return unsupported
      ? { status: 'unsupported', normalised, gaps: gapsOf(unsupported), candidates, match: null }
      : { status: 'unparsed', normalised, candidates, match: null };
  }
  const match = candidates.find((c) => c.normalised === normalised) ?? null;
  if (match) return { status: 'match', normalised, candidates, match };
  const bare = withoutArrangement(normalised);
  const wordingCandidate = candidates.find((c) => withoutArrangement(c.normalised!) === bare);
  if (wordingCandidate) return { status: 'near-miss', normalised, nearMiss: 'arrangement-wording', wordingCandidate, candidates, match };
  return { status: 'near-miss', normalised, nearMiss: 'other', candidates, match };
}
