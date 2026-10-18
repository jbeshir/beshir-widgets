// Structural rules: a legal combination of ids that still isn't a design (SENA A3B3a, A3E3, App I3, Table 7
// layouts), room for the charges (layout.ts) and the per-fess chief rule (A3D1c). Messages are phrased
// so they can double as the reason shown next to a blocked option.

import { TINCTURE_CLASS, TINCTURE_NAME, type Tincture } from './tinctures';
import { capitalise, joinAnd, numberWord } from './words';
import { CHARGES, chargePhrase, type ChargeId } from './charges';
import { DIVISION_NAME, VARIATION_NAME, adjacentParts, partCount, type Division } from './divisions';
import { LINE_GROUP, LINE_WORD, edgeCount, isStraightLine, lineAllowed, ordinaryEdgeHost, type ComplexLine, type EdgeHost, type Line } from './lines';
import { surfaceOf, type Surface } from './surface';
import type { Ground } from './contrast';
import { divisionCutsOrdinary, specOf } from './ordinary-geometry';
import { asParty, asTreated, asVariation, bodyTinctures, fieldParts, itemKey, itemName, primaryGroup, primaryGroups, walkGroups, type Design, type Group, type GroupPath, type Issue, type Paint } from './design';
import { capacityIssue, onChargeWords } from './layout';
import { posturesClash } from './difference';
import { strewnIssues } from './strewn';
import { TWO_PART_DIVISIONS, groundShares, onDivisionLine, paintName } from './tincture-rule';
import { MOD_HOSTS, ORDINARY_NAME, ORDINARY_KIND, REFUSED_ORDINARIES, ordinaryWithArticle, type OrdinaryType } from './ordinaries';
import { AROUND_COUNTS, coPrimaries, contextOf, drawnLayout, hasChief, isHalfPosition, layoutCandidates, layoutKey, layoutWords, primaryCharges, shareTotal, type LayoutContext } from './arrangement';

/** "a rose" / "three roses": a group's charges in words. */
function chargesPhrase(g: Group): string {
  return g.item.k === 'charge' ? chargePhrase(g.item.charge, g.count) : ORDINARY_NAME[g.item.type];
}

/** Why a charge group's count, arrangement and position don't make a layout, or null when they do. */
function layoutIssue(d: Design, path: GroupPath, g: Group, ctx: LayoutContext): string | null {
  if (g.item.k !== 'charge') return null;
  const meta = CHARGES[g.item.charge];
  if (g.arrangement.k === 'pair' && g.count !== 2) return `Only two charges can be ${g.arrangement.pair}.`;
  // A pair stands as two charges in fess do, or where the ordinary they are set around places them (§1.1 F8).
  const layout = drawnLayout(ctx, { arrangement: g.arrangement, position: g.position });
  const a = layout.arrangement;
  switch (ctx.k) {
    case 'position': {
      if (ctx.position !== 'base' && hasChief(ctx.peripheral)) return `There is no room to set charges in ${ctx.position} when the design has a chief.`;
      if (layoutCandidates(d, path, g.count).some((c) => layoutKey(c) === layoutKey(layout))) return null;
      return `${capitalise(chargesPhrase(g))} in ${ctx.position} can't be arranged ${layoutWords({ ...layout, position: null })}.`;
    }
    case 'around': {
      // A count with no layout around the primary charges at all is a gap (support.ts). Table 7 asks most of these counts to be
      // specified, so another stated arrangement may be registrable: the message speaks for this builder, not the rule.
      const candidates = layoutCandidates(d, path, g.count);
      if (candidates.some((c) => layoutKey(c) === layoutKey(layout)) || !AROUND_COUNTS.includes(g.count)) return null;
      return `${capitalise(chargesPhrase(g))} around the ${ctx.primary.count === 1 ? 'charge' : 'charges'} in the middle can be set ${candidates.map(layoutWords).join(' or ')} in this builder — not ${layoutWords(layout)}.`;
    }
    case 'overall': {
      // One charge alone, or two long charges crossed; any other count is a gap (support.ts).
      const candidates = layoutCandidates(d, path, g.count);
      if (candidates.length === 0 || candidates.some((c) => layoutKey(c) === layoutKey(layout))) return null;
      return `${capitalise(chargesPhrase(g))} overall can be set ${candidates.map(layoutWords).join(' or ')} — not ${layoutWords(layout)}.`;
    }
    case 'on-charge': {
      // Every count but one must be stated (Table 7), and this builder offers only some layouts for it.
      const candidates = layoutCandidates(d, path, g.count);
      if (candidates.length === 0 || candidates.some((c) => layoutKey(c) === layoutKey(layout))) return null;
      return `${capitalise(chargesPhrase(g))} ${onChargeWords(ctx.host)} can be set ${candidates.map(layoutWords).join(' or ')} in this builder — not ${layoutWords(layout)}.`;
    }
    case 'between': case 'on': {
      const where = ctx.k === 'on' ? 'on' : 'around';
      return a.k === 'host' && g.position === null
        ? null
        : `Charges ${where} the ${ORDINARY_NAME[ctx.ordinary.type]} are placed by it — they can't be arranged ${layoutWords(layout)}.`;
    }
    case 'field': break;
    default: return ctx satisfies never;
  }
  if (a.k === 'host') return `${capitalise(chargesPhrase(g))} on the field can't be placed by an ordinary — choose an arrangement.`;
  if ((g.position === 'chief' || g.position === 'base') && hasChief(ctx.peripheral)) {
    return `There is no room to set charges in ${g.position} when the design has a chief.`;
  }
  if (ctx.share) {
    const together = layoutCandidates(d, path, g.count);
    if (together.some((c) => layoutKey(c) === layoutKey(layout))) return null;
    return `${capitalise(numberWord(shareTotal(ctx.share, g.count)))} main pictures together can be arranged ${together.map(layoutWords).join(', ')} — not ${layoutWords(layout)}.`;
  }
  if (a.k === 'crossed' && !meta.long) return 'Only long charges such as swords, keys and anchors can be crossed.';
  const candidates = layoutCandidates(d, path, g.count);
  if (candidates.some((c) => layoutKey(c) === layoutKey(layout))) return null;
  if (g.count === 1) return 'A single charge sits alone in the centre.';
  const noun = capitalise(`${numberWord(g.count)} ${meta.plural}`);
  // In a half or quarter of the field is a way to set any of them; the rest are listed.
  const here = candidates.filter((c) => !isHalfPosition(c.position));
  const halves = here.length < candidates.length ? ', or in a half or quarter of the field' : '';
  return `${noun} can be arranged ${here.map(layoutWords).join(', ')}${halves} — not ${layoutWords(layout)}.`;
}

