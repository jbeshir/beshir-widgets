// Conflict between two designs, as SENA A5 counts it (RULES §C): substantial changes (SC) and distinct
// changes (DC) over the aligned charge groups. Two designs are clear of each other with one SC or two
// DCs. Each difference carries the SENA rule it comes from; `explainDifferences` words it for the
// Availability UI. Same code on client (instant feedback) and Worker (authoritative).

import { TINCTURE_NAME, type Tincture } from './tinctures';
import { capitalise } from './words';
import { CHARGES, postureTerm, type Posture, type PostureClass } from './charges';
import {
  fieldTinctures, groupAt, groupTinctureOf, hostOf, isFieldPrimary, itemKey, itemName, notSupported, primaryGroup,
  type Design, type Group, type GroupPath, type Item, type Paint, type Role,
} from './design';
import { DIVISION_NAME } from './divisions';
import { ORDINARY_ARTICLE, ORDINARY_KIND, ORDINARY_NAME } from './ordinaries';
import { ORDINARY_LABEL } from './plain-words';
import { isForced, layoutKey, layoutWords, primaryCharges, type LayoutKey } from './arrangement';
import { paintGaps } from './support';
import { shownTinctures, type ShownTinctures } from './tincture-rule';

export type ChangeKind = 'sc' | 'dc';

const CHANGE_KINDS: readonly ChangeKind[] = ['sc', 'dc'];

/**
 * The SENA section each change comes from (RULES §C.4, §C.5). A5G1b–d never appear: every drawn division is
 * its own A5F1b category, so a different direction, style or number of pieces is already a substantial change.
 */
export const SENA_RULES = ['A5E1', 'A5E2', 'A5E3', 'A5E4', 'A5E5', 'A5F1', 'A5F2', 'A5G1a', 'A5G2', 'A5G3', 'A5G4', 'A5G5', 'A5G6', 'A5G7'] as const;
export type SenaRule = (typeof SENA_RULES)[number];

export type DiffAttr =
  | 'field-partition' | 'field-tincture' | 'primary-presence' | 'group-presence'
  | 'type' | 'number' | 'tincture' | 'arrangement' | 'posture';

const DIFF_ATTRS: readonly DiffAttr[] = [
  'field-partition', 'field-tincture', 'primary-presence', 'group-presence', 'type', 'number', 'tincture', 'arrangement', 'posture',
];

export function isDiffAttr(v: unknown): v is DiffAttr {
  return typeof v === 'string' && (DIFF_ATTRS as readonly string[]).includes(v);
}

export function isChangeKind(v: unknown): v is ChangeKind {
  return typeof v === 'string' && (CHANGE_KINDS as readonly string[]).includes(v);
}

export function isSenaRule(v: unknown): v is SenaRule {
  return typeof v === 'string' && (SENA_RULES as readonly string[]).includes(v);
}

/**
 * The groups a change is about: `a` and `b` are their paths in the two designs (null on the side that lacks the
 * group); `role` and `host` (the role of the group it sits on, for tertiaries) are those of the first design's group,
 * else the second's.
 */
export type GroupRef = { role: Role; item: 'ordinary' | 'charge'; host: Role | null }
  & ({ a: GroupPath; b: GroupPath } | { a: GroupPath; b: null } | { a: null; b: GroupPath });

export interface Diff { attr: DiffAttr; kind: ChangeKind; rule: SenaRule; group: GroupRef | null }

/** SENA A5A: clear of a conflict with one substantial change, or two distinct changes. */
export function isClear(diffs: readonly { kind: ChangeKind }[]): boolean {
  return diffs.some((d) => d.kind === 'sc') || diffs.length >= 2;
}

// ── Classes: what counts as the same type, number group, arrangement group, posture line ────────────────────────

/** What A5E2 compares: ordinaries by type, charges by type class (an eagle and an owl are one class, a lion and a wolf are not). */
function conflictKey(item: Item): string {
  return item.k === 'ordinary' ? `ordinary:${item.type}` : `charge:${CHARGES[item.charge].typeClass}`;
}

/** A5E3: 1 | 2 | 3 | 4 and more. */
const countCategory = (n: number): number => Math.min(n, 4);

