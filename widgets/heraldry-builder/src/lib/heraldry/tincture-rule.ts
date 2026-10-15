// The rule of tincture (SENA A3B): a ground walker. Every group lies on a ground — the field for primary,
// secondary and peripheral groups, its host for a tertiary — and must contrast with the part of it that is
// actually under it, judged by area (A3B1). Messages name the element and, where a group is judged slot by
// slot, the slots.

import { TINCTURE_CLASS, TINCTURE_NAME, type Tincture } from './tinctures';
import { capitalise, joinAnd, numberWord } from './words';
import { CHARGES, type ChargeId } from './charges';
import { contrastFailure, groundFailure, groundTinctures, type ContrastFailure, type Ground, type SharedTinctureException } from './contrast';
import { fieldSurfaces, surfaceOf, tinctureSurface, type Surface } from './surface';
import { furName } from './fur';
import { treatedName } from './treatment';
import {
  asParty, asTreated, asVariation, fieldParts, fieldTinctures, groupAt, hostOf, itemName, notSupported, paintTinctures, primaryGroups, walkGroups, type Design, type Group, type GroupPath, type Issue, type Item, type Paint,
} from './design';
import {
  CANONICAL_SHAPE, fieldSurfaceAt, groundPoints, inFirstPart, inFirstPartTurned, ordinaryCentre, ordinarySamplePoints, shapeFrame, slotColumn, slotRow, type Pt, type Point, type Slot,
} from './geometry';
import { canonicalSlots, groupSlotCount } from './layout';
import { ORDINARY_KIND, ORDINARY_NAME, type OrdinaryType } from './ordinaries';
import { DIVISION_NAME, DRAWN_DIVISIONS, VARIATION_NAME, type Division, type Variation } from './divisions';
import { coPrimaries, forcedLayout, layoutContext } from './arrangement';

export const FAILURE_TEXT: Record<ContrastFailure, string> = {
  same: 'same tincture',
  'colour-on-colour': 'colour on colour',
  'metal-on-metal': 'metal on metal',
};

/** The field's two tinctures when it is divided or varied into two plain tinctures, else null: all counterchanging needs. */
function fieldPair(d: Design): [Tincture, Tincture] | null {
  const ts = d.kind === 'arms' && (d.field.k === 'divided' || d.field.k === 'variation') ? fieldTinctures(d) : [];
  return ts.length === 2 ? [ts[0], ts[1]] : null;
}

/** Sample points and a key naming them (a slot, an ordinary), so their shares can be memoised. */
interface Samples { key: string; points: () => readonly Pt[] }

const slotSamples = (s: Slot): Samples => ({ key: `${s.x},${s.y},${s.size}`, points: () => groundPoints(s) });

/** Whether a paint is a tincture, a fur or a treated tincture: one thing over the part it fills. */
const isOneThing = (p: Paint): boolean => p.k === 'tincture' || p.k === 'fur' || asTreated(p) !== null;

/** The share of each sample set in the first part of each division: it depends on the lines alone, not on the tinctures. */
const firstShares = new Map<string, number>();

function firstShare(division: Division, samples: Samples): number {
  const key = `${division}|${samples.key}`;
  let share = firstShares.get(key);
  if (share === undefined) {
    const points = samples.points();
    const { x, y } = shapeFrame(CANONICAL_SHAPE).fessPoint;
    share = points.filter(([px, py]) => inFirstPart(division, { x, y }, px, py)).length / points.length;
    firstShares.set(key, share);
  }
  return share;
}

