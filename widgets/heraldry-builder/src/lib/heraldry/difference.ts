// Conflict between two designs, as SENA A5 counts it (RULES §C): substantial changes (SC) and distinct
// changes (DC) over the aligned charge groups. Two designs are clear of each other with one SC or two
// DCs. Each difference carries the SENA rule it comes from; `explainDifferences` words it for the
// Availability UI. Same code on client (instant feedback) and Worker (authoritative).

import { capitalise } from './words';
import { CHARGES, postureTerm, type ChargeId, type Orientation, type Posture, type PostureClass, type TypeClass } from './charges';
import {
  asParty, asVariation, canonical, canonicalLines, fieldParts, fimbriationOf, groupAt, hostOf, isFieldPrimary, isVoided, itemKey, itemName, notSupported, primaryGroups,
  type Design, type Group, type GroupPath, type Item, type Paint, type Role,
} from './design';
import { DIVISION_NAME, VARIATION_NAME, isCountedVariation, partCount, type Division, type Variation } from './divisions';
import { divisionPartGrid } from './geometry';
import { LINE_WORD, edgeCount, lineDiffers, lineWords, ordinaryEdgeHost, type EdgeHost, type Line } from './lines';
import { ORDINARY_KIND, ORDINARY_NAME, familyOf, familyOfTreated, isDiminutive, ordinaryWithArticle, type OrdinaryMod, type OrdinaryType } from './ordinaries';
import { ORDINARY_LABEL } from './plain-words';
import { contextOf, drawnLayout, isForced, layoutKey, layoutWords, primaryCharges, type LayoutKey } from './arrangement';
import { orientationTerms, turnWords } from './blazon';
import { paintGaps } from './support';
import { paintName, shownSurfaces, type ShownSurfaces } from './tincture-rule';
import { liftStrewn } from './strewn';
import { fieldSurfaces, sameSurface, tinctureSurface, type Surface } from './surface';

export type ChangeKind = 'sc' | 'dc';

const CHANGE_KINDS: readonly ChangeKind[] = ['sc', 'dc'];

/**
 * The SENA section each change comes from (RULES §C.4, §C.5). A5G1b and A5G1d appear for fields of one A5F1b category
 * (a division and its multiple, the lattices): a different direction or style, or a different number of pieces.
 * A5G1e is a fieldless badge set against any other armory, fielded or fieldless.
 */
export const SENA_RULES = ['A5E1', 'A5E2', 'A5E3', 'A5E4', 'A5E5', 'A5F1', 'A5F2', 'A5G1a', 'A5G1b', 'A5G1c', 'A5G1d', 'A5G1e', 'A5G2', 'A5G3', 'A5G4', 'A5G5', 'A5G6', 'A5G7'] as const;
export type SenaRule = (typeof SENA_RULES)[number];

export type DiffAttr =
  | 'fieldless' | 'field-partition' | 'field-style' | 'field-line' | 'field-tincture' | 'primary-presence' | 'group-presence'
  | 'type' | 'number' | 'tincture' | 'arrangement' | 'posture';

