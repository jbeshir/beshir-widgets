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
// one. Stating a default is optional (GoT Tables 5 and 7), so a candidate also matches the widget's
// blazon of the same design with its defaults stated (`blazon(design, { stateDefaults: true })`); a
// blazon the widget cannot reproduce word for word either way is a near-miss, not a match.
import {
  COUNTER_EMBATTLED_WORDS, MODS_AFTER_LINE, MODS_BEFORE_LINE, SAME_ORDINARY, CHARGES, CHARGE_IDS, FACING_WORD, ORIENTATION_WORDS, ORIENTATIONS, PAIRS, DRAWN_LINES, DRAWN_ORDINARIES, DRAWN_TREATMENTS, FURS, FUR_NAME, LINE_WORD, MODIFIER_WORDS, ORDINARY_ARTICLE, ORDINARY_COUNTS, ORDINARY_COUNT_WORD, ORDINARY_KIND, ORDINARY_NAME, ORDINARY_PLURAL, ORDINARY_TYPES, PERIPHERAL_JOINER, POSTURES, isDiminutive, TINCTURES, VARIATIONS, VARIATION_NAME,
  blazon, drawnPoints, normalise, pointsWord, postureTerm, type ChargeId, type Design, type Gap, type Issue, type ModifierId, type OrdinaryType, type Orientation, type Posture,
} from '../../src/lib/heraldry';
import { normaliseBlazon } from './normalise';
import { EDGE_NAMES } from './words';
import { DIVISION_WORDS, readOrdinaryForm, readOutline, readPaint, type OutlineRead } from './paint-grammar';

/** A design input as `resolve` reads it: arms with a field, or a fieldless badge. */
export type DesignInput = { v: 2; field: unknown; groups: unknown[] } | { v: 2; kind: 'badge'; groups: unknown[] };

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
  /** The same with the College's defaults stated: normaliseBlazon(blazon(design, { stateDefaults: true })); null without a design. */
  stated: string | null;
  /** The wordings with the tincture of every element stated, not once for a run of elements that share it, where the widget shares one; [] otherwise. */
  restated: string[];
}

/** Whether a candidate's design is worded as the normalised text: in house style, with its defaults stated, or with its tinctures stated. */
export const wordedAs = (c: Candidate, normalisedText: string): boolean => c.normalised === normalisedText || c.stated === normalisedText || c.restated.includes(normalisedText);

/**
 * vocabulary  — a word outside the widget's blazon vocabulary (`unknownWord`)
 * unparsed    — every word known, but not in a shape the matcher proposes
 * unsupported — proposed, but the widget doesn't draw something in it (`gaps`)
 * near-miss   — candidates proposed, none blazons identically
 * match       — `match` blazons identically
 */
export type MatchStatus = 'vocabulary' | 'unparsed' | 'unsupported' | 'near-miss' | 'match';

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

const ORDINARY_WORDS = new Map<string, OrdinaryType>(DRAWN_ORDINARIES.map((t) => [ORDINARY_NAME[t], t]));
/** The diminutives a blazon counts, by their plural, to the type: "three bars", "two bendlets sinister" (a baton is one; barrulets are bars, `normalise`). */
const COUNTED_ORDINARIES = new Map<string, OrdinaryType>(ORDINARY_TYPES.filter((t) => isDiminutive(t) && t !== 'baton' && !SAME_ORDINARY[t]).map((t) => [ORDINARY_PLURAL[t], t]));
/** The words that draw an ordinary more than once, before its name ("a double tressure"), to the count. */
const ORDINARY_COUNT_WORDS = new Map<string, number>(Object.entries(ORDINARY_COUNT_WORD).map(([n, w]) => [w, Number(n)]));
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'] as const;
const COUNT_WORDS = new Map<string, number>([['a', 1], ['an', 1], ...NUMBER_WORDS.map((w, i): [string, number] => [w, i + 1])]);
const ARRANGEMENT_LINE_WORDS = ['pale', 'fess', 'bend sinister', 'bend'] as const;
const POSITION_WORDS = ['chief', 'base', 'canton', 'dexter chief', 'sinister chief', 'dexter base', 'sinister base', 'dexter', 'sinister'] as const;
const PATTERN_WORDS = ['saltire', 'cross', 'orle', 'annulo'] as const;
/** What can follow "in" before a group, the longest first ("sinister chief" before "sinister"). */
const LEADS = [...ARRANGEMENT_LINE_WORDS, ...POSITION_WORDS].sort((a, b) => b.split(' ').length - a.split(' ').length);

