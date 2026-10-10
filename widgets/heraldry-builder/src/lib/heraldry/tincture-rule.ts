// Rule of tincture: contrast predicate, per-layer contacts (incl. the five-point slot
// probe) and human messages naming the layer and, where relevant, the slots.

import { CHARGES, type ChargeId } from './charges';
import {
  NUMBER_WORD, ORDINARY_NAME, chargeContext, chargeNoun, fieldTinctures, type Count, type DividedField, type Field, type Issue, type NormDesign,
  type OrdinaryType,
} from './design';
import { chargeSlots, slotColumn, slotContacts, slotRow, type Slot } from './geometry';
import { CHARGE_TINCTURE_NAME, TINCTURE_CLASS, TINCTURE_NAME, type ChargeTincture, type Tincture } from './tinctures';
import { capitalise, joinAnd } from './words';

export type ContrastFailure = 'same' | 'colour-on-colour' | 'metal-on-metal';

/** `contacts` = tinctures the element lies on. Never the same tincture, and at least one opposite class. */
export function contrastFailure(top: Tincture, contacts: readonly Tincture[]): ContrastFailure | null {
  if (contacts.includes(top)) return 'same';
  if (contacts.some((c) => TINCTURE_CLASS[c] !== TINCTURE_CLASS[top])) return null;
  return TINCTURE_CLASS[top] === 'colour' ? 'colour-on-colour' : 'metal-on-metal';
}

export const FAILURE_TEXT: Record<ContrastFailure, string> = {
  same: 'same tincture',
  'colour-on-colour': 'colour on colour',
  'metal-on-metal': 'metal on metal',
};

/** The field's other tincture: what a counterchanged charge is filled with where it lies on `under`. */
function counterchangeOf(field: DividedField, under: Tincture): Tincture {
  return field.tinctures[0] === under ? field.tinctures[1] : field.tinctures[0];
}

/**
 * Why a charge tinctured `t` fails on `contacts` (the field tinctures it lies on), or null. Each part
 * of a counterchanged charge shows the field's other tincture over the part it lies on, so it fails
 * exactly when the two field tinctures share a class; on a plain field there is no other tincture
 * and the charge would vanish into the field.
 */
export function chargeContrastFailure(t: ChargeTincture, field: Field, contacts: readonly Tincture[]): ContrastFailure | null {
  if (t !== 'counterchanged') return contrastFailure(t, contacts);
  if (field.kind === 'plain') return 'same';
  return contacts.map((under) => contrastFailure(counterchangeOf(field, under), [under])).find((f) => f !== null) ?? null;
}

/**
 * Why the charges can't be counterchanged where they are, or null when they can: only charges lying
 * on a divided field can take its tinctures in reverse. Phrased so it can double as a blocked reason.
 */
export function counterchangeUnavailable(nd: NormDesign): string | null {
  const c = nd.charges;
  if (!c) return null;
  const noun = chargeNoun(c.charge, c.count);
  if (chargeContext(nd.ordinary, c.placement) === 'on' && nd.ordinary) {
    const [lie, they] = c.count === 1 ? ['lies', 'it'] : ['lie', 'they'];
    return `The ${noun} ${lie} on the ${ORDINARY_NAME[nd.ordinary.type]}, not on the field, so ${they} can't be counterchanged — only charges on a divided field can.`;
  }
  if (nd.field.kind === 'plain') {
    return 'Counterchanged needs a divided field: each charge takes the field\'s other tincture, and a plain field has only one.';
  }
  return null;
}

/** Field tinctures an ordinary lies on: all of them, except a chief on per fess / per chevron (t1 only). */
export function ordinaryContacts(field: Field, type: OrdinaryType): Tincture[] {
  if (field.kind === 'plain') return [field.tincture];
  if (type === 'chief' && (field.division === 'per-fess' || field.division === 'per-chevron')) return [field.tinctures[0]];
  return [field.tinctures[0], field.tinctures[1]];
}

/** What each charge slot lies on: the field (five-point probe) or the ordinary it is charged on. */
export function chargeSlotContacts(nd: NormDesign): Tincture[][] {
  const c = nd.charges;
  if (!c) return [];
  const slots = chargeSlots(nd);
  if (chargeContext(nd.ordinary, c.placement) === 'on') return nd.ordinary ? slots.map(() => [nd.ordinary!.tincture]) : [];
  return slots.map((s) => slotContacts(nd.field, s));
}

/** "(a two-colour field needs a metal charge)" when both background tinctures share a class. */
function twoClassHint(failure: ContrastFailure, contacts: readonly Tincture[], what: string): string {
  if (failure === 'same' || contacts.length !== 2) return '';
  return failure === 'colour-on-colour'
    ? ` (a two-colour field needs a metal ${what})`
    : ` (a two-metal field needs a colour ${what})`;
}

/**
 * Name a subset of slots in words: "the Gules lion", "both Or keys", "the two upper Gules mullets",
 * "the upper-left and lower Gules mullets".
 */
