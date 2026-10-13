// Text normaliser applied identically to an SCA blazon and to the widget's own blazon() before the
// two are compared (see match.ts). It is deliberately minimal: each rule below removes a difference
// of *wording* that the SCA's own conventions say carries no meaning, and none of them can make two
// blazons of different designs compare equal. Tinctures, counts, charge names, postures and
// arrangements are never dropped — where a convention leaves something implied (a default posture,
// an omitted tincture) the rule writes it out, so both sides meet at the fully stated form.
//
// Rules run in the listed order; each is numbered in its comment and carries an id so the report and
// the armorial test can cite it (NORMALISATION_RULES).
import { CHARGES, type ChargeId } from '../../src/lib/heraldry/charges';
import { TINCTURES } from '../../src/lib/heraldry/tinctures';

export interface NormalisationRule {
  id: string;
  description: string;
  apply: (text: string) => string;
}

const TINCT = `(?:${TINCTURES.join('|')}|counterchanged)`;
const NUMBER = '(?:two|three|four|five|six)';
const ARR = '(?:in pale|in fess|in bend sinister|in bend|in cross|in saltire)';

const nouns = (ids: readonly ChargeId[]) => ids.flatMap((id) => [CHARGES[id].name, CHARGES[id].plural]);
const alt = (words: readonly string[]) => [...new Set(words)].sort((a, b) => b.length - a.length).join('|');

/**
 * SCA default postures, SCA Glossary of Terms Table 5: lion and unicorn rampant, dragon "segreant
 * (rampant) to dexter", eagle displayed, fish naiant (the O&A index headings agree, filing an
 * unqualified lion, unicorn or dragon as "rampant to dexter"). Table 5 gives no default for a wolf,
 * boar, stag, goat or hare, so those must be blazoned with a posture to match. Only charges the
 * widget can draw are listed. (An owl's default, close guardant, is unblazoned in both.)
 */
const DEFAULT_POSTURE: readonly { posture: string; nouns: string }[] = [
  { posture: 'rampant', nouns: alt(nouns(['lion', 'unicorn', 'dragon'])) },
  { posture: 'displayed', nouns: alt(nouns(['eagle'])) },
  { posture: 'naiant', nouns: alt(nouns(['fish'])) },
];

/** Every posture term the widget or the SCA uses directly after a charge name. */
const ORDINARY = '(?:fess|pale|bend sinister|bend|chevron|cross|saltire|pile)';
const ALL_NOUNS = alt(nouns(Object.keys(CHARGES) as ChargeId[]));
const POSTURE_WORD = '(?:rampant|passant|statant|sejant|naiant|haurient|displayed|segreant|trippant|courant)';

/** The first tincture word at or after `from`, or null. */
function nextTincture(text: string, from: number): string | null {
  const m = new RegExp(`\\b${TINCT}\\b`).exec(text.slice(from));
  return m ? m[0] : null;
}

/** Insert the next stated tincture after every match of `re` (whose match ends where the tincture is missing). */
function supplyTincture(text: string, re: RegExp): string {
  let out = '', last = 0;
  for (const m of text.matchAll(re)) {
    const end = m.index + m[0].length;
    const t = nextTincture(text, end);
    if (!t) continue;
    out += text.slice(last, end) + ' ' + t;
    last = end;
  }
  return out + text.slice(last);
}