/** Charge noun (lower case, as the normalised text reads: "latin cross") → charge and number. "fish" is both. */
const NOUNS = new Map<string, { id: ChargeId; plural: boolean; singular: boolean; article: string; orientation: Orientation | null }>();
for (const id of CHARGE_IDS) {
  const m = CHARGES[id];
  const [name, plural] = [m.name.toLowerCase(), m.plural.toLowerCase()];
  NOUNS.set(name, { id, singular: true, plural: plural === name, article: m.article, orientation: null });
  if (plural !== name) NOUNS.set(plural, { id, singular: false, plural: true, article: m.article, orientation: null });
  // a noun of its own that says which way the charge points ("an increscent": a crescent fesswise)
  for (const [o, w] of Object.entries(m.orient.wording)) {
    if (w.k !== 'noun') continue;
    NOUNS.set(w.name, { id, singular: true, plural: false, article: w.article, orientation: o as Orientation });
    NOUNS.set(w.plural, { id, singular: false, plural: true, article: w.article, orientation: o as Orientation });
  }
}

/** The words that say which way a charge points, after its facing, by what they mean: the orientation's own or one the charge words itself ("pendant"). */
const ORIENTATION_PHRASES = ORIENTATIONS.filter((o) => o !== 'to-center').flatMap((o) => [
  { words: ORIENTATION_WORDS[o].split(' '), orientation: o, charge: null as ChargeId | null },
  ...CHARGE_IDS.flatMap((id) => { const w = CHARGES[id].orient.wording[o]; return w?.k === 'words' ? [{ words: w.words.split(' '), orientation: o, charge: id as ChargeId | null }] : []; }),
]).sort((a, b) => b.words.length - a.words.length);

/** The words that say a group's charges point to the middle of the group, after its layout: "points to center", the crescent's "horns to center". */
const TO_CENTER_PHRASES = [ORIENTATION_WORDS['to-center'], ...CHARGE_IDS.flatMap((id) => { const w = CHARGES[id].orient.wording['to-center']; return w?.k === 'words' ? [w.words] : []; })]
  .map((w) => w.split(' '));

/** Every posture word the widget's blazons can contain, by the posture it names (for the charge it was written with, else any). */
const POSTURE_BY_WORD = new Map<string, Posture>();
for (const id of CHARGE_IDS) for (const p of POSTURES) POSTURE_BY_WORD.set(postureTerm(id, p), p);
const POSTURE_WORDS = new Set<string>([...POSTURES, ...POSTURE_BY_WORD.keys()]);

/** The word after the posture of a charge facing to sinister (affronty is not drawn: the tagger files it). */
const CONTOURNY = FACING_WORD['to-sinister']!;

/** Posture word → posture: the charge's own term first ("segreant"), else the plain posture id; a posture the charge can't take is still proposed, so the widget reports it. */
function postureFor(id: ChargeId, word: string): Posture | null {
  const m = CHARGES[id];
  for (const p of m.postures ?? []) if (postureTerm(id, p) === word) return p;
  return POSTURE_BY_WORD.get(word) ?? POSTURES.find((p) => p === word) ?? null;
}

/** The modifiers the widget words after a noun ("in splendor", "fitchy", "voided", "pierced"), each with the tokens of its phrase. */
const MODIFIER_PHRASES = Object.entries(MODIFIER_WORDS).map(([id, phrase]) => ({ id: id as ModifierId, words: phrase!.split(' ') }));


const ROWS = `(?:${alt(NUMBER_WORDS)})(?:, (?:${alt(NUMBER_WORDS)}))* and (?:${alt(NUMBER_WORDS)})`;

