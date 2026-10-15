// The builder's semys: which charges a part of the background or a band may be strewn with, and which tinctures it and they may
// be drawn in, with the reason for every blocked choice. A semy is judged by what the strewn charges stand out against (A3B4a: the
// tincture they lie on), by the rule on the parts of the field, and by the structure of the groups it makes (strewn.ts).


import { COLOURS, METALS, TINCTURES, TINCTURE_CLASS, type Tincture } from './tinctures';
import { CHARGE_IDS, type ChargeId } from './charges';
import { asSemy, groupAt, paintTinctures, semyPaint, tincturePaint, type Design, type SemyPaint } from './design';
import { paintAt, painted, reasonAt, type PaintTarget } from './paint-target';
import { strewnIssues } from './strewn';
import { semyIssues } from './tincture-rule';
import type { Choice } from './options';


const choice = <T>(value: T, reason: string | null): Choice<T> => (reason ? { value, allowed: false, reason } : { value, allowed: true });


/** The semy at the target, or null when it is painted otherwise. */
export function semyAt(d: Design, target: PaintTarget): SemyPaint | null {
  return asSemy(paintAt(d, target));
}


/** Whether the target can be strewn: a part of the background, or a band (the charges on a picture are too small to draw). */
const canStrew = (d: Design, target: PaintTarget): boolean => target.k === 'field' || groupAt(d, target.path).item.k === 'ordinary';


/** The tincture a target is painted in, or the first the paint is made of: what a semy is strewn on when one is chosen. */
function groundAt(d: Design, target: PaintTarget): Tincture {
  return semyAt(d, target)?.ground.t ?? paintTinctures(paintAt(d, target))[0] ?? METALS[0];
}


/** The tinctures that stand out against `ground`, the metals first when it is a colour. */
const contrasting = (ground: Tincture): readonly Tincture[] => (TINCTURE_CLASS[ground] === 'metal' ? COLOURS : METALS);


interface Trial { paint: SemyPaint; reason: string | null }


/** The semy of `charge` in `ink` on `ground`, and why the target can't be painted so. */
function trial(d: Design, target: PaintTarget, ground: Tincture, charge: ChargeId, ink: Tincture): Trial {
  const paint = semyPaint(ground, charge, ink);
  const design = painted(d, target, paint);
  const at = target.k === 'field' ? { k: 'field' } as const : { k: 'group', path: target.path } as const;
  return { paint, reason: reasonAt(design, target) ?? semyIssues(paint, at)[0]?.message ?? strewnIssues(design)[0]?.message ?? null };
}


/** The semy on `ground` with the first ink that works, the `preferred` one first. */
function withFirstInk(d: Design, target: PaintTarget, ground: Tincture, charge: ChargeId, preferred: Tincture): Trial {
  let first: Trial | null = null;
  for (const ink of [preferred, ...contrasting(ground)]) {
    if (TINCTURE_CLASS[ink] === TINCTURE_CLASS[ground]) continue;
    const tried = trial(d, target, ground, charge, ink);
    if (!tried.reason) return tried;
    first ??= tried;
  }
  return first!;
}


/** The tincture the charges of a semy are first drawn in: the one they have, else the first that contrasts. */
const preferredInk = (d: Design, target: PaintTarget, ground: Tincture): Tincture => semyAt(d, target)?.ink.t ?? contrasting(ground)[0];


/** The charges the target may be strewn with, blocked where the semy would break a rule where it lies. Empty where nothing can be strewn. */
export function semyChoices(d: Design, target: PaintTarget): Choice<ChargeId>[] {
  if (!canStrew(d, target)) return [];
  const ground = groundAt(d, target);
  return CHARGE_IDS.map((charge) => choice(charge, withFirstInk(d, target, ground, charge, preferredInk(d, target, ground)).reason));
}


/** The target strewn with this charge, on the tincture it has, the charges in the one they have if it contrasts, else the first that works. */
export function setSemy(d: Design, target: PaintTarget, charge: ChargeId): Design {
  const ground = groundAt(d, target);
  return painted(d, target, withFirstInk(d, target, ground, charge, preferredInk(d, target, ground)).paint);
}


/** The target as the plain tincture it was strewn on; unchanged when it is not strewn. */
export function clearSemy(d: Design, target: PaintTarget): Design {
  const now = semyAt(d, target);
  return now ? painted(d, target, tincturePaint(now.ground.t)) : d;
}


/** The semy with `slot` (0 the tincture it lies on, 1 the charges) set to `t`: for the tincture, the charges move only when they would no longer contrast. */
function withColour(d: Design, target: PaintTarget, now: SemyPaint, slot: 0 | 1, t: Tincture): Trial {
  return slot === 0 ? withFirstInk(d, target, t, now.charge.charge, now.ink.t) : trial(d, target, now.ground.t, now.charge.charge, t);
}


/** The tinctures for the tincture a semy lies on (slot 0) or its charges (slot 1), blocked where they would not work. Empty unless the target is strewn. */
export function semyColourChoices(d: Design, target: PaintTarget, slot: 0 | 1): Choice<Tincture>[] {
  const now = semyAt(d, target);
  return now ? TINCTURES.map((t) => choice(t, withColour(d, target, now, slot, t).reason)) : [];
}


/** The semy with `slot` set to `t`; unchanged when the target is not strewn. */
export function setSemyColour(d: Design, target: PaintTarget, slot: 0 | 1, t: Tincture): Design {
  const now = semyAt(d, target);
  return now ? painted(d, target, withColour(d, target, now, slot, t).paint) : d;
}
