// Option helper for the builder UI: which tinctures / counts / placements / arrangements / postures
// are legal *given the rest of the design*, with a human reason for every blocked choice (the UI
// keeps blocked options visible and explains them on activation).
//
// Semantics: a choice is blocked only by the layers beneath it (field → ordinary → charges). Changing
// a lower layer is never blocked; if it invalidates an upper layer the design enters a violation
// state (validate() reports it) and suggestTinctureFix()/fitCharges() offer repairs.

import { CHARGES, type ChargeId, type Posture } from './charges';
import {
  COUNTS, FIELD_ARR, ORDINARY_NAME, ORDINARY_TYPES, chargeContext, chargeNoun, chargeStructureIssue, defaultArrangement,
  legalArrangements, type Arrangement, type Count, type NormChargeGroup, type NormDesign, type OrdinaryType, type Placement,
} from './design';
import { chargeSlots, slotContacts, type Slot } from './geometry';
import { contrastFailure, describeSlots, ordinaryContacts, tinctureIssues, type ContrastFailure } from './tincture-rule';
import { COLOURS, METALS, TINCTURES, TINCTURE_NAME, listTinctureNames, type Tincture } from './tinctures';

export interface Choice<T> {
  value: T;
  allowed: boolean;
  /** Present exactly when `allowed` is false. */
  reason?: string;
}

const ok = <T>(value: T): Choice<T> => ({ value, allowed: true });
const blocked = <T>(value: T, reason: string): Choice<T> => ({ value, allowed: false, reason });
const choice = <T>(value: T, reason: string | null): Choice<T> => (reason ? blocked(value, reason) : ok(value));

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const METAL_LIST = listTinctureNames(METALS, 'or');
const COLOUR_LIST = listTinctureNames(COLOURS, 'or');

/**
 * Why `top` can't go on `contacts`, phrased hypothetically for an explainer popover.
 * `subject` names the element ("the lion", "the two upper mullets", "the bend"); `plural` picks verbs.
 */
export function tinctureBlockReason(top: Tincture, contacts: readonly Tincture[], subject: string, plural = false): string | null {
  const f: ContrastFailure | null = contrastFailure(top, contacts);
  if (!f) return null;
  const T = TINCTURE_NAME[top];
  const names = contacts.map((t) => TINCTURE_NAME[t]);
  const lies = plural ? 'lie' : 'lies';
  if (f === 'same') {
    if (contacts.length === 1) return `${T} on ${T} would vanish — ${subject} can't share the tincture ${plural ? 'they lie' : 'it lies'} on.`;
    return `${cap(subject)} ${plural ? 'touch' : 'touches'} the ${T} part of the field, so ${plural ? 'they' : 'it'} can't be ${T} too.`;
  }
  if (contacts.length === 2) {
    return f === 'colour-on-colour'
      ? `${cap(subject)} ${lies} across ${names[0]} and ${names[1]} — both colours — so ${plural ? 'they' : 'it'} must be a metal (${METAL_LIST}).`
      : `${cap(subject)} ${lies} across ${names[0]} and ${names[1]} — both metals — so ${plural ? 'they' : 'it'} must be a colour (${COLOUR_LIST}).`;
  }
  return f === 'colour-on-colour'
    ? `${T} on ${names[0]} would be colour on colour. Colours must sit on metals (${METAL_LIST}).`
    : `${T} on ${names[0]} would be metal on metal. Metals must sit on colours (${COLOUR_LIST}).`;
}

// ── Tinctures ───────────────────────────────────────────────────────────────

/** Field tinctures: only the other half of a divided field blocks (t1 ≠ t2). Plain fields: all allowed. */
export function fieldTinctureChoices(nd: NormDesign, part: 0 | 1 = 0): Choice<Tincture>[] {
  const f = nd.field;
  if (f.kind === 'plain') return TINCTURES.map(ok);
  const other = f.tinctures[part === 0 ? 1 : 0];
  return TINCTURES.map((t) => choice(t, t === other
    ? `The other part is already ${TINCTURE_NAME[t]} — a divided field needs two different tinctures.`
    : null));
}

/** Ordinary tinctures against the field beneath. `type` defaults to the current ordinary. */
export function ordinaryTinctureChoices(nd: NormDesign, type: OrdinaryType | undefined = nd.ordinary?.type): Choice<Tincture>[] {
  if (!type) return TINCTURES.map(ok);
  const contacts = ordinaryContacts(nd.field, type);
  return TINCTURES.map((t) => choice(t, tinctureBlockReason(t, contacts, `the ${ORDINARY_NAME[type]}`)));
}