/** Every word the widget's blazons can contain; anything else can't be matched. */
const VOCABULARY = new Set<string>(
  [
    '(fieldless)', ...TINCTURES, ...FURS.map((f) => FUR_NAME[f]), 'ermined', 'vairy', 'potenty', ...DRAWN_TREATMENTS, 'counterchanged', 'proper', 'semy', 'all', 'and', 'a', 'an', 'on', 'between', 'in', 'chief', 'bordure', 'base', 'canton', 'dexter', 'each', 'charged', 'with', 'overall', 'within', 'the', 'edge', ...EDGE_NAMES.split('|'), COUNTER_EMBATTLED_WORDS, ...MODS_BEFORE_LINE, ...MODS_AFTER_LINE, 'fimbriated', 'cotised', 'doubly', 'triply', 'endorsed', 'plain',
    ...DIVISION_WORDS.keys(), ...VARIATIONS.map((v) => VARIATION_NAME[v]), 'of', ...DRAWN_LINES.map((l) => LINE_WORD[l]), ...ORDINARY_WORDS.keys(), ...ARRANGEMENT_LINE_WORDS, ...PATTERN_WORDS, ...NUMBER_WORDS,
    ...NOUNS.keys(), ...MODIFIER_PHRASES.flatMap((m) => m.words), ...CHARGE_IDS.filter((id) => drawnPoints(id) !== null).map(pointsWord), ...POSTURE_WORDS, CONTOURNY, ...PAIRS, ...ORIENTATION_PHRASES.flatMap((o) => o.words), ...TO_CENTER_PHRASES.flat(), ...ORDINARY_COUNT_WORDS.keys(), ...COUNTED_ORDINARIES.keys(),
  ].flatMap((w) => w.split(/[ ,]+/)).filter(Boolean),
);

// ── Parser ──────────────────────────────────────────────────────────────────
// A token grammar over the normalised text (words, with commas as tokens of their own):
//   blazon     := field [',' element (connector element)*] | '(fieldless)' element (connector element)*
//   field      := T | DIVISION [LINE] T 'and' T | 'gyronny' [LINE] ['of' COUNT] T 'and' T
//   element    := ['on'] [('a'|'an') ['double'|'triple']] ordinary FORM [T] [OUTLINE]   an ordinary, central or peripheral ("on" when a group sits on it;
//                                                    flaunches without an article, a tressure double or triple)
//               | ['on'] COUNT PLURAL FORM [T] [OUTLINE]   diminutives counted ("three bars wavy argent", "two bendlets sinister")
//   OUTLINE    := 'fimbriated' [T] | ['doubly'|'triply'] ('cotised'|'endorsed') ['plain'|LINE] [T]
//   FORM       := ['inverted'] [LINE [edge]] ['couped'] ['throughout'|'enhanced'|'abased'] ['voided']
//               | 'on' group                        a charge group with a group on it
//               | 'each charged with' group          the group before it, a charge group, with the group on each charge
//               | 'overall' (ordinary|group)         the one band or group lying across everything before it
//               | 'between'                        the groups that follow are set around the ordinary
//               | group
//   group      := [('in' LINE|POSITION)] COUNT NOUN [POSTURE] ['contourny'] [ORIENTATION] MODIFIER* [('in' PATTERN)|ROWS|PAIR] [POINTS TO CENTER] [T] ['fimbriated' [T]]
//                 (PAIR: two charges combattant, respectant or addorsed; MODIFIER: "in splendor", "fitchy", "voided", "pierced", or a star's
//                 "of" COUNT "points"|"rays"; the fimbriation is a phrase of its own for the tincture it states, like an ordinary's)
//   (a group in chief, in base or in canton after another is set there beside it: SENA App I1, which `resolve` applies)
//   connector  := ',' | 'and' | 'within' | ε
// A group straight after "between", or joined to one by "and", is set around the ordinary or the primary charges; any other
// group after an "on" ordinary sits on it. A phrase without a tincture takes the next stated one, except
// that a tincture never crosses into or out of a group on a host (Bruce). The parser only proposes:
// `resolve` infers roles, and verify() decides by comparing blazons.

interface Phrase {
  /** The group input, without its paint. */
  group: Record<string, unknown>;
  paint: unknown;
  /**
   * An ordinary's fimbriation and cotises, or a charge group's fimbriation: each a phrase of its own for the tincture it states, or takes from
   * what follows (a cotised band that says one tincture has it for both).
   */
  outlines?: Array<{ phrase: Phrase; read: OutlineRead }>;
}

