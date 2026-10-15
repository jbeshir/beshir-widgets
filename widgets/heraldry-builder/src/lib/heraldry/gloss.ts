// Plain-English gloss. Left/right always mean as you look at the shield.

import { TINCTURE_GLOSS, TINCTURE_WORD } from './tinctures';
import { joinAnd, numberWord } from './words';
import { CHARGES, postureGloss } from './charges';
import { furGloss } from './fur';
import { treatedGloss } from './treatment';
import { asParty, asSemy, asTreated, asVariation, fieldParts, fieldTinctures, notSupported, type Arrangement, type Design, type Group, type Paint, type Position, type SemyPaint } from './design';
import { DEFAULT_PIECES, type Division, type Variation } from './divisions';
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

/** How a division splits a shape, with the plain word of each part: "split vertically, blue on the left and gold on the right". */
function divisionGloss(division: Division, c1: string, c2: string): string {
  switch (division) {
    case 'per-pale': return `split vertically, ${c1} on the left and ${c2} on the right`;
    case 'per-fess': return `split horizontally, ${c1} on top and ${c2} below`;
    case 'per-bend': return `split diagonally from top-left to bottom-right, ${c1} above and ${c2} below`;
    case 'per-bend-sinister': return `split diagonally from top-right to bottom-left, ${c1} above and ${c2} below`;
    case 'per-saltire': return `divided by an X, ${c1} top and bottom and ${c2} left and right`;
    case 'per-chevron': return `divided by an upside-down V, ${c1} above and ${c2} below`;
    case 'quarterly': return `divided into four quarters, ${c1} top-left and bottom-right, ${c2} top-right and bottom-left`;
    default: return notSupported({ category: 'division', detail: division });
  }
}

/** What a semy is strewn with, in plain words: "gold five-pointed stars". */
const strewnGloss = (semy: SemyPaint): string => `${TINCTURE_GLOSS[semy.ink.t]} ${CHARGES[semy.charge.charge].glossPlural}`;


/** A part of the field in plain words: its colour, its fur, its treatment, or its colour strewn with charges. */
function partGloss(p: Paint): string {
  const treated = asTreated(p);
  if (treated) return treatedGloss(treated);
  const semy = asSemy(p);
  if (semy) return `${TINCTURE_GLOSS[semy.ground.t]} strewn with ${strewnGloss(semy)}`;
  return p.k === 'tincture' ? TINCTURE_GLOSS[p.t] : p.k === 'fur' ? furGloss(p) : notSupported({ category: 'field-treatment', detail: p.k });
}

/** How a variation covers a shape, with the plain word of each tincture: "6 horizontal stripes, blue on top alternating with gold". */
function variationGloss(variation: Variation, pieces: number | null, c1: string, c2: string): string {
  const n = pieces ?? DEFAULT_PIECES;
  switch (variation) {
    case 'barry': return `${n} horizontal stripes, ${c1} on top alternating with ${c2}`;
    case 'paly': return `${n} vertical stripes, ${c1} on the left alternating with ${c2}`;
    case 'bendy': return `${n} diagonal stripes running from top-left to bottom-right, ${c1} at the top alternating with ${c2}`;
    case 'bendy-sinister': return `${n} diagonal stripes running from top-right to bottom-left, ${c1} at the top alternating with ${c2}`;
    case 'chevronny': return `${n} upside-down V stripes, ${c1} at the top alternating with ${c2}`;
    case 'checky': return `a chequerboard of ${c1} and ${c2} squares, ${c1} in the top-left corner`;
    case 'lozengy': return `a lattice of ${c1} and ${c2} diamonds`;
    case 'fusily': return `a lattice of tall narrow ${c1} and ${c2} diamonds`;
    case 'pily': return `${c1} with three ${c2} wedges pointing down from the top`;
    case 'barry-bendy': return `a slanted check of ${c1} and ${c2}, cut by horizontal lines and diagonals`;
    case 'paly-bendy': return `a slanted check of ${c1} and ${c2}, cut by vertical lines and diagonals`;
    default: return variation satisfies never;
  }
}


