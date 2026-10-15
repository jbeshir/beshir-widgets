// Option helper for the builder UI: which tinctures / counts / placements / layouts / postures are
// legal *given the rest of the design*, with a human reason for every blocked choice (the UI keeps
// blocked options visible and explains them on activation).
//
// Semantics: a choice is blocked only by the layers beneath it (field → ordinary → picture → extra
// pictures). Changing a lower layer is never blocked; if it invalidates an upper layer the design
// enters a violation state (validate() reports it) and suggestTinctureFix()/fitGroup() offer repairs.
// Count and placement depend on each other, so each is offered when some partner makes it legal,
// carrying the partner change it needs (its companion) and the design choosing it leads to.
//
// The builder's level-0 space is one ordinary, one picture group (on the background or on the ordinary)
// and, when the picture is on the background, one extra picture group on the ordinary; a chief and a
// bordure may stand beside them, each with a picture group of its own, and a picture group may stand in
// chief, in base or in canton beside the ordinary or the picture, or around the picture when it has no band. `simpleParts` finds them in a design (by place, places.ts) and
// `assembleParts` puts them back with the roles, relations and host layouts the model needs.

import { TINCTURES, TINCTURE_NAME, type Tincture } from './tinctures';
import { capitalise, joinList, numberWord } from './words';
import {
  AROUND_COUNTS, HOST_LAYOUT, ON_CHARGE_COUNTS, aroundWords, contextOf, defaultLayoutOf, hostCounts, layoutCandidates, layoutContext, layoutKey, layoutOfKey, isSecondaryPosition, positionLayout, positionLayouts, sameLayout, type LayoutKey,
} from './arrangement';
import { CHARGES, chargePhrase, postureTerm, type ModifierId, type Posture } from './charges';
import {
  canonical, GROUP_TINCTURES, groupAt, groupTinctureOf, hostOf, paintOfGroupTincture, replaceGroup, walkGroups,
  type Arrangement, type Design, type Group, type GroupPath, type GroupTincture, type Issue,
} from './design';
import { ORDINARY_KIND, ORDINARY_NAME } from './ordinaries';
import { MAX_DRAWN_COUNT, unsupportedIssues } from './support';
import { placesIn, type Placed } from './places';
import { PLACE_LABEL } from './plain-words';
import { hasRoom } from './layout';
import { structuralIssues } from './structure';
import { groupTinctureIssues, tinctureIssues } from './tincture-rule';

export type AllowedChoice<T> = { value: T; allowed: true };
export type BlockedChoice<T> = { value: T; allowed: false; reason: string };
export type Choice<T> = AllowedChoice<T> | BlockedChoice<T>;

export type Placement = 'field' | 'ordinary';

/** The partner a count or placement has to bring along: a new placement for a count, a new count for a placement. */
export type Companion =
  | { kind: 'placement'; placement: Placement }
  | { kind: 'count'; count: number };

/**
 * A count or placement choice. An allowed one carries the design choosing it leads to (the builder
 * applies exactly this) and its companion: null when the current partner works.
 */
export type LayoutChoice<T> = (AllowedChoice<T> & { design: Design; companion: Companion | null }) | BlockedChoice<T>;

export const isBlocked = <T>(c: Choice<T>): c is BlockedChoice<T> => !c.allowed;

const ok = <T>(value: T): Choice<T> => ({ value, allowed: true });

/** The first allowed value, or `fallback` when none is. */
export function firstAllowed<T, F>(choices: readonly Choice<T>[], fallback: F): T | F {
  return choices.find((c) => c.allowed)?.value ?? fallback;
}

export function isAllowed<T>(choices: readonly Choice<T>[], v: T): boolean {
  return choices.some((c) => c.value === v && c.allowed);
}

const choice = <T>(value: T, reason: string | null): Choice<T> => (reason ? { value, allowed: false, reason } : ok(value));

/** Every count the builder offers. */
export const COUNTS: readonly number[] = Array.from({ length: MAX_DRAWN_COUNT }, (_, i) => i + 1);

const PLACEMENTS: readonly Placement[] = ['field', 'ordinary'];

const samePath = (a: GroupPath, b: GroupPath) => a.length === b.length && a.every((x, i) => x === b[i]);

// ── The simple space ────────────────────────────────────────────────────────

