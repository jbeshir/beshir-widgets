// Option helper for the builder UI: which tinctures / counts / placements / arrangements / postures
// are legal *given the rest of the design*, with a human reason for every blocked choice (the UI
// keeps blocked options visible and explains them on activation).
//
// Semantics: a choice is blocked only by the layers beneath it (field → ordinary → charges). Changing
// a lower layer is never blocked; if it invalidates an upper layer the design enters a violation
// state (validate() reports it) and suggestTinctureFix()/fitCharges() offer repairs.

import { CHARGES, postureTerm, type ChargeId, type Posture } from './charges';
import {
  COUNTS, FIELD_ARR, ORDINARY_NAME, ORDINARY_TYPES, chargeContext, chargeNoun, chargeStructureIssue, defaultArrangement,
  legalArrangements, type Arrangement, type Count, type NormChargeGroup, type NormDesign, type Ordinary, type OrdinaryType, type Placement,
} from './design';
import { chargeSlots, slotContacts, type Slot } from './geometry';
import {
  FAILURE_TEXT, chargeContrastFailure, contrastFailure, counterchangeUnavailable, describeSlots, ordinaryContacts, tinctureIssues,
  type ContrastFailure,
} from './tincture-rule';
import {
  CHARGE_TINCTURES, COLOURS, METALS, TINCTURES, TINCTURE_NAME, listTinctureNames, type ChargeTincture, type Tincture,
} from './tinctures';

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

/** Why the charges can't be counterchanged: not on a divided field, or a field of two metals or two colours. */
function counterchangeReason(nd: NormDesign): string | null {
  const unavailable = counterchangeUnavailable(nd);
  if (unavailable || nd.field.kind === 'plain') return unavailable;
  const [a, b] = nd.field.tinctures;
  const f = chargeContrastFailure('counterchanged', nd.field, [a, b]);
  if (!f) return null;
  if (f === 'same') return `Both parts of the field are ${TINCTURE_NAME[a]}, so there is nothing to counterchange.`;
  const both = f === 'metal-on-metal' ? 'both metals' : 'both colours';
  return `Counterchanged on ${TINCTURE_NAME[a]} and ${TINCTURE_NAME[b]} — ${both} — would still be ${FAILURE_TEXT[f]}. It needs a field of one metal and one colour.`;
}

/**
 * Charge tinctures against what each slot lies on (five-point probe, or the ordinary). On a divided
 * field (or while the charges are counterchanged) "counterchanged" is offered too, after the colours.
 */
export function chargeTinctureChoices(nd: NormDesign): Choice<ChargeTincture>[] {
  const g = nd.charges;
  const offered = nd.field.kind === 'divided' || g?.tincture === 'counterchanged' ? CHARGE_TINCTURES : TINCTURES;
  if (!g) return offered.map(ok);
  const slots = chargeSlots(nd);
  return offered.map((t) => choice(t, t === 'counterchanged' ? counterchangeReason(nd) : chargeTinctureReason(nd, g, t, slots)));
}

/**
 * Why a charge layout would leave every tincture blocked, or null when at least one works — so a
 * count, placement or arrangement that leads nowhere is blocked before the user picks it.
 */
function noTinctureReason(nd: NormDesign): string | null {
  const g = nd.charges;
  const choices = chargeTinctureChoices(nd);
  if (!g || choices.some((c) => c.allowed)) return null;
  return `No tincture would work for the ${chargeNoun(g.charge, g.count)} like this. ${choices[0].reason}`;
}

/** The charge group with one structural attribute changed, as the builder would apply it. */
function withCharges(nd: NormDesign, g: NormChargeGroup, change: Partial<Pick<NormChargeGroup, 'count' | 'placement' | 'arrangement'>>): NormDesign {
  return { ...nd, charges: { ...g, ...change } };
}

// ── Charge structure ────────────────────────────────────────────────────────

function keepOrDefaultArrangement(nd: NormDesign, placement: Placement, count: Count, current: Arrangement): Arrangement {
  return legalArrangements(nd.ordinary, placement, count).includes(current) ? current : defaultArrangement(nd.ordinary, placement, count);
}

/** Counts: blocked when structurally illegal here, or when they would leave no legal tincture. */
export function countChoices(nd: NormDesign): Choice<Count>[] {
  const g = nd.charges;
  if (!g) return COUNTS.map(ok);
  return COUNTS.map((n) => {
    const arrangement = keepOrDefaultArrangement(nd, g.placement, n, g.arrangement);
    return choice(n, chargeStructureIssue(nd.ordinary, g.placement, n, arrangement, g.charge)
      ?? noTinctureReason(withCharges(nd, g, { count: n, arrangement })));
  });
}

