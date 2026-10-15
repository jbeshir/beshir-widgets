// Layouts (an arrangement plus an optional position), their keys, and GoT Table 7: which layout a
// group has when the blazon doesn't say, which layouts a group can take, and when SENA forces one.

import { numberWord, joinAnd } from './words';
import {
  groupAt, hostOf, itemKey, notSupported, type Arrangement, type Design, type Group, type GroupPath, type LineDir, type Pattern, type Position, POSITIONS,
} from './design';
import { CHARGES, type ChargeId, type Posture } from './charges';
import { ORDINARY_KIND, type OrdinaryType } from './ordinaries';
import type { Tincture } from './tinctures';
import { contrastFailure } from './contrast';
import type { Division } from './divisions';

export interface Layout { arrangement: Arrangement; position: Position | null }

/** 'single' | 'in-pale' | 'in-fess' | 'in-bend' | 'in-bend-sinister' | `rows-${string}` | 'in-cross' | 'in-saltire' | 'in-orle' | 'in-annulo' | 'crossed' | 'host' | 'in-chief' | 'in-base' | … */
export type LayoutKey = string;

/** Rows that read as a pattern; the first per count is the preferred one. */
export const ROW_PATTERNS: readonly (readonly number[])[] = [
  [2, 1], [2, 2], [2, 2, 1], [3, 2, 1], [3, 3, 1], [3, 3, 2], [3, 3, 3], [4, 3, 2, 1], [4, 4, 3], [4, 4, 4],
  [1, 2], [3, 2], [2, 2, 2], [3, 3], [4, 4], [4, 3, 2]];

const LINE_DIRS: readonly LineDir[] = ['pale', 'fess', 'bend', 'bend-sinister'];
const PATTERNS: readonly Pattern[] = ['cross', 'saltire', 'orle', 'annulo', 'chevron', 'chevron-inverted', 'pall', 'pile'];
const PAIRS = ['combattant', 'respectant', 'addorsed'] as const;

const single = (position: Position | null = null): Layout => ({ arrangement: { k: 'single' }, position });
const line = (dir: LineDir, position: Position | null = null): Layout => ({ arrangement: { k: 'line', dir }, position });
const rows = (r: readonly number[]): Layout => ({ arrangement: { k: 'rows', rows: [...r] }, position: null });
const pattern = (p: Pattern): Layout => ({ arrangement: { k: 'pattern', pattern: p }, position: null });
/** The layout of a group an ordinary places: the one `host` arrangement, no position. */
export const HOST_LAYOUT: Layout = { arrangement: { k: 'host' }, position: null };
/** The default layout of a secondary group set by position: a single charge there, or a row of them across it. */
export const positionLayout = (position: SecondaryPosition, count: number): Layout => (count === 1 ? single(position) : line('fess', position));

/**
 * The layouts of a secondary group set by position, the default first: in chief or in base also the counts' row
 * patterns ("in chief five mullets three and two"), and two long charges crossed ("in base two swords in saltire").
 */
export function positionLayouts(position: SecondaryPosition, count: number, long: boolean): Layout[] {
  const patterns = position === 'canton' ? [] : ROW_PATTERNS.filter((r) => r.reduce((a, b) => a + b, 0) === count);
  return [
    positionLayout(position, count),
    ...patterns.map((r): Layout => ({ arrangement: { k: 'rows', rows: [...r] }, position })),
    ...(count === 2 && long ? [{ arrangement: { k: 'crossed' }, position } satisfies Layout] : []),
  ];
}

export function sameLayout(a: Layout, b: Layout): boolean {
  return layoutKey(a) === layoutKey(b);
}

/** "in chief" is a single charge or a line fess in the chief; every other position is suffixed. */
export function layoutKey(l: Layout): LayoutKey {
  const a = l.arrangement, p = l.position;
  if ((p === 'chief' || p === 'base') && (a.k === 'single' || (a.k === 'line' && a.dir === 'fess'))) return `in-${p}`;
  let base: string;
  switch (a.k) {
    case 'single': case 'host': case 'crossed': base = a.k; break;
    case 'line': base = `in-${a.dir}`; break;
    case 'rows': base = `rows-${a.rows.join('-')}`; break;
    case 'pattern': base = `in-${a.pattern}`; break;
    case 'pair': base = `pair-${a.pair}`; break;
  }
  return p ? `${base}@${p}` : base;
}

