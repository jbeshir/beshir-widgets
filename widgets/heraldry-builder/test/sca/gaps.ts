// SCA gap tagger: for an O&A armory record, the things in its blazon the heraldry builder can't
// express — furs, lines of partition, charges outside the widget's 28, second charge groups,
// postures, … Tags are `<category>` or `<category>:<subtag>`; categories are GAP_CATEGORIES.
//
// It is a word-level reader, not a parser: the blazon is normalised, multi-word terms are joined,
// each word is reduced to a lemma and looked up in the term lists (gap-terms.ts), and a small
// amount of state (field vs. charges, the last ordinary or charge seen, "on"/"between"/"maintaining"
// clauses, pending counts and arrangements) decides which category a word belongs to and how many
// charge groups and ordinaries there are. Every word it doesn't recognise is noted; a record with no
// gap tag but unknown words is tagged by its index headings or, failing that, `other`.
import {
  CHARGES, HALF_POSITIONS, MAX_DRAWN_COUNT, ORDINARY_KIND, ROW_PATTERNS, hostCounts, postureTerm, resolve, structuralIssues, unsupportedIssues, walkGroups,
  type ChargeId, type HalfPosition, type OrdinaryType, type Posture,
} from '../../src/lib/heraldry';
import type { ArmoryRecord } from './oanda';
import {
  BUCKET_DESCRIPTION, CHARGE_BUCKETS, CONTAINER_WORDS, CONTEXT_WORDS, CROSS_POST, CROSS_PRE, FUNCTION_WORDS, FURS,
  GAP_ARRANGEMENTS, GAP_CHARGES, GAP_DIVISION_WORDS, GAP_ORDINARIES, GAP_POSTURES, GAP_TINCTURES, LINES, MARSHALLING,
  MODIFIERS, NUMBERS, ORIENTATIONS, PART_WORDS, POSITION_WORDS, SEMY_WORDS,
  SUPPORTED_ARRANGEMENT_WORDS, SUPPORTED_CHARGE_BUCKET, SUPPORTED_CHARGE_WORDS, SUPPORTED_ORDINARY_WORDS,
  SUPPORTED_POSTURES, QUALIFIER_WORDS, TREATMENTS, type ChargeBucket,
} from './gap-terms';

export const GAP_CATEGORIES = [
  { id: 'fieldless', description: 'a fieldless badge: no field at all' },
  { id: 'marshalling', description: 'impaling, quartering, dimidiation, an augmentation or other combined arms' },
  { id: 'fur', description: 'a fur (ermine, vair, potent, pean…) anywhere in the arms' },
  { id: 'tincture', description: 'a tincture outside the widget\'s eight, a charge or ordinary of more than one tincture, or an ordinary counterchanged' },
  { id: 'proper', description: 'a charge tinctured proper (natural colouring)' },
  { id: 'field-treatment', description: 'a variegated pattern (barry, checky, compony, masoned…) on the field or any element, or a semy field' },
  { id: 'division', description: 'a field division the widget lacks (per pall, gyronny, tierced, per chevron inverted, compound…)' },
  { id: 'line-of-partition', description: 'any line other than straight (embattled, wavy, indented, engrailed…), on a division or ordinary' },
  { id: 'ordinary', description: 'an ordinary, sub-ordinary or diminutive the widget lacks (canton, orle, bars, flaunches…), or several of one ordinary' },
  { id: 'ordinary-treatment', description: 'an ordinary modified (cotised, fimbriated, voided, couped, inverted, enhanced, issuant…)' },
  { id: 'multiple-groups', description: 'more than one charge group (including charges on charges and held charges counted as groups) or more than one ordinary' },
  { id: 'placement', description: 'one charge group and one ordinary, but in a count or position the widget does not allow, or cannot fit at a legible size (a bend between three, on a bordure, six on a chevron…)' },
  { id: 'count', description: 'more than twelve of a charge, or a charge strewn semy on an element' },
  ...CHARGE_BUCKETS.map((b) => ({ id: `charge-${b}` as const, description: `a charge outside the widget's 28: ${BUCKET_DESCRIPTION[b]}` })),
  { id: 'posture', description: 'a posture or attitude the widget lacks, or one its charge can\'t take (guardant, combattant, couchant…)' },
  { id: 'orientation', description: 'a charge turned from its fixed orientation (bendwise, fesswise, inverted, reversed, to sinister…)' },
  { id: 'charge-modifier', description: 'a charge detail the widget can\'t show (crowned, maintaining, winged, erased, slipped, demi-, a head…)' },
  { id: 'arrangement', description: 'an arrangement or position the widget lacks for that count (in chevron, in dexter chief, one and two…), or charges Table 7 forces into one part of a divided field' },
  // Widget findings: never read from the blazon, but set by classify.ts when the matcher has found
  // (or nearly found) the widget's design and the widget disagrees with the SCA about it.
  { id: 'tincture-rule-differs', description: 'the matched design breaks the widget\'s rule of tincture, yet the SCA registered it' },
  { id: 'widget-structure-rule', description: 'the matched design breaks a widget structure rule that SENA does not have (a count, placement or arrangement it forbids)' },
  { id: 'blazon-wording-differs', description: 'the widget can draw the design but blazons it in other words than the SCA (an arrangement stated or left unsaid)' },
  { id: 'other', description: 'not recognised as expressible, but no specific gap found' },
] as const;

export type GapCategory = (typeof GAP_CATEGORIES)[number]['id'];

/** The category part of a tag (`charge-beast:wolf` → `charge-beast`). */
export const categoryOf = (tag: string): string => tag.split(':')[0];

// ── Lexicon ─────────────────────────────────────────────────────────────────

type Entry =
  | { k: 'skip' } | { k: 'qual' } | { k: 'num'; n: number } | { k: 'tinc' } | { k: 'cc' } | { k: 'proper' }
  | { k: 'tincGap'; v: string } | { k: 'fur'; v: string } | { k: 'charge'; id: ChargeId }
  | { k: 'gapCharge'; b: ChargeBucket; v: string } | { k: 'cross' }
  | { k: 'ord'; v: OrdinaryType } | { k: 'gapOrd'; v: string } | { k: 'line'; v: string }
  | { k: 'per' } | { k: 'quarterly' } | { k: 'gapDiv'; v: string } | { k: 'treat'; v: string } | { k: 'semy' }
  | { k: 'posture'; v: Posture } | { k: 'gapPosture'; v: string } | { k: 'orient'; v: string }
  | { k: 'mod'; v: string } | { k: 'ctx'; v: string } | { k: 'marshal'; v: string }
  | { k: 'in' } | { k: 'on' } | { k: 'between' } | { k: 'of' } | { k: 'and' } | { k: 'container' };

const LEX = new Map<string, Entry>();
/** Later lists don't overwrite earlier ones, so list order is priority order. */
function add(words: Iterable<string>, e: Entry | ((word: string) => Entry)): void {
  for (const word of words) if (!LEX.has(word)) LEX.set(word, typeof e === 'function' ? e(word) : e);
}
const entries = <T>(r: Record<string, T>) => Object.entries(r);

add(['in'], { k: 'in' }); add(['on'], { k: 'on' }); add(['between', 'betwixt'], { k: 'between' });
add(['of'], { k: 'of' }); add(['and', '&'], { k: 'and' }); add(['per'], { k: 'per' }); add(['quarterly'], { k: 'quarterly' });
for (const [word, n] of entries(NUMBERS)) LEX.set(word, { k: 'num', n });
add(['or', 'argent', 'azure', 'gules', 'vert', 'sable', 'purpure', 'celestine'], { k: 'tinc' });
add(['counterchanged', 'counter-changed', 'counterchange'], { k: 'cc' });
add(['proper', 'ppr'], { k: 'proper' });
for (const [word, id] of entries(SUPPORTED_CHARGE_WORDS)) LEX.set(word, { k: 'charge', id: id as ChargeId });
add(['cross', 'crux'], { k: 'cross' });
for (const [word, v] of entries(SUPPORTED_ORDINARY_WORDS)) LEX.set(word, { k: 'ord', v: v as OrdinaryType });
for (const [word, v] of entries(FURS)) LEX.set(word, { k: 'fur', v });
for (const [word, v] of entries(GAP_TINCTURES)) add([word], { k: 'tincGap', v });
for (const [word, v] of entries(GAP_ORDINARIES)) add([word], { k: 'gapOrd', v });
for (const [word, v] of entries(LINES)) add([word], { k: 'line', v });
for (const [word, v] of entries(GAP_DIVISION_WORDS)) add([word], { k: 'gapDiv', v });
for (const [word, v] of entries(TREATMENTS)) add([word], { k: 'treat', v });
add(SEMY_WORDS, { k: 'semy' });
for (const [word, v] of entries(MARSHALLING)) add([word], { k: 'marshal', v });
for (const [word, v] of entries(SUPPORTED_POSTURES)) add([word], { k: 'posture', v: v as Posture });
for (const [word, v] of entries(GAP_POSTURES)) add([word], { k: 'gapPosture', v });
for (const [word, v] of entries(ORIENTATIONS)) add([word], { k: 'orient', v });
add(CONTEXT_WORDS, (word) => ({ k: 'ctx', v: word }));
for (const [word, v] of entries(MODIFIERS)) add([word], { k: 'mod', v });
add(CONTAINER_WORDS, { k: 'container' });
for (const b of CHARGE_BUCKETS) for (const word of GAP_CHARGES[b]) add([word], { k: 'gapCharge', b, v: word });
add(FUNCTION_WORDS, { k: 'skip' });
add(QUALIFIER_WORDS, { k: 'qual' });
add(CROSS_PRE, { k: 'skip' }); // read with the following "cross" by readCross

