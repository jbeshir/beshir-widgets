// The builder's natural colours ("a lion proper"): only the charges with a palette (charges.ts) take them, and the picture is
// judged as the class and conflict tinctures that palette names (surface.ts).

import { CHARGES } from './charges';
import { groupAt, type Design, type GroupPath } from './design';
import { painted, reasonAt } from './paint-target';
import { choice, type Choice } from './options';

/** Whether the picture at `path` has natural colours to be painted in. */
export function hasNaturalColours(d: Design, path: GroupPath): boolean {
  const { item } = groupAt(d, path);
  return item.k === 'charge' && CHARGES[item.charge].proper !== null;
}

/** The group painted in its natural colours. */
export function setProper(d: Design, path: GroupPath): Design {
  return painted(d, { k: 'group', path }, { k: 'proper' });
}

/** Natural colours as a choice for the picture at `path`, blocked where they would break a rule where it lies; null when the picture has no natural colours. */
export function properChoice(d: Design, path: GroupPath): Choice<'proper'> | null {
  if (!hasNaturalColours(d, path)) return null;
  return choice('proper', reasonAt(setProper(d, path), { k: 'group', path }));
}
