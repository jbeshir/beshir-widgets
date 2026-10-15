// A place in a design whose paint the builder changes one piece at a time (a fur, a treatment, a semy, a split or a pattern): a part
// of the field, or a band or picture, what makes a paint there acceptable, and how a paint of two colours is set one colour at a time.

import { COLOURS, METALS, TINCTURE_CLASS, type Tincture } from './tinctures';
import { canonical, groupAt, paintTinctures, replaceGroup, samePath, type Design, type GroupPath, type Paint } from './design';
import { paintIssues } from './structure';
import { groupTinctureIssues } from './tincture-rule';

/** The part of the design a paint is chosen for: a part of the field (the whole field when it is not divided is part 0), or a band or picture. */
export type PaintTarget = { k: 'field'; part: 0 | 1 } | { k: 'group'; path: GroupPath };

/** The paint at the target. */
export function paintAt(d: Design, target: PaintTarget): Paint {
  if (target.k === 'group') return groupAt(d, target.path).paint;
  if (d.kind !== 'arms') throw new RangeError('A fieldless design has no field to paint.');
  return d.field.k === 'divided' ? d.field.parts[target.part] : d.field;
}

/** The tincture a target is painted in, or the first its paint is made of (a fur's, a semy's or a treatment's ground first): what a new paint is laid on. */
export function groundAt(d: Design, target: PaintTarget): Tincture {
  return paintTinctures(paintAt(d, target))[0] ?? METALS[0];
}

/** The design with the group at `path` painted `paint` (not canonicalised: a paint changes no order). */
export const withPaint = (d: Design, path: GroupPath, paint: Paint): Design => replaceGroup(d, path, { ...groupAt(d, path), paint });

/** The design with the target painted `paint`, in canonical form. */
export function painted(d: Design, target: PaintTarget, paint: Paint): Design {
  if (target.k === 'group') return canonical(withPaint(d, target.path, paint));
  if (d.kind !== 'arms') return d;
  const f = d.field;
  return canonical({ ...d, field: f.k === 'divided' ? { ...f, parts: f.parts.map((p, i) => (i === target.part ? paint : p)) } : paint });
}

/** Why the target can't be painted as it is, or null: the rule on the field's parts, or the rule of tincture where the group lies. */
export function reasonAt(d: Design, target: PaintTarget): string | null {
  const issues = paintIssues(d);
  if (target.k === 'field') return issues.find((i) => i.at.k === 'field')?.message ?? null;
  const own = issues.find((i) => i.at.k === 'group' && samePath(i.at.path, target.path));
  return own?.message ?? groupTinctureIssues(d, target.path)[0]?.message ?? null;
}

// ── Two colours, set one at a time ──────────────────────────────────────────

/** A paint tried at a target, and why the target can't be painted so (null when it can). */
export interface Trial<P> { paint: P; reason: string | null }

/** The tinctures that stand out against `t`, the metals first when it is a colour. */
export const contrasting = (t: Tincture): readonly Tincture[] => (TINCTURE_CLASS[t] === 'metal' ? COLOURS : METALS);

/** `partners` without repeats and without those of `t`'s class: the tinctures that may stand beside `t` in a paint of a metal and a colour. */
export const ofOtherClass = (t: Tincture, partners: readonly Tincture[]): Tincture[] =>
  [...new Set(partners)].filter((p) => TINCTURE_CLASS[p] !== TINCTURE_CLASS[t]);

/**
 * A paint with one colour chosen and the other the first of `partners` that works (callers put the partner it has first); when
 * none works, the first one tried, so its reason can be shown.
 */
export function withPartner<P>(partners: readonly Tincture[], make: (partner: Tincture) => P, reason: (paint: P) => string | null): Trial<P> {
  let first: Trial<P> | null = null;
  for (const partner of partners) {
    const paint = make(partner);
    const tried = { paint, reason: reason(paint) };
    if (!tried.reason) return tried;
    first ??= tried;
  }
  if (!first) throw new RangeError('No partner tincture to try.');
  return first;
}
