// Plain-English gloss. Left/right always mean as you look at the shield.

import { TINCTURE_GLOSS, TINCTURE_WORD } from './tinctures';
import { joinAnd, numberWord } from './words';
import { CHARGES, drawnPoints, postureGloss } from './charges';
import { furGloss } from './fur';
import { treatedGloss } from './treatment';
import { asParty, asSemy, asTreated, asVariation, fieldParts, fieldTinctures, fimbriationOf, isVoided, notSupported, type Arrangement, type Charge, type Pair, type Cotises, type Design, type Group, type Lines, type Ordinary, type Paint, type Position, type SemyPaint } from './design';
import { edgeNames, ordinaryEdgeHost, type ComplexLine, type EdgeName, type Line } from './lines';
import { FACING_LABEL, GAZE_LABEL, LINE_LOOK, ORIENTATION_LABEL } from './plain-words';
import { DEFAULT_GYRONNY_PIECES, DEFAULT_PIECES, type Division, type Variation } from './divisions';
import { ORDINARY_KIND, isDiminutive, type OrdinaryType } from './ordinaries';
import { aroundWords, betweenHost, betweenWords, contextOf, coPrimaries, cornerBesideBend, isHalfPosition, primaryCharges, type BetweenHost, type HalfPosition, type Layout, type QuarterPosition } from './arrangement';
import { specOf } from './ordinary-geometry';

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
  base: 'band across the bottom',
  point: 'curved point rising from the bottom',
  canton: 'square in the top-left corner',
  quarter: 'quarter of the shield in the top-left corner',
  gyron: 'triangle from the top-left corner to the middle',
  orle: 'inner border',
  flaunches: 'pair of curved side pieces',
  gore: 'curved wedge from the left',
  pall: 'Y-shaped band',
  'pall-inverted': 'upside-down Y-shaped band',
  label: 'bar across the top with three hanging tabs',
  fret: 'diamond woven with two crossing stripes',
  mount: 'hill rising from the bottom',
  trimount: 'three hills rising from the bottom',
  'point-dexter': 'triangle in the bottom-left corner',
  'point-sinister': 'triangle in the bottom-right corner',
  baton: 'short thin diagonal band from top-left to bottom-right',
};

/** Two to four narrow bands, in everyday words (`DIMINUTIVE_INVERTED_GLOSS` the other way up). */
const DIMINUTIVE_GLOSS: Partial<Record<OrdinaryType, string>> = {
  bar: 'thin horizontal bands',
  pallet: 'thin vertical bands',
  bendlet: 'thin diagonal bands from top-left to bottom-right',
  'bendlet-sinister': 'thin diagonal bands from top-right to bottom-left',
  chevronel: 'thin upside-down V shapes, one inside another',
};
const DIMINUTIVE_INVERTED_GLOSS: Partial<Record<OrdinaryType, string>> = { chevronel: 'thin V shapes, one inside another' };

/** The ordinaries in the other top corner or on the other side (sinister), in everyday words. */
const SINISTER_GLOSS: Partial<Record<OrdinaryType, string>> = {
  canton: 'square in the top-right corner',
  quarter: 'quarter of the shield in the top-right corner',
  gyron: 'triangle from the top-right corner to the middle',
  gore: 'curved wedge from the right',
  baton: 'short thin diagonal band from top-right to bottom-left',
};

/** A double or triple tressure, in everyday words. */
const TRESSURE_GLOSS: Readonly<Record<number, string>> = { 2: 'pair of thin inner borders', 3: 'set of three thin inner borders' };

/** The ordinaries turned upside down, in everyday words. */
const INVERTED_GLOSS: Partial<Record<OrdinaryType, string>> = {
  chevron: 'V shape',
  pile: 'upward-pointing wedge from the bottom',
};

/** "a" / "an" chosen from the word that follows (colour words all start with consonants today). */
function article(next: string): string {
  return /^[aeiou]/i.test(next) ? 'an' : 'a';
}

/** " by a wavy line" for a complex line, nothing for a plain one. */
const byLine = (l: Line): string => (l === 'plain' ? '' : ` by ${article(LINE_LOOK[l])} ${LINE_LOOK[l]} line`);

/** Quarterly's lines in words: " by wavy lines", ", the up-and-down line wavy", nothing when both are plain. */
function quarterlyLines({ a, b }: Lines): string {
  if (a === b) return a === 'plain' ? '' : ` by ${LINE_LOOK[a]} lines`;
  const parts = [a !== 'plain' ? `the up-and-down line ${LINE_LOOK[a]}` : '', b !== 'plain' ? `the across line ${LINE_LOOK[b]}` : ''].filter(Boolean);
  return `, ${parts.join(' and ')}`;
}