/**
 * How much of the middle of a charge (its sampled ground) must lie on each side of the line for the charge to overlie
 * the line (A3D1c) rather than graze it: a tenth puts the line within a fifth of the charge's size of its centre, so
 * some three tenths of its height lie across. Herald question H7 (REVIEW.md).
 */
const OVERLIES_SHARE = 1 / 10;

/** Whether some charge of the primary groups overlies the line of division on the heater, or they have no room to be judged (the capacity rule says so). */
function crossesTheLine(d: Design): boolean {
  const primaries = primaryGroups(d);
  if (primaries.length === 0) return false;
  const grounds = primaries.flatMap((p) => groundShares(d, p.path));
  return grounds.every((g) => g.length === 0) || grounds.some(overlies);
}

/** Whether a ground lies across a line: more than one part under it, each with a fair share (`OVERLIES_SHARE`). */
const overlies = (g: readonly { share: number }[]): boolean => g.length > 1 && g.every((s) => s.share >= OVERLIES_SHARE);

/**
 * Whether a chief over a field per fess could be read as one fess on a plain field, so that the division needs a charge across it (SENA
 * A3D1c): when the chief's line and the division's could be the upper and lower edges of a registrable fess — the same line, or one edge
 * plain and the other not jagged ("we do not allow a fess to be indented on the upper edge only"). Straight-group lines count as plain
 * (RULES-C §A.5.5).
 */
export function couldBeOneFess(upper: Line, lower: Line): boolean {
  const [u, l] = [upper, lower].map((x) => (isStraightLine(x) ? 'plain' : x));
  if (u === l) return true;
  const treated = u === 'plain' ? l : l === 'plain' ? u : null;
  return treated !== null && LINE_GROUP[treated] !== 'jagged';
}

/** Why a host can't carry this line (RULES-C §A.1, §A.5; PLAN-C §4 L7), or null; `what` names the host in the message. */
function lineHostProblem(host: EdgeHost, line: Line, what: string): string | null {
  if (line === 'plain' || lineAllowed(host, line)) return null;
  switch (line) {
    case 'dancetty': return `Dancetty is for two-sided bands; ${what} is drawn indented.`;
    case 'enarched': return host.k === 'ordinary' || host.k === 'cotises'
      ? `An arched (enarched) line is drawn on a fess, a bend, a chevron or a chief only — not ${what}.`
      : `An arched (enarched) line divides a field per fess, per bend or per chevron only — not ${what}.`;
    case 'ploye': return host.k === 'ordinary' || host.k === 'cotises' ? `A bowed (ployé) line is drawn on a chevron or a pile only — not ${what}.` : `A bowed (ployé) line divides a field per chevron only — not ${what}.`;
    case 'triangular': return `A triangular line is drawn on a chief only — not ${what}.`;
    case 'rompu': return `A broken (rompu) line is drawn on a chevron only — not ${what}.`;
    case 'bevilled': return host.k === 'ordinary' ? `A bevilled line is drawn on a bend or a bend sinister only — not ${what}.` : `A bevilled line divides a field per bend or per bend sinister only — not ${what}.`;
    case 'embattled': case 'wavy': case 'engrailed': case 'invected': case 'indented': case 'nebuly': case 'raguly': case 'rayonny': case 'dovetailed':
    case 'urdy': case 'potenty': case 'bretessed': case 'grady': case 'arrondi':
      return `${capitalise(what)} can't be drawn ${LINE_WORD[line]}.`;
    default: return line satisfies never;
  }
}

/** The line problem of a divided or varied paint, or null (any other paint has no line). */
function paintLineProblem(p: Paint): string | null {
  if (p.k === 'divided') {
    const host: EdgeHost = { k: 'division', division: p.division };
    const what = `a field divided ${DIVISION_NAME[p.division]}`;
    return lineHostProblem(host, p.lines.a, what) ?? lineHostProblem(host, p.lines.b, what);
  }
  return p.k === 'variation' ? lineHostProblem({ k: 'variation', variation: p.variation }, p.lines.a, VARIATION_NAME[p.variation]) : null;
}

/** The host an ordinary's lines are on. */

/** The one line drawn on one edge of a two-edge band, the other edge plain; null otherwise. */
function oneEdgeLine(g: Group): ComplexLine | null {
  if (g.item.k !== 'ordinary' || edgeCount(ordinaryEdgeHost(g.item)) !== 2) return null;
  const { a, b } = g.item.lines;
  return a === 'plain' && b !== 'plain' ? b : b === 'plain' && a !== 'plain' ? a : null;
}

/** Lines that take no further line with them — not on the ordinary's other edge, nor on its cotises (RULES-C §A.5: "a chief triangular embattled"). */
const NO_FURTHER_LINE: readonly Line[] = ['triangular', 'rompu'];

/**
 * The line problem of an ordinary's edges (RULES-C §A.3, §A.5), or null: a line its host can't take (dancetty off a two-sided band; enarched,
 * ployé off theirs), two different lines on one ordinary ("one complex line per charge", LoAR 08/2012), or a jagged line on one edge of a band
 * alone ("we do not allow a fess to be indented on the upper edge only", SENA A3D1c).
 */