function parseArrangement(key: string, count: number): Arrangement | null {
  if (key === 'single' || key === 'host' || key === 'crossed') return { k: key };
  const lineDir = LINE_DIRS.find((d) => key === `in-${d}`);
  if (lineDir) return { k: 'line', dir: lineDir };
  const pat = PATTERNS.find((p) => key === `in-${p}`);
  if (pat) return { k: 'pattern', pattern: pat };
  const pair = PAIRS.find((p) => key === `pair-${p}`);
  if (pair) return { k: 'pair', pair };
  const m = /^rows-(\d+(?:-\d+)*)$/.exec(key);
  if (m) {
    const r = m[1].split('-').map(Number);
    return r.every((n) => n >= 1) ? { k: 'rows', rows: r } : null;
  }
  return key === 'in-chief' || key === 'in-base' ? (count === 1 ? { k: 'single' } : { k: 'line', dir: 'fess' }) : null;
}

/** The layout a key names for a group of `count`, or null for an unknown key. Rows are not checked against the count. */
export function layoutOfKey(key: LayoutKey, count: number): Layout | null {
  const [base, suffix, ...rest] = key.split('@');
  if (rest.length > 0) return null;
  const arrangement = parseArrangement(base, count);
  if (!arrangement) return null;
  const implied: Position | null = base === 'in-chief' ? 'chief' : base === 'in-base' ? 'base' : null;
  if (suffix === undefined) return { arrangement, position: implied };
  const position = POSITIONS.find((p) => p === suffix);
  return position && !implied ? { arrangement, position } : null;
}

/** Plain heraldic words for a layout, as the blazon and the messages say it ("in pale", "two and one"). */
export function layoutWords(l: Layout): string {
  const a = l.arrangement;
  const where = l.position ? `in ${l.position.replace('-', ' ')}` : null;
  const at = (words: string) => (where ? `${where} ${words}` : words);
  switch (a.k) {
    case 'single': return where ?? 'single';
    case 'line': return where ? (isHalfPosition(l.position) ? at(`in ${a.dir}`) : where) : `in ${a.dir.replace('-', ' ')}`;
    case 'rows': return at(joinAnd(a.rows.map(numberWord)));
    case 'pattern': return at(`in ${a.pattern.replace('-', ' ')}`);
    case 'host': return 'placed by the ordinary';
    case 'crossed': return at('in saltire');
    case 'pair': return a.pair;
  }
}

// ── Where a group sits ──────────────────────────────────────────────────────

/** Which peripheral ordinaries a design has, as far as the charges set on its field are concerned. */
export type Peripheral = 'none' | 'chief' | 'bordure' | 'chief-bordure';
/** The room a primary leaves for a secondary: the top, the bottom, a corner, or all around. */
export type Yield = 'none' | 'chief' | 'base' | 'canton' | 'around';
/** A co-primary group's slice of the slots the total count of primary charges is laid out in. */
export interface Share { index: number; counts: readonly number[] }

/** Where a secondary group set by position stands beside the primary (SENA App I1): along the top, along the bottom, or in the top corner. */
export type SecondaryPosition = Extract<Position, 'chief' | 'base' | 'canton'>;
export const SECONDARY_POSITIONS: readonly SecondaryPosition[] = ['chief', 'base', 'canton'];
export const isSecondaryPosition = (p: Position | null): p is SecondaryPosition => p === 'chief' || p === 'base' || p === 'canton';

/** Where a primary charge group stands in a part of the field: a half (in dexter), or a quarter (in dexter chief; also the corner a field cut per bend leaves). */
export const HALF_POSITIONS = ['dexter', 'sinister', 'dexter-chief', 'sinister-chief', 'dexter-base', 'sinister-base'] as const;
export type HalfPosition = (typeof HALF_POSITIONS)[number];
export const isHalfPosition = (p: Position | null): p is HalfPosition => (HALF_POSITIONS as readonly (Position | null)[]).includes(p);

/** The layouts of a primary charge group of `count` in a half or quarter: one charge alone, two in pale or in fess, three or four in rows; more don't fit. */
const MAX_IN_HALF = 4;
export function halfLayouts(position: HalfPosition, count: number): Layout[] {
  if (count === 1) return [single(position)];
  if (count === 2) {
    const dirs: LineDir[] = position === 'dexter' || position === 'sinister' ? ['pale', 'fess'] : ['fess', 'pale'];
    return dirs.map((dir) => line(dir, position));
  }
  return count > MAX_IN_HALF ? [] : ROW_PATTERNS.filter((r) => r.reduce((a, b) => a + b, 0) === count).map((r): Layout => ({ ...rows(r), position }));
}

/**
 * Where charges that have no contrast with one part of a divided field stand, by the part they lie in (GoT Table 7: they are
 * forced into the part they contrast with): the first part's place, the second's. Per quarterly, the first quarter of each part.
 */
const PART_POSITIONS: Partial<Record<Division, readonly [Position, Position]>> = {
  'per-fess': ['chief', 'base'], 'per-chevron': ['chief', 'base'], 'per-pale': ['dexter', 'sinister'],
  'per-bend': ['sinister-chief', 'dexter-base'], 'per-bend-sinister': ['dexter-chief', 'sinister-base'], quarterly: ['dexter-chief', 'sinister-chief'],
};