/** How a division splits a shape, with the plain word of each part in part order: "split vertically by a wavy line, blue on the left and gold on the right". */
function divisionGloss(division: Division, lines: Lines, pieces: number | null, colours: readonly string[]): string {
  const by = byLine(lines.a), of = lines.a === 'plain' ? '' : ` of ${LINE_LOOK[lines.a]} lines`, byLines = lines.a === 'plain' ? '' : ` by ${LINE_LOOK[lines.a]} lines`;
  const [c1, c2, c3] = colours;
  switch (division) {
    case 'per-pale': return `split vertically${by}, ${c1} on the left and ${c2} on the right`;
    case 'per-fess': return `split horizontally${by}, ${c1} on top and ${c2} below`;
    case 'per-bend': return `split diagonally from top-left to bottom-right${by}, ${c1} above and ${c2} below`;
    case 'per-bend-sinister': return `split diagonally from top-right to bottom-left${by}, ${c1} above and ${c2} below`;
    case 'per-saltire': return `divided by an X${of}, ${c1} top and bottom and ${c2} left and right`;
    case 'per-chevron': return `divided by an upside-down V${of}, ${c1} above and ${c2} below`;
    case 'per-chevron-inverted': return `divided by a V${of}, ${c1} above and ${c2} below`;
    case 'per-chevron-throughout': return `divided by an upside-down V${of} reaching the top edge, ${c1} above and ${c2} below`;
    case 'gyronny': return `divided into ${pieces ?? DEFAULT_GYRONNY_PIECES} wedges meeting in the middle${lines.a === 'plain' ? '' : ` (the dividing lines are ${LINE_LOOK[lines.a]})`}, alternately ${c1} and ${c2}, with ${c1} in the wedge above the middle line on the left`;
    case 'quarterly': return `divided into four quarters${quarterlyLines(lines)}, ${c1} top-left and bottom-right, ${c2} top-right and bottom-left`;
    case 'per-pall': return `divided in three by a Y${of}, ${c1} at the top, ${c2} on the left and ${c3} on the right`;
    case 'per-pall-inverted': return `divided in three by an upside-down Y${of}, ${c1} on the left, ${c2} on the right and ${c3} at the bottom`;
    case 'tierced-per-pale': return `divided into three upright stripes${byLines}, ${c1} on the left, ${c2} in the middle and ${c3} on the right`;
    case 'tierced-per-fess': return `divided into three level stripes${byLines}, ${c1} on top, ${c2} in the middle and ${c3} below`;
    default: return division satisfies never;
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
function variationGloss(variation: Variation, pieces: number | null, line: Line, c1: string, c2: string): string {
  const n = pieces ?? DEFAULT_PIECES;
  const edged = line === 'plain' ? '' : ` with ${LINE_LOOK[line]} edges`;
  switch (variation) {
    case 'barry': return `${n} horizontal stripes${edged}, ${c1} on top alternating with ${c2}`;
    case 'paly': return `${n} vertical stripes${edged}, ${c1} on the left alternating with ${c2}`;
    case 'bendy': return `${n} diagonal stripes running from top-left to bottom-right${edged}, ${c1} at the top alternating with ${c2}`;
    case 'bendy-sinister': return `${n} diagonal stripes running from top-right to bottom-left${edged}, ${c1} at the top alternating with ${c2}`;
    case 'chevronny': return `${n} upside-down V stripes${edged}, ${c1} at the top alternating with ${c2}`;
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
  if (d.kind === 'badge') return 'No background';
  const varied = asVariation(d.field);
  if (varied) return `A shield of ${variationGloss(varied.variation, varied.pieces, varied.lines.a, TINCTURE_GLOSS[varied.parts[0].t], TINCTURE_GLOSS[varied.parts[1].t])}`;
  const colours = fieldParts(d).map(partGloss);
  const c1 = colours[0];
  if (d.field.k === 'tincture') return `${article(c1) === 'an' ? 'An' : 'A'} ${c1} shield`;
  if (d.field.k === 'semy') return `A shield of ${c1}`;
  if (d.field.k === 'fur' || d.field.k === 'treated') return `A shield covered in ${c1}`;
  if (d.field.k !== 'divided') return notSupported({ category: 'field-treatment', detail: d.field.k });
  return `A shield ${divisionGloss(d.field.division, d.field.lines, d.field.pieces, colours)}`;
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
  if (varied) return `in ${variationGloss(varied.variation, varied.pieces, varied.lines.a, TINCTURE_GLOSS[varied.parts[0].t], TINCTURE_GLOSS[varied.parts[1].t])}`;
  const party = asParty(p);
  return party ? divisionGloss(party.division, party.lines, null, party.parts.map((x) => TINCTURE_GLOSS[x.t])) : null;
}

/** A plain colour word for a group's paint, or null for a paint with a clause of its own (see `paintClause`). */
function colourOf(p: Paint): string | null {
  if (p.k === 'tincture' || p.k === 'fur' || p.k === 'treated') return partGloss(p);
  return p.k === 'counterchanged' || p.k === 'proper' || asSemy(p) || asParty(p) || asVariation(p) ? null : notSupported({ category: 'tincture', detail: p.k });
}

/** Where an edge of a band lies, as you look at it. */
const EDGE_GLOSS: Record<EdgeName, string> = { upper: 'top', lower: 'bottom', dexter: 'left', sinister: 'right', outer: 'outer', inner: 'inner', 'pale-line': 'up-and-down', 'fess-line': 'across' };

/** An ordinary's lines in words: " with wavy edges", " with a battlemented top edge", nothing when plain. */
function ordinaryLines(item: Ordinary): string {
  const { type, lines: { a, b } } = item;
  const names = edgeNames(ordinaryEdgeHost(item));
  if (a === b || names === null) return a === 'plain' ? '' : ONE_EDGE.includes(type) ? ` with ${article(LINE_LOOK[a])} ${LINE_LOOK[a]} edge` : ` with ${LINE_LOOK[a]} edges`;
  const edge = (l: ComplexLine, name: EdgeName) => `${article(LINE_LOOK[l])} ${LINE_LOOK[l]} ${EDGE_GLOSS[name]} edge`;
  return ` with ${[a !== 'plain' ? edge(a, names.a) : '', b !== 'plain' ? edge(b, names.b) : ''].filter(Boolean).join(' and ')}`;
}

/** The ordinaries whose line runs along one edge: the chief's lower edge, the bordure's inner one, the base's upper one, the gore's curve. */
const ONE_EDGE: readonly OrdinaryType[] = ['chief', 'bordure', 'base', 'gore'];

function ordinaryGloss(d: Design, g: Group): string {
  if (g.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  const { type, mods } = g.item;
  const inverted = mods.includes('inverted');
  const counted = isDiminutive(type) && g.count > 1;
  const shape = (counted ? (inverted ? DIMINUTIVE_INVERTED_GLOSS : DIMINUTIVE_GLOSS)[type]
    : type === 'tressure' ? TRESSURE_GLOSS[g.count] : inverted ? INVERTED_GLOSS[type] : mods.includes('sinister') ? SINISTER_GLOSS[type] : ORDINARY_GLOSS[type])
    ?? notSupported({ category: 'ordinary', detail: type });
  // "a gold shortened cross", "a blue raised horizontal band …", "a white upside-down V reaching the edges"
  const before = [mods.includes('couped') ? 'shortened ' : '', mods.includes('enhanced') ? 'raised ' : '', mods.includes('abased') ? 'lowered ' : '', mods.includes('voided') ? 'hollow ' : ''].join('');
  const body = `${before}${shape}${mods.includes('throughout') ? ' reaching the edges' : ''}${ordinaryLines(g.item)}`;
  const colour = colourOf(g.paint);
  const { fimbriated, cotised } = g.item;
  const edged = fimbriated ? `, edged in ${colourOf(fimbriated) ?? paintClause(d, fimbriated)}` : '';
  const lead = (first: string) => (counted ? numberWord(g.count) : article(first));
  return `${colour ? `${lead(colour)} ${colour} ${body}` : `${lead(body)} ${body} ${paintClause(d, g.paint)}`}${edged}${cotised ? cotisesGloss(d, cotised) : ''}`;
}

/** An ordinary's cotises: ", with a thin gold stripe on each side", ", with two thin wavy blue stripes on each side". */
function cotisesGloss(d: Design, { count, paint, line }: Cotises): string {
  const colour = colourOf(paint);
  const stripes = `${count === 1 ? 'a' : numberWord(count)} thin${line === 'plain' ? '' : ` ${LINE_LOOK[line]}`}${colour ? ` ${colour}` : ''} stripe${count === 1 ? '' : 's'} on each side`;
  return `, with ${stripes}${colour ? '' : ` ${paintClause(d, paint)}`}`;
}

/** Where charges set in chief, base or canton in a pattern stand, before the pattern's own words. */
const PATTERN_PLACE: Partial<Record<Position, string>> = { chief: 'along the top', base: 'along the bottom', canton: 'in the top-left corner' };
/** Where charges set in a half or quarter of the field stand, as you look at it. */
const HALF_PLACE: Record<HalfPosition, string> = {
  dexter: 'on the left half', sinister: 'on the right half',
  'dexter-chief': 'in the top-left quarter', 'sinister-chief': 'in the top-right quarter', 'dexter-base': 'in the bottom-left quarter', 'sinister-base': 'in the bottom-right quarter',
};

/** Where one charge set in chief or in base beside a bend stands, as you look at it: in the corner the bend leaves free. */
const CORNER_PLACE: Record<QuarterPosition, string> = {
  'dexter-chief': 'in the top-left corner', 'sinister-chief': 'in the top-right corner', 'dexter-base': 'in the bottom-left corner', 'sinister-base': 'in the bottom-right corner',
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
    case 'pair': return PAIR_GLOSS[a.pair];
  }
}

/** Two charges facing each other, or back to back. */
const PAIR_GLOSS: Record<Pair, string> = { combattant: 'facing each other', respectant: 'facing each other', addorsed: 'back to back' };

/**
 * A charge's gloss noun with what its modifiers say: "hollow diamonds", "a six-pointed star with a round hole", "suns with faces", "a cross
 * with splayed arms, pointed at the foot", "a diamond edged in white".
 */
function chargeNoun(c: Charge, count: number): string {
  const meta = CHARGES[c.charge];
  const mods = c.mods.map((m) => m.id);
  const name = count === 1 ? meta.glossName : meta.glossPlural;
  const drawn = drawnPoints(c.charge), points = c.mods.find((m) => m.id === 'of-points')?.count ?? null;
  const pointed = drawn !== null && points !== null ? name.replace(`${numberWord(drawn)}-`, `${numberWord(points)}-`) : name;
  const fimbriation = fimbriationOf(c);
  const edged = fimbriation && colourOf(fimbriation);
  return (isVoided(c) ? 'hollow ' : '') + pointed + (mods.includes('in-splendour') ? (count === 1 ? ' with a face' : ' with faces') : '')
    + (mods.includes('pierced') ? (count === 1 ? ' with a round hole' : ' with round holes') : '')
    + (mods.includes('fitchy') ? ', pointed at the foot' : '') + (edged ? ` edged in ${edged}` : '');
}

/** The charges themselves: "three green unicorns rearing up", "a five-pointed star" (counterchanged: no colour word). */
function chargesSubject(g: Group, count: number): string {
  if (g.item.k !== 'charge') throw new RangeError('Not a charge.');
  const noun = chargeNoun(g.item, count);
  const colour = colourOf(g.paint);
  const lead = count === 1 ? article(colour ?? noun) : numberWord(count);
  const posture = g.item.posture ? postureGloss(g.item.charge, g.item.posture) : null;
  // Facing to dexter is how pictures face: only another way is said ("facing right", "looking back").
  const gaze = g.item.gaze && GAZE_LABEL[g.item.gaze].plain.toLowerCase();
  const facing = g.item.facing && g.item.facing !== 'to-dexter' ? FACING_LABEL[g.item.facing].plain.toLowerCase() : null;
  const orientation = g.item.orientation && ORIENTATION_LABEL[g.item.orientation].plain.toLowerCase();
  return [lead, colour, noun, posture, gaze, facing, orientation].filter(Boolean).join(' ');
}

/** "three red five-pointed stars, two above one"; counterchanged: "…stars in the opposite colours of the field (…), two above one". */
function chargesGloss(d: Design, g: Group): { text: string; clause: boolean } {
  let text = chargesSubject(g, g.count);
  const clause = paintClause(d, g.paint);
  if (clause) text += ` ${clause}`;
  const layout: Layout = { arrangement: g.arrangement, position: g.position };
  const ctx = contextOf(d, g, null), corner = ctx && cornerBesideBend(ctx, layout);
  const where = corner ? CORNER_PLACE[corner] : layoutGloss(layout, g.count);
  return where ? { text: `${text}, ${where}`, clause: true } : { text, clause: false };
}

/**
 * Charges set between an ordinary, placed around it: "a white rose on each side", "two white roses,
 * one above and one below". A count the ordinary doesn't take (a structural error) is glossed plainly.
 */
function betweenGloss(d: Design, g: Group, ordinary: BetweenHost): { text: string; clause: boolean } {
  const where = betweenWords(ordinary, g.count);
  if (!where) return chargesGloss(d, g);
  const clause = paintClause(d, g.paint);
  const colour = clause ? `, ${clause}` : '';
  if (g.arrangement.k === 'pair') return { text: `${chargesSubject(g, g.count)}${colour}, ${PAIR_GLOSS[g.arrangement.pair]}, ${where}`, clause: false };
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
    text += `${ORDINARY_KIND[type] === 'peripheral' ? ' ' : ', '}carrying ${c.text}`;
    clause = c.clause;
  }
  for (const s of between) {
    const b = betweenGloss(d, s, betweenHost(specOf(g)));
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
  return `${field}${d.kind === 'arms' && d.field.k === 'tincture' ? ' with ' : d.kind === 'badge' ? ': ' : ', with '}${rest}.`;
}
