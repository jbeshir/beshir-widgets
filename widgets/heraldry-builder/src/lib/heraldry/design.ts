// The design model: a field (a recursive paint) and a list of charge groups, each carrying an ordinary
// or a charge and, in `charged`, the group sitting on it. Tree helpers, canonical form and issue types.
// Parsing untrusted input is resolve.ts; what the builder draws is support.ts.

import { FUR_SPEC, TINCTURES, isTincture, type Stain, type Fur, type Tincture } from './tinctures';
import { divisionPieces, variationPieces, type Division, type Treatment, type Variation } from './divisions';
import { canonicalFur, furColours } from './fur';
import type { OrdinaryMod, OrdinaryType } from './ordinaries';
import { edgeCount, ordinaryEdgeHost, type EdgeHost, type Line } from './lines';
import {
  CHARGES, CUT_MODIFIERS, HOLD_HOWS, MODIFIER_IDS, PART_IDS, drawnPoints,
  type ChargeForm, type ChargeId, type Facing, type Gaze, type HoldHow, type ModifierId, type Orientation, type PartId, type Posture,
} from './charges';
import { DIMINUTIVE_OF, ORDINARY_MODS, ORDINARY_NAME, PERIPHERAL_ORDER, SAME_ORDINARY } from './ordinaries';

/**
 * Edge lines, with blazon meaning (RULES-C §0; the edge table is lines.ts `edgeCount`): on a fess-, bend- or chevron-like band `a` is
 * the upper edge and `b` the lower; on a pale or pallet dexter and sinister; on an orle or tressure outer and inner; on quarterly
 * the per pale and the per fess line. Every other host has one line (`b` is `a`) or none (both plain). A bare line is read by
 * `bareLines`: "a fess embattled" is `{embattled, plain}`.
 */
export interface Lines { a: Line; b: Line }

export const PLAIN_LINES: Lines = Object.freeze({ a: 'plain', b: 'plain' });

export type Paint =
  | { k: 'tincture'; t: Tincture }
  | { k: 'stain'; stain: Stain }
  | { k: 'fur'; fur: Fur; colours: [Tincture, Tincture] | null }            // "vairy Or and gules"
  | { k: 'divided'; division: Division; lines: Lines; pieces: number | null; parts: Paint[] } // quarterly: 2 alternating parts
  | { k: 'variation'; variation: Variation; lines: Lines; pieces: number | null; parts: [Paint, Paint] }
  | { k: 'treated'; treatment: Treatment; ground: Paint; ink: Tincture }
  | { k: 'semy'; ground: Paint; charge: ChargeRef; ink: Paint }
  | { k: 'proper' }
  | { k: 'counterchanged' };                                               // groups only, over a divided ground

export interface ChargeRef { charge: ChargeId; form: ChargeForm | null }
export interface Cotises { count: 1 | 2 | 3; paint: Paint; line: Line }

export interface Ordinary {
  k: 'ordinary';
  type: OrdinaryType;
  lines: Lines;
  mods: OrdinaryMod[];          // sorted by ORDINARY_MODS order
  cotised: Cotises | null;
  fimbriated: Paint | null;
}

export interface Modifier { id: ModifierId; count: number | null; paint: Paint | null }   // "of eight points", "slipped and leaved vert"
export interface PartPaint { part: PartId; paint: Paint }                                // "armed and langued gules"
export interface Held { how: HoldHow; item: Charge; paint: Paint }

export interface Charge {
  k: 'charge';
  charge: ChargeId;
  form: ChargeForm | null;
  posture: Posture | null;       // null only for posture-less charges
  gaze: Gaze | null;             // null: the head looks where the body faces; only for charges that face
  facing: Facing | null;         // null only for charges with defaultFacing null
  orientation: Orientation | null; // null = the default orientation for where it lies (e.g. following a bend)
  mods: Modifier[];              // sorted by MODIFIER_IDS order
  parts: PartPaint[];            // sorted by PART_IDS order
  holds: Held[];                 // sorted by HOLD_HOWS order, then charge id
}

export type Item = Ordinary | Charge;

