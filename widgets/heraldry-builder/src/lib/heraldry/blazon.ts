// The blazon emitter: one sentence in SCA house style (RULES §F). Only Or is capitalised among the
// tinctures, numbers are words, a posture or layout is written only when it isn't the default the
// College assumes, and a tincture is written once for a run of linked elements that share it.
// `stateDefaults` words those defaults too: the same design as a blazon that states them, which the
// SCA tooling compares with registered blazons (stating a default is optional, GoT Tables 5 and 7).

import { tinctureWord, type Tincture } from './tinctures';
import { furColours, furName } from './fur';
import { treatedName } from './treatment';
import { semyPhrase } from './aliases';
import { capitalise, joinAnd, numberWord } from './words';
import { CHARGES, MODIFIER_IDS, drawnPoints, postureTerm, type ChargeCategory, type ChargeId, type Facing, type ModifierId, type Orientation } from './charges';
import type { OrientWording } from './art/types';
import { asParty, asSemy, asTreated, asVariation, fimbriationOf, hostOf, notSupported, type Charge, type Cotises, type Design, type Group, type GroupPath, type Lines, type Modifier, type Paint } from './design';
import { DEFAULT_GYRONNY_PIECES, DEFAULT_PIECES, DIVISION_NAME, VARIATION_NAME, partCount, type Division } from './divisions';
import { lineWords, ordinaryEdgeHost } from './lines';
import { ORDINARY_ARTICLE, ORDINARY_COUNTS, ORDINARY_COUNT_WORD, ORDINARY_NAME, ORDINARY_PLURAL, PERIPHERAL_JOINER, isDiminutive, type OrdinaryMod, type OrdinaryType, type PeripheralJoiner } from './ordinaries';
import { contextOf, cornerBesideBend, forcedPosition, isHalfPosition, layoutContext, layoutWords, statesLayout } from './arrangement';
import { paintGaps } from './support';

function paintWord(p: Paint): string {
  switch (p.k) {
    case 'tincture': return tinctureWord(p.t);
    case 'fur': return furName(p);
    case 'treated': return treatedWord(p);
    case 'semy': return semyWord(p);
    case 'proper': return 'proper';
    case 'counterchanged': return 'counterchanged';
    case 'divided': return partyWord(p);
    case 'variation': return variationWord(p);
    case 'stain': return notSupported(paintGaps(p, false, 'group')[0]);
    default: return p satisfies never;
  }
}

/**
 * A group's paint as written. A cross or saltire of plain potent is written with its colours: "a cross potent" is a cross type
 * (App M1f), and "a cross potenty argent and azure" is the fur.
 */
function groupPaintWord(g: Group): string {
  const p = g.paint;
  const crossLike = g.item.k === 'ordinary' ? g.item.type === 'cross' || g.item.type === 'saltire' : g.item.charge === 'cross-crosslet';
  if (p.k !== 'fur' || p.fur !== 'potent' || p.colours !== null || !crossLike) return paintWord(p);
  const [a, b] = furColours(p);
  return furName({ ...p, colours: [a, b] });
}

/** A treated tincture as written: "argent masoned sable". */
function treatedWord(p: Paint): string {
  const treated = asTreated(p);
  return treated ? treatedName(treated) : notSupported(paintGaps(p, false, 'group')[0]);
}

/** A semy as written: "azure crusilly argent", "sable bezanty", "argent semy of lions gules". */
function semyWord(p: Paint): string {
  const semy = asSemy(p);
  return semy ? `${tinctureWord(semy.ground.t)} ${semyPhrase(semy.charge.charge, semy.ink.t)}` : notSupported(paintGaps(p, false, 'group')[0]);
}

/** A division and its lines as written: "per pale", "per fess embattled", "quarterly per fess indented", "gyronny arrondi of six" (a gyronny of eight is not counted: a stated default). */
function divisionWords(division: Division, lines: Lines, pieces: number | null): string {
  const line = lineWords({ k: 'division', division }, lines);
  const count = division === 'gyronny' && pieces !== null && pieces !== DEFAULT_GYRONNY_PIECES ? ` of ${numberWord(pieces)}` : '';
  return `${DIVISION_NAME[division]}${line ? ` ${line}` : ''}${count}`;
}