/** The layout of `count` charges forced into a part of the field, or null for a count the builder doesn't lay out there. */
function forcedLayoutIn(position: Position, count: number, quarterly: boolean): Layout | null {
  if (position === 'chief' || position === 'base') return count === 1 ? single(position) : line('fess', position);
  // Two on a field in four go one in each of the other parts (Table 7's four-part row), not both into one quarter.
  if (!isHalfPosition(position) || (quarterly && count > 1)) return null;
  return count <= 3 ? halfLayouts(position, count)[0] : null;
}

/** The contexts whose charges are laid out in the shield's frame by the generic engine: not charges on the primary charges, which are laid out in those, nor charges overall, which stand as a lone primary does. */
export type GroundContext = Exclude<LayoutContext, { k: 'on-charge' | 'overall' }>;

/** The context of a primary charge group. */
export interface FieldContext { k: 'field'; peripheral: Peripheral; yields: Yield; share: Share | null }

/** The primary charges a group of charges is on, as they are drawn: what `contextSlots` needs to find each of them and the room its drawing offers. */
export interface HostCharges { charge: ChargeId; posture: Posture | null; count: number; layout: Layout; context: FieldContext }

export type LayoutContext =
  | FieldContext                                                                 // primary charge group
  | { k: 'between'; ordinary: OrdinaryType; peripheral: Peripheral }             // secondary 'between'
  | { k: 'around'; peripheral: Peripheral; primary: { count: number; layout: Layout } } // secondary 'between', around the primary charges
  | { k: 'position'; position: SecondaryPosition; ordinary: OrdinaryType | null; peripheral: Peripheral } // secondary 'position', beside the primary ordinary (or charges)
  | { k: 'on'; ordinary: OrdinaryType; peripheral: Peripheral }                  // tertiary on an ordinary (incl. chief)
  | { k: 'on-charge'; host: HostCharges }                                        // tertiary on each of the primary charges
  | { k: 'overall'; peripheral: Peripheral };                                    // overall: one charge, or two crossed, across the middle of the free field

/** The context of a lone primary charge group: nothing yielded, no co-primary. */
export const fieldContext = (peripheral: Peripheral): FieldContext => ({ k: 'field', peripheral, yields: 'none', share: null });

export const hasChief = (p: Peripheral): boolean => p === 'chief' || p === 'chief-bordure';
export const hasBordure = (p: Peripheral): boolean => p === 'bordure' || p === 'chief-bordure';

/** The chief and bordure a design has beside `except` (the host a charge group sits on is not its own peripheral). */
function peripheralOf(d: Design, except: Group | null = null): Peripheral {
  const has = (type: OrdinaryType) => d.groups.some((g) => g !== except && g.role === 'peripheral' && g.item.k === 'ordinary' && g.item.type === type);
  const chief = has('chief'), bordure = has('bordure');
  return chief && bordure ? 'chief-bordure' : chief ? 'chief' : bordure ? 'bordure' : 'none';
}

/** The central ordinary of the primary group, if any: what a secondary group is set between. */
export function primaryOrdinary(d: Design): OrdinaryType | null {
  const g = d.groups.find((x) => x.role === 'primary');
  return g && g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central' ? g.item.type : null;
}

/** The position of the design's one secondary group set by position, if it has one: the room the primary charges leave for it. */
function positionedSecondary(d: Design): SecondaryPosition | null {
  const g = d.groups.find((x) => x.role === 'secondary' && x.relation === 'position');
  return g && g.item.k === 'charge' && isSecondaryPosition(g.position) ? g.position : null;
}

/** The design's primary group when it is one group of charges (no central ordinary, no co-primary): what charges set between it surround. */
export function primaryCharges(d: Design): Group | null {
  const primaries = d.groups.filter((g) => g.role === 'primary');
  return primaries.length === 1 && primaries[0].item.k === 'charge' ? primaries[0] : null;
}

/** The most charges two co-primary groups have between them: three, or the layouts for more would have to be told apart by their types. */
export const MAX_CO_PRIMARY_TOTAL = 3;

/** The design's two primary groups when both are groups of charges ("a lion and a rose"): together they are the primary group, laid out as one. */
export function coPrimaries(d: Design): [Group, Group] | null {
  const primaries = d.groups.filter((g) => g.role === 'primary');
  return primaries.length === 2 && primaries.every((g) => g.item.k === 'charge') ? [primaries[0], primaries[1]] : null;
}