/** The groups of a design in the builder's terms; `placement` says where the picture sits. */
export interface SimpleParts {
  ordinary: Placed | null;
  /** The chief and the bordure beside the ordinary, in that order. */
  peripherals: Placed[];
  /** The pictures on the chief and on the bordure beside the ordinary, in that order. */
  peripheralPictures: Placed[];
  picture: (Placed & { placement: Placement }) | null;
  extra: Placed | null;
  /** The pictures set in chief, in base or in canton beside the ordinary or the picture. */
  positioned: Placed | null;
  /** The pictures set around the picture on the background. */
  around: Placed | null;
  /** The pictures on each of the picture's charges (the picture on the background, not set between a band). */
  onPicture: Placed | null;
}

const isCentral = (g: Group) => g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central';

/**
 * Where the ordinary, the picture and the extra picture are. The picture is the top-level charge group
 * (primary, or secondary between the ordinary), else the charge group on the ordinary; the extra picture
 * is the charge group on the ordinary when the picture is a top-level group.
 */
export function simpleParts(d: Design): SimpleParts {
  const { placed } = placesIn(d);
  const at = (key: Placed['place']) => placed.find((p) => p.place === key) ?? null;
  const picture = at('picture'), onOrdinary = at('on-ordinary');
  return {
    positioned: at('in-chief') ?? at('in-base') ?? at('in-canton'),
    around: at('around'),
    onPicture: at('on-picture'),
    ordinary: at('ordinary'),
    peripherals: placed.filter((p) => p.place === 'chief' || p.place === 'bordure'),
    peripheralPictures: placed.filter((p) => p.place === 'on-chief' || p.place === 'on-bordure'),
    picture: picture ? { ...picture, placement: 'field' } : onOrdinary && { ...onOrdinary, placement: 'ordinary' },
    extra: picture ? onOrdinary : null,
  };
}

/** The groups the builder's level-0 controls edit, as `assembleParts` takes them back. */
export interface PartsInput {
  ordinary: Group | null;
  peripherals: readonly Group[];
  picture: Group | null;
  placement: Placement;
  extra: Group | null;
  positioned: Group | null;
  around: Group | null;
  onPicture: Group | null;
}

/** `simpleParts` without the places: the groups to change one of and assemble again. */
export function partsOf(d: Design): PartsInput {
  const parts = simpleParts(d);
  return {
    ordinary: parts.ordinary?.group ?? null,
    peripherals: parts.peripherals.map((p) => p.group),
    picture: parts.picture?.group ?? null,
    placement: parts.picture?.placement ?? 'field',
    extra: parts.extra?.group ?? null,
    positioned: parts.positioned?.group ?? null,
    around: parts.around?.group ?? null,
    onPicture: parts.onPicture?.group ?? null,
  };
}

/**
 * The canonical design with these groups put where the model wants them: the ordinary primary (or
 * peripheral), the picture on the background (secondary between a central ordinary, else primary) or
 * on the ordinary as its tertiary, the extra picture on the ordinary, the peripherals beside them with
 * the pictures on them. An extra picture needs the picture on the background and an ordinary to sit
 * on, or is dropped. With no ordinary, the first peripheral (the chief, else the bordure) stands in
 * its place and keeps the pictures it carried. The pictures in chief, in base or in canton stand beside a
 * central ordinary or the picture on the background; with neither they become the picture themselves
 * (SENA App I1), or are dropped where a picture can't stand (in canton). The pictures around the picture need it on
 * the background with no central ordinary, or are dropped. The pictures on the picture stand on it while it is the main picture.
 */
