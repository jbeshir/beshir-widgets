// The blazon emitter: one sentence in SCA house style (RULES §F). Only Or is capitalised among the
// tinctures, numbers are words, a posture or layout is written only when it isn't the default the
// College assumes, and a tincture is written once for a run of linked elements that share it.
// `stateDefaults` words those defaults too: the same design as a blazon that states them, which the
// SCA tooling compares with registered blazons (stating a default is optional, GoT Tables 5 and 7).

import { tinctureWord } from './tinctures';
import { capitalise, numberWord } from './words';
import { CHARGES, postureTerm, type ChargeCategory } from './charges';
import { hostOf, notSupported, type Design, type Group, type GroupPath, type Modifier, type Paint } from './design';
import { DIVISION_NAME } from './divisions';
import { ORDINARY_ARTICLE, ORDINARY_NAME } from './ordinaries';
import { contextOf, forcedPosition, isHalfPosition, layoutContext, layoutWords, statesLayout } from './arrangement';
import { paintGaps } from './support';

function paintWord(p: Paint): string {
  switch (p.k) {
    case 'tincture': return tinctureWord(p.t);
    case 'counterchanged': return 'counterchanged';
    default: return notSupported(paintGaps(p, false, 'group')[0]);
  }
}

function fieldPhrase(field: Paint): string {
  if (field.k === 'tincture') return tinctureWord(field.t);
  if (field.k === 'divided' && field.parts.length === 2) {
    return `${DIVISION_NAME[field.division]} ${field.parts.map(paintWord).join(' and ')}`;
  }
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

/** One element of the sentence: its phrase and paint, whether its paint may be shared with the element before, and (a tertiary) what joins it to its host. */
interface Token { kind: TokenKind; text: string; paint: string; linked: boolean; lead: string }

/** The elements in blazon order (RULES §F.2): primary, what is set between, what is on the primary, what stands in chief, base or canton, then each peripheral with what is on it. */
function tokens(d: Design, options: BlazonOptions): Token[] {
  const out: Token[] = [];
  const add = (kind: TokenKind, path: GroupPath, g: Group, lead = ' ') => {
    const prev = out[out.length - 1];
    // Bruce: a tincture carries back over the elements before it, but never into or out of "on a ...".
    const linked = (kind === 'co-primary' || kind === 'secondary' || kind === 'position' || kind === 'overall' || kind === 'peripheral') && prev !== undefined && prev.kind !== 'tertiary';
    const phrase = g.item.k === 'ordinary' ? ordinaryPhrase(g) : chargePhrase(d, path, g, options);
    const text = g.charged.length > 0 && carrying(g).on ? `on ${phrase}` : phrase;
    out.push({ kind, text: kind === 'overall' ? `overall ${text}` : text, paint: paintWord(g.paint), linked, lead });
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

export function blazon(d: Design, options: BlazonOptions = { stateDefaults: false }): string {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  let text = fieldPhrase(d.field);
  const all = tokens(d, options);
  let pending = false;
  all.forEach((t, i) => {
    const lead = i === 0 ? ', ' : t.kind === 'secondary' ? ' between ' : t.kind === 'tertiary' ? t.lead : pending || t.kind === 'co-primary' || t.kind === 'position' || t.kind === 'overall' ? ' and ' : ', ';
    const next = all[i + 1];
    pending = next !== undefined && next.linked && next.paint === t.paint;
    text += `${lead}${t.text}${pending ? '' : ` ${t.paint}`}`;
  });
  return `${capitalise(text)}.`;
}
