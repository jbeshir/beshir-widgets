// Text normaliser applied identically to an SCA blazon and to the widget's own blazon() before the
// two are compared (see match.ts). The widget words every design in SCA house style, so this only
// bridges differences of *spelling and punctuation* and three conventions the SCA and the Glossary
// of Terms declare equivalent. None of the rules can make two blazons of different designs compare
// equal: tinctures, counts, charge names, arrangements and postures are never dropped, except the
// name of a posture Table 5 makes the charge's own default (rule 6: "a lion rampant" is "a lion",
// whatever stands around it). A stated Table 7 arrangement is not text the normaliser drops: the
// matcher compares the SCA text with the widget's blazon of the same design with its defaults
// stated as well (match.ts), which is a statement about one design and so can't equate two.
//
// Rules run in the listed order; each carries an id so the report and the armorial test can cite it
// (NORMALISATION_RULES). Rules 4–6 are conventions, not spellings: the widget's emitter picks one of
// the equivalent forms and O&A uses both, so without them records the widget can express would not
// match. Delete a rule here to see how many records depend on it.
import { CHARGES, CHARGE_IDS, POSTURES, postureTerm } from '../../src/lib/heraldry';
import { TINCTURES } from '../../src/lib/heraldry';

export interface NormalisationRule {
  id: string;
  description: string;
  apply: (text: string) => string;
}

const TINCT = `(?:${TINCTURES.join('|')}|counterchanged)`;
const NUMBER = '(?:a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const ORDINARY = '(?:fess|pale|bend sinister|bend|chevron|cross|saltire|pile)';

const alt = (words: Iterable<string>) => [...new Set(words)].sort((a, b) => b.length - a.length).join('|');
const NOUN = alt(CHARGE_IDS.flatMap((id) => [CHARGES[id].name, CHARGES[id].plural]));
const POSTURE = alt([...POSTURES, ...CHARGE_IDS.flatMap((id) => (CHARGES[id].postures ?? []).map((p) => postureTerm(id, p)))]);
/** A charge group without its tincture or layout: "three wolves passant", "a sun in splendor". */
const CORE = `${NUMBER} (?:${NOUN})(?: (?:${POSTURE}))?(?: in splendor)?`;

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
    // 4. Connectors the Glossary treats as the same: "X and a chief Y", "X, a chief Y"; "within a
    //    bordure", "and a bordure", ", a bordure"; "on a bend, three…" and "on a bend three…"; "on a
    //    fess between two crescents argent, three mullets" and "… argent three mullets" (RULES §F.2: no
    //    comma is the house style, a comma is occasionally used for clarity); and the comma that closes
    //    the field, which a few records omit. Every element and tincture stays.
    id: 'equivalent-connectors',
    description: '"and a chief/bordure", "within a bordure" → ", a chief/bordure"; no comma after "on a <ordinary> <tincture>" or after the tincture of what is set between it and a group on it; restore the comma after the field.',
    apply: (s) => s
      .replace(/,? and (?=(?:a|on a) chief\b)/g, ', ')
      .replace(/,? (?:and|within) (?=a bordure\b)/g, ', ')
      .replace(new RegExp(`\\b(on a (?:${ORDINARY}|chief) ${TINCT}),`, 'g'), '$1')
      .replace(new RegExp(`(\\bon (?:a|an) ${ORDINARY} (?:${TINCT} )?between [^,]*? ${TINCT}), (?=(?:a|an|${NUMBER}) (?:${NOUN})\\b)`, 'g'), '$1 ')
      .replace(new RegExp(`^((?:per (?:pale|fess|bend sinister|bend|saltire|chevron)|quarterly) ${TINCT} and ${TINCT}|${TINCT}) (?=(?:a|an|on|${NUMBER}|in) )`), '$1, '),
  },
  {
    // 5. Where the placement words go: the SCA writes "two keys in pale" as often as "in pale two
    //    keys" (Bruce); the widget puts lines and positions first and patterns after.
    id: 'arrangement-placement',
    description: '"<group> in pale/fess/bend/bend sinister" → "in … <group>"; "in saltire/cross <group>" → "<group> in saltire/cross".',
    apply: (s) => s
      .replace(new RegExp(`\\b(${CORE}) in (pale|fess|bend sinister|bend)\\b`, 'g'), 'in $2 $1')
      .replace(new RegExp(`\\bin (saltire|cross) (${CORE})\\b`, 'g'), '$2 in $1'),
  },
  {
    // 6. Postures the College assumes may be stated or left out (Glossary Table 5): a lion or unicorn
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
];

export function normaliseBlazon(text: string): string {
  return NORMALISATION_RULES.reduce((s, rule) => rule.apply(s), text);
}