/** The share of the samples each field surface lies under, in the field's part order. */
function groundAt(field: Paint, samples: Samples, partOrder: readonly Surface[]): Ground {
  // A variation is judged as a whole (A3B1): the one surface lies under everything.
  if (field.k === 'variation') return partOrder.map((surface) => ({ surface, share: 1 }));
  const counts = new Map<Surface, number>();
  const [a, b] = field.k === 'divided' ? field.parts : [];
  if (field.k === 'divided' && field.parts.length === 2 && isOneThing(a) && isOneThing(b) && DRAWN_DIVISIONS.includes(field.division)) {
    const first = firstShare(field.division, samples);
    const [sa, sb] = [surfaceOf(a, null), surfaceOf(b, null)];
    counts.set(sa, first);
    counts.set(sb, (counts.get(sb) ?? 0) + 1 - first);
  } else {
    const points = samples.points();
    for (const [x, y] of points) {
      const s = fieldSurfaceAt(field, x, y);
      counts.set(s, (counts.get(s) ?? 0) + 1 / points.length);
    }
  }
  return partOrder.flatMap((surface, i) => {
    const share = counts.get(surface);
    return share && partOrder.indexOf(surface) === i ? [{ surface, share }] : [];
  });
}

/**
 * The ordinary that runs along each drawn division's line. On its own division an ordinary lies over the line, half on
 * each part, as the College reads "Per chevron argent and sable, a chevron gules" (registered at least twelve times,
 * e.g. LoAR 2023-04 "Per chevron argent and sable, a chevron purpure …"); the fess, pale, bend, cross and saltire are
 * drawn centred on their lines anyway, the chevron just below its. Herald question H4 (REVIEW.md).
 */
const ORDINARY_ON_LINE: Partial<Record<Division, OrdinaryType>> = {
  'per-pale': 'pale', 'per-fess': 'fess', 'per-bend': 'bend', 'per-bend-sinister': 'bend-sinister',
  'per-chevron': 'chevron', quarterly: 'cross', 'per-saltire': 'saltire',
};

/** The heater slots of a charge group, or none when it has no layout (the structure rules say so). */
function slotsOf(d: Design, path: GroupPath): Slot[] {
  const slots = canonicalSlots(d, path);
  return slots.length === groupSlotCount(d, path) ? slots : [];
}

/**
 * Where a slot is judged: where it is drawn, except that a charge alone in the centre of the field is judged at the
 * fess point, its conceptual place, however far a chief pushes the drawing down (SENA A5C3: minor variation in
 * placement is artistic).
 */
function judgedSlot(group: Group, slot: Slot): Slot {
  if (group.arrangement.k !== 'single' || group.position !== null) return slot;
  const { x, y } = shapeFrame(CANONICAL_SHAPE).fessPoint;
  return { ...slot, x, y };
}

/**
 * The ground of each slot of a charge group (sampled over its middle), or the one ground of an ordinary.
 * A tertiary lies on its host's paint; a counterchanged host shows the field's other tincture over each part.
 * Empty when there is nothing to judge: no layout, or a host with no ground to take tinctures from.
 */
export function groundShares(d: Design, path: GroupPath): Ground[] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const group = groupAt(d, path), host = hostOf(d, path);
  const parts = fieldSurfaces(d);
  if (host) {
    if (group.item.k !== 'charge') return notSupported({ category: 'placement', detail: 'tertiary-ordinary' });
    const hp = host.paint;
    if (hp.k !== 'counterchanged') {
      const surface = surfaceOf(hp, host.item);
      return slotsOf(d, path).map(() => [{ surface, share: 1 }]);
    }
    const pair = fieldPair(d);
    if (!pair) return [];
    const [first, second] = pair.map(tinctureSurface);
    const other = (s: Surface) => (s === first ? second : first);
    return slotsOf(d, path).map((s) => groundAt(d.field, slotSamples(s), parts).map((g) => ({ surface: other(g.surface), share: g.share })));
  }
  if (group.item.k === 'ordinary') {
    const type = group.item.type;
    if (d.field.k === 'divided' && ORDINARY_ON_LINE[d.field.division] === type) return [parts.map((surface) => ({ surface, share: 1 / parts.length }))];
    return [groundAt(d.field, { key: `ordinary:${type}`, points: () => ordinarySamplePoints(type) }, parts)];
  }
  return slotsOf(d, path).map((s) => groundAt(d.field, slotSamples(judgedSlot(group, s)), parts));
}