export function placementChoices(nd: NormDesign): Choice<Placement>[] {
  const g = nd.charges;
  const placements: Placement[] = ['field', 'ordinary'];
  if (!g) {
    return placements.map((p) => choice(p, p === 'ordinary' && (!nd.ordinary || nd.ordinary.type === 'bordure')
      ? chargeStructureIssue(nd.ordinary, 'ordinary', 1, 'single') : null));
  }
  return placements.map((p) => {
    const arrangement = keepOrDefaultArrangement(nd, p, g.count, g.arrangement);
    return choice(p, chargeStructureIssue(nd.ordinary, p, g.count, arrangement, g.charge)
      ?? noTinctureReason(withCharges(nd, g, { placement: p, arrangement })));
  });
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
    choices: FIELD_ARR[g.count].map((a) => choice(a, legal.includes(a)
      ? noTinctureReason(withCharges(nd, g, { arrangement: a }))
      : chargeStructureIssue(nd.ordinary, g.placement, g.count, a, g.charge))),
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
  const allowed = meta.postures.map((p) => postureTerm(id, p));
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

/**
 * A one-click repair for rule-of-tincture issues: a new tincture for the charges or the ordinary
 * (every alternative on that layer listed, the suggestion first), or — when no single layer can
 * clear them — new tinctures for both.
 */
export type TinctureFix =
  | { layer: 'charges'; tincture: ChargeTincture; alternatives: ChargeTincture[]; label: string; design: NormDesign }
  | { layer: 'ordinary'; tincture: Tincture; alternatives: Tincture[]; label: string; design: NormDesign }
  | { layer: 'ordinary-and-charges'; ordinary: Tincture; charges: ChargeTincture; label: string; design: NormDesign };

const withChargeTincture = (nd: NormDesign, g: NormChargeGroup, t: ChargeTincture): NormDesign => ({ ...nd, charges: { ...g, tincture: t } });
const withOrdinaryTincture = (nd: NormDesign, o: Ordinary, t: Tincture): NormDesign => ({ ...nd, ordinary: { ...o, tincture: t } });

/** "Switch the lions to Gules" / "Counterchange the mullets". */
function chargeFixWords(g: NormChargeGroup, t: ChargeTincture): string {
  const what = `the ${chargeNoun(g.charge, g.count)}`;
  return t === 'counterchanged' ? `counterchange ${what}` : `switch ${what} to ${TINCTURE_NAME[t]}`;
}

/**
 * A tincture change that clears every rule-of-tincture issue, or null when there are none. Tries a
 * single layer first — the charges before the ordinary when the charges have an issue, and a plain
 * tincture before counterchanged — then both layers together, which always finds a way out, so a
 * design never sits in a violation with no fix.
 */
export function suggestTinctureFix(nd: NormDesign): TinctureFix | null {
  const issues = tinctureIssues(nd);
  if (!issues.length) return null;
  const g = nd.charges, o = nd.ordinary;
  const clears = (d: NormDesign) => tinctureIssues(d).length === 0;
  const chargeFix = (): TinctureFix | null => {
    if (!g) return null;
    const alternatives = CHARGE_TINCTURES.filter((t) => t !== g.tincture && clears(withChargeTincture(nd, g, t)));
    if (!alternatives.length) return null;
    const t = alternatives[0];
    return { layer: 'charges', tincture: t, alternatives, label: cap(chargeFixWords(g, t)), design: withChargeTincture(nd, g, t) };
  };
  const ordinaryFix = (): TinctureFix | null => {
    if (!o) return null;
    const alternatives = TINCTURES.filter((t) => t !== o.tincture && clears(withOrdinaryTincture(nd, o, t)));
    if (!alternatives.length) return null;
    const t = alternatives[0];
    return { layer: 'ordinary', tincture: t, alternatives, label: `Switch the ${ORDINARY_NAME[o.type]} to ${TINCTURE_NAME[t]}`, design: withOrdinaryTincture(nd, o, t) };
  };
  const bothFix = (): TinctureFix | null => {
    if (!g || !o) return null;
    for (const ot of TINCTURES) {
      const base = withOrdinaryTincture(nd, o, ot);
      const ct = CHARGE_TINCTURES.find((t) => clears(withChargeTincture(base, g, t)));
      if (ct) {
        return {
          layer: 'ordinary-and-charges', ordinary: ot, charges: ct, design: withChargeTincture(base, g, ct),
          label: `Switch the ${ORDINARY_NAME[o.type]} to ${TINCTURE_NAME[ot]} and ${chargeFixWords(g, ct)}`,
        };
      }
    }
    return null;
  };
  const chargesFirst = issues.some((i) => i.layer === 'charges');
  return (chargesFirst ? chargeFix() ?? ordinaryFix() : ordinaryFix() ?? chargeFix()) ?? bothFix();
}
