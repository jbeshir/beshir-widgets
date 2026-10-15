// Everyday wording paired with the heraldic term, for the builder, filters and explainer. Most labels
// lead with the everyday words ("Split down the middle · per pale"); the field and band tiles show
// the term and keep the words for their tooltip. The blazon keeps the heraldic names in blazon.ts;
// these are display text only. Pure data — no DOM.

import { CHARGES, postureGloss, postureTerm, type ChargeId, type Posture } from './charges';
import { groupAt, hostOf, type Design, type GroupPath } from './design';
import type { Division } from './divisions';
import type { LayoutKey } from './arrangement';
import { ORDINARY_KIND, ORDINARY_NAME, type OrdinaryType } from './ordinaries';
import { DIVISION_NAME } from './divisions';
import { TINCTURES, TINCTURE_NAME, TINCTURE_WORD, type Tincture } from './tinctures';
import { isSecondaryPosition, layoutOfKey, layoutWords, primaryCharges } from './arrangement';
import type { PlaceKey } from './places';
import type { GroupTincture } from './design';
import { joinAnd, numberWord, capitalise } from './words';

/** A label in everyday words and the heraldic term for the same thing. */
export interface PlainTerm {
  plain: string;
  term: string;
}

/** "Split down the middle · per pale". */
export function plainFirst({ plain, term }: PlainTerm): string {
  return `${plain} · ${term}`;
}

const DIVISION_PLAIN: Record<Division, string> = {
  'per-pale': 'Split down the middle',
  'per-fess': 'Split across',
  'per-bend': 'Split diagonally ↘',
  'per-bend-sinister': 'Split diagonally ↗',
  'per-saltire': 'Split in an X',
  'per-chevron': 'Split in a peak',
  quarterly: 'Four quarters',
  'per-chevron-inverted': 'Split in a valley',
  'per-pall': 'Split in a Y',
  'per-pall-inverted': 'Split in an upside-down Y',
  'tierced-per-pale': 'Three vertical stripes',
  'tierced-per-fess': 'Three horizontal stripes',
  gyronny: 'Split into wedges',
};

const ORDINARY_PLAIN: Record<OrdinaryType, string> = {
  fess: 'Horizontal band',
  pale: 'Vertical band',
  bend: 'Diagonal band ↘',
  'bend-sinister': 'Diagonal band ↗',
  chevron: 'Peaked band',
  cross: 'Cross',
  saltire: 'X-shaped cross',
  chief: 'Top bar',
  bordure: 'Border',
  pile: 'Wedge',
  base: 'Bottom bar',
  canton: 'Corner square',
  quarter: 'Corner quarter',
  orle: 'Inner border',
  tressure: 'Thin inner border',
  flaunches: 'Side curves',
  gore: 'Curved wedge',
  pall: 'Y-shaped band',
  'pall-inverted': 'Upside-down Y band',
  point: 'Pointed base',
  fret: 'Woven diamond',
  label: 'Bar with tabs',
  gyron: 'Triangle wedge',
  mount: 'Hill',
  trimount: 'Three hills',
  bar: 'Narrow horizontal band',
  barrulet: 'Thin horizontal band',
  pallet: 'Narrow vertical band',
  bendlet: 'Narrow diagonal band ↘',
  'bendlet-sinister': 'Narrow diagonal band ↗',
  chevronel: 'Narrow peaked band',
  saltorel: 'Narrow X-shaped cross',
  baton: 'Short diagonal bar',
};

/** Pair each key's everyday words with its heraldic name from the model's own table. */
function withTerms<K extends string>(plain: Record<K, string>, name: Record<K, string>): Record<K, PlainTerm> {
  return Object.fromEntries((Object.keys(plain) as K[]).map((k) => [k, { plain: plain[k], term: name[k] }])) as Record<K, PlainTerm>;
}

export const DIVISION_LABEL: Record<Division, PlainTerm> = withTerms(DIVISION_PLAIN, DIVISION_NAME);
export const ORDINARY_LABEL: Record<OrdinaryType, PlainTerm> = withTerms(ORDINARY_PLAIN, ORDINARY_NAME);