/** The ordinary's or charge's item input with its outlines in the paints their phrases came to have (a charge's fimbriation is a modifier). */
function outlinedItem(p: Phrase): unknown {
  const item = p.group.item as { k: string; mods?: unknown[] };
  if (item.k === 'charge') return { ...item, mods: [...(item.mods ?? []), ...(p.outlines ?? []).map(({ phrase }) => ({ id: 'fimbriated', count: null, paint: phrase.paint }))] };
  const outlined = (p.outlines ?? []).map(({ phrase, read }) => (read.k === 'fimbriated'
    ? { fimbriated: phrase.paint }
    : { cotised: { count: read.count, paint: phrase.paint, ...(read.line ? { line: read.line } : {}) } }));
  return Object.assign({}, p.group.item, ...outlined);
}

/** A top-level group, with the group that sits on it. */
interface Node { phrase: Phrase; on: Phrase | null }

const NOUN_PHRASES = [...NOUNS.keys()].map((n) => n.split(' ')).sort((a, b) => b.length - a.length);
/** The words of an ordinary's treatment, which may follow its name ("a cross couped"). */
const ORDINARY_FORM_WORDS: ReadonlySet<string> = new Set<string>([...MODS_BEFORE_LINE, ...MODS_AFTER_LINE]);
const ORDINARY_PHRASES = [...ORDINARY_WORDS.keys()].map((o) => o.split(' ')).sort((a, b) => b.length - a.length);
const COUNTED_PHRASES = [...COUNTED_ORDINARIES.keys()].map((o) => o.split(' ')).sort((a, b) => b.length - a.length);
/** How the ordinaries the widget joins with "within" start: "an orle", "a double tressure". */
const WITHIN_PHRASES = DRAWN_ORDINARIES.filter((t) => PERIPHERAL_JOINER[t] === ' within ').flatMap((t) => [1, ...(ORDINARY_COUNTS[t] ?? [])].map((n) => [ORDINARY_ARTICLE[t] ?? '', ...(n > 1 ? [ORDINARY_COUNT_WORD[n]] : []), ...ORDINARY_NAME[t].split(' ')].filter(Boolean)));
const startsWith = (tokens: string[], i: number, phrase: readonly string[]) => phrase.every((w, j) => tokens[i + j] === w);
const isNumber = (w: string | undefined): boolean => (NUMBER_WORDS as readonly string[]).includes(w!);
const numberOf = (w: string) => NUMBER_WORDS.indexOf(w as (typeof NUMBER_WORDS)[number]) + 1;

/** The modifier of a `charge` written at `tokens[i]`, with its number and length, or null: a phrase, or a star's "of six points" ("of eight rays"). */
function modifierAt(tokens: string[], i: number, charge: ChargeId): { id: ModifierId; count: number | null; length: number } | null {
  if (tokens[i] === 'of' && isNumber(tokens[i + 1]) && drawnPoints(charge) !== null && tokens[i + 2] === pointsWord(charge)) return { id: 'of-points', count: numberOf(tokens[i + 1]), length: 3 };
  const m = MODIFIER_PHRASES.find((p) => startsWith(tokens, i, p.words));
  return m ? { id: m.id, count: null, length: m.words.length } : null;
}


