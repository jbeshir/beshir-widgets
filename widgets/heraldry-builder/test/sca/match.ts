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
  CHARGES, CHARGE_IDS, DRAWN_ORDINARIES, FURS, FUR_NAME, ORDINARY_KIND, ORDINARY_NAME, POSTURES, TINCTURES,
  blazon, normalise, postureTerm, type ChargeId, type Design, type Gap, type Issue, type OrdinaryType, type Posture,
} from '../../src/lib/heraldry';
import { normaliseBlazon } from './normalise';
import { DIVISION_WORDS, readPaint } from './paint-grammar';

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
  /** The same with the College's defaults stated: normaliseBlazon(blazon(design, { stateDefaults: true })); null without a design. */
  stated: string | null;
}

/** Whether a candidate's design is worded as the normalised text: in house style, or with its defaults stated. */
export const wordedAs = (c: Candidate, normalisedText: string): boolean => c.normalised === normalisedText || c.stated === normalisedText;

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

const ORDINARY_WORDS = new Map<string, OrdinaryType>(DRAWN_ORDINARIES.map((t) => [ORDINARY_NAME[t], t]));
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'] as const;
const COUNT_WORDS = new Map<string, number>([['a', 1], ['an', 1], ...NUMBER_WORDS.map((w, i): [string, number] => [w, i + 1])]);
const LINE_WORDS = ['pale', 'fess', 'bend sinister', 'bend'] as const;
const POSITION_WORDS = ['chief', 'base', 'canton', 'dexter chief', 'sinister chief', 'dexter base', 'sinister base', 'dexter', 'sinister'] as const;
const PATTERN_WORDS = ['saltire', 'cross', 'orle', 'annulo'] as const;
/** What can follow "in" before a group, the longest first ("sinister chief" before "sinister"). */
const LEADS = [...LINE_WORDS, ...POSITION_WORDS].sort((a, b) => b.split(' ').length - a.split(' ').length);

/** Charge noun → charge and number. "fish" is both. */
const NOUNS = new Map<string, { id: ChargeId; plural: boolean; singular: boolean }>();
for (const id of CHARGE_IDS) {
  const m = CHARGES[id];
  NOUNS.set(m.name, { id, singular: true, plural: m.plural === m.name });
  if (m.plural !== m.name) NOUNS.set(m.plural, { id, singular: false, plural: true });
}

/** Every posture word the widget's blazons can contain, by the posture it names (for the charge it was written with, else any). */
const POSTURE_BY_WORD = new Map<string, Posture>();
for (const id of CHARGE_IDS) for (const p of POSTURES) POSTURE_BY_WORD.set(postureTerm(id, p), p);
const POSTURE_WORDS = new Set<string>([...POSTURES, ...POSTURE_BY_WORD.keys()]);

/** Posture word → posture: the charge's own term first ("segreant"), else the plain posture id; a posture the charge can't take is still proposed, so the widget reports it. */
function postureFor(id: ChargeId, word: string): Posture | null {
  const m = CHARGES[id];
  for (const p of m.postures ?? []) if (postureTerm(id, p) === word) return p;
  return POSTURE_BY_WORD.get(word) ?? POSTURES.find((p) => p === word) ?? null;
}

const ROWS = `(?:${alt(NUMBER_WORDS)})(?:, (?:${alt(NUMBER_WORDS)}))* and (?:${alt(NUMBER_WORDS)})`;

/** Every word the widget's blazons can contain; anything else can't be matched. */
const VOCABULARY = new Set<string>(
  [
    ...TINCTURES, ...FURS.map((f) => FUR_NAME[f]), 'ermined', 'vairy', 'potenty', 'counterchanged', 'and', 'a', 'an', 'on', 'between', 'in', 'splendor', 'chief', 'bordure', 'base', 'canton', 'dexter', 'each', 'charged', 'with', 'overall',
    ...DIVISION_WORDS.keys(), ...ORDINARY_WORDS.keys(), ...LINE_WORDS, ...PATTERN_WORDS, ...NUMBER_WORDS,
    ...NOUNS.keys(), ...POSTURE_WORDS,
  ].flatMap((w) => w.split(/[ ,]+/)).filter(Boolean),
);