const PARTS = new Set(PART_WORDS);
/** SCA words for the postures each widget charge can take ("courant" only for the hare). */
const POSTURE_WORDS = Object.fromEntries(Object.values(CHARGES).map((m) =>
  [m.id, new Set((m.postures ?? []).flatMap((p) => [p, postureTerm(m.id, p)]))])) as Record<ChargeId, Set<string>>;
const CROSS_AFTER = new Set(CROSS_POST);
const CROSS_BEFORE = new Set(CROSS_PRE);
const POSITIONS = new Set(POSITION_WORDS);
/** Spelling variants of a cross variant → sub-tag. */
const CROSS_VARIANT: Record<string, string> = {
  formee: 'formy', pattee: 'formy', patty: 'formy', paty: 'formy', fleury: 'flory', botonny: 'bottony',
  botony: 'bottony', fitched: 'fitchy', cleche: 'clechy', clechee: 'clechy', pomelly: 'pommelly',
  pommetty: 'pommelly', ancree: 'anchored', anchory: 'anchored', humetty: 'couped', st: 'saint',
};
/** Irregular plurals. */
const IRREGULAR: Record<string, string> = {
  men: 'man', women: 'woman', mice: 'mouse', reremice: 'reremouse', geese: 'goose', teeth: 'tooth', feet: 'foot',
  forefeet: 'forefoot', oxen: 'ox', children: 'child', staves: 'staff', torteaux: 'torteau', pegasi: 'pegasus',
  gladii: 'gladius', triquetrae: 'triquetra', seeblatter: 'seeblatt', dice: 'die', calves: 'calf', halves: 'half',
  lice: 'louse', 'sea-wolves': 'sea-wolf', wolves: 'wolf', hooves: 'hoof', amphorae: 'amphora', polypi: 'polypus',
  cacti: 'cactus', fungi: 'fungus',
};