/** The charge group at `start` with the index after it, or null when count, noun and posture don't agree. */
function readGroup(tokens: string[], start: number): { phrase: Phrase; end: number } | null {
  let i = start;
  let lead: string | null = null;
  // "in pale", "in chief", or a line within a half or quarter ("in dexter in pale", the normalised "in dexter two mullets in pale").
  let line: string | null = null;
  if (tokens[i] === 'in') {
    lead = LEADS.find((w) => startsWith(tokens, i + 1, w.split(' '))) ?? null;
    if (!lead) return null;
    i += 1 + lead.split(' ').length;
    if ((POSITION_WORDS as readonly string[]).includes(lead) && tokens[i] === 'in') {
      line = ARRANGEMENT_LINE_WORDS.find((w) => startsWith(tokens, i + 1, w.split(' '))) ?? null;
      if (line) i += 1 + line.split(' ').length;
    }
  }
  const count = COUNT_WORDS.get(tokens[i]);
  if (count === undefined) return null;
  const countWord = tokens[i++];
  const nounWords = NOUN_PHRASES.find((n) => startsWith(tokens, i, n));
  if (!nounWords) return null;
  i += nounWords.length;
  const noun = NOUNS.get(nounWords.join(' '))!;
  if (count === 1 ? !noun.singular : !noun.plural) return null;
  if (count === 1 && countWord !== noun.article) return null;
  const item: Record<string, unknown> = { k: 'charge', charge: noun.id };
  if (noun.orientation) item.orientation = noun.orientation;
  if (POSTURE_WORDS.has(tokens[i])) {
    const posture = postureFor(noun.id, tokens[i++]);
    if (!posture) return null;
    item.posture = posture;
  }
  if (tokens[i] === CONTOURNY) {
    item.facing = 'to-sinister';
    i++;
  }
  // which way it points: one word or two ("fesswise", "bendwise sinister inverted"); a noun of its own has said it already
  const turn = noun.orientation ? undefined : ORIENTATION_PHRASES.find((o) => (o.charge === null || o.charge === noun.id) && startsWith(tokens, i, o.words));
  if (turn) {
    item.orientation = turn.orientation;
    i += turn.words.length;
  }
  const mods: Array<{ id: ModifierId; count: number | null; paint: null }> = [];
  for (let m = modifierAt(tokens, i, noun.id); m; m = modifierAt(tokens, i, noun.id)) {
    mods.push({ id: m.id, count: m.count, paint: null });
    i += m.length;
  }
  if (mods.length > 0) item.mods = mods;
  const group: Record<string, unknown> = { item, count };
  // "in chief three mullets" places the group (the widget lays it out there); "in pale two keys" arranges it.
  if (lead) {
    if ((POSITION_WORDS as readonly string[]).includes(lead)) group.position = lead.replace(' ', '-');
    else group.arrangement = `in-${lead.replace(' ', '-')}`;
  }
  if (line) group.arrangement = `in-${line.replace(' ', '-')}`;
  // "two lions combattant": two charges facing each other or back to back (laid out in fess, or where an ordinary places them);
  // combattant says rampant by itself (SENA A5E5a), and the normaliser leaves it unsaid.
  if (count === 2 && (PAIRS as readonly string[]).includes(tokens[i])) {
    if (tokens[i] === 'combattant') item.posture ??= 'rampant';
    group.arrangement = `pair-${tokens[i++]}`;
  } else if (tokens[i] === 'in' && (PATTERN_WORDS as readonly string[]).includes(tokens[i + 1])) {
    const pattern = tokens[i + 1];
    group.arrangement = pattern === 'saltire' && count === 2 && CHARGES[noun.id].long ? 'crossed' : `in-${pattern}`;
    i += 2;
  } else if (isNumber(tokens[i])) {
    const rows = [numberOf(tokens[i++])];
    while ((tokens[i] === ',' || tokens[i] === 'and') && isNumber(tokens[i + 1])) {
      rows.push(numberOf(tokens[i + 1]));
      i += 2;
    }
    if (rows.length < 2) return null;
    group.arrangement = `rows-${rows.join('-')}`;
  }
  // "in cross points to center": the group's charges point to the middle of the group, said after its layout
  const toCenter = TO_CENTER_PHRASES.find((w) => startsWith(tokens, i, w));
  if (toCenter) {
    item.orientation = 'to-center';
    i += toCenter.length;
  }
  const read = readPaint(tokens, i, 'group');
  const end = read ? read.end : i;
  // "a lozenge azure fimbriated argent": the fimbriation after the charges' tincture
  if (tokens[end] !== 'fimbriated') return { phrase: { group, paint: read?.paint ?? null }, end };
  const trimmed = readPaint(tokens, end + 1, 'group');
  const outlines = [{ phrase: { group: {}, paint: trimmed?.paint ?? null }, read: { k: 'fimbriated', end: end + 1 } as const }];
  return { phrase: { group, paint: read?.paint ?? null, outlines }, end: trimmed ? trimmed.end : end + 1 };
}

/** What the body of a blazon reads as: the design input's groups, or a construct the widget doesn't draw. */
type Body = { k: 'groups'; groups: object[] } | { k: 'gap'; gap: Gap };

