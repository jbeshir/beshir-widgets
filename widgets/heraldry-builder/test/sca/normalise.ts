// Text normaliser applied identically to an SCA blazon and to the widget's own blazon() before the
// two are compared (see match.ts). The widget words every design in SCA house style, so this only
// bridges differences of *spelling and punctuation* and four conventions the SCA and the Glossary
// of Terms declare equivalent. None of the rules can make two blazons of different designs compare
// equal: tinctures, counts, charge names, arrangements and postures are never dropped, except the
// name of a posture Table 5 makes the charge's own default (rule 6: "a lion rampant" is "a lion",
// whatever stands around it). A stated Table 7 arrangement is not text the normaliser drops: the
// matcher compares the SCA text with the widget's blazon of the same design with its defaults
// stated as well (match.ts), which is a statement about one design and so can't equate two.
//
// Rules run in the listed order; each carries an id so the report and the armorial test can cite it
// (NORMALISATION_RULES). Rules 4–7 are conventions, not spellings: the widget's emitter picks one of
// the equivalent forms and O&A uses both, so without them records the widget can express would not
// match. Delete a rule here to see how many records depend on it.
import { COUNTER_EMBATTLED_WORDS, MODS_AFTER_LINE, SAME_ORDINARY, THROUGHOUT_ALREADY, CHARGES, CHARGE_IDS, GAZES, ORIENTATIONS, ORIENTATION_WORDS, chargeItem, drawnPoints, pointsWord, facingEachOther, DRAWN_TREATMENTS, MODIFIER_WORDS, ORDINARY_PLURAL, ORDINARY_SPELLINGS, THIN_ORDINARIES, OUTLINES, familyOf, isDiminutive, NAMED_TINCTURE_CHARGES, SEMY_NAMES, SEMY_SPELLINGS, FURS, FUR_NAME, FUR_SPEC, DRAWN_ORDINARIES, ORDINARY_KIND, ORDINARY_NAME, PERIPHERAL_JOINER, PIECE_IDS, POSTURES, TINCTURES, VARIATIONS, VARIATION_NAME, VARIATION_SPELLINGS, LINE_SPELLINGS, LINE_WORD, lineAllowed, ordinaryEdgeHost, isCountedVariation, postureTerm, postureWords, type Line, type OrdinaryType, type PeripheralJoiner } from '../../src/lib/heraldry';
import { BAND_NAMES, BEND, BEND_SINISTER, DIVISION_NAMES, DIVISION_START, EDGE_NAMES, INVERTED_HOSTS, LINE, NUMBER_WORDS, PER_PALL_SPELLED, SINISTER_HOSTS, THREE_PART_START, TIERCED_IN, alt } from './words';

export interface NormalisationRule {
  id: string;
  description: string;
  apply: (text: string) => string;
}

const COLOUR = `(?:${TINCTURES.join('|')})`;

/** A group's count as the text writes it: one is "a" or "an". */
const NUMBER = `(?:a|an|${NUMBER_WORDS.slice(1).join('|')})`;
const NUMBER_WORD = NUMBER_WORDS.join('|');
/** The line a band or shape is written with after its name: "wavy", "embattled counter-embattled", "embattled on the lower edge". */
const ORDINARY_LINE = ` (?:${COUNTER_EMBATTLED_WORDS}|${LINE})(?: on the (?:${EDGE_NAMES}) edge)?`;
/** An ordinary as the text spells it once its synonyms are settled: its name, inverted, its line, couped and where it runs, as far as it has them (the tincture follows). */
const ORDINARY = `(?:${BAND_NAMES})(?: inverted)?(?:${ORDINARY_LINE})?${MODS_AFTER_LINE.map((m) => `(?: ${m})?`).join('')}`;
/** The corner and edge shapes' names joined by the word the widget writes before them (`PERIPHERAL_JOINER`): ", a quarter", " and a base", " within an orle". */
const joinedBy = (joiner: PeripheralJoiner) => DRAWN_ORDINARIES.filter((t) => ORDINARY_KIND[t] !== 'central' && t !== 'chief' && t !== 'bordure' && PERIPHERAL_JOINER[t] === joiner).map((t) => ORDINARY_NAME[t]).join('|');
/** A top band or border, with its line. */
const PERIPHERAL = `(?:chief|bordure)(?:${ORDINARY_LINE})?`;
/** The drawn bands and shapes, by name, the longest first, whose lines pass `test` (`lineAllowed` on the band or shape). */
const ordinariesWhere = (test: (allowed: (line: Line) => boolean) => boolean) =>
  alt(DRAWN_ORDINARIES.filter((type) => test((line) => lineAllowed(ordinaryEdgeHost({ type, mods: [] }), line))).map((t) => ORDINARY_NAME[t]));