/** A5G5: 1 | 2 | 3 | 4 | 5 | 6 and more. */
const countCategoryFine = (n: number): number => Math.min(n, 6);

/**
 * A5E4: arrangements substantially different from each other, within a group no substantial change, whatever the
 * counts ("six mullets three, two, and one does not conflict with eight mullets in orle"). A layout with a position
 * ("in chief") is in none: SENA says such arrangements can't use the rule.
 */
function arrangementGroup(g: Group): string | null {
  const a = g.arrangement;
  if (g.position !== null) return null;
  switch (a.k) {
    case 'line': return `line-${a.dir}`;
    case 'crossed': return 'saltire';
    case 'pattern':
      return a.pattern === 'saltire' ? 'saltire' : a.pattern === 'cross' ? 'cross' : a.pattern === 'orle' || a.pattern === 'annulo' ? 'ring' : null;
    case 'rows': {
      const key = a.rows.join('-');
      return key === '2-2' ? 'saltire' : key === '2-1' || key === '3-2-1' ? 'two-and-one' : null;
    }
    default: return null;
  }
}

/** A5E5 (RULES §C.4 SC-5): postures substantially different from those of the other lines; unlisted postures are in none. */
const POSTURE_SC_LINES: Record<PostureClass, Partial<Record<Posture, string>>> = {
  quadruped: {
    rampant: 'rampant', salient: 'rampant', 'sejant-erect': 'rampant', sejant: 'rampant',
    courant: 'passant', passant: 'passant', statant: 'passant', couchant: 'passant', dormant: 'passant',
  },
  bird: { displayed: 'displayed', volant: 'displayed', close: 'close', naiant: 'close', rising: 'rising' },
  fish: { haurient: 'haurient', urinant: 'haurient', naiant: 'naiant' },
  insect: {},
};

/**
 * A5G7 (RULES §C.7, App L1): postures within a line don't differ, across lines they do. A sejant erect is in the rampant
 * and the sejant line both, so it differs from neither (RULES §G.7).
 */
const POSTURE_DC_LINES: Record<PostureClass, Partial<Record<Posture, readonly string[]>>> = {
  quadruped: {
    rampant: ['rampant'], salient: ['rampant'], 'statant-erect': ['rampant'], 'sejant-erect': ['rampant', 'sejant'],
    passant: ['passant'], statant: ['passant'], courant: ['passant'], sejant: ['sejant'], couchant: ['couchant'], dormant: ['couchant'],
  },
  bird: { close: ['close'], naiant: ['close'], displayed: ['displayed'], volant: ['volant'], rising: ['rising'] },
  fish: { haurient: ['haurient'], urinant: ['haurient'], naiant: ['naiant'] },
  insect: {},
};

/** The postures of two charges that share a posture class (App M3), or null when they are not comparable or either has no posture. */
function comparablePostures(x: Item, y: Item): { cls: PostureClass; px: Posture; py: Posture } | null {
  if (x.k !== 'charge' || y.k !== 'charge' || !x.posture || !y.posture) return null;
  const cls = CHARGES[x.charge].postureClass;
  return cls !== null && cls === CHARGES[y.charge].postureClass ? { cls, px: x.posture, py: y.posture } : null;
}

/** RULES §C.6 (App K): the layouts a group of `count` can swap with a group of another count and still differ in arrangement. */
function appK(count: number): readonly LayoutKey[] {
  switch (count) {
    case 1: return ['in-chief', 'in-base', 'single'];
    case 2: return ['in-pale', 'in-fess', 'in-chief', 'in-bend', 'in-bend-sinister', 'crossed'];
    case 3: return ['rows-2-1', 'rows-1-2', 'in-pale', 'in-fess', 'in-chief', 'in-bend', 'in-bend-sinister', 'in-annulo'];
    default: return ['in-cross', 'in-saltire', 'in-pale', 'in-fess', 'in-chief', 'in-bend', 'in-bend-sinister', 'in-annulo', 'in-orle'];
  }
}

// ── Aligned groups ──────────────────────────────────────────────────────────