/** A divided paint as written: "per pale azure and Or". */
function partyWord(p: Paint): string {
  const party = asParty(p);
  return party ? `${divisionWords(party.division, party.lines, null)} ${party.parts.map(paintWord).join(' and ')}` : notSupported(paintGaps(p, false, 'group')[0]);
}

/** A variation as written: "barry argent and azure", "paly of eight Or and sable", "barry wavy of eight argent and azure" (the usual six stripes are not blazoned: "barry of six" is a stated default). */
function variationWord(p: Paint): string {
  const varied = asVariation(p);
  if (!varied) return notSupported(paintGaps(p, false, 'group')[0]);
  const count = varied.pieces === null || varied.pieces === DEFAULT_PIECES ? '' : ` of ${numberWord(varied.pieces)}`;
  const line = lineWords({ k: 'variation', variation: varied.variation }, varied.lines);
  return `${VARIATION_NAME[varied.variation]}${line ? ` ${line}` : ''}${count} ${varied.parts.map((x) => tinctureWord(x.t)).join(' and ')}`;
}

/** A field divided in two strewn all over with one charge: both parts are the same semy, in one tincture or each in the other's ("all semy of roses counterchanged"). */
function strewnAllOver(field: Paint): { grounds: [Tincture, Tincture]; charge: ChargeId; ink: Tincture | 'counterchanged' } | null {
  const [a, b] = field.k === 'divided' && field.parts.length === 2 ? field.parts.map(asSemy) : [];
  if (!a || !b || a.charge.charge !== b.charge.charge) return null;
  const grounds: [Tincture, Tincture] = [a.ground.t, b.ground.t];
  if (a.ink.t === b.ink.t) return { grounds, charge: a.charge.charge, ink: a.ink.t };
  return a.ink.t === b.ground.t && b.ink.t === a.ground.t ? { grounds, charge: a.charge.charge, ink: 'counterchanged' } : null;
}

function fieldPhrase(field: Paint): string {
  const all = strewnAllOver(field);
  if (field.k === 'divided' && all) return `${divisionWords(field.division, field.lines, field.pieces)} ${all.grounds.map(tinctureWord).join(' and ')} all ${semyPhrase(all.charge, all.ink)}`;
  if (field.k === 'tincture' || field.k === 'fur' || field.k === 'treated' || field.k === 'semy') return paintWord(field);
  // "per pale A and B"; a field in three parts "per pall A, B and C", without the serial comma (RULES-C §E.1)
  if (field.k === 'divided' && field.parts.length === partCount(field.division) && field.parts.every((p) => p.k === 'tincture' || p.k === 'fur' || p.k === 'treated' || p.k === 'semy')) {
    return `${divisionWords(field.division, field.lines, field.pieces)} ${joinAnd(field.parts.map(paintWord))}`;
  }
  if (field.k === 'variation') return variationWord(field);
  return notSupported(paintGaps(field, true, 'field')[0]);
}

/** The modifiers the builder words, after the noun: "a sun in splendor", "a cross formy fitchy". */
export const MODIFIER_WORDS: Partial<Record<ModifierId, string>> = { 'in-splendour': 'in splendor', fitchy: 'fitchy' };

/** The modifiers that reshape a charge, worded after the noun: "a lozenge voided", "a mullet of six points pierced". */
const RESHAPING_WORDS: Partial<Record<ModifierId, string>> = { voided: 'voided', pierced: 'pierced' };

/** What a star's points are called: an estoile's are rays ("an estoile of eight rays"). */
const POINTS_WORD: Partial<Record<ChargeId, string>> = { estoile: 'rays' };

/** The order modifiers are worded in: the number of points first ("a mullet of six points voided"), then the rest as listed. */
const WORDING_ORDER: readonly ModifierId[] = ['of-points', ...MODIFIER_IDS.filter((id) => id !== 'of-points')];

/**
 * A charge's modifiers in words, after its noun. A fimbriation is worded after the charge's tincture (`tokens`): "a lozenge azure
 * fimbriated argent".
 */
function modifiersWords(c: Charge): string[] {
  const words = (m: Modifier): string[] => {
    if (m.id === 'fimbriated' && m.count === null && m.paint !== null) return [];
    if (m.id === 'of-points' && m.count !== null && m.paint === null && drawnPoints(c.charge) !== null) return [`of ${numberWord(m.count)} ${POINTS_WORD[c.charge] ?? 'points'}`];
    const word = MODIFIER_WORDS[m.id] ?? RESHAPING_WORDS[m.id];
    return word !== undefined && m.count === null && m.paint === null ? [word] : notSupported({ category: 'charge-modifier', detail: m.id });
  };
  return [...c.mods].sort((x, y) => WORDING_ORDER.indexOf(x.id) - WORDING_ORDER.indexOf(y.id)).flatMap(words);
}