export function assembleParts(d: Design, { ordinary, peripherals, picture, placement, extra, positioned, around, onPicture }: PartsInput): Design {
  const hosts = ordinary !== null;
  const onOrdinary = picture !== null && placement === 'ordinary' && hosts;
  const standing = ordinary ?? peripherals[0] ?? null;
  const beside = ordinary ? peripherals : peripherals.slice(1);
  const central = standing !== null && isCentral(standing);
  const tertiary = (g: Group): Group => ({ ...g, role: 'tertiary', relation: null, arrangement: HOST_LAYOUT.arrangement, position: null, charged: [] });
  const charged = onOrdinary ? [tertiary(picture)] : picture && extra && hosts ? [tertiary(extra)] : ordinary === null && standing ? standing.charged.map(tertiary) : [];
  const peripheral = (g: Group): Group => ({ ...g, role: 'peripheral', relation: null, arrangement: { k: 'single' }, position: null, charged: g.charged.map(tertiary) });
  const groups: Group[] = [
    ...(standing ? [{ ...standing, role: central ? 'primary' as const : 'peripheral' as const, relation: null, arrangement: { k: 'single' } as const, position: null, charged }] : []),
    ...beside.map(peripheral),
  ];
  const fieldPicture = picture !== null && !onOrdinary;
  if (positioned) {
    const position = positioned.position;
    if (!isSecondaryPosition(position)) throw new RangeError('Pictures beside the main one stand in chief, in base or in canton.');
    const long = positioned.item.k === 'charge' && CHARGES[positioned.item.charge].long;
    // The layout it has where it still takes it there, else the row.
    const layout = positionLayouts(position, positioned.count, long).find((l) => sameLayout(l, { arrangement: positioned.arrangement, position })) ?? positionLayout(position, positioned.count);
    if (central || fieldPicture) groups.push({ ...positioned, role: 'secondary', relation: 'position', ...layout, charged: [] });
    else if (position !== 'canton') groups.push({ ...positioned, role: 'primary', relation: null, ...positionLayout(position, positioned.count), charged: [] });
  }
  if (around && picture && !onOrdinary && !central) {
    // The layout it has where it still takes it, else Table 7's for its count (two and one for three) or the first it can take.
    const secondary: Group = { ...around, role: 'secondary', relation: 'between', charged: [] };
    const placed = canonical({ ...d, groups: [...groups, { ...picture, role: 'primary', relation: null, charged: [] }, secondary] } as Design);
    const path = [placed.groups.findIndex((g) => g.role === 'secondary' && g.relation === 'between')];
    const kept = layoutCandidates(placed, path, around.count).find((l) => sameLayout(l, { arrangement: around.arrangement, position: around.position }));
    const layout = kept ?? defaultLayoutOf(placed, secondary, null);
    groups.push({ ...secondary, arrangement: layout.arrangement, position: layout.position });
  }
  if (picture && !onOrdinary) {
    // The pictures on the picture stay on it where it is the main picture; set around a band it carries none.
    const carried = onPicture && !central ? [{ ...onPicture, role: 'tertiary' as const, relation: null, position: null, charged: [] }] : [];
    const top: Group = { ...picture, role: central ? 'secondary' : 'primary', relation: central ? 'between' : null, charged: carried };
    if (central) groups.push({ ...top, arrangement: HOST_LAYOUT.arrangement, position: null });
    else if (picture.arrangement.k !== 'host') groups.push(top);
    else {
      // From around or on an ordinary to the background: the layout Table 7 gives it there.
      const placed = canonical({ ...d, groups: [...groups, top] } as Design);
      const layout = defaultLayoutOf(placed, top, null);
      groups.push({ ...top, arrangement: layout.arrangement, position: layout.position });
    }
  }
  return canonical({ ...d, groups } as Design);
}

/** The design with the group at `path` painted `t` (not canonicalised: a paint changes no order). */
export function withTincture(d: Design, path: GroupPath, t: GroupTincture): Design {
  return replaceGroup(d, path, { ...groupAt(d, path), paint: paintOfGroupTincture(t) });
}

// ── Reasons ─────────────────────────────────────────────────────────────────

/** Whether an issue is one this group's choices answer for: its own, the field's, an ordinary's — not another picture's. */
function relevant(d: Design, path: GroupPath, issue: Issue): boolean {
  if (issue.at.k !== 'group') return true;
  return samePath(issue.at.path, path) || groupAt(d, issue.at.path).item.k === 'ordinary';
}

const countWord = (n: number) => (n === 1 ? 'a single charge' : numberWord(n));

/** Why a count has no layout around or on the ordinary, phrased as a blocked reason. */
function hostCountReason(d: Design, path: GroupPath): string {
  const g = groupAt(d, path);
  const ctx = layoutContext(d, path);
  if (ctx.k === 'field' || ctx.k === 'position' || ctx.k === 'around') throw new RangeError('A group on the background has no host counts.');
  if (ctx.k === 'on-charge') return `Charges on a picture come in ${joinList(ON_CHARGE_COUNTS.map(countWord), 'or')}, not ${countWord(g.count)}.`;
  const legal = hostCounts(ctx.k, ctx.ordinary);
  const name = ORDINARY_NAME[ctx.ordinary];
  const list = joinList(legal.map(countWord), 'or');
  if (ctx.k === 'between') {
    if (g.count === 1) return `A single charge can't be set between a ${name} — use ${list}, or place it on the ${name}.`;
    return `A ${name} is set between ${legal.length === 1 ? 'exactly ' : ''}${list} charges, not ${numberWord(g.count)}.`;
  }
  const extra = ctx.ordinary === 'cross' || ctx.ordinary === 'saltire' ? ' (one in the centre, or one on each arm and the centre)' : '';
  return `A ${name} can carry ${list}${extra}, not ${countWord(g.count)}.`;
}

