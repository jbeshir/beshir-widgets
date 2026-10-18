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
import { CHARGES, CHARGE_IDS, DRAWN_TREATMENTS, ORDINARY_PLURAL, ORDINARY_SPELLINGS, THIN_ORDINARIES, familyOf, isDiminutive, NAMED_TINCTURE_CHARGES, SEMY_NAMES, SEMY_SPELLINGS, FURS, FUR_NAME, FUR_SPEC, DRAWN_ORDINARIES, ORDINARY_KIND, ORDINARY_NAME, PERIPHERAL_JOINER, POSTURES, TINCTURES, VARIATIONS, VARIATION_NAME, VARIATION_SPELLINGS, DRAWN_LINES, LINE_SPELLINGS, LINE_WORD, isCountedVariation, postureTerm, type PeripheralJoiner } from '../../src/lib/heraldry';

export interface NormalisationRule {
  id: string;
  description: string;
  apply: (text: string) => string;
}

const COLOUR = `(?:${TINCTURES.join('|')})`;

const NUMBER = '(?:a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const NUMBER_WORD = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
/** A line of partition as the widget words it ('embattled grady', 'ployé'), the longest first. */
const LINE = `(?:${[...new Set(DRAWN_LINES.map((l) => LINE_WORD[l]))].sort((a, b) => b.length - a.length).join('|')})`;
const ORDINARY_NAME_WORDS = 'fess|pale|bend sinister|bend|chevron|cross|saltire|pile|pall';
/** The line a band or shape is written with after its name: "wavy", "embattled counter-embattled", "embattled on the lower edge". */
const ORDINARY_LINE = ` (?:embattled counter-embattled|${LINE})(?: on the (?:upper|lower|dexter|sinister) edge)?`;
/** An ordinary as the text spells it once its synonyms are settled: its name, inverted, its line, couped and where it runs, as far as it has them (the tincture follows). */
const ORDINARY = `(?:${ORDINARY_NAME_WORDS})(?: inverted)?(?:${ORDINARY_LINE})?(?: couped)?(?: (?:throughout|enhanced|abased))?(?: voided)?`;
/** The corner and edge shapes' names joined by the word the widget writes before them (`PERIPHERAL_JOINER`): ", a quarter", " and a base", " within an orle". */
const joinedBy = (joiner: PeripheralJoiner) => DRAWN_ORDINARIES.filter((t) => ORDINARY_KIND[t] !== 'central' && t !== 'chief' && t !== 'bordure' && PERIPHERAL_JOINER[t] === joiner).map((t) => ORDINARY_NAME[t]).join('|');
/** A top band or border, with its line. */
const PERIPHERAL = `(?:chief|bordure)(?:${ORDINARY_LINE})?`;
/** A bend, bendlets or a baton, and a bend sinister, bendlets sinister or a baton sinister: what a lone charge in chief or base stands beside in a corner. */
const BEND = '\\b(?:(?:a|two|three|four) bend(?:lets)?|a baton)(?! sinister\\b)\\b';
const BEND_SINISTER = '\\b(?:(?:a|two|three|four) bend(?:lets)?|a baton) sinister\\b';

const alt = (words: Iterable<string>) => [...new Set(words)].sort((a, b) => b.length - a.length).join('|');
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
const COTISES = '(?:doubly |triply )?cotised';
const OUTLINE_WORD = `(?:fimbriated|endorsed|${COTISES})`;
const OUTLINE = `(?: ${OUTLINE_WORD}(?: plain| ${LINE})?)`;
/** What a band is painted with: its tincture, then its outline and the tincture of that, or its outline and its tincture (" gules fimbriated Or", " cotised azure"). */
const BAND_PAINT = `(?: ${TINCT}(?:${OUTLINE}(?: ${TINCT})?)?|${OUTLINE}(?: ${TINCT})?)`;
const NOUN = alt(CHARGE_IDS.flatMap((id) => [CHARGES[id].name, CHARGES[id].plural]));
const POSTURE = alt([...POSTURES, ...CHARGE_IDS.flatMap((id) => (CHARGES[id].postures ?? []).map((p) => postureTerm(id, p)))]);
/** A charge group without its tincture or layout: "three wolves passant", "a sun in splendor". */
const CORE = `${NUMBER} (?:${NOUN})(?: (?:${POSTURE}))?(?: in splendor)?`;

