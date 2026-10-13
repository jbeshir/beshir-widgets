// The rule of tincture (SENA A3B): a ground walker. Every group lies on a ground — the field for primary,
// secondary and peripheral groups, its host for a tertiary — and must contrast with the part of it that is
// actually under it. Messages name the element and, where a group is judged slot by slot, the slots.

import { TINCTURE_NAME, type Tincture } from './tinctures';
import { capitalise, joinAnd, numberWord } from './words';
import { CHARGES, type ChargeId } from './charges';
import { contrastFailure, type ContrastFailure } from './contrast';
import {
  fieldTinctures, groupAt, hostOf, notSupported, walkGroups, type Design, type Group, type GroupPath, type Issue, type Paint,
} from './design';
import { fieldTinctureAt, ordinarySamplePoints, probePoints, slotColumn, slotRow, type Pt, type Slot } from './geometry';
import { canonicalSlots } from './layout';
import { ORDINARY_NAME } from './ordinaries';

export const FAILURE_TEXT: Record<ContrastFailure, string> = {
  same: 'same tincture',
  'colour-on-colour': 'colour on colour',
  'metal-on-metal': 'metal on metal',
};

/** The field's two tinctures when it is divided into two plain tinctures, else null: all counterchanging needs. */
function fieldPair(d: Design): [Tincture, Tincture] | null {
  const ts = d.kind === 'arms' && d.field.k === 'divided' ? fieldTinctures(d) : [];
  return ts.length === 2 ? [ts[0], ts[1]] : null;
}

/** The field tinctures at these points, in the field's part order. */
function tincturesAt(field: Paint, points: readonly Pt[], partOrder: readonly Tincture[]): Tincture[] {
  const seen = new Set(points.map(([x, y]) => fieldTinctureAt(field, x, y)));
  return partOrder.filter((t, i) => seen.has(t) && partOrder.indexOf(t) === i);
}

/** The heater slots of a charge group, or none when it has no layout (the structure rules say so). */
function slotsOf(d: Design, path: GroupPath): Slot[] {
  const slots = canonicalSlots(d, path);
  return slots.length === groupAt(d, path).count ? slots : [];
}

/**
 * The tinctures each slot of a charge group lies on (probed at five points), or the one list of an ordinary.
 * A tertiary lies on its host's paint; a counterchanged host shows the field's other tincture over each part.
 * Empty when there is nothing to judge: no layout, or a host with no ground to take tinctures from.
 */
export function groundContacts(d: Design, path: GroupPath): Tincture[][] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const group = groupAt(d, path), host = hostOf(d, path);
  const parts = fieldTinctures(d);
  if (host) {
    if (group.item.k !== 'charge') return notSupported({ category: 'placement', detail: 'tertiary-ordinary' });
    if (host.paint.k === 'tincture') return slotsOf(d, path).map(() => [(host.paint as { t: Tincture }).t]);
    const pair = fieldPair(d);
    if (host.paint.k !== 'counterchanged') return notSupported({ category: 'tincture', detail: host.paint.k });
    if (!pair) return [];
    const other = (t: Tincture) => (t === pair[0] ? pair[1] : pair[0]);
    return slotsOf(d, path).map((s) => tincturesAt(d.field, probePoints(s), parts).map(other));
  }
  if (group.item.k === 'ordinary') return [tincturesAt(d.field, ordinarySamplePoints(group.item.type), parts)];
  return slotsOf(d, path).map((s) => tincturesAt(d.field, probePoints(s), parts));
}

/** What a thing is called in a message: "lion", "mullets", "fess". */
function nounOf(g: Group): string {
  return g.item.k === 'ordinary' ? ORDINARY_NAME[g.item.type] : g.count === 1 ? CHARGES[g.item.charge].name : CHARGES[g.item.charge].plural;
}

/**
 * Why a counterchanged group can't be, or null when it can: only things lying on a divided field can take
 * its tinctures in reverse (SENA A3B2). Phrased so it can double as a blocked reason.
 */