/** The slice of the total a primary charge group takes when it is one of two co-primary groups, else null. Groups are told apart by their charge: one charge never stands in two groups on the field (SENA A3D1a). */
function shareOf(d: Design, group: Group): Share | null {
  const pair = coPrimaries(d);
  if (!pair || group.role !== 'primary') return null;
  const index = pair[0] === group ? 0 : pair[1] === group ? 1 : pair.findIndex((g) => itemKey(g.item) === itemKey(group.item));
  return index < 0 ? null : { index, counts: [pair[0].count, pair[1].count] };
}

/** How many charges the co-primary groups of a context have in all, or the group's own count when it has no co-primary. */
export const shareTotal = (share: Share | null, own: number): number => (share ? share.counts.reduce((a, b) => a + b, 0) : own);

/** The same context with this group's count changed (a co-primary group's count changes the total the groups are laid out in). */
export function withOwnCount(ctx: LayoutContext, count: number): LayoutContext {
  if (ctx.k !== 'field' || !ctx.share) return ctx;
  return { ...ctx, share: { index: ctx.share.index, counts: ctx.share.counts.map((n, i) => (i === ctx.share!.index ? count : n)) } };
}

/** Whether charges are set around the primary charges ("a lion between three mullets"): the room the primary leaves them all round. */
function aroundSecondary(d: Design): boolean {
  return primaryCharges(d) !== null && d.groups.some((g) => g.role === 'secondary' && g.relation === 'between' && g.item.k === 'charge');
}

/** Where a charge group sits, or null for a group this builder has no layout for (ordinaries, overall, charges on charges, …). */
export function contextOf(d: Design, group: Group, host: Group | null): LayoutContext | null {
  if (group.item.k !== 'charge') return null;
  if (host) {
    if (group.role !== 'tertiary') return null;
    if (host.item.k === 'charge') {
      // Only the primary charges carry charges: the charges of other groups are too small, and a tertiary carries none.
      const context = host.role === 'primary' ? contextOf(d, host, null) : null;
      if (context?.k !== 'field') return null;
      return { k: 'on-charge', host: { charge: host.item.charge, posture: host.item.posture, count: host.count, layout: { arrangement: host.arrangement, position: host.position }, context } };
    }
    // The bordure runs round the whole edge, under no chief of its own: what lies beside it doesn't change where its charges go.
    return { k: 'on', ordinary: host.item.type, peripheral: host.item.type === 'bordure' ? 'none' : peripheralOf(d, host) };
  }
  if (group.role === 'overall') return d.groups.some((g) => g.role === 'primary') ? { k: 'overall', peripheral: peripheralOf(d) } : null;
  if (group.role === 'primary') return { ...fieldContext(peripheralOf(d)), yields: positionedSecondary(d) ?? (aroundSecondary(d) ? 'around' : 'none'), share: shareOf(d, group) };
  if (group.role === 'secondary' && group.relation === 'position') {
    return isSecondaryPosition(group.position) && d.groups.some((g) => g.role === 'primary')
      ? { k: 'position', position: group.position, ordinary: primaryOrdinary(d), peripheral: peripheralOf(d) }
      : null;
  }
  if (group.role === 'secondary' && group.relation === 'between') {
    const ordinary = primaryOrdinary(d);
    if (ordinary) return { k: 'between', ordinary, peripheral: peripheralOf(d) };
    const primary = primaryCharges(d);
    return primary && { k: 'around', peripheral: peripheralOf(d), primary: { count: primary.count, layout: { arrangement: primary.arrangement, position: primary.position } } };
  }
  return null;
}

export function layoutContext(d: Design, path: GroupPath): LayoutContext {
  const group = groupAt(d, path);
  return contextOf(d, group, hostOf(d, path)) ?? notSupported({ category: 'placement', detail: `${group.role}-${group.item.k}` });
}

/**
 * Table 7's secondary rows, the one place they are written: for each ordinary and count of charges set between it,
 * how many go on each side (`split`, null where the drawing places them by its own rule) and how that is said.
 */
export const BETWEEN: Partial<Record<OrdinaryType, Record<number, { split: [number, number] | null; words: string }>>> = {
  fess: {
    2: { split: [1, 1], words: 'one above and one below' }, 3: { split: [2, 1], words: 'two above and one below' },
    4: { split: [2, 2], words: 'two above and two below' }, 6: { split: [3, 3], words: 'three above and three below' },
  },
  pale: {
    2: { split: [1, 1], words: 'one on each side' }, 4: { split: [2, 2], words: 'two on each side' }, 6: { split: [3, 3], words: 'three on each side' },
  },
  bend: {
    2: { split: [1, 1], words: 'one above and one below' }, 4: { split: [2, 2], words: 'two on each side' }, 6: { split: [3, 3], words: 'three on each side' },
  },
  'bend-sinister': {
    2: { split: [1, 1], words: 'one above and one below' }, 4: { split: [2, 2], words: 'two on each side' }, 6: { split: [3, 3], words: 'three on each side' },
  },
  chevron: {
    2: { split: [1, 1], words: 'one above and one below' }, 3: { split: [2, 1], words: 'two above and one below' }, 6: { split: [3, 3], words: 'three above and three below' },
  },
  cross: { 4: { split: null, words: 'one in each quarter' } },
  saltire: { 4: { split: null, words: 'one above, one below and one on each side' } },
  pile: { 2: { split: null, words: 'one on each side' } },
};

