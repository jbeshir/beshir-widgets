// Plain-English search vocabulary shared by the Worker and the offline sample search: the text an
// entry is searched through (blazon + gloss + display name, normalised to lowercase words) and the
// parser that turns a typed query into "words", each a list of alternatives. An entry matches when
// every word has at least one alternative that appears in its text as a whole word or phrase.

import { TINCTURES, TINCTURE_NAME, TINCTURE_WORD, type Tincture } from './tinctures';
import { CHARGES, CHARGE_IDS, POSTURES, POSTURE_GLOSS, chargesInCategory, type ChargeCategory, type ChargeId, type Posture } from './charges';
import type { Design } from './design';
import { NAMED_TINCTURE_CHARGES, SEMY_NAMES } from './aliases';
import { gloss } from './gloss';
import { ORDINARY_NAME, ORDINARY_TYPES } from './ordinaries';

/**
 * "sky blue" is one colour word, not "blue" with a modifier: closed up into a single word so that a
 * search for plain "blue" (Azure) doesn't also find celestine, while "sky blue" still does.
 */
function closeUp(text: string): string {
  return text.replace(/\bsky blue\b/g, 'skyblue');
}

/** Lowercase words separated by single spaces: accents and punctuation (hyphens included) removed. */
export function normaliseWords(s: string): string {
  return closeUp(
    s
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim(),
  );
}

/**
 * The text an entry is searched through: blazon, plain-English gloss and display name, normalised
 * and padded with a space at each end so a whole word or phrase is a " word " substring. Contact
 * details, email and field shape are not part of it.
 */
export function buildSearchText(entry: { displayName: string; blazon: string; design: Design }): string {
  return ` ${normaliseWords(`${entry.displayName} ${entry.blazon} ${gloss(entry.design)}`)} `;
}

/** True when every word of the query has an alternative present in `searchText` as a whole word or phrase. */
export function matchesWords(searchText: string, words: readonly SearchWord[]): boolean {
  return words.every((w) => w.some((alt) => searchText.includes(` ${alt} `)));
}

/** One typed word (or multi-word phrase): the whole words/phrases that satisfy it. */
export type SearchWord = readonly string[];

const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'with', 'on', 'of', 'and', 'in', 'at', 'by', 'to', 'for', 'from', 'one', 'some', 'any', 'that', 'this',
  'who', 'was', 'had', 'has', 'is', 'it', 'its', 'person', 'shield', 'coat', 'arms', 'kind',
]);

/** Singular of a typed word: wolves → wolf, fleurs → fleur, roses → rose, fishes → fish. */
function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('ves')) return `${w.slice(0, -3)}f`;
  if (/(ch|sh|x|z|ss)es$/.test(w)) return w.slice(0, -2);
  if (/(ss|us|is)$/.test(w)) return w;
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

/** A word and its plurals (wolf → wolf, wolfs, wolves; rose → rose, roses; fish → fish, fishes). */
function pluralForms(w: string): string[] {
  if (/(s|x|z|ch|sh)$/.test(w)) return [w, `${w}es`];
  if (w.endsWith('f')) return [w, `${w}s`, `${w.slice(0, -1)}ves`];
  if (w.endsWith('y')) return [w, `${w}s`, `${w.slice(0, -1)}ies`];
  return [w, `${w}s`];
}

/** A word or phrase with its plural forms; a phrase pluralises its last word (open book → open books). */
function withPlurals(term: string): string[] {
  const at = term.lastIndexOf(' ') + 1;
  return pluralForms(term.slice(at)).map((w) => term.slice(0, at) + w);
}

/** Typing any of `keys` also matches `terms` (and the key itself). */
type Alias = readonly [keys: readonly string[], terms: readonly string[]];