export function ordinaryLineProblem(g: Group): string | null {
  if (g.item.k !== 'ordinary') return null;
  const host = ordinaryEdgeHost(g.item), { a, b } = g.item.lines;
  const what = ordinaryWithArticle(g.item.type);
  const hosted = lineHostProblem(host, a, what) ?? lineHostProblem(host, b, what)
    ?? (g.item.cotised && lineHostProblem({ k: 'cotises', type: g.item.type }, g.item.cotised.line, `the cotises of ${what}`));
  if (hosted) return hosted;
  if (a !== 'plain' && b !== 'plain' && a !== b) return `${capitalise(what)} carries one line: it can't be ${LINE_WORD[a]} on one edge and ${LINE_WORD[b]} on the other.`;
  const lone = [a, b].find((l): l is ComplexLine => NO_FURTHER_LINE.includes(l));
  const cotised = g.item.cotised?.line;
  if (lone && cotised && cotised !== 'plain') return `${capitalise(what)} ${LINE_WORD[lone]} takes no further line, so its cotises can't be ${LINE_WORD[cotised]} (RULES-C §A.5).`;
  const one = oneEdgeLine(g);
  if (one && LINE_GROUP[one] === 'jagged') return `${capitalise(what)} can't be ${LINE_WORD[one]} on one edge only — draw both edges ${LINE_WORD[one]} (RULES-C §A.5, L5, after an example in SENA A3D1c).`;
  return null;
}

/**
 * What an ordinary's treatments rule out, or null: a chevron inverted and abased carries nothing — charged, it is "at least two steps
 * removed" from what is registrable (RULES-C §D.1, LoAR 11/2005 Voron).
 */
function ordinaryTreatmentProblem(g: Group): string | null {
  const { item } = g;
  if (item.k !== 'ordinary' || item.type !== 'chevron' || !item.mods.includes('inverted') || !item.mods.includes('abased') || g.charged.length === 0) return null;
  return 'A chevron inverted and abased can\'t carry charges: it is too far from how a chevron is drawn to be read with them (LoAR 11/2005, Voron).';
}

/** The ordinaries that may be cotised (RULES-C §D.5): the bands, the chevron and the pile (upright or inverted), the cross and the saltire. */
export const COTISED_HOSTS: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'];

/**
 * What SENA A3C allows of voiding, fimbriation and cotises (RULES-C §D.3–§D.5), or null: voided only a cross or saltire, fimbriated only a
 * central ordinary, both only in the primary group (and voided not in a fieldless badge, which has no field to show through); fimbriated not
 * moved up or down (LoAR 06/2005, Mathild), nor voided as well; cotised only a band, chevron, pile, cross or saltire, and never on a tertiary
 * (Eoforwic 10/2007: two tertiary groups).
 */
function ordinaryTreatmentRuleProblem(d: Design, g: Group): string | null {
  const { item } = g;
  if (item.k !== 'ordinary') return null;
  const name = ORDINARY_NAME[item.type], what = ordinaryWithArticle(item.type);
  const voided = item.mods.includes('voided');
  if (voided && !MOD_HOSTS.voided.includes(item.type)) {
    return `${capitalise(what)} can't be voided: only a cross, a saltire or a pall, with more than two ends, can (SENA A3C) — ${ORDINARY_KIND[item.type] === 'central' ? 'two narrower bands are blazoned instead' : 'choose a solid one'}.`;
  }
  if (item.fimbriated && (ORDINARY_KIND[item.type] !== 'central' || item.type === 'fret')) return `${capitalise(what)} can't be fimbriated: only a band or shape in the middle of the field can (SENA A3C).`;
  if ((voided || item.fimbriated) && g.role !== 'primary') {
    const where = g.role === 'tertiary' ? 'lying on another charge' : g.role === 'overall' ? 'lying overall' : 'set beside it';
    return `Only the main band or shape can be ${voided ? 'voided' : 'fimbriated'}, not one ${where} (SENA A3C).`;
  }
  if (voided && d.kind === 'badge') return 'A fieldless badge has no field to show through a voided charge (SENA A3C).';
  const broken = [item.lines.a, item.lines.b].find((l) => l === 'rompu' || l === 'bevilled');
  if (item.fimbriated && broken) return `${capitalise(what)} ${LINE_WORD[broken]} can't be fimbriated: its outline is broken (SENA A3C).`;
  if (item.fimbriated && (item.mods.includes('enhanced') || item.mods.includes('abased'))) {
    return `${capitalise(what)} ${item.mods.includes('enhanced') ? 'enhanced' : 'abased'} can't be fimbriated (LoAR 06/2005, Mathild).`;
  }
  if (item.fimbriated && voided) return `${capitalise(what)} can't be both voided and fimbriated: voided, it is read as fimbriated already (SENA A5C1).`;
  if (item.cotised && !COTISED_HOSTS.includes(item.type)) return `${capitalise(what)} can't be cotised: only a band, a chevron, a pile, a cross or a saltire can (RULES-C §D.5).`;
  if (item.cotised && g.role === 'tertiary') return `A cotised ${name} can't lie on another charge: with its cotises it would be two groups on it (LoAR 10/2007, Eoforwic).`;
  return null;
}

/**
 * A step from core practice (SENA A2B, App G): a line on one edge of a band alone, other than embattled (its own default) or a jagged line
 * (refused); a charge overall over a fimbriated ordinary; bendlets enhanced with any other charges (RULES-C §D.6); charges around a bend bevilled (F2);
 * any compass star (App G "Compass star", 06/2007 CL); charges in annulo or in orle turned from their default palewise (S2).
 */
type CoreStep = 'one-edge-line' | 'overall-over-fimbriated' | 'enhanced-bendlets-with-charges' | 'bevilled-with-charges' | 'compass-star'
  | 'non-default-orientation-in-annulo-or-orle';

const CORE_STEP_WORDS: Record<CoreStep, string> = {
  'one-edge-line': 'a line on one edge of a band only',
  'overall-over-fimbriated': 'a charge overall over a fimbriated ordinary',
  'enhanced-bendlets-with-charges': 'bendlets enhanced with other charges',
  'bevilled-with-charges': 'charges around a bend bevilled',
  'compass-star': 'a compass star',
  'non-default-orientation-in-annulo-or-orle': 'charges in annulo or in orle turned from upright',
};

/** Bendlets (or bendlets sinister) enhanced, two or more of them. */
const isBendletsEnhanced = (g: Group): boolean =>
  g.item.k === 'ordinary' && (g.item.type === 'bendlet' || g.item.type === 'bendlet-sinister') && g.count > 1 && g.item.mods.includes('enhanced');

