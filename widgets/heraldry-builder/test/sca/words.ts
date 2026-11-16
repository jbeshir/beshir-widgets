// The words the SCA tooling (normaliser, matcher, tagger) reads that name the library's constructs, built from the library's own
// tables so that a division, band or line the library gains is read everywhere at once: the tooling keeps no hand-written copy of a
// library table (BRIEF: no duplicate tables).
import {
  DRAWN_DIVISIONS, DRAWN_LINES, DRAWN_ORDINARIES, DIVISION_NAME, GYRONNY_PIECES, LINE_SPELLINGS, LINE_WORD, MOD_HOSTS, ORDINARY_ARTICLE,
  ORDINARY_COUNTS, ORDINARY_KIND, ORDINARY_NAME, ORDINARY_PLURAL, edgeCount, edgeNames, familyOf, isDiminutive, lineAllowed, ordinaryEdgeHost,
  partCount, type Division, type EdgeHost, type OrdinaryType,
} from '../../src/lib/heraldry';
import { numberWord } from '../../src/lib/heraldry/words';

/** An alternation of words, the longest first, so that a pattern tries "bend sinister" before "bend". */
export const alt = (words: Iterable<string>): string => [...new Set(words)].sort((a, b) => b.length - a.length).join('|');

/** A line of partition as the widget words it ('embattled grady', 'ployé'), the longest first. */
export const LINE = `(?:${alt(DRAWN_LINES.map((l) => LINE_WORD[l]))})`;

const bandHost = (type: OrdinaryType): EdgeHost => ordinaryEdgeHost({ type, mods: [] });

/** The bands and shapes written with their line and treatments after their name ("a fess wavy couped"): the central ordinaries that take a line, other than the diminutives. */
export const BAND_NAMES = alt(DRAWN_ORDINARIES.filter((t) => ORDINARY_KIND[t] === 'central' && !isDiminutive(t) && edgeCount(bandHost(t)) > 0).map((t) => ORDINARY_NAME[t]));

/** The names of the edges a band's or shape's line is written on ("wavy on the lower edge"): each two-edged host's (`edgeNames`). */
export const EDGE_NAMES = alt(DRAWN_ORDINARIES.flatMap((t) => { const n = edgeNames(bandHost(t)); return n ? [n.a, n.b] : []; }));

/** Which line (`a` or `b`) an edge named in the text is on this host, or null when the host has no edge of that name. */
export function edgeSide(host: EdgeHost, word: string | undefined): 'a' | 'b' | null {
  const names = edgeNames(host);
  return names === null ? null : word === names.a ? 'a' : word === names.b ? 'b' : null;
}

/**
 * How a divided field starts, as the widget words it: its name, the line after it, and a gyronny's piece count ("per pale wavy", "gyronny
 * arrondi of twelve", "quarterly per fess embattled", "tierced in pale").
 */
const divisionStart = (d: Division): string =>
  `${DIVISION_NAME[d]}${d === 'quarterly' ? '(?: per (?:pale|fess))?' : ''}(?: ${LINE})?${d === 'gyronny' ? `(?: of (?:${GYRONNY_PIECES.map(numberWord).join('|')}))?` : ''}`;
const byNameLength = (ds: readonly Division[]) => [...ds].sort((a, b) => DIVISION_NAME[b].length - DIVISION_NAME[a].length);
export const DIVISION_START = `(?:${byNameLength(DRAWN_DIVISIONS).map(divisionStart).join('|')})`;
/** How a field divided in three starts: "per pall", "tierced in pale". */
export const THREE_PART_START = `(?:${alt(DRAWN_DIVISIONS.filter((d) => partCount(d) === 3).map((d) => DIVISION_NAME[d]))})(?: ${LINE})?`;
/** Every drawn division's name ("per pale", "quarterly", "tierced in fess"), the longest first. */
export const DIVISION_NAMES = alt(DRAWN_DIVISIONS.map((d) => DIVISION_NAME[d]));

/** The words after a division's name that make another drawn division ("per chevron inverted"), or a line only it is drawn with ("gyronny arrondi"), by `<division>-<word>`, to the division drawn. */
export const DRAWN_DIVISION_FORMS: Readonly<Record<string, Division>> = Object.fromEntries([
  ...DRAWN_DIVISIONS.filter((d) => DRAWN_DIVISIONS.some((b) => d.startsWith(`${b}-`))).map((d) => [d, d]),
  ...Object.entries(LINE_SPELLINGS).filter(([, line]) => line === 'arrondi')
    .flatMap(([word]) => DRAWN_DIVISIONS.filter((d) => lineAllowed({ k: 'division', division: d }, 'arrondi')).map((d) => [`${d}-${word}`, d])),
]);

/** "tierced per pale", "tierced in fesse": a field tierced in pale or in fess (the College writes both), the word after "tierced" captured. */
export const TIERCED_IN = /\btierced (?:per|in) (pale|fess)e?\b/g;
/** "tierced per pall", "gyronny of three": per pall (SENA A5G1b: "granted no difference"). */
export const PER_PALL_SPELLED = /\b(?:tierced (?:per|in) pall|gyronny of three)\b/g;

/** The bands and shapes that take "inverted" (`MOD_HOSTS.inverted`), by name, thin bands counted too; the pall inverted has the word in its name. */
export const INVERTED_HOSTS = alt(MOD_HOSTS.inverted.filter((t) => !ORDINARY_NAME[t].endsWith(' inverted')).flatMap((t) => (isDiminutive(t) ? [ORDINARY_NAME[t], ORDINARY_PLURAL[t]] : [ORDINARY_NAME[t]])));

/** The number words, one to twelve, as `numberWord` spells them. */
export const NUMBER_WORDS: readonly string[] = Array.from({ length: 12 }, (_, i) => numberWord(i + 1));

/** The corner and edge shapes, and the baton, that take "sinister" (`MOD_HOSTS.sinister`), by name. */
export const SINISTER_HOSTS = alt(MOD_HOSTS.sinister.map((t) => ORDINARY_NAME[t]));

/** How the text names the bands of a family: the ordinary or a baton ("a bend", "a baton"), its diminutive counted ("three bendlets"). */
const familyPhrases = (family: OrdinaryType): string[] => DRAWN_ORDINARIES.filter((t) => familyOf(t) === family)
  .flatMap((t) => ORDINARY_COUNTS[t]?.map((n) => `${numberWord(n)} ${ORDINARY_PLURAL[t]}`) ?? [`${ORDINARY_ARTICLE[t]} ${ORDINARY_NAME[t]}`]);
/** A bend, bendlets or a baton (not sinister): what a lone charge in chief or base stands beside in a corner. */
export const BEND = `\\b(?:${alt(familyPhrases('bend'))})(?! sinister\\b)\\b`;
/** A bend sinister, bendlets sinister or a baton sinister (a bend's band that takes "sinister"). */
export const BEND_SINISTER = `\\b(?:${alt([...familyPhrases('bend-sinister'), ...familyPhrases('bend').filter((p) => MOD_HOSTS.sinister.some((t) => p === `${ORDINARY_ARTICLE[t]} ${ORDINARY_NAME[t]}`)).map((p) => `${p} sinister`)])})\\b`;