/** Why a count has no layout around the picture, or the picture can't have pictures around it, phrased as a blocked reason. */
function aroundReason(detail: string): string {
  if (detail.startsWith('around-primary-')) return 'Pictures can be set around one picture, or two side by side, one above the other or crossed — remove the pictures around it for more.';
  return `Pictures around the picture come in ${joinList(AROUND_COUNTS.map(numberWord), 'or')}, not ${countWord(Number(detail.slice('around-'.length)))}.`;
}

/** Why a layout is blocked; `capacity` when the charges would not fit at a size that reads. */
interface Block { reason: string; capacity: boolean }

/** Why the group at `path` can't be drawn as it is — unsupported, or breaking a structure rule — or null. */
function structureBlock(d: Design, path: GroupPath): Block | null {
  const gap = unsupportedIssues(d).find((i) => relevant(d, path, i));
  if (gap) {
    const placement = gap.gap.category === 'placement' ? gap.gap.detail : '';
    const reason = /^(between|on)-.*-\d+$/.test(placement) ? hostCountReason(d, path) : placement.startsWith('around-') ? aroundReason(placement) : gap.message;
    return { reason, capacity: false };
  }
  const issue = structuralIssues(d).find((i) => i.code === 'structure' && relevant(d, path, i));
  return issue ? { reason: issue.message, capacity: issue.code === 'structure' && issue.rule === 'capacity' } : null;
}

/** "the lion", "the three lions", "the fess". */
function groupNoun(g: Group): string {
  if (g.item.k === 'ordinary') return `the ${ORDINARY_NAME[g.item.type]}`;
  const meta = CHARGES[g.item.charge];
  return `the ${g.count === 1 ? meta.name : meta.plural}`;
}

/** The reason `t` can't paint the group at `path`: the first rule-of-tincture issue it would have there. */
function tinctureReason(d: Design, path: GroupPath, t: GroupTincture): string | null {
  return groupTinctureIssues(withTincture(d, path, t), path)[0]?.message ?? null;
}

/** On a divided field (or while counterchanged) "counterchanged" is offered too, after the tinctures. */
function offeredTinctures(d: Design, path: GroupPath): readonly GroupTincture[] {
  return (d.kind === 'arms' && d.field.k === 'divided') || groupAt(d, path).paint.k === 'counterchanged' ? GROUP_TINCTURES : TINCTURES;
}

/** Why a layout would leave every tincture blocked, or null when at least one works. */
function noTinctureReason(d: Design, path: GroupPath): string | null {
  let first: string | null = null;
  for (const t of offeredTinctures(d, path)) {
    const reason = tinctureReason(d, path, t);
    if (!reason) return null;
    first ??= reason;
  }
  return `No tincture would work for ${groupNoun(groupAt(d, path))} like this. ${first}`;
}

/** Why a layout of the group can't be chosen — structurally illegal, and with `withTinctures` also when no tincture would work — or null. */
export function layoutReason(d: Design, path: GroupPath, withTinctures: boolean): string | null {
  return layoutBlock(d, path, withTinctures)?.reason ?? null;
}

function layoutBlock(d: Design, path: GroupPath, withTinctures: boolean): Block | null {
  const structure = structureBlock(d, path);
  if (structure) return structure;
  const reason = withTinctures ? noTinctureReason(d, path) : null;
  return reason ? { reason, capacity: false } : null;
}

// ── Tinctures ───────────────────────────────────────────────────────────────

/** Field tinctures: only the other half of a divided field blocks (the parts need different tinctures). Plain fields: all allowed. */
export function fieldTinctureChoices(d: Design, part: 0 | 1 = 0): Choice<Tincture>[] {
  const other = d.kind === 'arms' && d.field.k === 'divided' ? d.field.parts[part === 0 ? 1 : 0] : null;
  const otherTincture = other?.k === 'tincture' ? other.t : null;
  return TINCTURES.map((t) => choice(t, t === otherTincture
    ? `The other part is already ${TINCTURE_NAME[t]} — a divided field needs two different tinctures.`
    : null));
}