/**
 * §1.7 S2, App G: "Charges oriented in annulo instead of their default palewise orientation" and "Charges in orle not in their default
 * orientation" — any orientation but palewise, and in annulo but to center (read as following the annulus: herald question D27). Charges set around a
 * bordure follow it, which is no step: they are charges on the bordure, not in orle.
 */
const turnedInRing = (g: Group): boolean => g.item.k === 'charge' && g.arrangement.k === 'pattern'
  && (g.arrangement.pattern === 'annulo' || g.arrangement.pattern === 'orle') && g.item.orientation !== null && g.item.orientation !== 'palewise'
  && (g.item.orientation !== 'to-center' || g.arrangement.pattern === 'orle');

/** The steps from core practice the design takes, one per element that takes one (SENA App G). */
export function coreSteps(d: Design): CoreStep[] {
  const lines = walkGroups(d).flatMap(({ group }): CoreStep[] => {
    const one = oneEdgeLine(group);
    return one !== null && one !== 'embattled' && LINE_GROUP[one] !== 'jagged' ? ['one-edge-line'] : [];
  });
  const fimbriated = d.groups.some((g) => g.role === 'primary' && g.item.k === 'ordinary' && g.item.fimbriated !== null);
  const overFimbriated: CoreStep[] = fimbriated && d.groups.some((g) => g.role === 'overall') ? ['overall-over-fimbriated'] : [];
  const bendlets: CoreStep[] = d.groups.some(isBendletsEnhanced) && walkGroups(d).some(({ group }) => group.item.k === 'charge') ? ['enhanced-bendlets-with-charges'] : [];
  const bevilled: CoreStep[] = d.groups.some((g) => g.item.k === 'ordinary' && g.item.lines.a === 'bevilled') && d.groups.some((g) => g.role === 'secondary') ? ['bevilled-with-charges'] : [];
  const compassStar: CoreStep[] = walkGroups(d).some(({ group }) => group.item.k === 'charge' && group.item.charge === 'compass-star') ? ['compass-star'] : [];
  const ring: CoreStep[] = walkGroups(d).some(({ group }) => turnedInRing(group)) ? ['non-default-orientation-in-annulo-or-orle'] : [];
  return [...lines, ...overFimbriated, ...bendlets, ...bevilled, ...compassStar, ...ring];
}

/** Why the design is more than one step from core practice (SENA A2B, App G), or null. */
export function corePracticeProblem(d: Design): string | null {
  const steps = coreSteps(d);
  return steps.length > 1 ? `This design is ${numberWord(steps.length)} steps from core practice (${steps.map((s) => CORE_STEP_WORDS[s]).join(', ')}); SENA allows one (A2B, App G).` : null;
}

/** The complex line of a divided field (the first, when it has two); null when its lines are straight — plain, enarched and ployé count as plain for App H. */
function complexFieldLine(d: Design): ComplexLine | null {
  if (d.kind !== 'arms' || d.field.k !== 'divided') return null;
  const { a, b } = d.field.lines;
  return [a, b].find((l): l is ComplexLine => !isStraightLine(l)) ?? null;
}

/** Tinctures too dark together for any complex line between them (SENA App H: sable and purpure, 08/1992; sable and azure, 09/1997). */
const DARK_PAIRS: ReadonlyArray<readonly [Tincture, Tincture]> = [['sable', 'purpure'], ['sable', 'azure']];

/** Why a variation's two tinctures don't stand out against each other (SENA A3B3d: adjacent parts of a multiply divided paint contrast), or null; null too for any other paint. */
function variationProblem(p: Paint): string | null {
  const varied = asVariation(p);
  return varied && metalAndColourProblem(paintName(varied), varied.parts[0].t, varied.parts[1].t);
}

/** Why a treatment is drawn in an ink that does not stand out against its tincture (GoT "Field Treatment": good contrast), or null; null too for any other paint. */
function treatmentProblem(p: Paint): string | null {
  const treated = asTreated(p);
  return treated && metalAndColourProblem(paintName(treated), treated.ground.t, treated.ink);
}

/** Whether two parts of a field stand out against each other: a metal and a colour, or a neutral fur against either. */
const contrasting = (a: Surface, b: Surface): boolean => a.cls === 'neutral' || b.cls === 'neutral' || a.cls !== b.cls;

/**
 * Why a field divided in three has too little contrast between its parts, or null (its parts already differ): one part must contrast with
 * the other two (SENA A3B3b); a tierced field's middle part with both outer parts, which also makes its adjacent parts contrast (A3B3d: the
 * strictest reading, RULES-C §E.2, L11). Null for a field in two parts.
 */
function threePartProblem(division: Division, parts: readonly Paint[]): string | null {
  if (partCount(division) !== 3) return null;
  const [a, b, c] = parts.map((p) => surfaceOf(p, null));
  const name = capitalise(DIVISION_NAME[division]);
  const names = parts.map(paintName);
  if (division === 'tierced-per-pale' || division === 'tierced-per-fess') {
    return contrasting(a, b) && contrasting(b, c) ? null : `${name} needs its middle part to contrast with both outer parts — a metal between colours, or a colour between metals (RULES-C §E.2): ${joinAnd(names)} don't.`;
  }
  return contrasting(a, b) && contrasting(a, c) || contrasting(b, a) && contrasting(b, c) || contrasting(c, a) && contrasting(c, b)
    ? null
    : `${name} needs one part to contrast with both others (SENA A3B3b), and none of ${joinAnd(names)} does.`;
}

/** Why a paint named `name` of tinctures `a` and `b` is not of a metal and a colour, or null when it is. */
function metalAndColourProblem(name: string, a: Tincture, b: Tincture): string | null {
  if (a === b) return `${name} needs two different tinctures — both are ${TINCTURE_NAME[a]}.`;
  return TINCTURE_CLASS[a] === TINCTURE_CLASS[b] ? `${name} needs a metal and a colour — both are ${TINCTURE_CLASS[a]}s.` : null;
}