const NAMED_BY_WORD = new Map(NAMED_TINCTURE_CHARGES.flatMap((n) => [[n.word, n], [n.plural, n]] as const));
const escaped = (words: Iterable<string>) => alt([...words].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
const ARRANGEMENT = `(?: in (?:annulo|saltire|cross|orle|pale|fess|bend sinister|bend))?(?: (?:${NUMBER_WORD})(?:, (?:${NUMBER_WORD}))* and (?:${NUMBER_WORD}))?`;
/** A named roundel or goutte, with what follows it in the group: an arrangement, and a tincture. */
const NAMED_CHARGE = new RegExp(`(?<![\\w-])(${escaped(NAMED_BY_WORD.keys())})(?![\\w-])(${ARRANGEMENT})( ${COLOUR}(?![\\w-]))?`, 'g');
/** The next tincture a text states, or a named roundel or goutte, whose name states one. */
const TINCTURE_OR_NAME = new RegExp(`(?<![\\w-])(${escaped([...TINCTURES, 'counterchanged', 'proper', ...FURS.map((f) => FUR_NAME[f]), ...NAMED_BY_WORD.keys()])})(?![\\w-])`);

/** How a divided field starts: "per pale", "quarterly". */
const DIVISION_START = `(?:per (?:pale|fess|bend sinister|bend|saltire|chevron(?: inverted| throughout)?|pall(?: inverted)?)(?: ${LINE})?|gyronny(?: ${LINE})?(?: of (?:six|eight|twelve))?|quarterly(?: per (?:pale|fess))?(?: ${LINE})?|tierced in (?:pale|fess)(?: ${LINE})?)`;
/** How a field divided in three starts: "per pall", "tierced in pale". */
const THREE_PART_START = `(?:per pall(?: inverted)?|tierced in (?:pale|fess))(?: ${LINE})?`;
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
      .replace(new RegExp(`(?<!\\b(?:cross|crosses|crosslet|saltire|saltires) )(?<!\\bper (?:pale|fess|bend sinister|bend|chevron) )(?<!\\b(?:fess|pale|bend sinister|bend|chevron|pile|chief|bordure) )(?<!\\b(?:quarterly|barry|paly|bendy|bendy sinister) )\\bpotenty (${COLOUR}) and (${COLOUR})\\b`, 'g'), (_m, a: string, b: string) => {
        const [x, y] = TINCTURES.indexOf(a as never) <= TINCTURES.indexOf(b as never) ? [a, b] : [b, a];
        return x === FUR_SPEC.potent.ground && y === FUR_SPEC.potent.spots ? 'potent' : `potenty ${x} and ${y}`;
      })
      .replace(/\b(vair|potent) en point\b/g, '$1 en pointe'),
  },
  {
    // 3a2. Lines of partition the SCA spells in more than one way (`LINE_SPELLINGS`), and the equivalence of RULES §A.3: a division has one
    //      line, so "per pale dancetty" is "per pale indented" (dancetty is a line of two-sided bands; the College draws a division's as indented).
    id: 'line-synonyms',
    description: 'undy → wavy, crenellated → embattled, nebulee → nebuly, ployee → ployé … (LINE_SPELLINGS); "per <division> dancetty", "quarterly (per pale|per fess) dancetty" and dancetty on a chief, bordure, base, canton, quarter, gyron, cross, saltire or pile → "… indented"; "a dance" → "a fess dancetty"; counter-embattled and "embattled on both edges" → "embattled counter-embattled".',
    apply: (s) => s
      .replace(/\b(a|an|on a) dance(?:tte?)?(?![\w-])/g, '$1 fess dancetty')
      .replace(LINE_SPELLING_WORD, (w) => LINE_WORD_OF.get(w)!)
      .replace(/\b(per (?:pale|fess|bend sinister|bend|saltire|chevron(?: inverted| throughout)?|pall(?: inverted)?)|gyronny|tierced in (?:pale|fess)|quarterly(?: per (?:pale|fess))?|(?:a|an) (?:chief|bordure|base|canton|quarter|gyron|cross|saltire|pile)) dancetty\b/g, '$1 indented')
      .replace(/(?<![\w-])(?<!embattled )counter-?embattled\b/g, 'embattled counter-embattled')
      .replace(/\bembattled on both edges\b/g, 'embattled counter-embattled'),
  },
  {
    // 3a2a. Fields divided in three (RULES-C §E.1, §G.2; PLAN-C C13): "tierced per pale" is the widget's "tierced in pale" (the College writes
    //      both); "tierced per pall" and "gyronny of three" are per pall (SENA A5G1b: "granted no difference"); the three tinctures take no
    //      serial comma ("Per pall argent, sable, and gules" is "… sable and gules", RULES-C §E.1), and the comma between the first two is
    //      written even where a record leaves it out ("Per pall inverted azure vert and Or").
    id: 'three-part-fields',
    description: 'tierced per pale/fess → tierced in pale/fess; tierced per/in pall, gyronny of three → per pall; "per pall A, B, and C" and "per pall A B and C" → "per pall A, B and C".',
    apply: (s) => s
      .replace(/\btierced (?:per|in) (pale|fess)e?\b/g, 'tierced in $1')
      .replace(/\b(?:tierced (?:per|in) pall|gyronny of three)\b/g, 'per pall')
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
        .replace(/\bbarrulets\b/g, 'bars').replace(/\bbarrulet\b/g, 'bar')
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
    description: 'humetty → couped after an ordinary; chevron reversed → chevron inverted; "<chevron|pile> <line> inverted" → "… inverted <line>"; "<ordinary> couped <line>" → "<ordinary> <line> couped"; "chevron inverted embattled" → "… embattled on the upper edge"; "throughout" after a cross or saltire dropped.',
    apply: (s) => s
      .replace(new RegExp(`\\b((?:${ORDINARY_NAME_WORDS})(?: inverted)?(?:${ORDINARY_LINE})?) humett(?:y|ee|é)(?![\\w-])`, 'g'), '$1 couped')
      .replace(/\b(chevrons?) reversed\b/g, '$1 inverted')
      .replace(new RegExp(`\\b(chevron|pile)(${ORDINARY_LINE}) inverted\\b`, 'g'), '$1 inverted$2')
      .replace(new RegExp(`\\b((?:${ORDINARY_NAME_WORDS})(?: inverted)?) couped(${ORDINARY_LINE})(?![\\w-])`, 'g'), '$1$2 couped')
      .replace(/(?<!per )\bchevron inverted embattled(?! counter-embattled| on the| grady)\b/g, 'chevron inverted embattled on the upper edge')
      .replace(new RegExp(`\\b((?:a|an|on a) (?:cross|saltire|pall|pall inverted|fret|label)(?:${ORDINARY_LINE})?(?: voided)?) throughout\\b`, 'g'), '$1'),
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
      .replace(new RegExp(`\\b(${ORDINARY_NAME_WORDS})((?: inverted)?(?:${ORDINARY_LINE})?) (${COTISES}(?: plain| ${LINE})?) (couped|throughout|enhanced|abased|voided)\\b`, 'g'), '$1$2 $4 $3')
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
    //     (the widget names a tincture shared by groups once, after the last).
    id: 'charge-synonyms',
    description: 'estoille → estoile; crosslet(s) → cross crosslet / crosses crosslet; bezant, plate, torteau, hurt, pellet, ogress, pomme, golpe, goutte d\'or / d\'eau / de sang / de larmes / de poix → the roundel or goutte and its tincture, after its arrangement and left out when the next tincture stated is the same.',
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
      .replace(/\bcross crosslets\b/g, 'crosses crosslet')
      .replace(/(?<!cross |crosses )\bcrosslets\b/g, 'crosses crosslet')
      .replace(/(?<!cross |crosses )\bcrosslet\b/g, 'cross crosslet'),
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
    // 3a5. Corner shapes written more than one way (RULES-C §C.3, §G.2; PLAN-C C8b): a canton, quarter or gyron is in the dexter corner unless
    //      it is said to be sinister, before its name ("a sinister canton", corpus 14) or after it ("a canton sinister", the widget's words).
    id: 'corner-shapes',
    description: '"a sinister canton/quarter/gyron" → "a canton/quarter/gyron sinister"; "a dexter canton/quarter/gyron" → "a canton/quarter/gyron".',
    apply: (s) => s
      .replace(/\b(a|an|on a) sinister (canton|quarter|gyron)\b/g, '$1 $2 sinister')
      .replace(/\b(a|an|on a) dexter (canton|quarter|gyron)\b/g, '$1 $2'),
  },
  {
    // 3a6. The orle, tressure, flaunches, gore and the dexter and sinister points written more than one way (RULES-C §C.3, §G.2; PLAN-C C9): a
    //      single tressure is an orle (Prec Gwynaeth 04/2004; corpus "a tressure" 27); flaunches are always a pair ("two flaunches" 95, "a pair
    //      of flaunches" 24: RULES-C §C.3, the widget writes "flaunches"); a gore issues from dexter unless it is said to be sinister, before its
    //      name ("a sinister gore" 34) or after it ("a gore sinister" 65, the widget's words); "a dexter point" is the widget's "a point dexter".
    id: 'peripheral-forms',
    description: '"a tressure" and "a orle" → "an orle"; "two flaunches", "a pair of flaunches" → "flaunches"; "a sinister gore" → "a gore sinister", "a dexter gore" → "a gore"; "a dexter/sinister point" → "a point dexter/sinister".',
    apply: (s) => s
      .replace(/\b(a|on a) (?:tressure|orle)\b/g, '$1n orle')
      .replace(/\b(?:two|a pair of) flaunches\b/g, 'flaunches')
      .replace(/\b(a|on a) sinister gore\b/g, '$1 gore sinister')
      .replace(/\b(a|on a) dexter gore\b/g, '$1 gore')
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
    apply: (s) => s.replace(new RegExp(`(^|, | and )((?:a|an) (?:${ORDINARY}|chief(?:${ORDINARY_LINE})?|${NOUN})(?: (?:${POSTURE}))?(?: in splendor)? ${TINCT}),? charged with `, 'g'), '$1on $2 '),
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
    // 7. Postures the College assumes may be stated or left out (Glossary Table 5): a lion or unicorn
    //    rampant, a dragon rampant/segreant, an eagle displayed, a fish naiant. Both sides drop them;
    //    the name always means that posture, so only a design that has it can match.
    id: 'stated-default-postures',
    description: 'Drop Table 5 default postures after the charge.',
    apply: (s) => s
      .replace(/\b(lions?|unicorns?) rampant\b/g, '$1')
      .replace(/\b(dragons?) (?:rampant|segreant)\b/g, '$1')
      .replace(/\b(eagles?) displayed\b/g, '$1')
      .replace(/\b(fish) naiant\b/g, '$1'),
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
      return divided.replace(/\beach (?=per (?:pale|fess|bend sinister|bend|saltire|chevron) |quarterly )/g, '');
    },
  },
];

export function normaliseBlazon(text: string): string {
  return NORMALISATION_RULES.reduce((s, rule) => rule.apply(s), text);
}