/** Everyday words for the layouts with a fixed label, by layout key; rows are worded from their numbers (`layoutLabel`). */
const LAYOUT_PLAIN: Record<string, string> = {
  single: 'Single, centred',
  host: 'Set by the band or shape',
  'in-pale': 'Stacked up and down',
  'in-fess': 'Side by side',
  'in-bend': 'Along a diagonal ↘',
  'in-bend-sinister': 'Along a diagonal ↗',
  'in-cross': 'In a plus shape',
  'in-saltire': 'In an X',
  'in-orle': 'Around the edge',
  'in-annulo': 'In a ring',
  crossed: 'Crossed like an X',
  'in-chief': 'Along the top',
  'in-base': 'Along the bottom',
  'single@canton': 'In the top corner',
  'single@dexter': 'In the left half',
  'single@sinister': 'In the right half',
  'single@dexter-chief': 'In the top-left quarter',
  'single@sinister-chief': 'In the top-right quarter',
  'single@dexter-base': 'In the bottom-left quarter',
  'single@sinister-base': 'In the bottom-right quarter',
  'in-fess@canton': 'In a row in the top corner',
};

/** Where a layout set in chief, in base or in canton stands, by the position in its key. */
const PLACE_WORDS: Readonly<Record<string, string>> = {
  chief: 'along the top', base: 'along the bottom', canton: 'in the top corner',
  dexter: 'in the left half', sinister: 'in the right half',
  'dexter-chief': 'in the top-left quarter', 'sinister-chief': 'in the top-right quarter', 'dexter-base': 'in the bottom-left quarter', 'sinister-base': 'in the bottom-right quarter',
};

const ROW_PLAIN: Record<string, string> = {
  '2-1': 'Two above, one below',
  '2-2': 'Two above, two below',
  '1-2': 'One above, two below',
  '3-2-1': 'Three, two, one',
};

/** The label of a layout key: its everyday words and its blazon words. Rows without words of their own read "Rows of 2, 2 and 1 · two, two and one". */
export function layoutLabel(key: LayoutKey): PlainTerm {
  const layout = layoutOfKey(key, 2);
  if (!layout) throw new RangeError(`No label for the layout "${key}".`);
  const term = layoutWords(layout);
  const fixed = LAYOUT_PLAIN[key];
  if (fixed) return { plain: fixed, term };
  // A pattern set in chief, in base or in canton: the pattern's words and where it stands ("Two above, one below, along the top").
  const [base, at] = key.split('@');
  const where = at === undefined ? undefined : PLACE_WORDS[at];
  if (where) {
    const pattern = layoutLabel(base);
    return { plain: `${pattern.plain}, ${where}`, term: `in ${at} ${pattern.term}` };
  }
  const rows = /^rows-(\d+(?:-\d+)*)$/.exec(key)?.[1];
  if (!rows) throw new RangeError(`No label for the layout "${key}".`);
  return { plain: ROW_PLAIN[rows] ?? `Rows of ${joinAnd(rows.split('-'))}`, term };
}

/** Tinctures: the colour people see first, the heraldic name second ("Gold · Or"). */
export const TINCTURE_LABEL: Record<GroupTincture, PlainTerm> = {
  ...(Object.fromEntries(TINCTURES.map((t) => [t, { plain: capitalise(TINCTURE_WORD[t]), term: TINCTURE_NAME[t] }])) as Record<Tincture, PlainTerm>),
  counterchanged: { plain: 'Swapped colours', term: 'counterchanged' },
};

/** Charges whose heraldic name isn't an everyday word; the rest are already plain ("lion", "key"). */
const CHARGE_PLAIN: Readonly<Partial<Record<ChargeId, { one: string; many: string }>>> = {
  mullet: { one: 'star', many: 'stars' },
  crescent: { one: 'moon', many: 'moons' },
  'fleur-de-lis': { one: 'lily', many: 'lilies' },
};

/** A charge for a picker or filter: "Star · mullet", or just "Lion" where the name is plain already. */
export function chargeLabel(id: ChargeId): string {
  const plain = CHARGE_PLAIN[id];
  return plain ? plainFirst({ plain: capitalise(plain.one), term: CHARGES[id].name }) : capitalise(CHARGES[id].name);
}