/** The word for which way a charge faces, after its posture (R§F.3): none as drawn, "contourny" (no final -e), "affronty". */
export const FACING_WORD: Record<Facing, string | null> = { 'to-dexter': null, 'to-sinister': 'contourny', affronty: 'affronty' };

/**
 * How a charge's head and body are turned, after its posture: its `FACING_WORD`, and the gaze before it or after it as the
 * SCA armorial most often has it — "guardant contourny" (98 records against 35), "contourny regardant" (41 against 12).
 */
export function turnWords(c: Charge): string[] {
  const word = c.facing ? FACING_WORD[c.facing] : null;
  const facing = word ? [word] : [];
  if (c.gaze === null) return facing;
  const gaze = c.gaze.replace('-', ' ');
  return c.gaze === 'regardant' ? [...facing, gaze] : [gaze, ...facing];
}

/**
 * The words for which way a charge points (§1.3), after its facing: "bendwise inverted" (the SCA armorial's 177 against 127 for
 * "inverted bendwise"), "points to center" (152; said after the layout: "in cross points to center").
 */
export const ORIENTATION_WORDS: Record<Orientation, string> = {
  palewise: 'palewise', fesswise: 'fesswise', 'fesswise-reversed': 'fesswise reversed', bendwise: 'bendwise', 'bendwise-inverted': 'bendwise inverted',
  'bendwise-sinister': 'bendwise sinister', 'bendwise-sinister-inverted': 'bendwise sinister inverted', inverted: 'inverted', reversed: 'reversed',
  'to-center': 'points to center',
};

/** A charge's own words for its orientation, if it has some (its sidecar's `orient.wording`). */
const ownWording = (c: Charge): OrientWording | undefined => (c.orientation ? CHARGES[c.charge].orient.wording[c.orientation] : undefined);

/**
 * The words for which way a charge points (§1.3 O-W): its own ("a crescent pendant": 133 records against 96 "crescent inverted"; "horns to
 * center") or the orientation's; none when its noun says it ("an increscent").
 */
export function orientationWords(c: Charge): string[] {
  if (!c.orientation) return [];
  const own = ownWording(c);
  return own?.k === 'noun' ? [] : [own?.words ?? ORIENTATION_WORDS[c.orientation]];
}

/** Which way a charge points in a word or two, a noun that says it included ("increscent"), as a conflict note names it. */
export function orientationTerms(c: Charge): string[] {
  const own = ownWording(c);
  return own?.k === 'noun' ? [own.name] : orientationWords(c);
}

export interface BlazonOptions {
  /** Word the postures and field layouts the College assumes (Table 5 and 7 defaults, forced positions) as well. */
  stateDefaults: boolean;
  /** Write the tincture of every element, though the College lets a run of linked elements that share it say it once (Bruce). */
  stateTinctures: boolean;
}

/** Whether the layout of a group is worded: when it isn't the default, or with `stateDefaults` whenever it isn't alone in the centre. */
function wordsLayout(d: Design, path: GroupPath, g: Group, { stateDefaults }: BlazonOptions): boolean {
  if (contextOf(d, g, hostOf(d, path)) === null) return false;
  // A pair is always worded: the College assumes charges face to dexter.
  if (g.arrangement.k === 'pair') return true;
  const k = layoutContext(d, path).k;
  // Charges on the primary charges, and charges overall, state every layout but the one charge alone, defaults or not (Table 7: they must be stated).
  if (!stateDefaults || k === 'on-charge' || k === 'overall') return statesLayout(d, path);
  return k === 'position' || k === 'around' || (k === 'field' && (g.arrangement.k !== 'single' || g.position !== null));
}

/**
 * A charge group's phrase: [layout prefix] count noun [posture] [gaze and facing] [orientation] [mods] [layout postfix] [to center], without
 * its tincture. A noun of the charge's own for its orientation replaces its name ("three decrescents").
 */