/**
 * The ground under each part of a group divided in two, per slot (or for the ordinary): each part lies on its own side of
 * the division through the item's centre. A part may share a tincture with a section of the field it does not lie on (A3B4b:
 * "Per pale sable and argent, a bordure per pale argent and azure"). Null unless the group is a party on the field.
 */
function partGrounds(d: Design, path: GroupPath): Ground[][] | null {
  if (d.kind !== 'arms') return null;
  const group = groupAt(d, path), party = asParty(group.paint);
  if (!party || hostOf(d, path)) return null;
  const surfaces = fieldSurfaces(d);
  const split = (samples: Samples, centre: Point, turn: number): Ground[] => ([0, 1] as const).map((k) => {
    const points = samples.points().filter(([x, y]) => inFirstPartTurned(party.division, centre, turn, x, y) === (k === 0));
    return points.length === 0 ? [] : groundAt(d.field, { key: `${samples.key}@${centre.x},${centre.y}/${turn}/${party.division}/${k}`, points: () => points }, surfaces);
  });
  if (group.item.k === 'ordinary') {
    const type = group.item.type;
    return [split({ key: `ordinary:${type}`, points: () => ordinarySamplePoints(type) }, ordinaryCentre(type, CANONICAL_SHAPE), 0)];
  }
  return slotsOf(d, path).map((s) => {
    const judged = judgedSlot(group, s);
    return split(slotSamples(judged), { x: judged.x, y: judged.y }, judged.rotation);
  });
}

/** The tinctures each slot (or the ordinary) touches at all: `groundShares` without the shares. */
export function groundContacts(d: Design, path: GroupPath): Tincture[][] {
  return groundShares(d, path).map(groundTinctures);
}

/** The field tincture a group on the field lies wholly on, or null when it touches more than one (or has no ground). Co-primary groups are judged together: charges each in one part of the field are counterchanged over it as a whole. */
function oneSection(d: Design, path: GroupPath): Tincture | null {
  const paths = groupAt(d, path).role === 'primary' && coPrimaries(d) ? primaryGroups(d).map((p) => p.path) : [path];
  const touched = new Set(paths.flatMap((p) => groundContacts(d, p).flat()));
  return touched.size === 1 ? [...touched][0] : null;
}

/**
 * What a group shows over the parts of the field (A5G3a reads "counterchanged" as the tinctures it stands for): a plain
 * tincture shows itself everywhere; a counterchanged group shows, over each part it lies on (by part index), the other
 * part's tincture. Empty for a counterchanged group with no field parts to show (on a host or a plain field: invalid).
 */
export type ShownSurfaces = { k: 'plain'; surface: Surface } | { k: 'parts'; byPart: ReadonlyMap<number, Surface> };

export function shownSurfaces(d: Design, path: GroupPath): ShownSurfaces {
  const paint = groupAt(d, path).paint;
  if (paint.k !== 'counterchanged') return { k: 'plain', surface: surfaceOf(paint, groupAt(d, path).item) };
  const pair = fieldPair(d);
  if (!pair || hostOf(d, path)) return { k: 'parts', byPart: new Map() };
  const touched = new Set(groundContacts(d, path).flat());
  return { k: 'parts', byPart: new Map(pair.flatMap((t, i) => (touched.has(t) ? [[i, tinctureSurface(pair[1 - i])] as const] : []))) };
}

/** What a thing is called in a message: "lion", "mullets", "fess". */
function nounOf(g: Group): string {
  return g.item.k === 'ordinary' ? ORDINARY_NAME[g.item.type] : g.count === 1 ? CHARGES[g.item.charge].name : CHARGES[g.item.charge].plural;
}

