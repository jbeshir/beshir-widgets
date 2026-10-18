// The builder's edge and shape controls: which lines a divided or striped background, or a band or shape, may be drawn with, which of a
// quartered field's two lines (or a band's two edges) carry it; which treatments a band or shape takes (upside down, shortened, touching the
// edges, hollow, raised or lowered); its outline (edged, or cotised) and the tincture of that, and the line of its cotises; and the designs they lead to. A choice is blocked only by what is wrong with the host itself (a line it can't
// take, a dark pair across a wavy line, App H, a second step from core practice, two treatments that contradict); never by what lies on it.

import { DRAWN_LINES, bareLines, edgeCount, lineAllowed, type EdgeHost, type Line } from './lines';
import { GROUP_TINCTURES, PLAIN_LINES, canonical, groupAt, groupTinctureOf, paintOfGroupTincture, replaceGroup, samePath, type Design, type GroupPath, type GroupTincture, type Lines, type Ordinary, type Paint } from './design';
import { choice, type Choice } from './options';
import { corePracticeProblem, ordinaryLineProblem, structuralIssues } from './structure';
import { trimTinctureIssues } from './tincture-rule';
import { TINCTURES, type Tincture } from './tinctures';
import { DRAWN_ORDINARIES, ORDINARY_COUNTS, ORDINARY_KIND, THIN, THIN_ORDINARIES, familyOf, isDiminutive, modDrawn, type OrdinaryMod, type OrdinaryType } from './ordinaries';
import { OUTLINES, cotiseLineFor, outlineOf, outlinePaintOf, withOutline, withOutlinePaint, type Outline } from './outline';
import { modsClash } from './resolve';
import { unsupportedIssues } from './support';
import { LINED_VARIATIONS, type Division, type Variation } from './divisions';

/** What an edge control edits: the background, the band, shape, top band or border at `path`, or the cotises of the band or shape at `path`. */
export type EdgeTarget = { k: 'field' } | { k: 'group'; path: GroupPath } | { k: 'cotises'; path: GroupPath };

/** Which of a two-edge host's lines carry the line: both, the first (the per pale line of a quartered field, a band's upper or dexter edge), or the second (the per fess line, the lower or sinister edge). */
export type EdgeSide = 'both' | 'a' | 'b';

/** The host the target's lines belong to, or null when it has none the builder draws a line on. */
function hostAt(d: Design, target: EdgeTarget): EdgeHost | null {
  if (target.k !== 'field') {
    const item = groupAt(d, target.path).item;
    if (item.k !== 'ordinary' || !DRAWN_ORDINARIES.includes(item.type)) return null;
    if (target.k === 'cotises') return item.cotised ? { k: 'cotises', type: item.type } : null;
    return { k: 'ordinary', type: item.type, inverted: item.mods.includes('inverted') };
  }
  if (d.kind !== 'arms') return null;
  if (d.field.k === 'divided') return { k: 'division', division: d.field.division };
  return d.field.k === 'variation' && LINED_VARIATIONS.includes(d.field.variation) ? { k: 'variation', variation: d.field.variation } : null;
}

/** The lines of the target (plain for any that has none). */
function linesAt(d: Design, target: EdgeTarget): Lines {
  if (target.k !== 'field') {
    const item = groupAt(d, target.path).item;
    if (item.k !== 'ordinary') return PLAIN_LINES;
    return target.k === 'cotises' ? { a: item.cotised?.line ?? 'plain', b: item.cotised?.line ?? 'plain' } : item.lines;
  }
  return d.kind === 'arms' && (d.field.k === 'divided' || d.field.k === 'variation') ? d.field.lines : PLAIN_LINES;
}

