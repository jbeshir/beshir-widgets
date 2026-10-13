// Layouts (an arrangement plus an optional position), their keys, and GoT Table 7: which layout a
// group has when the blazon doesn't say, which layouts a group can take, and when SENA forces one.

import { numberWord, joinAnd } from './words';
import {
  groupAt, hostOf, notSupported, type Arrangement, type Design, type Group, type GroupPath, type LineDir, type Pattern, type Position,
} from './design';
import { CHARGES } from './charges';
import { ORDINARY_KIND, type OrdinaryType } from './ordinaries';
import type { Tincture } from './tinctures';
import { contrastFailure } from './contrast';

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
const POSITIONS: readonly Position[] = ['chief', 'base', 'dexter-chief', 'sinister-chief', 'dexter', 'sinister', 'canton', 'flank', 'fess-point'];

const single = (position: Position | null = null): Layout => ({ arrangement: { k: 'single' }, position });
const line = (dir: LineDir, position: Position | null = null): Layout => ({ arrangement: { k: 'line', dir }, position });
const rows = (r: readonly number[]): Layout => ({ arrangement: { k: 'rows', rows: [...r] }, position: null });
const pattern = (p: Pattern): Layout => ({ arrangement: { k: 'pattern', pattern: p }, position: null });
const HOST: Layout = { arrangement: { k: 'host' }, position: null };

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
  switch (a.k) {
    case 'single': return where ?? 'single';
    case 'line': return where ?? `in ${a.dir.replace('-', ' ')}`;
    case 'rows': return joinAnd(a.rows.map(numberWord));
    case 'pattern': return `in ${a.pattern.replace('-', ' ')}`;
    case 'host': return 'placed by the ordinary';
    case 'crossed': return 'in saltire';
    case 'pair': return a.pair;
  }
}

// ── Where a group sits ──────────────────────────────────────────────────────

export type LayoutContext =
  | { k: 'field'; peripheral: 'none' | 'chief' | 'bordure' }   // primary charge group
  | { k: 'between'; ordinary: OrdinaryType }                 // secondary 'between'
  | { k: 'on'; ordinary: OrdinaryType };                     // tertiary on an ordinary (incl. chief)

function peripheralOf(d: Design): 'none' | 'chief' | 'bordure' {
  const types = d.groups.flatMap((g) => (g.role === 'peripheral' && g.item.k === 'ordinary' ? [g.item.type] : []));
  return types.includes('chief') ? 'chief' : types.includes('bordure') ? 'bordure' : 'none';
}

/** The central ordinary of the primary group, if any: what a secondary group is set between. */
export function primaryOrdinary(d: Design): OrdinaryType | null {
  const g = d.groups.find((x) => x.role === 'primary');
  return g && g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central' ? g.item.type : null;
}

/** Where a charge group sits, or null for a group this builder has no layout for (ordinaries, overall, charges on charges, …). */
export function contextOf(d: Design, group: Group, host: Group | null): LayoutContext | null {
  if (group.item.k !== 'charge') return null;
  if (host) return host.item.k === 'ordinary' && group.role === 'tertiary' ? { k: 'on', ordinary: host.item.type } : null;
  if (group.role === 'primary') return { k: 'field', peripheral: peripheralOf(d) };
  if (group.role === 'secondary' && group.relation === 'between') {
    const ordinary = primaryOrdinary(d);
    return ordinary ? { k: 'between', ordinary } : null;
  }
  return null;
}

export function layoutContext(d: Design, path: GroupPath): LayoutContext {
  const group = groupAt(d, path);
  return contextOf(d, group, hostOf(d, path)) ?? notSupported({ category: 'placement', detail: `${group.role}-${group.item.k}` });
}

/** The counts that have a layout around (`between`) or on (`on`) an ordinary: Table 7's secondary and tertiary rows. */
export function hostCounts(ctx: LayoutContext): readonly number[] {
  const upTo12 = Array.from({ length: 12 }, (_, i) => i + 1);
  if (ctx.k === 'between') {
    switch (ctx.ordinary) {
      case 'fess': return [2, 3, 4, 6];
      case 'pale': case 'bend': case 'bend-sinister': return [2, 4, 6];
      case 'chevron': return [2, 3, 6];
      case 'cross': case 'saltire': return [4];
      case 'pile': return [2];
      default: return [];
    }
  }
  if (ctx.k === 'on') {
    switch (ctx.ordinary) {
      case 'fess': case 'pale': case 'bend': case 'bend-sinister': case 'chevron': case 'chief': return upTo12;
      case 'cross': case 'saltire': return [1, 4, 5];
      case 'pile': return [1, 2, 3];
      default: return [];
    }
  }
  return [];
}