/** The problems of the field's and the groups' paints: parts of a divided field that share a tincture (SENA A3B3a; of a fur, its ground), a variation whose tinctures are not a metal and a colour (A3B3d), a fur in colours that are not a metal and a colour (App F4). */
export function paintIssues(d: Design): Issue[] {
  const issues: Issue[] = [];
  const add = (issue: Issue) => issues.push(issue);

  // A divided field whose parts share a tincture (SENA A3B3a): of a fur, the ground it is seen against; "unless the sections are separated by an
  // ordinary" — the main band over the line of a field in two parts (review R-11; A3B3c has no such exception for quarterly or per saltire).
  if (d.kind === 'arms' && d.field.k === 'divided') {
    const parts = d.field.parts;
    const separated = TWO_PART_DIVISIONS.includes(d.field.division) && primaryGroups(d).some((p) => onDivisionLine(d, p.group));
    const shared = separated ? undefined : parts.flatMap((p, i) => parts.slice(i + 1).flatMap((q) => {
      const t = bodyTinctures(p).find((x) => bodyTinctures(q).includes(x));
      return t ? [{ p, q, t }] : [];
    }))[0];
    const tierced = d.field.division === 'tierced-per-pale' || d.field.division === 'tierced-per-fess';
    if (shared && tierced && shared.p === parts[0] && shared.q === parts[2]) {
      // Tierced with its outer parts alike is the plain field with a pale (a fess) on it (RULES-C L24)
      const band = d.field.division === 'tierced-per-pale' ? 'pale' : 'fess';
      add({ code: 'structure', rule: 'field', at: { k: 'field' }, slots: [], message: `That is a ${band}: choose a Background of ${paintName(parts[0])} with a ${band} ${paintName(parts[1])}.` });
    } else if (shared) {
      const plain = shared.p.k === 'tincture' && shared.q.k === 'tincture';
      const message = !plain
        ? `A divided field's parts can't share a tincture — ${paintName(shared.p)} and ${paintName(shared.q)} both use ${TINCTURE_NAME[shared.t]}.`
        : parts.length === 2
          ? `A divided field needs two different tinctures — both parts are ${TINCTURE_NAME[shared.t]}.`
          : `A divided field needs different tinctures — two parts are ${TINCTURE_NAME[shared.t]}.`;
      add({ code: 'structure', rule: 'field', at: { k: 'field' }, message, slots: [] });
    } else {
      const three = threePartProblem(d.field.division, parts);
      if (three) add({ code: 'structure', rule: 'field', at: { k: 'field' }, message: three, slots: [] });
    }
  }

  // A line the field's division or stripes can't take (RULES-C §A.1, §A.5).
  const fieldLine = d.kind === 'arms' ? paintLineProblem(d.field) : null;
  if (fieldLine) add({ code: 'structure', rule: 'line', at: { k: 'field' }, message: fieldLine, slots: [] });

  // A complex line between sable and purpure, or sable and azure, can't be seen (SENA App H): between any two parts it divides (RULES-C L12: across a per pall's too).
  const complex = complexFieldLine(d);
  const divided = d.kind === 'arms' && d.field.k === 'divided' ? d.field : null;
  const sides = divided ? adjacentParts(divided.division).map(([i, j]) => [divided.parts[i], divided.parts[j]] as const) : [];
  const dark = DARK_PAIRS.find(([x, y]) => sides.some(([p, q]) => p.k === 'tincture' && q.k === 'tincture' && ((p.t === x && q.t === y) || (p.t === y && q.t === x))));
  // a field per bend bevilled is exempt from it so long as no charge overlies the line (rule 7 below takes up the charge)
  if (complex && complex !== 'bevilled' && dark) {
    const message = `A ${LINE_WORD[complex]} line between ${TINCTURE_NAME[dark[0]]} and ${TINCTURE_NAME[dark[1]]} can't be seen — divide them with a straight line, or choose another tincture (SENA App H).`;
    add({ code: 'structure', rule: 'line', at: { k: 'field' }, message, slots: [] });
  }

  // The field's stripes or cells lie against each other all over it (SENA A3B3d).
  const fieldVariation = d.kind === 'arms' ? variationProblem(d.field) : null;
  if (fieldVariation) add({ code: 'structure', rule: 'field', at: { k: 'field' }, message: fieldVariation, slots: [] });

  const fieldTreatment = d.kind === 'arms' ? fieldParts(d).map(treatmentProblem).find((m) => m !== null) : undefined;
  if (fieldTreatment) add({ code: 'structure', rule: 'treatment', at: { k: 'field' }, message: fieldTreatment, slots: [] });

  // 1a. A fur in colours of its own combines a metal with a colour (SENA App F4).
  const furProblem = (p: Paint): string | null => {
    if (p.k !== 'fur' || !p.colours || TINCTURE_CLASS[p.colours[0]] !== TINCTURE_CLASS[p.colours[1]]) return null;
    return `${paintName(p)} needs a metal and a colour — both are ${TINCTURE_CLASS[p.colours[0]]}s.`;
  };
  const fieldFur = d.kind === 'arms' ? fieldParts(d).map(furProblem).find((m) => m !== null) : undefined;
  if (fieldFur) add({ code: 'structure', rule: 'fur', at: { k: 'field' }, message: fieldFur, slots: [] });
  for (const { path, group } of walkGroups(d)) {
    const problem = furProblem(group.paint);
    if (problem) add({ code: 'structure', rule: 'fur', at: { k: 'group', path }, message: problem, slots: [] });
    const lined = paintLineProblem(group.paint);
    if (lined) add({ code: 'structure', rule: 'line', at: { k: 'group', path }, message: lined, slots: [] });
    const varied = variationProblem(group.paint);
    if (varied) add({ code: 'structure', rule: 'divided-paint', at: { k: 'group', path }, message: varied, slots: [] });
    const treatment = treatmentProblem(group.paint);
    if (treatment) add({ code: 'structure', rule: 'treatment', at: { k: 'group', path }, message: treatment, slots: [] });
  }

  return issues;
}

/** The charges that are forms of armorial display (SENA A3A2): alone and plain they pass for a shield of arms, so a badge of one may not be charged, divided or ermine. */
const DISPLAY_FORMS: readonly ChargeId[] = ['heart', 'roundel', 'billet', 'lozenge'];