/** How charges set between `ordinary` are spread out, or null for a count it has no spread for. */
export function betweenWords(ordinary: OrdinaryType, count: number): string | null {
  return BETWEEN[ordinary]?.[count]?.words ?? null;
}

/**
 * Table 7's row "Around any other charge(s)", the one place it is written: the layouts charges set around a primary
 * charge group take, by count, and how each is said in plain words. Three stand two and one unless the blazon says
 * otherwise; every other count must be stated (two in fess, in pale or in bend; four in saltire, in cross or two and two;
 * five to eight in orle or in annulo).
 */
const AROUND: Readonly<Record<number, ReadonlyArray<{ layout: Layout; words: string }>>> = {
  2: [
    { layout: line('fess'), words: 'one on each side' }, { layout: line('pale'), words: 'one above and one below' },
    { layout: line('bend'), words: 'one top left and one bottom right' }, { layout: line('bend-sinister'), words: 'one top right and one bottom left' },
  ],
  3: [{ layout: rows([2, 1]), words: 'two above and one below' }],
  4: [
    { layout: pattern('saltire'), words: 'one in each corner' }, { layout: pattern('cross'), words: 'one above, one below and one on each side' },
    { layout: rows([2, 2]), words: 'two above and two below' },
  ],
  ...Object.fromEntries([5, 6, 7, 8].map((n) => [n, [
    { layout: pattern('orle'), words: 'in a ring round the edge' }, { layout: pattern('annulo'), words: 'in a ring around them' },
  ]])),
};

/** The counts of charges that can be set around a primary charge group. */
export const AROUND_COUNTS: readonly number[] = Object.keys(AROUND).map(Number);

/** The layouts of `count` charges set around a primary charge group, Table 7's default first; a ring round the edge only with no chief or bordure. */
export function aroundLayouts(count: number, peripheral: Peripheral): Layout[] {
  return (AROUND[count] ?? []).map((a) => a.layout).filter((l) => peripheral === 'none' || l.arrangement.k !== 'pattern' || l.arrangement.pattern !== 'orle');
}

/** How charges set around a primary charge group in this layout stand, in plain words, or null for a layout they can't take. */
export function aroundWords(count: number, layout: Layout): string | null {
  return AROUND[count]?.find((a) => sameLayout(a.layout, layout))?.words ?? null;
}

/** The layouts of a primary charge group with charges set around it: one charge alone, or two in fess, in pale or (long charges) crossed. */
export function aroundPrimaryLayouts(count: number, long: boolean): Layout[] {
  if (count === 1) return [single()];
  return count === 2 ? [line('fess'), line('pale'), ...(long ? [{ arrangement: { k: 'crossed' }, position: null } satisfies Layout] : [])] : [];
}

/**
 * Table 7's tertiary row "On any other charge", the one place it is written: the layouts the charges on each of the
 * primary charges take, by count. One charge sits alone; every other count must be stated (two in fess or in pale,
 * three two and one, one and two, in fess or in pale, four two and two or in cross). Beyond four they are blazoned semy.
 */
const ON_CHARGE: Readonly<Record<number, readonly Layout[]>> = {
  1: [single()],
  2: [line('fess'), line('pale')],
  3: [rows([2, 1]), rows([1, 2]), line('fess'), line('pale')],
  4: [rows([2, 2]), pattern('cross')],
};

/** The counts of charges that can be set on each of the primary charges. */
export const ON_CHARGE_COUNTS: readonly number[] = Object.keys(ON_CHARGE).map(Number);

/** The layouts of `count` charges on each of the primary charges, the first the builder's default. */
export const onChargeLayouts = (count: number): readonly Layout[] => ON_CHARGE[count] ?? [];

/** The layouts of `count` charges overall: one alone, or two long charges crossed. */
export function overallLayouts(count: number, long: boolean): Layout[] {
  if (count === 1) return [single()];
  return count === 2 && long ? [{ arrangement: { k: 'crossed' }, position: null }] : [];
}