/** Every variation's name: "potenty" after one (or a division's) is its line, not the fur. */
const VARIATION_NAMES = alt(VARIATIONS.map((v) => VARIATION_NAME[v]));
/** The bands and shapes a potenty line is drawn on: "potenty" after one is its line. */
const POTENTY_HOSTS = ordinariesWhere((allowed) => allowed('potenty'));
/** The bands and shapes on which "dancetty" is drawn as indented: they take indented, not dancetty (RULES §A.3; dancetty is a line of two-sided bands). */
const DANCETTY_AS_INDENTED = ordinariesWhere((allowed) => !allowed('dancetty') && allowed('indented'));
/** The other names of an ordinary that is another (`SAME_ORDINARY`: barrulets are bars), singular and plural, each to its type. */
const NAME_OF = new Map(Object.keys(SAME_ORDINARY).map((t) => [ORDINARY_NAME[t as OrdinaryType], t as OrdinaryType]));
const PLURAL_OF = new Map(Object.keys(SAME_ORDINARY).map((t) => [ORDINARY_PLURAL[t as OrdinaryType], t as OrdinaryType]));
const SAME_ORDINARY_NAMES = new RegExp(`\\b(?:${alt(NAME_OF.keys())})\\b`, 'g');
const SAME_ORDINARY_PLURALS = new RegExp(`\\b(?:${alt(PLURAL_OF.keys())})\\b`, 'g');
/** The diminutives the College never uses alone as the main band (RULES-C §C.2), by name, the longest first: what "a <name>" is the ordinary of. */
const DIMINUTIVE_BY_NAME = new Map(THIN_ORDINARIES.map((t) => [ORDINARY_NAME[t], t]));
const SINGLE_DIMINUTIVES = alt(DIMINUTIVE_BY_NAME.keys());
/** A fur as the text spells it once its synonyms are settled: a named fur, "argent ermined gules", "vairy Or and gules". */
const FUR = `(?:${COLOUR} ermined ${COLOUR}|(?:vairy|potenty) ${COLOUR} and ${COLOUR}|${alt(FURS.map((f) => FUR_NAME[f]))})`;
/** A variation of the field as the text spells it once its synonyms are settled, with its stripe count when it has one: "barry of eight", "checky". */
const VARIATION = `(?:${alt(VARIATIONS.map((v) => VARIATION_NAME[v]))})(?: ${LINE})?(?: of ${NUMBER})?`;
/** A treated tincture as the text spells it: "argent masoned sable". */
const TREATED = `${COLOUR} (?:${DRAWN_TREATMENTS.join('|')}) ${COLOUR}`;
const TINCT = `(?:${FUR}|${TREATED}|${COLOUR}|counterchanged|proper)`;
/** A band's fimbriation or cotises as the text spells them once its synonyms are settled: " fimbriated", " doubly cotised", " endorsed", " cotised wavy". */
const COTISES = `(?:${alt(OUTLINES.filter((o) => o.endsWith('cotised')).map((o) => o.replace('-', ' ')))})`;
const OUTLINE_WORD = `(?:fimbriated|endorsed|${COTISES})`;
const OUTLINE = `(?: ${OUTLINE_WORD}(?: plain| ${LINE})?)`;
/** What a band is painted with: its tincture, then its outline and the tincture of that, or its outline and its tincture (" gules fimbriated Or", " cotised azure"). */
const BAND_PAINT = `(?: ${TINCT}(?:${OUTLINE}(?: ${TINCT})?)?|${OUTLINE}(?: ${TINCT})?)`;
/** The heads the widget draws, by their nouns ("wolf's head", "lions' heads"), lower case. */
const HEAD_NOUNS = CHARGE_IDS.flatMap((id) => (CHARGES[id].forms.includes('head') && CHARGES[id].headName ? [CHARGES[id].headName!.one, CHARGES[id].headName!.many] : [])).map((noun) => noun.toLowerCase());
/** The demi charges the widget draws, by their nouns ("demi-lion", "demi-lions"), lower case. */
const DEMI_NOUNS = CHARGE_IDS.flatMap((id) => (CHARGES[id].forms.includes('demi') ? [`demi-${CHARGES[id].name}`, `demi-${CHARGES[id].plural}`] : [])).map((noun) => noun.toLowerCase());
/** Every charge noun, lower case as the text reads once the case rule has run, with the charges' nouns for how they point ("increscent"), their demi charges and their heads with the cut that follows ("wolf's head erased"). */
const NOUN = alt([
  ...CHARGE_IDS.flatMap((id) => [CHARGES[id].name, CHARGES[id].plural, ...Object.values(CHARGES[id].orient.wording).flatMap((w) => (w.k === 'noun' ? [w.name, w.plural] : []))]).map((noun) => noun.toLowerCase()),
  ...DEMI_NOUNS, ...HEAD_NOUNS.map((noun) => `${noun}(?: couped| erased)?`),
]);
const HEAD = alt(HEAD_NOUNS);
/** Every posture word as the text may write it after a charge: the posture, the charge's own term ("segreant"), a two-word one in two words ("sejant erect"). */
const POSTURE = alt([...POSTURES.flatMap((p) => [p, p.replace('-', ' ')]), ...CHARGE_IDS.flatMap((id) => (CHARGES[id].postures ?? []).flatMap((p) => [postureTerm(id, p), postureWords(id, p)]))]);
/** The words after the first of a two-word posture ("erect"): a posture word followed by one is not that posture. */
const POSTURE_TAIL = alt(POSTURES.flatMap((p) => p.split('-').slice(1)));
/** Which way a charge's head is turned, as the widget words it: "guardant", "regardant", "guardant regardant". */
const GAZE = alt(GAZES.map((g) => g.replace('-', ' ')));
/** The modifiers the widget words after a noun: "in splendor", "fitchy", "voided", "pierced", a star's "of six points" ("of eight rays"). */
const MODIFIER = `(?:${alt(Object.values(MODIFIER_WORDS))}|of (?:${alt(NUMBER_WORDS)}) (?:points|rays))`;
/** The stars that are given a number of points, by their nouns (lower case): the mullet, the estoile. */
const STARS = CHARGE_IDS.filter((id) => drawnPoints(id) !== null);
/** The words for which way a charge points, as the widget words them: "fesswise", "bendwise sinister inverted", the crescent's "pendant" (not "points to center", which follows the layout). */
const ORIENT = alt([...ORIENTATIONS.filter((o) => o !== 'to-center').map((o) => ORIENTATION_WORDS[o]), ...CHARGE_IDS.flatMap((id) => Object.values(CHARGES[id].orient.wording).flatMap((w) => (w.k === 'words' ? [w.words] : [])))]);
/** How a charge is turned, after its posture, as the widget words it: its head and "contourny" ("guardant contourny", "contourny regardant"), then which way it points. */
const TURNED = `(?: (?:${GAZE}))?(?: contourny)?(?: (?:${GAZE}))?(?: (?:${ORIENT}))?`;
/** The charges that face, by their nouns, singular and plural (lower case). */
const FACING_ID = new Map(CHARGE_IDS.filter((id) => CHARGES[id].faces).flatMap((id) => [CHARGES[id].name, CHARGES[id].plural].map((noun) => [noun.toLowerCase(), id] as const)));
const FACING_NOUN = alt(FACING_ID.keys());
/** The posture and head words that may stand between such a noun and how it faces: "a lion statant guardant to sinister". */
const POSE_WORDS = `(?: (?:${POSTURE}|${GAZE}))*`;
const TO_SINISTER = new RegExp(`(?<![\\w-])((?:${FACING_NOUN})${POSE_WORDS}) (?:facing (?:to )?|to )sinister\\b`, 'g');
const ENDORSED_CHARGES = new RegExp(`(?<![\\w-])((?:${FACING_NOUN})${POSE_WORDS}) endorsed\\b`, 'g');
/** Two charges set to each other with their heads turned as the College mostly writes them, the head after the pair word ("addorsed regardant" 25 against 8, "combattant guardant" 11 against 0). */
const PAIR_THEN_GAZE = new RegExp(`(?<![\\w-])((?:${FACING_NOUN})${POSE_WORDS}) (combattant|respectant|addorsed) (${GAZE})(?![\\w-])`, 'g');
const FACING_EACH_OTHER_WORD = new RegExp(`(?<![\\w-])(${FACING_NOUN})(${POSE_WORDS}) (combattant|respectant)\\b`, 'g');

/**
 * Two charges facing each other as the widget words them (`facingEachOther`): combattant of beasts and monsters rampant, respectant of the
 * rest (CL 11/2012). "Combattant" says rampant by itself (SENA A5E5a), so the posture goes, and a beast written with none is rampant when
 * combattant, in its SCA default posture when respectant.
 */
function facingEachOtherWords(noun: string, pose: string, written: string): string {
  const id = FACING_ID.get(noun)!;
  const words = pose.split(' ').filter(Boolean);
  const posture = POSTURES.find((p) => words.some((w) => w === p || w === postureTerm(id, p))) ?? (written === 'combattant' ? 'rampant' : CHARGES[id].scaDefaultPosture);
  const item = chargeItem(id, null);
  const pair = facingEachOther(item.k === 'charge' ? { ...item, posture } : item);
  const kept = pair === 'combattant' ? words.filter((w) => w !== 'rampant' && w !== postureTerm(id, 'rampant')) : words;
  return [noun, ...kept, pair].join(' ');
}
/** The pieces drawn with a charge (PLAN-D §0.3.5), by their words: "crowned", "winged", "slipped"… */
const PIECE = alt(PIECE_IDS);
/** A run of pieces as the widget writes those that share a tincture: "crowned and collared", "slipped and leaved". */
const PIECES = `(?:${PIECE})(?: and (?:${PIECE}))*`;
/** The charges drawn winged, by their nouns, singular and plural (lower case): "a winged lion" is a lion winged. */
const WINGED_NOUN = alt(CHARGE_IDS.filter((id) => CHARGES[id].details.includes('winged')).flatMap((id) => [CHARGES[id].name, CHARGES[id].plural]).map((noun) => noun.toLowerCase()));
/** The words after a charge's noun within its own group, its tincture too: no "and", "between", "on" and the like, nor a second "winged". */
const GROUP_WORDS = `(?: (?!(?:and|between|on|within|each|charged|winged)(?![\\w-]))[\\w'-]+)*?`;
/** The words after a charge's noun before its tincture (or before what follows it, when its tincture is the next one stated). */
const CHARGE_WORDS = `(?: (?!(?:and|between|on|within|each|charged|winged|all|per|${COLOUR}|counterchanged|proper|${alt(FURS.map((f) => FUR_NAME[f]))}|${VARIATION_NAMES})(?![\\w-]))[\\w'-]+)*`;
/** A charge group without its tincture or layout: "three wolves passant", "a sun in splendor", "a cross formy fitchy", "a heart winged". */
const CORE = `${NUMBER} (?:${NOUN})(?: (?:${POSTURE}))?${TURNED}(?: ${MODIFIER})*(?: ${PIECES})?`;

/** Each charge's Table 5 default posture after its noun, singular or plural, in its term or the posture's word: "lions? rampant", "dragons? (?:rampant|segreant)". */
const STATED_DEFAULT_POSTURES = CHARGE_IDS.flatMap((id) => {
  const { name, plural, scaDefaultPosture: p } = CHARGES[id];
  if (p === null) return [];
  return [new RegExp(`\\b(${alt([name, plural].map((n) => n.toLowerCase()))}) (?:${alt([p.replace('-', ' '), postureWords(id, p)])})\\b(?! (?:${POSTURE_TAIL})\\b)`, 'g')];
});

