// The blazon emitter: one sentence in SCA house style (RULES §F). Only Or is capitalised among the
// tinctures, numbers are words, a posture or layout is written only when it isn't the default the
// College assumes, and a tincture is written once for a run of linked elements that share it.

import { tinctureWord } from './tinctures';
import { capitalise, numberWord } from './words';
import { CHARGES, postureTerm } from './charges';
import { hostOf, notSupported, type Design, type Group, type GroupPath, type Modifier, type Paint } from './design';
import { DIVISION_NAME } from './divisions';
import { ORDINARY_ARTICLE, ORDINARY_NAME } from './ordinaries';
import { contextOf, layoutWords, statesLayout } from './arrangement';
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

/** A charge group's phrase: [layout prefix] count noun [posture] [mods] [layout postfix], without its tincture. */
function chargePhrase(d: Design, path: GroupPath, g: Group): string {
  if (g.item.k !== 'charge') throw new RangeError('Not a charge.');
  const meta = CHARGES[g.item.charge];
  const words = [g.count === 1 ? meta.article : numberWord(g.count), g.count === 1 ? meta.name : meta.plural];
  // GoT Table 5: a posture the College assumes is left out (RULES §F.8).
  if (g.item.posture && g.item.posture !== meta.scaDefaultPosture) words.push(postureTerm(g.item.charge, g.item.posture));
  words.push(...g.item.mods.map(modifierWords));
  if (contextOf(d, g, hostOf(d, path)) === null || !statesLayout(d, path)) return words.join(' ');
  const layout = layoutWords({ arrangement: g.arrangement, position: g.position });
  // Lines and positions lead ("in pale two keys"); count patterns follow ("five roses two, two and one", RULES §F.3).
  return g.position !== null || g.arrangement.k === 'line' ? `${layout} ${words.join(' ')}` : `${words.join(' ')} ${layout}`;
}

/** "a bend", or "on a bend" when something sits on it. */
function ordinaryPhrase(g: Group): string {
  if (g.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  return `${g.charged.length > 0 ? 'on ' : ''}${ORDINARY_ARTICLE[g.item.type]} ${ORDINARY_NAME[g.item.type]}`;
}

type TokenKind = 'primary' | 'secondary' | 'peripheral' | 'tertiary';

/** One element of the sentence: its phrase and paint, and whether its paint may be shared with the element before. */
interface Token { kind: TokenKind; text: string; paint: string; linked: boolean }

/** The elements in blazon order (RULES §F.2): primary, what is set between, what is on the primary, then each peripheral with what is on it. */
function tokens(d: Design): Token[] {
  const out: Token[] = [];
  const add = (kind: TokenKind, path: GroupPath, g: Group) => {
    const prev = out[out.length - 1];
    // Bruce: a tincture carries back over the elements before it, but never into or out of "on a ...".
    const linked = (kind === 'secondary' || kind === 'peripheral') && prev !== undefined && prev.kind !== 'tertiary';
    out.push({ kind, text: g.item.k === 'ordinary' ? ordinaryPhrase(g) : chargePhrase(d, path, g), paint: paintWord(g.paint), linked });
  };
  const tertiaries = (path: GroupPath, g: Group) => g.charged.forEach((t, j) => add('tertiary', [...path, j], t));
  const at = (role: Group['role']) => d.groups.flatMap((g, i) => (g.role === role ? [{ g, path: [i] }] : []));

  const primaries = at('primary');
  for (const { g, path } of primaries) add('primary', path, g);
  for (const { g, path } of at('secondary')) {
    if (g.relation !== 'between') return notSupported({ category: 'multiple-groups', detail: `secondary-${g.relation ?? 'none'}` });
    add('secondary', path, g);
  }
  for (const { g, path } of primaries) tertiaries(path, g);
  for (const { g, path } of at('peripheral')) {
    add('peripheral', path, g);
    tertiaries(path, g);
  }
  if (out.length !== d.groups.length + d.groups.reduce((n, g) => n + g.charged.length, 0)) {
    return notSupported({ category: 'multiple-groups', detail: 'overall' });
  }
  return out;
}

export function blazon(d: Design): string {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  let text = fieldPhrase(d.field);
  const all = tokens(d);
  let pending = false;
  all.forEach((t, i) => {
    const lead = i === 0 ? ', ' : t.kind === 'secondary' ? ' between ' : t.kind === 'tertiary' ? ' ' : pending ? ' and ' : ', ';
    const next = all[i + 1];
    pending = next !== undefined && next.linked && next.paint === t.paint;
    text += `${lead}${t.text}${pending ? '' : ` ${t.paint}`}`;
  });
  return `${capitalise(text)}.`;
}
