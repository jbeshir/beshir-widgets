// The builder's edge controls: which lines a divided or striped background, or a band or shape, may be drawn with, which of a quartered
// field's two lines (or a band's two edges) carry it, and the designs they lead to. A line is blocked only by what is wrong with the host
// itself (a line it can't take, a dark pair across a wavy line, App H, a second step from core practice); never by what lies on it.

import { DRAWN_LINES, bareLines, edgeCount, lineAllowed, type EdgeHost, type Line } from './lines';
import { PLAIN_LINES, canonical, groupAt, replaceGroup, type Design, type GroupPath, type Lines, type Paint } from './design';
import { choice, type Choice } from './options';
import { corePracticeProblem, ordinaryLineProblem, structuralIssues } from './structure';
import { DRAWN_ORDINARIES, type OrdinaryType } from './ordinaries';
import { LINED_VARIATIONS, type Division, type Variation } from './divisions';

/** What an edge control edits: the background, or the band, shape, top band or border at `path`. */
export type EdgeTarget = { k: 'field' } | { k: 'group'; path: GroupPath };

/** Which of a two-edge host's lines carry the line: both, the first (the per pale line of a quartered field, a band's upper or dexter edge), or the second (the per fess line, the lower or sinister edge). */
export type EdgeSide = 'both' | 'a' | 'b';

/** The host the target's lines belong to, or null when it has none the builder draws a line on. */
function hostAt(d: Design, target: EdgeTarget): EdgeHost | null {
  if (target.k === 'group') {
    const item = groupAt(d, target.path).item;
    return item.k === 'ordinary' && DRAWN_ORDINARIES.includes(item.type) ? { k: 'ordinary', type: item.type, inverted: item.mods.includes('inverted') } : null;
  }
  if (d.kind !== 'arms') return null;
  if (d.field.k === 'divided') return { k: 'division', division: d.field.division };
  return d.field.k === 'variation' && LINED_VARIATIONS.includes(d.field.variation) ? { k: 'variation', variation: d.field.variation } : null;
}

/** The lines of the target (plain for any that has none). */
function linesAt(d: Design, target: EdgeTarget): Lines {
  if (target.k === 'group') {
    const item = groupAt(d, target.path).item;
    return item.k === 'ordinary' ? item.lines : PLAIN_LINES;
  }
  return d.kind === 'arms' && (d.field.k === 'divided' || d.field.k === 'variation') ? d.field.lines : PLAIN_LINES;
}

/** The design with the target drawn with these lines; a target without any is unchanged. */
function withLinesAt(d: Design, target: EdgeTarget, lines: Lines): Design {
  if (target.k === 'group') {
    const group = groupAt(d, target.path);
    return group.item.k === 'ordinary' ? canonical(replaceGroup(d, target.path, { ...group, item: { ...group.item, lines: { ...lines } } })) : d;
  }
  if (d.kind !== 'arms' || (d.field.k !== 'divided' && d.field.k !== 'variation')) return d;
  const field: Paint = { ...d.field, lines: { ...lines } };
  return canonical({ ...d, field });
}

/** What is wrong with the lines of the target, or null: the rule of its own they break, or (for a band) a second step from core practice. */
function lineProblem(d: Design, target: EdgeTarget): string | null {
  if (target.k === 'group') return ordinaryLineProblem(groupAt(d, target.path)) ?? corePracticeProblem(d);
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
  if (!host) return [];
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

/** The lines a band or shape keeps when it is replaced by another type: its line where the new type may carry it (as that type's blazon bares it), else plain. */
export function keptOrdinaryLines(lines: Lines, type: OrdinaryType): Lines {
  const host: EdgeHost = { k: 'ordinary', type, inverted: false };
  const line = currentLine(lines);
  return line !== 'plain' && lineAllowed(host, line) ? bareLines(host, line) : { ...PLAIN_LINES };
}
