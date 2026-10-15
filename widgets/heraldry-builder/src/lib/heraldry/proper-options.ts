// The builder's natural colours ("a lion proper"): only the charges with a palette (charges.ts) take them, and the picture is
// judged as the class and conflict tinctures that palette names (surface.ts).

import { CHARGES } from './charges';
import { canonical, groupAt, replaceGroup, type Design, type GroupPath } from './design';
import { groupTinctureIssues } from './tincture-rule';
import type { Choice } from './options';


/** Whether the picture at `path` has natural colours to be painted in. */
export function hasNaturalColours(d: Design, path: GroupPath): boolean {
  const { item } = groupAt(d, path);
  return item.k === 'charge' && CHARGES[item.charge].proper !== null;
}


/** The group painted in its natural colours. */
export function setProper(d: Design, path: GroupPath): Design {
  return canonical(replaceGroup(d, path, { ...groupAt(d, path), paint: { k: 'proper' } }));
}


/** Natural colours as a choice for the picture at `path`, blocked by the rule of tincture where it lies; null when the picture has no natural colours. */
export function properChoice(d: Design, path: GroupPath): Choice<'proper'> | null {
  if (!hasNaturalColours(d, path)) return null;
  const reason = groupTinctureIssues(setProper(d, path), path)[0]?.message ?? null;
  return reason ? { value: 'proper', allowed: false, reason } : { value: 'proper', allowed: true };
}