/**
 * The stripes' own direction, which an ordinary parallel to them can't be counterchanged across: it would only be one stripe
 * (SENA CC-2: a central ordinary may be counterchanged over barry, paly or bendy when it runs obliquely to the stripes).
 */
const ALONG_STRIPES: Partial<Record<Variation, readonly OrdinaryType[]>> = {
  barry: ['fess', 'cross'], paly: ['pale', 'cross'], bendy: ['bend', 'saltire'], 'bendy-sinister': ['bend-sinister', 'saltire'], chevronny: ['chevron', 'saltire'],
};


/**
 * Why a group can't be counterchanged over a variation, or null when it can (RULES CC-2, CC-3, CC-9): a central ordinary
 * may be over simple stripes when it runs across them, and a chief or bordure over pily; nothing else, and no charge.
 */
function counterchangeOverVariation(group: Group, variation: Variation, noun: string, lie: string, them: string): string | null {
  const field = VARIATION_NAME[variation];
  const whole = `The ${noun} ${lie} across a ${field} field, and`;
  if (group.item.k === 'charge') return `${whole} a charge can't be counterchanged over stripes or a grid — choose a tincture for ${them} (SENA CC-3).`;
  const kind = ORDINARY_KIND[group.item.type];
  if (variation === 'pily') return group.item.type === 'chief' || group.item.type === 'bordure' ? null : `${whole} only a chief or a bordure can be counterchanged over pily.`;
  const along = ALONG_STRIPES[variation];
  if (!along) return `${whole} nothing can be counterchanged over a grid of that kind (SENA CC-2).`;
  if (kind !== 'central') return `${whole} a ${noun} can't be counterchanged over stripes — only a band across the middle can (SENA CC-9).`;
  return along.includes(group.item.type) ? `${whole} it runs along the stripes, so counterchanged would only recolour one stripe (SENA CC-2).` : null;
}


/**
 * Why a counterchanged group can't be, or null when it can: only things lying across a divided field can take
 * its tinctures in reverse (SENA A3B2); one lying wholly in one part would simply be the other tincture.
 * Phrased so it can double as a blocked reason.
 */
export function counterchangeUnavailable(d: Design, path: GroupPath): string | null {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (group.paint.k !== 'counterchanged') return null;
  const thing = `${group.item.k === 'ordinary' ? 'the ' : ''}${nounOf(group)}`;
  const [lie, them] = group.item.k === 'charge' && group.count > 1 ? ['lie', 'them'] : ['lies', 'it'];
  if (host) {
    return `The ${nounOf(group)} ${lie} on the ${itemName(host.item)}, not on the field — counterchanged charges on a band or charge aren't available in this builder.`;
  }
  const pair = fieldPair(d);
  if (pair === null && d.kind === 'arms' && d.field.k === 'divided') {
    return `Counterchanged swaps the two tinctures of a field divided in two, and a fur on the field can't be swapped in this builder.`;
  }
  if (pair === null) {
    const each = group.item.k === 'ordinary' ? thing : 'each charge';
    return `Counterchanged needs a divided field: ${each} takes the field's other tincture, and a plain field has only one.`;
  }
  const varied = d.kind === 'arms' ? asVariation(d.field) : null;
  if (varied) return counterchangeOverVariation(group, varied.variation, nounOf(group), lie, them);
  const only = oneSection(d, path);
  if (only !== null) {
    const shown = TINCTURE_NAME[only === pair[0] ? pair[1] : pair[0]];
    return `The ${nounOf(group)} ${lie} wholly on the ${TINCTURE_NAME[only]} part of the field, so counterchanged would simply make ${them} ${shown} — choose ${shown} instead.`;
  }
  return null;
}

/**
 * Why a group with this paint fails on its ground, or null. A counterchanged group shows, over each part
 * of the field it lies on, the other part's tincture, so it fails exactly when the two share a class.
 */
