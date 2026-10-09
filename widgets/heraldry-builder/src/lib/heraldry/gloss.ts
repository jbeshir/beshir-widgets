// Plain-English gloss (FINDINGS §4.5). Left/right always mean as you look at the shield.

import { CHARGES, POSTURE_GLOSS } from './charges';
import { NUMBER_WORD, bodyKind, type Arrangement, type Field, type NormChargeGroup, type NormDesign, type Ordinary, type OrdinaryType } from './design';
import { TINCTURE_GLOSS } from './tinctures';

export const ORDINARY_GLOSS: Record<OrdinaryType, string> = {
  fess: 'horizontal band across the middle',
  pale: 'vertical band down the middle',
  bend: 'diagonal band from top-left to bottom-right',
  'bend-sinister': 'diagonal band from top-right to bottom-left',
  chevron: 'upside-down V',
  cross: 'cross',
  saltire: 'X-shaped cross',
  chief: 'band across the top',
  bordure: 'border around the edge',
  pile: 'downward-pointing wedge from the top',
};

export const ARRANGEMENT_GLOSS: Partial<Record<Arrangement, string>> = {
  'in-pale': 'in a vertical line',
  'in-fess': 'in a row',
  'in-bend': 'in a diagonal line from top-left',
  'in-bend-sinister': 'in a diagonal line from top-right',
  'two-and-one': 'two above one',
  'two-and-two': 'in two rows of two',
  'in-cross': 'in a cross pattern',
  'in-saltire': 'in an X pattern',
  'three-two-one': 'in rows of three, two and one',
};

/** "a" / "an" chosen from the word that follows (colour words all start with consonants today). */
function article(next: string): string {
  return /^[aeiou]/i.test(next) ? 'an' : 'a';
}

export function fieldGloss(field: Field): string {
  if (field.kind === 'plain') {
    const c = TINCTURE_GLOSS[field.tincture];
    return `${article(c) === 'an' ? 'An' : 'A'} ${c} shield`;
  }
  const [c1, c2] = field.tinctures.map((t) => TINCTURE_GLOSS[t]);
  switch (field.division) {
    case 'per-pale': return `A shield split vertically, ${c1} on the left and ${c2} on the right`;
    case 'per-fess': return `A shield split horizontally, ${c1} on top and ${c2} below`;
    case 'per-bend': return `A shield split diagonally from top-left to bottom-right, ${c1} above and ${c2} below`;
    case 'per-bend-sinister': return `A shield split diagonally from top-right to bottom-left, ${c1} above and ${c2} below`;
    case 'per-saltire': return `A shield divided by an X, ${c1} top and bottom and ${c2} left and right`;
    case 'per-chevron': return `A shield divided by an upside-down V, ${c1} above and ${c2} below`;
    case 'quarterly': return `A shield divided into four quarters, ${c1} top-left and bottom-right, ${c2} top-right and bottom-left`;
  }
}

export function ordinaryGloss(o: Ordinary): string {
  const c = TINCTURE_GLOSS[o.tincture];
  return `${article(c)} ${c} ${ORDINARY_GLOSS[o.type]}`;
}

/** "three green unicorns rearing up", "three red five-pointed stars, two above one". */
export function chargesGloss(g: NormChargeGroup): string {
  const meta = CHARGES[g.charge];
  const c = TINCTURE_GLOSS[g.tincture];
  let s = `${g.count === 1 ? article(c) : NUMBER_WORD[g.count]} ${c} ${g.count === 1 ? meta.glossName : meta.glossPlural}`;
  const pg = g.posture ? POSTURE_GLOSS[g.posture] : null;
  if (pg) s += ` ${pg}`;
  const ag = ARRANGEMENT_GLOSS[g.arrangement];
  if (ag) s += `, ${ag}`;
  return s;
}

export function gloss(nd: NormDesign): string {
  const field = fieldGloss(nd.field);
  const joiner = nd.field.kind === 'plain' ? ' with ' : ', with ';
  const o = nd.ordinary, c = nd.charges;
  let rest: string;
  switch (bodyKind(nd)) {
    case 'none': return `${field}.`;
    case 'ordOnly': rest = ordinaryGloss(o!); break;
    case 'chargesOnly': rest = chargesGloss(c!); break;
    case 'onOrd': rest = `${ordinaryGloss(o!)}, carrying ${chargesGloss(c!)}`; break;
    case 'between': rest = `${ordinaryGloss(o!)} between ${chargesGloss(c!)}`; break;
    case 'withChief':
    // A trailing arrangement clause ("…, two above one") takes a comma before "and" (V11).
    case 'withBordure': rest = `${chargesGloss(c!)}${ARRANGEMENT_GLOSS[c!.arrangement] ? ',' : ''} and ${ordinaryGloss(o!)}`; break;
  }
  return `${field}${joiner}${rest}.`;
}