/** A group with the design it is in and where (isForced needs the design and the path). */
interface Side { design: Design; path: GroupPath; group: Group; host: Group | null }

const layoutOf = (s: Side): LayoutKey => layoutKey({ arrangement: s.group.arrangement, position: s.group.position });

function sidesWhere(d: Design, keep: (g: Group) => boolean): Side[] {
  return d.groups.flatMap((group, i) => (keep(group) ? [{ design: d, path: [i], group, host: null }] : []));
}

const primaryOf = (d: Design): Side | null => {
  const p = primaryGroup(d);
  return p && { design: d, path: p.path, group: p.group, host: null };
};

/** A5C2: overall groups are compared with overall groups. */
const overallsOf = (d: Design): Side[] => sidesWhere(d, (g) => g.role === 'overall');

/** A5C2b: SENA treats peripheral ordinaries as secondary charge groups. */
const secondariesOf = (d: Design): Side[] => sidesWhere(d, (g) => g.role === 'secondary' || g.role === 'peripheral');

const tertiariesOf = (host: Side | null): Side[] =>
  host ? host.group.charged.map((group, j) => ({ design: host.design, path: [...host.path, j], group, host: host.group })) : [];

/** A5C2b: identical items are paired first, then the rest in canonical order; what is left over is unpaired. */
function pairUp(xs: readonly Side[], ys: readonly Side[]): { pairs: Array<[Side, Side]>; onlyX: Side[]; onlyY: Side[] } {
  const restY = [...ys];
  const restX: Side[] = [];
  const pairs: Array<[Side, Side]> = [];
  for (const x of xs) {
    const i = restY.findIndex((y) => itemKey(y.group.item) === itemKey(x.group.item));
    if (i >= 0) pairs.push([x, restY.splice(i, 1)[0]]);
    else restX.push(x);
  }
  const n = Math.min(restX.length, restY.length);
  for (let i = 0; i < n; i++) pairs.push([restX[i], restY[i]]);
  return { pairs, onlyX: restX.slice(n), onlyY: restY.slice(n) };
}

function refOf(x: Side, y: Side | null): GroupRef;
function refOf(x: null, y: Side): GroupRef;
function refOf(x: Side | null, y: Side | null): GroupRef {
  const base = (s: Side) => ({ role: s.group.role, item: s.group.item.k, host: s.host?.role ?? null });
  if (x) return { ...base(x), a: x.path, b: y ? y.path : null };
  if (y) return { ...base(y), a: null, b: y.path };
  throw new RangeError('A group reference needs a group.');
}

/** A paint's tincture or counterchanged; the other paints are not drawn. */
function tinctureOf(p: Paint) {
  return groupTinctureOf(p) ?? notSupported(paintGaps(p, false, 'group')[0] ?? { category: 'tincture', detail: p.k });
}

/** A shown tincture over part `i` of the field, or null where the group doesn't lie. */
const shownAt = (s: ShownTinctures, i: number): Tincture | null => (s.k === 'plain' ? s.t : s.byPart.get(i) ?? null);

/**
 * A5G3 (with A5G3a, A5C2d): whether the tinctures a group shows change over at least half of it, compared part of the
 * field by part where a group is counterchanged — "Per pale argent and gules, a lion counterchanged" shows a gules and
 * an argent half, so it differs from the same lion on per pale Or and gules by half the lion.
 */
function tinctureChanged(x: Side, y: Side): boolean {
  const a = shownTinctures(x.design, x.path), b = shownTinctures(y.design, y.path);
  if (a.k === 'plain' && b.k === 'plain') return a.t !== b.t;
  const parts = new Set([...(a.k === 'parts' ? a.byPart.keys() : []), ...(b.k === 'parts' ? b.byPart.keys() : [])]);
  // Counterchanged with nothing to show (an invalid design): compare the paints as written.
  if (parts.size === 0) return a.k !== b.k;
  const changed = [...parts].filter((i) => shownAt(a, i) !== shownAt(b, i)).length;
  return changed > 0 && changed * 2 >= parts.size;
}

// ── Differences ─────────────────────────────────────────────────────────────

const change = (attr: DiffAttr, kind: ChangeKind, rule: SenaRule, group: GroupRef | null): Diff => ({ attr, kind, rule, group });

