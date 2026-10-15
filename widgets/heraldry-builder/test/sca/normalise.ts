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
import { CHARGES, CHARGE_IDS, DRAWN_TREATMENTS, NAMED_TINCTURE_CHARGES, SEMY_NAMES, SEMY_SPELLINGS, FURS, FUR_NAME, POSTURES, TINCTURES, VARIATIONS, VARIATION_NAME, isCountedVariation, postureTerm } from '../../src/lib/heraldry';

export interface NormalisationRule {
  id: string;
  description: string;
  apply: (text: string) => string;
}

const COLOUR = `(?:${TINCTURES.join('|')})`;

const NUMBER = '(?:a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const NUMBER_WORD = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
const ORDINARY = '(?:fess|pale|bend sinister|bend|chevron|cross|saltire|pile)';

const alt = (words: Iterable<string>) => [...new Set(words)].sort((a, b) => b.length - a.length).join('|');
/** A fur as the text spells it once its synonyms are settled: a named fur, "argent ermined gules", "vairy Or and gules". */
const FUR = `(?:${COLOUR} ermined ${COLOUR}|(?:vairy|potenty) ${COLOUR} and ${COLOUR}|${alt(FURS.map((f) => FUR_NAME[f]))})`;
/** A variation of the field as the text spells it once its synonyms are settled, with its stripe count when it has one: "barry of eight", "checky". */
const VARIATION = `(?:${alt(VARIATIONS.map((v) => VARIATION_NAME[v]))})(?: of ${NUMBER})?`;
/** A treated tincture as the text spells it: "argent masoned sable". */
const TREATED = `${COLOUR} (?:${DRAWN_TREATMENTS.join('|')}) ${COLOUR}`;
const TINCT = `(?:${FUR}|${TREATED}|${COLOUR}|counterchanged|proper)`;
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
const DIVISION_START = '(?:per (?:pale|fess|bend sinister|bend|saltire|chevron)|quarterly)';
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
const SEMY_AFTER_BAND = new RegExp(`(\\b(?:a|an) (?:${ORDINARY}|chief|bordure) ${TINCT}), (?=semy of )`, 'g');
const SEMY_ALL_AFTER_COMMA = new RegExp(`^(${DIVISION_START} ${COLOUR} and ${COLOUR}), (?:all )?(?=semy of )`);
const SEMY_ALL_COUNTERCHANGED = new RegExp(`^(${DIVISION_START} ${COLOUR} and ${COLOUR}) (?=semy of (?:${NOUN}) counterchanged)`);
/** The strewn charges "semy of <charges>" that no tincture follows, and the next tincture a text states. */
const BARE_SEMY = new RegExp(`\\bsemy of (${NOUN})(?![\\w-])(?! (?:${COLOUR}|counterchanged|proper)(?![\\w-]))`, 'g');
const NEXT_COLOUR = new RegExp(`(?<![\\w-])${COLOUR}(?![\\w-])`);


