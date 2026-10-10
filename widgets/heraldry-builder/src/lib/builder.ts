// Builder edits: pure NormDesign → NormDesign transitions used by the Design tab (DOM-free, unit
// tested). Lower-layer edits are always applied; the charge group is then refitted structurally
// (fitCharges) and any rule-of-tincture conflict is left in place for the violation panel to
// surface and offer a fix — never silently repaired.

import {
  DEFAULT_FIELD_SHAPE, CHARGES, NUMBER_WORD, ORDINARY_LABEL, TINCTURE_CLASS, TINCTURE_LABEL, chargeContext, chargeSlotContacts, chargeTinctureChoices,
  contrastFailure, countChoices, fieldTinctures, fitCharges, isMetal, ordinaryTinctureChoices, placementChoices, structuralIssues, tinctureIssues,
  type Arrangement, type ChargedDesign, type ChargeId, type Choice, type Companion, type Count, type Division, type Issue, type LayoutChoice, type NormDesign,
  type ChargeTincture, type OrdinaryType, type Placement, type Posture, type Readability, type ShapedDesign, type Tincture,
} from './heraldry';
import { capitalise } from './heraldry/words';

export const DEFAULT_DESIGN: NormDesign = { v: 1, field: { kind: 'plain', tincture: 'azure' }, ordinary: null, charges: null };

function firstAllowed<T>(choices: Choice<T>[], fallback: T): T {
  return choices.find((c) => c.allowed)?.value ?? fallback;
}

function isAllowed<T>(choices: Choice<T>[], v: T): boolean {
  return choices.some((c) => c.value === v && c.allowed);
}

/** A second tincture for a newly divided field: contrasting class, never equal to the first. */
function partner(t: Tincture): Tincture {
  if (!isMetal(t)) return 'or';
  return t === 'or' ? 'azure' : 'gules';
}

export function setPlainField(nd: NormDesign): NormDesign {
  if (nd.field.kind === 'plain') return nd;
  return fitCharges({ ...nd, field: { kind: 'plain', tincture: nd.field.tinctures[0] } });
}

export function setDivision(nd: NormDesign, division: Division): NormDesign {
  const [t1, t2] = fieldTinctures(nd.field);
  const tinctures: [Tincture, Tincture] = [t1, t2 && t2 !== t1 ? t2 : partner(t1)];
  return fitCharges({ ...nd, field: { kind: 'divided', division, tinctures } });
}

export function setFieldTincture(nd: NormDesign, part: 0 | 1, t: Tincture): NormDesign {
  const f = nd.field;
  if (f.kind === 'plain') return { ...nd, field: { kind: 'plain', tincture: t } };
  const tinctures: [Tincture, Tincture] = part === 0 ? [t, f.tinctures[1]] : [f.tinctures[0], t];
  return { ...nd, field: { ...f, tinctures } };
}

export function setOrdinary(nd: NormDesign, type: OrdinaryType | null): NormDesign {
  if (!type) return fitCharges({ ...nd, ordinary: null });
  const choices = ordinaryTinctureChoices(nd, type);
  const keep = nd.ordinary && isAllowed(choices, nd.ordinary.tincture) ? nd.ordinary.tincture : null;
  const tincture = keep ?? firstAllowed(choices, nd.ordinary?.tincture ?? 'or');
  const next: NormDesign = { ...nd, ordinary: { type, tincture } };
  // Charges on a bordure aren't possible; on any other ordinary, keep them where they were.
  return fitCharges(next);
}

export function setOrdinaryTincture(nd: NormDesign, t: Tincture): NormDesign {
  if (!nd.ordinary) return nd;
  return { ...nd, ordinary: { ...nd.ordinary, tincture: t } };
}

export function setCharge(nd: NormDesign, id: ChargeId | null): NormDesign {
  if (!id) return { ...nd, charges: null };
  const meta = CHARGES[id];
  const g = nd.charges;
  if (g) {
    const posture = meta.postures ? (g.posture && meta.postures.includes(g.posture) ? g.posture : meta.defaultPosture) : null;
    return fitCharges({ ...nd, charges: { ...g, charge: id, posture } });
  }
  const placed = fitCharges({
    ...nd,
    charges: { charge: id, count: 1, placement: 'field', arrangement: 'single', posture: meta.defaultPosture, tincture: 'or' },
  });
  const tincture = firstAllowed(chargeTinctureChoices(placed), 'or');
  return { ...placed, charges: { ...placed.charges!, tincture } };
}

