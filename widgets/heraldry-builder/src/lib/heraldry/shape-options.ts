// The builder's edge controls: which lines of partition a divided or striped background may be drawn with, which of a quartered
// field's two lines carry it, and the designs they lead to. A line is blocked only by what is wrong with the background itself
// (a line the division can't take, a dark pair across a wavy line, App H); never by what lies on it.

import { DRAWN_LINES, bareLines, lineAllowed, type EdgeHost, type Line } from './lines';
import { PLAIN_LINES, canonical, type Design, type Lines, type Paint } from './design';
import { choice, type Choice } from './options';
import { structuralIssues } from './structure';
import { LINED_VARIATIONS, type Division, type Variation } from './divisions';

/** What an edge control edits: the background (the groups' edges come with the bands' phase). */
export type EdgeTarget = { k: 'field' };

/** Which of a two-edge host's lines carry the line: both, the first (the per pale line of a quartered field), or the second (its per fess line). */
export type EdgeSide = 'both' | 'a' | 'b';

/** The host the background's lines belong to, or null when it has none the builder draws a line on. */
function fieldHost(d: Design): EdgeHost | null {
  if (d.kind !== 'arms') return null;
  if (d.field.k === 'divided') return { k: 'division', division: d.field.division };
  return d.field.k === 'variation' && LINED_VARIATIONS.includes(d.field.variation) ? { k: 'variation', variation: d.field.variation } : null;
}

/** The lines of the background (plain for any other). */
function fieldLines(d: Design): Lines {
  return d.kind === 'arms' && (d.field.k === 'divided' || d.field.k === 'variation') ? d.field.lines : PLAIN_LINES;
}

/** The background with these lines; any other background is unchanged. */
function withFieldLines(d: Design, lines: Lines): Design {
  if (d.kind !== 'arms' || (d.field.k !== 'divided' && d.field.k !== 'variation')) return d;
  const field: Paint = { ...d.field, lines: { ...lines } };
  return canonical({ ...d, field });
}

/** The line a host carries on the edges `side` names. */
function linesOn(host: EdgeHost, line: Line, side: EdgeSide): Lines {
  if (line === 'plain') return { ...PLAIN_LINES };
  const both = bareLines(host, line);
  return side === 'both' ? both : side === 'a' ? { a: both.a, b: 'plain' } : { a: 'plain', b: both.b };
}

/** The line of the background: its first complex line, or plain. */
function currentLine(lines: Lines): Line {
  return lines.a !== 'plain' ? lines.a : lines.b;
}

/** Every line the background's host may carry, in the order the builder offers them, blocked where the result breaks a rule of the background itself. */
export function lineChoices(d: Design, target: EdgeTarget): Choice<Line>[] {
  const host = target.k === 'field' ? fieldHost(d) : null;
  if (!host) return [];
  const side = edgeSideOf(d, target);
  return (['plain', ...DRAWN_LINES] as const).filter((l) => l === 'plain' || lineAllowed(host, l)).map((line) => {
    const issue = structuralIssues(withFieldLines(d, linesOn(host, line, side))).find((i) => i.code === 'structure' && i.rule === 'line' && i.at.k === 'field');
    return choice(line, issue?.message ?? null);
  });
}

/** The background drawn with this line on all of its lines (or on the side already chosen, for a quartered field). */
export function setLine(d: Design, target: EdgeTarget, line: Line): Design {
  const host = target.k === 'field' ? fieldHost(d) : null;
  return host ? withFieldLines(d, linesOn(host, line, edgeSideOf(d, target))) : d;
}

/** Which lines carry the line now: 'both' unless one of a two-edge host's lines is plain. */
export function edgeSideOf(d: Design, target: EdgeTarget): EdgeSide {
  const { a, b } = target.k === 'field' ? fieldLines(d) : PLAIN_LINES;
  return a !== 'plain' && b === 'plain' ? 'a' : a === 'plain' && b !== 'plain' ? 'b' : 'both';
}

/** The sides a quartered field's line may be drawn on, once it has one; nothing for a host with a single line. */
export function edgeSideChoices(d: Design, target: EdgeTarget): Choice<EdgeSide>[] {
  const host = target.k === 'field' ? fieldHost(d) : null;
  if (host?.k !== 'division' || host.division !== 'quarterly' || currentLine(fieldLines(d)) === 'plain') return [];
  return (['both', 'a', 'b'] as const).map((side) => choice(side, null));
}

/** The quartered background with its line drawn on these sides. */
export function setEdgeSide(d: Design, target: EdgeTarget, side: EdgeSide): Design {
  const host = target.k === 'field' ? fieldHost(d) : null;
  return host ? withFieldLines(d, linesOn(host, currentLine(fieldLines(d)), side)) : d;
}

/** The lines a division or stripes in the background keeps when it replaces the one it had: those the new host may carry, else plain. */
export function keptLines(lines: Lines, host: Division | Variation, kind: 'division' | 'variation'): Lines {
  const edgeHost: EdgeHost = kind === 'division' ? { k: 'division', division: host as Division } : { k: 'variation', variation: host as Variation };
  if (kind === 'variation' && !LINED_VARIATIONS.includes(host as Variation)) return { ...PLAIN_LINES };
  const carried = (l: Line) => l === 'plain' || lineAllowed(edgeHost, l);
  return carried(lines.a) && carried(lines.b) ? { ...lines } : { ...PLAIN_LINES };
}
