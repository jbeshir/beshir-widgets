// The builder's treatments: which treatments a tincture may take (masoned, scaly, papellony) and which tinctures its lines may
// be drawn in, with the reason for every blocked choice. A treated tincture is judged as the tincture it lies on (GoT "Field
// Treatment"), so what blocks a choice is the lines not standing out against it (A3B3d) and what the tincture would break where it lies.

import { COLOURS, METALS, TINCTURES, TINCTURE_CLASS, type Tincture } from './tinctures';
import { asTreated, treatedPaint, type Design, type TreatedPaint } from './design';
import { DRAWN_TREATMENTS, type Treatment } from './divisions';
import { paintAt, painted, reasonAt, type PaintTarget } from './paint-target';
import type { Choice } from './options';


const choice = <T>(value: T, reason: string | null): Choice<T> => (reason ? { value, allowed: false, reason } : { value, allowed: true });


/** The treated tincture at the target, or null when it is painted otherwise. */
export function treatmentAt(d: Design, target: PaintTarget): TreatedPaint | null {
  return asTreated(paintAt(d, target));
}


/** The tincture a target is painted in, or the first the paint is made of: what a treatment is laid on when one is chosen. */
function groundAt(d: Design, target: PaintTarget): Tincture {
  const paint = paintAt(d, target);
  const treated = asTreated(paint);
  if (treated) return treated.ground.t;
  return paint.k === 'tincture' ? paint.t : METALS[0];
}


/** The tinctures that stand out against `ground`, the metals first when it is a colour. */
const contrasting = (ground: Tincture): readonly Tincture[] => (TINCTURE_CLASS[ground] === 'metal' ? COLOURS : METALS);


interface Trial { paint: TreatedPaint; reason: string | null }


/** The treated tincture with these tinctures, and why the target can't be painted so. */
function trial(d: Design, target: PaintTarget, treatment: Treatment, ground: Tincture, ink: Tincture): Trial {
  const paint = treatedPaint(treatment, ground, ink);
  return { paint, reason: reasonAt(painted(d, target, paint), target) };
}


/** The treatment on `ground` with the first ink that works, the `preferred` one first. */
function withFirstInk(d: Design, target: PaintTarget, treatment: Treatment, ground: Tincture, preferred: Tincture): Trial {
  let first: Trial | null = null;
  for (const ink of [preferred, ...contrasting(ground)]) {
    if (TINCTURE_CLASS[ink] === TINCTURE_CLASS[ground]) continue;
    const tried = trial(d, target, treatment, ground, ink);
    if (!tried.reason) return tried;
    first ??= tried;
  }
  return first!;
}


/** The treatments offered at the target, blocked where the paint would break a rule where it lies. */
export function treatmentChoices(d: Design, target: PaintTarget): Choice<Treatment>[] {
  const now = treatmentAt(d, target);
  const ground = groundAt(d, target);
  return DRAWN_TREATMENTS.map((treatment) => choice(treatment, withFirstInk(d, target, treatment, ground, now?.ink ?? contrasting(ground)[0]).reason));
}


/** The target laid with this treatment, on the tincture it has, the lines in the one they have if it contrasts, else the first that works. */
export function setTreatment(d: Design, target: PaintTarget, treatment: Treatment): Design {
  const now = treatmentAt(d, target);
  const ground = groundAt(d, target);
  return painted(d, target, withFirstInk(d, target, treatment, ground, now?.ink ?? contrasting(ground)[0]).paint);
}


/** The treated tincture with `slot` (0 the tincture, 1 the lines) set to `t`: for the tincture, the lines move only when they would no longer contrast. */
function withColour(d: Design, target: PaintTarget, now: TreatedPaint, slot: 0 | 1, t: Tincture): Trial {
  return slot === 0 ? withFirstInk(d, target, now.treatment, t, now.ink) : trial(d, target, now.treatment, now.ground.t, t);
}


/** The tinctures for the treated tincture (slot 0) or its lines (slot 1), blocked where they would not work. Empty unless the target is treated. */
export function treatmentColourChoices(d: Design, target: PaintTarget, slot: 0 | 1): Choice<Tincture>[] {
  const now = treatmentAt(d, target);
  return now ? TINCTURES.map((t) => choice(t, withColour(d, target, now, slot, t).reason)) : [];
}


/** The treated tincture with `slot` set to `t`; unchanged when the target is not treated. */
export function setTreatmentColour(d: Design, target: PaintTarget, slot: 0 | 1, t: Tincture): Design {
  const now = treatmentAt(d, target);
  return now ? painted(d, target, withColour(d, target, now, slot, t).paint) : d;
}