/** The paint a charge is fimbriated with ("a lozenge azure fimbriated argent"), or null. */
export const fimbriationOf = (c: Charge): Paint | null => c.mods.find((m) => m.id === 'fimbriated')?.paint ?? null;

/** Whether a charge is voided: drawn as its band along its edge, the ground showing in the middle. */
export const isVoided = (c: Charge): boolean => c.mods.some((m) => m.id === 'voided');

/** The singular name of what an item is, in a message: "fess", "lion". */
export const itemName = (i: Item): string => (i.k === 'ordinary' ? ORDINARY_NAME[i.type] : CHARGES[i.charge].name);

export type LineDir = 'pale' | 'fess' | 'bend' | 'bend-sinister';
export type Pattern = 'cross' | 'saltire' | 'orle' | 'annulo' | 'chevron' | 'chevron-inverted' | 'pall' | 'pile';
export type Pair = 'combattant' | 'respectant' | 'addorsed';
export type Arrangement =
  | { k: 'single' }
  | { k: 'line'; dir: LineDir }
  | { k: 'rows'; rows: number[] }          // top row first; sums to count
  | { k: 'pattern'; pattern: Pattern }
  | { k: 'host' }                          // placed by the host/ordinary (between, on)
  | { k: 'crossed' }                       // two long charges in saltire
  | { k: 'pair'; pair: Pair };

export const POSITIONS = ['chief', 'base', 'dexter-chief', 'sinister-chief', 'dexter-base', 'sinister-base', 'dexter', 'sinister', 'canton', 'flank', 'fess-point'] as const;
export type Position = (typeof POSITIONS)[number];
export type Role = 'primary' | 'secondary' | 'peripheral' | 'overall' | 'tertiary';
export type Relation = 'between' | 'about' | 'position';

export interface Group {
  role: Role;                    // 'tertiary' exactly for groups nested in `charged`
  relation: Relation | null;     // secondary groups only; null otherwise
  item: Item;
  count: number;                 // integer 1..20 (well-formed); > MAX_DRAWN_COUNT (12) is unsupported
  arrangement: Arrangement;
  position: Position | null;
  paint: Paint;
  charged: Group[];              // tertiaries on this group (≤ 1 is SENA-legal; more is a structure issue)
}

export type Design =
  | { v: 2; kind: 'arms'; field: Paint; groups: Group[] }
  | { v: 2; kind: 'badge'; field: null; groups: Group[] };

/** Index into design.groups, then into charged, …; the canonical group order makes paths stable. */
export type GroupPath = readonly number[];

/** Whether two paths name the same group. */
export const samePath = (a: GroupPath, b: GroupPath): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** What a builder tincture picker offers for a group: a tincture, or counterchanged. */
export type GroupTincture = Tincture | 'counterchanged';
export const GROUP_TINCTURES: readonly GroupTincture[] = [...TINCTURES, 'counterchanged'];

export function isGroupTincture(value: unknown): value is GroupTincture {
  return value === 'counterchanged' || isTincture(value);
}

/** Canonical and paint order: a group overall lies over the primary and secondary groups but under the chief and bordure, which it may not cross. */
export const ROLE_ORDER: readonly Role[] = ['primary', 'secondary', 'overall', 'peripheral', 'tertiary'];

// ── Tree helpers ────────────────────────────────────────────────────────────

export function groupAt(d: Design, path: GroupPath): Group {
  let group: Group | undefined;
  let list = d.groups;
  for (const i of path) {
    group = list[i];
    if (!group) throw new RangeError(`No group at ${pathKey(path)}.`);
    list = group.charged;
  }
  if (!group) throw new RangeError('A group path needs at least one index.');
  return group;
}

/** The design with the group at `path` replaced (the groups above it are rebuilt, everything else is shared). */
export function replaceGroup(d: Design, path: GroupPath, group: Group): Design {
  const swap = (groups: readonly Group[], rest: GroupPath): Group[] =>
    groups.map((g, i) => (i !== rest[0] ? g : rest.length === 1 ? group : { ...g, charged: swap(g.charged, rest.slice(1)) }));
  return { ...d, groups: swap(d.groups, path) } as Design;
}

