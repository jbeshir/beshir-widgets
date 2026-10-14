// What the armorial test and the ignore list make of each SCA armory record, in one place so the
// two can't drift apart. A record passes when the widget does everything with it a person could ask
// of the builder — five checks, in order:
//   match   — the matcher (explainMatch) finds the widget design that blazons as the SCA does;
//   assess  — the builder would let that design be registered;
//   blazon  — the widget's blazon() of it (in house style, or with its defaults stated) equals the SCA blazon under normaliseBlazon();
//   render  — <Shield> draws its field, ordinary and charges;
//   builder — the Design tab's controls build it, every click offered and allowed.
// A record that doesn't pass is a gap, tagged `<category>` or `<category>:<subtag>` (GAP_CATEGORIES):
// first what the matcher and the widget's own checks found ("widget findings"), else what the gap
// tagger reads in the blazon. A matched, registrable design that then fails to blazon, render or
// build is no gap but a widget bug: status 'fails', which the ignore list never hides.
import { blazon, canonicalJson, groupAt, hasChief, layoutContext, layoutKey, type Design, type Issue } from '../../src/lib/heraldry';
import { tagGaps } from './gaps';
import type { Gap } from '../../src/lib/heraldry';
import { arrangementPhrases, explainMatch, wordedAs, type MatchResult } from './match';
import type { ArmoryRecord } from './oanda';
import { builderPath } from '../builder-path';
import { assessMatched, checkRendered, renderShieldSvg } from './widget-checks';

export type CheckName = 'match' | 'assess' | 'blazon' | 'render' | 'builder';

export interface CheckFailure {
  check: CheckName;
  detail: string;
}

export interface Classification {
  /** passes — every check passed; gap — `tags` say why not; fails — a widget bug (`failures`). */
  status: 'passes' | 'gap' | 'fails';
  /** The failed checks, in check order; [] when it passes. */
  failures: CheckFailure[];
  /** Sorted gap tags; non-empty exactly when the status is 'gap'. */
  tags: string[];
}

// ── Checks ──────────────────────────────────────────────────────────────────

/** The design-only checks, once per distinct design: many records match the same one. */
const designChecks = new Map<string, Record<'assess' | 'render' | 'builder', string | null>>();

function checkDesign(design: Design) {
  const key = canonicalJson(design);
  let found = designChecks.get(key);
  if (!found) {
    const a = assessMatched(design);
    const rendered = checkRendered(design, renderShieldSvg(design));
    const path = builderPath(design);
    found = {
      assess: a.kind === 'ok' ? null : `${a.kind === 'violation' ? a.status : a.kind}: ${a.issues.map((i) => i.message).join(' ')}`,
      render: rendered.length ? rendered.join('; ') : null,
      builder: path.problems.length ? path.problems.join('; ') : null,
    };
    designChecks.set(key, found);
  }
  return found;
}

function noMatchDetail(m: MatchResult): string {
  switch (m.status) {
    case 'fieldless': return 'no widget design: the armory is fieldless';
    case 'vocabulary': return `no widget design: "${m.unknownWord}" is not a word the widget blazons`;
    case 'unparsed': return 'no widget design: not in a form the matcher proposes';
    case 'unsupported': return `no widget design: the widget doesn't draw ${m.gaps!.map(gapTag).join(', ')}`;
    default: return `no widget design: the nearest widget blazon is "${m.candidates[0].normalised}"`;
  }
}

const gapTag = (g: Gap): string => `${g.category}:${g.detail}`;

/** The five checks for one SCA blazon, with the matcher's verdict. */
export function checkBlazon(scaBlazon: string): { match: MatchResult; failures: CheckFailure[] } {
  const match = explainMatch(scaBlazon);
  if (!match.match) return { match, failures: [{ check: 'match', detail: noMatchDetail(match) }] };
  const design = match.match.design!;
  const found = checkDesign(design);
  const ours = blazon(design);
  const failures: CheckFailure[] = [];
  if (found.assess) failures.push({ check: 'assess', detail: found.assess });
  if (!wordedAs(match.match, match.normalised)) failures.push({ check: 'blazon', detail: `the widget blazons it "${ours}"` });
  if (found.render) failures.push({ check: 'render', detail: found.render });
  if (found.builder) failures.push({ check: 'builder', detail: found.builder });
  return { match, failures };
}