/** The partition category of a field (A5F1): plain, or the division — each drawn division is its own category. */
function partition(d: Design): string {
  if (d.kind === 'badge') return notSupported({ category: 'fieldless', detail: 'badge' });
  const f = d.field;
  return f.k === 'divided' ? f.division : f.k === 'tincture' ? 'plain' : notSupported(paintGaps(f, true, 'field')[0]);
}

function fieldChanges(a: Design, b: Design): Diff[] {
  if (partition(a) !== partition(b)) return [change('field-partition', 'sc', 'A5F1', null)];
  const ta = fieldTinctures(a), tb = fieldTinctures(b);
  if (ta.join() === tb.join()) return [];
  // A5F2: for field-primary armory a change of every part to a tincture the other field lacks is substantial.
  const substantial = isFieldPrimary(a) && isFieldPrimary(b)
    && ta.every((t, i) => t !== tb[i]) && ta.some((t) => !tb.includes(t)) && tb.some((t) => !ta.includes(t));
  return [substantial ? change('field-tincture', 'sc', 'A5F2', null) : change('field-tincture', 'dc', 'A5G1a', null)];
}

/** A5E2–A5E5: the substantial changes between two primary groups. */
function primaryChanges(x: Side, y: Side): Diff[] {
  const ref = refOf(x, y);
  const out: Diff[] = [];
  if (conflictKey(x.group.item) !== conflictKey(y.group.item)) out.push(change('type', 'sc', 'A5E2', ref));
  if (countCategory(x.group.count) !== countCategory(y.group.count)) out.push(change('number', 'sc', 'A5E3', ref));
  const gx = arrangementGroup(x.group), gy = arrangementGroup(y.group);
  if (gx !== null && gy !== null && gx !== gy && !isForced(x.design, x.path) && !isForced(y.design, y.path)) {
    out.push(change('arrangement', 'sc', 'A5E4', ref));
  }
  const postures = comparablePostures(x.group.item, y.group.item);
  if (postures) {
    const lines = POSTURE_SC_LINES[postures.cls];
    const lx = lines[postures.px], ly = lines[postures.py];
    if (lx !== undefined && ly !== undefined && lx !== ly) out.push(change('posture', 'sc', 'A5E5', ref));
  }
  return out;
}

/** A5G3–A5G7: at most one distinct change per attribute of a pair of groups; `skip` holds attributes already substantial. */
function groupChanges(x: Side, y: Side, skip: ReadonlySet<DiffAttr>): Diff[] {
  const ref = refOf(x, y);
  const out: Diff[] = [];
  const dc = (attr: DiffAttr, rule: SenaRule) => { if (!skip.has(attr)) out.push(change(attr, 'dc', rule, ref)); };
  const gx = x.group, gy = y.group;
  // The in-splendour mod of a sun is an artistic detail (RULES §C.3) and is not looked at.
  if (itemKey(gx.item) !== itemKey(gy.item)) dc('type', 'A5G4');
  if (countCategoryFine(gx.count) !== countCategoryFine(gy.count)) dc('number', 'A5G5');
  if (tinctureChanged(x, y)) dc('tincture', 'A5G3');
  const kx = layoutOf(x), ky = layoutOf(y);
  // Secondary groups set around the primary and beside it ("between three mullets" / "and in chief three mullets") stand in different places.
  const moved = gx.role === 'secondary' && gy.role === 'secondary' && gx.relation !== gy.relation;
  if (moved || (kx !== ky && !isForced(x.design, x.path) && !isForced(y.design, y.path)
    && (gx.count === gy.count || (appK(gy.count).includes(kx) && appK(gx.count).includes(ky))))) {
    dc('arrangement', 'A5G6');
  }
  const postures = comparablePostures(gx.item, gy.item);
  if (postures) {
    const lines = POSTURE_DC_LINES[postures.cls];
    const lx = lines[postures.px] ?? [], ly = lines[postures.py] ?? [];
    if (postures.px !== postures.py && !lx.some((l) => ly.includes(l))) dc('posture', 'A5G7');
  }
  return out;
}