/** The body of a blazon, or null when it isn't in the grammar. */
function parseBody(tokens: string[]): Body | null {
  const top: Node[] = [];
  /** Every phrase in blazon order, for factoring tinctures backwards. */
  const order: { phrase: Phrase; onHost: boolean }[] = [];
  /** A phrase and its outlines' phrases, in blazon order. */
  const ordered = (phrase: Phrase, onHost: boolean) => order.push({ phrase, onHost }, ...(phrase.outlines ?? []).map((o) => ({ phrase: o.phrase, onHost })));
  let host: Node | null = null;       // an "on" ordinary still waiting for its group
  let between = false;
  let joined = false;                  // the last connector was "and", or "between" has just been read
  let overall = false;                 // "overall" has just been read: the next element lies across everything
  let i = 0;
  while (i < tokens.length) {
    const w = tokens[i];
    if (w === ',' || w === 'and' || w === 'within') {
      // "within" joins only what the widget writes it before: an orle or a tressure (`PERIPHERAL_JOINER`)
      if (w === 'within' && !WITHIN_PHRASES.some((p) => startsWith(tokens, i + 1, p))) return null;
      joined = w === 'and';
      i++;
    } else if (w === 'each' && tokens[i + 1] === 'charged' && tokens[i + 2] === 'with') {
      // "three flames argent each charged with a heart azure": the group before it carries the next one on every charge.
      const carrier = top[top.length - 1];
      if (!carrier || carrier.on || carrier.phrase.group.item === undefined || (carrier.phrase.group.item as { k: string }).k !== 'charge') return null;
      host = carrier;
      between = false;
      joined = false;
      i += 3;
    } else if (w === 'overall') {
      // With no main band or picture before it (only a chief or bordure), what follows is the main group itself (SENA App I4).
      overall = top.some(({ phrase }) => {
        const item = phrase.group.item as { k: string; type?: OrdinaryType };
        return item.k === 'charge' || ORDINARY_KIND[item.type!] === 'central';
      });
      host = null;
      between = false;
      joined = false;
      i++;
    } else if (w === 'between') {
      // "on a cross argent a rose sable between four roses gules": with no comma the charges between are on the
      // host too, a tertiary group of two types (SENA A3D2a) — not secondaries around it.
      if (host?.on && tokens[i - 1] !== ',') return { k: 'gap', gap: { category: 'multiple-groups', detail: 'tertiary-two-types' } };
      between = true;
      joined = true;
      i++;
    } else {
      const on = w === 'on';
      const j = on ? i + 1 : i;
      // "a cross crosslet" is a charge, though "a cross" is an ordinary: the longer noun wins, unless the rest of it is the ordinary's own
      // treatment ("a cross couped" is the ordinary couped; the charge of that name is the same type, App M1f). Flaunches have no article; a
      // tressure may be double or triple.
      const articled = tokens[j] === 'a' || tokens[j] === 'an';
      const doubled = articled ? ORDINARY_COUNT_WORDS.get(tokens[j + 1]) ?? 1 : 1;
      const at = j + (articled ? 1 : 0) + (doubled > 1 ? 1 : 0);
      const named = ORDINARY_PHRASES.find((o) => {
        const t = ORDINARY_WORDS.get(o.join(' '))!;
        return startsWith(tokens, at, o) && (articled ? ORDINARY_ARTICLE[t] !== null : ORDINARY_ARTICLE[t] === null) && (doubled === 1 || ORDINARY_COUNTS[t]?.includes(doubled))
          && !NOUN_PHRASES.some((n) => n.length > o.length && startsWith(tokens, at, n) && !n.slice(o.length).every((w) => ORDINARY_FORM_WORDS.has(w)));
      });
      // diminutives counted: "three bars", any number of them (the widget says which it draws)
      const plural = !named && isNumber(tokens[j]) ? COUNTED_PHRASES.find((o) => startsWith(tokens, j + 1, o)) : undefined;
      const ordinary = named ? { type: ORDINARY_WORDS.get(named.join(' '))!, count: doubled, end: at + named.length }
        : plural ? { type: COUNTED_ORDINARIES.get(plural.join(' '))!, count: numberOf(tokens[j]), end: j + 1 + plural.length } : null;
      if (ordinary) {
        const { type, count } = ordinary;
        const { lines, mods, end } = readOrdinaryForm(type, tokens, ordinary.end);
        const read = readPaint(tokens, end, 'group');
        // Its fimbriation and cotises, "fimbriated Or and cotised argent", each with the tincture it states.
        const outlines: Array<{ phrase: Phrase; read: OutlineRead }> = [];
        let after = read ? read.end : end;
        let outline = readOutline(tokens, after);
        while (outline) {
          const trimmed = readPaint(tokens, outline.end, 'group');
          outlines.push({ phrase: { group: {}, paint: trimmed?.paint ?? null }, read: outline });
          after = trimmed ? trimmed.end : outline.end;
          outline = tokens[after] === 'and' ? readOutline(tokens, after + 1) : null;
        }
        // a band set around charges before it ("a fleur-de-lys between two pallets") is a secondary group, which the widget files as a gap
        const around = between && joined && !host && ORDINARY_KIND[type] === 'central' && top.length > 0 ? { role: 'secondary', relation: 'between' } : {};
        const node: Node = { phrase: { group: { ...(overall ? { role: 'overall' } : {}), ...around, item: { k: 'ordinary', type, ...(lines ? { lines } : {}), ...(mods.length > 0 ? { mods } : {}) }, ...(count > 1 ? { count } : {}) }, paint: read?.paint ?? null }, on: null };
        top.push(node);
        order.push({ phrase: node.phrase, onHost: false });
        if (outlines.length > 0) {
          node.phrase.outlines = outlines;
          order.push(...outlines.map(({ phrase }) => ({ phrase, onHost: false })));
        }
        host = on ? node : null;
        between = false;
        overall = false;
        i = after;
      } else {
        const g = readGroup(tokens, j);
        if (!g) return null;
        if (overall) {
          g.phrase.group.role = 'overall';
          top.push({ phrase: g.phrase, on: null });
          ordered(g.phrase, false);
          overall = false;
        } else if (on) {
          // "on a lion …": a group on a charge, which the widget reports rather than draws.
          const node: Node = { phrase: g.phrase, on: null };
          top.push(node);
          ordered(g.phrase, false);
          host = node;
          between = false;
        } else if (between && joined) {
          // Set between what came before: a central ordinary, or the primary charges ("a lion between three mullets").
          g.phrase.group.relation = 'between';
          top.push({ phrase: g.phrase, on: null });
          ordered(g.phrase, false);
        } else if (host && !host.on) {
          host.on = g.phrase;
          ordered(g.phrase, true);
          between = false;
        } else {
          top.push({ phrase: g.phrase, on: null });
          ordered(g.phrase, false);
        }
        joined = false;
        i = g.end;
      }
    }
  }
  let carry: unknown = null;
  for (const { phrase, onHost } of order.reverse()) {
    if (onHost) {
      if (!phrase.paint) return null;
      carry = null;
    } else {
      phrase.paint ??= carry;
      if (!phrase.paint) return null;
      // A tincture stated for what follows is the ground of a semy, not the semy: "a lion, a bordure Or semy of mullets sable".
      carry = groundOf(phrase.paint);
    }
  }
  const withPaint = (p: Phrase) => ({ ...p.group, ...(p.outlines ? { item: outlinedItem(p) } : {}), paint: p.paint });
  return { k: 'groups', groups: top.map((n) => (n.on ? { ...withPaint(n.phrase), charged: [withPaint(n.on)] } : withPaint(n.phrase))) };
}