/** The counts that have a layout around (`between`) or on (`on`) an ordinary: Table 7's secondary and tertiary rows. */
export function hostCounts(kind: 'between' | 'on', ordinary: OrdinaryType): readonly number[] {
  if (kind === 'between') return Object.keys(BETWEEN[ordinary] ?? {}).map(Number);
  switch (ordinary) {
    case 'fess': case 'pale': case 'bend': case 'bend-sinister': case 'chevron': case 'chief': case 'bordure': return Array.from({ length: 12 }, (_, i) => i + 1);
    case 'cross': case 'saltire': return [1, 4, 5];
    case 'pile': return [1, 2, 3];
    default: return [];
  }
}

// ── GoT Table 7 ─────────────────────────────────────────────────────────────

export type DefaultRule = '0' | '1' | '2-two-part' | '2-four-part' | '3' | '4' | '5' | '6' | '7' | 'host' | 'position' | 'around';
export interface RuledLayout { layout: Layout; rule: DefaultRule }

/** The two tinctures of a two-part divided field, or null when the field isn't one or a part isn't a plain tincture. */
function fieldPair(d: Design): [Tincture, Tincture] | null {
  if (d.kind !== 'arms' || d.field.k !== 'divided' || d.field.parts.length !== 2) return null;
  const [a, b] = d.field.parts;
  return a.k === 'tincture' && b.k === 'tincture' ? [a.t, b.t] : null;
}

/** Table 7 for a charge group of `count` in `ctx`: the first applicable row, or null for "None, must be specified". */
function tableDefaultRuleFor(d: Design, group: Group, ctx: LayoutContext, own: number): RuledLayout | null {
  if (ctx.k === 'position') return { layout: positionLayout(ctx.position, own), rule: 'position' };
  if (ctx.k === 'around') return own === 3 ? { layout: rows([2, 1]), rule: 'around' } : null;
  if (ctx.k === 'on-charge' || ctx.k === 'overall') return own === 1 ? { layout: single(), rule: '1' } : null;
  if (ctx.k !== 'field') return { layout: HOST_LAYOUT, rule: 'host' };
  // Co-primary groups are laid out together: Table 7 for all their charges.
  const count = shareTotal(ctx.share, own);
  const division = d.kind === 'arms' && d.field.k === 'divided' ? d.field.division : null;
  const pair = fieldPair(d);
  const paint = group.paint;

  // Table 7 intro: charges with no contrast with a section go where they contrast (not into room left for a secondary group).
  const places = division === null ? undefined : PART_POSITIONS[division];
  if (places && ctx.share === null && !hasChief(ctx.peripheral) && ctx.yields === 'none' && paint.k === 'tincture' && pair && pair[0] !== pair[1]) {
    const i = pair.indexOf(paint.t);
    if (i >= 0 && contrastFailure(paint.t, [pair[1 - i]]) === null) {
      const forced = forcedLayoutIn(places[1 - i], count, division === 'quarterly');
      if (forced) return { layout: forced, rule: '0' };
    }
  }
  if (count === 1) return { layout: single(), rule: '1' };
  if (count === 2) {
    switch (division) {
      case 'per-pale': return { layout: line('fess'), rule: '2-two-part' };
      case 'per-fess': case 'per-chevron': return { layout: line('pale'), rule: '2-two-part' };
      case 'per-bend': return { layout: line('bend-sinister'), rule: '2-two-part' };
      case 'per-bend-sinister': return { layout: line('bend'), rule: '2-two-part' };
      case 'quarterly': case 'per-saltire': {
        // Two different groups each go where they contrast, whichever they are blazoned first: that is stated.
        if (ctx.share || paint.k !== 'tincture' || !pair) return null;
        const good = pair.flatMap((p, i) => (contrastFailure(paint.t, [p]) === null ? [i] : []));
        if (good.length !== 1) return null;
        const dirs: LineDir[] = division === 'quarterly' ? ['bend', 'bend-sinister'] : ['pale', 'fess'];
        return { layout: line(dirs[good[0]]), rule: '2-four-part' };
      }
      default: return null;
    }
  }
  if (count === 3) return { layout: rows([2, 1]), rule: '3' };
  if (count === 4) {
    if (division === 'quarterly') return { layout: rows([2, 2]), rule: '4' };
    return division === 'per-saltire' ? { layout: pattern('cross'), rule: '4' } : null;
  }
  if (count === 5) return { layout: rows([2, 2, 1]), rule: '5' };
  if (count === 6) return division === null ? { layout: rows([3, 2, 1]), rule: '6' } : null;
  if (count === 10) return { layout: rows([4, 3, 2, 1]), rule: '7' };
  return null;
}

/**
 * The layouts two co-primary groups can take together, for all their charges: Table 7's, two side by side first, the row
 * patterns, the lines, and along the top or the bottom. Not crossed, in a ring or with charges around them: those are for one group.
 */