/** Each posture a charge has a term of its own for, after its noun, singular or plural, with that term: "stags? salient" → "springing". */
const POSTURE_TERMS = CHARGE_IDS.flatMap((id) => Object.entries(CHARGES[id].postureWording).flatMap(([p, w]) => (w ? [{
  pattern: new RegExp(`\\b(${alt([CHARGES[id].name, CHARGES[id].plural].map((n) => n.toLowerCase()))}) ${p.replace('-', ' ')}\\b(?! (?:${POSTURE_TAIL})\\b)`, 'g'),
  term: w.term,
}] : [])));

/** The other spellings of a cross's form after "cross" or "crosses", each with the widget's word for it ("cross fleury" is "cross flory"). */
const CROSS_FORM_SPELLINGS: Record<string, string> = {
  fleury: 'flory', fleurie: 'flory', formee: 'formy', formée: 'formy', pattee: 'formy', pattée: 'formy', patee: 'formy', patée: 'formy',
  patty: 'formy', patté: 'formy', paty: 'formy', botonny: 'bottony', bottonny: 'bottony', botony: 'bottony', pattonce: 'patonce', patoncy: 'patonce',
};
const CROSS_FORM_SPELLING = new RegExp(`(?<![\\w-])(cross|crosses) (${alt(Object.keys(CROSS_FORM_SPELLINGS))})(?![\\w-])`, 'g');


const NAMED_BY_WORD = new Map(NAMED_TINCTURE_CHARGES.flatMap((n) => [[n.word, n], [n.plural, n]] as const));
const escaped = (words: Iterable<string>) => alt([...words].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
const ARRANGEMENT = `(?: in (?:annulo|saltire|cross|orle|pale|fess|bend sinister|bend))?(?: (?:${NUMBER_WORD})(?:, (?:${NUMBER_WORD}))* and (?:${NUMBER_WORD}))?`;
/** A named roundel or goutte, with what follows it in the group: an arrangement, and a tincture. */
const NAMED_CHARGE = new RegExp(`(?<![\\w-])(${escaped(NAMED_BY_WORD.keys())})(?![\\w-])(${ARRANGEMENT})( ${COLOUR}(?![\\w-]))?`, 'g');
/** The next tincture a text states, or a named roundel or goutte, whose name states one. */
const TINCTURE_OR_NAME = new RegExp(`(?<![\\w-])(${escaped([...TINCTURES, 'counterchanged', 'proper', ...FURS.map((f) => FUR_NAME[f]), ...NAMED_BY_WORD.keys()])})(?![\\w-])`);

const THREE_PART_FIELD = new RegExp(`^${THREE_PART_START} ${TINCT}, `);
/** Where the comma that closes the field is: the first, or the second after a field divided in three ("per pall argent, sable and gules, a …"). */
const fieldComma = (text: string): number => text.indexOf(',', THREE_PART_FIELD.exec(text)?.[0].length ?? 0);
const wordOf = (name: string) => new RegExp(`(?<![\\w-])${escaped([name])}(?![\\w-])`, 'g');
/** The semys' names (in lower case, as the text reads), the longest first, each with the pattern for it and a tincture stated after it, and the semy it strews. */
const SEMY_NAME_PATTERNS = SEMY_NAMES.map((n) => ({ name: n.word.toLowerCase(), semy: n }))
  .sort((x, y) => y.name.length - x.name.length)
  .map(({ name, semy }) => ({ semy, pattern: new RegExp(`(?<![\\w-])${escaped([name])}(?![\\w-])( ${COLOUR}(?![\\w-]))?`, 'g') }));
/** Other spellings of a semy's name, and the other names that read as "semy of <charges>" with no tincture. */
const SEMY_RESPELT = Object.entries(SEMY_SPELLINGS).filter(([, to]) => !to.startsWith('semy of ')).map(([from, to]) => ({ pattern: wordOf(from), to }));
const SEMY_PHRASED = Object.entries(SEMY_SPELLINGS).filter(([, to]) => to.startsWith('semy of ')).map(([from, to]) => ({ pattern: wordOf(from), to }));
/** Anything a semy rule reads: a name or spelling of a semy, or one of the words "semy", "seme", "semee", "semé". */
const SEMY_WORD = new RegExp(`${escaped([...SEMY_NAMES.map((n) => n.word.toLowerCase()), ...Object.keys(SEMY_SPELLINGS)])}|sem[yeéi]`);
const SEMY_ACCENTED = /(?<![\w-])sem(?:ee|e|é|ée)(?= of )/g;
/** A divided field strewn alike on both parts, in one tincture or in each other's. */
const SEMY_BOTH_ALIKE = new RegExp(`^(${DIVISION_START}) (${COLOUR}) semy of (${NOUN}) (${COLOUR}) and (${COLOUR}) semy of \\3 \\4(?![\\w-])`);
const SEMY_BOTH_SWAPPED = new RegExp(`^(${DIVISION_START}) (${COLOUR}) semy of (${NOUN}) (${COLOUR}) and (${COLOUR}) semy of \\3 \\2(?![\\w-])`);
/** The commas between a semy and what it is strewn on, and the "all" a semy over a divided field says. */
const SEMY_AFTER_FIELD = new RegExp(`^(${COLOUR}), (?=semy of )`);
const SEMY_AFTER_BAND = new RegExp(`(\\b(?:a|an) (?:${ORDINARY}|${PERIPHERAL}) ${TINCT}), (?=semy of )`, 'g');
const SEMY_ALL_AFTER_COMMA = new RegExp(`^(${DIVISION_START} ${COLOUR} and ${COLOUR}), (?:all )?(?=semy of )`);
const SEMY_ALL_COUNTERCHANGED = new RegExp(`^(${DIVISION_START} ${COLOUR} and ${COLOUR}) (?=semy of (?:${NOUN}) counterchanged)`);
/** The strewn charges "semy of <charges>" that no tincture follows, and the next tincture a text states. */
const BARE_SEMY = new RegExp(`\\bsemy of (${NOUN})(?![\\w-])(?! (?:${COLOUR}|counterchanged|proper)(?![\\w-]))`, 'g');
const NEXT_COLOUR = new RegExp(`(?<![\\w-])${COLOUR}(?![\\w-])`);

/** The named ermine-family furs by their ground and spots: the tinctures "ermined" spells them with. */
const FOLDED_ERMINES: Record<string, string> = Object.fromEntries(FURS.filter((f) => FUR_SPEC[f].family === 'ermine').map((f) => [`${FUR_SPEC[f].ground} ${FUR_SPEC[f].spots}`, FUR_NAME[f]]));

/** "Ermines" the fur, not several of the beast ("three ermines passant"): any "ermines" not after a count. */
const ERMINES_FUR = /(?<!\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+) )\bermines\b/g;

/** The other spellings of a line (`LINE_SPELLINGS`), each with the widget's word for it: "undy" → "wavy", "ployee" → "ployé"; the spellings that are the line's own word or a counter-embattled edge (a band's, not a division's) are left. */
const LINE_REWRITES = Object.entries(LINE_SPELLINGS)
  .flatMap(([spelling, line]) => (line === 'counter-embattled' || spelling === LINE_WORD[line] || spelling === 'grady' ? [] : [{ spelling, word: LINE_WORD[line] }]))
  .sort((a, b) => b.spelling.length - a.spelling.length);
const LINE_SPELLING_WORD = new RegExp(`(?<![\\p{L}-])(${LINE_REWRITES.map((r) => r.spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}-])`, 'gu');
const LINE_WORD_OF = new Map(LINE_REWRITES.map((r) => [r.spelling, r.word]));

/** The SCA's other spellings of a variation, each with the widget's blazon word ("chequy" → "checky", "barry-bendy" → "barry bendy"). */
const VARIATION_REWRITES = Object.entries(VARIATION_SPELLINGS)
  .filter(([spelling, v]) => spelling !== VARIATION_NAME[v])
  .map(([spelling, v]) => ({ spelling, word: VARIATION_NAME[v], pattern: new RegExp(`\\b${spelling}\\b`, 'g') }));