/**
 * Why a top-level group is not a fieldless badge (SENA A3A2, A3C; RULES §4.1), or null: a badge is one self-contained design,
 * so it has no band or border (a badge has no edge to run along, and a central band would have to be couped), no charge set in a
 * place of the field, and no more charges than touch (one, or two long charges crossed); a form of armorial display is plain.
 */
function notABadge(group: Group): string | null {
  if (group.item.k === 'ordinary') {
    // A couped band (a baton is one already) is a badge (SENA A3A2), one this builder doesn't draw yet: support.ts says so.
    if (ORDINARY_KIND[group.item.type] === 'central' && (group.item.mods.includes('couped') || group.item.type === 'baton')) return null;
    return ORDINARY_KIND[group.item.type] !== 'central'
      ? `A fieldless badge has no edge for ${ordinaryWithArticle(group.item.type)} to run along (SENA A3A2).`
      : `A fieldless badge can't have a ${ORDINARY_NAME[group.item.type]} unless it is couped (SENA A3A2).`;
  }
  if (group.role !== 'primary') return null;
  if (group.position !== null) return `A fieldless badge has no field to set a charge in ${group.position} of.`;
  if (group.count > 1 && group.arrangement.k !== 'crossed') {
    return `A fieldless badge is one self-contained design, so its charges must touch — ${chargesPhrase(group)} can't be set apart. Use one charge, or two long charges crossed (SENA A3A2).`;
  }
  const { charge } = group.item;
  if (!DISPLAY_FORMS.includes(charge)) return null;
  const form = CHARGES[charge].name;
  if (group.charged.length > 0) return `A ${form} with charges on it looks like a shield of arms rather than a badge (SENA A3A2).`;
  // Plain ermine is the Brittany ermine, protected; the other furs, undivided, are one tincture.
  const ermine = group.paint.k === 'fur' && group.paint.fur === 'ermine' && !group.paint.colours;
  if ((group.paint.k !== 'tincture' && group.paint.k !== 'fur') || ermine) {
    return `A ${form} on its own looks like a shield of arms, so it must be one plain tincture or fur — not ${ermine ? 'plain ermine' : 'divided or treated'} (SENA A3A2).`;
  }
  return null;
}

/** The peripherals that must stay uncharged and of one tincture: a canton or quarter otherwise is an augmentation (SENA A6C1, RULES-C §C.3). */
const UNCHARGED: readonly OrdinaryType[] = ['canton', 'quarter'];

/**
 * What the peripherals beside the chief and bordure rule out: a chief and a base alike in tincture and line ("non-period heraldic style,
 * and grounds for return": RULES-C §C.3, Cynwrig de Montain 11/2006); a charged canton or quarter, or one not of a single tincture (SENA A6C1); a group overall, which may
 * not lie over a peripheral other than a chief or bordure it stands under (SENA App I4).
 */
function peripheralIssues(d: Design): Issue[] {
  const out: Issue[] = [];
  const peripherals = d.groups.flatMap((group, i) => (group.role === 'peripheral' && group.item.k === 'ordinary' ? [{ group, item: group.item, path: [i] as GroupPath }] : []));
  const chief = peripherals.find((p) => p.item.type === 'chief');
  const base = peripherals.find((p) => p.item.type === 'base');
  if (chief && base && JSON.stringify(chief.group.paint) === JSON.stringify(base.group.paint) && chief.item.lines.a === base.item.lines.a) {
    out.push({ code: 'structure', rule: 'relation', at: { k: 'group', path: base.path }, message: 'A chief and a base alike in tincture and line are refused: make them differ in one (RULES-C §C.3).', slots: [] });
  }
  for (const { group, item, path } of peripherals) {
    if (UNCHARGED.includes(item.type) && group.charged.length > 0) {
      out.push({ code: 'structure', rule: 'relation', at: { k: 'group', path: [...path, 0] }, message: `A ${ORDINARY_NAME[item.type]} must stay uncharged: a charged one is an augmentation (SENA A6C1).`, slots: [] });
    }
    // "only if it is uncharged and of a single tincture" (A6C1): a fur is one tincture (A3B1); divided, varied, strewn or treated it is not.
    // The sinister forms too: A6C1 speaks of "a canton", and a canton sinister is one (review R-6).
    if (UNCHARGED.includes(item.type) && group.paint.k !== 'tincture' && group.paint.k !== 'fur') {
      out.push({ code: 'structure', rule: 'relation', at: { k: 'group', path }, message: `A ${ORDINARY_NAME[item.type]} must be of one tincture: a divided one reads as an augmentation (SENA A6C1).`, slots: [] });
    }
  }
  const beside = peripherals.find((p) => p.item.type !== 'chief' && p.item.type !== 'bordure');
  const overall = d.groups.findIndex((g) => g.role === 'overall');
  if (beside && overall >= 0) {
    out.push({ code: 'structure', rule: 'overall', at: { k: 'group', path: [overall] }, message: `Nothing can lie overall with ${ordinaryWithArticle(beside.item.type)} on the field (SENA App I4).`, slots: [] });
  }
  return out;
}

/**
 * The dexter and sinister points wherever they are: drawn, but never registered — "neither the dexter nor sinister point were actually used
 * in period armory" (PicDic; RULES-C §C.3, L21; LoAR 24–26 reblazoned an old one as a field division).
 */
function sidePointIssues(d: Design): Issue[] {
  return walkGroups(d).flatMap(({ path, group }): Issue[] => (group.item.k === 'ordinary' && REFUSED_ORDINARIES.includes(group.item.type)
    ? [{ code: 'structure', rule: 'side-point', at: { k: 'group', path }, message: `${capitalise(ordinaryWithArticle(group.item.type))} is refused: neither the dexter nor the sinister point was used in period armory (RULES-C §C.3, L21) — use a point pointed or a base.`, slots: [] }]
    : []));
}