/** The group `path` is nested in, or null for a top-level group. */
export function hostOf(d: Design, path: GroupPath): Group | null {
  return path.length > 1 ? groupAt(d, path.slice(0, -1)) : null;
}

export interface WalkedGroup { path: GroupPath; group: Group; host: Group | null }

/** Every group in canonical order, each followed by its tertiaries. */
export function walkGroups(d: Design): WalkedGroup[] {
  const out: WalkedGroup[] = [];
  const visit = (groups: readonly Group[], prefix: GroupPath, host: Group | null) => {
    groups.forEach((group, i) => {
      const path = [...prefix, i];
      out.push({ path, group, host });
      visit(group.charged, path, group);
    });
  };
  visit(d.groups, [], null);
  return out;
}

/** "0.1": a stable string for a path, for keys and messages. */
export function pathKey(path: GroupPath): string {
  return path.join('.');
}

export function primaryGroup(d: Design): { path: GroupPath; group: Group } | null {
  const i = d.groups.findIndex((g) => g.role === 'primary');
  return i < 0 ? null : { path: [i], group: d.groups[i] };
}

/** Every primary group, in canonical order: one, or the co-primary groups ('a lion and a rose') that together are the primary group (SENA App I1). */
export function primaryGroups(d: Design): Array<{ path: GroupPath; group: Group }> {
  return d.groups.flatMap((group, i) => (group.role === 'primary' ? [{ path: [i] as GroupPath, group }] : []));
}

/** The semys on the field, one per part that has one (SENA App I1: a semy on the field is a charge group of its own). */
export function fieldSemys(d: Design): SemyPaint[] {
  return fieldParts(d).flatMap((p) => asSemy(p) ?? []);
}

/** True when no group is primary and no semy strews the field: the field carries the design (RULES §B.3). */
export function isFieldPrimary(d: Design): boolean {
  return primaryGroup(d) === null && fieldSemys(d).length === 0;
}

/** The plain tincture a paint is, or the one a semy is strewn on; null for any other paint. */
export function groundTincture(p: Paint): Tincture | null {
  return p.k === 'tincture' ? p.t : asSemy(p)?.ground.t ?? null;
}

/** The plain tinctures of the field, in part order (a semy's, the one it is strewn on); a part that isn't one adds none. */
export function fieldTinctures(d: Design): Tincture[] {
  if (d.kind !== 'arms') return [];
  const parts = d.field.k === 'divided' || d.field.k === 'variation' ? d.field.parts : [d.field];
  return parts.flatMap((p) => groundTincture(p) ?? []);
}

/** The parts of the field in part order: the field itself when it is not divided; none for a fieldless badge. */
export function fieldParts(d: Design): Paint[] {
  if (d.kind !== 'arms') return [];
  return d.field.k === 'divided' ? d.field.parts : [d.field];
}

/** The plain tinctures a paint is made of, in order: a tincture's own, a fur's two colours, a divided paint's parts'. */
export function paintTinctures(p: Paint): Tincture[] {
  switch (p.k) {
    case 'tincture': return [p.t];
    case 'fur': return [...furColours(p)];
    case 'divided': case 'variation': return p.parts.flatMap(paintTinctures);
    case 'treated': return [...paintTinctures(p.ground), p.ink];
    case 'semy': return [...paintTinctures(p.ground), ...paintTinctures(p.ink)];
    case 'stain': case 'proper': case 'counterchanged': return [];
    default: return p satisfies never;
  }
}

/**
 * The tinctures that make up a paint to the eye, which neighbouring parts of the field may not share (SENA A3B3a; Prec #FUR,
 * Anastasia von der Wilgenhalle 11/2006: ermine may not lie next to argent, but its spots, sable, are small: "Per fess ermine and
 * sable" is registered, as is "Per pale pean and erminois"). A fur of the ermine family is its ground; the others are both of theirs.
 */
export function bodyTinctures(p: Paint): Tincture[] {
  if (p.k === 'fur' && FUR_SPEC[p.fur].family === 'ermine') return [furColours(p)[0]];
  // A treatment is part of the tincture it lies on ("gules and gules masoned Or" are one background, A3B3a), and strewn charges are not a tincture of the field at all.
  if (p.k === 'treated' || p.k === 'semy') return bodyTinctures(p.ground);
  return paintTinctures(p);
}