// ── Gap tags ────────────────────────────────────────────────────────────────

/** Where a structurally illegal charge group sits: "on-bend", "between-fess", "under-chief", "in-saltire". */
function layoutTag(design: Design, issue: Issue): string {
  if (issue.at.k !== 'group') return issue.at.k;
  const g = groupAt(design, issue.at.path);
  if (g.item.k !== 'charge') return 'design';
  const ctx = layoutContext(design, issue.at.path);
  switch (ctx.k) {
    case 'on': return `on-${ctx.ordinary}`;
    case 'between': return `between-${ctx.ordinary}`;
    default: return hasChief(ctx.peripheral) ? 'under-chief' : layoutKey({ arrangement: g.arrangement, position: g.position });
  }
}

/** The widget's objections to a matched design, as finding tags; [] when it has none. */
function findingTags(design: Design): string[] {
  const a = assessMatched(design);
  if (a.kind !== 'violation') return [];
  const tag = (i: Issue) => {
    // A construct the library reports only once the design is judged (charges Table 7 forces into one part).
    if (i.code === 'unsupported') return gapTag(i.gap);
    if (i.code === 'tincture') {
      if (i.at.k !== 'group') return 'tincture-rule-differs:field';
      const g = groupAt(design, i.at.path);
      return `tincture-rule-differs:${g.paint.k === 'counterchanged' ? 'counterchanged' : g.item.k === 'ordinary' ? 'ordinary' : 'charges'}`;
    }
    // Charges that don't fit a host at a legible size are a limit of the drawing, not a rule: a count the widget doesn't lay out.
    if (i.code === 'structure' && i.rule === 'capacity' && i.at.k === 'group') return `placement:${layoutTag(design, i)}-${groupAt(design, i.at.path).count}`;
    return `widget-structure-rule:${i.code === 'generic' ? 'plain-field' : layoutTag(design, i)}`;
  };
  return a.issues.map(tag);
}

/**
 * The tag for a near-miss on arrangement words alone, or null. It counts only when the widget
 * could register the design: an illegal one ("a saltire between two crescents") is a placement
 * gap, which the tagger reports.
 */
function arrangementWording(m: MatchResult): string | null {
  const near = m.wordingCandidate;
  if (!near || near.issues.length) return null;
  // The SCA states an arrangement the widget leaves unsaid (its own default), or the reverse.
  const sca = arrangementPhrases(m.normalised).length;
  const widget = arrangementPhrases(near.normalised!).length;
  return `blazon-wording-differs:${!widget ? 'sca-states-arrangement' : !sca ? 'widget-states-arrangement' : 'arrangement-differs'}`;
}

function gapTags(record: ArmoryRecord, m: MatchResult): string[] {
  if (m.match) {
    const design = m.match.design!;
    return findingTags(design);
  }
  const wording = arrangementWording(m);
  if (wording) return [wording];
  // A proposal the widget parsed but doesn't draw names its gaps exactly.
  if (m.gaps) return m.gaps.map(gapTag);
  const tags = tagGaps(record);
  return tags.length ? tags : [`other:${m.status}`];
}

export function classify(record: ArmoryRecord): Classification {
  const { match, failures } = checkBlazon(record.blazon);
  if (!failures.length) return { status: 'passes', failures, tags: [] };
  const tags = [...new Set(gapTags(record, match))].sort();
  return { status: tags.length ? 'gap' : 'fails', failures, tags };
}

/** A readable listing of problem lines: a header with the count, then at most `cap` lines. */
export function listing(title: string, lines: readonly string[], cap = 40): string {
  const more = lines.length > cap ? [`… and ${lines.length - cap} more`] : [];
  return [`${title}: ${lines.length}`, ...lines.slice(0, cap).map((l) => `  ${l}`), ...more].join('\n');
}

/** One record's failed checks, one line each: key, blazon, check and detail. */
export const failureLines = (record: ArmoryRecord, failures: readonly CheckFailure[]): string[] =>
  failures.map((f) => `${record.key} "${record.blazon}" — ${f.check}: ${f.detail}`);
