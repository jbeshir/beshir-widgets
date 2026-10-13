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
// The builder's "simple space" (PLAN §7.1) is one ordinary, one picture group (on the background or
// on the ordinary) and, when the picture is on the background, one extra picture group on the ordinary.
// `simpleParts` finds them in a design and `assembleParts` puts them back with the roles, relations and
// host layouts the model needs.

import { TINCTURES, TINCTURE_NAME, type Tincture } from './tinctures';
import { capitalise, joinList, numberWord } from './words';
import {
  contextOf, defaultLayoutOf, hostCounts, layoutCandidates, layoutContext, layoutKey, layoutOfKey, type LayoutKey,
} from './arrangement';
import { CHARGES, postureTerm, type ModifierId, type Posture } from './charges';
import {
  canonical, GROUP_TINCTURES, groupAt, groupTinctureOf, hostOf, paintOfGroupTincture, replaceGroup, walkGroups,
  type Arrangement, type Design, type Group, type GroupPath, type GroupTincture, type Issue,
} from './design';
import { ORDINARY_KIND, ORDINARY_NAME } from './ordinaries';
import { MAX_DRAWN_COUNT, unsupportedIssues } from './support';
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
export const blockReason = <T>(c: Choice<T>): string | null => (c.allowed ? null : c.reason);

const ok = <T>(value: T): Choice<T> => ({ value, allowed: true });
const choice = <T>(value: T, reason: string | null): Choice<T> => (reason ? { value, allowed: false, reason } : ok(value));

/** Every count the builder offers. */
export const COUNTS: readonly number[] = Array.from({ length: MAX_DRAWN_COUNT }, (_, i) => i + 1);

const PLACEMENTS: readonly Placement[] = ['field', 'ordinary'];

const samePath = (a: GroupPath, b: GroupPath) => a.length === b.length && a.every((x, i) => x === b[i]);

// ── The simple space ────────────────────────────────────────────────────────

interface Located { path: GroupPath; group: Group }

/** The groups of a design in the builder's terms; `placement` says where the picture sits. */
export interface SimpleParts {
  ordinary: Located | null;
  picture: (Located & { placement: Placement }) | null;
  extra: Located | null;
}

const isCentral = (g: Group) => g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central';
/** Whether pictures can sit on this ordinary: a central one or the chief. */
const hostsPictures = (g: Group) => g.item.k === 'ordinary' && (isCentral(g) || g.item.type === 'chief');

/**
 * Where the ordinary, the picture and the extra picture are. The picture is the top-level charge group
 * (primary, or secondary between the ordinary), else the charge group on the ordinary; the extra picture
 * is the charge group on the ordinary when the picture is a top-level group.
 */
export function simpleParts(d: Design): SimpleParts {
  const oi = d.groups.findIndex((g) => g.item.k === 'ordinary');
  const ordinary = oi < 0 ? null : { path: [oi], group: d.groups[oi] };
  const onOrdinary = (): Located | null => {
    const ti = ordinary ? ordinary.group.charged.findIndex((g) => g.item.k === 'charge') : -1;
    return ordinary && ti >= 0 ? { path: [oi, ti], group: ordinary.group.charged[ti] } : null;
  };
  const ci = d.groups.findIndex((g) => g.item.k === 'charge' && (g.role === 'primary' || g.role === 'secondary'));
  if (ci >= 0) return { ordinary, picture: { path: [ci], group: d.groups[ci], placement: 'field' }, extra: onOrdinary() };
  const tertiary = onOrdinary();
  return { ordinary, picture: tertiary && { ...tertiary, placement: 'ordinary' }, extra: null };
}

export interface PartsInput {
  ordinary: Group | null;
  picture: Group | null;
  placement: Placement;
  extra: Group | null;
}

const HOST: Arrangement = { k: 'host' };

/**
 * The canonical design with these groups put where the model wants them: the ordinary primary (or
 * peripheral), the picture on the background (secondary between a central ordinary, else primary) or
 * on the ordinary as its tertiary, the extra picture on the ordinary. A picture that can't sit on the
 * ordinary stays on the background; an extra picture needs the picture on the background and an
 * ordinary to sit on, or is dropped.
 */