/** The design a count or placement choice leads to; a blocked (or unknown) one changes nothing. */
function chosenDesign<T>(nd: NormDesign, choices: LayoutChoice<T>[], value: T): NormDesign {
  const c = choices.find((x) => x.value === value);
  return c?.allowed ? c.design : nd;
}

/** A new count, bringing the placement along when only the other placement takes it (see countChoices). */
export function setCount(nd: NormDesign, count: Count): NormDesign {
  return chosenDesign(nd, countChoices(nd), count);
}

/** A new placement, bringing the nearest count it takes along when the current one doesn't fit (see placementChoices). */
export function setPlacement(nd: NormDesign, placement: Placement): NormDesign {
  return chosenDesign(nd, placementChoices(nd), placement);
}

/** Whether the charges break the rule of tincture where they lie (the ordinary's own colour aside). */
export function chargesClash(nd: NormDesign): boolean {
  return tinctureIssues(nd).some((i) => i.layer === 'charges');
}

const colourWord = (t: Tincture) => TINCTURE_LABEL[t].plain.toLowerCase();

/** What clashing charges lie on, in plain words: "red cross", "gold background", "gold part of the background". */
function clashGround(nd: ChargedDesign, t: Tincture): string {
  const o = nd.ordinary;
  if (o && chargeContext(o, nd.charges.placement) === 'on') return `${colourWord(o.tincture)} ${ORDINARY_LABEL[o.type].plain.toLowerCase()}`;
  // The look-alike tinctures under the failing charges: the ones they don't stand out against.
  const alike = chargeSlotContacts(nd)
    .filter((cs) => contrastFailure(t, cs))
    .flatMap((cs) => cs.filter((c) => TINCTURE_CLASS[c] === TINCTURE_CLASS[t]));
  const words = [...new Set(alike)].map(colourWord);
  if (nd.field.kind === 'plain') return `${words[0]} background`;
  return words.length === 1 ? `${words[0]} part of the background` : `${words.join(' and ')} parts of the background`;
}

/** The layout change itself: "Moves the lions around the cross" / "Changed to four lions". */
function companionChange(next: ChargedDesign, companion: Companion, tense: 'offered' | 'done', noun: string): string {
  if (companion.kind === 'count') return `${tense === 'offered' ? 'Changes' : 'Changed'} to ${NUMBER_WORD[next.charges.count]} ${noun}`;
  // "On the cross" → "onto the cross"; "Around the cross" → "around the cross".
  const label = placementLabel(next, companion.placement);
  const where = companion.placement === 'ordinary' ? label.replace(/^On /, 'onto ') : `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  return `${tense === 'offered' ? 'Moves' : 'Moved'} the ${noun} ${where}`;
}

/**
 * What else a count or placement choice changes, in words, for the design it leads to: offered
 * ("Moves the lions around the cross", "Changes to four lions") or done ("Moved…", "Changed…").
 * Only the layout moves, never a colour, so when the charges' colour then breaks the rule the note
 * says so: "…; the gold lions would then need a new colour" / "… The gold lions don't stand out on
 * the gold background — pick a new colour below."
 */
export function companionNote(next: ChargedDesign, companion: Companion, tense: 'offered' | 'done'): string {
  const g = next.charges;
  const meta = CHARGES[g.charge];
  const noun = g.count === 1 ? meta.glossName : meta.glossPlural;
  const change = companionChange(next, companion, tense, noun);
  if (!chargesClash(next)) return tense === 'offered' ? change : `${change}.`;
  const subject = g.tincture === 'counterchanged' ? `the ${noun}` : `the ${colourWord(g.tincture)} ${noun}`;
  if (tense === 'offered') return `${change}; ${subject} would then need a new colour`;
  const why = g.tincture === 'counterchanged'
    ? `can't take swapped colours there`
    : `${g.count === 1 ? "doesn't" : "don't"} stand out on the ${clashGround(next, g.tincture)}`;
  return `${change}. ${capitalise(subject)} ${why} — pick a new colour below.`;
}

export function setArrangement(nd: NormDesign, arrangement: Arrangement): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  return { ...nd, charges: { ...g, arrangement } };
}