/** A charge in a sentence, plain word first: "a lion", "three stars (mullets)". */
export function chargeWords(id: ChargeId, count: number): string {
  const meta = CHARGES[id];
  const plain = CHARGE_PLAIN[id];
  const heraldic = count === 1 ? meta.name : meta.plural;
  return plain ? `${count === 1 ? plain.one : plain.many} (${heraldic})` : heraldic;
}

/** An ordinary in a sentence, plain first: "horizontal band (fess)", "cross". */
export function ordinaryWords(type: OrdinaryType): string {
  const { plain, term } = ORDINARY_LABEL[type];
  const lower = plain.toLowerCase();
  return lower === term ? term : `${lower} (${term})`;
}

/** Posture words, plain first: "Standing (statant)". Displayed has no everyday gloss of its own. */
export function postureLabel(id: ChargeId, posture: Posture, note: string | null = null): string {
  const term = postureTerm(id, posture);
  const plain = postureGloss(id, posture) ?? (posture === 'displayed' ? 'wings spread' : null);
  return plain ? `${capitalise(plain)} (${[term, note].filter(Boolean).join(', ')})` : `${capitalise(term)}${note ? ` (${note})` : ''}`;
}

/** What each place of the builder is called, in everyday words and as heraldry has it. */
export const PLACE_LABEL: Record<PlaceKey, PlainTerm> = {
  ordinary: { plain: 'Band or shape', term: 'ordinary' },
  picture: { plain: 'Picture', term: 'charge' },
  'co-primary': { plain: 'Second picture', term: 'second main charge' },
  'on-picture': { plain: 'Pictures on the picture', term: 'charges on the charge' },
  around: { plain: 'Pictures around the picture', term: 'charges between' },
  'in-chief': { plain: 'Pictures along the top', term: 'charges in chief' },
  'in-base': { plain: 'Pictures along the bottom', term: 'charges in base' },
  'in-canton': { plain: 'Pictures in the top corner', term: 'charges in canton' },
  'on-ordinary': { plain: 'Extra pictures', term: 'charges on the ordinary' },
  chief: ORDINARY_LABEL.chief,
  'on-chief': { plain: 'Pictures on the top bar', term: 'charges on the chief' },
  bordure: ORDINARY_LABEL.bordure,
  'on-bordure': { plain: 'Pictures on the border', term: 'charges on the bordure' },
  overall: { plain: 'Across everything', term: 'overall' },
};

/**
 * What the builder calls a group: "Band or shape", "Picture", "Pictures on the band", "Top bar", "Border",
 * "Second picture" for the second of two main pictures, "Pictures on the top bar" for what sits on one, "Pictures along the top" for charges set in chief beside the main picture,
 * "Pictures around the picture" for charges set around it, or "Across everything" for a band or picture lying overall.
 */
export function groupLabel(d: Design, path: GroupPath): string {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (group.role === 'overall') return PLACE_LABEL.overall.plain;
  if (group.item.k === 'ordinary') {
    if (group.item.type === 'chief') return ORDINARY_LABEL.chief.plain;
    return group.item.type === 'bordure' ? ORDINARY_LABEL.bordure.plain : ORDINARY_KIND[group.item.type] === 'central' ? 'Band or shape' : capitalise(ORDINARY_LABEL[group.item.type].plain.toLowerCase());
  }
  if (host?.item.k === 'ordinary') {
    const onto = host.item.type === 'chief' || host.item.type === 'bordure' ? ORDINARY_LABEL[host.item.type].plain.toLowerCase() : 'band';
    return `Pictures on the ${onto}`;
  }
  if (host?.item.k === 'charge') return PLACE_LABEL['on-picture'].plain;
  if (group.role === 'secondary' && group.relation === 'position' && isSecondaryPosition(group.position)) {
    return PLACE_LABEL[`in-${group.position}`].plain;
  }
  if (group.role === 'secondary' && group.relation === 'between' && primaryCharges(d)) return PLACE_LABEL.around.plain;
  const mains = d.groups.filter((g) => g.role === 'primary' && g.item.k === 'charge');
  return group.role === 'primary' && mains.indexOf(group) > 0 ? PLACE_LABEL['co-primary'].plain : 'Picture';
}