function failureOf(paint: Paint, item: Item, ground: Ground, pair: readonly [Tincture, Tincture] | null, parts: readonly Ground[] | undefined, exception: SharedTinctureException): ContrastFailure | null {
  if (paint.k === 'counterchanged' && pair) return contrastFailure(pair[1], [pair[0]]);
  const failure = groundFailure(surfaceOf(paint, item), ground, exception);
  // A divided paint that fails as a whole still stands if each of its parts contrasts with the ground it alone lies on.
  const party = asParty(paint);
  if (failure && party && parts && parts.every((g, k) => g.length === 0 || groundFailure(tinctureSurface(party.parts[k].t), g) === null)) return null;
  return failure;
}

/** "(a two-colour field needs a metal charge)" when the background is two tinctures of one class. */
function twoClassHint(failure: ContrastFailure, contacts: readonly Tincture[], what: string): string {
  if (failure === 'same' || contacts.length !== 2 || TINCTURE_CLASS[contacts[0]] !== TINCTURE_CLASS[contacts[1]]) return '';
  return failure === 'colour-on-colour'
    ? ` (a two-colour field needs a metal ${what})`
    : ` (a two-metal field needs a colour ${what})`;
}

/**
 * Where a failing element lies, in words: "on Argent", "across Argent and Gules", "mostly on Argent"; on a counterchanged
 * host the tinctures are those of its parts ("on the Argent part of the pale").
 */
