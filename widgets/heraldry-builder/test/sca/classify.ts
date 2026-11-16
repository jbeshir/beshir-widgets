// What the armorial test and the ignore list make of each SCA armory record, in one place so the
// two can't drift apart. A record passes when the widget does everything with it a person could ask
// of the builder — five checks, in order:
//   match   — the matcher (explainMatch) finds the widget design that blazons as the SCA does;
//   assess  — the builder would let that design be registered;
//   blazon  — the widget's blazon() of it equals the SCA blazon under normaliseBlazon();
//   render  — <Shield> draws its field, ordinary and charges;
//   builder — the Design tab's controls build it, every click offered and allowed.
// A record that doesn't pass is a gap, tagged `<category>` or `<category>:<subtag>` (GAP_CATEGORIES):
// first what the matcher and the widget's own checks found ("widget findings"), else what the gap
// tagger reads in the blazon. A matched, registrable design that then fails to blazon, render or
// build is no gap but a widget bug: status 'fails', which the ignore list never hides.
import { blazon } from '../../src/lib/heraldry/blazon';
import { chargeContext, type Issue, type NormDesign } from '../../src/lib/heraldry/design';
import { tagGaps } from './gaps';
import { arrangementPhrases, explainMatch, type MatchResult } from './match';
import { normaliseBlazon } from './normalise';
import type { ArmoryRecord } from './oanda';
import { assessMatched, builderPath, checkRendered, renderShieldSvg } from './widget-checks';

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

function checkDesign(design: NormDesign) {
  const key = JSON.stringify(design);
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
    case 'unparsed': return 'no widget design: not in a form the widget blazons';
    case 'unstated': return 'no widget design: the SCA leaves the arrangement to a default the widget lacks';
    default: return `no widget design: the nearest widget blazon is "${m.candidates[0].normalised}"`;
  }
}

/** The five checks for one SCA blazon, with the matcher's verdict. */
export function checkBlazon(scaBlazon: string): { match: MatchResult; failures: CheckFailure[] } {
  const match = explainMatch(scaBlazon);
  if (!match.match) return { match, failures: [{ check: 'match', detail: noMatchDetail(match) }] };
  const { design } = match.match;
  const found = checkDesign(design);
  const ours = blazon(design);
  const failures: CheckFailure[] = [];
  if (found.assess) failures.push({ check: 'assess', detail: found.assess });
  if (normaliseBlazon(ours) !== match.normalised) failures.push({ check: 'blazon', detail: `the widget blazons it "${ours}"` });
  if (found.render) failures.push({ check: 'render', detail: found.render });
  if (found.builder) failures.push({ check: 'builder', detail: found.builder });
  return { match, failures };
}

// ── Gap tags ────────────────────────────────────────────────────────────────

/** Where a structurally illegal charge group sits: "on-bend", "between-fess", "under-chief", "in-saltire". */
function layoutTag(design: NormDesign): string {
  const g = design.charges!;
  switch (chargeContext(design.ordinary, g.placement)) {
    case 'on': return `on-${design.ordinary!.type}`;
    case 'between': return `between-${design.ordinary!.type}`;
    case 'chief': return 'under-chief';
    default: return g.arrangement;
  }
}

/** The widget's objections to a matched design, as finding tags; [] when it has none. */
function findingTags(design: NormDesign): string[] {
  const a = assessMatched(design);
  if (a.kind !== 'violation') return [];
  const tag = (i: Issue) => {
    if (i.code === 'tincture') {
      const counterchanged = i.layer === 'charges' && design.charges?.tincture === 'counterchanged';
      return `tincture-rule-differs:${counterchanged ? 'counterchanged' : i.layer}`;
    }
    return `widget-structure-rule:${i.layer === 'charges' ? layoutTag(design) : i.code === 'generic' ? 'plain-field' : i.layer}`;
  };
  return a.issues.map(tag);
}

/**
 * SCA words for something the widget draws under another name. A record is reworded with the
 * widget's word and matched again; only if the rewording then matches (or misses only on
 * arrangement words) is the difference wording, plus whatever the widget finds wrong with the design.
 */
const WIDGET_WORDS: readonly { id: string; sca: RegExp; widget: string }[] = [
  // The SCA's sun is "in splendour" (with a face) by default; the widget's has none to show.
  { id: 'sun-in-splendour', sca: /\b(suns?) in (?:(?:his|its|their) )?(?:splendou?r|glory)\b/gi, widget: '$1' },
  { id: 'cogwheel', sca: /\bcog-?wheel(s?)\b/gi, widget: 'gear$1' },
];

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
  const widget = arrangementPhrases(near.normalised).length;
  return `blazon-wording-differs:${!widget ? 'sca-states-arrangement' : !sca ? 'widget-states-arrangement' : 'arrangement-differs'}`;
}

/** Tags for a design the widget can draw but words otherwise than the SCA; [] if that's not the case. */
function wordingTags(record: ArmoryRecord, m: MatchResult): string[] {
  const arrangement = arrangementWording(m);
  if (arrangement) return [arrangement];
  const used = WIDGET_WORDS.filter((w) => record.blazon.search(w.sca) >= 0);
  if (!used.length) return [];
  const reworded = explainMatch(used.reduce((text, w) => text.replace(w.sca, w.widget), record.blazon));
  const more = reworded.match ? findingTags(reworded.match.design) : [arrangementWording(reworded)];
  return more.every((t) => t !== null) ? [...used.map((w) => `blazon-wording-differs:${w.id}`), ...more] : [];
}

function gapTags(record: ArmoryRecord, m: MatchResult): string[] {
  if (m.match) return findingTags(m.match.design);
  const wording = wordingTags(record, m);
  if (wording.length) return wording;
  const tags = tagGaps(record);
  if (tags.length) return tags;
  return [m.status === 'unstated' ? 'arrangement-unstated' : `other:${m.status}`];
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