function chargeTinctureReason(nd: NormDesign, g: NormChargeGroup, t: Tincture, slots: Slot[]): string | null {
  const subject = `the ${chargeNoun(g.charge, g.count)}`;
  const plural = g.count > 1;
  if (chargeContext(nd.ordinary, g.placement) === 'on') {
    if (!nd.ordinary) return null;
    return tinctureBlockReason(t, [nd.ordinary.tincture], subject, plural);
  }
  if (nd.field.kind === 'plain') return tinctureBlockReason(t, [nd.field.tincture], subject, plural);
  const contacts = slots.map((s) => slotContacts(nd.field, s));
  const failing = contacts.map((cs, i) => (contrastFailure(t, cs) ? i : -1)).filter((i) => i >= 0);
  if (!failing.length) return null;
  // Explain via the first failing slot's background; name the slots when not all of them fail.
  const cs = contacts[failing[0]];
  const group = failing.filter((i) => contacts[i].join() === cs.join());
  if (group.length === slots.length) return tinctureBlockReason(t, cs, subject, plural);
  const who = describeSlots(slots, group, null, g.charge);
  const where = cs.map((x) => TINCTURE_NAME[x]).join(' and ');
  const reason = tinctureBlockReason(t, cs, who, group.length > 1)!;
  // A same-tincture reason already names the slots; otherwise say where they lie first.
  return cs.length === 1 && !cs.includes(t) ? `${cap(who)} ${group.length > 1 ? 'lie' : 'lies'} on ${where}. ${reason}` : reason;
}

/** Charge tinctures against what each slot lies on (five-point probe, or the ordinary). */
export function chargeTinctureChoices(nd: NormDesign): Choice<Tincture>[] {
  const g = nd.charges;
  if (!g) return TINCTURES.map(ok);
  const slots = chargeSlots(nd);
  return TINCTURES.map((t) => choice(t, chargeTinctureReason(nd, g, t, slots)));
}

// ── Charge structure ────────────────────────────────────────────────────────

function keepOrDefaultArrangement(nd: NormDesign, placement: Placement, count: Count, current: Arrangement): Arrangement {
  return legalArrangements(nd.ordinary, placement, count).includes(current) ? current : defaultArrangement(nd.ordinary, placement, count);
}

export function countChoices(nd: NormDesign): Choice<Count>[] {
  const g = nd.charges;
  if (!g) return COUNTS.map(ok);
  return COUNTS.map((n) => choice(n, chargeStructureIssue(nd.ordinary, g.placement, n,
    keepOrDefaultArrangement(nd, g.placement, n, g.arrangement), g.charge)));
}

export function placementChoices(nd: NormDesign): Choice<Placement>[] {
  const g = nd.charges;
  const placements: Placement[] = ['field', 'ordinary'];
  if (!g) {
    return placements.map((p) => choice(p, p === 'ordinary' && (!nd.ordinary || nd.ordinary.type === 'bordure')
      ? chargeStructureIssue(nd.ordinary, 'ordinary', 1, 'single') : null));
  }
  return placements.map((p) => choice(p, chargeStructureIssue(nd.ordinary, p, g.count,
    keepOrDefaultArrangement(nd, p, g.count, g.arrangement), g.charge)));
}

export interface ArrangementChoices {
  /** single: one charge; forced: placed by the ordinary; choose: pick from `choices`. */
  mode: 'single' | 'forced' | 'choose';
  /** Why there is nothing to choose (single/forced). */
  note?: string;
  choices: Choice<Arrangement>[];
}

export function arrangementChoices(nd: NormDesign): ArrangementChoices {
  const g = nd.charges;
  if (!g || g.count === 1) return { mode: 'single', note: 'A single charge sits in the centre.', choices: [] };
  const ctx = chargeContext(nd.ordinary, g.placement);
  if ((ctx === 'on' || ctx === 'between') && nd.ordinary) {
    const name = ORDINARY_NAME[nd.ordinary.type];
    return {
      mode: 'forced',
      note: ctx === 'on' ? `Charges on the ${name} follow its line.` : `Charges between a ${name} are placed around it.`,
      choices: [],
    };
  }
  const legal = legalArrangements(nd.ordinary, g.placement, g.count);
  return {
    mode: 'choose',
    choices: FIELD_ARR[g.count].map((a) => choice(a, legal.includes(a) ? null : chargeStructureIssue(nd.ordinary, g.placement, g.count, a, g.charge))),
  };
}

const QUADRUPED_POSTURES: readonly Posture[] = ['rampant', 'passant', 'statant', 'sejant'];