function chargePhrase(d: Design, path: GroupPath, g: Group, options: BlazonOptions): string {
  const laid = laidChargePhrase(d, path, g, options);
  return g.item.k === 'charge' && g.item.orientation === 'to-center' ? [laid, ...orientationWords(g.item)].join(' ') : laid;
}

function laidChargePhrase(d: Design, path: GroupPath, g: Group, options: BlazonOptions): string {
  if (g.item.k !== 'charge') throw new RangeError('Not a charge.');
  const meta = CHARGES[g.item.charge];
  const own = ownWording(g.item);
  const noun = own?.k === 'noun' ? own : meta;
  const words = [g.count === 1 ? noun.article : numberWord(g.count), g.count === 1 ? noun.name : noun.plural];
  // GoT Table 5: a posture the College assumes is left out (RULES §F.8).
  if (g.item.posture && (options.stateDefaults || g.item.posture !== meta.scaDefaultPosture)) words.push(postureTerm(g.item.charge, g.item.posture));
  words.push(...turnWords(g.item), ...(g.item.orientation === 'to-center' ? [] : orientationWords(g.item)), ...modifiersWords(g.item));
  if (!wordsLayout(d, path, g, options)) return words.join(' ');
  // Charges Table 7 forces into one part of the field by tincture are not said to stand there; how they stand there still is.
  const forced = !options.stateDefaults && g.position !== null && g.position === forcedPosition(d, path);
  if (forced && g.arrangement.k === 'single') return words.join(' ');
  const ctx = layoutContext(d, path);
  // One charge in chief or in base beside a bend is said to stand in the corner it is drawn in (RULES-C §F.3: "and in sinister chief a rose").
  const position = forced ? null : cornerBesideBend(ctx, { arrangement: g.arrangement, position: g.position }) ?? g.position;
  const layout = layoutWords({ arrangement: g.arrangement, position });
  // Two co-primary groups share one arrangement, said once: a line leads the first ("in pale a crescent and a mullet"), a pattern follows the second.
  if (ctx.k === 'field' && ctx.share) {
    const leads = position !== null || g.arrangement.k === 'line';
    return ctx.share.index === 0 ? (leads ? `${layout} ${words.join(' ')}` : words.join(' ')) : (leads ? words.join(' ') : `${words.join(' ')} ${layout}`);
  }
  // Lines and positions lead ("in pale two keys"); count patterns follow ("five roses two, two and one", RULES §F.3), after the
  // position when there is one ("in chief five mullets three and two", "in base two swords in saltire").
  if (position !== null && (g.arrangement.k === 'rows' || g.arrangement.k === 'crossed' || (g.arrangement.k === 'line' && isHalfPosition(position)))) {
    return `${layoutWords({ arrangement: { k: 'single' }, position })} ${words.join(' ')} ${layoutWords({ arrangement: g.arrangement, position: null })}`;
  }
  return position !== null || g.arrangement.k === 'line' ? `${layout} ${words.join(' ')}` : `${words.join(' ')} ${layout}`;
}

/** The treatments written before an ordinary's line, and after it, in their order. */
export const MODS_BEFORE_LINE: readonly OrdinaryMod[] = ['sinister', 'inverted'];
export const MODS_AFTER_LINE: readonly OrdinaryMod[] = ['couped', 'throughout', 'enhanced', 'abased', 'voided'];

/**
 * "a bend", "a fess embattled", "a chevron inverted embattled on the upper edge", "a saltire raguly couped", "a chevron ployé throughout",
 * "a canton sinister", "a double tressure", "flaunches", or "on a pale wavy" when something sits on it: sinister and inverted before the
 * line, the other treatments after it (RULES-C §G.1, §G.2, PLAN-C §4); a tressure's count before its name, flaunches with no article;
 * diminutives counted ("three bars wavy", "two chevronels inverted", "two bendlets sinister").
 */