// ── Parser ──────────────────────────────────────────────────────────────────
// A token grammar over the normalised text (words, with commas as tokens of their own):
//   blazon     := field [',' element (connector element)*]
//   field      := T | DIVISION T 'and' T
//   element    := ['on'] ('a'|'an') ordinary [T]   an ordinary, central or peripheral ("on" when a group sits on it)
//               | 'on' group                        a charge group with a group on it
//               | 'each charged with' group          the group before it, a charge group, with the group on each charge
//               | 'overall' (ordinary|group)         the one band or group lying across everything before it
//               | 'between'                        the groups that follow are set around the ordinary
//               | group
//   group      := [('in' LINE|POSITION)] COUNT NOUN [POSTURE] ['in splendor'] [('in' PATTERN)|ROWS] [T]
//   (a group in chief, in base or in canton after another is set there beside it: SENA App I1, which `resolve` applies)
//   connector  := ',' | 'and' | ε
// A group straight after "between", or joined to one by "and", is set around the ordinary or the primary charges; any other
// group after an "on" ordinary sits on it. A phrase without a tincture takes the next stated one, except
// that a tincture never crosses into or out of a group on a host (Bruce). The parser only proposes:
// `resolve` infers roles, and verify() decides by comparing blazons.

interface Phrase {
  /** The group input, without its paint. */
  group: Record<string, unknown>;
  paint: unknown;
}

/** A top-level group, with the group that sits on it. */
interface Node { phrase: Phrase; on: Phrase | null }

const NOUN_PHRASES = [...NOUNS.keys()].map((n) => n.split(' ')).sort((a, b) => b.length - a.length);
const ORDINARY_PHRASES = [...ORDINARY_WORDS.keys()].map((o) => o.split(' ')).sort((a, b) => b.length - a.length);
const startsWith = (tokens: string[], i: number, phrase: readonly string[]) => phrase.every((w, j) => tokens[i + j] === w);
const isNumber = (w: string | undefined): boolean => (NUMBER_WORDS as readonly string[]).includes(w!);
const numberOf = (w: string) => NUMBER_WORDS.indexOf(w as (typeof NUMBER_WORDS)[number]) + 1;