function whereText(f: ContrastFailure, top: Tincture | null, contacts: readonly Tincture[], host: Group | null): string {
  const names = contacts.map((t) => TINCTURE_NAME[t]);
  const parts = (ns: readonly string[]) => (host ? `the ${joinAnd(ns)} part${ns.length > 1 ? 's' : ''} of the ${itemName(host.item)}` : joinAnd(ns));
  if (contacts.length === 1) return `on ${parts(names)}`;
  const mixed = top !== null && f !== 'same' && contacts.some((t) => TINCTURE_CLASS[t] !== TINCTURE_CLASS[top]);
  if (!mixed) return `across ${parts(names)}`;
  return `mostly on ${parts(contacts.filter((t) => TINCTURE_CLASS[t] === TINCTURE_CLASS[top]).map((t) => TINCTURE_NAME[t]))}`;
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

/** A paint in a message: a tincture's or fur's name, 'Counterchanged', or a party as written ("Per pale Azure and Or"). */
export function paintName(p: Paint): string {
  const party = asParty(p);
  if (party) return `${capitalise(DIVISION_NAME[party.division])} ${party.parts.map((x) => TINCTURE_NAME[x.t]).join(' and ')}`;
  const varied = asVariation(p);
  if (varied) return `${capitalise(VARIATION_NAME[varied.variation])} ${varied.parts.map((x) => TINCTURE_NAME[x.t]).join(' and ')}`;
  if (p.k === 'fur') return capitalise(furName(p));
  const treated = asTreated(p);
  if (treated) return capitalise(treatedName(treated));
  return p.k === 'tincture' ? TINCTURE_NAME[p.t] : p.k === 'proper' ? 'Proper' : 'Counterchanged';
}

/** The issue of an ordinary that fails on `ground` of a field. */
function ordinaryMessage(d: Design, g: Group, f: ContrastFailure, ground: Ground, pair: readonly [Tincture, Tincture] | null): string {
  const T = paintName(g.paint), name = nounOf(g);
  if (g.paint.k === 'counterchanged' && pair) {
    return `${T} ${name} on ${TINCTURE_NAME[pair[0]]} and ${TINCTURE_NAME[pair[1]]}: ${FAILURE_TEXT[f]} (counterchanging needs a field of one metal and one colour)`;
  }
  const contacts = groundTinctures(ground);
  if (d.kind === 'arms' && d.field.k === 'tincture') return `${T} ${name} on ${TINCTURE_NAME[contacts[0]]} field: ${FAILURE_TEXT[f]}`;
  if (d.kind === 'arms' && (d.field.k === 'fur' || d.field.k === 'variation' || d.field.k === 'treated')) return `${T} ${name} on ${paintName(d.field)} field: ${FAILURE_TEXT[f]}`;
  if (f === 'same') {
    const shared = contacts.find((t) => surfaceOf(g.paint, g.item).bases.includes(t)) ?? contacts[0];
    const part = fieldParts(d).find((p) => paintTinctures(p).includes(shared));
    return `${T} ${name} lies on the ${part ? paintName(part) : TINCTURE_NAME[shared]} part of the field: same tincture`;
  }
  const top = g.paint.k === 'tincture' ? g.paint.t : null;
  if (contacts.length === 2 && twoClassHint(f, contacts, 'ordinary')) {
    return `${T} ${name} on ${TINCTURE_NAME[contacts[0]]} and ${TINCTURE_NAME[contacts[1]]} field: ${FAILURE_TEXT[f]}${twoClassHint(f, contacts, 'ordinary')}`;
  }
  return `${T} ${name} lies ${whereText(f, top, contacts, null)}: ${FAILURE_TEXT[f]}`;
}

/**
 * Whether a charge group fails only because it shares a tincture with one part of a divided field whose other part
 * it contrasts with: GoT Table 7 then forces it into that other part, which the builder draws only where it knows
 * the layout (`forcedLayout`). Elsewhere the design is a gap, not a violation.
 */
function forcedIntoOnePart(d: Design, path: GroupPath, failures: readonly (ContrastFailure | null)[], pair: readonly [Tincture, Tincture] | null): boolean {
  const g = groupAt(d, path);
  // Charges set in chief, in base or in canton, or around the primary charges, stand where the blazon puts them: a part they don't
  // contrast with is a violation (Table 7's forcing is for the primary), and so is a charge overall.
  if (g.item.k !== 'charge' || g.paint.k !== 'tincture' || !pair || hostOf(d, path) || g.relation === 'position' || g.role === 'overall' || forcedLayout(d, path) !== null) return false;
  const ctx = layoutContext(d, path);
  // Co-primary groups each go where they contrast, whichever is written first: a clash there is a violation, not a forced position.
  if (ctx.k === 'around' || (ctx.k === 'field' && ctx.share !== null)) return false;
  const i = pair.indexOf(g.paint.t);
  return i >= 0 && contrastFailure(g.paint.t, [pair[1 - i]]) === null && failures.some((f) => f !== null) && failures.every((f) => f === null || f === 'same');
}

/** The issues of a charge group, one per run of failing slots that share a ground and a failure. */
function chargeIssues(d: Design, path: GroupPath, g: Group, host: Group | null, grounds: readonly Ground[], pair: readonly [Tincture, Tincture] | null): Issue[] {
  const parts = partGrounds(d, path);
  if (g.item.k !== 'charge') return [];
  const { charge } = g.item;
  const at = { k: 'group', path } as const;
  const slots = canonicalSlots(d, path);
  const noun = nounOf(g), T = paintName(g.paint);
  const all = slots.map((_, i) => i);
  const failures = grounds.map((ground, i) => (ground.length === 0 ? null : failureOf(g.paint, g.item, ground, pair, parts?.[i], 'none')));
  const issue = (message: string, idx: number[]): Issue => ({ code: 'tincture', reason: 'contrast', at, message, slots: idx });

  if (g.paint.k === 'counterchanged' && pair) {
    // Every part shows the other field tincture over its own, so all the charges pass or fail together.
    const f = failures.find((x) => x !== null);
    if (!f) return [];
    const hint = f === 'same' ? '' : ' (counterchanging needs a field of one metal and one colour)';
    return [issue(`${T} ${noun} on ${TINCTURE_NAME[pair[0]]} and ${TINCTURE_NAME[pair[1]]}: ${FAILURE_TEXT[f]}${hint}`, all)];
  }
  if (host && host.paint.k !== 'counterchanged') {
    const f = failures.find((x) => x !== null);
    return f ? [issue(`${T} ${noun} on the ${paintName(host.paint)} ${itemName(host.item)}: ${FAILURE_TEXT[f]}`, all)] : [];
  }
  if (d.kind === 'arms' && (d.field.k === 'tincture' || d.field.k === 'fur' || d.field.k === 'variation' || d.field.k === 'treated')) {
    const f = failures.find((x) => x !== null);
    return f ? [issue(`${T} ${noun} on ${paintName(d.field)} field: ${FAILURE_TEXT[f]}`, all)] : [];
  }
  if (g.paint.k === 'tincture' && pair && forcedIntoOnePart(d, path, failures, pair)) {
    const other = TINCTURE_NAME[pair[pair.indexOf(g.paint.t) === 0 ? 1 : 0]];
    return [{
      code: 'unsupported', at, gap: { category: 'arrangement', detail: 'forced-into-one-part' },
      message: `${capitalise(describeSlots(slots, all, T, charge))} would have to sit only on the ${other} part of the field, which isn't available in this builder yet.`,
    }];
  }
  // Group failing slots that share the same ground and failure, in slot order.
  const top = g.paint.k === 'tincture' ? g.paint.t : null;
  const runs = new Map<string, { f: ContrastFailure; contacts: Tincture[]; idx: number[] }>();
  failures.forEach((f, i) => {
    if (!f) return;
    const contacts = groundTinctures(grounds[i]);
    const key = `${f}|${contacts.join(',')}`;
    const run = runs.get(key);
    if (run) run.idx.push(i);
    else runs.set(key, { f, contacts, idx: [i] });
  });
  return [...runs.values()].map(({ f, contacts, idx }) => {
    const hint = twoClassHint(f, contacts, 'charge');
    if (idx.length === slots.length && contacts.length === 2 && !host && (f === 'same' || hint)) {
      return issue(`${T} ${noun} on ${TINCTURE_NAME[contacts[0]]} and ${TINCTURE_NAME[contacts[1]]} field: ${FAILURE_TEXT[f]}${hint}`, idx);
    }
    const subject = describeSlots(slots, idx, g.paint.k === 'tincture' ? T : null, charge);
    return issue(`${capitalise(subject)} ${idx.length > 1 ? 'lie' : 'lies'} ${whereText(f, top, contacts, host)}: ${FAILURE_TEXT[f]}${hint}`, idx);
  });
}

/** The rule-of-tincture violations of the group at `path` alone (and a charge group Table 7 forces into one part, a gap). */
export function groupTinctureIssues(d: Design, path: GroupPath): Issue[] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const group = groupAt(d, path), host = hostOf(d, path);
  const at = { k: 'group', path } as const;
  const unavailable = counterchangeUnavailable(d, path);
  if (unavailable) {
    const slots = group.item.k === 'charge' ? slotsOf(d, path).map((_, i) => i) : [];
    return [{ code: 'tincture', reason: 'counterchange-unavailable', at, message: unavailable, slots }];
  }
  const pair = fieldPair(d);
  const grounds = groundShares(d, path);
  if (group.item.k === 'charge') return chargeIssues(d, path, group, host, grounds, pair);
  // Exactly one of the field and the band is in stripes or cells (A3B4b): not both.
  const exception = (d.field.k === 'variation') !== (group.paint.k === 'variation') ? 'ordinary-on-multiply-divided' : 'none';
  const f = grounds[0].length === 0 ? null : failureOf(group.paint, group.item, grounds[0], pair, partGrounds(d, path)?.[0], exception);
  return f ? [{ code: 'tincture', reason: 'contrast', at, message: ordinaryMessage(d, group, f, grounds[0], pair), slots: [] }] : [];
}

/** Every rule-of-tincture violation, group by group in canonical order. */
export function tinctureIssues(d: Design): Issue[] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  return walkGroups(d).flatMap(({ path }) => groupTinctureIssues(d, path));
}