export function itemKey(item: Item): string {
  return item.k === 'ordinary' ? `ordinary:${item.type}` : `charge:${item.charge}`;
}

export function tincturePaint(t: Tincture): Paint {
  return { k: 'tincture', t };
}

export function paintOfGroupTincture(t: GroupTincture): Paint {
  return t === 'counterchanged' ? { k: 'counterchanged' } : tincturePaint(t);
}

/** A paint divided into two plain tinctures ("per pale azure and Or"): the only divided paint a band or picture takes. */
export interface PartyPaint {
  k: 'divided';
  division: Division;
  lines: Lines;
  pieces: number | null;
  parts: [{ k: 'tincture'; t: Tincture }, { k: 'tincture'; t: Tincture }];
}

export function partyPaint(division: Division, a: Tincture, b: Tincture): PartyPaint {
  return { k: 'divided', division, lines: { ...PLAIN_LINES }, pieces: null, parts: [{ k: 'tincture', t: a }, { k: 'tincture', t: b }] };
}

/** The paint as a party of two plain tinctures, or null when it is anything else. */
export function asParty(p: Paint): PartyPaint | null {
  if (p.k !== 'divided' || p.parts.length !== 2) return null;
  const [a, b] = p.parts;
  return a.k === 'tincture' && b.k === 'tincture' ? { ...p, parts: [a, b] } : null;
}

/** A variation of two plain tinctures ("barry argent and azure", "checky Or and sable"): the only varied paint the builder draws. */
export interface VariationPaint {
  k: 'variation';
  variation: Variation;
  lines: Lines;
  pieces: number | null;
  parts: [{ k: 'tincture'; t: Tincture }, { k: 'tincture'; t: Tincture }];
}

export function variationPaint(variation: Variation, a: Tincture, b: Tincture, pieces: number | null = null): VariationPaint {
  return { k: 'variation', variation, lines: { ...PLAIN_LINES }, pieces: variationPieces(variation, pieces), parts: [{ k: 'tincture', t: a }, { k: 'tincture', t: b }] };
}

/** The paint as a variation of two plain tinctures, or null when it is anything else. */
export function asVariation(p: Paint): VariationPaint | null {
  if (p.k !== 'variation') return null;
  const [a, b] = p.parts;
  return a.k === 'tincture' && b.k === 'tincture' ? { ...p, parts: [a, b] } : null;
}

/** A tincture with a treatment in another ("argent masoned sable", "gules scaly Or"): the only treated paint the builder draws. */
export interface TreatedPaint {
  k: 'treated';
  treatment: Treatment;
  ground: { k: 'tincture'; t: Tincture };
  ink: Tincture;
}

export function treatedPaint(treatment: Treatment, ground: Tincture, ink: Tincture): TreatedPaint {
  return { k: 'treated', treatment, ground: { k: 'tincture', t: ground }, ink };
}

/** The paint as a treated tincture, or null when it is anything else (a treatment on a fur or a division is not drawn). */
export function asTreated(p: Paint): TreatedPaint | null {
  return p.k === 'treated' && p.ground.k === 'tincture' ? { ...p, ground: p.ground } : null;
}

/** A tincture strewn with a charge in another ("azure semy of mullets Or", "sable bezanty"): the only semy the builder draws. */
export interface SemyPaint {
  k: 'semy';
  ground: { k: 'tincture'; t: Tincture };
  charge: ChargeRef;
  ink: { k: 'tincture'; t: Tincture };
}

export function semyPaint(ground: Tincture, charge: ChargeId, ink: Tincture): SemyPaint {
  return { k: 'semy', ground: { k: 'tincture', t: ground }, charge: { charge, form: null }, ink: { k: 'tincture', t: ink } };
}

/** The paint as a plain tincture strewn with a charge, or null when it is anything else (a semy on a fur or a division is not drawn). */
export function asSemy(p: Paint): SemyPaint | null {
  return p.k === 'semy' && p.ground.k === 'tincture' && p.ink.k === 'tincture' ? { ...p, ground: p.ground, ink: p.ink } : null;
}

