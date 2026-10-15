// The blazon emitter: one sentence in SCA house style (RULES §F). Only Or is capitalised among the
// tinctures, numbers are words, a posture or layout is written only when it isn't the default the
// College assumes, and a tincture is written once for a run of linked elements that share it.
// `stateDefaults` words those defaults too: the same design as a blazon that states them, which the
// SCA tooling compares with registered blazons (stating a default is optional, GoT Tables 5 and 7).

import { tinctureWord, type Tincture } from './tinctures';
import { furName } from './fur';
import { treatedName } from './treatment';
import { semyPhrase } from './aliases';
import { capitalise, numberWord } from './words';
import { CHARGES, postureTerm, type ChargeCategory, type ChargeId } from './charges';
import { asParty, asSemy, asTreated, asVariation, hostOf, notSupported, type Design, type Group, type GroupPath, type Modifier, type Paint } from './design';
import { DEFAULT_PIECES, DIVISION_NAME, VARIATION_NAME } from './divisions';
import { ORDINARY_ARTICLE, ORDINARY_NAME } from './ordinaries';
import { contextOf, forcedPosition, isHalfPosition, layoutContext, layoutWords, statesLayout } from './arrangement';
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
    default: return notSupported(paintGaps(p, false, 'group')[0]);
  }
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


/** A divided paint as written: "per pale azure and Or". */
function partyWord(p: Paint): string {
  const party = asParty(p);
  return party ? `${DIVISION_NAME[party.division]} ${party.parts.map(paintWord).join(' and ')}` : notSupported(paintGaps(p, false, 'group')[0]);
}

/** A variation as written: "barry argent and azure", "paly of eight Or and sable" (the usual six stripes are not blazoned: "barry of six" is a stated default). */
function variationWord(p: Paint): string {
  const varied = asVariation(p);
  if (!varied) return notSupported(paintGaps(p, false, 'group')[0]);
  const count = varied.pieces === null || varied.pieces === DEFAULT_PIECES ? '' : ` of ${numberWord(varied.pieces)}`;
  return `${VARIATION_NAME[varied.variation]}${count} ${varied.parts.map((x) => tinctureWord(x.t)).join(' and ')}`;
}


/** A divided field strewn all over with one charge: both parts are the same semy, in one tincture or each in the other's ("all semy of roses counterchanged"). */
function strewnAllOver(field: Paint): { grounds: [Tincture, Tincture]; charge: ChargeId; ink: Tincture | 'counterchanged' } | null {
  const [a, b] = field.k === 'divided' ? field.parts.map(asSemy) : [];
  if (!a || !b || a.charge.charge !== b.charge.charge) return null;
  const grounds: [Tincture, Tincture] = [a.ground.t, b.ground.t];
  if (a.ink.t === b.ink.t) return { grounds, charge: a.charge.charge, ink: a.ink.t };
  return a.ink.t === b.ground.t && b.ink.t === a.ground.t ? { grounds, charge: a.charge.charge, ink: 'counterchanged' } : null;
}


function fieldPhrase(field: Paint): string {
  const all = strewnAllOver(field);
  if (field.k === 'divided' && all) return `${DIVISION_NAME[field.division]} ${all.grounds.map(tinctureWord).join(' and ')} all ${semyPhrase(all.charge, all.ink)}`;
  if (field.k === 'tincture' || field.k === 'fur' || field.k === 'treated' || field.k === 'semy') return paintWord(field);
  if (field.k === 'divided' && field.parts.length === 2 && field.parts.every((p) => p.k === 'tincture' || p.k === 'fur' || p.k === 'treated' || p.k === 'semy')) {
    return `${DIVISION_NAME[field.division]} ${field.parts.map(paintWord).join(' and ')}`;
  }
  if (field.k === 'variation') return variationWord(field);
  return notSupported(paintGaps(field, true, 'field')[0]);
}

function modifierWords(m: Modifier): string {
  return m.id === 'in-splendour' && m.count === null && m.paint === null
    ? 'in splendor'
    : notSupported({ category: 'charge-modifier', detail: m.id });
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
  const k = layoutContext(d, path).k;
  // Charges on the primary charges, and charges overall, state every layout but the one charge alone, defaults or not (Table 7: they must be stated).
  if (!stateDefaults || k === 'on-charge' || k === 'overall') return statesLayout(d, path);
  return k === 'position' || k === 'around' || (k === 'field' && (g.arrangement.k !== 'single' || g.position !== null));
}