/** The design with the target drawn with these lines; a target without any is unchanged. */
function withLinesAt(d: Design, target: EdgeTarget, lines: Lines): Design {
  if (target.k !== 'field') {
    const group = groupAt(d, target.path);
    const item = group.item;
    if (item.k !== 'ordinary') return d;
    if (target.k === 'cotises') return item.cotised ? canonical(replaceGroup(d, target.path, { ...group, item: { ...item, cotised: { ...item.cotised, line: lines.a } } })) : d;
    // Cotises that followed the band's line follow it to the new one (`cotiseLineFor`).
    const follow = item.cotised && item.cotised.line === cotiseLineFor(item.type, item.lines.a) ? { cotised: { ...item.cotised, line: cotiseLineFor(item.type, lines.a) } } : {};
    return canonical(replaceGroup(d, target.path, { ...group, item: { ...item, ...follow, lines: { ...lines } } }));
  }
  if (d.kind !== 'arms' || (d.field.k !== 'divided' && d.field.k !== 'variation')) return d;
  const field: Paint = { ...d.field, lines: { ...lines } };
  return canonical({ ...d, field });
}

/** What is wrong with the lines of the target, or null: the rule of its own they break, or (for a band or its cotises) a second step from core practice. */
function lineProblem(d: Design, target: EdgeTarget): string | null {
  if (target.k !== 'field') return ordinaryLineProblem(groupAt(d, target.path)) ?? corePracticeProblem(d);
  return structuralIssues(d).find((i) => i.code === 'structure' && i.rule === 'line' && i.at.k === 'field')?.message ?? null;
}

/**
 * The line a host carries on the edges `side` names. `null` is the line as a blazon bares it (a band's embattled is its upper edge
 * alone); a side names the edges outright ('both' is the line on each).
 */
function linesOn(host: EdgeHost, line: Line, side: EdgeSide | null): Lines {
  if (line === 'plain') return { ...PLAIN_LINES };
  if (side === null) return bareLines(host, line);
  return side === 'both' ? { a: line, b: line } : side === 'a' ? { a: line, b: 'plain' } : { a: 'plain', b: line };
}

/** The line a host carries: its first complex line, or plain. */
function currentLine(lines: Lines): Line {
  return lines.a !== 'plain' ? lines.a : lines.b;
}

/** The side a quartered field keeps when its line changes (a band's bare line starts afresh). */
function keptSide(d: Design, target: EdgeTarget): EdgeSide | null {
  return target.k === 'field' ? edgeSideOf(d, target) : null;
}

/** Every line the target's host may carry, in the order the builder offers them, blocked where the result breaks a rule of the host itself. */
export function lineChoices(d: Design, target: EdgeTarget): Choice<Line>[] {
  const host = hostAt(d, target);
  // a host with no edge to draw a line on (the point pointed, the fret, the label, the mount) has no row
  if (!host || edgeCount(host) === 0) return [];
  const side = keptSide(d, target);
  return (['plain', ...DRAWN_LINES] as const).filter((l) => l === 'plain' || lineAllowed(host, l)).map((line) => choice(line, lineProblem(withLinesAt(d, target, linesOn(host, line, side)), target)));
}

/** The target drawn with this line: on all of a background's lines (on the side already chosen, for a quartered field), as a blazon bares it for a band. */
export function setLine(d: Design, target: EdgeTarget, line: Line): Design {
  const host = hostAt(d, target);
  return host ? withLinesAt(d, target, linesOn(host, line, keptSide(d, target))) : d;
}

/** Which edges carry the line now: 'both' unless one of a two-edge host's is plain (a fess embattled on its upper edge alone is 'a'). */
export function edgeSideOf(d: Design, target: EdgeTarget): EdgeSide {
  const { a, b } = linesAt(d, target);
  return a !== 'plain' && b === 'plain' ? 'a' : a === 'plain' && b !== 'plain' ? 'b' : 'both';
}

/** The sides a quartered field's, or a band's, line may be drawn on, once it has one; nothing for a host with a single line. */
export function edgeSideChoices(d: Design, target: EdgeTarget): Choice<EdgeSide>[] {
  const host = hostAt(d, target);
  const line = currentLine(linesAt(d, target));
  if (!host || edgeCount(host) !== 2 || line === 'plain') return [];
  return (['both', 'a', 'b'] as const).map((side) => choice(side, target.k === 'group' ? lineProblem(withLinesAt(d, target, linesOn(host, line, side)), target) : null));
}