function sharedCandidates(ctx: FieldContext, total: number, tableDefault: Layout | null): Layout[] {
  const out: Layout[] = tableDefault ? [tableDefault] : [];
  if (total === 2) out.push(line('fess'));
  out.push(...ROW_PATTERNS.filter((r) => r.reduce((a, b) => a + b, 0) === total).map(rows));
  out.push(...LINE_DIRS.map((dir) => line(dir)));
  if (!hasChief(ctx.peripheral) && ctx.yields === 'none') out.push(line('fess', 'chief'), line('fess', 'base'));
  const seen = new Set<string>();
  return out.filter((l) => !seen.has(layoutKey(l)) && !!seen.add(layoutKey(l)));
}

/** The layouts a charge group of `count` can take, in the order the builder lists them. Capacity is not consulted. */
function candidatesFor(group: Group, ctx: LayoutContext, count: number, tableDefault: Layout | null): Layout[] {
  const long = group.item.k === 'charge' && CHARGES[group.item.charge].long;
  if (ctx.k === 'position') return positionLayouts(ctx.position, count, long);
  if (ctx.k === 'around') return aroundLayouts(count, ctx.peripheral);
  if (ctx.k === 'on-charge') return [...onChargeLayouts(count)];
  if (ctx.k === 'overall') return overallLayouts(count, long);
  if (ctx.k !== 'field') return [HOST_LAYOUT];
  if (ctx.share) return sharedCandidates(ctx, shareTotal(ctx.share, count), tableDefault);
  // Primary charges with charges set around them stand alone, or two side by side, one above the other or crossed.
  const around = ctx.yields === 'around' ? aroundPrimaryLayouts(count, long) : [];
  if (around.length > 0) return tableDefault && around.some((l) => sameLayout(l, tableDefault)) ? [tableDefault, ...around.filter((l) => !sameLayout(l, tableDefault))] : around;
  const out: Layout[] = tableDefault ? [tableDefault] : [];
  out.push(...ROW_PATTERNS.filter((r) => r.reduce((a, b) => a + b, 0) === count).map(rows));
  if (count >= 2) out.push(...LINE_DIRS.map((dir) => line(dir)));
  if (count === 4 || count === 5) out.push(pattern('cross'), pattern('saltire'));
  if (count === 2 && long) out.push({ arrangement: { k: 'crossed' }, position: null });
  // Two in annulo curl round each other: only a fish can (SENA example: two fish in annulo); otherwise a ring starts at three.
  if (count >= 3 || (count === 2 && group.item.k === 'charge' && CHARGES[group.item.charge].postureClass === 'fish')) out.push(pattern('annulo'));
  // A ring round the edge, and charges along the top or bottom, would take the room left for a secondary group.
  if (count >= 5 && ctx.peripheral === 'none' && ctx.yields === 'none') out.push(pattern('orle'));
  if (!hasChief(ctx.peripheral) && ctx.yields === 'none') {
    for (const position of ['chief', 'base'] as const) out.push(count === 1 ? single(position) : line('fess', position));
    for (const position of HALF_POSITIONS) out.push(...halfLayouts(position, count));
  }
  if (count === 1) out.push(single());
  const seen = new Set<string>();
  return out.filter((l) => !seen.has(layoutKey(l)) && !!seen.add(layoutKey(l)));
}

// The functions below take the group and its host so resolve can use them before groups have paths.

/** The table row for a charge group at its own count, or null for none; ordinaries and groups without a layout have none. */
function ruledDefaultOf(d: Design, group: Group, host: Group | null): RuledLayout | null {
  const ctx = contextOf(d, group, host);
  return ctx ? tableDefaultRuleFor(d, group, ctx, group.count) : null;
}

/** The layout of a group whose arrangement the input leaves out. Never throws: groups with no layout get a plain fallback. */
export function defaultLayoutOf(d: Design, group: Group, host: Group | null, count: number = group.count): Layout {
  const own = contextOf(d, group, host);
  const ctx = own && withOwnCount(own, count);
  // A count with no layout there (a gap) keeps a plain one.
  if (ctx) return tableDefaultRuleFor(d, group, ctx, count)?.layout ?? candidatesFor(group, ctx, count, null)[0] ?? (count === 1 ? single() : line('fess'));
  if (group.item.k === 'ordinary') return single();
  if (host || group.role === 'secondary') return HOST_LAYOUT;
  return count === 1 ? single() : line('pale');
}

function groupAndHost(d: Design, path: GroupPath): { group: Group; host: Group | null } {
  return { group: groupAt(d, path), host: hostOf(d, path) };
}

/** Table 7's default layout for a group, or null for "None, must be specified". */
export function tableDefault(d: Design, path: GroupPath): Layout | null {
  const { group, host } = groupAndHost(d, path);
  if (group.item.k === 'ordinary') return single();
  layoutContext(d, path);
  return ruledDefaultOf(d, group, host)?.layout ?? null;
}