/** Tinctures of the group at `path` against what it lies on; blocked reasons are the rule of tincture's own messages. */
export function groupTinctureChoices(d: Design, path: GroupPath): Choice<GroupTincture>[] {
  return offeredTinctures(d, path).map((t) => choice(t, tinctureReason(d, path, t)));
}

// ── Layout ──────────────────────────────────────────────────────────────────

interface Edited { design: Design; path: GroupPath }
type Fit = ({ fits: true; count: number; placement: Placement } & Edited) | { fits: false; reason: string };

const currentKey = (g: Group): LayoutKey => layoutKey({ arrangement: g.arrangement, position: g.position });

/** The design with the group at `path` in the layout `key` (its count already set). */
export function withLayout(d: Design, path: GroupPath, key: LayoutKey): Design {
  const g = groupAt(d, path);
  const layout = layoutOfKey(key, g.count);
  return layout ? canonical(replaceGroup(d, path, { ...g, arrangement: layout.arrangement, position: layout.position })) : d;
}

/** Why the picture can't go on `placement`, or null. */
function placementReason(parts: SimpleParts, placement: Placement): string | null {
  if (placement === 'field') return null;
  const ordinary = parts.ordinary?.group;
  if (!ordinary) return 'Add a band or shape first — pictures can only sit on one once there is one.';
  if (parts.extra) return 'The band already carries more pictures — remove them to move the main picture onto it.';
  // On a chief or bordure the picture would leave the pictures in chief, base or canton with nothing in the middle to stand beside.
  if (parts.positioned && !isCentral(ordinary)) return `The ${PLACE_LABEL[parts.positioned.place].plain.toLowerCase()} stand beside the picture — remove them to move the picture onto the band.`;
  if (parts.around) return 'Pictures stand around the picture — remove them to move the picture onto the band.';
  if (parts.onPicture) return 'The picture carries more pictures — remove them to move it onto the band.';
  return null;
}

/** Which of the picture, the extra picture, the pictures on a chief or bordure and the pictures in chief, base or canton a path is, or null for any other group. */
function partOf(parts: SimpleParts, path: GroupPath): 'picture' | 'extra' | 'peripheral' | 'positioned' | 'around' | 'onPicture' | null {
  if (parts.picture && samePath(parts.picture.path, path)) return 'picture';
  if (parts.extra && samePath(parts.extra.path, path)) return 'extra';
  if (parts.positioned && samePath(parts.positioned.path, path)) return 'positioned';
  if (parts.around && samePath(parts.around.path, path)) return 'around';
  if (parts.onPicture && samePath(parts.onPicture.path, path)) return 'onPicture';
  return parts.peripheralPictures.some((p) => samePath(p.path, path)) ? 'peripheral' : null;
}

/** The design with the pictures on a chief or bordure at `path` given a new count, and where they are now. */
function editPeripheralPictures(d: Design, path: GroupPath, count: number): Edited {
  const parts = simpleParts(d);
  const place = parts.peripheralPictures.find((p) => samePath(p.path, path))!.place;
  const peripherals = parts.peripherals.map(({ path: host, group }) => (
    host[0] === path[0] ? { ...group, charged: group.charged.map((t) => ({ ...t, count })) } : group
  ));
  const design = assembleParts(d, { ...partsOf(d), peripherals });
  return { design, path: simpleParts(design).peripheralPictures.find((p) => p.place === place)!.path };
}

/** The design with the picture (or extra picture) at `path` given a new count and/or placement, and where it is now; its layout is left for the caller. */
function edit(d: Design, path: GroupPath, change: { count?: number; placement?: Placement }): Edited | { reason: string } {
  const parts = simpleParts(d);
  const part = partOf(parts, path);
  if (part === 'peripheral') return editPeripheralPictures(d, path, change.count ?? groupAt(d, path).count);
  if (part === 'positioned') {
    const design = assembleParts(d, { ...partsOf(d), positioned: { ...groupAt(d, path), count: change.count ?? groupAt(d, path).count } });
    return { design, path: simpleParts(design).positioned!.path };
  }
  if (part === 'around') {
    const design = assembleParts(d, { ...partsOf(d), around: { ...groupAt(d, path), count: change.count ?? groupAt(d, path).count } });
    return { design, path: simpleParts(design).around!.path };
  }
  if (part === 'onPicture') {
    const design = assembleParts(d, { ...partsOf(d), onPicture: { ...groupAt(d, path), count: change.count ?? groupAt(d, path).count } });
    return { design, path: simpleParts(design).onPicture!.path };
  }
  if (!part || !parts.picture) throw new RangeError(`The group at ${path.join('.')} is not a picture.`);
  const placement = part === 'picture' ? change.placement ?? parts.picture.placement : parts.picture.placement;
  const reason = placement === parts.picture.placement ? null : placementReason(parts, placement);
  if (reason) return { reason };
  const group = { ...groupAt(d, path), count: change.count ?? groupAt(d, path).count };
  const design = assembleParts(d, {
    ...partsOf(d),
    picture: part === 'picture' ? group : parts.picture.group,
    placement,
    extra: part === 'extra' ? group : parts.extra?.group ?? null,
  });
  const moved = simpleParts(design);
  const at = part === 'picture' ? moved.picture : moved.extra;
  if (!at) throw new RangeError('The edited group went missing.');
  return { design, path: at.path };
}