/** A5C2c: tertiaries compare only when their hosts are paired; on an unpaired host (`null` opposite) each is an added or removed group. */
function tertiaryChanges(x: Side | null, y: Side | null): Diff[] {
  const { pairs, onlyX, onlyY } = pairUp(tertiariesOf(x), tertiariesOf(y));
  return [
    ...pairs.flatMap(([p, q]) => groupChanges(p, q, new Set())),
    ...onlyX.map((p) => change('group-presence', 'dc', 'A5G2', refOf(p, null))),
    ...onlyY.map((q) => change('group-presence', 'dc', 'A5G2', refOf(null, q))),
  ];
}

/** Every SC and DC between two designs (RULES §C.8 `diff`), in field, primary, secondary order. */
export function differences(a: Design, b: Design): Diff[] {
  const out: Diff[] = fieldChanges(a, b);

  const pa = primaryOf(a), pb = primaryOf(b);
  if (pa && pb) {
    const substantial = primaryChanges(pa, pb);
    out.push(...substantial, ...groupChanges(pa, pb, new Set(substantial.map((c) => c.attr))));
  } else if (pa) {
    out.push(change('primary-presence', 'sc', 'A5E1', refOf(pa, null)));
  } else if (pb) {
    out.push(change('primary-presence', 'sc', 'A5E1', refOf(null, pb)));
  }
  out.push(...tertiaryChanges(pa, pb));

  // Secondary and overall groups: those that pair are compared, each one added or removed is one distinct change (A5G2).
  for (const [xs, ys] of [[secondariesOf(a), secondariesOf(b)], [overallsOf(a), overallsOf(b)]]) {
    const { pairs, onlyX, onlyY } = pairUp(xs, ys);
    for (const [x, y] of pairs) out.push(...groupChanges(x, y, new Set()), ...tertiaryChanges(x, y));
    for (const x of onlyX) out.push(change('group-presence', 'dc', 'A5G2', refOf(x, null)), ...tertiaryChanges(x, null));
    for (const y of onlyY) out.push(change('group-presence', 'dc', 'A5G2', refOf(null, y)), ...tertiaryChanges(null, y));
  }
  return out;
}

// ── Verdicts ────────────────────────────────────────────────────────────────

/** A registry entry as seen by the uniqueness check (scan order = registration order). */
export interface RegistryEntryLike { id: string; signature: string; design: Design }

/** An entry and the differences between it and the checked design. */
export interface Comparison { of: string; differences: Diff[] }

export type Verdict =
  | { kind: 'ok'; closest: Comparison | null }
  | { kind: 'duplicate'; of: string }
  | ({ kind: 'too-close' } & Comparison);

/**
 * First exact duplicate, else first entry the design is not clear of, else ok. An ok verdict names the first entry
 * the design is clear of only by two distinct changes (no substantial change), so the UI can show how narrowly it
 * passed. `excludeId` skips self on edit.
 */
export function checkUnique(d: Design, sig: string, registry: readonly RegistryEntryLike[], excludeId?: string): Verdict {
  for (const e of registry) if (e.id !== excludeId && e.signature === sig) return { kind: 'duplicate', of: e.id };
  let closest: Comparison | null = null;
  for (const e of registry) {
    if (e.id === excludeId) continue;
    const ds = differences(d, e.design);
    if (!isClear(ds)) return { kind: 'too-close', of: e.id, differences: ds };
    if (closest === null && ds.length === 2 && ds.every((x) => x.kind === 'dc')) closest = { of: e.id, differences: ds };
  }
  return { kind: 'ok', closest };
}

/**
 * The indexed attributes two designs must all share to be a duplicate, too close, or the closest entry of an ok
 * verdict: a different field partition (A5F1), adding or removing the primary group (A5E1) or changing its type
 * (A5E2) is always a substantial change. Everything else is decided by `checkUnique` on the candidates, so looking
 * a registry up by this key returns every entry that matters.
 */
export interface CandidateKey { partition: string; primary: string | null }

export function candidateKey(d: Design): CandidateKey {
  const p = primaryGroup(d);
  return { partition: partition(d), primary: p && conflictKey(p.group.item) };
}