/** The picker value of a paint, or null when the paint is neither a tincture nor counterchanged. */
export function groupTinctureOf(p: Paint): GroupTincture | null {
  return p.k === 'tincture' ? p.t : p.k === 'counterchanged' ? 'counterchanged' : null;
}

// ── Canonical form ──────────────────────────────────────────────────────────

/** The lines in canonical form: a host with one line has `b = a`. */
export function canonicalLines(host: EdgeHost, l: Lines): Lines {
  return { a: l.a, b: edgeCount(host) === 1 ? l.a : l.b };
}

export function canonicalPaint(p: Paint): Paint {
  switch (p.k) {
    case 'tincture': return { k: 'tincture', t: p.t };
    case 'stain': return { k: 'stain', stain: p.stain };
    case 'fur': return canonicalFur(p);
    case 'divided':
      return { k: 'divided', division: p.division, lines: canonicalLines({ k: 'division', division: p.division }, p.lines), pieces: divisionPieces(p.division, p.pieces), parts: p.parts.map(canonicalPaint) };
    case 'variation':
      return { k: 'variation', variation: p.variation, lines: canonicalLines({ k: 'variation', variation: p.variation }, p.lines), pieces: variationPieces(p.variation, p.pieces), parts: [canonicalPaint(p.parts[0]), canonicalPaint(p.parts[1])] };
    case 'treated': return { k: 'treated', treatment: p.treatment, ground: canonicalPaint(p.ground), ink: p.ink };
    case 'semy': return { k: 'semy', ground: canonicalPaint(p.ground), charge: { charge: p.charge.charge, form: p.charge.form }, ink: canonicalPaint(p.ink) };
    case 'proper': return { k: 'proper' };
    case 'counterchanged': return { k: 'counterchanged' };
  }
}

/**
 * Two charges facing each other, as the builder words them (§1.1 F6): combattant and respectant are one pair (CL 11/2012), said
 * combattant of beasts and monsters rampant ("combatant is shorthand for 'in fess one beast rampant contourny and another rampant'", SENA
 * A5E5a) and respectant of every other charge and posture, and of heads and demi charges (the SCA armorial: "heads respectant" 187 times
 * against 3 "combatant"), so that one drawing has one signature.
 */
export const facingEachOther = (item: Item): Pair =>
  (item.k === 'charge' && item.form === null && CHARGES[item.charge].postureClass === 'quadruped' && item.posture === 'rampant' ? 'combattant' : 'respectant');

function canonicalArrangement(a: Arrangement, item: Item): Arrangement {
  switch (a.k) {
    case 'line': return { k: 'line', dir: a.dir };
    case 'rows': return { k: 'rows', rows: [...a.rows] };
    case 'pattern': return { k: 'pattern', pattern: a.pattern };
    case 'pair': return { k: 'pair', pair: a.pair === 'addorsed' ? 'addorsed' : facingEachOther(item) };
    case 'single': case 'host': case 'crossed': return { k: a.k };
  }
}

const sortedBy = <T>(xs: readonly T[], rank: (x: T) => number | string): T[] =>
  [...xs].sort((x, y) => {
    const a = rank(x), b = rank(y);
    return a < b ? -1 : a > b ? 1 : 0;
  });

/**
 * A charge in canonical form: its attributes in fixed order; a star "of" the number of points it is drawn with is that star ("a mullet of
 * five points" is a mullet); a head or a demi charge has no posture, and a head with no cut is couped.
 */
function canonicalCharge(c: Charge): Charge {
  const drawn = c.mods.filter((m) => !(m.id === 'of-points' && m.count === drawnPoints(c.charge)));
  const uncut = c.form === 'head' && !drawn.some((m) => CUT_MODIFIERS.includes(m.id));
  const mods = uncut ? [...drawn, { id: 'couped', count: null, paint: null } as const] : drawn;
  return {
    k: 'charge', charge: c.charge, form: c.form, posture: c.form === 'head' || c.form === 'demi' ? null : c.posture, gaze: c.gaze, facing: c.facing, orientation: c.orientation,
    mods: sortedBy(mods, (m) => MODIFIER_IDS.indexOf(m.id)).map((m) => ({ id: m.id, count: m.count, paint: m.paint && canonicalPaint(m.paint) })),
    parts: sortedBy(c.parts, (p) => PART_IDS.indexOf(p.part)).map((p) => ({ part: p.part, paint: canonicalPaint(p.paint) })),
    holds: sortedBy(c.holds, (h) => `${String(HOLD_HOWS.indexOf(h.how)).padStart(2, '0')}${h.item.charge}`)
      .map((h) => ({ how: h.how, item: canonicalCharge(h.item), paint: canonicalPaint(h.paint) })),
  };
}