// ── GoT Table 7 ─────────────────────────────────────────────────────────────

export type DefaultRule = '0' | '1' | '2-two-part' | '2-four-part' | '3' | '4' | '5' | '6' | '7' | 'host';
export interface RuledLayout { layout: Layout; rule: DefaultRule }

/** The two tinctures of a two-part divided field, or null when the field isn't one or a part isn't a plain tincture. */
function fieldPair(d: Design): [Tincture, Tincture] | null {
  if (d.kind !== 'arms' || d.field.k !== 'divided' || d.field.parts.length !== 2) return null;
  const [a, b] = d.field.parts;
  return a.k === 'tincture' && b.k === 'tincture' ? [a.t, b.t] : null;
}

/** Table 7 for a charge group of `count` in `ctx`: the first applicable row, or null for "None, must be specified". */
function tableDefaultRuleFor(d: Design, group: Group, ctx: LayoutContext, count: number): RuledLayout | null {
  if (ctx.k !== 'field') return { layout: HOST, rule: 'host' };
  const division = d.kind === 'arms' && d.field.k === 'divided' ? d.field.division : null;
  const pair = fieldPair(d);
  const paint = group.paint;

  // Table 7 intro: charges with no contrast with a section go where they contrast.
  if ((division === 'per-fess' || division === 'per-chevron') && ctx.peripheral !== 'chief' && paint.k === 'tincture' && pair && pair[0] !== pair[1]) {
    const i = pair.indexOf(paint.t);
    if (i >= 0 && contrastFailure(paint.t, [pair[1 - i]]) === null) {
      const position = i === 1 ? 'chief' : 'base';
      return { layout: count === 1 ? single(position) : line('fess', position), rule: '0' };
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
        if (paint.k !== 'tincture' || !pair) return null;
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

/** The layouts a charge group of `count` can take, in the order the builder lists them. Capacity is not consulted. */
function candidatesFor(group: Group, ctx: LayoutContext, count: number, tableDefault: Layout | null): Layout[] {
  if (ctx.k !== 'field') return [HOST];
  const out: Layout[] = tableDefault ? [tableDefault] : [];
  out.push(...ROW_PATTERNS.filter((r) => r.reduce((a, b) => a + b, 0) === count).map(rows));
  if (count >= 2) out.push(...LINE_DIRS.map((dir) => line(dir)));
  if (count === 4 || count === 5) out.push(pattern('cross'), pattern('saltire'));
  if (count === 2 && group.item.k === 'charge' && CHARGES[group.item.charge].long) out.push({ arrangement: { k: 'crossed' }, position: null });
  if (count >= 3) out.push(pattern('annulo'));
  if (count >= 5 && ctx.peripheral === 'none') out.push(pattern('orle'));
  if (ctx.peripheral !== 'chief') {
    for (const position of ['chief', 'base'] as const) out.push(count === 1 ? single(position) : line('fess', position));
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
  const ctx = contextOf(d, group, host);
  if (ctx) return tableDefaultRuleFor(d, group, ctx, count)?.layout ?? candidatesFor(group, ctx, count, null)[0];
  if (group.item.k === 'ordinary') return single();
  if (host || group.role === 'secondary') return HOST;
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
  const ctx = layoutContext(d, path);
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
  if (ctx.k !== 'field') return true;
  const ruled = ruledDefaultOf(d, group, host);
  return ruled !== null && (ruled.rule === '0' || ruled.rule === '2-four-part') && sameLayout(ruled.layout, { arrangement: group.arrangement, position: group.position });
}

/** Whether the blazon must word the layout: a field group whose layout is not just centred and differs from Table 7. */
export function statesLayout(d: Design, path: GroupPath): boolean {
  const { group } = groupAndHost(d, path);
  if (group.item.k === 'ordinary') return false;
  if (layoutContext(d, path).k !== 'field') return false;
  const layout: Layout = { arrangement: group.arrangement, position: group.position };
  if (layout.arrangement.k === 'single' && layout.position === null) return false;
  const table = tableDefault(d, path);
  return table === null || !sameLayout(layout, table);
}