// ── Explanations ────────────────────────────────────────────────────────────

/** The attributes a too-close design could change to become clear (UI hint). */
export const CLEAR_CHANGE_HINT = 'the background split, the main picture or band (to something unrelated), how many main pictures there are (1, 2, 3 or 4+), '
  + 'or two other things (a colour, the number, the arrangement, the pose, an added or removed group)';

/** What a substantial and a distinct change are, for the `<details>` under a too-close result. */
export const SENA_RULE_HINT = 'Heralds compare two coats of arms by counting changes. A substantial change — a different background split, a different main '
  + 'picture or band, or a different number of main pictures (1, 2, 3 or 4+) — is enough on its own. Smaller distinct changes, such as a colour, the number, '
  + 'the arrangement, the pose or an added or removed group, count one each, and it takes two of them to be different enough.';

export function changeLabel(kind: ChangeKind): string {
  return kind === 'sc' ? 'substantial change' : 'distinct change';
}

/** The running tally of a comparison: "DC + DC = 2 distinct changes — different enough". */
export function tallyText(diffs: readonly { kind: ChangeKind }[]): string {
  const subs = diffs.filter((d) => d.kind === 'sc').length;
  if (subs > 0) return `${subs === 1 ? 'a substantial change' : `${subs} substantial changes`} — different enough`;
  const n = diffs.length;
  const sum = n > 1 ? `${diffs.map(() => 'DC').join(' + ')} = ` : '';
  const count = n === 0 ? 'no distinct changes' : `${n} distinct change${n === 1 ? '' : 's'}`;
  return n >= 2 ? `${sum}${count} — different enough` : `${count} — not enough (needs 2, or one substantial change)`;
}

/** A difference in words: what changed, why it counts as it does, and (for a group) whether it was a band or a picture. */
export interface DifferenceNote { attr: DiffAttr; kind: ChangeKind; rule: SenaRule; text: string; why: string; item: 'ordinary' | 'charge' | null }

const partitionWord = (d: Design): string => (d.kind === 'arms' && d.field.k === 'divided' ? DIVISION_NAME[d.field.division] : 'plain');
const itemPhrase = (i: Item): string => (i.k === 'ordinary' ? `${ORDINARY_ARTICLE[i.type]} ${ORDINARY_NAME[i.type]}` : `${CHARGES[i.charge].article} ${CHARGES[i.charge].name}`);

/** What the builder calls a group in the middle of a sentence: "band or shape", "top bar", "pictures beside the band". */
function groupNoun(d: Design, path: GroupPath): { one: string; many: string } {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (group.item.k === 'ordinary') {
    const type = group.item.type;
    const noun = ORDINARY_KIND[type] === 'central' ? 'band or shape' : ORDINARY_LABEL[type].plain.toLowerCase();
    return { one: noun, many: noun };
  }
  let where = '';
  if (group.role === 'overall') {
    where = ' across everything';
  } else if (host?.item.k === 'charge') {
    where = ' on the picture';
  } else if (host?.item.k === 'ordinary') {
    where = ` on the ${host.item.type === 'chief' || host.item.type === 'bordure' ? ORDINARY_LABEL[host.item.type].plain.toLowerCase() : 'band'}`;
  } else if (group.role === 'secondary' && group.relation === 'position') {
    where = ` in ${group.position}`;
  } else if (group.role === 'secondary') {
    where = primaryCharges(d) ? ' around the picture' : ' beside the band';
  }
  return { one: `picture${where}`, many: `pictures${where}` };
}

/** A change that names no group, or one side only, where a pair of groups is needed to word it. */
function noGroup(attr: DiffAttr): never {
  throw new RangeError(`A "${attr}" change is about a pair of groups.`);
}