/** The target with its line drawn on these sides. */
export function setEdgeSide(d: Design, target: EdgeTarget, side: EdgeSide): Design {
  const host = hostAt(d, target);
  return host ? withLinesAt(d, target, linesOn(host, currentLine(linesAt(d, target)), side)) : d;
}

/** The lines a division or stripes in the background keeps when it replaces the one it had: those the new host may carry, else plain. */
export function keptLines(lines: Lines, host: Division | Variation, kind: 'division' | 'variation'): Lines {
  const edgeHost: EdgeHost = kind === 'division' ? { k: 'division', division: host as Division } : { k: 'variation', variation: host as Variation };
  if (kind === 'variation' && !LINED_VARIATIONS.includes(host as Variation)) return { ...PLAIN_LINES };
  const carried = (l: Line) => l === 'plain' || lineAllowed(edgeHost, l);
  return carried(lines.a) && carried(lines.b) ? { ...lines } : { ...PLAIN_LINES };
}

/** The lines a band or shape keeps when it is replaced by another type (upside down or not): its line where the new type may carry it (as that type's blazon bares it), else plain. */
export function keptOrdinaryLines(lines: Lines, type: OrdinaryType, inverted: boolean): Lines {
  const host: EdgeHost = { k: 'ordinary', type, inverted };
  const line = currentLine(lines);
  return line !== 'plain' && lineAllowed(host, line) ? bareLines(host, line) : { ...PLAIN_LINES };
}

// ── Counts ──────────────────────────────────────────────────────────────────

/** The counts the band or shape at `path` may be drawn with: a tressure double or triple (a single one is an orle), thin bands two to four; none for any other. */
export function ordinaryCountChoices(d: Design, path: GroupPath): Choice<number>[] {
  const item = drawnOrdinaryAt(d, path);
  return (item ? ORDINARY_COUNTS[item.type] ?? [] : []).map((count) => choice(count, null));
}

/** The band or shape at `path` drawn this many times over (one the type takes; any other count leaves it as it is). */
export function setOrdinaryCount(d: Design, path: GroupPath, count: number): Design {
  const group = groupAt(d, path);
  if (!ordinaryCountChoices(d, path).some((c) => c.value === count) || group.count === count) return d;
  return canonical(replaceGroup(d, path, { ...group, count }));
}

// ── Shape toggles and band positions ────────────────────────────────────────

/**
 * A treatment the builder turns on or off for a band or shape: upside down (inverted), shortened (couped), touching the edges (throughout),
 * hollow (voided), a corner shape in the top right corner, as seen, instead of the top left (sinister), or a band drawn as two or more thin
 * ones (its diminutive: bars, pallets, bendlets, chevronels).
 */
export type ShapeToggle = 'inverted' | 'couped' | 'throughout' | 'voided' | 'sinister' | 'thin';
const SHAPE_TOGGLES: readonly ShapeToggle[] = ['inverted', 'couped', 'throughout', 'voided', 'sinister', 'thin'];

/** Where a band is set: raised (enhanced), in its usual place, or lowered (abased). */
export type BandPosition = 'enhanced' | 'middle' | 'abased';
const BAND_POSITIONS: readonly BandPosition[] = ['enhanced', 'middle', 'abased'];

/** The band or shape at `path`, when it is one the builder draws. */
function drawnOrdinaryAt(d: Design, path: GroupPath): Ordinary | null {
  const item = groupAt(d, path).item;
  return item.k === 'ordinary' && DRAWN_ORDINARIES.includes(item.type) ? item : null;
}

/** The band or shape with these treatments (kept in canonical order). */
function withMods(d: Design, path: GroupPath, mods: readonly OrdinaryMod[]): Design {
  const group = groupAt(d, path);
  return group.item.k === 'ordinary' ? canonical(replaceGroup(d, path, { ...group, item: { ...group.item, mods: [...mods] } })) : d;
}

