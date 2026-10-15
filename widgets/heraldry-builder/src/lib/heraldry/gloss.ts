// Plain-English gloss. Left/right always mean as you look at the shield.

import { TINCTURE_GLOSS, TINCTURE_WORD } from './tinctures';
import { joinAnd, numberWord } from './words';
import { CHARGES, postureGloss } from './charges';
import { fieldTinctures, notSupported, type Arrangement, type Design, type Group, type Paint, type Position } from './design';
import { type OrdinaryType } from './ordinaries';
import { aroundWords, betweenWords, coPrimaries, isHalfPosition, primaryCharges, type HalfPosition, type Layout } from './arrangement';

const ORDINARY_GLOSS: Partial<Record<OrdinaryType, string>> = {
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

/** "a" / "an" chosen from the word that follows (colour words all start with consonants today). */
function article(next: string): string {
  return /^[aeiou]/i.test(next) ? 'an' : 'a';
}

function fieldGloss(d: Design): string {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const [c1, c2] = fieldTinctures(d).map((t) => TINCTURE_GLOSS[t]);
  if (d.field.k === 'tincture') return `${article(c1) === 'an' ? 'An' : 'A'} ${c1} shield`;
  if (d.field.k !== 'divided') return notSupported({ category: 'field-treatment', detail: d.field.k });
  switch (d.field.division) {
    case 'per-pale': return `A shield split vertically, ${c1} on the left and ${c2} on the right`;
    case 'per-fess': return `A shield split horizontally, ${c1} on top and ${c2} below`;
    case 'per-bend': return `A shield split diagonally from top-left to bottom-right, ${c1} above and ${c2} below`;
    case 'per-bend-sinister': return `A shield split diagonally from top-right to bottom-left, ${c1} above and ${c2} below`;
    case 'per-saltire': return `A shield divided by an X, ${c1} top and bottom and ${c2} left and right`;
    case 'per-chevron': return `A shield divided by an upside-down V, ${c1} above and ${c2} below`;
    case 'quarterly': return `A shield divided into four quarters, ${c1} top-left and bottom-right, ${c2} top-right and bottom-left`;
    default: return notSupported({ category: 'division', detail: d.field.division });
  }
}

/** "in the opposite colours of the field (blue on gold, gold on blue)" for counterchanged groups on a divided field. */
function counterchangedGloss(d: Design): string {
  const pair = fieldTinctures(d);
  if (pair.length < 2) return 'in the opposite colours of the field';
  const [a, b] = pair.map((t) => TINCTURE_WORD[t]);
  return `in the opposite colours of the field (${b} on ${a}, ${a} on ${b})`;
}

/** A plain colour word for a group's paint, or null for counterchanged (which has its own clause). */
function colourOf(p: Paint): string | null {
  if (p.k === 'tincture') return TINCTURE_GLOSS[p.t];
  if (p.k === 'counterchanged') return null;
  return notSupported({ category: 'tincture', detail: p.k });
}

function ordinaryGloss(d: Design, g: Group): string {
  if (g.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  const body = ORDINARY_GLOSS[g.item.type] ?? notSupported({ category: 'ordinary', detail: g.item.type });
  const colour = colourOf(g.paint);
  return colour ? `${article(colour)} ${colour} ${body}` : `${article(body)} ${body} ${counterchangedGloss(d)}`;
}

/** Where charges set in chief, base or canton in a pattern stand, before the pattern's own words. */
const PATTERN_PLACE: Partial<Record<Position, string>> = { chief: 'along the top', base: 'along the bottom', canton: 'in the top-left corner' };
/** Where charges set in a half or quarter of the field stand, as you look at it. */
const HALF_PLACE: Record<HalfPosition, string> = {
  dexter: 'on the left half', sinister: 'on the right half',
  'dexter-chief': 'in the top-left quarter', 'sinister-chief': 'in the top-right quarter', 'dexter-base': 'in the bottom-left quarter', 'sinister-base': 'in the bottom-right quarter',
};

/** The words for a layout, or null when it needs none (a lone charge, or charges placed by their host). */
function layoutGloss(l: Layout, count: number): string | null {
  const a: Arrangement = l.arrangement;
  if (isHalfPosition(l.position)) {
    const inner = a.k === 'single' ? null : layoutGloss({ arrangement: a, position: null }, count);
    return inner ? `${HALF_PLACE[l.position]}, ${inner}` : HALF_PLACE[l.position];
  }
  if (l.position !== null && (a.k === 'rows' || a.k === 'crossed')) {
    const where = PATTERN_PLACE[l.position] ?? notSupported({ category: 'arrangement', detail: `in-${l.position}` });
    return `${where}, ${layoutGloss({ arrangement: a, position: null }, count)}`;
  }
  switch (l.position) {
    case null: break;
    case 'chief': return count === 1 ? 'near the top' : 'in a row along the top';
    case 'base': return count === 1 ? 'near the bottom' : 'in a row along the bottom';
    case 'canton': return count === 1 ? 'in the top-left corner' : 'in a row in the top-left corner';
    default: return notSupported({ category: 'arrangement', detail: `in-${l.position}` });
  }
  switch (a.k) {
    case 'single': case 'host': return null;
    case 'line': return { pale: 'in a vertical line', fess: 'in a row', bend: 'in a diagonal line from top-left', 'bend-sinister': 'in a diagonal line from top-right' }[a.dir];
    case 'rows': {
      const key = a.rows.join('-');
      if (key === '2-1') return 'two above one';
      if (key === '1-2') return 'one above two';
      if (key === '2-2') return 'in two rows of two';
      return `in rows of ${joinAnd(a.rows.map(numberWord))}`;
    }
    case 'pattern':
      if (a.pattern === 'cross') return 'in a cross pattern';
      if (a.pattern === 'saltire') return 'in an X pattern';
      if (a.pattern === 'orle') return 'in a ring around the edge';
      if (a.pattern === 'annulo') return 'in a ring';
      return notSupported({ category: 'arrangement', detail: `in-${a.pattern}` });
    case 'crossed': return 'crossed like an X';
    case 'pair': return notSupported({ category: 'posture', detail: a.pair });
  }
}

/** The charges themselves: "three green unicorns rearing up", "a five-pointed star" (counterchanged: no colour word). */
function chargesSubject(g: Group, count: number): string {
  if (g.item.k !== 'charge') throw new RangeError('Not a charge.');
  const meta = CHARGES[g.item.charge];
  const splendour = g.item.mods.some((m) => m.id === 'in-splendour');
  const noun = (count === 1 ? meta.glossName : meta.glossPlural) + (splendour ? (count === 1 ? ' with a face' : ' with faces') : '');
  const colour = colourOf(g.paint);
  const lead = count === 1 ? article(colour ?? noun) : numberWord(count);
  const posture = g.item.posture ? postureGloss(g.item.charge, g.item.posture) : null;
  return [lead, colour, noun, posture].filter(Boolean).join(' ');
}

/** "three red five-pointed stars, two above one"; counterchanged: "…stars in the opposite colours of the field (…), two above one". */
function chargesGloss(d: Design, g: Group): { text: string; clause: boolean } {
  let text = chargesSubject(g, g.count);
  if (g.paint.k === 'counterchanged') text += ` ${counterchangedGloss(d)}`;
  const where = layoutGloss({ arrangement: g.arrangement, position: g.position }, g.count);
  return where ? { text: `${text}, ${where}`, clause: true } : { text, clause: false };
}

/**
 * Charges set between an ordinary, placed around it: "a white rose on each side", "two white roses,
 * one above and one below". A count the ordinary doesn't take (a structural error) is glossed plainly.
 */
function betweenGloss(d: Design, g: Group, ordinary: OrdinaryType): { text: string; clause: boolean } {
  const where = betweenWords(ordinary, g.count);
  if (!where) return chargesGloss(d, g);
  const colour = g.paint.k === 'counterchanged' ? `, ${counterchangedGloss(d)}` : '';
  if (/^one (on|in) each /.test(where)) return { text: `${chargesSubject(g, 1)} ${where.slice('one '.length)}${colour}`, clause: false };
  return { text: `${chargesSubject(g, g.count)}${colour}, ${where}`, clause: false };
}

/** Primary charges with the charges set around them: "a gold lion between three white roses, two above and one below". */
function chargesWith(d: Design, g: Group, around: readonly Group[]): { text: string; clause: boolean } {
  let { text, clause } = chargesGloss(d, g);
  // The charges on each of them: "a gold lion, carrying a blue star", "three white flames, each carrying a blue heart".
  for (const t of g.charged) {
    const c = chargesGloss(d, t);
    text += `, ${g.count === 1 ? '' : 'each '}carrying ${c.text}`;
    clause = c.clause;
  }
  for (const s of around) {
    const colour = s.paint.k === 'counterchanged' ? `, ${counterchangedGloss(d)}` : '';
    const where = aroundWords(s.count, { arrangement: s.arrangement, position: s.position }) ?? layoutGloss({ arrangement: s.arrangement, position: s.position }, s.count);
    text += `${clause ? ',' : ''} between ${chargesSubject(s, s.count)}${colour}${where ? `, ${where}` : ''}`;
    clause = where !== null;
  }
  return { text, clause };
}

/** Two co-primary groups, laid out together: "a white unicorn and a red rose, in a row". */
function togetherGloss(d: Design, [a, b]: [Group, Group]): { text: string; clause: boolean } {
  const bothCounterchanged = a.paint.k === 'counterchanged' && b.paint.k === 'counterchanged';
  const subject = (g: Group) => `${chargesSubject(g, g.count)}${g.paint.k === 'counterchanged' && !bothCounterchanged ? ` ${counterchangedGloss(d)}` : ''}`;
  const subjects = `${subject(a)} and ${subject(b)}${bothCounterchanged ? ` ${counterchangedGloss(d)}` : ''}`;
  const where = layoutGloss({ arrangement: a.arrangement, position: a.position }, a.count + b.count);
  return where ? { text: `${subjects}, ${where}`, clause: true } : { text: subjects, clause: false };
}

/** An ordinary with what is set between and on it. `clause`: the text ends in a layout clause that takes a comma before "and". */
function ordinaryWith(d: Design, g: Group, between: Group[]): { text: string; clause: boolean } {
  if (g.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  const type = g.item.type;
  let text = ordinaryGloss(d, g);
  let clause = false;
  for (const t of g.charged) {
    const c = chargesGloss(d, t);
    // A band on the edge reads as a phrase of its own: "a gold band across the top carrying three red roses".
    text += `${type === 'chief' || type === 'bordure' ? ' ' : ', '}carrying ${c.text}`;
    clause = c.clause;
  }
  for (const s of between) {
    const b = betweenGloss(d, s, type);
    text += `${g.charged.length > 0 ? ', and' : ' and'} ${b.text}`;
    clause = b.clause;
  }
  return { text, clause };
}

export function gloss(d: Design): string {
  const field = fieldGloss(d);
  const between = d.groups.filter((g) => g.role === 'secondary' && g.relation === 'between');
  const positioned = d.groups.filter((g) => g.role === 'secondary' && g.relation === 'position');
  const primary = d.groups.filter((g) => g.role === 'primary');
  const overall = d.groups.filter((g) => g.role === 'overall');
  const peripheral = d.groups.filter((g) => g.role === 'peripheral');
  if (d.groups.length !== primary.length + between.length + positioned.length + overall.length + peripheral.length) {
    return notSupported({ category: 'multiple-groups', detail: 'tertiary' });
  }
  const around = primaryCharges(d) ? between : [];
  const together = coPrimaries(d);
  const parts = [...(together ? [] : primary), ...positioned, ...overall, ...peripheral].map((g) => {
    const part = g.item.k === 'ordinary' ? ordinaryWith(d, g, g.role === 'primary' ? between : []) : g.role === 'primary' ? chargesWith(d, g, around) : chargesGloss(d, g);
    return g.role === 'overall' ? { ...part, text: `across all of it, ${part.text}` } : part;
  });
  if (together) parts.unshift(togetherGloss(d, together));
  if (parts.length === 0) return `${field}.`;
  const rest = parts.reduce((text, p, i) => (i === 0 ? p.text : `${text}${parts[i - 1].clause ? ',' : ''} and ${p.text}`), '');
  return `${field}${d.kind === 'arms' && d.field.k === 'tincture' ? ' with ' : ', with '}${rest}.`;
}