// Tinctures: the blazon name, the plain colour word the gloss uses and everyday alternatives are
// interchangeable ("yellow" finds Or, "Or" finds gold). "Or" is a colour here, never the English word.
const TINCTURE_ALIASES: Record<Tincture, readonly string[]> = {
  or: ['yellow'], argent: ['silver'], celestine: ['cyan', 'light blue', 'turquoise'],
  azure: [], gules: [], vert: [], sable: [], purpure: ['violet'],
};
const tinctureAliases: Alias[] = TINCTURES.map((t) => {
  const names = [TINCTURE_NAME[t].toLowerCase(), TINCTURE_WORD[t], ...TINCTURE_ALIASES[t]].map(closeUp);
  return [names, names];
});

// Ordinaries: the blazon name; everyday words only reach the ordinaries the picture could be.
const ordinaryAliases: Alias[] = [
  ...ORDINARY_TYPES.map((o): Alias => [[ORDINARY_NAME[o]], [ORDINARY_NAME[o]]]),
  [['border', 'edge'], ['bordure', 'border', 'edge']],
  [['stripe', 'band'], ['stripe', 'band', 'fess', 'pale', 'bend', 'bend sinister']],
  [['x', 'x shaped', 'cross shaped'], ['saltire', 'x shaped']],
  [['v', 'upside down v'], ['chevron']],
];

// Charges: the name and plural as they appear in the blazon, everyday words, and kinds of charge.
const CHARGE_ALIASES: Record<ChargeId, readonly string[]> = {
  lion: ['cat'], wolf: ['dog', 'canine'], boar: ['pig'], stag: ['deer'], goat: [], hare: ['rabbit', 'bunny'], fish: [], bee: [],
  unicorn: ['horse'], dragon: ['wyvern'], eagle: [], owl: [], rose: [], tree: [], 'fleur-de-lis': ['lily', 'lilies', 'fleur'],
  mullet: ['star'], crescent: ['moon'], sun: [], heart: [], key: [], 'open-book': ['book'], sword: [], crown: [], anchor: [],
  'musical-note': ['music', 'note'], flame: ['fire'], gear: ['cog', 'gear', 'gearwheel'], lightbulb: ['light bulb', 'lamp'],
  roundel: ['circle', 'disc', 'disk', 'dot'], annulet: ['ring'], billet: ['rectangle', 'brick'], lozenge: ['diamond'], goutte: ['drop', 'teardrop', 'droplet'],
  'cross-crosslet': ['crosslet'], estoile: ['star'], spark: ['spark'],
};
/** The SCA's names for a charge of one tincture (bezant, plate, goutte de sang…) also find the charge. */
const namedWords = (id: ChargeId) => NAMED_TINCTURE_CHARGES.filter((n) => n.charge === id).flatMap((n) => [n.word, n.plural]);
const chargeTerms = (id: ChargeId) => [CHARGES[id].name, CHARGES[id].plural].map(normaliseWords);
/** The names of the semy of a charge (crusilly, billety…), which a design strewn with it is blazoned with. */
const semyWords = (id: ChargeId) => SEMY_NAMES.filter((n) => n.charge === id && !n.word.startsWith('semy of')).map((n) => normaliseWords(n.word));
const namesIn = (...categories: ChargeCategory[]) =>
  categories.flatMap((c) => chargesInCategory(c)).flatMap((m) => chargeTerms(m.id));
const chargeAliases: Alias[] = [
  ...CHARGE_IDS.flatMap((id): Alias[] => [
    [[normaliseWords(CHARGES[id].name)], [...chargeTerms(id), ...semyWords(id)]],
    [[...CHARGE_ALIASES[id], ...namedWords(id)].map(normaliseWords), [...chargeTerms(id), ...semyWords(id)]],
  ]),
  [['beast'], namesIn('beast')],
  [['monster'], namesIn('monster')],
  [['bird'], namesIn('bird')],
  [['plant'], namesIn('plant')],
  [['animal'], namesIn('beast', 'monster')],
  [['creature'], namesIn('beast', 'monster', 'bird')],
];