/** What SENA A3C says against the outline or hollowness of the band or shape at `path`, or null. */
function treatmentRuleProblem(d: Design, path: GroupPath): string | null {
  return structuralIssues(d).find((i) => i.code === 'structure' && i.rule === 'ordinary-treatment' && i.at.k === 'group' && samePath(i.at.path, path))?.message ?? null;
}

/** What lies on the band or shape at `path` that can't be drawn on it in `d` (charges on a voided one), or null. */
function onItProblem(d: Design, path: GroupPath): string | null {
  return unsupportedIssues(d).find((i) => i.at.k === 'group' && i.at.path.length > path.length && samePath(i.at.path.slice(0, path.length), path))?.message ?? null;
}

/** Why the band or shape can't have these treatments, or null: two that contradict each other, a line its new form can't take, the rules of voiding and fimbriation, or what lies on it. */
function modsProblem(d: Design, path: GroupPath, mods: readonly OrdinaryMod[]): string | null {
  const item = drawnOrdinaryAt(d, path);
  if (!item) return null;
  const clash = modsClash(item.type, mods);
  if (clash) return clash;
  const next = withMods(d, path, mods);
  return ordinaryLineProblem(groupAt(next, path)) ?? treatmentRuleProblem(next, path) ?? onItProblem(next, path);
}

/** The pall and the pall inverted, which are one band or shape upside down or not: turning one over is a change of type, not a treatment. */
const isPall = (type: OrdinaryType): boolean => type === 'pall' || type === 'pall-inverted';

/** The pall at `path` turned upside down (or back), keeping its line where the other can carry it. */
function pallTurned(d: Design, path: GroupPath, upsideDown: boolean): Design {
  const group = groupAt(d, path);
  if (group.item.k !== 'ordinary') return d;
  const type = upsideDown ? 'pall-inverted' : 'pall';
  return canonical(replaceGroup(d, path, { ...group, item: { ...group.item, type, lines: keptOrdinaryLines(group.item.lines, type, false) } }));
}

/** Whether a band of this type takes the Thin toggle: a fess, pale, bend (sinister) or chevron, or the thin bands it makes. */
const thinnable = (type: OrdinaryType): boolean => THIN[type] !== undefined || THIN_ORDINARIES.includes(type);

/**
 * The band at `path` drawn as two thin bands of its kind (`thin`), keeping the line and treatments they may have, or thin bands back as one
 * band (RULES-C §C.2: a single diminutive is the ordinary). An outline goes: thin bands have none here.
 */
function thinned(d: Design, path: GroupPath, thin: boolean): Design {
  const group = groupAt(d, path);
  if (group.item.k !== 'ordinary') return d;
  const type = thin ? THIN[group.item.type] ?? group.item.type : familyOf(group.item.type);
  const mods = keptMods(group.item.mods, type);
  const item: Ordinary = { ...group.item, type, mods, lines: keptOrdinaryLines(group.item.lines, type, mods.includes('inverted')), cotised: null, fimbriated: null };
  return canonical(replaceGroup(d, path, { ...group, item, count: thin ? ORDINARY_COUNTS[type]![0] : 1 }));
}

/** The toggles the band or shape at `path` takes (none for a top band, a border or a charge), blocked where turning one over breaks a rule. */
export function toggleChoices(d: Design, path: GroupPath): Choice<ShapeToggle>[] {
  const item = drawnOrdinaryAt(d, path);
  if (!item) return [];
  return SHAPE_TOGGLES.filter((t) => (t === 'thin' ? thinnable(item.type) : modDrawn(item.type, t))).map((t) => {
    if (t === 'thin') {
      const next = thinned(d, path, !THIN_ORDINARIES.includes(item.type));
      return choice(t, ordinaryLineProblem(groupAt(next, path)) ?? treatmentRuleProblem(next, path) ?? corePracticeProblem(next));
    }
    if (t === 'inverted' && isPall(item.type)) {
      const turned = pallTurned(d, path, item.type === 'pall');
      return choice(t, ordinaryLineProblem(groupAt(turned, path)) ?? treatmentRuleProblem(turned, path));
    }
    const mods = item.mods.includes(t) ? item.mods.filter((m) => m !== t) : [...item.mods, t];
    return choice(t, modsProblem(d, path, mods));
  });
}