export function counterchangeUnavailable(d: Design, path: GroupPath): string | null {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (group.paint.k !== 'counterchanged') return null;
  const thing = `${group.item.k === 'ordinary' ? 'the ' : ''}${nounOf(group)}`;
  if (host) {
    const [lie, they] = group.item.k === 'charge' && group.count > 1 ? ['lie', 'they'] : ['lies', 'it'];
    const onto = host.item.k === 'ordinary' ? ORDINARY_NAME[host.item.type] : CHARGES[host.item.charge].name;
    return `The ${nounOf(group)} ${lie} on the ${onto}, not on the field, so ${they} can't be counterchanged — only charges and bands on a divided field can.`;
  }
  if (fieldPair(d) === null) {
    const each = group.item.k === 'ordinary' ? thing : 'each charge';
    return `Counterchanged needs a divided field: ${each} takes the field's other tincture, and a plain field has only one.`;
  }
  return null;
}

/**
 * Why a group with this paint fails on its ground, or null. A counterchanged group shows, over each part
 * of the field it lies on, the other part's tincture, so it fails exactly when the two share a class.
 */
function failureOf(paint: Paint, contacts: readonly Tincture[], pair: readonly [Tincture, Tincture] | null): ContrastFailure | null {
  if (paint.k === 'tincture') return contrastFailure(paint.t, contacts);
  if (paint.k === 'counterchanged') return pair ? contrastFailure(pair[1], [pair[0]]) : 'same';
  return notSupported({ category: 'tincture', detail: paint.k });
}

/** "(a two-colour field needs a metal charge)" when both background tinctures share a class. */
function twoClassHint(failure: ContrastFailure, contacts: readonly Tincture[], what: string): string {
  if (failure === 'same' || contacts.length !== 2) return '';
  return failure === 'colour-on-colour'
    ? ` (a two-colour field needs a metal ${what})`
    : ` (a two-metal field needs a colour ${what})`;
}

/**
 * Name a subset of slots in words: "the Gules lion", "both Or keys", "the two upper Gules mullets",
 * "the upper-left and lower Gules mullets". With no paint the word is dropped: "the two upper mullets".
 */
export function describeSlots(slots: readonly Slot[], idx: readonly number[], paint: string | null, charge: ChargeId): string {
  const meta = CHARGES[charge];
  const T = paint ? `${paint} ` : '';
  const count = slots.length;
  if (count <= 1) return `the ${T}${meta.name}`;
  if (idx.length === count) return count === 2 ? `both ${T}${meta.plural}` : `all ${numberWord(count)} ${T}${meta.plural}`;
  const rows = slots.map(slotRow);
  const r0 = rows[idx[0]];
  const sameRow = idx.every((i) => rows[i] === r0);
  const othersInRow = rows.some((r, i) => r === r0 && !idx.includes(i));
  if (sameRow && !othersInRow) {
    return idx.length === 1 ? `the ${r0} ${T}${meta.name}` : `the ${numberWord(idx.length)} ${r0} ${T}${meta.plural}`;
  }
  const oneRow = rows.every((r) => r === rows[0]);
  const labels = idx.map((i) => {
    const sharesRow = rows.some((r, j) => j !== i && r === rows[i]);
    const label = [oneRow ? '' : rows[i], sharesRow ? slotColumn(slots[i]) : ''].filter(Boolean).join('-');
    return label === 'middle-centre' ? 'centre' : label || slotColumn(slots[i]);
  });
  return idx.length === 1 ? `the ${labels[0]} ${T}${meta.name}` : `the ${joinAnd(labels)} ${T}${meta.plural}`;
}

const paintName = (p: Paint): string => (p.k === 'tincture' ? TINCTURE_NAME[p.t] : 'Counterchanged');

/** The issue of an ordinary that fails on `contacts` of a field. */
function ordinaryMessage(d: Design, g: Group, f: ContrastFailure, contacts: readonly Tincture[], pair: readonly [Tincture, Tincture] | null): string {
  const T = paintName(g.paint), name = nounOf(g);
  if (g.paint.k === 'counterchanged' && pair) {
    return `${T} ${name} on ${TINCTURE_NAME[pair[0]]} and ${TINCTURE_NAME[pair[1]]}: ${FAILURE_TEXT[f]} (counterchanging needs a field of one metal and one colour)`;
  }
  const parts = fieldTinctures(d);
  if (d.kind === 'arms' && d.field.k === 'tincture') return `${T} ${name} on ${TINCTURE_NAME[parts[0]]} field: ${FAILURE_TEXT[f]}`;
  if (f === 'same') return `${T} ${name} lies on the ${T} part of the field: same tincture`;
  if (contacts.length === 1) return `${T} ${name} lies on ${TINCTURE_NAME[contacts[0]]}: ${FAILURE_TEXT[f]}`;
  return `${T} ${name} on ${TINCTURE_NAME[contacts[0]]} and ${TINCTURE_NAME[contacts[1]]} field: ${FAILURE_TEXT[f]}${twoClassHint(f, contacts, 'ordinary')}`;
}