function parseField(text: string): unknown {
  const tokens = text.split(' ');
  const read = readPaint(tokens, 0, 'field');
  return read?.end === tokens.length ? read.paint : null;
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
      line = LINE_WORDS.find((w) => startsWith(tokens, i + 1, w.split(' '))) ?? null;
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
  if (count === 1 && countWord !== CHARGES[noun.id].article) return null;
  const item: Record<string, unknown> = { k: 'charge', charge: noun.id };
  if (POSTURE_WORDS.has(tokens[i])) {
    const posture = postureFor(noun.id, tokens[i++]);
    if (!posture) return null;
    item.posture = posture;
  }
  if (startsWith(tokens, i, ['in', 'splendor'])) {
    item.mods = [{ id: 'in-splendour', count: null, paint: null }];
    i += 2;
  }
  const group: Record<string, unknown> = { item, count };
  // "in chief three mullets" places the group (the widget lays it out there); "in pale two keys" arranges it.
  if (lead) {
    if ((POSITION_WORDS as readonly string[]).includes(lead)) group.position = lead.replace(' ', '-');
    else group.arrangement = `in-${lead.replace(' ', '-')}`;
  }
  if (line) group.arrangement = `in-${line.replace(' ', '-')}`;
  if (tokens[i] === 'in' && (PATTERN_WORDS as readonly string[]).includes(tokens[i + 1])) {
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
  const read = readPaint(tokens, i, 'group');
  return { phrase: { group, paint: read?.paint ?? null }, end: read ? read.end : i };
}

/** What the body of a blazon reads as: the design input's groups, or a construct the widget doesn't draw. */
type Body = { k: 'groups'; groups: object[] } | { k: 'gap'; gap: Gap };

/** The body of a blazon, or null when it isn't in the grammar. */
function parseBody(tokens: string[]): Body | null {
  const top: Node[] = [];
  /** Every phrase in blazon order, for factoring tinctures backwards. */
  const order: { phrase: Phrase; onHost: boolean }[] = [];
  let host: Node | null = null;       // an "on" ordinary still waiting for its group
  let between = false;
  let joined = false;                  // the last connector was "and", or "between" has just been read
  let overall = false;                 // "overall" has just been read: the next element lies across everything
  let i = 0;
  while (i < tokens.length) {
    const w = tokens[i];
    if (w === ',' || w === 'and') {
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
      const ordinary = tokens[j] === 'a' || tokens[j] === 'an' ? ORDINARY_PHRASES.find((o) => startsWith(tokens, j + 1, o)) : undefined;
      if (ordinary) {
        const end = j + 1 + ordinary.length;
        const read = readPaint(tokens, end, 'group');
        const node: Node = { phrase: { group: { ...(overall ? { role: 'overall' } : {}), item: { k: 'ordinary', type: ORDINARY_WORDS.get(ordinary.join(' ')) } }, paint: read?.paint ?? null }, on: null };
        top.push(node);
        order.push({ phrase: node.phrase, onHost: false });
        host = on ? node : null;
        between = false;
        overall = false;
        i = read ? read.end : end;
      } else {
        const g = readGroup(tokens, j);
        if (!g) return null;
        if (overall) {
          g.phrase.group.role = 'overall';
          top.push({ phrase: g.phrase, on: null });
          order.push({ phrase: g.phrase, onHost: false });
          overall = false;
        } else if (on) {
          // "on a lion …": a group on a charge, which the widget reports rather than draws.
          const node: Node = { phrase: g.phrase, on: null };
          top.push(node);
          order.push({ phrase: g.phrase, onHost: false });
          host = node;
          between = false;
        } else if (between && joined) {
          // Set between what came before: a central ordinary, or the primary charges ("a lion between three mullets").
          g.phrase.group.relation = 'between';
          top.push({ phrase: g.phrase, on: null });
          order.push({ phrase: g.phrase, onHost: false });
        } else if (host && !host.on) {
          host.on = g.phrase;
          order.push({ phrase: g.phrase, onHost: true });
          between = false;
        } else {
          top.push({ phrase: g.phrase, on: null });
          order.push({ phrase: g.phrase, onHost: false });
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
      carry = phrase.paint;
    }
  }
  const withPaint = (p: Phrase) => ({ ...p.group, paint: p.paint });
  return { k: 'groups', groups: top.map((n) => (n.on ? { ...withPaint(n.phrase), charged: [withPaint(n.on)] } : withPaint(n.phrase))) };
}

/** Candidate design inputs for normalised SCA text (usually zero or one), or the gap the text reads as. */
function proposeInputs(normalisedText: string): DesignInput[] | Gap {
  const comma = normalisedText.indexOf(',');
  const field = parseField(comma < 0 ? normalisedText : normalisedText.slice(0, comma));
  if (!field) return [];
  const tokens = comma < 0 ? [] : normalisedText.slice(comma + 1).replace(/,/g, ' , ').split(/ +/).filter(Boolean);
  const body = parseBody(tokens);
  if (body?.k === 'gap') return body.gap;
  return body ? [{ v: 2, field, groups: body.groups }] : [];
}

/** What the widget makes of a proposed input. */
function verify(raw: DesignInput): Candidate {
  const r = normalise(raw);
  const design = r.design;
  const wording = (stateDefaults: boolean) => (design ? normaliseBlazon(blazon(design, { stateDefaults })) : null);
  return { raw, design, issues: r.ok ? [] : r.errors, normalised: wording(false), stated: wording(true) };
}

// ── API ─────────────────────────────────────────────────────────────────────

const ARRANGEMENT_PHRASE = new RegExp(`(?:\\bin (?:${alt([...LINE_WORDS, ...POSITION_WORDS, ...PATTERN_WORDS])}) | ${ROWS}(?= ))`, 'g');
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
  if (normalised.startsWith('(fieldless)')) return { status: 'fieldless', normalised, candidates: [], match: null };
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