/**
 * The type an ordinary group is drawn and blazoned as. A pall inverted is a type of its own: the pall with the mod is that type, so the two
 * spellings are one design (and a pall inverted with the mod is the pall). A single tressure is an orle (RULES-C §C.3, Prec Gwynaeth 04/2004). Barrulets are bars (RULES-C §G.2). SCA armory
 * uses no single diminutive as the main or overall band (RULES-C §C.2): one bar, pallet, bendlet (sinister) or chevronel `alone` is its ordinary,
 * one saltorel a saltire couped (§D.2); a baton stays a type of its own.
 */
function canonicalOrdinary(item: Ordinary, count: number, alone: boolean): { type: OrdinaryType; mods: readonly OrdinaryMod[] } {
  if (item.type === 'pall' && item.mods.includes('inverted')) return { type: 'pall-inverted', mods: item.mods.filter((m) => m !== 'inverted') };
  if (item.type === 'pall-inverted' && item.mods.includes('inverted')) return { type: 'pall', mods: item.mods.filter((m) => m !== 'inverted') };
  if (item.type === 'tressure' && count === 1) return { type: 'orle', mods: item.mods };
  const type = SAME_ORDINARY[item.type] ?? item.type;
  if (!alone || count !== 1 || type === 'baton' || !DIMINUTIVE_OF[type]) return { type, mods: item.mods };
  return type === 'saltorel' ? { type: 'saltire', mods: [...new Set<OrdinaryMod>([...item.mods, 'couped'])] } : { type: DIMINUTIVE_OF[type], mods: item.mods };
}

function canonicalItem(item: Item, count: number, alone: boolean): Item {
  if (item.k === 'charge') return canonicalCharge(item);
  const { type, mods } = canonicalOrdinary(item, count, alone);
  return {
    k: 'ordinary', type, lines: canonicalLines(ordinaryEdgeHost({ type, mods }), item.lines),
    mods: sortedBy(mods, (m) => ORDINARY_MODS.indexOf(m)),
    cotised: item.cotised && { count: item.cotised.count, paint: canonicalPaint(item.cotised.paint), line: item.cotised.line },
    fimbriated: item.fimbriated && canonicalPaint(item.fimbriated),
  };
}

function groupOrder(g: Group): string {
  // Peripheral ordinaries in their paint order (the bordure over the chief, SENA App M1l; the canton over both).
  const peripheral = g.role === 'peripheral' && g.item.k === 'ordinary' ? PERIPHERAL_ORDER.indexOf(g.item.type) : -1;
  // Primary charges keep the order they were written in: the first of two stands first (to dexter, or above).
  const key = g.role === 'primary' && g.item.k === 'charge' ? 'charge' : itemKey(g.item);
  return `${ROLE_ORDER.indexOf(g.role)}${peripheral >= 0 ? `0${String(peripheral).padStart(2, '0')}` : `1${key}`}`;
}

function canonicalGroups(groups: readonly Group[]): Group[] {
  const rebuilt = groups.map((g): Group => ({
    role: g.role, relation: g.relation, item: canonicalItem(g.item, g.count, g.role === 'primary' || g.role === 'overall'), count: g.count,
    arrangement: canonicalArrangement(g.arrangement, g.item), position: g.position, paint: canonicalPaint(g.paint),
    charged: canonicalGroups(g.charged),
  }));
  return sortedBy(rebuilt, groupOrder);
}

/** A deep rebuild in fixed key order with groups, modifiers, parts and holds sorted: equal designs have equal JSON. */
export function canonical(d: Design): Design {
  return d.kind === 'badge'
    ? { v: 2, kind: 'badge', field: null, groups: canonicalGroups(d.groups) }
    : { v: 2, kind: 'arms', field: canonicalPaint(d.field), groups: canonicalGroups(d.groups) };
}