// Postures: every word for a posture — the blazon term, the plain word, a charge's own wording
// ("courant", "running") — stands for its whole family, so "passant wolf" finds a statant wolf.
const POSTURE_FAMILIES: readonly (readonly Posture[])[] = [
  ['rampant', 'salient'], ['passant', 'statant', 'courant'], ['couchant', 'dormant'], ['haurient', 'urinant'], ['rising', 'volant'],
];
const firstWord = (phrase: string) => phrase.split(' ')[0];
const postureWords = (p: Posture): string[] => {
  const own = CHARGE_IDS.flatMap((id) => {
    const w = CHARGES[id].postureWording[p];
    return w ? [w.term, firstWord(w.gloss)] : [];
  });
  const plain = POSTURE_GLOSS[p];
  return [p, ...(plain ? [firstWord(plain)] : []), ...own];
};
const postureAliases: Alias[] = [
  ...POSTURE_FAMILIES,
  ...POSTURES.filter((p) => !POSTURE_FAMILIES.some((f) => f.includes(p))).map((p) => [p]),
].map((family): Alias => {
  const words = [...new Set(family.flatMap(postureWords))];
  return [words, words];
});

// Layout words: how a group is arranged, as the blazon and the gloss say it.
const layoutAliases: Alias[] = [
  [['splendour', 'splendor', 'glory'], ['splendor']],
  [['ring', 'circle'], ['annulo', 'ring', 'orle']],
  [['crossed'], ['crossed', 'saltire']],
];

// Strewn charges: the gloss says "strewn with", the blazon "semy" or the name of the semy; every word finds either.
const semyAliases: Alias[] = [[['strewn', 'scattered', 'sprinkled', 'semy', 'seme', 'semee'], ['strewn', 'semy']]];

const ALIASES: readonly Alias[] = [
  ...tinctureAliases,
  // Counterchanged charges: the blazon term and its spellings (the gloss says "opposite colours").
  [['counterchanged', 'counterchange', 'counter changed', 'counter change'], ['counterchanged']],
  ...ordinaryAliases,
  ...chargeAliases,
  ...postureAliases,
  ...layoutAliases,
  ...semyAliases,
];

/** Words and phrases a typed key stands for, exactly as they appear in an entry's text. */
const SYNONYMS: ReadonlyMap<string, readonly string[]> = ALIASES.reduce((table, [keys, terms]) => {
  for (const key of keys) table.set(key, [...new Set([...(table.get(key) ?? []), key, ...terms])]);
  return table;
}, new Map<string, readonly string[]>());

/** The longest phrase in SYNONYMS, in words. */
const MAX_PHRASE_WORDS = Math.max(...[...SYNONYMS.keys()].map((k) => k.split(' ').length));

/**
 * Turn a typed query into words to AND together. Stopwords are dropped, plurals reduced to the
 * singular, multi-word keys ("sky blue", "fleurs-de-lis") read as one word, and each word is
 * expanded to everything it can stand for. A query with no searchable word yields [].
 */
export function queryWords(q: string): SearchWord[] {
  const typed = normaliseWords(q).split(' ').filter(Boolean);
  const words: SearchWord[] = [];
  for (let i = 0; i < typed.length;) {
    const key = synonymKey(typed, i);
    const span = key ? key.words : 1;
    const asTyped = typed.slice(i, i + span).join(' ');
    i += span;
    if (span === 1 && STOPWORDS.has(asTyped)) continue;
    const known = key ? (SYNONYMS.get(key.phrase) ?? []) : [];
    words.push([...new Set([asTyped, ...withPlurals(key?.phrase ?? singular(asTyped)), ...known])]);
  }
  return words;
}

/** The longest SYNONYMS key starting at typed[start], read as typed or with each word singular. */
function synonymKey(typed: readonly string[], start: number): { phrase: string; words: number } | null {
  for (let n = Math.min(MAX_PHRASE_WORDS, typed.length - start); n >= 1; n--) {
    const parts = typed.slice(start, start + n);
    const phrase = [parts.join(' '), parts.map(singular).join(' ')].find((p) => SYNONYMS.has(p));
    if (phrase) return { phrase, words: n };
  }
  return null;
}