export function setPosture(nd: NormDesign, posture: Posture): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  return { ...nd, charges: { ...g, posture } };
}

export function setChargeTincture(nd: NormDesign, t: ChargeTincture): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  return { ...nd, charges: { ...g, tincture: t } };
}

// ── Status ──────────────────────────────────────────────────────────────────

export type DesignStatus = 'incomplete' | 'valid' | 'violation';

export interface DesignReport {
  status: DesignStatus;
  /** Blocking problems (structure + rule of tincture), in layer order. */
  problems: Issue[];
  /** The gentle "add an ordinary or charge" hint, when that is all that's missing. */
  hint: string | null;
}

export function assess(nd: NormDesign): DesignReport {
  const issues = [...structuralIssues(nd), ...tinctureIssues(nd)];
  const problems = issues.filter((i) => i.code !== 'generic');
  const generic = issues.find((i) => i.code === 'generic');
  const status: DesignStatus = problems.length ? 'violation' : generic ? 'incomplete' : 'valid';
  return { status, problems, hint: generic ? 'Add a band or shape, or a picture — a plain background alone is too generic to register.' : null };
}

/**
 * The readability tip to show: none while the rule of tincture is broken. That has to be fixed
 * first, and a tip such as "Try a single lion instead of four" would point away from the fix —
 * often back to the layout just chosen.
 */
export function readabilityTip(r: Readability, report: DesignReport): string | null {
  return report.problems.some((p) => p.code === 'tincture') ? null : r.nudge;
}

/** A rule fix's button text: "Fix: switch the lions to Gules". */
export function fixText(label: string): string {
  return `Fix: ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

export const LAYER_LABEL: Record<Issue['layer'], string> = {
  design: 'Design', field: 'Background', ordinary: 'Band or shape', charges: 'Picture',
};

/** "On the background" / "On the vertical band" / "Around the vertical band" / "Below the top bar" / "Within the border". */
export function placementLabel(nd: NormDesign, placement: Placement): string {
  const o = nd.ordinary;
  const name = (type: OrdinaryType) => ORDINARY_LABEL[type].plain.toLowerCase();
  if (placement === 'ordinary') return o && o.type !== 'bordure' ? `On the ${name(o.type)}` : 'On the band or shape';
  switch (chargeContext(o, 'field')) {
    case 'between': return `Around the ${name(o!.type)}`;
    case 'chief': return 'Below the top bar';
    case 'bordure': return 'Within the border';
    default: return 'On the background';
  }
}

export function sameDesign(a: NormDesign, b: NormDesign): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function sameShapedDesign(a: ShapedDesign, b: ShapedDesign): boolean {
  return a.shape === b.shape && sameDesign(a.design, b.design);
}

/** The starting point: nothing has been designed yet, so nothing is lost by replacing it. */
export function isUntouched(d: ShapedDesign): boolean {
  return d.shape === DEFAULT_FIELD_SHAPE && sameDesign(d.design, DEFAULT_DESIGN);
}

/**
 * A design swapped in for another, and the one to bring back on Undo: replaced wholesale (a starting
 * design, Surprise me, a registry entry) or adjusted — a choice that changed something else too,
 * which `note` says.
 */
export type Replacement =
  | { kind: 'replaced'; previous: ShapedDesign; replacement: ShapedDesign }
  | { kind: 'adjusted'; previous: ShapedDesign; replacement: ShapedDesign; note: string };

/** What replacing `current` with `next` would lose: null when current is untouched or identical to next. */
export function replaceDesign(current: ShapedDesign, next: ShapedDesign): Replacement | null {
  return isUntouched(current) || sameShapedDesign(current, next) ? null : { kind: 'replaced', previous: current, replacement: next };
}

/** A count or placement choice applied with its companion change, kept so it can be undone. */
export function adjustDesign(current: ShapedDesign, next: ChargedDesign, companion: Companion): Replacement {
  return { kind: 'adjusted', previous: current, replacement: { shape: current.shape, design: next }, note: companionNote(next, companion, 'done') };
}

/** Undo stays on offer only until the replacement is edited; undoing then would throw that work away too. */
export function undoStillOffered(r: Replacement, now: ShapedDesign): boolean {
  return sameShapedDesign(r.replacement, now);
}