export function describeSlots(slots: readonly Slot[], idx: readonly number[], tincture: Tincture | null, charge: ChargeId): string {
  const meta = CHARGES[charge];
  // With no tincture the word is dropped: "the two upper mullets".
  const T = tincture ? `${TINCTURE_NAME[tincture]} ` : '';
  const count = slots.length;
  if (count <= 1) return `the ${T}${meta.name}`;
  if (idx.length === count) return count === 2 ? `both ${T}${meta.plural}` : `all ${NUMBER_WORD[count as Count]} ${T}${meta.plural}`;
  const rows = slots.map(slotRow);
  const r0 = rows[idx[0]];
  const sameRow = idx.every((i) => rows[i] === r0);
  const othersInRow = rows.some((r, i) => r === r0 && !idx.includes(i));
  if (sameRow && !othersInRow) {
    return idx.length === 1 ? `the ${r0} ${T}${meta.name}` : `the ${NUMBER_WORD[idx.length as Count]} ${r0} ${T}${meta.plural}`;
  }
  const oneRow = rows.every((r) => r === rows[0]);
  const labels = idx.map((i) => {
    const sharesRow = rows.some((r, j) => j !== i && r === rows[i]);
    const label = [oneRow ? '' : rows[i], sharesRow ? slotColumn(slots[i]) : ''].filter(Boolean).join('-');
    return label === 'middle-centre' ? 'centre' : label || slotColumn(slots[i]);
  });
  return idx.length === 1 ? `the ${labels[0]} ${T}${meta.name}` : `the ${joinAnd(labels)} ${T}${meta.plural}`;
}

/** Every rule-of-tincture violation, ordinary first then charges. */
export function tinctureIssues(nd: NormDesign): Issue[] {
  const issues: Issue[] = [];
  const { field, ordinary, charges } = nd;

  if (ordinary) {
    const contacts = ordinaryContacts(field, ordinary.type);
    const f = contrastFailure(ordinary.tincture, contacts);
    if (f) {
      const T = TINCTURE_NAME[ordinary.tincture];
      const name = ORDINARY_NAME[ordinary.type];
      let message: string;
      if (field.kind === 'plain') message = `${T} ${name} on ${TINCTURE_NAME[field.tincture]} field: ${FAILURE_TEXT[f]}`;
      else if (f === 'same') message = `${T} ${name} lies on the ${T} part of the field: same tincture`;
      else if (contacts.length === 1) message = `${T} ${name} lies on ${TINCTURE_NAME[contacts[0]]}: ${FAILURE_TEXT[f]}`;
      else message = `${T} ${name} on ${TINCTURE_NAME[contacts[0]]} and ${TINCTURE_NAME[contacts[1]]} field: ${FAILURE_TEXT[f]}${twoClassHint(f, contacts, 'ordinary')}`;
      issues.push({ code: 'tincture', layer: 'ordinary', message });
    }
  }

  if (charges) {
    const meta = CHARGES[charges.charge];
    const noun = charges.count === 1 ? meta.name : meta.plural;
    const tincture = charges.tincture;
    const T = CHARGE_TINCTURE_NAME[tincture];
    const unavailable = tincture === 'counterchanged' ? counterchangeUnavailable(nd) : null;
    if (unavailable) {
      issues.push({ code: 'tincture', layer: 'charges', message: unavailable, slots: chargeSlots(nd).map((_, i) => i) });
    } else if (tincture === 'counterchanged') {
      // Available, so the field is divided. Every part shows the other field tincture over its own,
      // so all the charges pass or fail together.
      const f = field.kind === 'divided' ? chargeContrastFailure(tincture, field, field.tinctures) : null;
      if (f) {
        const [a, b] = fieldTinctures(field).map((t) => TINCTURE_NAME[t]);
        const hint = f === 'same' ? '' : ' (counterchanging needs a field of one metal and one colour)';
        issues.push({
          code: 'tincture', layer: 'charges',
          message: `${capitalise(T)} ${noun} on ${a} and ${b}: ${FAILURE_TEXT[f]}${hint}`,
          slots: chargeSlots(nd).map((_, i) => i),
        });
      }
    } else if (chargeContext(ordinary, charges.placement) === 'on') {
      if (ordinary && ordinary.type !== 'bordure') {
        const f = contrastFailure(tincture, [ordinary.tincture]);
        if (f) {
          issues.push({
            code: 'tincture', layer: 'charges',
            message: `${T} ${noun} on ${TINCTURE_NAME[ordinary.tincture]} ${ORDINARY_NAME[ordinary.type]}: ${FAILURE_TEXT[f]}`,
            slots: Array.from({ length: charges.count }, (_, i) => i),
          });
        }
      }
    } else {
      const slots = chargeSlots(nd);
      const contacts = slots.map((s) => slotContacts(field, s));
      const failures = contacts.map((cs) => contrastFailure(tincture, cs));
      if (field.kind === 'plain') {
        const f = failures.find((x) => x !== null);
        if (f) {
          issues.push({
            code: 'tincture', layer: 'charges',
            message: `${T} ${noun} on ${TINCTURE_NAME[field.tincture]} field: ${FAILURE_TEXT[f]}`,
            slots: slots.map((_, i) => i),
          });
        }
      } else {
        // Group failing slots that share the same background and failure, in slot order.
        const groups = new Map<string, number[]>();
        failures.forEach((f, i) => {
          if (!f) return;
          const key = `${f}|${contacts[i].join(',')}`;
          groups.set(key, [...(groups.get(key) ?? []), i]);
        });
        for (const [key, idx] of groups) {
          const f = key.split('|')[0] as ContrastFailure;
          const cs = contacts[idx[0]];
          const names = cs.map((t) => TINCTURE_NAME[t]);
          let message: string;
          if (idx.length === slots.length && cs.length === 2) {
            message = `${T} ${noun} on ${names[0]} and ${names[1]} field: ${FAILURE_TEXT[f]}${twoClassHint(f, cs, 'charge')}`;
          } else {
            const subject = describeSlots(slots, idx, tincture, charges.charge);
            const plural = idx.length > 1;
            const where = cs.length === 1 ? `on ${names[0]}` : `across ${names[0]} and ${names[1]}`;
            message = `${capitalise(subject)} ${plural ? 'lie' : 'lies'} ${where}: ${FAILURE_TEXT[f]}${twoClassHint(f, cs, 'charge')}`;
          }
          issues.push({ code: 'tincture', layer: 'charges', message, slots: idx });
        }
      }
    }
  }
  return issues;
}