export const NORMALISATION_RULES: readonly NormalisationRule[] = [
  {
    // 1. The SCA ends every blazon with a full stop; the widget never does. A sentence end is not a
    //    heraldic term.
    id: 'final-full-stop',
    description: 'Drop a trailing full stop.',
    apply: (s) => s.replace(/\.$/, ''),
  },
  {
    // 2. Capitalisation carries no heraldic meaning: the widget capitalises every tincture, the SCA
    //    only "Or" and the first word. ("or" as a conjunction does not occur in either.)
    id: 'case',
    description: 'Lower-case everything.',
    apply: (s) => s.toLowerCase(),
  },
  {
    // 3. A handful of SCA records omit the comma that closes the field ("Per pale Or and gules three
    //    suns counterchanged"). The field is a complete phrase either way; the comma is restored only
    //    where a plain or two-tincture field is directly followed by the start of the next element.
    id: 'field-comma',
    description: 'Restore a missing comma after the field.',
    apply: (s) => s.replace(new RegExp(`^((?:per (?:pale|fess|bend sinister|bend|saltire|chevron)|quarterly) ${TINCT} and ${TINCT}|${TINCT}) (?=(?:a|an|on|${NUMBER}) )`), '$1, '),
  },
  {
    // 4. Spelling variants of one term. "fleur-de-lys" (the usual SCA spelling) and "fleur-de-lis"
    //    (the widget's) are the same charge; "hauriant" and "haurient" the same posture. Both
    //    spellings are listed in the SCA Glossary of Terms.
    id: 'spelling',
    description: 'fleur(s)-de-lys → fleur(s)-de-lis; hauriant → haurient.',
    apply: (s) => s.replace(/\bfleur(s?)-de-lys\b/g, 'fleur$1-de-lis').replace(/\bhauriant\b/g, 'haurient'),
  },
  {
    // 5. "X and a chief Y" and "X, a chief Y" both list a chief beside the field's charges; the SCA
    //    uses either. Only the joining word changes — every element and tincture stays.
    id: 'chief-join',
    description: '"(,) and a chief" → ", a chief".',
    apply: (s) => s.replace(/,? and a chief\b/g, ', a chief'),
  },
  {
    // 6. "X within a bordure Y", "X and a bordure Y" and "X, a bordure Y" all mean the same
    //    bordure around the same charges. The comma that ends the field is left alone ("Gules, a
    //    bordure Or" stays), so a bordure-only design is untouched.
    id: 'bordure-join',
    description: '"X, a bordure" / "X and a bordure" / "X, and a bordure" → "X within a bordure" (not after the field).',
    apply: (s) => {
      const i = s.indexOf(', ');
      if (i < 0) return s;
      return s.slice(0, i + 2) + s.slice(i + 2).replace(/(?:,? and|,) a bordure\b/g, ' within a bordure');
    },
  },
  {
    // 7. SCA convention: "tinctures factor backward through the blazon" (Laurel, 08/1986) — an
    //    element blazoned without a tincture takes the next tincture named ("Azure, a chevron
    //    between three mullets Or": chevron and mullets Or). Writing the implied tincture out makes
    //    it explicit, as the widget always is; nothing is removed. Applied to an ordinary directly
    //    followed by "between", and to a charge group directly followed by "and", "within" or a comma.
    id: 'implied-tincture',
    description: 'Supply an omitted tincture from the next one stated (SCA: an untinctured element takes the next tincture).',
    apply: (s) => {
      const head = s.indexOf(', ');
      if (head < 0) return s;
      let body = s.slice(head + 2);
      body = supplyTincture(body, new RegExp(`\\ba ${ORDINARY}(?= between )`, 'g'));
      body = supplyTincture(body, new RegExp(`\\b(?:a|an|${NUMBER}) (?:${ALL_NOUNS})(?: ${POSTURE_WORD})?(?: ${ARR})?(?=,| and | within )`, 'g'));
      return s.slice(0, head + 2) + body;
    },
  },
  {
    // 8. Word order of an arrangement: the SCA writes "in fess two mullets Or" as often as "two
    //    mullets in fess Or"; the widget always puts the arrangement after the charge and posture,
    //    before the tincture. The same words describe the same group; only their order changes.
    id: 'arrangement-order',
    description: '"in <arrangement> <n> <charge…> <tincture>" → "<n> <charge…> in <arrangement> <tincture>".',
    apply: (s) => s.replace(new RegExp(`\\b(${ARR}) (${NUMBER} (?:${ALL_NOUNS})(?: ${POSTURE_WORD})?) (${TINCT})\\b`, 'g'), '$2 $1 $3'),
  },
  {
    // 9. SCA default postures: a lion, unicorn or dragon with no posture is rampant, an eagle
    //    displayed and a fish naiant (see DEFAULT_POSTURE). The widget always states the posture;
    //    writing the SCA default out lets "a lion Or" meet "a lion rampant Or". Inserted only where
    //    the charge name is directly followed by a tincture or an arrangement, i.e. where no posture
    //    word was given.
    id: 'default-posture',
    description: 'Write out the SCA default posture (Glossary Table 5): lion/unicorn/dragon rampant, eagle displayed, fish naiant.',
    apply: (s) => DEFAULT_POSTURE.reduce(
      (acc, { posture, nouns: n }) => acc.replace(new RegExp(`(?<![-'\\w])(${n}) (?=(?:${TINCT}|${ARR})\\b)`, 'g'), `$1 ${posture} `),
      s,
    ),
  },
  {
    // 10. Posture synonyms by charge: "segreant" is rampant said of a winged monster (SCA Glossary
    //     Table 5: dragon "segreant (rampant)"), "trippant" is passant said of a deer (the standard
    //     heraldic term; the widget's own charge table words a passant stag "trippant"). The widget
    //     writes the charge-specific term; the SCA uses both. Same posture, same charge. (The
    //     widget's other charge-specific term, a hare "courant", is running, not passant, so it is
    //     deliberately not a synonym here.)
    id: 'posture-synonym',
    description: 'dragon(s) rampant → segreant; stag(s) passant → trippant.',
    apply: (s) => s.replace(/\b(dragons?) rampant\b/g, '$1 segreant').replace(/\b(stags?) passant\b/g, '$1 trippant'),
  },
  {
    // 11. Some SCA blazons set off charges on an ordinary with a comma ("on a chief argent, three
    //     mullets"); the widget does not. The comma is punctuation inside one phrase — "on a <X>
    //     <tincture>" can only be followed by what lies on it.
    id: 'on-ordinary-comma',
    description: 'Drop the comma after "on a <ordinary> <tincture>".',
    apply: (s) => s.replace(new RegExp(`\\b(on a (?:${ORDINARY}|chief) ${TINCT}),`, 'g'), '$1'),
  },
];

export function normaliseBlazon(text: string): string {
  return NORMALISATION_RULES.reduce((s, rule) => rule.apply(s), text);
}