/** Whether the toggle is on. */
export function toggledOn(d: Design, path: GroupPath, t: ShapeToggle): boolean {
  const item = drawnOrdinaryAt(d, path);
  if (t === 'thin') return item !== null && THIN_ORDINARIES.includes(item.type);
  return t === 'inverted' && item?.type === 'pall-inverted' ? true : item?.mods.includes(t) ?? false;
}

/** The band or shape with the toggle on or off. */
export function setToggle(d: Design, path: GroupPath, t: ShapeToggle, on: boolean): Design {
  const item = drawnOrdinaryAt(d, path);
  if (!item || toggledOn(d, path, t) === on) return d;
  if (t === 'thin') return thinned(d, path, on);
  if (t === 'inverted' && isPall(item.type)) return pallTurned(d, path, on);
  return withMods(d, path, on ? [...item.mods, t] : item.mods.filter((m) => m !== t));
}

/** Where the band at `path` is set, raised or lowered (a band that can't be is in its usual place). */
export function bandPositionOf(d: Design, path: GroupPath): BandPosition {
  const mods = drawnOrdinaryAt(d, path)?.mods ?? [];
  return mods.includes('enhanced') ? 'enhanced' : mods.includes('abased') ? 'abased' : 'middle';
}

/** The places a fess, a bend or a chevron may be set (nothing for any other band or shape), blocked where moving it breaks a rule. */
export function bandPositionChoices(d: Design, path: GroupPath): Choice<BandPosition>[] {
  const item = drawnOrdinaryAt(d, path);
  if (!item || !modDrawn(item.type, 'enhanced')) return [];
  return BAND_POSITIONS.map((p) => choice(p, modsProblem(d, path, modsAt(item.mods, p))));
}

/** The treatments with the band set at `position`. */
const modsAt = (mods: readonly OrdinaryMod[], position: BandPosition): OrdinaryMod[] =>
  [...mods.filter((m) => m !== 'enhanced' && m !== 'abased'), ...(position === 'middle' ? [] : [position])];

/** The band set at `position`. */
export function setBandPosition(d: Design, path: GroupPath, position: BandPosition): Design {
  const item = drawnOrdinaryAt(d, path);
  return item ? withMods(d, path, modsAt(item.mods, position)) : d;
}

/** The treatments a band or shape keeps when it is replaced by another type: those the new type takes, unless together they can't be. */
export function keptMods(mods: readonly OrdinaryMod[], type: OrdinaryType): OrdinaryMod[] {
  const kept = mods.filter((m) => modDrawn(type, m));
  return modsClash(type, kept) ? [] : kept;
}

// ── Outline ─────────────────────────────────────────────────────────────────

/** The band or shape at `path` when it is a central one other than thin bands: those alone have an outline. */
function outlinedAt(d: Design, path: GroupPath): Ordinary | null {
  const item = drawnOrdinaryAt(d, path);
  return item && ORDINARY_KIND[item.type] === 'central' && !isDiminutive(item.type) ? item : null;
}

/** The outline the band or shape at `path` has. */
export function outlineAt(d: Design, path: GroupPath): Outline {
  const item = drawnOrdinaryAt(d, path);
  return item ? outlineOf(item) : 'none';
}

/** Why the band or shape at `path` can't be as it is, or null: the rules of its own line, of voiding, fimbriation and cotises (SENA A3C) and a second step from core practice — never the tinctures. */
function outlineProblem(d: Design, path: GroupPath): string | null {
  return ordinaryLineProblem(groupAt(d, path)) ?? treatmentRuleProblem(d, path) ?? corePracticeProblem(d);
}