const DIFF_ATTRS: readonly DiffAttr[] = [
  'fieldless', 'field-partition', 'field-style', 'field-line', 'field-tincture', 'primary-presence', 'group-presence', 'type', 'number', 'tincture', 'arrangement', 'posture',
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

/**
 * What A5E2 compares: ordinaries by type — a chevron inverted (and chevronels inverted) is a type of its own (A5E5c pairs it with the
 * chevron), a pile inverted is the pile turned (A5G7) — and charges by type class (an eagle and an owl are one class, a lion and a wolf are not).
 * A plain cross couped is the ordinary's type (`AS_ORDINARY`).
 */
function conflictKey(item: Item): string {
  if (item.k === 'charge') return AS_ORDINARY[CHARGES[item.charge].typeClass] ?? `charge:${CHARGES[item.charge].typeClass}`;
  return familyOf(item.type) === 'chevron' && item.mods.includes('inverted') ? 'ordinary:chevron-inverted' : typeKey(item);
}

/**
 * App M1f family 1 (§1.6 T3): a plain cross couped, equal-armed or Latin, is one type with the ordinary cross couped: the same key and
 * type token, couped (`isCouped`). The two are kept as two ways to draw it — herald questions D12, D22.
 */
const AS_ORDINARY: Partial<Record<TypeClass, string>> = { 'cross-couped': 'ordinary:cross' };

/** App M1g (§1.6 T2): a compass star is a mullet of eight points, and a star of eight points or more is a sun as well, so it is a DC from neither — herald question D11. */
const STAR_TOKENS: Partial<Record<ChargeId, readonly string[]>> = { 'compass-star': ['mullet', 'sun'] };

/** App M1g: how many points make a mullet or an estoile a sun as well (Ulrich Michel Schmidt 10/2019). */
const SUN_POINTS = 8;

/**
 * What A5G4 compares within a type class (§1.6 T1): two items differ in type by a DC when their tokens share none. A charge's token is its
 * own type, or the type SENA treats it as (`typeOf`), or one several charges share (`typeToken`: foils and roses by their petals, App
 * M1i); a plain cross couped has the couped ordinary's; a mullet or estoile of eight points or more is a sun as well (§1.6 T2). A demi
 * charge or a head is a type of its own within its beast's class (§1.4 M1, M2: a DC from the whole beast, its cut ignored: M4). An
 * ordinary's is its type.
 */
function typeTokens(item: Item): readonly string[] {
  if (item.k === 'ordinary') return [typeKey(item)];
  const meta = CHARGES[item.charge];
  const asOrdinary = AS_ORDINARY[meta.typeClass];
  if (asOrdinary) return [asOrdinary];
  const own = STAR_TOKENS[item.charge] ?? [meta.typeToken ?? meta.typeOf ?? item.charge];
  const points = item.mods.find((m) => m.id === 'of-points')?.count ?? null;
  const tokens = points !== null && points >= SUN_POINTS ? [...own, 'sun'] : own;
  return item.form ? tokens.map((t) => `${t}:${item.form}`) : tokens;
}

/** A5E2/A5G4: of different classes, or of one class with no type token in common. */
const typesDiffer = (x: Item, y: Item): boolean => conflictKey(x) !== conflictKey(y) || !typeTokens(x).some((t) => typeTokens(y).includes(t));

/**
 * RULES-C §C.3, L9: a quarter is a canton drawn larger, one type for conflict; a tressure is a narrow orle (a single tressure is one, a double
 * tressure differs from it only in number, Prec Gwynaeth 04/2004). A `sinister` form changes no key. A diminutive is its ordinary's type
 * (RULES-C §C.2: bars are fesses; a baton a bend couped, a baton sinister a bend sinister couped).
 */
const ALIKE_TYPE: Partial<Record<OrdinaryType, OrdinaryType>> = { quarter: 'canton', tressure: 'orle' };

/** An item's type as conflict compares it: a charge's own, an ordinary's with the types that are one (a quarter is a canton, a tressure an orle, bars a fess). */
const typeKey = (item: Item): string => (item.k === 'ordinary' ? `ordinary:${ALIKE_TYPE[familyOfTreated(item)] ?? familyOfTreated(item)}` : itemKey(item));

/** A5G6 (RULES-C §C.3, L16): a canton, quarter or gyron against the same in the other top corner, a gore against one from the other side, is a change of its position (a baton sinister is a bend sinister's type: `typeKey`). */
const sidesSwapped = (x: Item, y: Item): boolean => x.k === 'ordinary' && y.k === 'ordinary' && x.type !== 'baton' && y.type !== 'baton' && x.mods.includes('sinister') !== y.mods.includes('sinister');

/** Whether an ordinary is couped: with the treatment, or a baton (a bendlet couped); a charge that is an ordinary's type is that ordinary couped. */
const isCouped = (x: Item): boolean => (x.k === 'ordinary' ? x.mods.includes('couped') || x.type === 'baton' : AS_ORDINARY[CHARGES[x.charge].typeClass] !== undefined);

/** A5G4 (RULES-C §D.2): a couped ordinary against one throughout — the same ordinary otherwise — is a change of its type. */
const coupingDiffers = (x: Item, y: Item): boolean => isCouped(x) !== isCouped(y);

/** A5G7 (RULES-C §D.1, L14): a pile against a pile inverted is a change of orientation. */
const pileTurned = (x: Item, y: Item): boolean =>
  x.k === 'ordinary' && y.k === 'ordinary' && x.type === 'pile' && y.type === 'pile' && x.mods.includes('inverted') !== y.mods.includes('inverted');

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
    // §1.1 F8 (App K): a pair is two charges in fess, whichever way they face.
    case 'pair': return 'line-fess';
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

/** Whether comparable postures lie in different lines of A5G7's table, so that changing one for the other is a distinct change. */
function postureLinesApart({ cls, px, py }: { cls: PostureClass; px: Posture; py: Posture }): boolean {
  const lines = POSTURE_DC_LINES[cls];
  const lx = lines[px] ?? [], ly = lines[py] ?? [];
  return px !== py && !lx.some((l) => ly.includes(l));
}

/**
 * §1.1 F1–F3, F5: whether a group's facing counts for conflict. Not for an owl (`facingCounts: 'never'`), a fish haurient or urinant (its head
 * is up or down), or charges in annulo (F2); a dolphin's counts in every posture (`'always'`, F3). Facing forced by counterchanging (F2,
 * Rœrekr á Úlfhamre 07/2013) is not told apart: herald question D25.
 */
function facingCounts(g: Group): boolean {
  if (g.item.k !== 'charge' || (g.arrangement.k === 'pattern' && g.arrangement.pattern === 'annulo')) return false;
  const meta = CHARGES[g.item.charge];
  const upOrDown = meta.postureClass === 'fish' && (g.item.posture === 'haurient' || g.item.posture === 'urinant');
  return meta.facingCounts === 'always' || (meta.facingCounts === 'normal' && !upOrDown);
}

/**
 * Whether two charges can be posed alike: in postures of one posture class (App M3), or as two heads or two demi charges of beasts that
 * face (§1.1 F5: a head to dexter against one contourny is a DC; a demi charge is read as its beast).
 */
function posedAlike(x: Item, y: Item): boolean {
  if (comparablePostures(x, y) !== null) return true;
  return x.k === 'charge' && y.k === 'charge' && x.form !== null && x.form === y.form && CHARGES[x.charge].faces && CHARGES[y.charge].faces;
}

/**
 * §1.1 F1, F5 (A5G7a, App L1): two charges that can be posed alike facing different ways — to dexter, to sinister (contourny) or affronty
 * (F10). A fish naiant is read by L1d's general clause (herald question D18).
 */
function facingApart(x: Group, y: Group): boolean {
  return posedAlike(x.item, y.item) && x.item.k === 'charge' && y.item.k === 'charge' && x.item.facing !== y.item.facing
    && facingCounts(x) && facingCounts(y);
}

/** How a group of two charges that can face each other stands (§1.1 F6): facing each other (combattant is respectant), back to back, or the same way. */
type PoseClass = 'respectant' | 'addorsed' | 'same';

/** The pose class of a group of two charges that face (heads included); null for any other group. F7: affronty is no group posture. */
function poseClass(g: Group): PoseClass | null {
  if (g.count !== 2 || g.item.k !== 'charge' || !CHARGES[g.item.charge].faces || g.item.facing === 'affronty') return null;
  return g.arrangement.k !== 'pair' ? 'same' : g.arrangement.pair === 'addorsed' ? 'addorsed' : 'respectant';
}

/**
 * §1.1 F6 (A5G7a): two groups of two in different pose classes, whatever their types ("two lions combatant" against "two hawks addorsed"); a
 * pair against the same two both to dexter is read as such a change (herald question D19).
 */
function poseClassesApart(x: Group, y: Group): boolean {
  const cx = poseClass(x), cy = poseClass(y);
  return cx !== null && cy !== null && cx !== cy;
}

/** §1.3: the axis each orientation lies along (a sword palewise and a sword inverted lie along one; to center is a way of its own). */
const ORIENTATION_AXIS: Record<Orientation, 'pale' | 'fess' | 'bend' | 'bend-sinister' | 'to-center'> = {
  palewise: 'pale', inverted: 'pale', reversed: 'pale', fesswise: 'fess', 'fesswise-reversed': 'fess', bendwise: 'bend', 'bendwise-inverted': 'bend',
  'bendwise-sinister': 'bend-sinister', 'bendwise-sinister-inverted': 'bend-sinister', 'to-center': 'to-center',
};

/** §1.3 O9: which way an orientation points; reversed is the drawing mirrored, "an optionally blazonable detail not worth difference". */
const pointing = (o: Orientation): Orientation => (o === 'reversed' ? 'palewise' : o);

/** Charges on a bend lie along it (GoT Table 7): the way a charge with no orientation of its own points on these hosts. */
const FOLLOWED: Partial<Record<OrdinaryType, Orientation>> = { bend: 'bendwise', 'bend-sinister': 'bendwise-sinister' };

/** A group's orientation as conflict reads it: as set, else the way it lies (along the bend it is on, or palewise); null for two crossed. */
function orientationOf(s: Side): Orientation | null {
  if (s.group.item.k !== 'charge' || s.group.arrangement.k === 'crossed') return null;
  const host = s.host?.item;
  return s.group.item.orientation ?? (host?.k === 'ordinary' ? FOLLOWED[host.type] : undefined) ?? 'palewise';
}

/** Whether two groups' charges are of one type: the same class and type tokens. */
const sameType = (x: Item, y: Item): boolean => conflictKey(x) === conflictKey(y) && typeTokens(x).join() === typeTokens(y).join();

const isLong = (item: Item): boolean => item.k === 'charge' && CHARGES[item.charge].orient.cls.startsWith('long-');

/** §1.3 O1 (A5E5b): two primary groups of long charges lying along different axes (to center is a distinct change only, O7). */
function axesApart(x: Side, y: Side): boolean {
  const ox = orientationOf(x), oy = orientationOf(y);
  return ox !== null && oy !== null && isLong(x.group.item) && isLong(y.group.item) && ORIENTATION_AXIS[ox] !== ORIENTATION_AXIS[oy]
    && ox !== 'to-center' && oy !== 'to-center';
}

/**
 * §1.3 O2–O10 (A5G7b, A5G7c, App L2, GoT Table 5): whether two groups point differently enough for a distinct change. Long charges along
 * different axes, whatever their types (O2, O7); along one axis, the same type with ends that differ pointing the other way (O3; a staff or
 * bow, `long-plain`, not: O4, herald question D4). Charges with a top, of one type, pointing another way (O5, O7); leaves only along another
 * axis (O5b, O5c). Never for radial charges, animate charges or charges of different types (O6, O10), nor for reversing (O9).
 */
function orientationsApart(x: Side, y: Side): boolean {
  const ox = orientationOf(x), oy = orientationOf(y), ix = x.group.item, iy = y.group.item;
  if (ox === null || oy === null || ix.k !== 'charge' || iy.k !== 'charge') return false;
  const cx = CHARGES[ix.charge].orient.cls, cy = CHARGES[iy.charge].orient.cls;
  if (isLong(ix) && isLong(iy)) {
    return ORIENTATION_AXIS[ox] !== ORIENTATION_AXIS[oy] || (cx === 'long-ends' && cy === 'long-ends' && sameType(ix, iy) && pointing(ox) !== pointing(oy));
  }
  if (cx !== cy || !sameType(ix, iy)) return false;
  if (cx === 'compact-top') return pointing(ox) !== pointing(oy);
  return cx === 'compact-axis' && ORIENTATION_AXIS[ox] !== ORIENTATION_AXIS[oy];
}

/** Whether two charges that can be posed alike are posed in different lines (a lion rampant and a wolf passant): SENA A3D2c asks the charges of one group to be posed alike. */
export function posturesClash(x: Item, y: Item): boolean {
  const postures = comparablePostures(x, y);
  return postures !== null && postureLinesApart(postures);
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

/** A group's layout as conflict compares it: a pair as the layout it is drawn in (§1.1 F8: facing within a pair is no change of arrangement). */
function layoutOf(s: Side): LayoutKey {
  const ctx = contextOf(s.design, s.group, s.host);
  const layout = { arrangement: s.group.arrangement, position: s.group.position };
  return layoutKey(ctx ? drawnLayout(ctx, layout) : layout);
}

function sidesWhere(d: Design, keep: (g: Group) => boolean): Side[] {
  return d.groups.flatMap((group, i) => (keep(group) ? [{ design: d, path: [i], group, host: null }] : []));
}

/** A5C2: the primary group; two co-primary groups ("a lion and a rose") together are one. */
const primariesOf = (d: Design): Side[] => sidesWhere(d, (g) => g.role === 'primary');

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

/** The surface shown over part `i` of the field, or null where the group doesn't lie. */
const shownAt = (s: ShownSurfaces, i: number): Surface | null => (s.k === 'plain' ? s.surface : s.byPart.get(i) ?? null);

const differs = (a: Surface | null, b: Surface | null): boolean => (a === null || b === null ? a !== b : !sameSurface(a, b));

/**
 * A5G3 (with A5G3a, A5C2d): whether the tinctures a group shows change over at least half of it, compared part of the
 * field by part where a group is counterchanged — "Per pale argent and gules, a lion counterchanged" shows a gules and
 * an argent half, so it differs from the same lion on per pale Or and gules by half the lion.
 */
function tinctureChanged(x: Side, y: Side): boolean {
  // Direction counts for a divided group as for a field (A5G3c): a different division is a change of tincture.
  const [px, py] = [asParty(x.group.paint), asParty(y.group.paint)];
  if (px && py && px.division !== py.division) return true;
  // So is a different number of pieces up to four (A5G3d: "a mullet per chevron … and a mullet chevronelly").
  const [vx, vy] = [asVariation(x.group.paint), asVariation(y.group.paint)];
  if ((px || vx) && (py || vy) && pieceTier(x.group.paint) !== pieceTier(y.group.paint)) return true;
  // So is a different pattern (barry for paly); the same pattern in the same tinctures is none, and nor is swapping the tinctures of
  // more than four pieces (A5G3a: "lions checky argent and azure" and "lions checky azure and argent").
  if (vx && vy) {
    const same = (i: number, j: number) => vx.parts[i].t === vy.parts[j].t;
    return vx.variation !== vy.variation || !(same(0, 0) && same(1, 1) || pieceTier(vx) > 4 && same(0, 1) && same(1, 0));
  }
  const a = shownSurfaces(x.design, x.path), b = shownSurfaces(y.design, y.path);
  if (a.k === 'plain' && b.k === 'plain') return differs(a.surface, b.surface);
  const parts = new Set([...(a.k === 'parts' ? a.byPart.keys() : []), ...(b.k === 'parts' ? b.byPart.keys() : [])]);
  // Counterchanged with nothing to show (an invalid design): compare the paints as written.
  if (parts.size === 0) return a.k !== b.k;
  const changed = [...parts].filter((i) => differs(shownAt(a, i), shownAt(b, i))).length;
  return changed > 0 && changed * 2 >= parts.size;
}

// ── Differences ─────────────────────────────────────────────────────────────

const change = (attr: DiffAttr, kind: ChangeKind, rule: SenaRule, group: GroupRef | null): Diff => ({ attr, kind, rule, group });

/**
 * The A5F1b category of each variation: the stripes of a division fall with it ("barry" with per fess), pily with per pale (an extreme
 * per pale indented), the lattices together, checky on its own.
 */
const VARIATION_CATEGORY: Record<Variation, string> = {
  barry: 'per-fess', paly: 'per-pale', bendy: 'per-bend', 'bendy-sinister': 'per-bend-sinister', chevronny: 'per-chevron', pily: 'per-pale',
  checky: 'checky', lozengy: 'lattice', fusily: 'lattice', 'barry-bendy': 'lattice', 'paly-bendy': 'lattice',
};

/**
 * The divisions in another's category (A5F1b): per chevron throughout is per chevron (Dessa 10/2005); tierced in pale and in fess are per
 * pale and per fess cut once more (SENA is silent: RULES-C §E.1, L11), as paly and barry are.
 */
const DIVISION_CATEGORY: Partial<Record<Division, Division>> = { 'per-chevron-throughout': 'per-chevron', 'tierced-per-pale': 'per-pale', 'tierced-per-fess': 'per-fess' };

/** The partition category of a field (A5F1): plain, or the division; a variation is in the category of the division it multiplies. Null for a fieldless badge, which has no field to compare. */
function partition(d: Design): string | null {
  if (d.kind === 'badge') return null;
  const f = d.field;
  return f.k === 'divided' ? DIVISION_CATEGORY[f.division] ?? f.division : f.k === 'variation' ? VARIATION_CATEGORY[f.variation] : f.k === 'tincture' || f.k === 'fur' || f.k === 'treated' ? 'plain' : notSupported(paintGaps(f, true, 'field')[0]);
}

/** Pieces beyond four are not told apart (A5G1d); a variation with no count, and pily, have more than that. */
const MANY_PIECES = 5;
/** The divisions cut into more pieces than they have parts (tinctures): the rest have as many as their parts (`partCount`). */
const DIVISION_PIECES: Partial<Record<Division, number>> = { quarterly: 4, 'per-saltire': 4, gyronny: MANY_PIECES };

/** How many pieces a field is cut into, up to the count that is no longer told apart (A5G1d). */
function pieceTier(f: Paint): number {
  if (f.k === 'variation') return Math.min(f.pieces ?? MANY_PIECES, MANY_PIECES);
  return f.k === 'divided' ? DIVISION_PIECES[f.division] ?? partCount(f.division) : 1;
}

/** What else tells two fields of one category apart (A5G1b): lozengy and fusily are one, the other lattices and checky their own. */
function styleOf(f: Paint): string {
  return f.k === 'variation' ? (f.variation === 'fusily' ? 'lozengy' : f.variation === 'pily' ? 'per-pale' : f.variation) : '';
}

/** The surfaces a field's tinctures make for comparing, part by part; a variation's are its two tinctures. */
function fieldSurfacesCompared(d: Design): Surface[] {
  const v = d.kind === 'arms' ? asVariation(d.field) : null;
  return v ? v.parts.map((p) => tinctureSurface(p.t)) : fieldSurfaces(d);
}

/**
 * Both fields' surfaces, part by part. When either field has more than four pieces its two tinctures may be either way round (A5G1a:
 * "There is not a distinct change for swapping the tinctures of a field divided into more than four parts"; Prec #FIELDCheck), so the
 * second field's are turned where that pairs more of them with the first's: "Per fess azure and argent" against "Barry argent and
 * azure" and against "Barry azure and argent" alike changes the number of pieces only (A5G1d).
 */
function comparedSurfaces(a: Design, b: Design, swappable: boolean): [Surface[], Surface[]] {
  const ta = fieldSurfacesCompared(a), tb = fieldSurfacesCompared(b);
  if (!swappable || ta.length !== 2 || tb.length !== 2) return [ta, tb];
  const paired = (ys: readonly Surface[]) => ta.filter((s, i) => sameSurface(s, ys[i])).length;
  const turned = [tb[1], tb[0]];
  return [ta, paired(turned) > paired(tb) ? turned : tb];
}

/**
 * The lines of a field's partition, as A5G1c weighs them: quarterly's per pale and per fess lines, the one line of any other division
 * (per saltire's two are styled together), the one line every stripe of a variation is drawn with; none for a plain field or a grid.
 */
function partitionLines(f: Paint): Line[] {
  if (f.k === 'divided') return f.division === 'quarterly' ? [f.lines.a, f.lines.b] : [f.lines.a];
  return f.k === 'variation' && isCountedVariation(f.variation) ? [f.lines.a] : [];
}

/**
 * A5G1c: whether at least half the partition lines change style, as SENA App M2 groups them ("Per pale is a DC from Per pale embattled";
 * "Quarterly is a DC from Quarterly per fess indented"). Fields of one partition category have as many lines; a line change is never
 * substantial (RULES-C §B.2).
 */
function lineStyleChanged(a: Paint, b: Paint): boolean {
  const la = partitionLines(a), lb = partitionLines(b);
  const n = Math.max(la.length, lb.length);
  const changed = Array.from({ length: n }, (_, i) => lineDiffers(la[i] ?? 'plain', lb[i] ?? 'plain', false)).filter(Boolean).length;
  return changed > 0 && changed * 2 >= n;
}

const inThree = (f: Paint): boolean => f.k === 'divided' && partCount(f.division) === 3;

/** The share of the heater's area whose surface differs between two divided fields (each with its parts' surfaces), or null when either is not divided. */
function changedShare(a: Paint, ta: readonly Surface[], b: Paint, tb: readonly Surface[]): number | null {
  if (a.k !== 'divided' || b.k !== 'divided') return null;
  const ga = divisionPartGrid(a.division, a.pieces), gb = divisionPartGrid(b.division, b.pieces);
  return ga.filter((part, i) => !sameSurface(ta[part], tb[gb[i]])).length / ga.length;
}

function fieldChanges(a: Design, b: Design): Diff[] {
  // A5G1e: fieldless armory has no field to compare, and "automatically has one distinct change (DC) from any other armory,
  // fielded or fieldless" ("(Fieldless) A mullet purpure" against "(Fieldless) A mullet of six points purpure").
  if (a.kind === 'badge' || b.kind === 'badge') return [change('fieldless', 'dc', 'A5G1e', null)];
  if (partition(a) !== partition(b)) return [change('field-partition', 'sc', 'A5F1', null)];
  const changes: Diff[] = [];
  // A different number of pieces (A5G1d) or a different style within the category (A5G1b) is a distinct change.
  if (pieceTier(a.field) !== pieceTier(b.field)) changes.push(change('field-style', 'dc', 'A5G1d', null));
  else if (styleOf(a.field) !== styleOf(b.field)) changes.push(change('field-style', 'dc', 'A5G1b', null));
  if (lineStyleChanged(a.field, b.field)) changes.push(change('field-line', 'dc', 'A5G1c', null));
  const [ta, tb] = comparedSurfaces(a, b, Math.max(pieceTier(a.field), pieceTier(b.field)) > 4);
  const has = (xs: readonly Surface[], s: Surface) => xs.some((x) => sameSurface(x, s));
  if (ta.length === tb.length && ta.every((s, i) => sameSurface(s, tb[i]))) return changes;
  // A field divided in three changes its tincture only where at least half its area does (A5G1a; RULES-C §E.2): one part of three is not enough.
  if (inThree(a.field) || inThree(b.field)) {
    const changed = changedShare(a.field, ta, b.field, tb);
    if (changed !== null && changed < 0.5) return changes;
  }
  // A5F2: for field-primary armory a change of every part to a surface (a tincture or fur) the other field lacks is substantial.
  const substantial = isFieldPrimary(a) && isFieldPrimary(b)
    && ta.length === tb.length && ta.every((s, i) => !sameSurface(s, tb[i])) && ta.some((s) => !has(tb, s)) && tb.some((s) => !has(ta, s));
  return [...changes, substantial ? change('field-tincture', 'sc', 'A5F2', null) : change('field-tincture', 'dc', 'A5G1a', null)];
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
    // §1.1 F10 (A5E5a): a beast affronty is a line of its own.
    const affronty = postures.cls === 'quadruped' && x.group.item.k === 'charge' && y.group.item.k === 'charge'
      && (x.group.item.facing === 'affronty') !== (y.group.item.facing === 'affronty');
    if ((lx !== undefined && ly !== undefined && lx !== ly) || affronty) out.push(change('posture', 'sc', 'A5E5', ref));
  } else if (axesApart(x, y)) out.push(change('posture', 'sc', 'A5E5', ref));
  return out;
}

/**
 * The substantial changes between primary groups that are one group of two (co-primaries): they differ in type only when they share no type
 * (a lion and a rose against a lion and a wolf share the lion), and in number by the total.
 */
function pooledPrimaryChanges(xs: readonly Side[], ys: readonly Side[]): Diff[] {
  const ref = refOf(xs[0], ys[0]);
  const out: Diff[] = [];
  const typesOf = (side: readonly Side[]) => new Set(side.map((s) => conflictKey(s.group.item)));
  const theirs = typesOf(ys);
  if (![...typesOf(xs)].some((k) => theirs.has(k))) out.push(change('type', 'sc', 'A5E2', ref));
  const total = (side: readonly Side[]) => side.reduce((n, s) => n + s.group.count, 0);
  if (countCategory(total(xs)) !== countCategory(total(ys))) out.push(change('number', 'sc', 'A5E3', ref));
  const [x, y] = [xs[0], ys[0]];
  const gx = arrangementGroup(x.group), gy = arrangementGroup(y.group);
  if (gx !== null && gy !== null && gx !== gy && !isForced(x.design, x.path) && !isForced(y.design, y.path)) out.push(change('arrangement', 'sc', 'A5E4', ref));
  return out;
}

/** The substantial and distinct changes between two primary groups, each of one group or of two co-primary groups (a distinct change counts once however many pairs show it). */
function primaryGroupChanges(xs: readonly Side[], ys: readonly Side[]): Diff[] {
  const substantial = xs.length === 1 && ys.length === 1 ? primaryChanges(xs[0], ys[0]) : pooledPrimaryChanges(xs, ys);
  const skip = new Set(substantial.map((c) => c.attr));
  const distinct = pairUp(xs, ys).pairs.flatMap(([x, y]) => groupChanges(x, y, skip));
  const seen = new Set<DiffAttr>();
  return [...substantial, ...distinct.filter((c) => !seen.has(c.attr) && !!seen.add(c.attr))];
}

/** The host of an ordinary's lines; null for a charge. */
const edgeHostOf = (i: Item): EdgeHost | null => (i.k === 'ordinary' ? ordinaryEdgeHost(i) : null);

/**
 * A5G4: the edges of two ordinaries of one type differ — compared edge by edge ("a fess embattled" against "a fess embattled
 * counter-embattled" differs on the lower edge), a line against a line of another group of App M2 (RULES-C §B.3).
 */
function edgesDiffer(x: Item, y: Item): boolean {
  const host = edgeHostOf(x);
  if (host === null || x.k !== 'ordinary' || y.k !== 'ordinary' || typeKey(x) !== typeKey(y)) return false;
  const [lx, ly] = [canonicalLines(host, x.lines), canonicalLines(host, y.lines)];
  const twoSided = edgeCount(host) === 2;
  return lineDiffers(lx.a, ly.a, twoSided) || lineDiffers(lx.b, ly.b, twoSided);
}

/** How many a group counts as for A5G5: flaunches are always a pair ("two DCs between Argent, a chief azure and Argent, flaunches azure", SENA A5G5). */
const numberOf = (g: Group): number => (g.item.k === 'ordinary' && g.item.type === 'flaunches' ? 2 : g.count);

/** A5G3–A5G7: at most one distinct change per attribute of a pair of groups; `skip` holds attributes already substantial. */
function groupChanges(x: Side, y: Side, skip: ReadonlySet<DiffAttr>): Diff[] {
  const ref = refOf(x, y);
  const out: Diff[] = [];
  const dc = (attr: DiffAttr, rule: SenaRule) => { if (!skip.has(attr)) out.push(change(attr, 'dc', rule, ref)); };
  const gx = x.group, gy = y.group;
  // The in-splendour mod of a sun is an artistic detail (RULES §C.3) and is not looked at.
  // A change of an ordinary's edge, or couping it, is a change of its type: with a change of type, one change (RULES-C §B.3, §D.2); a chevron
  // against a chevron inverted, substantial between primaries, is a distinct change elsewhere (A5G). Enhanced and abased are artistic (§D.6).
  if (typesDiffer(gx.item, gy.item) || edgesDiffer(gx.item, gy.item) || coupingDiffers(gx.item, gy.item)) dc('type', 'A5G4');
  if (countCategoryFine(numberOf(gx)) !== countCategoryFine(numberOf(gy))) dc('number', 'A5G5');
  if (tinctureChanged(x, y)) dc('tincture', 'A5G3');
  const kx = layoutOf(x), ky = layoutOf(y);
  // Secondary groups set around the primary and beside it ("between three mullets" / "and in chief three mullets") stand in different places.
  const moved = gx.role === 'secondary' && gy.role === 'secondary' && gx.relation !== gy.relation;
  // A badge has no field to place its charges on: "placement on the field doesn't count when comparing fielded armory to a
  // fieldless badge" (LoAR 08/2006, Havre de Glace), and the position decides how charges in chief or base are set.
  const placedOnField = (x.design.kind === 'badge') !== (y.design.kind === 'badge') && (gx.position !== null || gy.position !== null);
  if (moved || sidesSwapped(gx.item, gy.item) || (kx !== ky && !placedOnField && !isForced(x.design, x.path) && !isForced(y.design, y.path)
    && (gx.count === gy.count || (appK(gy.count).includes(kx) && appK(gx.count).includes(ky))))) {
    dc('arrangement', 'A5G6');
  }
  // §1.1 F9: posture, facing, the pose of a pair and orientation together give at most one distinct change.
  if (posesApart(gx, gy) || orientationsApart(x, y)) dc('posture', 'A5G7');
  return out;
}

/** A5G7: postures in different lines, facings or pair poses that differ (§1.1 F1–F6), or a pile against a pile inverted. */
function posesApart(x: Group, y: Group): boolean {
  const postures = comparablePostures(x.item, y.item);
  return (postures !== null && postureLinesApart(postures)) || facingApart(x, y) || poseClassesApart(x, y) || pileTurned(x.item, y.item);
}

/** Why two groups' poses differ by a distinct change, in words: the posture first, then a pair's pose, the facing, then the orientation. */
function poseSentence(x: Group, y: Group): string {
  const postures = comparablePostures(x.item, y.item);
  if ((postures !== null && postureLinesApart(postures)) || pileTurned(x.item, y.item)) return 'A different pose is a distinct change';
  const plural = x.item.k === 'charge' ? CHARGES[x.item.charge].plural : itemName(x.item);
  if (poseClassesApart(x, y)) return `Turning the two ${plural} to face each other, back to back or the same way is a distinct change`;
  if (facingApart(x, y)) return `Turning ${itemPhrase(x.item)} to face the other way is a distinct change`;
  return `Pointing the ${plural} another way is a distinct change`;
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

// ── Cotises and readings ────────────────────────────────────────────────────

/** Whether a group is an ordinary's cotises lifted into a group of their own (`liftCotises`): ordinaries set between a primary ordinary of their type. */
const isCotiseGroup = (d: Design, g: Group): boolean =>
  g.item.k === 'ordinary' && g.role === 'secondary' && g.relation === 'between'
  && d.groups.some((p) => p.role === 'primary' && p.item.k === 'ordinary' && g.item.k === 'ordinary' && p.item.type === g.item.type);

/**
 * The design with each ordinary's cotises as the secondary group they are (SENA App I2c; RULES-C §B.4): ordinaries of its type, one per
 * pair of cotises, in their tincture, their edges in their line (so that presence, number, tincture and line each count as for a group:
 * A5G2, A5G5, A5G3, A5G4), and the ordinary without them.
 */
export function liftCotises(d: Design): Design {
  if (!d.groups.some((g) => g.item.k === 'ordinary' && g.item.cotised)) return d;
  const groups = d.groups.flatMap((g): Group[] => {
    if (g.item.k !== 'ordinary' || !g.item.cotised) return [g];
    const { count, paint, line } = g.item.cotised;
    const cotises: Group = {
      role: 'secondary', relation: 'between', item: { k: 'ordinary', type: g.item.type, lines: { a: line, b: line }, mods: [], cotised: null, fimbriated: null },
      count, arrangement: { k: 'host' }, position: null, paint, charged: [],
    };
    return [{ ...g, item: { ...g.item, cotised: null } }, cotises];
  });
  return canonical({ ...d, groups });
}

/** The variation three or more of each diminutive's ordinary make: bars barry, pallets paly, bendlets bendy, chevronels chevronny (RULES-C §C.2). */
const STRIPES_OF: Partial<Record<OrdinaryType, Variation>> = { fess: 'barry', pale: 'paly', bend: 'bendy', 'bend-sinister': 'bendy-sinister', chevron: 'chevronny' };

/**
 * A design whose only main or overall group is three or more identical diminutives, upright, in their place, on a plain field (nothing on
 * them, nothing around them; peripherals beside them stay), read as the field striped that way: "three fesses must also be considered as
 * barry … whenever armory uses three or more identical ordinaries" (SENA A5C1; RULES-C §C.2) — "Gules, three bars Or" as barry of seven Or and
 * gules, its stripes with the bars' line. Null for any other design (two are never a variation).
 */
function asStripes(d: Design): Design | null {
  if (d.kind !== 'arms' || d.field.k !== 'tincture') return null;
  const central = d.groups.filter((g) => g.role !== 'peripheral');
  const g = central[0];
  if (central.length !== 1 || g.role !== 'primary' || g.item.k !== 'ordinary' || !isDiminutive(g.item.type) || g.count < 3 || g.charged.length > 0) return null;
  const { item } = g;
  const variation = STRIPES_OF[familyOf(item.type)];
  if (!variation || item.mods.length > 0 || item.lines.a !== item.lines.b || g.paint.k !== 'tincture') return null;
  const field: Paint = { k: 'variation', variation, lines: { a: item.lines.a, b: item.lines.a }, pieces: 2 * g.count + 1, parts: [d.field, g.paint] };
  return canonical({ ...d, field, groups: d.groups.filter((x) => x !== g) });
}

/** Whether a group is a pile inverted throughout alone, plain, with nothing on it: the shape the second part of a per chevron throughout makes (RULES-C §E.1). */
const isThroughoutPile = (g: Group): boolean =>
  g.role === 'primary' && g.item.k === 'ordinary' && g.item.type === 'pile' && g.item.mods.length === 2 && g.item.mods.includes('inverted') && g.item.mods.includes('throughout')
  && g.item.lines.a === g.item.lines.b && g.item.cotised === null && g.item.fimbriated === null && g.count === 1 && g.charged.length === 0 && g.paint.k === 'tincture';

/**
 * A per chevron throughout field as "A, a pile inverted throughout B" (its second part, the pile, in the line), and a pile inverted throughout
 * on a plain field as the per chevron throughout field it makes ("Per chevron throughout A and B" is also read that way: SENA A5G1b;
 * Freydis Orkneyska 04/2006). Peripherals beside them stay (as in `asStripes`). Null for any design with another main or overall group.
 */
function asThroughoutOther(d: Design): Design | null {
  if (d.kind !== 'arms') return null;
  const central = d.groups.filter((g) => g.role !== 'peripheral');
  if (d.field.k === 'divided' && d.field.division === 'per-chevron-throughout' && central.length === 0 && d.field.parts.every((p) => p.k === 'tincture')) {
    const { lines, parts } = d.field;
    const pile: Item = { k: 'ordinary', type: 'pile', lines: { a: lines.a, b: lines.a }, mods: ['inverted', 'throughout'], cotised: null, fimbriated: null };
    const group: Group = { role: 'primary', relation: null, item: pile, count: 1, arrangement: { k: 'single' }, position: null, paint: parts[1], charged: [] };
    return canonical({ ...d, field: parts[0], groups: [group, ...d.groups] });
  }
  const [g] = central;
  if (d.field.k !== 'tincture' || central.length !== 1 || !isThroughoutPile(g) || g.item.k !== 'ordinary') return null;
  const line = g.item.lines.a;
  const field: Paint = { k: 'divided', division: 'per-chevron-throughout', lines: { a: line, b: line }, pieces: null, parts: [d.field, g.paint] };
  return canonical({ ...d, field, groups: d.groups.filter((x) => x !== g) });
}

/** How an item is voided and fimbriated (`fimbriation` its paint), and the item without either. */
function outlineOf(item: Item): { voided: boolean; fimbriation: Paint | null; plain: Item } {
  if (item.k === 'ordinary') return { voided: item.mods.includes('voided'), fimbriation: item.fimbriated, plain: { ...item, mods: item.mods.filter((m) => m !== 'voided'), fimbriated: null } };
  return { voided: isVoided(item), fimbriation: fimbriationOf(item), plain: { ...item, mods: item.mods.filter((m) => m.id !== 'voided' && m.id !== 'fimbriated') } };
}

/**
 * The ways conflict reads a design (SENA A5C1; RULES-C §C.2, §D.3, §D.4; §1.4 M8, M9), each to be compared, the least different taken: a
 * voided primary ordinary or charge as the item with one of its shape in the field's tincture on it, and as the item of the field's
 * tincture fimbriated (the fimbriation worth nothing); a fimbriated one as the item alone, and as one of the fimbriation's tincture with the
 * item on it (not when something lies on it already: that would make quaternaries); three or more diminutives also as the variation
 * (`asStripes`). Every other design is read as it is.
 */
function readings(d: Design): Design[] {
  const stripes = asStripes(d);
  if (stripes) return [d, stripes];
  const throughout = asThroughoutOther(d);
  if (throughout) return [d, throughout];
  const i = d.groups.findIndex((g) => g.role === 'primary' && (outlineOf(g.item).voided || outlineOf(g.item).fimbriation !== null));
  const g = d.groups[i];
  if (!g) return [d];
  const { voided, fimbriation, plain: item } = outlineOf(g.item);
  const on = (paint: Paint): Group => ({ role: 'tertiary', relation: null, item, count: 1, arrangement: { k: 'single' }, position: null, paint, charged: [] });
  const read = (group: Group) => canonical({ ...d, groups: d.groups.map((x, j) => (j === i ? group : x)) });
  const unloaded = g.charged.length === 0;
  if (voided) {
    if (d.kind !== 'arms') return [d];
    return [...(unloaded ? [read({ ...g, item, charged: [on(d.field)] })] : []), read({ ...g, item, paint: d.field })];
  }
  return [read({ ...g, item }), ...(fimbriation && unloaded ? [read({ ...g, item, paint: fimbriation, charged: [on(g.paint)] })] : [])];
}

/** A design as conflict compares it: its semys and cotises as groups, in each of its readings. */
const conflictReadings = (d: Design): Design[] => readings(liftCotises(liftStrewn(d)));

/** The least of some lists of changes: the fewest substantial changes, then the fewest distinct ones (the first of equals). */
function least(options: readonly Diff[][]): Diff[] {
  const score = (ds: readonly Diff[]) => ds.filter((x) => x.kind === 'sc').length * 1000 + ds.length;
  return options.reduce((best, ds) => (score(ds) < score(best) ? ds : best));
}

/** The readings of two designs whose comparison gave `diffs` (the first pair when none did): what the groups of a diff are paths into. */
function readingsCompared(rawA: Design, rawB: Design, diffs: readonly Diff[]): [Design, Design] {
  const as = conflictReadings(rawA), bs = conflictReadings(rawB);
  const pairs = as.flatMap((a) => bs.map((b): [Design, Design] => [a, b]));
  if (pairs.length === 1) return pairs[0];
  const key = JSON.stringify(diffs);
  return pairs.find(([a, b]) => JSON.stringify(compare(a, b)) === key) ?? pairs[0];
}

/**
 * Every SC and DC between two designs (RULES §C.8 `diff`), in field, primary, secondary order. Their semys and cotises are groups (A5C2b;
 * strewn.ts, `liftCotises`), so the groups of a diff are those of the designs so stated; a voided or fimbriated design is compared in each
 * of its readings and the least different pair counts.
 */
export function differences(rawA: Design, rawB: Design): Diff[] {
  const as = conflictReadings(rawA), bs = conflictReadings(rawB);
  return least(as.flatMap((a) => bs.map((b) => compare(a, b))));
}

/** Every SC and DC between two designs as stated for conflict. */
function compare(a: Design, b: Design): Diff[] {
  const out: Diff[] = fieldChanges(a, b);

  const pa = primariesOf(a), pb = primariesOf(b);
  if (pa.length > 0 && pb.length > 0) {
    out.push(...primaryGroupChanges(pa, pb));
  } else if (pa.length > 0) {
    out.push(change('primary-presence', 'sc', 'A5E1', refOf(pa[0], null)));
  } else if (pb.length > 0) {
    out.push(change('primary-presence', 'sc', 'A5E1', refOf(null, pb[0])));
  }
  out.push(...tertiaryChanges(pa[0] ?? null, pb[0] ?? null));

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
 * (A5E2) is always a substantial change; so is the type of the one group of charges that is the primary. A primary
 * of two groups ("a lion and a rose") is one group of both types, so it keys `MIXED_PRIMARY` and is looked up by
 * `keysMayConflict`. A fieldless badge has no partition (null): without a field it differs from armory with one by a
 * distinct change only (A5G1e), so it may conflict with any partition. Everything else is decided by `checkUnique` on the candidates, so looking a registry up by this
 * key returns every entry that matters.
 */
export interface CandidateKey { partition: string | null; primary: string | null }

/** The primary of a design with two co-primary groups: they may share a type with entries of any primary. */
export const MIXED_PRIMARY = '*';

/**
 * The primary of a design that conflict also reads with another partition and primary (`asStripes`: three bars are barry, with no primary;
 * `asThroughoutOther`: a pile inverted throughout is per chevron throughout, and back): it may conflict with entries of any primary, or none,
 * and (its partition null) of any partition. Such a design is checked against the whole registry (the key index is not used for it: a
 * full scan per check), which is the price of one key per design; they are few (three or more diminutives, a per chevron throughout field).
 */
export const ANY_PRIMARY = '**';

export function candidateKey(raw: Design): CandidateKey {
  const d = liftStrewn(raw);
  if (asStripes(d) || asThroughoutOther(d)) return { partition: null, primary: ANY_PRIMARY };
  const primaries = primaryGroups(d);
  const primary = primaries.length === 0 ? null : primaries.length === 1 ? conflictKey(primaries[0].group.item) : MIXED_PRIMARY;
  return { partition: partition(d), primary };
}

/**
 * Whether entries with these keys can be too close: the one rule the registry lookup follows. A design with two primary groups may share a
 * type with any entry that has a primary; one read as stripes too (`ANY_PRIMARY`) with any entry at all.
 */
export function keysMayConflict(a: CandidateKey, b: CandidateKey): boolean {
  const primaries = a.primary === b.primary || a.primary === ANY_PRIMARY || b.primary === ANY_PRIMARY
    || (a.primary !== null && b.primary !== null && (a.primary === MIXED_PRIMARY || b.primary === MIXED_PRIMARY));
  return (a.partition === b.partition || a.partition === null || b.partition === null) && primaries;
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

const partitionWord = (d: Design): string => (d.kind === 'badge' ? 'none' : d.field.k === 'divided' ? DIVISION_NAME[d.field.division] : d.field.k === 'variation' ? VARIATION_NAME[d.field.variation] : 'plain');
/** A field's partition lines in words: "straight", "wavy", "straight and embattled" (quarterly's two). */
const partitionLineWords = (d: Design): string => (d.kind === 'badge' ? 'none' : [...new Set(partitionLines(d.field).map((l) => (l === 'plain' ? 'straight' : LINE_WORD[l])))].join(' and ') || 'none');
const itemPhrase = (i: Item): string => (i.k === 'ordinary' ? ordinaryWithArticle(i.type) : `${CHARGES[i.charge].article} ${CHARGES[i.charge].name}`);

/** What the builder calls a group in the middle of a sentence: "band or shape", "top bar", "pictures beside the band". */
function groupNoun(d: Design, path: GroupPath): { one: string; many: string } {
  const group = groupAt(d, path), host = hostOf(d, path);
  if (group.item.k === 'ordinary') {
    const type = group.item.type;
    const noun = isCotiseGroup(d, group) ? 'cotises' : ORDINARY_KIND[type] === 'central' ? 'band or shape' : ORDINARY_LABEL[type].plain.toLowerCase();
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
export function explainDifferences(rawA: Design, rawB: Design, diffs: readonly Diff[] = differences(rawA, rawB)): DifferenceNote[] {
  const [a, b] = readingsCompared(rawA, rawB, diffs);
  return diffs.map((diff) => {
    const ref = diff.group;
    const ga = ref?.a ? groupAt(a, ref.a) : null, gb = ref?.b ? groupAt(b, ref.b) : null;
    const nounA = ref?.a ? groupNoun(a, ref.a) : null, nounB = ref?.b ? groupNoun(b, ref.b) : null;
    const noun = () => nounA ?? nounB ?? noGroup(diff.attr);
    /** The two groups a change between a pair is about. */
    const both = () => (ga && gb && nounA && nounB ? { ga, gb, nounA, nounB } : noGroup(diff.attr));
    const pair = (label: string, x: string, y: string) => `${label} (${x} ↔ ${y})`;
    // cotises by how many a side
    const itemOrNone = (d: Design, g: Group | null) => (!g ? 'none' : isCotiseGroup(d, g) ? `${g.count} a side` : g.item.k === 'ordinary' ? ORDINARY_NAME[g.item.type] : CHARGES[g.item.charge].plural);
    const tinctureWord = (g: Group) => (g.paint.k === 'counterchanged' ? 'counterchanged' : paintName(g.paint));
    const fieldWord = (d: Design) => (d.kind === 'arms' && d.field.k === 'variation' ? d.field.parts.map(paintName).join('/') : fieldParts(d).map(paintName).join('/'));
    const postureWord = (g: Group) => {
      const i = g.item;
      if (i.k === 'ordinary') return i.mods.includes('inverted') ? 'inverted' : 'upright';
      const words = [...(i.posture ? [postureTerm(i.charge, i.posture)] : []), ...turnWords(i), ...orientationTerms(i), ...(g.arrangement.k === 'pair' ? [g.arrangement.pair] : [])];
      return words.join(' ') || 'none';
    };

    let text: string;
    let sentence: string;
    switch (diff.attr) {
      case 'fieldless':
        text = pair('background', partitionWord(a), partitionWord(b));
        sentence = a.kind === 'badge' && b.kind === 'badge'
          ? 'A design with no background always counts one distinct change, even against another with none'
          : 'No background counts as one distinct change';
        break;
      case 'field-partition': {
        text = pair('background split', partitionWord(a), partitionWord(b));
        sentence = 'Splitting the background a different way, or splitting it instead of leaving it plain, is a substantial change';
        break;
      }
      case 'field-style':
        text = pair('background pattern', partitionWord(a), partitionWord(b));
        sentence = diff.rule === 'A5G1d'
          ? 'Backgrounds cut into up to four pieces are told apart by their number of pieces, so a different number is a distinct change'
          : 'A different pattern of the same kind of background (for example barry bendy and paly bendy) is a distinct change';
        break;
      case 'field-line':
        text = pair('line of division', partitionLineWords(a), partitionLineWords(b));
        sentence = 'Changing the style of at least half the lines that split the background — from straight to wavy, say — is a distinct change';
        break;
      case 'field-tincture':
        text = pair('background colour', fieldWord(a), fieldWord(b));
        sentence = diff.kind === 'sc'
          ? 'When the background is the main feature, changing every part to a colour the other background lacks is a substantial change'
          : 'Changing the colours of at least half the background — or swapping them — is a distinct change';
        break;
      case 'primary-presence':
      case 'group-presence':
        text = pair(noun().many, itemOrNone(a, ga), itemOrNone(b, gb));
        sentence = diff.attr === 'primary-presence'
          ? 'Adding or taking away the main band or picture is a substantial change'
          : 'Adding or taking away a group of pictures or a band is one distinct change';
        break;
      case 'type': {
        const s = both();
        const bothBands = s.ga.item.k === 'ordinary' && s.gb.item.k === 'ordinary';
        const label = bothBands ? (s.nounA.one === s.nounB.one ? s.nounA.one : 'band or shape') : s.ga.item.k === s.gb.item.k ? noun().one : 'picture or band';
        const edged = (i: Item) => { const host = edgeHostOf(i); return host && i.k === 'ordinary' ? lineWords(host, i.lines) || 'straight' : ''; };
        if (typeKey(s.ga.item) === typeKey(s.gb.item) && edgesDiffer(s.ga.item, s.gb.item)) {
          text = pair(`edge of ${s.nounA.one}`, edged(s.ga.item), edged(s.gb.item));
          sentence = isCotiseGroup(a, s.ga)
            ? 'Changing the edge of the cotises — from straight to wavy, say — changes their type: a distinct change'
            : `Changing the edge of ${itemPhrase(s.ga.item)} — from straight to embattled, say — changes its type: a distinct change`;
          break;
        }
        if (typeKey(s.ga.item) === typeKey(s.gb.item)) {
          // the treatments that differ, as each has them
          const has = (i: Item, m: OrdinaryMod) => (m === 'couped' ? isCouped(i) : i.k === 'ordinary' && i.mods.includes(m));
          const shown = (['inverted', 'couped'] as const).filter((m) => has(s.ga.item, m) !== has(s.gb.item, m));
          const form = (i: Item) => shown.map((m) => (m === 'inverted' ? (has(i, m) ? 'inverted' : 'upright') : has(i, m) ? 'couped' : 'throughout')).join(', ');
          text = pair(`form of ${itemName(s.ga.item)}`, form(s.ga.item), form(s.gb.item));
          sentence = diff.kind === 'sc'
            ? `${capitalise(itemPhrase(s.ga.item))} and the same turned upside down are different types — a substantial change`
            : `Shortening ${itemPhrase(s.ga.item)} (couping it), or turning it upside down, changes its type: a distinct change`;
          break;
        }
        // a baton sinister is the other type of baton (`typeKey`)
        const typeName = (i: Item) => `${itemName(i)}${i.k === 'ordinary' && i.type === 'baton' && i.mods.includes('sinister') ? ' sinister' : ''}`;
        text = pair(label, typeName(s.ga.item), typeName(s.gb.item));
        sentence = diff.kind === 'sc'
          ? 'Changing every main picture or band to something unrelated is a substantial change'
          : `${capitalise(itemPhrase(s.ga.item))} and ${itemPhrase(s.gb.item)} are different types — a distinct change`;
        break;
      }
      case 'number':
        text = pair(`number of ${noun().many}`, String(numberOf(both().ga)), String(numberOf(both().gb)));
        sentence = diff.kind === 'sc'
          ? 'The number of main pictures falls in a different group (1, 2, 3, or 4 and more) — a substantial change'
          : 'A different number (1, 2, 3, 4, 5, or 6 and more) is a distinct change';
        break;
      case 'tincture':
        text = pair(`colour of ${noun().many}`, tinctureWord(both().ga), tinctureWord(both().gb));
        sentence = 'Changing the colour of a group is a distinct change';
        break;
      case 'arrangement':
        if (sidesSwapped(both().ga.item, both().gb.item)) {
          // a gore issues from a side; the others lie in a top corner
          const { item } = both().ga;
          const side = item.k === 'ordinary' && item.type === 'gore';
          const corner = (g: Group) => `${side ? '' : 'top '}${g.item.k === 'ordinary' && g.item.mods.includes('sinister') ? 'right' : 'left'}${side ? ' side' : ''}`;
          text = pair(`position of ${noun().one}`, corner(both().ga), corner(both().gb));
          sentence = `Moving ${itemPhrase(both().ga.item)} to the other ${side ? 'side' : 'top corner'} is a distinct change`;
          break;
        }
        text = pair(`arrangement of ${noun().many}`, layoutWords({ arrangement: both().ga.arrangement, position: both().ga.position }), layoutWords({ arrangement: both().gb.arrangement, position: both().gb.position }));
        sentence = diff.kind === 'sc'
          ? 'These arrangements look substantially different — a substantial change'
          : 'A different arrangement is a distinct change, unless the design forces it';
        break;
      case 'posture':
        text = pair(`pose of ${noun().one}`, postureWord(both().ga), postureWord(both().gb));
        sentence = diff.kind === 'sc' ? 'These poses are substantially different — a substantial change' : poseSentence(both().ga, both().gb);
        break;
    }
    return { attr: diff.attr, kind: diff.kind, rule: diff.rule, text, why: `${sentence} (SENA ${diff.rule}).`, item: ref?.item ?? null };
  });
}