/** Structural problems of a design that resolves, in rule order. */
export function structuralIssues(d: Design): Issue[] {
  const issues: Issue[] = [];
  const add = (issue: Issue) => issues.push(issue);
  const walked = walkGroups(d);

  // 0. A fieldless badge is one self-contained charge (SENA A3A2).
  const notBadges = new Set<Group>();
  if (d.kind === 'badge') {
    d.groups.forEach((group, i) => {
      const message = notABadge(group);
      if (message === null) return;
      notBadges.add(group);
      add({ code: 'structure', rule: 'badge', at: { k: 'group', path: [i] }, message, slots: [] });
    });
  }

  issues.push(...paintIssues(d));

  // 1b. A band or picture divided into two like tinctures, or cut by a line that misses it (SENA A3B3a, A3B3; RULES CC-10, CC-11).
  for (const { path, group } of walked) {
    const party = asParty(group.paint);
    if (party) {
      const thing = group.item.k === 'ordinary' ? `the ${ORDINARY_NAME[group.item.type]}` : `each ${CHARGES[group.item.charge].name}`;
      const problem = party.parts[0].t === party.parts[1].t
        ? `A divided ${itemName(group.item)} needs two different tinctures — both parts are ${TINCTURE_NAME[party.parts[0].t]}.`
        : group.item.k === 'ordinary' && !divisionCutsOrdinary(party.division, specOf(group))
          ? `${capitalise(DIVISION_NAME[party.division])} doesn't cut across ${thing}, so only one part would show — choose another division.`
          : group.item.k === 'charge' && party.division === 'per-chevron' && CHARGES[group.item.charge].long
            ? `A long ${CHARGES[group.item.charge].name} can't be divided per chevron — it would read as per fess (RULES CC-11).`
            : null;
      if (problem) add({ code: 'structure', rule: 'divided-paint', at: { k: 'group', path }, message: problem, slots: [] });
    }
  }

  // 2. A plain field alone (SENA A3E3); a badge with nothing in it.
  if (d.kind === 'badge' && d.groups.length === 0) {
    add({ code: 'generic', at: { k: 'design' }, message: 'A fieldless badge is its picture — add one.', slots: [] });
  }
  if (d.kind === 'arms' && (d.field.k === 'tincture' || d.field.k === 'fur') && d.groups.length === 0) {
    add({ code: 'generic', at: { k: 'design' }, message: `A plain ${d.field.k === 'fur' ? 'fur' : 'field'} on its own is too generic to register — add an ordinary or a charge.`, slots: [] });
  }

  // 3. How groups relate (SENA App I).
  const hostsSeen = new Set<Group>();
  for (const { path, group, host } of walked) {
    const at = { k: 'group', path } as const;
    if (group.role === 'secondary' && group.relation === 'between') {
      // Between a central ordinary, or around the one group of primary charges (SENA App I1: "a lion between three mullets").
      const central = d.groups.some((g) => g.role === 'primary' && g.item.k === 'ordinary' && ORDINARY_KIND[g.item.type] === 'central');
      if (!central && !primaryCharges(d)) add({ code: 'structure', rule: 'relation', at, message: 'Charges can only be set between a central band or shape, or around a picture in the middle.', slots: [] });
    }
    if (group.role === 'secondary' && group.relation === 'position' && !d.groups.some((g) => g.role === 'primary')) {
      // With nothing in the middle, charges in chief or in base are the primary group themselves (SENA App I1).
      add({ code: 'structure', rule: 'relation', at, message: `Charges in ${group.position ?? 'a corner'} stand beside a band, shape or picture in the middle — with none, they are the main picture.`, slots: [] });
    }
    if (host?.role === 'tertiary') {
      add({ code: 'structure', rule: 'relation', at, message: "Charges can't sit on charges that are already on something (SENA App I3).", slots: [] });
    } else if (host) {
      if (hostsSeen.has(host)) add({ code: 'structure', rule: 'relation', at, message: `Only one group of charges can sit on the ${itemName(host.item)} (SENA App I3).`, slots: [] });
      hostsSeen.add(host);
    }
  }

  // 3c. Two co-primary groups are laid out together, so both are given the one arrangement.
  const together = coPrimaries(d);
  if (together && layoutKey({ arrangement: together[0].arrangement, position: together[0].position }) !== layoutKey({ arrangement: together[1].arrangement, position: together[1].position })) {
    add({ code: 'structure', rule: 'layout', at: { k: 'group', path: [d.groups.indexOf(together[1])] }, message: 'Two main pictures are arranged together — give both the same arrangement.', slots: [] });
  }

  if (together && posturesClash(together[0].item, together[1].item)) {
    add({ code: 'structure', rule: 'relation', at: { k: 'group', path: [d.groups.indexOf(together[1])] }, message: 'Two main pictures that can be posed alike must be: a rampant and a passant beast are not one group (SENA A3D2c).', slots: [] });
  }

  // 3b. A group overall lies over a primary group (SENA App I4): there is one, it overlies a primary, and one of the two is an ordinary or a long charge.
  const overalls = walked.filter(({ group, host }) => group.role === 'overall' && host === null);
  const primary = primaryGroup(d)?.group ?? null;
  overalls.forEach(({ path, group }, i) => {
    const at = { k: 'group', path } as const;
    const fail = (message: string) => add({ code: 'structure', rule: 'overall', at, message, slots: [] });
    if (i > 0) return fail('There can be only one group overall (SENA App I4).');
    if (!primary) return fail('Something overall lies over a band, shape or picture in the middle — with none, it is the main picture (SENA App I4).');
    const bandOrLong = (g: Group) => g.item.k === 'ordinary' || CHARGES[g.item.charge].long;
    if (!bandOrLong(group) && !bandOrLong(primary)) {
      return fail(`${capitalise(chargesPhrase(group))} overall must lie over a band or shape, or be a long charge such as a sword — not over ${chargesPhrase(primary)} (SENA App I4).`);
    }
    // "An overall charge group may have multiple charges, but only if they surmount a single primary charge."
    if (group.count > 1 && primaryGroups(d).reduce((n, p) => n + p.group.count, 0) > 1) {
      return fail(`${capitalise(chargesPhrase(group))} overall can only lie over a single main picture or band — set one overall, or have one main picture (SENA App I4).`);
    }
    // Two of one charge in two groups is the same-type rule below; two bands of one kind would look like one.
    if (group.item.k === 'ordinary' && itemKey(group.item) === itemKey(primary.item)) {
      fail(`The ${itemName(group.item)} can't lie overall over another ${itemName(primary.item)}.`);
    }
  });

  // 3a. The same type of charge in two groups on the field (SENA A3D1a); a charge on a charge may repeat it, and so may co-primaries,
  // which together are the one primary charge group (App I1); A3D1a forbids the type "in multiple charge groups".
  const fieldGroups = d.groups.filter((g) => g.role !== 'peripheral' && g.item.k === 'charge');
  fieldGroups.forEach((group, i) => {
    if (!fieldGroups.slice(0, i).some((g) => itemKey(g.item) === itemKey(group.item) && !(g.role === 'primary' && group.role === 'primary'))) return;
    const path = [d.groups.indexOf(group)];
    add({ code: 'structure', rule: 'same-type', at: { k: 'group', path }, message: `${capitalise(chargesPhrase(group))} can't be used again in another group on the field (SENA A3D1a) — choose a different picture.`, slots: [] });
  });

  // 3a'. The semys: the charge of one on the field is not used again (A3D1a), and a band carries one group of charges (App I3).
  issues.push(...strewnIssues(d));

  // 4. Count, arrangement and position make a layout where the group sits.
  const illegal = new Set<Group>(notBadges);
  for (const { path, group, host } of walked) {
    if (notBadges.has(group)) continue;
    const ctx = contextOf(d, group, host);
    const message = ctx && layoutIssue(d, path, group, ctx);
    if (message) {
      illegal.add(group);
      add({ code: 'structure', rule: 'layout', at: { k: 'group', path }, message, slots: [] });
    }
  }

  // 5. The charges fit where they sit, at a size that reads.
  for (const { path, group } of walked) {
    const capacity = illegal.has(group) ? null : capacityIssue(d, path);
    if (capacity) add({ code: 'structure', rule: 'capacity', at: { k: 'group', path }, message: capacity.message, slots: [] });
  }

  // 6. A chief on a field divided per fess needs a primary charge across the line (SENA A3D1c).
  const chief = walked.find(({ group }) => group.role === 'peripheral' && group.item.k === 'ordinary' && group.item.type === 'chief');
  const chiefLine = chief?.group.item.k === 'ordinary' ? chief.group.item.lines.a : 'plain';
  if (chief && d.kind === 'arms' && d.field.k === 'divided' && d.field.division === 'per-fess' && couldBeOneFess(chiefLine, d.field.lines.a) && !crossesTheLine(d)) {
    add({ code: 'structure', rule: 'crosses-line', at: { k: 'group', path: chief.path }, message: 'A chief on a field divided per fess needs a charge across the line (SENA A3D1c).', slots: [] });
  }

  // 6'. The mirror at the foot: a base on a field divided per fess (RULES-C §A.5.5).
  const base = walked.find(({ group }) => group.role === 'peripheral' && group.item.k === 'ordinary' && group.item.type === 'base');
  const baseLine = base?.group.item.k === 'ordinary' ? base.group.item.lines.a : 'plain';
  if (base && d.kind === 'arms' && d.field.k === 'divided' && d.field.division === 'per-fess' && couldBeOneFess(d.field.lines.a, baseLine) && !crossesTheLine(d)) {
    add({ code: 'structure', rule: 'crosses-line', at: { k: 'group', path: base.path }, message: 'A base on a field divided per fess needs a charge across the line (SENA A3D1c).', slots: [] });
  }

  // 6a. What the peripherals rule out (RULES-C §C.3, SENA A6C1, App I4), and the dexter and sinister points (RULES-C §C.3, L21).
  issues.push(...peripheralIssues(d), ...sidePointIssues(d));

  // 6b. An ordinary's lines (RULES-C §A.3, §A.5).
  for (const { path, group } of walked) {
    const problem = ordinaryLineProblem(group);
    if (problem) add({ code: 'structure', rule: 'line', at: { k: 'group', path }, message: problem, slots: [] });
  }

  // 6b'. What an ordinary's treatments rule out (RULES-C §D), and where voiding, fimbriation and cotises may be (SENA A3C).
  for (const { path, group } of walked) {
    const problem = ordinaryTreatmentProblem(group);
    if (problem) add({ code: 'structure', rule: 'relation', at: { k: 'group', path }, message: problem, slots: [] });
    const treated = ordinaryTreatmentRuleProblem(d, group);
    if (treated) add({ code: 'structure', rule: 'ordinary-treatment', at: { k: 'group', path }, message: treated, slots: [] });
  }

  // 6c. One step from core practice is registrable, two are not (SENA A2B, App G).
  const corePractice = corePracticeProblem(d);
  if (corePractice) add({ code: 'structure', rule: 'core-practice', at: { k: 'design' }, message: corePractice, slots: [] });

  // 7. Two parts that don't contrast, across a complex line with a charge over it: the line can't be made out (SENA App H; across a per pall's, RULES-C L12).
  const line = complexFieldLine(d);
  const field = line && d.kind === 'arms' && d.field.k === 'divided' ? d.field : null;
  const surfaces = field ? field.parts.map((p) => surfaceOf(p, null)) : [];
  const alike = field ? adjacentParts(field.division).map(([i, j]) => [surfaces[i], surfaces[j]] as const).filter(([x, y]) => x.cls === y.cls) : [];
  if (line && alike.length > 0) {
    const across = (g: Ground) => alike.find(([x, y]) => [x, y].every((s) => g.some((share) => share.surface === s && share.share >= OVERLIES_SHARE)));
    const over = walked.find(({ path, group, host }) => host === null && group.role !== 'peripheral' && groundShares(d, path).some((g) => across(g) !== undefined));
    if (over) {
      const cls = groundShares(d, over.path).map(across).find((x) => x !== undefined)?.[0].cls;
      const pair = cls === 'metal' ? 'two metals' : cls === 'colour' ? 'two colours' : 'two furs';
      const message = `${capitalise(chargesPhrase(over.group))} over the ${LINE_WORD[line]} line ${over.group.count === 1 ? 'hides' : 'hide'} it: between ${pair} the line must stay clear to be seen — set the charges off it, or divide the field with a straight line (SENA App H).`;
      add({ code: 'structure', rule: 'line', at: { k: 'group', path: over.path }, message, slots: [] });
    }
  }
  return issues;
}