export const NORMALISATION_RULES: readonly NormalisationRule[] = [
  {
    // 1. The SCA ends every blazon with a full stop; so does the widget, but a few records omit it.
    id: 'final-full-stop',
    description: 'Drop a trailing full stop.',
    apply: (s) => s.replace(/\.$/, ''),
  },
  {
    // 2. Capitalisation carries no heraldic meaning: the SCA capitalises "Or" and the first word.
    id: 'case',
    description: 'Lower-case everything.',
    apply: (s) => s.toLowerCase(),
  },
  {
    // 3. Spelling variants of one term, listed as variants in the Glossary of Terms or the O&A style
    //    guide: "fleur-de-lis"/"-lys", "hauriant"/"haurient", "splendour"/"splendor" and "in his
    //    splendor"/"in glory", "combatant"/"combattant", "gray"/"grey", "cog-wheel"/"cogwheel"; and
    //    the serial comma of a count pattern ("two, two, and one").
    id: 'spelling',
    description: 'fleur(s)-de-lis → -de-lys, hauriant → haurient, splendour/glory → splendor, combatant → combattant, gray → grey, cog-wheel → cogwheel, no serial comma.',
    apply: (s) => s
      .replace(/\bfleur(s?)-de-lis\b/g, 'fleur$1-de-lys')
      .replace(/\bhauriant\b/g, 'haurient')
      .replace(/\bsplendour\b/g, 'splendor')
      .replace(/\bin (?:(?:his|its|their) )?(?:splendor|glory)\b/g, 'in splendor')
      .replace(/\bcombatant\b/g, 'combattant')
      .replace(/\bgray\b/g, 'grey')
      .replace(/\bcog-wheels?\b/g, (m) => m.replace('-', ''))
      .replace(/\b(one|two|three|four|five|six|seven|eight), (one|two|three|four|five|six|seven|eight), and (one|two|three|four|five|six|seven|eight)\b/g, '$1, $2 and $3'),
  },
  {
    // 3a. Furs the SCA spells in more than one way. "Ermines" is counter-ermine (GoT: the plural is not used for the charge-free fur); the
    //     ermine family "X ermined Y" names the fur whose ground and spots they are (argent ermined sable is ermine); "vairy argent and
    //     azure" and "potenty argent and azure" are vair and potent, whose tinctures those are; potent's two tinctures are one set either
    //     way round (Prec #FUR, 11/2006), so they are put in the palette's order; "en point" is "en pointe". A cross or saltire keeps
    //     "potenty argent and azure": "a cross potent" is the cross type, not the fur (the widget writes the fur so).
    id: 'fur-synonyms',
    description: 'ermines (the fur) → counter-ermine; argent/Or ermined sable and sable ermined argent/Or → ermine, erminois, counter-ermine, pean; vairy/potenty argent and azure → vair/potent; potenty A and B in palette order; en point → en pointe.',
    apply: (s) => s
      .replace(ERMINES_FUR, 'counter-ermine')
      .replace(new RegExp(`\\b(${COLOUR}) ermined (${COLOUR})\\b`, 'g'), (m, a: string, b: string) => FOLDED_ERMINES[`${a} ${b}`] ?? m)
      .replace(new RegExp(`\\bvairy ${FUR_SPEC.vair.ground} and ${FUR_SPEC.vair.spots}\\b`, 'g'), 'vair')
      .replace(new RegExp(`(?<!\\b(?:cross|crosses|crosslet|saltire|saltires) )(?<!\\b(?:${DIVISION_NAMES}) )(?<!\\b(?:${POTENTY_HOSTS}) )(?<!\\b(?:${VARIATION_NAMES}) )\\bpotenty (${COLOUR}) and (${COLOUR})\\b`, 'g'), (_m, a: string, b: string) => {
        const [x, y] = TINCTURES.indexOf(a as never) <= TINCTURES.indexOf(b as never) ? [a, b] : [b, a];
        return x === FUR_SPEC.potent.ground && y === FUR_SPEC.potent.spots ? 'potent' : `potenty ${x} and ${y}`;
      })
      .replace(/\b(vair|potent) en point\b/g, '$1 en pointe'),
  },
  {
    // 3a2. Lines of partition the SCA spells in more than one way (`LINE_SPELLINGS`), and the equivalence of RULES §A.3: a division has one
    //      line, so "per pale dancetty" is "per pale indented" (dancetty is a line of two-sided bands; the College draws a division's as indented).
    id: 'line-synonyms',
    description: 'undy → wavy, crenellated → embattled, nebulee → nebuly, ployee → ployé … (LINE_SPELLINGS); "per <division> dancetty", "quarterly (per pale|per fess) dancetty" and dancetty on a band or shape that takes indented but not dancetty (a chief, bordure, base, canton, quarter, gyron, cross, saltire, pile, pall, orle, flaunches, gore …) → "… indented"; "a dance" → "a fess dancetty"; counter-embattled and "embattled on both edges" → "embattled counter-embattled".',
    apply: (s) => s
      .replace(/\b(a|an|on a) dance(?:tte?)?(?![\w-])/g, '$1 fess dancetty')
      .replace(LINE_SPELLING_WORD, (w) => LINE_WORD_OF.get(w)!)
      .replace(new RegExp(`\\b(${DIVISION_NAMES}|quarterly per (?:pale|fess)|(?:(?:a|an) )?(?:${DANCETTY_AS_INDENTED})) dancetty\\b`, 'g'), '$1 indented')
      .replace(/(?<![\w-])(?<!embattled )counter-?embattled\b/g, COUNTER_EMBATTLED_WORDS)
      .replace(/\bembattled on both edges\b/g, COUNTER_EMBATTLED_WORDS),
  },
  {
    // 3a2a. Fields divided in three (RULES-C §E.1, §G.2; PLAN-C C13): "tierced per pale" is the widget's "tierced in pale" (the College writes
    //      both); "tierced per pall" and "gyronny of three" are per pall (SENA A5G1b: "granted no difference"); the three tinctures take no
    //      serial comma ("Per pall argent, sable, and gules" is "… sable and gules", RULES-C §E.1), and the comma between the first two is
    //      written even where a record leaves it out ("Per pall inverted azure vert and Or").
    id: 'three-part-fields',
    description: 'tierced per pale/fess → tierced in pale/fess; tierced per/in pall, gyronny of three → per pall; "per pall A, B, and C" and "per pall A B and C" → "per pall A, B and C".',
    apply: (s) => s
      .replace(TIERCED_IN, 'tierced in $1')
      .replace(PER_PALL_SPELLED, 'per pall')
      .replace(new RegExp(`^(${THREE_PART_START} ${TINCT}),? (${TINCT}),? and `), '$1, $2 and '),
  },
  {
    // 3a2b. Diminutives written more than one way (RULES-C §C.2, §D.2, §G.2; PLAN-C C11): the other spellings of their names
    //      (`ORDINARY_SPELLINGS`: a scarpe is a bendlet sinister, a palet a pallet, a chevronelle a chevronel), barrulets are bars (no
    //      difference, §G.2); SCA armory uses no single diminutive as the main or overall band, so "a bar", "a pallet", "a bendlet (sinister)"
    //      and "a chevronel" are the ordinary (§C.2: "a bendlet enhanced" is a bend enhanced, Emma Barfoot) — but not a single one set
    //      in chief, base or canton, which the widget doesn't draw (`ordinary:single-diminutive`) — and "a saltorel" is a saltire couped (§D.2).
    id: 'diminutives',
    description: 'scarpe → bendlet sinister, palet → pallet, chevronelle → chevronel (and their plurals); barrulet(s) → bar(s); a bar, a pallet, a bendlet (sinister), a chevronel → a fess, a pale, a bend (sinister), a chevron (not in chief, base or canton, nor a bar gemel); a saltorel → a saltire couped.',
    apply: (s) => {
      const spelt = Object.entries(ORDINARY_SPELLINGS).filter(([, t]) => isDiminutive(t)).reduce((text, [word, t]) => text
        .replace(new RegExp(`\\b${word}s\\b`, 'g'), ORDINARY_PLURAL[t])
        .replace(new RegExp(`\\b${word}\\b`, 'g'), ORDINARY_NAME[t]), s);
      return spelt
        .replace(SAME_ORDINARY_PLURALS, (w) => ORDINARY_PLURAL[SAME_ORDINARY[PLURAL_OF.get(w)!]!]).replace(SAME_ORDINARY_NAMES, (w) => ORDINARY_NAME[SAME_ORDINARY[NAME_OF.get(w)!]!])
        .replace(new RegExp(`(?<!\\bin (?:chief|base|canton) )\\ba (${SINGLE_DIMINUTIVES})\\b(?! gemel)`, 'g'), (_, name: string) => `a ${ORDINARY_NAME[familyOf(DIMINUTIVE_BY_NAME.get(name)!)]}`)
        .replace(new RegExp(`\\ba saltorel((?:${ORDINARY_LINE})?)(?: couped)?\\b`, 'g'), 'a saltire$1 couped');
    },
  },
  {
    // 3a3. Ordinary treatments written more than one way (RULES-C §D, §G.2; PLAN-C C6). "Humetty" is couped (Glossary of Terms), "chevron
    //      reversed" is a chevron inverted (RULES-C §G.2); the widget writes "inverted" before a line and "couped" after it (corpus 12 vs 5,
    //      "saltire raguly couped" 3 vs 1: PLAN-C §4), so "a pile wavy inverted" is "a pile inverted wavy" and "a fess couped embattled" is "a
    //      fess embattled couped"; a bare "chevron inverted embattled" is its upper edge (PLAN-C §4 L2), which the widget names; a cross or
    //      saltire is throughout already, so "throughout" after one says nothing (RULES-C §D.2). ("A bendlet enhanced" is a bend enhanced:
    //      rule `diminutives`.)
    id: 'ordinary-treatments',
    description: 'humetty → couped after an ordinary; chevron reversed → chevron inverted; "<chevron|pile|pall|chevronel(s)> <line> inverted" → "… inverted <line>"; "<ordinary> couped <line>" → "<ordinary> <line> couped"; "chevron inverted embattled" → "… embattled on the upper edge"; "throughout" after a cross or saltire dropped.',
    apply: (s) => s
      .replace(new RegExp(`\\b((?:${BAND_NAMES})(?: inverted)?(?:${ORDINARY_LINE})?) humett(?:y|ee|é)(?![\\w-])`, 'g'), '$1 couped')
      .replace(/\b(chevrons?) reversed\b/g, '$1 inverted')
      .replace(new RegExp(`\\b(${INVERTED_HOSTS})(${ORDINARY_LINE}) inverted\\b`, 'g'), '$1 inverted$2')
      .replace(new RegExp(`\\b((?:${BAND_NAMES})(?: inverted)?) couped(${ORDINARY_LINE})(?![\\w-])`, 'g'), '$1$2 couped')
      .replace(/(?<!per )\bchevron inverted embattled(?! counter-embattled| on the| grady)\b/g, 'chevron inverted embattled on the upper edge')
      .replace(new RegExp(`\\b((?:a|an|on a) (?:${alt(THROUGHOUT_ALREADY.map((t) => ORDINARY_NAME[t]))})(?:${ORDINARY_LINE})?(?: voided)?) throughout\\b`, 'g'), '$1'),
  },
  {
    // 3a4. Cotises and fimbriation written more than one way (RULES-C §G.1, §G.2; PLAN-C C7b). "Cotissed" and "cottised" are cotised, "double" and
    //      "triple" cotised are "doubly" and "triply" (also "cotised twice/thrice"); a pale's single pair is "endorsed" in the widget's words
    //      ("a pale cotised" is "a pale endorsed"), and "between two cotises" is cotised.
    id: 'ordinary-outlines',
    description: 'cotissed, cottised → cotised; double/triple(-)cotised, cotised twice/thrice → doubly/triply cotised; no comma before a band\'s fimbriation or cotises, nor between them and "between"; "cotised couped" → "couped cotised"; "a pale … cotised" → "… endorsed"; "between two cotises" → "cotised".',
    apply: (s) => s
      .replace(/\b(?:cotissed|cottised)\b/g, 'cotised')
      .replace(/\bdouble[- ]cotised\b|\bcotised twice\b/g, 'doubly cotised')
      .replace(/\btriple[- ]cotised\b|\bcotised thrice\b/g, 'triply cotised')
      .replace(/\bbetween two cotises\b/g, 'cotised')
      .replace(new RegExp(`(\\b(?:a|an) ${ORDINARY}(?: ${TINCT})?), (?=${OUTLINE_WORD}\\b)`, 'g'), '$1 ')
      .replace(new RegExp(`(\\b(?:a|an) ${ORDINARY}(?: ${TINCT})?${OUTLINE}(?: ${TINCT})?), (?=between\\b)`, 'g'), '$1 ')
      .replace(new RegExp(`\\b(${BAND_NAMES})((?: inverted)?(?:${ORDINARY_LINE})?) (${COTISES}(?: plain| ${LINE})?) (${alt(MODS_AFTER_LINE)})\\b`, 'g'), '$1$2 $4 $3')
      .replace(new RegExp(`(?<!per )\\b((?:a|an) pale(?: inverted)?(?:${ORDINARY_LINE})?(?: couped)?(?: (?:throughout|enhanced|abased))?(?: ${TINCT})?) cotised\\b`, 'g'), '$1 endorsed'),
  },
  {
    // 3b. Variations the SCA spells in more than one way (`VARIATION_SPELLINGS`): "chevronny" is chevronelly (the College's word: SENA A5F1b),
    //     "chequy" and "fusilly" are checky and fusily, the barry-bendy pair and bendy sinister are written without a hyphen; and the usual
    //     six stripes need not be stated ("barry of six" is barry: the emitter leaves out a default it has, SENA A5G1d counts pieces only up to four).
    id: 'variation-synonyms',
    description: `${VARIATION_REWRITES.map((r) => `${r.spelling} → ${r.word}`).join('; ')}; "<counted variation> of six" → "<counted variation>".`,
    apply: (s) => VARIATION_REWRITES.reduce((t, r) => t.replace(r.pattern, r.word), s)
      .replace(new RegExp(`\\b(${alt(VARIATIONS.filter(isCountedVariation).map((v) => VARIATION_NAME[v]))})((?: ${LINE})?) of six\\b`, 'g'), '$1$2'),
  },
  {
    // 3c. Treatments the SCA spells in more than one way: "papelonny" is papellony (the Glossary lists both).
    id: 'treatment-synonyms',
    description: 'papelonny → papellony.',
    apply: (s) => s.replace(/\bpapelonny\b/g, 'papellony'),
  },
  {
    // 3d. Charge names the SCA spells in more than one way, or gives with the tincture in the name. "Estoille" is estoile; "crosslet" is
    //     the cross crosslet; a bezant is a roundel Or, a plate a roundel argent, a goutte de sang a goutte gules (Glossary of Terms): the
    //     widget words these as the charge and its tincture, so the name goes, a tincture written after it as well is the same one, and the
    //     tincture goes where the widget puts it: after the arrangement, and not at all when the next tincture stated is the same one
    //     (the widget names a tincture shared by groups once, after the last). "Domestic cat" is the College's usual name for the cat (679 records, far more than "cat" alone),
    //     so it is the widget's cat.
    id: 'charge-synonyms',
    description: 'estoille → estoile; domestic cat(s) → cat(s); crosslet(s) → cross crosslet / crosses crosslet; bezant, plate, torteau, hurt, pellet, ogress, pomme, golpe, goutte d\'or / d\'eau / de sang / de larmes / de poix → the roundel or goutte and its tincture, after its arrangement and left out when the next tincture stated is the same.',
    apply: (s) => s
      .replace(NAMED_CHARGE, (match: string, name: string, arrangement: string, stated: string | undefined, offset: number) => {
        const named = NAMED_BY_WORD.get(name)!;
        const noun = name === named.plural ? CHARGES[named.charge].plural : CHARGES[named.charge].name;
        const after = s.slice(offset + match.length);
        const shared = TINCTURE_OR_NAME.exec(after);
        const tincture = shared && (NAMED_BY_WORD.get(shared[1])?.tincture ?? shared[1]) === named.tincture ? '' : ` ${named.tincture}`;
        return `${noun}${arrangement}${tincture}${stated && stated.trim() !== named.tincture ? stated : ''}`;
      })
      .replace(/(?<![\w-])estoille(s?)(?![\w-])/g, 'estoile$1')
      .replace(/(?<![\w-])domestic (cats?)(?![\w-])/g, '$1')
      .replace(/\bcross crosslets\b/g, 'crosses crosslet')
      .replace(/(?<!cross |crosses )\bcrosslets\b/g, 'crosses crosslet')
      .replace(/(?<!cross |crosses )\bcrosslet\b/g, 'cross crosslet'),
  },
  {
    // 3d2. Names of the drawn crosses and shapes the SCA spells in more than one way (the Glossary of Terms lists them): the forms of a
    //      cross (flory/fleury, formy/pattée/patty, bottony/botonny, patonce/pattonce), "fitchy" (fitched, fitchée; "at the foot" is
    //      what fitchy means), "compass-star" and the Latin plural "triquetrae".
    id: 'cross-synonyms',
    description: 'cross fleury → cross flory; cross formée/pattée/patty/paty → cross formy; cross botonny/bottonny → cross bottony; cross pattonce/patoncy → cross patonce (also crosses …); fitched/fitchée and "fitchy at the foot" → fitchy; compass-star(s) → compass star(s); triquetrae → triquetras.',
    apply: (s) => s
      .replace(CROSS_FORM_SPELLING, (_m, noun: string, spelling: string) => `${noun} ${CROSS_FORM_SPELLINGS[spelling]}`)
      .replace(/(?<![\w-])fitch(?:y|ed|ee|ée)(?: at the foot)?(?![\w-])/g, 'fitchy')
      .replace(/(?<![\w-])compass-star(s?)(?![\w-])/g, 'compass star$1')
      .replace(/(?<![\w-])triquetrae(?![\w-])/g, 'triquetras'),
  },
  {
    // 3d3. The pieces drawn with a charge (PLAN-D §0.3.5) in the widget's words. "Ducally crowned" and "crowned of (with) a (ducal) coronet"
    //      are crowned, "gorged of a (ducal) coronet" is collared, "inflamed" enflamed and "leafed" leaved (GoT); commas around a run of
    //      pieces go ("a rose, slipped and leaved, gules"), and so does "and" between two runs with their own tinctures ("crowned Or and
    //      collared gules": the widget writes them one after the other). A winged beast is the beast winged (SENA M13: wings are a part of
    //      the charge): "a winged lion rampant Or" is "a lion rampant winged Or" (wings of its tincture, which the widget leaves unsaid
    //      before them; "a winged lion rampant, a chief Or" likewise "a lion rampant winged, a chief Or"), and "three winged boars argent
    //      winged Or" is "three boars argent winged Or".
    id: 'piece-words',
    description: 'ducally crowned / crowned of (with) a (ducal) coronet → crowned; gorged of (with) a (ducal) coronet → collared; inflamed → enflamed; leafed → leaved; no comma before a piece or between a run of pieces and its tincture; "<pieces> <tincture> and <piece>" → "<pieces> <tincture> <piece>"; "winged <beast> … winged" → "<beast> … winged"; "winged <beast> …" → "<beast> … winged" before its tincture, or what follows it.',
    apply: (s) => s
      .replace(/(?<![\w-])ducally crowned(?![\w-])/g, 'crowned')
      .replace(/(?<![\w-])(crowned|gorged|collared) (?:of|with) an? (?:ducal )?coronet(?![\w-])/g, (_m, word: string) => (word === 'crowned' ? 'crowned' : 'collared'))
      .replace(/(?<![\w-])inflamed(?![\w-])/g, 'enflamed')
      .replace(/(?<![\w-])leafed(?![\w-])/g, 'leaved')
      .replace(new RegExp(`,(?= (?:${PIECE})(?![\\w-]))`, 'g'), '')
      .replace(new RegExp(`(?<![\\w-])(${PIECES}),(?= ${TINCT}(?![\\w-]))`, 'g'), '$1')
      .replace(new RegExp(`(?<![\\w-])(${PIECES} ${TINCT}) and (?=(?:${PIECE})(?![\\w-]))`, 'g'), '$1 ')
      .replace(new RegExp(`(?<![\\w-])winged ((?:${WINGED_NOUN})(?![\\w-])${GROUP_WORDS} winged)(?![\\w-])`, 'g'), '$1')
      .replace(new RegExp(`(?<![\\w-])winged ((?:${WINGED_NOUN})(?![\\w-])${CHARGE_WORDS})`, 'g'), '$1 winged'),
  },
  {
    // 3d4. What a charge holds (PLAN-D §1.5) in the widget's words: "holding", "grasping" and "supporting" a charge are maintaining it
    //      (the armorial: maintaining 1,435, sustaining 288, grasping 50, holding 26, supporting 10); an item in a beak or a mouth is
    //      "maintaining in its beak (mouth)" whoever holds it how ("maintaining in its beak" 109, "holding" 11, the rest sustaining,
    //      bearing or grasping: the manner is worth nothing, §1.5 H2; "his", "her" are "its"); no comma before what is held (388 with one,
    //      1,616 without).
    id: 'hold-words',
    description: '"(maintaining|sustaining|holding|grasping|bearing|supporting) in its/his/her beak/mouth" → "maintaining in its beak/mouth"; holding/grasping/supporting a(n) → maintaining a(n); no comma before "(each) maintaining/sustaining".',
    apply: (s) => s
      .replace(/(?<![\w-])(?:maintaining|sustaining|holding|grasping|bearing|supporting) in (?:its|his|her) (beak|mouth)(?![\w-])/g, 'maintaining in its $1')
      .replace(/(?<![\w-])(?:holding|grasping|supporting)(?= an? )/g, 'maintaining')
      .replace(/,(?= (?:each )?(?:maintaining|sustaining)(?![\w-]))/g, ''),
  },
  {
    // 3e. A semy is "semy of <charges> <tincture>", or one of its names ("crusilly argent", "semy-de-lys Or", "bezanty": a name that
    //     fixes the tincture states none). The widget words it with the name where there is one; the College writes both ways, with
    //     the spellings "crusily", "billetty", "mulletty", "semee". All read as "semy of <charges> <tincture>"; a tincture left unsaid is
    //     the next one stated ("Argent semy-de-lys, a bend sinister azure": fleurs-de-lys azure), and a comma between the field and its
    //     semy is none.
    id: 'semy-names',
    description: 'crusilly, billety, mullety, estencely, semy-de-lys, bezanty, platy, hurty, pellety, goutty de sang … → "semy of <charges> <tincture>"; spellings crusily, billetty, mulletty, semee; the tincture of a semy left unsaid is the next one stated; "Azure, semy of …" → "Azure semy of …".',
    apply: (s) => {
      if (!SEMY_WORD.test(s)) return s;
      let text = s.replace(SEMY_ACCENTED, 'semy');
      for (const { pattern, to } of SEMY_RESPELT) text = text.replace(pattern, to);
      for (const { semy, pattern } of SEMY_NAME_PATTERNS) {
        text = text.replace(pattern, (_m, stated: string | undefined) =>
          `semy of ${CHARGES[semy.charge].plural}${semy.tincture !== null ? ` ${semy.tincture}${stated && stated.trim() !== semy.tincture ? stated : ''}` : stated ?? ''}`);
      }
      for (const { pattern, to } of SEMY_PHRASED) text = text.replace(pattern, to);
      // Both parts of a divided field strewn alike are one semy over all of it: "per pale A semy of Xs I and B semy of Xs I" is "per pale A and B all semy of Xs I".
      text = text.replace(SEMY_BOTH_ALIKE, '$1 $2 and $5 all semy of $3 $4')
        .replace(SEMY_BOTH_SWAPPED, (m, d: string, a: string, c: string, b: string, b2: string) => (b === b2 ? `${d} ${a} and ${b} all semy of ${c} counterchanged` : m))
        .replace(SEMY_AFTER_FIELD, '$1 ')
        .replace(SEMY_AFTER_BAND, '$1 ')
        .replace(SEMY_ALL_AFTER_COMMA, '$1 all ')
        .replace(SEMY_ALL_COUNTERCHANGED, '$1 all ');
      return text.replace(BARE_SEMY, (match: string, _charges: string, offset: number) => {
        const next = NEXT_COLOUR.exec(text.slice(offset + match.length));
        return next ? `${match} ${next[0]}` : match;
      });
    },
  },
  {
    // 3a5. Corner shapes written more than one way (RULES-C §C.3, §G.2; PLAN-C C8b, C9): a canton, quarter, gyron or gore — any that takes
    //      "sinister" (`MOD_HOSTS.sinister`) — is dexter unless it is said to be sinister, before its name ("a sinister canton", corpus 14; "a
    //      sinister gore" 34) or after it ("a canton sinister", "a gore sinister" 65, the widget's words).
    id: 'corner-shapes',
    description: '"a sinister canton/quarter/gyron/gore/baton" → "a canton/quarter/gyron/gore/baton sinister"; "a dexter canton/…" → "a canton/…".',
    apply: (s) => s
      .replace(new RegExp(`\\b(a|an|on a) sinister (${SINISTER_HOSTS})\\b`, 'g'), '$1 $2 sinister')
      .replace(new RegExp(`\\b(a|an|on a) dexter (${SINISTER_HOSTS})\\b`, 'g'), '$1 $2'),
  },
  {
    // 3a6. The orle, tressure, flaunches and the dexter and sinister points written more than one way (RULES-C §C.3, §G.2; PLAN-C C9): a
    //      single tressure is an orle (Prec Gwynaeth 04/2004; corpus "a tressure" 27); flaunches are always a pair ("two flaunches" 95, "a pair
    //      of flaunches" 24: RULES-C §C.3, the widget writes "flaunches"); "a dexter point" is the widget's "a point dexter" (a sinister gore:
    //      rule `corner-shapes`).
    id: 'peripheral-forms',
    description: '"a tressure" and "a orle" → "an orle"; "two flaunches", "a pair of flaunches" → "flaunches"; "a dexter/sinister point" → "a point dexter/sinister".',
    apply: (s) => s
      .replace(/\b(a|on a) (?:tressure|orle)\b/g, '$1n orle')
      .replace(/\b(?:two|a pair of) flaunches\b/g, 'flaunches')
      .replace(/\b(a|on a) (dexter|sinister) point\b/g, '$1 point $2'),
  },
  {
    // 3a7. The label written more than one way (RULES-C §C.3): it is of three points and in chief by default ("a label of three points", "in chief
    //      a label": 5 and 12 in the corpus), so the widget writes "a label".
    id: 'label-forms',
    description: '"a label of three points" → "a label"; ", in chief a label", "and in chief a label" → ", a label".',
    apply: (s) => s
      .replace(/\ba label of three points\b/g, 'a label')
      .replace(/,? (?:and )?in chief (?=a label\b)/g, ', '),
  },
  {
    // 3a8. One charge in chief or in base beside a bend stands in the corner the bend leaves free (RULES-C §F.3, App K): the College writes "a bend
    //      … and in sinister chief a rose" (corpus about 40) and "… and in chief a rose" (about 45) for it, and "in dexter chief" beside a bend
    //      sinister; the widget writes the corner. Two or more charges stand along the top, so only "a"/"an" is read so.
    id: 'corner-beside-bend',
    description: 'beside a bend, bendlets or a baton, "in sinister chief a/an" → "in chief a/an" and "in dexter base a/an" → "in base a/an"; beside a bend sinister, bendlets sinister or a baton sinister, "in dexter chief" and "in sinister base" likewise.',
    apply: (s) => s
      .replace(new RegExp(`(${BEND}[^,]*?,? (?:and )?in) (?:sinister (chief)|dexter (base)) (?=an? )`, 'g'), '$1 $2$3 ')
      .replace(new RegExp(`(${BEND_SINISTER}[^,]*?,? (?:and )?in) (?:dexter (chief)|sinister (base)) (?=an? )`, 'g'), '$1 $2$3 '),
  },
  {
    // 4. Connectors the Glossary treats as the same: "X and a chief Y", "X, a chief Y"; "within a
    //    bordure", "all within a bordure", "and a bordure", ", a bordure"; "on a bend, three…" and "on a bend three…"; "on a
    //    fess between two crescents argent, three mullets" and "… argent three mullets" (RULES §F.2: no
    //    comma is the house style, a comma is occasionally used for clarity); "a lion and in chief three
    //    mullets" and "a lion, in chief three mullets" (RULES §F.2 secondary connectors: the LoARs use both,
    //    and a tincture is factored across either); and the comma that closes the field, which a few records
    //    omit; before a corner or edge shape, ", a base" and "and a base", ", an orle", "and an orle" and "within an orle", ", flaunches"
    //    and "between flaunches" (each takes the joiner the O&A uses most for it, PERIPHERAL_JOINER: counts in ordinaries.ts). Every
    //    element and tincture stays.
    id: 'equivalent-connectors',
    description: '"and a chief/bordure", "within a bordure", "all within a bordure" → ", a chief/bordure"; ", a base/gyron/canton" → " and a …" and "and a point pointed/quarter" → ", a …", ", an orle/a double tressure" → " within …", ", flaunches" → " between flaunches" (each corner or edge shape takes the joiner the O&A uses most, PERIPHERAL_JOINER); "and in chief/base/canton" → ", in chief/base/canton"; no comma after "on a <ordinary> <tincture>" or after the tincture of what is set between it and a group on it; restore the comma after the field.',
    apply: (s) => s
      .replace(/,? and (?=(?:a|on a) chief\b)/g, ', ')
      .replace(new RegExp(`,? and (?=(?:a|on a) (?:${joinedBy(', ')})\\b)`, 'g'), ', ')
      // The comma that closes the field stays: "Argent, a base azure".
      .replace(new RegExp(`(?:,? and|,) (?=(?:a|on a) (?:${joinedBy(' and ')})\\b)`, 'g'), (m: string, at: number, text: string) => (at === fieldComma(text) && m === ', ' ? m : ' and '))
      // "within an orle", "within a double tressure", "between flaunches" (a tressure double or triple, flaunches without an article)
      .replace(new RegExp(`(?:,? and|,|,? (?:all )?within) (?=(?:on )?an? (?:(?:double|triple) )?(?:${joinedBy(' within ')})\\b)`, 'g'), (m: string, at: number, text: string) => (at === fieldComma(text) && m === ', ' ? m : ' within '))
      .replace(new RegExp(`(?:,? and|,|,? between) (?=(?:on )?(?:${joinedBy(' between ')})\\b)`, 'g'), (m: string, at: number, text: string) => (at === fieldComma(text) && m === ', ' ? m : ' between '))
      .replace(/,? and (?=in (?:chief|base|canton)\b)/g, ', ')
      .replace(/,? (?:and|(?:all )?within) (?=a bordure\b)/g, ', ')
      .replace(new RegExp(`\\b(on (?:(?:a|an) (?:${ORDINARY}${BAND_PAINT}|chief(?:${ORDINARY_LINE})? ${TINCT})|${CORE} ${TINCT})),`, 'g'), '$1')
      .replace(new RegExp(`(\\bon (?:a|an) ${ORDINARY}(?:${BAND_PAINT})? between [^,]*? ${TINCT}), (?=(?:a|an|${NUMBER}) (?:${NOUN})\\b)`, 'g'), '$1 ')
      .replace(new RegExp(`^(${THREE_PART_START} ${TINCT}, ${TINCT} and ${TINCT}|${DIVISION_START} ${TINCT} and ${TINCT}|${VARIATION} ${COLOUR} and ${COLOUR}|${TINCT}) (?=(?:a|an|on|${NUMBER}|in) )`), '$1, '),
  },
  {
    // 4a. What lies across everything: "a fess and overall a lion", "a fess, overall a lion", "a fess overall a lion" are one blazon
    //     (RULES §F.2: the College writes ", overall" and "and overall"; Bruce also runs it on).
    id: 'overall-connector',
    description: '", overall", "overall" and "and overall" → "and overall".',
    apply: (s) => s.replace(/,? (?:and )?overall /g, ' and overall '),
  },
  {
    // 5. A single host carries what is on it as "on <host> <group>" or "<host> charged with <group>": SENA writes both
    //    ("Azure, on a bend argent a mullet vert", "a lozenge sable charged with a roundel argent"); the widget words a
    //    charge on a beast, monster or bird the second way and every other host the first.
    id: 'charged-with',
    description: '"<a host> <tincture> charged with <group>" → "on <a host> <tincture> <group>".',
    apply: (s) => s.replace(new RegExp(`(^|, | and )((?:a|an) (?:${ORDINARY}|chief(?:${ORDINARY_LINE})?|${NOUN})(?: (?:${POSTURE}))?${TURNED}(?: ${MODIFIER})* ${TINCT}),? charged with `, 'g'), '$1on $2 '),
  },
  {
    // 5a0. A posture in the charge's own term (GoT; the sidecar's `postureWording`), which the widget writes: a stag passant is trippant,
    //      couchant lodged, salient springing ("stag salient" 48, "stag springing" 62); a dragon rampant is segreant (rule 7 then leaves it unsaid).
    id: 'posture-terms',
    description: '"<charge> <posture>" → "<charge> <its own term for the posture>": stag passant → trippant, couchant → lodged, salient → springing; dragon rampant → segreant.',
    apply: (s) => POSTURE_TERMS.reduce((t, { pattern, term }) => t.replace(pattern, `$1 ${term}`), s),
  },
  {
    // 5a. Which way a charge that faces is turned, in the SCA's other words for the widget's (GoT; SENA §1.1): contourny's spellings
    //     (contourné, contourne, contournee, contourney); "to sinister" and "facing (to) sinister" after such a charge and its posture;
    //     "endorsed" after one is addorsed (after a pale it is the pale's cotises, rule 4); two facing each other are combattant and
    //     respectant alike (CL 11/2012), which the widget words by the charge and its posture (`facingEachOtherWords`): combattant for
    //     beasts and monsters rampant, the posture then left unsaid, respectant for the rest;
    //     and the head in its other spellings (gardant, reguardant), before the pair word ("addorsed regardant" → "regardant addorsed"), before
    //     "contourny" when it looks out and after it when it looks back ("contourny guardant", "regardant contourny").
    id: 'facing-synonyms',
    description: 'contourné/contourne/contournee/contourney → contourny; gardant → guardant, reguardant → regardant; "<pair word> <head>" → "<head> <pair word>"; "<charge that faces> [posture] (facing) to sinister" → "… contourny"; "… endorsed" → "… addorsed"; combattant/respectant → the widget\'s word for the charge and posture (combattant: rampant, which it then leaves unsaid); contourny guardant → guardant contourny, regardant contourny → contourny regardant.',
    apply: (s) => s
      .replace(/(?<![\w-])contourn(?:ée|é|ee|ey|e)(?![\w-])/g, 'contourny')
      .replace(/(?<![\w-])gardant(?![\w-])/g, 'guardant')
      .replace(/(?<![\w-])reguardant(?![\w-])/g, 'regardant')
      .replace(TO_SINISTER, '$1 contourny')
      .replace(ENDORSED_CHARGES, '$1 addorsed')
      .replace(PAIR_THEN_GAZE, '$1 $3 $2')
      .replace(FACING_EACH_OTHER_WORD, (_, noun: string, pose: string, written: string) => facingEachOtherWords(noun, pose, written))
      .replace(/\bcontourny guardant\b/g, 'guardant contourny')
      .replace(/\bregardant contourny\b/g, 'contourny regardant'),
  },
  {
    // 5a2. Demi charges and heads in the widget's words. "Demi lion" is "demi-lion"; the widget always states how a head is cut off
    //     (`canonical`: couped when it is not erased), so "a wolf's head" is "a wolf's head couped"; the cut stands next to the noun, before
    //     "contourny" ("head erased contourny" 232 against 18). A head "caboshed" is a gap and keeps its words.
    id: 'form-words',
    description: 'demi X → demi-X; "<charge>\'s head" with no cut → "… couped" (not before caboshed); "head contourny erased" → "head erased contourny".',
    apply: (s) => s
      .replace(/(?<![\w-])demi (?=[a-z])/g, 'demi-')
      .replace(new RegExp(`(?<![\\w-])(${HEAD}) contourny (couped|erased)(?![\\w-])`, 'g'), '$1 $2 contourny')
      .replace(new RegExp(`(?<![\\w-])(${HEAD})(?! (?:couped|erased|caboshed|cabossed))(?![\\w-])`, 'g'), '$1 couped'),
  },
  {
    // 5b. Which way a charge points, in the SCA's other words for the widget's (SENA App G; GoT Table 7): "barwise" is fesswise, "inverted
    //     bendwise (sinister)" is "bendwise (sinister) inverted" (the armorial has 177 against 127), and a crescent inverted is pendant
    //     (133 against 96, `orient.wording`). "palewise" stays stated: the widget words it too.
    id: 'orientation-synonyms',
    description: 'barwise → fesswise; inverted bendwise (sinister) → bendwise (sinister) inverted; crescent(s) inverted → crescent(s) pendant.',
    apply: (s) => s
      .replace(/\bbarwise\b/g, 'fesswise')
      .replace(/\binverted (bendwise(?: sinister)?)\b/g, '$1 inverted')
      .replace(/\b(crescents?) inverted\b/g, '$1 pendant'),
  },
  {
    // 5c. A star's points in the widget's words (§1.4 M5): "a mullet of five points" is the mullet as drawn and "an estoile of six rays" the
    //     estoile, so the number goes (`canonical`); an estoile's points are its rays ("estoile(s) of N points" 40, "of N rays" 68).
    id: 'points-synonyms',
    description: 'mullet(s) of five points → mullet(s); estoile(s) of six rays → estoile(s); estoile(s) of N points → estoile(s) of N rays.',
    apply: (s) => STARS.reduce((t, id) => {
      const noun = `(${CHARGES[id].name.toLowerCase()}|${CHARGES[id].plural.toLowerCase()}) of`;
      return t.replace(new RegExp(`\\b${noun} ${NUMBER_WORDS[drawnPoints(id)! - 1]} (?:points|rays)\\b`, 'g'), '$1')
        .replace(new RegExp(`\\b${noun} (${alt(NUMBER_WORDS)}) (?:points|rays)\\b`, 'g'), `$1 of $2 ${pointsWord(id)}`);
    }, s),
  },
  {
    // 6. Where the placement words go: the SCA writes "two keys in pale" as often as "in pale two
    //    keys" (Bruce); the widget puts lines and positions first and patterns after.
    id: 'arrangement-placement',
    description: '"<group> in pale/fess/bend/bend sinister" → "in … <group>"; "in saltire/cross <group>" → "<group> in saltire/cross".',
    apply: (s) => s
      .replace(new RegExp(`\\b(${CORE}) in (pale|fess|bend sinister|bend)\\b`, 'g'), 'in $2 $1')
      .replace(new RegExp(`\\bin (saltire|cross) (${CORE})\\b`, 'g'), '$2 in $1'),
  },
  {
    // 7. Postures the College assumes may be stated or left out (Glossary Table 5): each charge's `scaDefaultPosture` (a lion or
    //    unicorn rampant, a dragon rampant/segreant, an eagle displayed, a fish naiant), in its own term or the posture's word. Both
    //    sides drop them; the name always means that posture, so only a design that has it can match. A posture word that begins a
    //    longer one stays ("statant" of "statant erect").
    id: 'stated-default-postures',
    description: 'Drop each charge\'s Table 5 default posture (`scaDefaultPosture`) after it.',
    apply: (s) => STATED_DEFAULT_POSTURES.reduce((t, pattern) => t.replace(pattern, '$1'), s),
  },
  {
    // 8. Divided groups. "Counterchanged <tincture> and <tincture>" names the tinctures of a single charge or ordinary divided as the field is
    //    ("Per pale gules and Or, a fleur-de-lys counterchanged Or and sable" is a fleur-de-lys per pale Or and sable); the widget words it
    //    as the division. Several charges so blazoned lie each in one part, divided only where one crosses the line (A5G3a), which is not
    //    each charge divided, so their text is left alone.
    id: 'divided-groups',
    description: '"a <charge> counterchanged <tincture> and <tincture>" on a divided field → "a <charge> <the field\'s division> <tincture> and <tincture>"; no "each" before a division.',
    apply: (s) => {
      const field = new RegExp(`^(${DIVISION_START}) ${TINCT} and ${TINCT}, `).exec(s);
      // The group's own number is the last number word before "counterchanged".
      const single = new RegExp(`\\b(an?) ((?:(?!\\b${NUMBER}\\b)[^,])*?)\\bcounterchanged (${TINCT} and ${TINCT})\\b`, 'g');
      const divided = field ? s.replace(single, `$1 $2${field[1]} $3`) : s;
      // "Three hearts each per pale gules and sable" and "three hearts per pale gules and sable": each charge is divided either way.
      return divided.replace(new RegExp(`\\beach (?=(?:${DIVISION_NAMES}) )`, 'g'), '');
    },
  },
];

export function normaliseBlazon(text: string): string {
  return NORMALISATION_RULES.reduce((s, rule) => rule.apply(s), text);
}