/** The layout keys to try for `count` in the placed design: the current one first, then the candidates in the builder's order. */
function keysToTry(placed: Edited, count: number, keep: LayoutKey): LayoutKey[] {
  const keys = layoutCandidates(placed.design, placed.path, count).map(layoutKey);
  return keys.includes(keep) ? [keep, ...keys.filter((k) => k !== keep)] : keys;
}

/**
 * The group with this count and placement in the first layout that works: the current one if it is
 * legal here, else Table 7's default, else any other. With `withTinctures` a layout must also leave
 * some tincture legal.
 */
function fitLayout(d: Design, path: GroupPath, count: number, placement: Placement, withTinctures: boolean): Fit {
  const placed = edit(d, path, { count, placement });
  if ('reason' in placed) return { fits: false, reason: placed.reason };
  const designs = function* () {
    for (const key of keysToTry(placed, count, currentKey(groupAt(d, path)))) yield withLayout(placed.design, placed.path, key);
  };
  // Capacity failures dominate and need no message to be skipped, so only the first layout's reason is worded.
  for (const design of designs()) {
    if (hasRoom(design, placed.path) && layoutReason(design, placed.path, withTinctures) === null) return { fits: true, count, placement, design, path: placed.path };
  }
  // A count with no layout there at all (around the picture) is judged as it is placed.
  const [first = placed.design] = designs();
  return { fits: false, reason: layoutReason(first, placed.path, withTinctures) ?? 'No layout works.' };
}

/** Every count, nearest to `count` first; equally near ones lower first. */
function countsByNearness(count: number): number[] {
  return [...COUNTS].sort((a, b) => Math.abs(a - count) - Math.abs(b - count) || a - b);
}

/**
 * One count or placement choice: allowed with the first of `tries` (count and placement; the current
 * partner first) that fits, its companion naming the `partner` when that changed; blocked with the
 * current partner's reason when none fits.
 */
function layoutChoice<T>(d: Design, path: GroupPath, value: T, partner: Companion['kind'], tries: Array<[number, Placement]>): LayoutChoice<T> {
  const g = groupAt(d, path);
  const placement = simpleParts(d).picture?.placement ?? 'field';
  let first: Fit | null = null;
  let fit: Fit | null = null;
  for (const [count, p] of tries) {
    fit = fitLayout(d, path, count, p, true);
    first ??= fit;
    if (fit.fits) break;
  }
  if (!fit?.fits) return { value, allowed: false, reason: first!.fits ? 'No layout works.' : first!.reason };
  const companion: Companion | null = partner === 'placement'
    ? (fit.placement === placement ? null : { kind: 'placement', placement: fit.placement })
    : (fit.count === g.count ? null : { kind: 'count', count: fit.count });
  return { value, allowed: true, design: fit.design, companion };
}

/** The placements to try for a group: the picture may move between them, the other pictures stay where they are. */
function placementsFor(parts: SimpleParts, path: GroupPath): Placement[] | null {
  const part = partOf(parts, path);
  if (!part) return null;
  if (part === 'peripheral' || part === 'positioned' || part === 'around' || part === 'onPicture') return [parts.picture?.placement ?? 'field'];
  if (!parts.picture) return null;
  return part === 'extra' ? [parts.picture.placement] : [parts.picture.placement, ...PLACEMENTS.filter((p) => p !== parts.picture!.placement)];
}

/**
 * Counts: each with the current placement if that works, else with the other placement. Blocked only
 * when neither placement makes it legal (structurally, or with some tincture), with the reason for
 * the current placement.
 */