/** The paints to try for an outline, best first: the one it had, the band's own tincture for cotises (which usually share it), then each tincture (the band's own last for an edging). */
function outlinePaints(own: Tincture | null, outline: Outline, preferred: Paint | null): Paint[] {
  const tinctures = own === null ? TINCTURES : outline === 'fimbriated' ? [...TINCTURES.filter((t) => t !== own), own] : [own, ...TINCTURES.filter((t) => t !== own)];
  const edging = outline === 'fimbriated';
  const kept = preferred && ((preferred.k === 'tincture' && !(edging && preferred.t === own)) || (preferred.k === 'counterchanged' && !edging)) ? [preferred] : [];
  return [...kept, ...tinctures.map((t) => paintOfGroupTincture(t))];
}

/** The design with the band or shape at `path` given this outline, based on the cotises or edging `base` had; its paint is `preferred` or the first that stands out where it lies. */
function outlined(d: Design, path: GroupPath, base: Ordinary, outline: Outline, preferred: Paint | null): Design {
  const group = groupAt(d, path);
  const make = (paint: Paint): Design => canonical(replaceGroup(d, path, { ...group, item: withOutline(base, outline, paint) }));
  if (outline === 'none') return make(paintOfGroupTincture('or'));
  const own = group.paint.k === 'tincture' ? group.paint.t : null;
  const paints = outlinePaints(own, outline, preferred);
  return make(paints.find((p) => trimTinctureIssues(make(p), path).length === 0) ?? paints[0]);
}

/** The outlines a central band or shape may have (none for a top band, a border or a picture), blocked where one breaks a rule of its own; never by what lies on it. */
export function outlineChoices(d: Design, path: GroupPath): Choice<Outline>[] {
  const item = outlinedAt(d, path);
  if (!item) return [];
  return OUTLINES.map((o) => choice(o, o === 'none' ? null : outlineProblem(outlined(d, path, item, o, outlinePaintOf(item)), path)));
}

/** The band or shape with this outline, its tincture kept where it works there, else the first that does (a cotised one in its own, to begin with). */
export function setOutline(d: Design, path: GroupPath, outline: Outline): Design {
  const item = outlinedAt(d, path);
  return item && outlineOf(item) !== outline ? outlined(d, path, item, outline, outlinePaintOf(item)) : d;
}

/** The band or shape at `path` with the outline `from` had, when it may have it; else as it is. */
export function keptOutline(d: Design, path: GroupPath, from: Ordinary): Design {
  const item = outlinedAt(d, path);
  const outline = outlineOf(from);
  if (!item || outline === 'none') return d;
  const next = outlined(d, path, { ...item, cotised: from.cotised, fimbriated: from.fimbriated }, outline, outlinePaintOf(from));
  return outlineProblem(next, path) ? d : next;
}

/** The tincture of the outline, or null when there is none. */
export function outlineTinctureOf(d: Design, path: GroupPath): GroupTincture | null {
  const item = outlinedAt(d, path);
  const paint = item && outlinePaintOf(item);
  return paint ? groupTinctureOf(paint) : null;
}

/** The tinctures of the outline (the field's swapped colours too, for cotises on a divided or striped background), blocked where they don't stand out against what the outline lies on. */
export function outlineTinctureChoices(d: Design, path: GroupPath): Choice<GroupTincture>[] {
  const item = outlinedAt(d, path);
  const outline = item ? outlineOf(item) : 'none';
  if (!item || outline === 'none') return [];
  const swapped = outline !== 'fimbriated' && ((d.kind === 'arms' && (d.field.k === 'divided' || d.field.k === 'variation')) || outlineTinctureOf(d, path) === 'counterchanged');
  return (swapped ? GROUP_TINCTURES : TINCTURES).map((t) => choice(t, trimTinctureIssues(withOutlinePaint(d, path, paintOfGroupTincture(t)), path)[0]?.message ?? null));
}

/** The band or shape's outline in this tincture. */
export function setOutlineTincture(d: Design, path: GroupPath, t: GroupTincture): Design {
  return withOutlinePaint(d, path, paintOfGroupTincture(t));
}