function ordinaryPhrase(g: Group): string {
  if (g.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  const { type, lines, mods } = g.item;
  const line = lineWords(ordinaryEdgeHost(g.item), lines);
  const counted = isDiminutive(type) && g.count > 1;
  const name = counted ? [numberWord(g.count), ORDINARY_PLURAL[type]]
    : [ORDINARY_ARTICLE[type], ...(ORDINARY_COUNTS[type]?.includes(g.count) ? [ORDINARY_COUNT_WORD[g.count]] : []), ORDINARY_NAME[type]];
  const words = [
    ...name, ...MODS_BEFORE_LINE.filter((m) => mods.includes(m)),
    ...(line ? [line] : []), ...MODS_AFTER_LINE.filter((m) => mods.includes(m)),
  ];
  return `${g.charged.length > 0 ? 'on ' : ''}${words.filter(Boolean).join(' ')}`;
}

/** "cotised", "doubly cotised", "triply cotised" — a pale's single pair "endorsed" (RULES-C §G.1). */
const COTISED_WORD: Record<1 | 2 | 3, string> = { 1: 'cotised', 2: 'doubly cotised', 3: 'triply cotised' };

/**
 * An ordinary's cotises as written after its tincture: "cotised", "a pale endorsed", "doubly cotised wavy". Their line is written only when it
 * isn't the ordinary's own (cotises follow it: RULES-C §B.4): "a bend wavy cotised plain", "a bend cotised wavy".
 */
function cotisedWords(type: OrdinaryType, lines: Lines, cotised: Cotises): string {
  const name = type === 'pale' && cotised.count === 1 ? 'endorsed' : COTISED_WORD[cotised.count];
  if (cotised.line === lines.a) return name;
  return `${name} ${cotised.line === 'plain' ? 'plain' : lineWords({ k: 'cotises', type }, { a: cotised.line, b: cotised.line })}`;
}

/** The charges whose charges are worded "charged with": animals and birds, which a charge is not "on" (D F.2). */
const CHARGED_WITH: readonly ChargeCategory[] = ['beast', 'monster', 'bird'];

/**
 * How the group on a host follows it: "on a fess Or three roses gules", "on a heart argent a lion azure" (the host is then
 * "on …"), "a unicorn argent charged with a fleur-de-lys purpure", "three flames argent each charged with a heart azure".
 */
function carrying(host: Group): { lead: string; on: boolean } {
  if (host.item.k === 'ordinary') return { lead: ' ', on: false };
  if (host.count > 1) return { lead: ' each charged with ', on: false };
  return CHARGED_WITH.includes(CHARGES[host.item.charge].category) ? { lead: ' charged with ', on: false } : { lead: ' ', on: true };
}

/**
 * `co-primary` is the second of two groups that are together the primary ("a unicorn and a rose"), `secondary` is set between (or around)
 * the primary, `position` stands beside it ("and in chief …"), `overall` lies across everything ("and overall a bend"); a `trim` is an
 * ordinary's fimbriation or cotises, written after its tincture ("a pale sable fimbriated Or", "a bend cotised azure").
 */
type TokenKind = 'primary' | 'co-primary' | 'secondary' | 'position' | 'overall' | 'peripheral' | 'tertiary' | 'trim';

/**
 * One element of the sentence: its phrase and paint (and what is strewn on it), whether its paint may be shared with the element before,
 * (a tertiary) what joins it to its host, and (a peripheral) what joins it to the element before when that says its own tincture.
 */
interface Token { kind: TokenKind; text: string; paint: string; strewn: string; linked: boolean; lead: string; joiner: PeripheralJoiner }

/** The elements in blazon order (RULES §F.2): primary, what is set between, what is on the primary, what stands in chief, base or canton, then each peripheral with what is on it. */
function tokens(d: Design, options: BlazonOptions): Token[] {
  const out: Token[] = [];
  const add = (kind: TokenKind, path: GroupPath, g: Group, lead = ' ') => {
    const prev = out[out.length - 1];
    // Bruce: a tincture carries back over the elements before it, but never into or out of "on a ...".
    const linked = (kind === 'co-primary' || kind === 'secondary' || kind === 'position' || kind === 'overall' || kind === 'peripheral') && prev !== undefined && prev.kind !== 'tertiary';
    const phrase = g.item.k === 'ordinary' ? ordinaryPhrase(g) : chargePhrase(d, path, g, options);
    const text = g.charged.length > 0 && carrying(g).on ? `on ${phrase}` : phrase;
    // Charges each divided: "three hearts each per pale gules and sable".
    const semy = asSemy(g.paint);
    const paint = semy ? tinctureWord(semy.ground.t) : g.item.k === 'charge' && g.count > 1 && g.paint.k === 'divided' ? `each ${paintWord(g.paint)}` : groupPaintWord(g);
    const joiner = kind === 'peripheral' && g.item.k === 'ordinary' ? PERIPHERAL_JOINER[g.item.type] : ', ';
    out.push({ kind, text: kind === 'overall' ? `overall ${text}` : text, paint, strewn: semy ? ` ${semyPhrase(semy.charge.charge, semy.ink.t)}` : '', linked, lead, joiner });
    // The fimbriation follows the ordinary's or charge's own tincture, always written; cotises may share the ordinary's ("a bend cotised
    // azure"). What follows may share the trim's ("a chevron gules fimbriated between three lions argent").
    const fimbriation = g.item.k === 'charge' ? fimbriationOf(g.item) : null;
    if (fimbriation) out.push({ kind: 'trim', text: 'fimbriated', paint: paintWord(fimbriation), strewn: '', linked: false, lead: ' ', joiner: ', ' });
    if (g.item.k !== 'ordinary') return;
    const { type, lines, fimbriated, cotised } = g.item;
    if (fimbriated) out.push({ kind: 'trim', text: 'fimbriated', paint: paintWord(fimbriated), strewn: '', linked: false, lead: ' ', joiner: ', ' });
    if (cotised) out.push({ kind: 'trim', text: cotisedWords(type, lines, cotised), paint: paintWord(cotised.paint), strewn: '', linked: true, lead: ' ', joiner: ', ' });
  };
  const tertiaries = (path: GroupPath, g: Group) => g.charged.forEach((t, j) => add('tertiary', [...path, j], t, carrying(g).lead));
  const at = (role: Group['role']) => d.groups.flatMap((g, i) => (g.role === role ? [{ g, path: [i] }] : []));

  const primaries = at('primary');
  const secondaries = at('secondary');
  const relation = (r: Group['relation']) => secondaries.filter(({ g }) => g.relation === r);
  const other = secondaries.find(({ g }) => g.relation !== 'between' && g.relation !== 'position');
  if (other) return notSupported({ category: 'multiple-groups', detail: `secondary-${other.g.relation ?? 'none'}` });
  primaries.forEach(({ g, path }, i) => add(i === 0 ? 'primary' : 'co-primary', path, g));
  for (const { g, path } of relation('between')) add('secondary', path, g);
  for (const { g, path } of primaries) tertiaries(path, g);
  for (const { g, path } of relation('position')) add('position', path, g);
  for (const { g, path } of at('overall')) add('overall', path, g);
  for (const { g, path } of at('peripheral')) {
    add('peripheral', path, g);
    tertiaries(path, g);
  }
  if (out.filter((t) => t.kind !== 'trim').length !== d.groups.length + d.groups.reduce((n, g) => n + g.charged.length, 0)) {
    return notSupported({ category: 'multiple-groups', detail: 'tertiary' });
  }
  return out;
}

export function blazon(d: Design, given: Partial<BlazonOptions> = {}): string {
  const options: BlazonOptions = { stateDefaults: false, stateTinctures: false, ...given };
  // A badge has no field to state: "(Fieldless) A wolf argent" (RULES §F.1).
  let text = d.kind === 'arms' ? fieldPhrase(d.field) : '';
  const all = tokens(d, options);
  let pending = false;
  all.forEach((t, i) => {
    // An element sharing the tincture of the one before is joined by "and" ("a fess and a base Or"), unless its joiner is a word of its own ("a heart within an orle gules").
    const shares = pending || t.kind === 'co-primary' || t.kind === 'position' || t.kind === 'overall';
    const lead = i === 0 ? (d.kind === 'arms' ? ', ' : '') : t.kind === 'secondary' ? ' between ' : t.kind === 'tertiary' || t.kind === 'trim' ? t.lead : shares && t.joiner === ', ' ? ' and ' : t.joiner;
    const next = all[i + 1];
    // What is strewn on a band is stated after its tincture, which then can't be left for the next to say. A band strewn after an element
    // shares its tincture as the College writes it ("a unicorn, a bordure argent mullety sable", regid 37777).
    pending = !options.stateTinctures && next !== undefined && next.linked && next.paint === t.paint && t.strewn === '';
    text += `${lead}${t.text}${pending ? '' : ` ${t.paint}${t.strewn}`}`;
  });
  return d.kind === 'arms' ? `${capitalise(text)}.` : `(Fieldless) ${capitalise(text)}`.trimEnd() + '.';
}