export function assembleParts(d: Design, { ordinary, picture, placement, extra }: PartsInput): Design {
  const central = ordinary !== null && isCentral(ordinary);
  const hosts = ordinary !== null && hostsPictures(ordinary);
  const onOrdinary = picture !== null && placement === 'ordinary' && hosts;
  const tertiary = (g: Group): Group => ({ ...g, role: 'tertiary', relation: null, arrangement: HOST, position: null, charged: [] });
  const charged = onOrdinary ? [tertiary(picture)] : picture && extra && hosts ? [tertiary(extra)] : [];
  const groups: Group[] = ordinary ? [{ ...ordinary, role: central ? 'primary' : 'peripheral', relation: null, arrangement: { k: 'single' }, position: null, charged }] : [];
  if (picture && !onOrdinary) {
    const top: Group = { ...picture, role: central ? 'secondary' : 'primary', relation: central ? 'between' : null, charged: [] };
    if (central) groups.push({ ...top, arrangement: HOST, position: null });
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
  if (ctx.k === 'field') throw new RangeError('A group on the background has no host counts.');
  const legal = hostCounts(ctx);
  const name = ORDINARY_NAME[ctx.ordinary];
  const list = joinList(legal.map(countWord), 'or');
  if (ctx.k === 'between') {
    if (g.count === 1) return `A single charge can't be set between a ${name} — use ${list}, or place it on the ${name}.`;
    return `A ${name} is set between ${legal.length === 1 ? 'exactly ' : ''}${list} charges, not ${numberWord(g.count)}.`;
  }
  const extra = ctx.ordinary === 'cross' || ctx.ordinary === 'saltire' ? ' (one in the centre, or one on each arm and the centre)' : '';
  return `A ${name} can carry ${list}${extra}, not ${countWord(g.count)}.`;
}

/** Why the group at `path` can't be drawn as it is — unsupported, or breaking a structure rule — or null. */
function structureReason(d: Design, path: GroupPath): string | null {
  const gap = unsupportedIssues(d).find((i) => relevant(d, path, i));
  if (gap) return gap.gap.category === 'placement' && /^(between|on)-/.test(gap.gap.detail) ? hostCountReason(d, path) : gap.message;
  return structuralIssues(d).find((i) => i.code === 'structure' && relevant(d, path, i))?.message ?? null;
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
  return structureReason(d, path) ?? (withTinctures ? noTinctureReason(d, path) : null);
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
function withLayout(d: Design, path: GroupPath, key: LayoutKey): Design {
  const g = groupAt(d, path);
  const layout = layoutOfKey(key, g.count);
  return layout ? canonical(replaceGroup(d, path, { ...g, arrangement: layout.arrangement, position: layout.position })) : d;
}

/** Why the picture can't go on `placement`, or null. */
function placementReason(parts: SimpleParts, placement: Placement): string | null {
  if (placement === 'field') return null;
  const ordinary = parts.ordinary?.group;
  if (!ordinary) return 'Add a band or shape first — pictures can only sit on one once there is one.';
  if (!hostsPictures(ordinary)) return "Pictures can't sit on a border in this builder; put them on the background within it.";
  if (parts.extra) return 'The band already carries more pictures — remove them to move the main picture onto it.';
  return null;
}

/** Which of the picture and extra picture a path is, or null for any other group. */
function partOf(parts: SimpleParts, path: GroupPath): 'picture' | 'extra' | null {
  if (parts.picture && samePath(parts.picture.path, path)) return 'picture';
  return parts.extra && samePath(parts.extra.path, path) ? 'extra' : null;
}

/** The design with the picture (or extra picture) at `path` given a new count and/or placement, and where it is now; its layout is left for the caller. */
function edit(d: Design, path: GroupPath, change: { count?: number; placement?: Placement }): Edited | { reason: string } {
  const parts = simpleParts(d);
  const part = partOf(parts, path);
  if (!part || !parts.picture) throw new RangeError(`The group at ${path.join('.')} is not a picture.`);
  const placement = part === 'picture' ? change.placement ?? parts.picture.placement : parts.picture.placement;
  const reason = placement === parts.picture.placement ? null : placementReason(parts, placement);
  if (reason) return { reason };
  const group = { ...groupAt(d, path), count: change.count ?? groupAt(d, path).count };
  const design = assembleParts(d, {
    ordinary: parts.ordinary?.group ?? null,
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
  const [first] = designs();
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
  const placement = simpleParts(d).picture?.placement;
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

/** The placements to try for a group: the picture may move between them, an extra picture stays where it is. */
function placementsFor(parts: SimpleParts, path: GroupPath): Placement[] | null {
  const part = partOf(parts, path);
  if (!part || !parts.picture) return null;
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

/** single: one place to put it; host: placed by the ordinary (`note` says why there is nothing to choose); choose: pick from `choices`. */
export type LayoutChoices =
  | { mode: 'choose'; choices: Choice<LayoutKey>[] }
  | { mode: 'single' | 'host'; note: string };

export function layoutChoices(d: Design, path: GroupPath): LayoutChoices {
  const g = groupAt(d, path);
  const ctx = contextOf(d, g, hostOf(d, path));
  if (!ctx) return { mode: 'single', note: 'A single charge sits in the centre.' };
  if (ctx.k !== 'field') {
    const name = ORDINARY_NAME[ctx.ordinary];
    return { mode: 'host', note: ctx.k === 'on' ? `Charges on the ${name} follow its line.` : `Charges between a ${name} are placed around it.` };
  }
  const keys = layoutCandidates(d, path, g.count).map(layoutKey);
  if (keys.length === 1) return { mode: 'single', note: 'A single charge sits in the centre.' };
  return { mode: 'choose', choices: keys.map((key) => choice(key, layoutReason(withLayout(d, path, key), path, true))) };
}

/** The design with the group at `path` in the layout `key`, as the layout control would apply it. */
export function applyLayout(d: Design, path: GroupPath, key: LayoutKey): Design {
  return withLayout(d, path, key);
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
 * Make the picture (or extra picture) at `path` structurally legal after a lower-layer change: the
 * nearest count that has a layout, in the layout kept or Table 7's. Tinctures are left alone (a tincture
 * conflict is surfaced, not silently fixed). A design where none works is returned unchanged.
 */
export function fitGroup(d: Design, path: GroupPath): Design {
  const parts = simpleParts(d);
  const g = groupAt(d, path);
  const placement = parts.picture?.placement;
  if (g.item.k !== 'charge' || !placement || structureReason(d, path) === null) return d;
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
  const onto = host?.item.k === 'ordinary' ? ` on the ${ORDINARY_NAME[host.item.type]}` : '';
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