export function countChoices(d: Design, path: GroupPath): LayoutChoice<number>[] {
  const placements = placementsFor(simpleParts(d), path);
  if (!placements) return [];
  return COUNTS.map((n) => layoutChoice(d, path, n, 'placement', placements.map((p): [number, Placement] => [n, p])));
}

/**
 * Placements of the picture: each with the current count if that works, else with the nearest count
 * that does (ties to the lower count). Blocked only when no count makes it legal.
 */
export function placementChoices(d: Design, path: GroupPath): LayoutChoice<Placement>[] {
  const parts = simpleParts(d);
  if (!parts.picture || partOf(parts, path) !== 'picture') return [];
  const count = groupAt(d, path).count;
  return PLACEMENTS.map((p) => layoutChoice(d, path, p, 'count', countsByNearness(count).map((n): [number, Placement] => [n, p])));
}

/**
 * single: one place to put it; host: placed by the ordinary; fixed: the one layout it takes where it stands (in chief, base or
 * canton, or around the picture) (`note` says why there is nothing to choose); choose: pick from `choices`, with one `note`
 * for the blocked ones (null when none is).
 */
export type LayoutChoices =
  | { mode: 'choose'; choices: Choice<LayoutKey>[]; note: string | null }
  | { mode: 'single' | 'host' | 'fixed'; note: string };

export function layoutChoices(d: Design, path: GroupPath): LayoutChoices {
  const g = groupAt(d, path);
  const ctx = contextOf(d, g, hostOf(d, path));
  if (!ctx) return { mode: 'single', note: 'There is no layout to choose for this group.' };
  if (ctx.k === 'between' || ctx.k === 'on') {
    const name = ORDINARY_NAME[ctx.ordinary];
    return { mode: 'host', note: ctx.k === 'on' ? `Charges on the ${name} follow its line.` : `Charges between a ${name} are placed around it.` };
  }
  const keys = layoutCandidates(d, path, g.count).map(layoutKey);
  if (keys.length === 1) {
    if (ctx.k === 'position') return { mode: 'fixed', note: g.count === 1 ? `A single charge in ${ctx.position} stands alone there.` : `Charges in ${ctx.position} stand in a row across it.` };
    if (ctx.k === 'around') return { mode: 'fixed', note: `${capitalise(numberWord(g.count))} charges around the picture stand ${aroundWords(g.count, layoutOfKey(keys[0], g.count)!)}.` };
    return { mode: 'single', note: 'A single charge sits in the centre.' };
  }
  const blocks = keys.map((key) => layoutBlock(withLayout(d, path, key), path, true));
  return { mode: 'choose', choices: keys.map((key, i) => choice(key, blocks[i]?.reason ?? null)), note: blockedNote(g, blocks) };
}

/** One line for the blocked layouts: that none has room for the charges, else each distinct reason. */
function blockedNote(g: Group, blocks: readonly (Block | null)[]): string | null {
  const blocked = blocks.filter((b): b is Block => b !== null);
  if (blocked.length === 0) return null;
  if (g.item.k === 'charge' && blocked.every((b) => b.capacity)) return `Greyed-out layouts have no room for ${chargePhrase(g.item.charge, g.count)}.`;
  return [...new Set(blocked.map((b) => b.reason))].join(' ');
}

// ── Postures and modifiers ──────────────────────────────────────────────────

const QUADRUPED_POSTURES: readonly Posture[] = ['rampant', 'passant', 'statant', 'sejant'];

/**
 * Postures for the group's charge. Four-legged charges list the four quadruped postures (and any other
 * they are drawn in, like the hare's courant), with the ones this charge isn't drawn in blocked;
 * other posture-bearing charges list their own; posture-less charges return [].
 */
export function postureChoices(d: Design, path: GroupPath): Choice<Posture>[] {
  const item = groupAt(d, path).item;
  if (item.k !== 'charge') return [];
  const meta = CHARGES[item.charge];
  const drawn = meta.postures;
  if (!drawn) return [];
  const list = drawn.some((p) => QUADRUPED_POSTURES.includes(p)) ? [...QUADRUPED_POSTURES, ...drawn.filter((p) => !QUADRUPED_POSTURES.includes(p))] : drawn;
  const names = drawn.map((p) => postureTerm(item.charge, p));
  return list.map((p) => choice(p, drawn.includes(p) ? null : `The ${meta.name} is only drawn ${joinList(names, 'or')} in this builder.`));
}