/** The named ermine-family furs by their ground and spots: the tinctures "ermined" spells them with. */
const FOLDED_ERMINES: Record<string, string> = { 'argent sable': 'ermine', 'or sable': 'erminois', 'sable argent': 'counter-ermine', 'sable or': 'pean' };

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
    description: 'ermines → counter-ermine; argent/Or ermined sable and sable ermined argent/Or → ermine, erminois, counter-ermine, pean; vairy/potenty argent and azure → vair/potent; potenty A and B in palette order; en point → en pointe.',
    apply: (s) => s
      .replace(/\bermines\b/g, 'counter-ermine')
      .replace(/\b(argent|or|sable) ermined (sable|argent|or)\b/g, (m, a: string, b: string) => FOLDED_ERMINES[`${a} ${b}`] ?? m)
      .replace(/\bvairy argent and azure\b/g, 'vair')
      .replace(new RegExp(`(?<!\\b(?:cross|crosses|crosslet|saltire|saltires) )\\bpotenty (${COLOUR}) and (${COLOUR})\\b`, 'g'), (_m, a: string, b: string) => {
        const [x, y] = TINCTURES.indexOf(a as never) <= TINCTURES.indexOf(b as never) ? [a, b] : [b, a];
        return x === 'argent' && y === 'azure' ? 'potent' : `potenty ${x} and ${y}`;
      })
      .replace(/\b(vair|potent) en point\b/g, '$1 en pointe'),
  },
  {
    // 3b. Variations the SCA spells in more than one way. "Chevronny" is chevronelly (the College's word: SENA A5F1b), "chequy" and "fusilly" are checky and fusily; the
    //     barry-bendy pair is written without a hyphen; and the usual six stripes need not be stated ("barry of six" is barry: the
    //     emitter leaves out a default it has, SENA A5G1d counts pieces only up to four).
    id: 'variation-synonyms',
    description: 'chevronny → chevronelly; chequy → checky; fusilly → fusily; barry-bendy, paly-bendy → barry bendy, paly bendy; "<counted variation> of six" → "<counted variation>".',
    apply: (s) => s
      .replace(/\bchevronny\b/g, 'chevronelly')
      .replace(/\bchequy\b/g, 'checky')
      .replace(/\bfusilly\b/g, 'fusily')
      .replace(/\b(barry|paly)-bendy\b/g, '$1 bendy')
      .replace(new RegExp(`\\b(${alt(VARIATIONS.filter(isCountedVariation).map((v) => VARIATION_NAME[v]))}) of six\\b`, 'g'), '$1'),
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
    // 4. Connectors the Glossary treats as the same: "X and a chief Y", "X, a chief Y"; "within a
    //    bordure", "all within a bordure", "and a bordure", ", a bordure"; "on a bend, three…" and "on a bend three…"; "on a
    //    fess between two crescents argent, three mullets" and "… argent three mullets" (RULES §F.2: no
    //    comma is the house style, a comma is occasionally used for clarity); "a lion and in chief three
    //    mullets" and "a lion, in chief three mullets" (RULES §F.2 secondary connectors: the LoARs use both,
    //    and a tincture is factored across either); and the comma that closes the field, which a few records
    //    omit. Every element and tincture stays.
    id: 'equivalent-connectors',
    description: '"and a chief/bordure", "within a bordure", "all within a bordure" → ", a chief/bordure"; "and in chief/base/canton" → ", in chief/base/canton"; no comma after "on a <ordinary> <tincture>" or after the tincture of what is set between it and a group on it; restore the comma after the field.',
    apply: (s) => s
      .replace(/,? and (?=(?:a|on a) chief\b)/g, ', ')
      .replace(/,? and (?=in (?:chief|base|canton)\b)/g, ', ')
      .replace(/,? (?:and|(?:all )?within) (?=a bordure\b)/g, ', ')
      .replace(new RegExp(`\\b(on (?:(?:a|an) (?:${ORDINARY}|chief)|${CORE}) ${TINCT}),`, 'g'), '$1')
      .replace(new RegExp(`(\\bon (?:a|an) ${ORDINARY} (?:${TINCT} )?between [^,]*? ${TINCT}), (?=(?:a|an|${NUMBER}) (?:${NOUN})\\b)`, 'g'), '$1 ')
      .replace(new RegExp(`^((?:per (?:pale|fess|bend sinister|bend|saltire|chevron)|quarterly) ${TINCT} and ${TINCT}|${VARIATION} ${COLOUR} and ${COLOUR}|${TINCT}) (?=(?:a|an|on|${NUMBER}|in) )`), '$1, '),
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
    apply: (s) => s.replace(new RegExp(`(^|, | and )((?:a|an) (?:${ORDINARY}|chief|${NOUN})(?: (?:${POSTURE}))?(?: in splendor)? ${TINCT}),? charged with `, 'g'), '$1on $2 '),
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
      const field = new RegExp(`^(per (?:pale|fess|bend sinister|bend|saltire|chevron)|quarterly) ${TINCT} and ${TINCT}, `).exec(s);
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