/** The tincture a paint is laid on: a semy's ground, else the paint itself. */
const groundOf = (paint: unknown): unknown => (typeof paint === 'object' && paint !== null && 'k' in paint && paint.k === 'semy' && 'ground' in paint ? paint.ground : paint);

/** How a normalised fieldless blazon starts. */
const FIELDLESS = '(fieldless)';

/** Candidate design inputs for normalised SCA text (usually zero or one), or the gap the text reads as. */
function proposeInputs(normalisedText: string): DesignInput[] | Gap {
  if (normalisedText.startsWith(FIELDLESS)) {
    const body = parseBody(normalisedText.slice(FIELDLESS.length).replace(/,/g, ' , ').split(/ +/).filter(Boolean));
    if (body?.k === 'gap') return body.gap;
    return body ? [{ v: 2, kind: 'badge', groups: body.groups }] : [];
  }
  // the field runs to its own end, which is the first comma unless it is divided in three ("per pall argent, sable and gules, …")
  const all = normalisedText.replace(/,/g, ' , ').split(/ +/).filter(Boolean);
  const read = readPaint(all, 0, 'field');
  if (!read || (read.end < all.length && all[read.end] !== ',')) return [];
  const field = read.paint;
  const body = parseBody(all.slice(read.end + 1));
  if (body?.k === 'gap') return body.gap;
  return body ? [{ v: 2, field, groups: body.groups }] : [];
}