/** The issues of a charge group, one per run of failing slots that share a ground and a failure. */
function chargeIssues(d: Design, path: GroupPath, g: Group, host: Group | null, contacts: Tincture[][], pair: readonly [Tincture, Tincture] | null): Issue[] {
  if (g.item.k !== 'charge') return [];
  const { charge } = g.item;
  const at = { k: 'group', path } as const;
  const slots = canonicalSlots(d, path);
  const noun = nounOf(g), T = paintName(g.paint);
  const all = slots.map((_, i) => i);
  const failures = contacts.map((cs) => (cs.length === 0 ? null : failureOf(g.paint, cs, pair)));
  const issue = (message: string, idx: number[]): Issue => ({ code: 'tincture', at, message, slots: idx });

  if (g.paint.k === 'counterchanged') {
    // Every part shows the other field tincture over its own, so all the charges pass or fail together.
    const f = failures.find((x) => x !== null);
    if (!f || !pair) return [];
    const hint = f === 'same' ? '' : ' (counterchanging needs a field of one metal and one colour)';
    return [issue(`${T} ${noun} on ${TINCTURE_NAME[pair[0]]} and ${TINCTURE_NAME[pair[1]]}: ${FAILURE_TEXT[f]}${hint}`, all)];
  }
  if (host?.paint.k === 'tincture') {
    const f = failures.find((x) => x !== null);
    const onto = host.item.k === 'ordinary' ? ORDINARY_NAME[host.item.type] : CHARGES[host.item.charge].name;
    return f ? [issue(`${T} ${noun} on the ${TINCTURE_NAME[host.paint.t]} ${onto}: ${FAILURE_TEXT[f]}`, all)] : [];
  }
  if (d.kind === 'arms' && d.field.k === 'tincture') {
    const f = failures.find((x) => x !== null);
    return f ? [issue(`${T} ${noun} on ${TINCTURE_NAME[d.field.t]} field: ${FAILURE_TEXT[f]}`, all)] : [];
  }
  // Group failing slots that share the same background and failure, in slot order.
  const groups = new Map<string, number[]>();
  failures.forEach((f, i) => {
    if (!f) return;
    const key = `${f}|${contacts[i].join(',')}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  return [...groups].map(([key, idx]) => {
    const f = key.split('|')[0] as ContrastFailure;
    const cs = contacts[idx[0]];
    const names = cs.map((t) => TINCTURE_NAME[t]);
    if (idx.length === slots.length && cs.length === 2 && !host) {
      return issue(`${T} ${noun} on ${names[0]} and ${names[1]} field: ${FAILURE_TEXT[f]}${twoClassHint(f, cs, 'charge')}`, idx);
    }
    const subject = describeSlots(slots, idx, g.paint.k === 'tincture' ? T : null, charge);
    const where = cs.length === 1 ? `on ${names[0]}` : `across ${names[0]} and ${names[1]}`;
    return issue(`${capitalise(subject)} ${idx.length > 1 ? 'lie' : 'lies'} ${where}: ${FAILURE_TEXT[f]}${twoClassHint(f, cs, 'charge')}`, idx);
  });
}

/** The rule-of-tincture violations of the group at `path` alone. */
export function groupTinctureIssues(d: Design, path: GroupPath): Issue[] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const group = groupAt(d, path), host = hostOf(d, path);
  const at = { k: 'group', path } as const;
  const unavailable = counterchangeUnavailable(d, path);
  if (unavailable) {
    const slots = group.item.k === 'charge' ? slotsOf(d, path).map((_, i) => i) : [];
    return [{ code: 'tincture', at, message: unavailable, slots }];
  }
  const pair = fieldPair(d);
  const contacts = groundContacts(d, path);
  if (group.item.k === 'charge') return chargeIssues(d, path, group, host, contacts, pair);
  const f = contacts[0].length === 0 ? null : failureOf(group.paint, contacts[0], pair);
  return f ? [{ code: 'tincture', at, message: ordinaryMessage(d, group, f, contacts[0], pair), slots: [] }] : [];
}

/** Every rule-of-tincture violation, group by group in canonical order. */
export function tinctureIssues(d: Design): Issue[] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  return walkGroups(d).flatMap(({ path }) => groupTinctureIssues(d, path));
}