/** The modifiers the group's charge is drawn with (the sun's "in splendour"); each can be switched on or off. */
export function modifierChoices(d: Design, path: GroupPath): Choice<ModifierId>[] {
  const item = groupAt(d, path).item;
  return item.k === 'charge' ? CHARGES[item.charge].mods.map(ok) : [];
}

// ── Repairs ─────────────────────────────────────────────────────────────────

/**
 * Make the picture (or extra picture, or the pictures on a chief or bordure) at `path` structurally legal after a lower-layer change: the
 * nearest count that has a layout, in the layout kept or Table 7's. Tinctures are left alone (a tincture
 * conflict is surfaced, not silently fixed). A design where none works is returned unchanged.
 */
export function fitGroup(d: Design, path: GroupPath): Design {
  const parts = simpleParts(d);
  const g = groupAt(d, path);
  const placement = parts.picture?.placement ?? 'field';
  if (g.item.k !== 'charge' || structureBlock(d, path) === null) return d;
  for (const n of countsByNearness(g.count)) {
    const fit = fitLayout(d, path, n, placement, false);
    if (fit.fits) return fit.design;
  }
  return d;
}

/**
 * A one-click repair for rule-of-tincture issues: a new tincture for one group (every alternative
 * listed, the suggestion first), or — when no single group can clear them — new tinctures for the
 * ordinary and the pictures on it or around it together.
 */
export type TinctureFix =
  | { layer: 'group'; path: GroupPath; tincture: GroupTincture; alternatives: GroupTincture[]; label: string; design: Design }
  | { layer: 'several'; changes: Array<{ path: GroupPath; tincture: GroupTincture }>; label: string; design: Design };

/** "Switch the lions to Gules" / "Counterchange the mullets" / "Switch the roses on the chief to Or". */
function fixWords(d: Design, path: GroupPath, t: GroupTincture): string {
  const g = groupAt(d, path), host = hostOf(d, path);
  const onto = host?.item.k === 'ordinary' ? ` on the ${ORDINARY_NAME[host.item.type]}` : host?.item.k === 'charge' ? ` on the ${CHARGES[host.item.charge].name}` : '';
  const what = `${groupNoun(g)}${onto}`;
  return t === 'counterchanged' ? `counterchange ${what}` : `switch ${what} to ${TINCTURE_NAME[t]}`;
}

/**
 * A tincture change that clears every rule-of-tincture issue, or null when there are none. Tries a
 * single group first — the pictures with an issue before the ordinary, then the others, and a plain
 * tincture before counterchanged — then the ordinary and the pictures together, which finds a way out
 * for every design the builder offers, so a design never sits in a violation with no fix.
 */
export function suggestTinctureFix(d: Design): TinctureFix | null {
  const issues = tinctureIssues(d);
  if (!issues.length) return null;
  const clears = (x: Design) => tinctureIssues(x).length === 0;
  const walked = walkGroups(d);
  const broken = (path: GroupPath) => issues.some((i) => i.at.k === 'group' && samePath(i.at.path, path));
  const rank = ({ path, group }: { path: GroupPath; group: Group }) =>
    (broken(path) ? 0 : 2) + (group.item.k === 'charge' ? 0 : 1);
  const order = [...walked].sort((a, b) => rank(a) - rank(b));

  for (const { path } of order) {
    const alternatives = offeredTinctures(d, path).filter((t) => t !== groupTinctureOf(groupAt(d, path).paint) && clears(withTincture(d, path, t)));
    if (alternatives.length) {
      const tincture = alternatives[0];
      return { layer: 'group', path, tincture, alternatives, label: capitalise(fixWords(d, path, tincture)), design: withTincture(d, path, tincture) };
    }
  }
  const ordinary = walked.find(({ group }) => group.item.k === 'ordinary');
  if (!ordinary) return null;
  for (const ot of TINCTURES) {
    let design = withTincture(d, ordinary.path, ot);
    const changes = [{ path: ordinary.path, tincture: ot as GroupTincture }];
    for (const { path } of walked) {
      if (path === ordinary.path || groupTinctureIssues(design, path).length === 0) continue;
      const t = offeredTinctures(design, path).find((x) => groupTinctureIssues(withTincture(design, path, x), path).length === 0);
      if (!t) break;
      design = withTincture(design, path, t);
      changes.push({ path, tincture: t });
    }
    if (clears(design)) {
      return { layer: 'several', changes, design, label: capitalise(changes.map((c) => fixWords(d, c.path, c.tincture)).join(' and ')) };
    }
  }
  return null;
}