/** What the widget makes of a proposed input. */
function verify(raw: DesignInput): Candidate {
  const r = normalise(raw);
  const design = r.design;
  // Stating every tincture is a wording of its own only where the widget shares one.
  const wordings = (stateDefaults: boolean) => {
    if (!design) return { house: null, restated: [] };
    const house = blazon(design, { stateDefaults });
    const all = blazon(design, { stateDefaults, stateTinctures: true });
    return { house: normaliseBlazon(house), restated: all === house ? [] : [normaliseBlazon(all)] };
  };
  const [plain, stated] = [wordings(false), wordings(true)];
  return { raw, design, issues: r.ok ? [] : r.errors, normalised: plain.house, stated: stated.house, restated: [...plain.restated, ...stated.restated] };
}

// ── API ─────────────────────────────────────────────────────────────────────

const ARRANGEMENT_PHRASE = new RegExp(`(?:\\bin (?:${alt([...ARRANGEMENT_LINE_WORDS, ...POSITION_WORDS, ...PATTERN_WORDS])}) | ${ROWS}(?= ))`, 'g');
const withoutArrangement = (s: string) => s.replace(ARRANGEMENT_PHRASE, ' ').replace(/ +/g, ' ');

/** The arrangement phrases ("in pale", "two and one", …) in normalised blazon text. */
export const arrangementPhrases = (normalisedText: string): string[] => (normalisedText.match(ARRANGEMENT_PHRASE) ?? []).map((p) => p.trim());

/** The gaps of a proposal the widget doesn't draw, when it has no design. */
const gapsOf = (c: Candidate): Gap[] => c.issues.flatMap((i) => (i.code === 'unsupported' ? [i.gap] : []));

const explained = new Map<string, MatchResult>();

/** Full outcome for one SCA blazon: status, candidates and the matching one (memoised by normalised text: many records share one). */
export function explainMatch(scaBlazon: string): MatchResult {
  const normalised = normaliseBlazon(scaBlazon);
  let result = explained.get(normalised);
  if (!result) {
    result = explainNormalised(normalised);
    explained.set(normalised, result);
  }
  return result;
}

function explainNormalised(normalised: string): MatchResult {
  const unknownWord = normalised.split(/[ ,]+/).find((w) => w && !VOCABULARY.has(w));
  if (unknownWord !== undefined) return { status: 'vocabulary', normalised, unknownWord, candidates: [], match: null };
  const proposed = proposeInputs(normalised);
  if (!Array.isArray(proposed)) return { status: 'unsupported', normalised, gaps: [proposed], candidates: [], match: null };
  const all = proposed.map(verify);
  const candidates = all.filter((c) => c.design !== null);
  if (!candidates.length) {
    const unsupported = all.find((c) => gapsOf(c).length > 0);
    return unsupported
      ? { status: 'unsupported', normalised, gaps: gapsOf(unsupported), candidates, match: null }
      : { status: 'unparsed', normalised, candidates, match: null };
  }
  const match = candidates.find((c) => wordedAs(c, normalised)) ?? null;
  if (match) return { status: 'match', normalised, candidates, match };
  const bare = withoutArrangement(normalised);
  const wordingCandidate = candidates.find((c) => withoutArrangement(c.normalised!) === bare);
  if (wordingCandidate) return { status: 'near-miss', normalised, nearMiss: 'arrangement-wording', wordingCandidate, candidates, match };
  return { status: 'near-miss', normalised, nearMiss: 'other', candidates, match };
}