/**
 * Postures for the current charge. Four-legged charges list all four quadruped postures, with the
 * ones this charge isn't drawn in blocked; other posture-bearing charges list their own; posture-less
 * charges return [].
 */
export function postureChoices(nd: NormDesign): Choice<Posture>[] {
  const g = nd.charges;
  if (!g) return [];
  return postureChoicesFor(g.charge);
}

export function postureChoicesFor(id: ChargeId): Choice<Posture>[] {
  const meta = CHARGES[id];
  if (!meta.postures) return [];
  const quadruped = meta.postures.some((p) => QUADRUPED_POSTURES.includes(p));
  const list = quadruped ? QUADRUPED_POSTURES : meta.postures;
  const allowed = meta.postures.map((p) => meta.postureTerms?.[p] ?? p);
  return list.map((p) => choice(p, meta.postures!.includes(p) ? null
    : `The ${meta.name} is only drawn ${allowed.join(' or ')} in this builder.`));
}

/** Ordinary types: never blocked (the ordinary sits beneath the charges). */
export function ordinaryTypeChoices(): Choice<OrdinaryType | null>[] {
  return [null, ...ORDINARY_TYPES].map(ok);
}

// ── Repairs ─────────────────────────────────────────────────────────────────

/**
 * Make the charge group structurally legal after a lower-layer change: move charges off a missing
 * ordinary, pick the nearest legal count, a legal arrangement and an allowed posture. Tinctures are
 * left alone (a tincture conflict is surfaced, not silently fixed).
 */
export function fitCharges(nd: NormDesign): NormDesign {
  const g = nd.charges;
  if (!g) return nd;
  let placement = g.placement;
  if (placement === 'ordinary' && (!nd.ordinary || nd.ordinary.type === 'bordure')) placement = 'field';
  const legalCount = (n: Count) => chargeStructureIssue(nd.ordinary, placement, n, defaultArrangement(nd.ordinary, placement, n)) === null;
  let count = g.count;
  if (!legalCount(count)) {
    const ranked = [...COUNTS].sort((a, b) => Math.abs(a - g.count) - Math.abs(b - g.count) || a - b);
    count = ranked.find(legalCount) ?? count;
  }
  const arrangement = keepOrDefaultArrangement(nd, placement, count, count === g.count ? g.arrangement : defaultArrangement(nd.ordinary, placement, count));
  const meta = CHARGES[g.charge];
  const posture = meta.postures ? (g.posture && meta.postures.includes(g.posture) ? g.posture : meta.defaultPosture) : null;
  return { ...nd, charges: { ...g, placement, count, arrangement, posture } };
}

export interface TinctureFix {
  layer: 'ordinary' | 'charges';
  tincture: Tincture;
  /** Button text, e.g. "Switch the lion to Gules". */
  label: string;
  design: NormDesign;
  /** Every tincture that would fix the design on this layer (the suggestion is the first). */
  alternatives: Tincture[];
}

/** A single one-layer tincture swap that clears every rule-of-tincture issue, or null. */
export function suggestTinctureFix(nd: NormDesign): TinctureFix | null {
  const issues = tinctureIssues(nd);
  if (!issues.length) return null;
  const layers: Array<'charges' | 'ordinary'> = [];
  if (nd.charges && issues.some((i) => i.layer === 'charges')) layers.push('charges');
  if (nd.ordinary) layers.push('ordinary');
  if (nd.charges && !layers.includes('charges')) layers.push('charges');
  for (const layer of layers) {
    const fixes = TINCTURES.filter((t) => {
      const candidate: NormDesign = layer === 'charges'
        ? { ...nd, charges: { ...nd.charges!, tincture: t } }
        : { ...nd, ordinary: { ...nd.ordinary!, tincture: t } };
      return (layer === 'charges' ? nd.charges!.tincture : nd.ordinary!.tincture) !== t && !tinctureIssues(candidate).length;
    });
    if (fixes.length) {
      const t = fixes[0];
      const what = layer === 'charges' ? `the ${chargeNoun(nd.charges!.charge, nd.charges!.count)}` : `the ${ORDINARY_NAME[nd.ordinary!.type]}`;
      const design: NormDesign = layer === 'charges'
        ? { ...nd, charges: { ...nd.charges!, tincture: t } }
        : { ...nd, ordinary: { ...nd.ordinary!, tincture: t } };
      return { layer, tincture: t, label: `Switch ${what} to ${TINCTURE_NAME[t]}`, design, alternatives: fixes };
    }
  }
  return null;
}