/** The lexicon form of a word: as written, irregular plural, or by stripping a plural ending. */
function lemma(word: string): string | null {
  if (LEX.has(word)) return word;
  const irr = IRREGULAR[word];
  if (irr && LEX.has(irr)) return irr;
  const tries: string[] = [];
  if (word.endsWith('s')) tries.push(word.slice(0, -1));
  if (word.endsWith('es')) tries.push(word.slice(0, -2));
  if (word.endsWith('ies')) tries.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ves')) tries.push(`${word.slice(0, -3)}f`, `${word.slice(0, -3)}fe`);
  if (word.endsWith('x')) tries.push(word.slice(0, -1)); // torteaux-style
  for (const t of tries) if (LEX.has(t)) return t;
  return null;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

/** Multi-word terms joined into single tokens, applied in order to the lower-cased, accent-free text. */
const JOINS: [RegExp, string][] = [
  [/\bfleurs?[- ]de[- ]l[iy]s\b/g, 'fleur-de-lys'],
  [/\b(semy|seme)[- ]de[- ]l[iy]s\b/g, 'semy-de-lys'],
  [/\bjessant[- ]de[- ]l[iy]s\b/g, 'jessant-de-lys'],
  [/\blily of the valley\b|\blilies of the valley\b/g, 'lily-of-the-valley'],
  [/\bforget[- ]me[- ]nots?\b/g, 'forget-me-not'],
  [/\b(gouttes?|gouts?|goutes?|goutty|gutty|goutte)[- ](de[- ]|d')(sang|larmes?|poix|l'huile|huile|eau|vin|or)\b/g, '$1'],
  [/\bsun ?bursts?\b/g, 'sunburst'],
  [/\bslow[- ]matche?s?\b/g, 'slow-match'],
  [/\ben soleil\b/g, 'en-soleil'],
  [/\bchaine shots?\b/g, 'chaine-shot'],
  [/\bfers[- ]a[- ]loup\b/g, 'fer-a-loup'],
  [/\bflames? of fire\b/g, 'flame'],
  [/\ba la (quise|cuisse)\b/g, 'erased'],
  [/\bgarden (rose|rosebud)/g, 'garden-$1'],
  [/\bcatherine('s)? wheels?\b/g, 'catherine-wheel'],
  [/\blightning (flash|flashes|bolts?)\b/g, 'lightning'],
  [/\bmorning[- ]?stars?\b/g, 'morningstar'],
  [/\b(east asian|eastern|oriental|chinese|japanese) dragon/g, 'east-asian-dragon'],
  [/\bgyronny arrond[iy]\b/g, 'gyronny'],
  [/\bin (its|his|her) (vigilance|vanity)\b/g, 'in-vigilance'],
  [/\bin benediction\b/g, 'in-benediction'],
  [/\b(bend|bendlet|scarpe)s? sinister\b/g, '$1-sinister'],
  [/\b(bendwise|bendy|in bend) sinister\b/g, '$1-sinister'],
  [/\bfacing (to )?sinister\b|\bsinister[- ]facing\b/g, 'to-sinister'],
  [/\b(eastern|antique|celestial|mural|naval|imperial|papal) crowns?\b/g, '$1-crown'],
  [/\b(in|its|his|her) (splendou?r|glory)\b/g, ' '],
  [/\bin (her|its|his) piety\b/g, 'in-piety'],
  [/\bat gaze\b/g, 'at-gaze'],
  [/\bin (his |its |her )?pride\b/g, 'in-pride'],
  [/\bmusical notes?\b/g, 'musical-note'],
  [/\b(gear|cog)[- ]?wheels?\b|\bcogwheels?\b|\bgears\b/g, 'gear'],
  [/\blight ?bulbs?\b/g, 'lightbulb'],
  [/\bcompass[- ](stars?|roses?)\b/g, 'compass-star'],
  [/\bsea (\w+)/g, 'sea-$1'],
  [/\bdemi (\w+)/g, 'demi-$1'],
  [/\bcubit arms?\b/g, 'cubit-arm'],
  [/\bchess[- ](rook|knight|piece|king|queen|pawn|bishop)s?\b/g, 'chess-$1'],
  [/\b(drinking|hunting|bugle)[- ]horns?\b/g, '$1-horn'],
  [/\b(paw|foot|hoof|hand) ?prints?\b/g, 'pawprint'],
  [/\bermine spots?\b/g, 'ermine-spot'],
  [/\bwater[- ]?bougets?\b/g, 'water-bouget'],
  [/\bcard[- ]piques?\b/g, 'card-pique'],
  [/\bbattle[- ]?axes?\b/g, 'battle-axe'],
  [/\bwar[- ]hammers?\b/g, 'warhammer'],
  [/\bpole[- ]?axes?\b/g, 'poleaxe'],
  [/\bspur[- ]rowels?\b/g, 'spur-rowel'],
  [/\b(lines?|points?) of (division|partition)\b/g, ' '],
  [/\bof the (field|first|second|third|fourth|fifth|last|same|ordinary)\b/g, ' '],
  [/\bfor augmentation\b/g, 'augmentation'],
  [/\b(an? )?escutcheon of pretence\b/g, 'pretence'],
  [/\bvolant en arriere\b/g, 'volant'],
  [/\ben arriere\b/g, 'volant'],
  [/\b(counter|double|triple)[- ](cotised|cotissed)\b/g, 'cotised'],
  [/\bbleu celeste\b/g, 'bleu-celeste'],
  [/\bvair en point\b/g, 'vair'],
  [/\bpoint pointed\b/g, 'point'],
  [/\b(to|toward|towards) (sinister|dexter|chief|base|center|centre)\b/g, 'to-$2'],
  [/\bst\. /g, 'saint '],
  [/\bhand of fatima\b/g, 'hand-of-fatima'],
  [/\b(stars?|mullets?) of david\b/g, 'star-of-david'],
  [/\b(rod|staff|staves) of (aesculapius|asclepius)\b/g, 'staff-of-aesculapius'],
  [/\bqueue[- ](fourchy|forchy|fourchee|forchee)\b/g, 'queue-fourchy'],
  [/\bshooting stars?\b/g, 'comet'],
  [/\bjoscelyn knots?\b/g, 'joscelyn-knot'],
  [/\byin[- ]yang\b/g, 'yin-yang'],
  [/\bchi[- ]rho\b/g, 'chi-rho'],
  [/\b(lacy|bowen|stafford|wake|bourchier|cavendish|heneage|hungerford|dacre|harrington|savoy) knots?\b/g, '$1-knot'],
  [/\bcross(es)?[- ]crosslets?\b/g, 'crosslet'],
];

interface Token { word: string; poss: boolean }
const BREAK = '|';

/** Lower-case, strip accents, drop "(Fieldless)", join multi-word terms and split into tokens. */
function tokenise(blazon: string): { tokens: Token[]; fieldless: boolean } {
  // goutté (strewn with drops) would otherwise lose its accent and read as goutte (a drop)
  let s = blazon.toLowerCase().replace(/\bg(o?)utt?é/g, 'goutty').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’`]/g, "'");
  const fieldless = /^\s*\(fieldless\)/.test(s);
  if (fieldless) s = s.replace(/^\s*\(fieldless\)/, '');
  for (const [re, to] of JOINS) s = s.replace(re, to);
  const tokens: Token[] = [];
  for (const raw of s.split(/([,;:.()[\]"]|\s+)/)) {
    if (!raw || /^\s+$/.test(raw)) continue;
    if (/^[,;:.()[\]"]$/.test(raw)) {
      if (tokens.length && tokens[tokens.length - 1].word !== BREAK) tokens.push({ word: BREAK, poss: false });
      continue;
    }
    const m = /^(.*?)('s|s')$/.exec(raw);
    if (m && m[1].length > 1) tokens.push({ word: m[2] === "s'" ? `${m[1]}s` : m[1], poss: true });
    else {
      const word = raw.replace(/^'+|'+$/g, '');
      if (word) tokens.push({ word, poss: false });
    }
  }
  return { tokens, fieldless };
}

type Found = { lem: string; e: Entry; extra?: Entry };
const found = new Map<string, Found | null>();

/** Entry for a token (memoised: the corpus has ~7,000 distinct words). */
function lookup(word: string): Found | null {
  let f = found.get(word);
  if (f === undefined) found.set(word, (f = lookupUncached(word)));
  return f;
}

/** Entry for a token, trying the word, then its plural-stripped forms, then the parts of a hyphenated compound. */
function lookupUncached(word: string): Found | null {
  const lem = lemma(word);
  if (lem) return { lem, e: LEX.get(lem)! };
  if (!word.includes('-')) return null;
  // demi-lion, sea-otter (unlisted), bat-winged, six-pointed, four-leaved …
  const parts = word.split('-').filter(Boolean);
  if (parts[0] === 'demi' && parts.length > 1) {
    const rest = lookup(parts.slice(1).join('-'));
    return rest ? { ...rest, extra: { k: 'mod', v: 'demi' } } : { lem: word, e: { k: 'mod', v: 'demi' } };
  }
  if (parts[0] === 'sea' && parts.length > 1) return { lem: word, e: { k: 'gapCharge', b: 'monster', v: word } };
  const last = parts[parts.length - 1];
  if (/^(armed|sided|sized|shaped|colou?red|skinned|nosed|edged)$/.test(last)) return { lem: word, e: { k: 'skip' } }; // "equal-armed", "light-skinned"
  if (/^(winged|headed|tailed|horned|bladed|bitted|hilted|towered|legged|petall?ed|pointed|leaved|leafed|arched|bodied|masted|spoked|footed|eyed|necked|tongued|handled|stringed|tiered|peaked|lobed|rayed|limbed|fanged|crowned|hooded|bellied|backed|maned|tusked)$/.test(last)) {
    if (last === 'headed' && !NUMBERS[parts[0]]) return { lem: word, e: { k: 'qual' } }; // "round-headed"
    const v = last === 'headed' ? 'multi-headed' : last === 'pointed' || last === 'rayed' ? 'points' : last;
    return { lem: word, e: { k: 'mod', v } };
  }
  const tail = lemma(last);
  if (!tail) return null;
  const e = LEX.get(tail)!;
  if (parts[0] === 'counter' && (e.k === 'posture' || e.k === 'gapPosture')) return { lem: word, e: { k: 'gapPosture', v: word } };
  // "dragon-tongue", "eagles-cut": a compound noun we don't know, not its last word
  if (e.k === 'qual' || e.k === 'skip') return null;
  return { lem: tail, e };
}

// ── Tagging ───────────────────────────────────────────────────────────────────

type Ctx = 'field' | 'on' | 'between' | 'held' | 'of' | 'semy' | 'overall';
interface Element {
  kind: 'charge' | 'ord';
  /** ChargeId / OrdinaryType when the widget has it, else null. */
  supported: string | null;
  count: number;
  ctx: Ctx;
  host: Element | null;
  /** A layout key the blazon words: "in-pale", "rows-2-1", "in-chief"; "in-canton" for charges set in canton beside the primary. */
  arr: string | null;
}

/** Where charges stand when the blazon sets them beside the primary ("and in chief three mullets"), by their `arr`. */
const SECONDARY_POSITION_OF: Readonly<Record<string, 'chief' | 'base' | 'canton'>> = { 'in-chief': 'chief', 'in-base': 'base', 'in-canton': 'canton' };

/** Where charges stand in a half or quarter of the field ("in dexter", "in sinister chief"), by their `arr`. */
const HALF_POSITION_OF: Readonly<Record<string, HalfPosition>> = Object.fromEntries(HALF_POSITIONS.map((p) => [`in-${p}`, p]));

const ARTICLES = new Set(['a', 'an', 'the', 'each', 'one', 'two', 'three', 'four', 'five', 'six', 'its', 'his', 'her']);

/**
 * Gap tags for one O&A armory record: sorted, unique. Empty only when every word was recognised and
 * nothing in it is beyond the widget (such a record should be matchable); never empty otherwise.
 */
export function tagGaps(record: ArmoryRecord): string[] {
  return tagBlazon(record.blazon, record.headings);
}

function tagBlazon(blazon: string, headings: readonly string[]): string[] {
  const unknownOut: string[] = []; // the words not recognised
  const tags = new Set<string>();
  const tag = (cat: GapCategory, sub?: string) => tags.add(sub ? `${cat}:${sub}` : cat);
  const { tokens, fieldless } = tokenise(blazon);
  if (fieldless) tag('fieldless');

  const els: Element[] = [];
  let inField = !fieldless; // until the first charge, ordinary or count
  let divisions = 0;
  let pendingCount: number | null = null;
  let pendingArr: string | null = null;
  let last: { kind: 'charge' | 'ord' | 'div'; el: Element | null; name: string } | null = null;
  let onHost: Element | null = null; // "on a fess …": later groups lie on it
  let betweenHost: Element | null = null; // "a fess between …": the next group surrounds it
  let held = false; // inside "maintaining …" / "in its beak …"
  let ofNext = false; // "a wreath of laurel": the next noun is material, not a group
  let semyNext = false; // "semy of mullets"
  let semyOnField = false; // … strewn on the field rather than on a charge
  let possBase: { lem: string; e: Entry } | null = null;
  let pendingOnHost = false; // after "on a": the next element is the host
  let qualifier: string | null = null; // the first noun of "oak tree"
  let untincturedOrd = false; // an ordinary still awaiting its tincture: a later "counterchanged" covers it too
  let overallNext = false; // after "overall": the next element lies across everything

  const words = tokens.map((t) => t.word);
  const look = (i: number) => (i >= 0 && i < tokens.length && words[i] !== BREAK ? lookup(words[i]) : null);
  const isNounEntry = (e: Entry | undefined) => !!e && (e.k === 'charge' || e.k === 'gapCharge' || e.k === 'cross' || e.k === 'ord' || e.k === 'gapOrd');

  const newElement = (kind: 'charge' | 'ord', supported: string | null): Element => {
    const ctx: Ctx = held ? 'held' : ofNext ? 'of' : semyNext ? 'semy' : overallNext ? 'overall' : betweenHost ? 'between' : onHost ? 'on' : 'field';
    const el: Element = { kind, supported, count: pendingCount ?? 1, ctx, host: ctx === 'between' ? betweenHost : ctx === 'on' ? onHost : null, arr: null };
    if (kind === 'charge' && ctx !== 'held' && ctx !== 'of') {
      if (pendingArr) { el.arr = pendingArr; pendingArr = null; }
      if (el.count > MAX_DRAWN_COUNT && el.count < 99) tag('count', String(el.count));
      if (el.count === 99) tag('count', 'many');
      if (ctx === 'semy' && !semyOnField) tag('count', 'semy');
    }
    if (ctx === 'between') betweenHost = null;
    if (kind === 'ord') untincturedOrd = true;
    pendingCount = null; ofNext = false; semyNext = false; overallNext = false; inField = false;
    els.push(el);
    last = { kind, el, name: supported ?? '' };
    return el;
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.word === BREAK) { held = false; pendingCount = null; ofNext = false; possBase = null; pendingOnHost = false; continue; }
    if (tok.word === 'overall') {
      overallNext = true; onHost = null; betweenHost = null; pendingOnHost = false; inField = false;
      continue;
    }
    const found = lookup(tok.word);
    if (!found && tok.poss) continue; // "a smith's hammer", "Thor's hammer": a qualifier
    if (!found) {
      if (/^[a-z]$/.test(tok.word)) continue; // letters ("a letter S")
      unknownOut.push(tok.word);
      possBase = null;
      continue;
    }
    const { lem, e } = found;
    if (found.extra?.k === 'mod') tag('charge-modifier', found.extra.v);
    const prev = i > 0 ? words[i - 1] : BREAK;

    // A possessive: "a wolf's head" (compound charge) or "a smith's hammer" (just a qualifier).
    if (tok.poss && (e.k === 'charge' || e.k === 'gapCharge')) {
      const next = look(i + 1);
      if (next && PARTS.has(next.lem)) possBase = found;
      continue;
    }
    if (possBase && PARTS.has(lem)) {
      const base = possBase.e;
      const bucket: ChargeBucket = base.k === 'gapCharge' ? base.b : base.k === 'charge' ? SUPPORTED_CHARGE_BUCKET[base.id] : 'human';
      const baseName = base.k === 'charge' ? base.id : possBase.lem;
      const partName = lem === 'skull' && baseName === 'death' ? 'skull' : `${baseName}-${lem}`;
      tag(`charge-${bucket}`, partName);
      possBase = null;
      newElement('charge', null);
      continue;
    }
    possBase = null;

    switch (e.k) {
      case 'qual': break;
      case 'skip':
        // "a mullet azure and another gules", "on a cross argent another gules": a second group or ordinary
        if (lem === 'another' && last && last.el) newElement(last.el.kind, last.el.supported);
        // "a unicorn argent charged with a heart", "three flames each charged with a heart": the groups after lie on the one before
        else if (lem === 'charged' && words[i + 1] === 'with' && last?.el) onHost = last.el;
        break;
      case 'and':
        // "maintaining a sword and a key" vs "… a sword, and in chief …": a new clause ends a held phrase
        if (held && /^(on|in|within|overall|all)$/.test(words[i + 1] ?? '')) held = false;
        break;
      case 'num': {
        // "two and one", "three, two and one": an arrangement, not a count
        const seq = [e.n];
        let j = i + 1;
        for (;;) {
          const k = words[j] === BREAK && words[j + 1] === 'and' ? j + 1 : j; // "2, 2, and 1"
          if ((words[k] !== 'and' && words[k] !== BREAK) || (NUMBERS[words[k + 1] ?? ''] ?? 9) > 6 || /^(a|an)$/.test(words[k + 1])) break;
          seq.push(NUMBERS[words[k + 1]]); j = k + 2;
        }
        const after = look(j);
        if (seq.length > 1 && !/^(a|an)$/.test(tok.word) && !(after && isNounEntry(after.e))) {
          readNumberArrangement(seq);
          i = j - 1;
          break;
        }
        if (prev === 'of' && last) {
          // "a mullet of six points", "gyronny of eight", "quarterly of six"
          ofNext = false;
          const next = look(i + 1);
          if (last.kind === 'div' && last.name === 'quarterly' && !next) tag('division', 'quarterly-of-n');
          // "a mullet of five greater and five lesser points"
          const pointsSoon = words.slice(i + 1, i + 6).some((x) => /^(points|rays)$/.test(x));
          if (last.kind === 'charge' && pointsSoon) tag('charge-modifier', 'points');
          if (next && /^(point|ray|arm|petal|spoke|lobe|tine|piece|tower|head|leaf|link|step|arch|span|peak)s?$/.test(next.lem)) {
            if (last.kind === 'charge') tag('charge-modifier', /^(point|ray)s?$/.test(next.lem) ? 'points' : next.lem.replace(/s$/, ''));
            i++;
            break;
          }
        }
        pendingCount = e.n;
        break;
      }
      case 'tinc': ofNext = false; untincturedOrd = false; break;
      case 'cc':
        // "a bordure counterchanged", "a chevron between three bees counterchanged" (tinctures factor
        // backward): the widget's ordinaries take a single tincture
        if (untincturedOrd || (last?.kind === 'ord' && last.el === els[els.length - 1] && look(i - 1)?.e.k !== 'tinc')) tag('tincture', 'counterchanged-ordinary');
        // "a heart counterchanged vert and argent": each part of the charge its own tincture
        if (look(i + 1)?.e.k === 'tinc' && words[i + 2] === 'and' && look(i + 3)?.e.k === 'tinc') tag('tincture', 'party');
        untincturedOrd = false;
        break;
      case 'proper': tag('proper'); break;
      case 'tincGap': tag('tincture', e.v); break;
      case 'fur':
        if (lem === 'ermine' && /^(a|an|two|three|four|five|six)$/.test(prev)) { tag('charge-beast', 'ermine'); settleHost(newElement('charge', null)); break; }
        if (lem === 'potenty' && (last?.kind === 'ord' || last?.kind === 'div') && look(i - 1)?.e.k !== 'tinc') tag('line-of-partition', 'potenty');
        else if (lem === 'potent' && /^cross/.test(prev)) break;
        else tag('fur', e.v);
        break;
      case 'line': {
        const next = look(i + 1)?.e.k;
        if (next === 'charge' || next === 'gapCharge') tag('charge-modifier', lem); // "an embattled coronet"
        else tag('line-of-partition', e.v);
        break;
      }
      case 'treat': tag('field-treatment', e.v); break;
      case 'semy':
        if (inField) tag('field-treatment', 'semy'); else tag('count', 'semy');
        if (words[i + 1] === 'of') { semyNext = true; semyOnField = inField; i++; }
        break;
      case 'gapDiv':
        if (!inField) { tag('tincture', 'party'); break; } // "a roundel gyronny"
        tag('division', e.v);
        divisions++;
        last = { kind: 'div', el: null, name: e.v };
        break;
      case 'per': {
        let j = i + 1;
        const parts: string[] = [];
        while (j < tokens.length) {
          const l = lemma(words[j]) ?? words[j];
          if (['pale', 'fess', 'fesse', 'bend', 'bend-sinister', 'saltire', 'chevron', 'pall', 'pile', 'cross', 'quarterly'].includes(l)) { parts.push(l === 'fesse' ? 'fess' : l); j++; }
          else break;
          if (words[j] === 'and' && words[j + 1] !== 'per' && lemma(words[j + 1] ?? '') && ['pale', 'fess', 'bend', 'chevron', 'saltire'].includes(lemma(words[j + 1])!)) j++;
        }
        if (!parts.length) break;
        const name = `per-${parts.join('-and-')}`;
        i = j - 1;
        if (!inField && (els.length || fieldless)) { tag('tincture', 'party'); break; } // "a bend per bend azure and argent"
        if (prev !== 'quarterly') { // "quarterly per fess indented" is one division
          divisions++;
          if (divisions > 1 || parts.length > 1) tag('division', 'compound');
          else if (!['per-pale', 'per-fess', 'per-bend', 'per-bend-sinister', 'per-saltire', 'per-chevron'].includes(name)) tag('division', name);
        }
        last = { kind: 'div', el: null, name };
        break;
      }
      case 'quarterly':
        if (!inField && (els.length || fieldless)) { tag('tincture', 'party'); break; } // "a bordure quarterly"
        divisions++;
        if (divisions > 1) tag('division', 'compound');
        if (/^(i|1|first)$/.test(words[i + 1] ?? '') || /^(i|1|first)$/.test(words[i + 2] ?? '')) tag('marshalling', 'quartering');
        last = { kind: 'div', el: null, name: 'quarterly' };
        break;
      case 'marshal':
        if (lem === 'arms' && words[i + 1] !== 'of') break;
        tag('marshalling', e.v);
        break;
      case 'posture': {
        // "a wolf courant": the widget's wolf has no courant (only its hare does)
        const c = last?.kind === 'charge' ? last.el?.supported as ChargeId | null : null;
        if (c && !POSTURE_WORDS[c].has(lem === 'hauriant' ? 'haurient' : lem)) tag('posture', lem);
        break;
      }
      case 'gapPosture':
        if (e.v === 'close' && /^(couped|erased)$/.test(prev)) break; // "couped close"
        tag('posture', e.v);
        break;
      case 'orient':
        // "engrailed to chief and invected to base" describes the lines, not a charge
        if (/^to-/.test(lem) && (look(i - 1)?.e.k === 'line' || look(i - 2)?.e.k === 'line' || words[i - 1] === 'elongated')) break;
        if (prev === 'parted') break; // "a bordure parted bordurewise"
        tag('orientation', e.v);
        break;
      case 'mod':
        tag('charge-modifier', e.v);
        if ((e.v === 'maintaining' && !/ed$/.test(tok.word)) || e.v === 'wearing') held = true;
        // "crowned of a coronet", "gorged with a chaplet": the crown is part of the charge
        if (/^(crowned|gorged|collared)$/.test(e.v) && /^(of|with)$/.test(words[i + 1] ?? '')) { held = true; i++; }
        break;
      case 'ctx': contextWord(lem, i); break;
      case 'container':
        if (words[i + 1] === 'of') { i++; break; }
        if (lem === 'sheaf') { tag('charge-plant', 'garb'); newElement('charge', null); }
        break;
      case 'of':
        if (last && (last.kind === 'charge' || last.kind === 'ord') && look(i + 1)) ofNext = true;
        break;
      case 'on': {
        // "on a fess …", "on each …"
        const next = look(i + 1);
        if (next && ARTICLES.has(words[i + 1])) { onHost = null; pendingOnHost = true; inField = false; }
        break;
      }
      case 'between':
        if (last && last.el) betweenHost = last.el;
        break;
      case 'in': i = readIn(i); break;
      case 'cross': i = readCross(i); break;
      case 'charge': {
        if (descriptor(i) || qualifies(i)) break;
        if (qualifier) { compound(qualifier, lem, SUPPORTED_CHARGE_BUCKET[e.id]); break; }
        settleHost(newElement('charge', e.id));
        break;
      }
      case 'gapCharge': {
        if (descriptor(i) || qualifies(i)) break;
        if (lem === 'annulet' && words[i + 1] === 'of') { tag('arrangement', 'in-annulo'); i++; break; } // "an annulet of dolphins"
        if (qualifier) { compound(qualifier, lem, e.b); break; }
        tag(`charge-${e.b}`, e.v);
        settleHost(newElement('charge', null));
        break;
      }
      case 'ord': readOrdinary(i, e.v); break;
      case 'gapOrd': i = readGapOrdinary(i, e.v); break;
    }
  }

  // Charge groups and ordinaries: the widget has room for one charge group, and for a central ordinary with a chief and a bordure beside it.
  const overalls = els.filter((el) => el.ctx === 'overall');
  // What lies overall is judged on its own, with what is on it (the widget draws no charges on a group overall).
  const onOverall = (el: Element) => el.ctx === 'on' && el.host?.ctx === 'overall';
  const groups = els.filter((el) => el.kind === 'charge' && el.ctx !== 'held' && el.ctx !== 'of' && el.ctx !== 'semy' && el.ctx !== 'overall' && !onOverall(el));
  const ords = els.filter((el) => el.kind === 'ord' && el.ctx !== 'overall' && !onOverall(el));
  if (els.some(onOverall)) tag('multiple-groups', 'tertiary-on-overall');
  const together = drawnTogether(ords);
  if (groups.length > 1 && !(groups.length === 2 && (checkAround(groups[0], groups[1], ords) || checkBeside(groups[0], groups[1], ords) || checkOnCharge(groups[0], groups[1], ords) || checkTogether(groups[0], groups[1], ords)))) {
    if (!checkSeveralTogether(groups, ords)) tag('multiple-groups', 'charges');
  }
  if (ords.length > 1 && !together) tag('multiple-groups', 'ordinaries');
  if (overalls.length > 0) checkOverall(overalls, groups, ords);
  else if (groups.length === 1 && ords.length <= 1) checkPlacement(groups[0], ords[0] ?? null);

  if (!tags.size && unknownOut.length) {
    const fromHeadings = headingBuckets(headings);
    for (const b of fromHeadings) tag(`charge-${b}`);
  }
  // a divided field alone is a legal design; a plain one alone is not registrable
  if (!tags.size && (unknownOut.length || (!els.length && !divisions))) tag('other');
  return [...tags].sort();

  // ── helpers (closures over the reading state) ──

  /**
   * A noun with no count before it describes part of the last charge ("wings elevated", "stems
   * crossed", "heads to center") unless a preposition or "of"/"semy of" introduces it ("issuant from
   * clouds", "a chaplet of roses").
   */
  function descriptor(i: number): boolean {
    if (pendingCount !== null || qualifier || ofNext || semyNext || held || !last) return false;
    if (PARTS.has(lookup(words[i])!.lem)) return true; // "with hands clasped", "wings addorsed"
    let j = i - 1;
    while (j >= 0 && look(j)?.e.k === 'qual') j--; // "charged with Hebrew letters"
    const before = j >= 0 ? words[j] : BREAK;
    // "on a pale Or the letter R", but not "conjoined at the stems"
    if (before === 'the') return !(look(j - 1)?.e.k === 'tinc' || /^(on|and|with|between|within|\|)$/.test(j > 0 ? words[j - 1] : BREAK));
    return !/^(from|with|by|of|on|upon|between|within|and|in|to|overall|surmounting|debruising)$/.test(before);
  }

  /** "an oak tree", "a fish skeleton": a noun directly before another noun qualifies it. */
  function qualifies(i: number): boolean {
    const next = tokens[i + 1];
    const n = next && !next.poss ? look(i + 1) : null;
    if (!n || (n.e.k !== 'charge' && n.e.k !== 'gapCharge') || PARTS.has(n.lem) || lookup(words[i])!.lem !== words[i]) return false;
    qualifier = lookup(words[i])!.lem;
    return true;
  }

  /** One compound charge ("oak-tree") in the head noun's bucket. */
  function compound(q: string, head: string, bucket: ChargeBucket): void {
    qualifier = null;
    tag(`charge-${bucket}`, `${q}-${head}`);
    settleHost(newElement('charge', null));
  }

  function settleHost(el: Element): void {
    if (pendingOnHost) { onHost = el; pendingOnHost = false; el.ctx = el.ctx === 'on' ? 'field' : el.ctx; }
  }

  function readNumberArrangement(seq: number[]): void {
    const arr = ROW_PATTERNS.some((r) => r.join('-') === seq.join('-')) ? `rows-${seq.join('-')}` : undefined;
    const total = seq.reduce((a, b) => a + b, 0);
    const target = last?.kind === 'charge' && last.el?.ctx !== 'held' ? last.el : null;
    if (arr && target && target.count === total) { if (!target.arr) target.arr = arr; return; }
    if (arr && !target) { pendingArr = arr; return; }
    const word = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    tag('arrangement', seq.map((n) => word[n]).join('-and-'));
  }

  function contextWord(word: string, i: number): void {
    const base = word.replace(/^(cotissed|double-cotised|triple-cotised)$/, 'cotised').replace(/^fimbriate$/, 'fimbriated')
      .replace(/^humetty$/, 'couped').replace(/^(fitched)$/, 'fitchy');
    // only straight after the division's own words: "per chevron (embattled) inverted"
    const p = look(i - 1)?.e.k;
    if (last?.kind === 'div' && (p === 'ord' || p === 'gapOrd' || p === 'gapDiv' || p === 'cross' || p === 'line' || p === 'ctx' || p === 'quarterly')) {
      tag('division', `${last.name}-${base.replace(/^arrondy$/, 'arrondi')}`); // "per chevron inverted", "per saltire arrondi"
      return;
    }
    if (last?.kind === 'ord' && last.el === els[els.length - 1]) {
      if (base === 'throughout' && last.el?.supported) return; // the widget's ordinaries are throughout
      tag('ordinary-treatment', base);
      return;
    }
    if (base === 'inverted') tag('orientation', base);
    else tag('charge-modifier', base);
  }

  function readOrdinary(i: number, type: OrdinaryType): void {
    if (/^(to|from|in|dexter|sinister)$/.test(i > 0 ? words[i - 1] : BREAK)) return; // "issuant from (dexter) chief": a place
    const count = pendingCount ?? 1;
    const el = newElement('ord', type);
    if (count > 1) tag('ordinary', 'multiple');
    settleHost(el);
  }

  /** A sub-ordinary the widget lacks, unless it names a place ("in base") or an arrangement ("an orle of …"); returns the last token read. */
  function readGapOrdinary(i: number, name: string): number {
    const prev = i > 0 ? words[i - 1] : BREAK;
    const article = ARTICLES.has(prev) || look(i - 1)?.e.k === 'num' || (/^(dexter|sinister)$/.test(prev) && ARTICLES.has(words[i - 2] ?? ''));
    if (/^(base|point|chief|canton|quarter|mount|flank|fess-point)$/.test(name) && !article) return i;
    if (/^(to|from|in)$/.test(prev)) return i;
    if ((name === 'orle' || name === 'tressure') && words[i + 1] === 'of') { tag('arrangement', 'in-orle'); return i + 1; }
    if (name === 'point' && words[i + 1] === 'of') return i; // "the point of intersection"
    tag('ordinary', name);
    settleHost(newElement('ord', null));
    return i;
  }

  /** "in pale", "in chief", "in annulo", "in its beak" … at token i (= "in"); returns the last token consumed. */
  function readIn(i: number): number {
    const a = words[i + 1] ?? BREAK;
    const al = lemma(a) ?? a;
    if (/^(its|his|her|their|the)$/.test(a)) {
      const b = lemma(words[i + 2] ?? '') ?? '';
      if (/^(beak|mouth|jaw|claw|talon|paw|forepaw|hand|teeth|tooth|tail|dexter|sinister|grasp|clutch|arm|foot|hoof|tusk|horn|trunk)$/.test(b)) {
        held = true; tag('charge-modifier', 'maintaining');
        return /^(dexter|sinister)$/.test(b) && PARTS.has(lemma(words[i + 3] ?? '') ?? '') ? i + 3 : i + 2; // "in the dexter paw"
      }
      if (/^(chief|base|canton|flank|dexter|sinister|center|centre|middle|first|second|third|fourth)$/.test(b)) {
        tag('arrangement', `in-${b === 'centre' ? 'center' : b}`); return i + 2;
      }
      return i;
    }
    /** The arrangement the words at `i` name goes to the charges before it ("three roses in pale"), or to those after ("and in chief", "between in fess two roses"). */
    const attach = (arr: string): void => {
      const before = look(i - 1)?.e.k;
      const prevEl = last?.kind === 'charge' && last.el && last.el.ctx !== 'held' && words[i - 1] !== BREAK && before !== 'and' && before !== 'between' ? last.el : null;
      if (prevEl && !prevEl.arr) prevEl.arr = arr; else pendingArr = arr;
    };
    if (SUPPORTED_ARRANGEMENT_WORDS[al]) {
      if (words[i + 2] === 'point' || words[i + 2] === 'fess-point') { tag('arrangement', 'in-fess-point'); return i + 2; }
      attach(SUPPORTED_ARRANGEMENT_WORDS[al]);
      return i + 1;
    }
    if (GAP_ARRANGEMENTS[al]) {
      // "in chevron inverted": the inversion belongs to the arrangement
      if (words[i + 2] === 'inverted') { tag('arrangement', `${GAP_ARRANGEMENTS[al]}-inverted`); return i + 2; }
      tag('arrangement', GAP_ARRANGEMENTS[al]);
      return i + 1;
    }
    if (POSITIONS.has(al)) {
      const b = words[i + 2] ?? '';
      if ((al === 'dexter' || al === 'sinister') && /^(talon|claw|paw|forepaw|hand|foot|mouth|beak|hoof)s?$/.test(b)) {
        held = true; tag('charge-modifier', 'maintaining'); return i + 2; // "maintaining in sinister talon a dagger"
      }
      // "in dexter", "in sinister chief": a half or quarter of the field.
      if (al === 'dexter' || al === 'sinister') {
        const quarter = /^(chief|base)$/.test(b);
        if (quarter || !/^(canton|flank|point)$/.test(b)) { attach(`in-${al}${quarter ? `-${b}` : ''}`); return quarter ? i + 2 : i + 1; }
        tag('arrangement', `in-${b}`);
        return i + 2;
      }
      // "a lion and in canton a mullet": charges set in canton beside the primary
      if (al === 'canton' && look(i - 1)?.e.k === 'and' && last?.el && last.el.ctx === 'field') { pendingArr = 'in-canton'; return i + 1; }
      tag('arrangement', `in-${al === 'centre' ? 'center' : al}`);
      return i + 1;
    }
    if (/^(full|action|flight|chains?|bloom|leaf|flower|splendor|splendour)$/.test(al)) return i + 1;
    return i;
  }

  /** "a cross" (the ordinary) vs. "a cross formy", "a Maltese cross", "three crosses" (charges); returns the last token read. */
  function readCross(i: number): number {
    const prev = i > 0 ? words[i - 1] : BREAK;
    let variant: string | null = null;
    let end = i;
    if (CROSS_BEFORE.has(prev)) variant = CROSS_VARIANT[prev] ?? prev;
    const next = words[i + 1] ?? BREAK;
    if (!variant && CROSS_AFTER.has(next)) { variant = CROSS_VARIANT[next] ?? next; end = i + 1; }
    if (!variant && next === 'of' && words[i + 2] && words[i + 2] !== BREAK) {
      const what = words[i + 2];
      if (NUMBERS[what]) variant = 'composed'; // "a cross of four lozenges"
      else { variant = CROSS_VARIANT[what] ?? what; end = i + 2; }
    }
    if (!variant && (pendingCount ?? 1) > 1) variant = 'cross';
    if (variant) {
      tag('charge-cross', variant);
      settleHost(newElement('charge', null));
      if (variant === 'composed') { ofNext = true; end = i + 1; }
      return end;
    }
    settleHost(newElement('ord', 'cross'));
    return i;
  }

  /**
   * Whether the widget draws the second of two charge groups as set in chief, in base or in canton beside the first
   * (SENA App I1), with the ordinaries: asks the library, on a stand-in design, and tags the gaps it would have. False when
   * the second group isn't set by position, so the two are tagged as two charge groups.
   */
  function checkBeside(first: Element, second: Element, ordinaries: readonly Element[]): boolean {
    const position = second.ctx === 'field' && second.arr ? SECONDARY_POSITION_OF[second.arr] : undefined;
    // The first group lies on the field (alone, or between an ordinary) or on one of the ordinaries.
    const onOrdinary = first.ctx === 'on' && first.host !== null && ordinaries.includes(first.host);
    if (!position || (first.ctx !== 'field' && !onOrdinary) || (first.arr && SECONDARY_POSITION_OF[first.arr]) || ordinaries.some((o) => !o.supported || o.count > 1)) return false;
    if (first.count > MAX_DRAWN_COUNT || second.count > MAX_DRAWN_COUNT) return true;
    // Stand-ins of two different charges where the blazon's aren't the widget's (the same charge twice is a rule, not a gap).
    const a = first.supported ?? 'lion';
    const b = second.supported && second.supported !== a ? second.supported : a === 'mullet' ? 'rose' : 'mullet';
    const firstGroup = { item: { k: 'charge', charge: a }, paint: 'or', count: first.count, ...(first.arr && !onOrdinary ? { arrangement: first.arr } : {}) };
    const groups = [
      ...(onOrdinary ? [] : [firstGroup]),
      { item: { k: 'charge', charge: b }, paint: 'argent', count: second.count, position },
      ...ordinaries.map((o) => ({ item: { k: 'ordinary', type: o.supported }, paint: 'gules', ...(o === first.host ? { charged: [firstGroup] } : {}) })),
    ];
    const r = resolve({ v: 2, field: 'azure', groups });
    if (!r.ok) return true;
    const gaps = unsupportedIssues(r.design);
    for (const i of gaps) tag(i.gap.category, i.gap.detail);
    // No room for them beside the first (the library's capacity and layout rules), as the armorial test files a matched design.
    const at = walkGroups(r.design).find((w) => w.group.relation === 'position');
    if (!gaps.length && at && structuralIssues(r.design).some((i) => i.code === 'structure' && i.at.k === 'group' && i.at.path.join() === at.path.join())) {
      tag('placement', `in-${position}-${second.count}`);
    }
    return true;
  }

  /**
   * Whether the widget draws the second of two charge groups as set around the first (SENA App I1: "a lion between three
   * mullets"), with a chief or bordure beside them: asks the library, on a stand-in design, and tags the gaps it would have
   * (more than two primary charges, a count with no layout around them) or that the charges have no room. False when the
   * second group isn't set between the first, so the two are tagged as two charge groups.
   */
  function checkAround(first: Element, second: Element, ordinaries: readonly Element[]): boolean {
    if (first.ctx !== 'field' || second.ctx !== 'between' || second.host !== first) return false;
    if (ordinaries.some((o) => !o.supported || o.count > 1 || ORDINARY_KIND[o.supported as OrdinaryType] === 'central')) return false;
    if (first.count > MAX_DRAWN_COUNT || second.count > MAX_DRAWN_COUNT) return true;
    // Stand-ins of two different charges where the blazon's aren't the widget's (the same charge twice is a rule, not a gap).
    const a = first.supported ?? 'sword';
    const b = second.supported && second.supported !== a ? second.supported : a === 'mullet' ? 'rose' : 'mullet';
    // "two swords in saltire": two long charges crossed.
    const arrangement = first.arr === 'in-saltire' && first.count === 2 && CHARGES[a as ChargeId].long ? 'crossed' : first.arr;
    const groups = [
      { item: { k: 'charge', charge: a }, paint: 'or', count: first.count, ...(arrangement ? { arrangement } : {}) },
      { item: { k: 'charge', charge: b }, paint: 'argent', count: second.count, relation: 'between', ...(second.arr ? { arrangement: second.arr } : {}) },
      ...ordinaries.map((o) => ({ item: { k: 'ordinary', type: o.supported }, paint: 'gules' })),
    ];
    const r = resolve({ v: 2, field: 'azure', groups });
    if (!r.ok) return true;
    const gaps = unsupportedIssues(r.design);
    for (const i of gaps) tag(i.gap.category, i.gap.detail);
    // No room for them around the first, or a layout they don't take there (the library's capacity and layout rules).
    const at = walkGroups(r.design).filter((w) => w.group.role === 'primary' || w.group.role === 'secondary').map((w) => w.path.join());
    if (!gaps.length && structuralIssues(r.design).some((i) => i.code === 'structure' && i.at.k === 'group' && at.includes(i.at.path.join()))) {
      tag('placement', `around-${second.count}`);
    }
    return true;
  }

  /**
   * Whether the widget draws two charge groups on the field as together the main picture ("a unicorn and a rose", SENA App I1), with
   * a chief or bordure beside them: asks the library, on a stand-in design, and tags the gaps it would have (more than three charges) or
   * the arrangement they don't take together. False when either is not a plain group on the field (set between, on or beside something).
   */
  function checkTogether(first: Element, second: Element, ordinaries: readonly Element[]): boolean {
    const placed = (g: Element) => g.ctx === 'field' && !(g.arr && SECONDARY_POSITION_OF[g.arr]);
    if (!placed(first) || !placed(second)) return false;
    if (ordinaries.some((o) => !o.supported || o.count > 1 || ORDINARY_KIND[o.supported as OrdinaryType] === 'central')) return false;
    if (first.count > MAX_DRAWN_COUNT || second.count > MAX_DRAWN_COUNT) return true;
    // Stand-ins of two different charges where the blazon's aren't the widget's (the same charge twice is a rule, not a gap).
    const a = first.supported ?? 'lion';
    const b = second.supported && second.supported !== a ? second.supported : a === 'mullet' ? 'rose' : 'mullet';
    const arrangement = first.arr ?? second.arr;
    const groups = [
      { item: { k: 'charge', charge: a }, paint: 'or', count: first.count, ...(arrangement ? { arrangement } : {}) },
      { item: { k: 'charge', charge: b }, paint: 'argent', count: second.count, ...(arrangement ? { arrangement } : {}) },
      ...ordinaries.map((o) => ({ item: { k: 'ordinary', type: o.supported }, paint: 'gules' })),
    ];
    const r = resolve({ v: 2, field: 'azure', groups });
    if (!r.ok) { if (arrangement) tag('arrangement', arrangement); return true; }
    const gaps = unsupportedIssues(r.design);
    for (const i of gaps) tag(i.gap.category, i.gap.detail);
    // A layout the pair doesn't take together, or no room for them (the library's layout and capacity rules).
    const main = walkGroups(r.design).filter((w) => w.group.role === 'primary').map((w) => w.path.join());
    if (!gaps.length && structuralIssues(r.design).some((i) => i.code === 'structure' && i.at.k === 'group' && main.includes(i.at.path.join()) && i.rule !== 'same-type')) {
      if (arrangement) tag('arrangement', arrangement); else tag('placement', `co-primary-${first.count + second.count}`);
    }
    return true;
  }

  /** Three or more charge groups on the field, none set beside or around: more main groups than the widget draws together. */
  function checkSeveralTogether(all: readonly Element[], ordinaries: readonly Element[]): boolean {
    if (!all.every((g) => g.ctx === 'field' && !(g.arr && SECONDARY_POSITION_OF[g.arr]))) return false;
    if (ordinaries.some((o) => !o.supported || o.count > 1 || ORDINARY_KIND[o.supported as OrdinaryType] === 'central')) return false;
    tag('multiple-groups', 'co-primary-3');
    return true;
  }

  /**
   * Whether the widget draws the second of two charge groups as set on the first ("on a heart argent a lion azure", SENA App I3),
   * with a chief or bordure beside them: asks the library, on a stand-in design, and tags the gaps it would have (a charge with
   * no room for charges on it, a count it has no layout for) or that they have no room. False when the second isn't on the
   * first, so the two are tagged as two charge groups.
   */
  function checkOnCharge(first: Element, second: Element, ordinaries: readonly Element[]): boolean {
    if (first.ctx !== 'field' || second.ctx !== 'on' || second.host !== first) return false;
    if (ordinaries.some((o) => !o.supported || o.count > 1 || ORDINARY_KIND[o.supported as OrdinaryType] === 'central')) return false;
    if (first.count > MAX_DRAWN_COUNT || second.count > MAX_DRAWN_COUNT) return true;
    const host = first.supported ?? 'lion';
    const carried = { item: { k: 'charge', charge: second.supported ?? 'mullet' }, paint: 'argent', count: second.count, ...(second.arr ? { arrangement: second.arr } : {}) };
    const groups = [
      { item: { k: 'charge', charge: host }, paint: 'or', count: first.count, ...(first.arr ? { arrangement: first.arr } : {}), charged: [carried] },
      ...ordinaries.map((o) => ({ item: { k: 'ordinary', type: o.supported }, paint: 'gules' })),
    ];
    const r = resolve({ v: 2, field: 'azure', groups });
    if (!r.ok) return true;
    const gaps = unsupportedIssues(r.design);
    for (const i of gaps) tag(i.gap.category, i.gap.detail);
    // No room for them on the first (a charge the widget has: room depends on its drawing), or a layout they don't take there (the library's capacity and layout rules).
    if (!gaps.length && first.supported !== null && structuralIssues(r.design).some((i) => i.code === 'structure' && i.at.k === 'group' && i.at.path.length === 2)) {
      tag('placement', `on-charge-${second.count}`);
    }
    return true;
  }

  /**
   * Whether the widget draws a group lying across everything ("a fess and overall a lion", SENA App I4), with a chief or bordure
   * beside them: asks the library, on a stand-in design, and tags the gaps it would have (an ordinary that doesn't cross the middle,
   * a count with no layout) or the rule it breaks (the overall group or the one it lies over must be a band or a long charge).
   * Several overall groups, or none or several to lie over, are tagged as the groups they are.
   */
  function checkOverall(over: readonly Element[], onField: readonly Element[], ordinaries: readonly Element[]): void {
    const central = ordinaries.filter((o) => o.supported && ORDINARY_KIND[o.supported as OrdinaryType] === 'central');
    // The main group is the charges on the field (those set in chief, base or canton only when nothing else is) or the central ordinary;
    // charges set between or on it are judged with it (above), not here.
    const field = onField.filter((g) => g.ctx === 'field');
    const unpositioned = field.filter((g) => !(g.arr && SECONDARY_POSITION_OF[g.arr]));
    const mains = [...(unpositioned.length > 0 ? unpositioned : field), ...central];
    if (over.length > 1) tag('multiple-groups', 'overall');
    // An ordinary the widget lacks has its own tag; this one is for a design the widget can't draw for its groups.
    if (over.length > 1 || mains.length !== 1 || ordinaries.some((o) => !o.supported || o.count > 1)) {
      if (mains.length !== 1 && over.length === 1 && !ordinaries.some((o) => !o.supported)) tag('multiple-groups', mains.length === 0 ? 'overall-no-primary' : 'overall-over-groups');
      return;
    }
    const [o] = over;
    if (o.count > MAX_DRAWN_COUNT) return;
    // A single charge in an arrangement ("a dragon in annulo") has none to take.
    if (o.kind === 'charge' && o.count === 1 && o.arr) { tag('arrangement', o.arr); return; }
    const [primary] = mains;
    // A stand-in charge where the blazon's isn't the widget's: a long one if the blazon's is unknown, so the rule is not blamed for a charge we can't judge.
    const stand = (el: Element, other: Element): { k: string; charge?: string; type?: string } => (el.kind === 'ord'
      ? { k: 'ordinary', type: el.supported! }
      : { k: 'charge', charge: el.supported ?? (other.supported === 'sword' ? 'key' : 'sword') });
    const wrap = (el: Element, other: Element, extra: object) => ({ item: stand(el, other), paint: 'or', count: el.count, ...(el.arr ? { arrangement: el.arr === 'in-saltire' && el.count === 2 ? 'crossed' : el.arr } : {}), ...extra });
    const groups = [
      wrap(primary, o, {}),
      wrap(o, primary, { role: 'overall', paint: 'argent' }),
      ...ordinaries.filter((x) => !central.includes(x)).map((x) => ({ item: { k: 'ordinary', type: x.supported }, paint: 'gules' })),
    ];
    const r = resolve({ v: 2, field: 'azure', groups });
    if (!r.ok) return;
    const gaps = unsupportedIssues(r.design);
    for (const i of gaps) tag(i.gap.category, i.gap.detail);
    const at = walkGroups(r.design).find((w) => w.group.role === 'overall')!.path.join();
    if (!gaps.length && primary.supported && o.supported && structuralIssues(r.design).some((i) => i.code === 'structure' && i.at.k === 'group' && i.at.path.join() === at)) {
      tag('placement', 'overall');
    }
  }

  /**
   * Whether the widget can lay out the one charge group (with the one ordinary, if any) as the blazon
   * words it: asks the library, so the tagger can't drift from the layout rules. Judged on a stand-in
   * design (any charge of the right kind and count); the groups' tinctures are not in question here.
   */
  function checkPlacement(g: Element, o: Element | null): void {
    const count = g.count;
    if (count > MAX_DRAWN_COUNT) return;
    // an unrecognised word may be a second charge, so only judge the arrangement of a fully read blazon
    const judged = !unknownOut.length;
    const type = o?.supported as OrdinaryType | undefined;
    if (o && (!o.supported || o.count > 1)) return;
    const on = o && g.ctx === 'on' && g.host === o;
    const between = o && g.ctx === 'between';
    if (on && type === 'bordure') { tag('placement', 'on-bordure'); return; }
    if (on && !hostCounts('on', type!).includes(count)) { tag('placement', `on-${type}`); return; }
    if (between) {
      if (ORDINARY_KIND[type!] === 'central' && !hostCounts('between', type!).includes(count)) tag('placement', `between-${type}`);
      return;
    }
    const position = g.ctx === 'field' && g.arr ? SECONDARY_POSITION_OF[g.arr] ?? HALF_POSITION_OF[g.arr] : undefined;
    if (o && !on && ORDINARY_KIND[type!] === 'central' && !position) { tag('placement', 'not-between'); return; }
    if (on || !judged && g.arr) return;
    // A charge group on the field, alone or under a chief or within a bordure: does a layout fit?
    const charge = { k: 'charge', charge: g.supported ?? 'mullet' };
    const group = { item: charge, paint: 'or', count, ...(position ? { position } : g.arr ? { arrangement: g.arr } : {}) };
    const r = resolve({ v: 2, field: 'azure', groups: [group, ...(o ? [{ item: { k: 'ordinary', type }, paint: 'argent' }] : [])] });
    if (!r.ok) { if (g.arr && judged) tag('arrangement', g.arr); return; }
    const walked = walkGroups(r.design).find((w) => w.group.item.k === 'charge')!;
    const broken = structuralIssues(r.design).some((i) => i.code === 'structure' && i.at.k === 'group' && i.at.path.join() === walked.path.join());
    if (!broken) return;
    if (position && o && ORDINARY_KIND[type!] === 'central') tag('placement', `in-${position}-${count}`);
    else if (g.arr && judged) tag('arrangement', g.arr);
    else if (type === 'chief') tag('placement', 'under-chief');
  }
}

/** Whether the widget draws these ordinaries together: at most one central one, with at most one chief and one bordure beside it. */
function drawnTogether(ords: readonly Element[]): boolean {
  const types = ords.map((o) => o.supported as OrdinaryType | null);
  if (types.some((t) => t === null) || ords.some((o) => o.count > 1)) return false;
  const central = types.filter((t) => ORDINARY_KIND[t!] === 'central').length;
  const count = (type: OrdinaryType) => types.filter((t) => t === type).length;
  return central <= 1 && count('chief') <= 1 && count('bordure') <= 1 && central + count('chief') + count('bordure') === types.length;
}

/**
 * Buckets of the record's index headings (fields 6+ of the O&A line, coded per oanda.sca.org/my.cat)
 * that can only mean a charge the widget lacks. Used only when the blazon has unrecognised words and
 * no gap was found in it.
 */
function headingBuckets(headings: readonly string[]): ChargeBucket[] {
  const out = new Set<ChargeBucket>();
  for (const h of headings) {
    const cat = h.split(':')[0];
    const b = headingBucket(cat);
    if (b) out.add(b);
  }
  return [...out];
}

function headingBucket(cat: string): ChargeBucket | null {
  if (/^HEAD-(BEAST|JESSANT)/.test(cat)) return 'beast';
  if (/^HEAD-BIRD/.test(cat)) return 'bird';
  if (/^HEAD-MONSTER/.test(cat)) return 'monster';
  if (/^HEAD-(HUMAN)/.test(cat)) return 'human';
  if (/^HEAD-REPTILE/.test(cat)) return 'reptile';
  if (/^HEAD-FISH/.test(cat)) return 'fish';
  if (/^HEAD-WEAPON/.test(cat)) return 'weapon';
  if (/^BEAST-/.test(cat) && !/DEER|BOAR|GOAT|RABBIT/.test(cat)) return 'beast';
  if (/^(MONSTER|GRIFFIN|PEGASUS|KRAKEN|SEAWOLF)/.test(cat) && !/UNICORN/.test(cat)) return 'monster';
  if (/^(INSECT|ARACHNID|MOLLUSK)/.test(cat) && !/BEE/.test(cat)) return 'insect';
  if (/^(REPTILE|AMPHIBIAN|LIZARD)/.test(cat)) return 'reptile';
  if (/^(FLOWER|PLANT|FRUIT|LEAF|FOIL|GARB|FUNGUS|WREATH|TREES-MULTIPLE)/.test(cat)) return 'plant';
  if (/^(FISH-|DOLPHIN|ESCALLOP|SHELL)/.test(cat)) return 'fish';
  if (/^(HUMAN|ARM|HAND|LEG AND FOOT|EYE|BODY|BONE|MASK)/.test(cat)) return 'human';
  if (/^(TOOL|HAMMER|ANVIL|NEEDLE|SPINDLE|SCISSORS|CALIPER|BALANCE|HORSESHOE|SADDLERY|STAFF|FLEAM|MILLRIND|CHAIN)/.test(cat)) return 'tool';
  if (/^(CLOTHING|MAUNCH)/.test(cat)) return 'clothing';
  if (/^(MUSICAL|HARP|BELL)/.test(cat)) return 'instrument';
  if (/^(ARCHITECTURE|CASTLE|GATE|BRIDGE|WINDMILL|PAVILION)/.test(cat)) return 'building';
  if (/^SHIP/.test(cat)) return 'ship';
  if (/^(ARROW|AXE|BOW|SPEAR|POLE-AXE|MACE|HELMET|ARMOR|PHEON|TRIDENT|CALTRAP|GRENADE|CANNON|QUIVER)/.test(cat)) return 'weapon';
  if (/^(CUP|LAMP|CANDLE|TORCH|CAULDRON|BOTTLE|BARREL|EWER|BASKET|CHEST|JEWELS|CHESS|DICE|FLAG|CORNUCOPIA|BEACON|WATER BOUGET|CARD PIQUE|FAN|MIRROR|TABLE|CHAIR|PILLOW|TOY|FOODSTUFF|BEEHIVE)/.test(cat)) return 'household';
  if (/^(ANNULET|ROUNDEL|LOZENGE|MASCLE|BILLET|TRIANGLE|ESCUTCHEON|GOUTE|POLYGON|CARTOUCHE|ESCARB)/.test(cat)) return 'geometric';
  if (/^(KNOT|TRIQUETRA|TRISKELION|LETTERS|ERMINE SPOT|PAW PRINT|SPIDER WEB)/.test(cat)) return 'symbol';
  if (/^(COMET|CLOUDS|RAINBOW|LIGHTNING|THUNDER|SUNBURST|COMPASS ROSE|SPARKS)/.test(cat)) return 'celestial';
  if (/^(MOUNTAIN|ROCK|WAVE|STREAM|GURGES)/.test(cat)) return 'nature';
  return null;
}