/** A charge group's phrase: [layout prefix] count noun [posture] [mods] [layout postfix], without its tincture. */
function chargePhrase(d: Design, path: GroupPath, g: Group, options: BlazonOptions): string {
  if (g.item.k !== 'charge') throw new RangeError('Not a charge.');
  const meta = CHARGES[g.item.charge];
  const words = [g.count === 1 ? meta.article : numberWord(g.count), g.count === 1 ? meta.name : meta.plural];
  // GoT Table 5: a posture the College assumes is left out (RULES §F.8).
  if (g.item.posture && (options.stateDefaults || g.item.posture !== meta.scaDefaultPosture)) words.push(postureTerm(g.item.charge, g.item.posture));
  words.push(...g.item.mods.map(modifierWords));
  if (!wordsLayout(d, path, g, options)) return words.join(' ');
  // Charges Table 7 forces into one part of the field by tincture are not said to stand there; how they stand there still is.
  const forced = !options.stateDefaults && g.position !== null && g.position === forcedPosition(d, path);
  if (forced && g.arrangement.k === 'single') return words.join(' ');
  const position = forced ? null : g.position;
  const layout = layoutWords({ arrangement: g.arrangement, position });
  // Two co-primary groups share one arrangement, said once: a line leads the first ("in pale a crescent and a mullet"), a pattern follows the second.
  const ctx = layoutContext(d, path);
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

/** "a bend", or "on a bend" when something sits on it. */
function ordinaryPhrase(g: Group): string {
  if (g.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  return `${g.charged.length > 0 ? 'on ' : ''}${ORDINARY_ARTICLE[g.item.type]} ${ORDINARY_NAME[g.item.type]}`;
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

/** `co-primary` is the second of two groups that are together the primary ("a unicorn and a rose"), `secondary` is set between (or around) the primary, `position` stands beside it ("and in chief …"), `overall` lies across everything ("and overall a bend"). */
type TokenKind = 'primary' | 'co-primary' | 'secondary' | 'position' | 'overall' | 'peripheral' | 'tertiary';

/** One element of the sentence: its phrase and paint (and what is strewn on it), whether its paint may be shared with the element before, and (a tertiary) what joins it to its host. */
interface Token { kind: TokenKind; text: string; paint: string; strewn: string; linked: boolean; lead: string }

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
    const paint = semy ? tinctureWord(semy.ground.t) : g.item.k === 'charge' && g.count > 1 && g.paint.k === 'divided' ? `each ${paintWord(g.paint)}` : paintWord(g.paint);
    out.push({ kind, text: kind === 'overall' ? `overall ${text}` : text, paint, strewn: semy ? ` ${semyPhrase(semy.charge.charge, semy.ink.t)}` : '', linked, lead });
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
  if (out.length !== d.groups.length + d.groups.reduce((n, g) => n + g.charged.length, 0)) {
    return notSupported({ category: 'multiple-groups', detail: 'tertiary' });
  }
  return out;
}

export function blazon(d: Design, given: Partial<BlazonOptions> = {}): string {
  const options: BlazonOptions = { stateDefaults: false, stateTinctures: false, ...given };
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  let text = fieldPhrase(d.field);
  const all = tokens(d, options);
  let pending = false;
  all.forEach((t, i) => {
    const lead = i === 0 ? ', ' : t.kind === 'secondary' ? ' between ' : t.kind === 'tertiary' ? t.lead : pending || t.kind === 'co-primary' || t.kind === 'position' || t.kind === 'overall' ? ' and ' : ', ';
    const next = all[i + 1];
    // What is strewn on a band is stated after its tincture, which then can't be left for the next to say.
    pending = !options.stateTinctures && next !== undefined && next.linked && next.paint === t.paint && t.strewn === '';
    text += `${lead}${t.text}${pending ? '' : ` ${t.paint}${t.strewn}`}`;
  });
  return `${capitalise(text)}.`;
}