/** The layouts a charge group of `count` can take, in the builder's order. Ordinaries take one. */
export function layoutCandidates(d: Design, path: GroupPath, count: number): Layout[] {
  const group = groupAt(d, path);
  if (group.item.k === 'ordinary') return [single()];
  const ctx = withOwnCount(layoutContext(d, path), count);
  return candidatesFor(group, ctx, count, tableDefaultRuleFor(d, group, ctx, count)?.layout ?? null);
}

/** Table 7's default, else the first candidate; a default that doesn't fit is a structure issue the builder avoids by choosing counts that fit. */
export function defaultLayout(d: Design, path: GroupPath): Layout {
  const { group, host } = groupAndHost(d, path);
  if (group.item.k === 'charge') layoutContext(d, path);
  return defaultLayoutOf(d, group, host);
}

/**
 * Whether SENA fixes the layout (no difference for changing it): around or on an ordinary, by the ordinary; or on a
 * field by tincture (A5E4, A5G6) — the no-contrast forcing and the four-part contrast row. Defaults the charges could
 * leave, like two Or roses on per pale azure and gules, are not forced.
 */
export function isForced(d: Design, path: GroupPath): boolean {
  const { group, host } = groupAndHost(d, path);
  if (group.item.k === 'ordinary') return false;
  const ctx = layoutContext(d, path);
  // Where a secondary group stands, how charges stand around the primary charges and on each of them, is chosen, not forced:
  // moving them is a change of arrangement (GoT "Arrangement").
  if (ctx.k === 'position' || ctx.k === 'around' || ctx.k === 'on-charge' || ctx.k === 'overall') return false;
  if (ctx.k !== 'field') return true;
  const ruled = forcedRuleOf(d, group, host);
  return ruled !== null && sameLayout(ruled, { arrangement: group.arrangement, position: group.position });
}

/** The layout tincture forces on a field group (the no-contrast row and the four-part contrast row), or null. */
function forcedRuleOf(d: Design, group: Group, host: Group | null): Layout | null {
  const ruled = ruledDefaultOf(d, group, host);
  return ruled !== null && (ruled.rule === '0' || ruled.rule === '2-four-part') ? ruled.layout : null;
}

/** The place Table 7 forces a field group into by tincture (the blazon leaves it out: the tinctures say it), or null. */
export function forcedPosition(d: Design, path: GroupPath): Position | null {
  return forcedLayout(d, path)?.position ?? null;
}

/**
 * The layout of a charge group that states an arrangement other than the one Table 7 forces it into: that arrangement in the part
 * the group is forced into by tincture ("three mullets one and two"), when it can take it there; null when the group isn't forced,
 * states the forced arrangement (it stands as stated, where the arrangement puts it), or can't take it there.
 */
export function inForcedPart(d: Design, group: Group, host: Group | null, arrangement: Arrangement): Layout | null {
  const ctx = contextOf(d, group, host);
  const forced = ctx?.k === 'field' ? forcedRuleOf(d, group, host) : null;
  if (!ctx || !forced?.position || sameLayout({ arrangement, position: null }, { arrangement: forced.arrangement, position: null })) return null;
  const layout: Layout = { arrangement, position: forced.position };
  return candidatesFor(group, ctx, group.count, forced).some((l) => sameLayout(l, layout)) ? layout : null;
}

/**
 * The layout the builder knows Table 7 forces this charge group into by tincture, or null when it knows none here
 * (the forcing into one part is drawn for few charges, more in a half than a quarter: elsewhere it is a gap).
 */
export function forcedLayout(d: Design, path: GroupPath): Layout | null {
  const { group, host } = groupAndHost(d, path);
  return group.item.k === 'charge' && layoutContext(d, path).k === 'field' ? forcedRuleOf(d, group, host) : null;
}

/**
 * Whether the blazon must word the layout: a field group whose layout is not just centred and differs from Table 7, a group
 * set by position ("and in chief"), or charges around the primary charges in any layout but Table 7's ("between in fess two mullets").
 */
export function statesLayout(d: Design, path: GroupPath): boolean {
  const { group } = groupAndHost(d, path);
  if (group.item.k === 'ordinary') return false;
  const ctx = layoutContext(d, path);
  if (ctx.k === 'position') return true;
  const layout: Layout = { arrangement: group.arrangement, position: group.position };
  if (ctx.k === 'around' || ctx.k === 'on-charge' || ctx.k === 'overall') {
    const table = tableDefault(d, path);
    return table === null || !sameLayout(layout, table);
  }
  if (ctx.k !== 'field') return false;
  if (layout.arrangement.k === 'single' && layout.position === null) return false;
  const table = tableDefault(d, path);
  return table === null || !sameLayout(layout, table);
}
