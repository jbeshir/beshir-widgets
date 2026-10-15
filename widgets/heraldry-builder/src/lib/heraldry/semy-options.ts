// The builder's semys: which charges a part of the background or a band may be strewn with, and which tinctures it and they may
// be drawn in, with the reason for every blocked choice. A semy is judged by what the strewn charges stand out against (A3B4a: the
// tincture they lie on), by the rule on the parts of the field, and by the structure of the groups it makes (strewn.ts).

import { TINCTURES, type Tincture } from './tinctures';
import { CHARGE_IDS, type ChargeId } from './charges';
import { asSemy, groupAt, semyPaint, tincturePaint, type Design, type SemyPaint } from './design';
import { contrasting, groundAt, ofOtherClass, paintAt, painted, reasonAt, withPartner, type PaintTarget, type Trial } from './paint-target';
import { strewnIssues } from './strewn';
import { semyIssues } from './tincture-rule';
import { choice, type Choice } from './options';

/** The semy at the target, or null when it is painted otherwise. */
export function semyAt(d: Design, target: PaintTarget): SemyPaint | null {
  return asSemy(paintAt(d, target));
}

/** Whether the target can be strewn: a part of the background, or a band (the charges on a picture are too small to draw). */
const canStrew = (d: Design, target: PaintTarget): boolean => target.k === 'field' || groupAt(d, target.path).item.k === 'ordinary';

/** Why the target can't be painted with this semy: the rules where it lies, the strewn charges against their ground, the groups it makes. */
function semyReason(d: Design, target: PaintTarget, paint: SemyPaint): string | null {
  const design = painted(d, target, paint);
  const at = target.k === 'field' ? { k: 'field' } as const : { k: 'group', path: target.path } as const;
  return reasonAt(design, target) ?? semyIssues(paint, at)[0]?.message ?? strewnIssues(design)[0]?.message ?? null;
}

/** The semy of `charge` in `ink` on `ground`, and why the target can't be painted so. */
function trial(d: Design, target: PaintTarget, ground: Tincture, charge: ChargeId, ink: Tincture): Trial<SemyPaint> {
  const paint = semyPaint(ground, charge, ink);
  return { paint, reason: semyReason(d, target, paint) };
}

/** The semy on `ground` with the first ink that works, the `preferred` one first. */
const withFirstInk = (d: Design, target: PaintTarget, ground: Tincture, charge: ChargeId, preferred: Tincture): Trial<SemyPaint> =>
  withPartner(ofOtherClass(ground, [preferred, ...contrasting(ground)]), (ink) => semyPaint(ground, charge, ink), (paint) => semyReason(d, target, paint));

/** The target strewn with `charge` on the tincture it has, the charges in the ink they have (else the first that contrasts). */
function strewn(d: Design, target: PaintTarget, charge: ChargeId): Trial<SemyPaint> {
  const ground = groundAt(d, target);
  return withFirstInk(d, target, ground, charge, semyAt(d, target)?.ink.t ?? contrasting(ground)[0]);
}

/** The charges the target may be strewn with, blocked where the semy would break a rule where it lies. Empty where nothing can be strewn. */
export function semyChoices(d: Design, target: PaintTarget): Choice<ChargeId>[] {
  if (!canStrew(d, target)) return [];
  return CHARGE_IDS.map((charge) => choice(charge, strewn(d, target, charge).reason));
}

/** The target strewn with this charge, on the tincture it has, the charges in the one they have if it contrasts, else the first that works. */
export function setSemy(d: Design, target: PaintTarget, charge: ChargeId): Design {
  return painted(d, target, strewn(d, target, charge).paint);
}

/** The target as the plain tincture it was strewn on; unchanged when it is not strewn. */
export function clearSemy(d: Design, target: PaintTarget): Design {
  const now = semyAt(d, target);
  return now ? painted(d, target, tincturePaint(now.ground.t)) : d;
}

/** The semy with `slot` (0 the tincture it lies on, 1 the charges) set to `t`: for the tincture, the charges move only when they would no longer contrast. */
function withColour(d: Design, target: PaintTarget, now: SemyPaint, slot: 0 | 1, t: Tincture): Trial<SemyPaint> {
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