/** Each difference between `a` (new) and `b` (existing) in words: "pose of picture (passant ↔ courant)". */
export function explainDifferences(a: Design, b: Design, diffs: readonly Diff[] = differences(a, b)): DifferenceNote[] {
  return diffs.map((diff) => {
    const ref = diff.group;
    const ga = ref?.a ? groupAt(a, ref.a) : null, gb = ref?.b ? groupAt(b, ref.b) : null;
    const nounA = ref?.a ? groupNoun(a, ref.a) : null, nounB = ref?.b ? groupNoun(b, ref.b) : null;
    const noun = () => nounA ?? nounB ?? noGroup(diff.attr);
    /** The two groups a change between a pair is about. */
    const both = () => (ga && gb && nounA && nounB ? { ga, gb, nounA, nounB } : noGroup(diff.attr));
    const pair = (label: string, x: string, y: string) => `${label} (${x} ↔ ${y})`;
    const itemOrNone = (g: Group | null) => (g ? (g.item.k === 'ordinary' ? ORDINARY_NAME[g.item.type] : CHARGES[g.item.charge].plural) : 'none');
    const tinctureWord = (g: Group) => { const t = tinctureOf(g.paint); return t === 'counterchanged' ? t : TINCTURE_NAME[t]; };
    const fieldWord = (d: Design) => fieldTinctures(d).map((t) => TINCTURE_NAME[t]).join('/');
    const postureWord = (g: Group) => { const i = g.item; return i.k === 'charge' && i.posture ? postureTerm(i.charge, i.posture) : 'none'; };

    let text: string;
    let sentence: string;
    switch (diff.attr) {
      case 'field-partition': {
        text = pair('background split', partitionWord(a), partitionWord(b));
        sentence = 'Splitting the background a different way, or splitting it instead of leaving it plain, is a substantial change';
        break;
      }
      case 'field-tincture':
        text = pair('background colour', fieldWord(a), fieldWord(b));
        sentence = diff.kind === 'sc'
          ? 'When the background is the main feature, changing every part to a colour the other background lacks is a substantial change'
          : 'Changing the colours of at least half the background — or swapping them — is a distinct change';
        break;
      case 'primary-presence':
      case 'group-presence':
        text = pair(noun().many, itemOrNone(ga), itemOrNone(gb));
        sentence = diff.attr === 'primary-presence'
          ? 'Adding or taking away the main band or picture is a substantial change'
          : 'Adding or taking away a group of pictures or a band is one distinct change';
        break;
      case 'type': {
        const s = both();
        const bothBands = s.ga.item.k === 'ordinary' && s.gb.item.k === 'ordinary';
        const label = bothBands ? (s.nounA.one === s.nounB.one ? s.nounA.one : 'band or shape') : s.ga.item.k === s.gb.item.k ? noun().one : 'picture or band';
        text = pair(label, itemName(s.ga.item), itemName(s.gb.item));
        sentence = diff.kind === 'sc'
          ? 'Changing every main picture or band to something unrelated is a substantial change'
          : `${capitalise(itemPhrase(s.ga.item))} and ${itemPhrase(s.gb.item)} are different types — a distinct change`;
        break;
      }
      case 'number':
        text = pair(`number of ${noun().many}`, String(both().ga.count), String(both().gb.count));
        sentence = diff.kind === 'sc'
          ? 'The number of main pictures falls in a different group (1, 2, 3, or 4 and more) — a substantial change'
          : 'A different number (1, 2, 3, 4, 5, or 6 and more) is a distinct change';
        break;
      case 'tincture':
        text = pair(`colour of ${noun().many}`, tinctureWord(both().ga), tinctureWord(both().gb));
        sentence = 'Changing the colour of a group is a distinct change';
        break;
      case 'arrangement':
        text = pair(`arrangement of ${noun().many}`, layoutWords({ arrangement: both().ga.arrangement, position: both().ga.position }), layoutWords({ arrangement: both().gb.arrangement, position: both().gb.position }));
        sentence = diff.kind === 'sc'
          ? 'These arrangements look substantially different — a substantial change'
          : 'A different arrangement is a distinct change, unless the design forces it';
        break;
      case 'posture':
        text = pair(`pose of ${noun().one}`, postureWord(both().ga), postureWord(both().gb));
        sentence = diff.kind === 'sc' ? 'These poses are substantially different — a substantial change' : 'A different pose is a distinct change';
        break;
    }
    return { attr: diff.attr, kind: diff.kind, rule: diff.rule, text, why: `${sentence} (SENA ${diff.rule}).`, item: ref?.item ?? null };
  });
}