export function canonicalJson(d: Design): string {
  return JSON.stringify(canonical(d));
}

// ── Issues ──────────────────────────────────────────────────────────────────

export type IssueAt = { k: 'design' } | { k: 'field' } | { k: 'group'; path: GroupPath };

/** Gap categories a design can be filed under when the builder can't draw it; a subset of the SCA test's categories. */
export const UNSUPPORTED_GAP_CATEGORIES = ['fieldless', 'fur', 'tincture', 'proper', 'field-treatment', 'division',
  'line-of-partition', 'ordinary', 'ordinary-treatment', 'multiple-groups', 'placement', 'count',
  'charge-modifier', 'posture', 'orientation', 'arrangement'] as const;
export type GapCategory = (typeof UNSUPPORTED_GAP_CATEGORIES)[number];

/** A construct the builder doesn't draw yet; its tag is `${category}:${detail}`. */
export interface Gap { category: GapCategory; detail: string }

/**
 * When an unsupported group is only a count its place has no Table 7 row for: between or on a band, or on a charge (`host`), around a
 * picture (`around`), or primary charges in a layout that can't have charges set around them (`around-primary`); null for any other gap.
 */
export type CountLimit = 'host' | 'around' | 'around-primary';

/** Why a tincture issue: the colours fail the rule of tincture, or counterchanged isn't available for the group. */
export type TinctureReason = 'contrast' | 'counterchange-unavailable';

/** Which part of a group (or of the field's paint) a tincture issue is about: the group itself, an ordinary's fimbriation or cotises, or the charges of a semy. */
export type TincturePart = 'body' | 'fimbriation' | 'cotises' | 'strewn' | 'held';

/** Which structure rule an issue breaks: the field's tinctures, a fur's colours (`fur`), a treatment whose ink doesn't contrast with its tincture (`treatment`), a band or picture divided or varied the wrong way (`divided-paint`), how groups relate, one charge type in two groups on the field, a layout the count doesn't have, no room at a size that reads, a chief with nothing across the line, a group overall that breaks SENA App I4, a badge's single main charge (`badge`, SENA A3A2: bands, borders, groups of several charges and split display shapes are not fieldless armory), a dexter or sinister point (`side-point`: never registered, RULES-C §C.3, L21). */
export type StructureRule = 'field' | 'fur' | 'treatment' | 'divided-paint' | 'relation' | 'same-type' | 'layout' | 'capacity' | 'crosses-line' | 'overall' | 'badge' | 'line' | 'core-practice' | 'ordinary-treatment' | 'charge-treatment' | 'side-point';

/**
 * shape       — malformed input (unknown key/id, wrong type)
 * structure   — legal ids, illegal combination (count/arrangement, equal parts, groups that don't fit)
 * generic     — plain field alone: a hint while building, a blocker for registration
 * tincture    — rule-of-tincture violation
 * unsupported — well-formed, but not drawn by this builder yet
 */
export type Issue =
  | { code: 'shape' | 'generic'; at: IssueAt; message: string; slots: number[] }
  | { code: 'tincture'; reason: TinctureReason; part: TincturePart; at: IssueAt; message: string; slots: number[] }
  | { code: 'structure'; rule: StructureRule; at: IssueAt; message: string; slots: number[] }
  | { code: 'unsupported'; at: IssueAt; message: string; gap: Gap; limit: CountLimit | null };
export type UnsupportedIssue = Extract<Issue, { code: 'unsupported' }>;

/** Thrown where the pipeline meets a construct it doesn't draw; `normalise` never passes such a design on, so the app never sees it. */
export class UnsupportedConstructError extends Error {
  constructor(readonly gap: Gap) {
    super(`Not supported yet: ${gap.category}:${gap.detail}`);
    this.name = 'UnsupportedConstructError';
  }
}

/** The one "not yet drawable" guard: every switch over paints, arrangements and items calls it for the cases it doesn't handle. */
export function notSupported(gap: Gap): never {
  throw new UnsupportedConstructError(gap);
}