function fieldGloss(d: Design): string {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const varied = asVariation(d.field);
  if (varied) return `A shield of ${variationGloss(varied.variation, varied.pieces, TINCTURE_GLOSS[varied.parts[0].t], TINCTURE_GLOSS[varied.parts[1].t])}`;
  const [c1, c2] = fieldParts(d).map(partGloss);
  if (d.field.k === 'tincture') return `${article(c1) === 'an' ? 'An' : 'A'} ${c1} shield`;
  if (d.field.k === 'semy') return `A shield of ${c1}`;
  if (d.field.k === 'fur' || d.field.k === 'treated') return `A shield covered in ${c1}`;
  if (d.field.k !== 'divided') return notSupported({ category: 'field-treatment', detail: d.field.k });
  return `A shield ${divisionGloss(d.field.division, c1, c2)}`;
}

/** "in the opposite colours of the field (blue on gold, gold on blue)" for counterchanged groups on a divided field. */
function counterchangedGloss(d: Design): string {
  const pair = fieldTinctures(d);
  if (pair.length < 2) return 'in the opposite colours of the field';
  const [a, b] = pair.map((t) => TINCTURE_WORD[t]);
  return `in the opposite colours of the field (${b} on ${a}, ${a} on ${b})`;
}

/** The words that follow a group painted other than one colour: counterchanged, or split in two. Null for one colour. */
function paintClause(d: Design, p: Paint): string | null {
  if (p.k === 'counterchanged') return counterchangedGloss(d);
  if (p.k === 'proper') return 'in its natural colours';
  const semy = asSemy(p);
  if (semy) return `in ${TINCTURE_GLOSS[semy.ground.t]}, strewn with ${strewnGloss(semy)}`;
  const varied = asVariation(p);
  if (varied) return `in ${variationGloss(varied.variation, varied.pieces, TINCTURE_GLOSS[varied.parts[0].t], TINCTURE_GLOSS[varied.parts[1].t])}`;
  const party = asParty(p);
  return party ? divisionGloss(party.division, TINCTURE_GLOSS[party.parts[0].t], TINCTURE_GLOSS[party.parts[1].t]) : null;
}

/** A plain colour word for a group's paint, or null for a paint with a clause of its own (see `paintClause`). */
function colourOf(p: Paint): string | null {
  if (p.k === 'tincture' || p.k === 'fur' || p.k === 'treated') return partGloss(p);
  return p.k === 'counterchanged' || p.k === 'proper' || asSemy(p) || asParty(p) || asVariation(p) ? null : notSupported({ category: 'tincture', detail: p.k });
}

function ordinaryGloss(d: Design, g: Group): string {
  if (g.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  const body = ORDINARY_GLOSS[g.item.type] ?? notSupported({ category: 'ordinary', detail: g.item.type });
  const colour = colourOf(g.paint);
  return colour ? `${article(colour)} ${colour} ${body}` : `${article(body)} ${body} ${paintClause(d, g.paint)}`;
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
  const clause = paintClause(d, g.paint);
  if (clause) text += ` ${clause}`;
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
  const clause = paintClause(d, g.paint);
  const colour = clause ? `, ${clause}` : '';
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
    const words = paintClause(d, s.paint);
    const colour = words ? `, ${words}` : '';
    const where = aroundWords(s.count, { arrangement: s.arrangement, position: s.position }) ?? layoutGloss({ arrangement: s.arrangement, position: s.position }, s.count);
    text += `${clause ? ',' : ''} between ${chargesSubject(s, s.count)}${colour}${where ? `, ${where}` : ''}`;
    clause = where !== null;
  }
  return { text, clause };
}

/** Two co-primary groups, laid out together: "a white unicorn and a red rose, in a row". */
function togetherGloss(d: Design, [a, b]: [Group, Group]): { text: string; clause: boolean } {
  const bothCounterchanged = a.paint.k === 'counterchanged' && b.paint.k === 'counterchanged';
  const subject = (g: Group) => {
    const clause = paintClause(d, g.paint);
    return `${chargesSubject(g, g.count)}${clause && !bothCounterchanged ? ` ${clause}` : ''}`;
  };
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
