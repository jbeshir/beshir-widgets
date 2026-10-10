// The shape a coat of arms is displayed in. Pure presentation: the same arms can be shown on a
// heater shield, a square banner, a round or a lozenge. The shape travels beside the design (draft,
// API, database) but is never part of it, so blazon, gloss, signature, tags, uniqueness and the rule
// of tincture cannot see it.

import type { NormDesign } from './design';

export type FieldShape = 'heater' | 'banner' | 'round' | 'lozenge';
export const FIELD_SHAPES: readonly FieldShape[] = ['heater', 'banner', 'round', 'lozenge'];

/** New designs, old drafts and old rows without a shape use the heater shield. */
export const DEFAULT_FIELD_SHAPE: FieldShape = 'heater';

export const FIELD_SHAPE_NAME: Record<FieldShape, string> = {
  heater: 'Heater shield', banner: 'Square banner', round: 'Round', lozenge: 'Lozenge',
};

/** A design together with the shape it is displayed in. Only `design` is the arms. */
export interface ShapedDesign {
  design: NormDesign;
  shape: FieldShape;
}

export function isFieldShape(v: unknown): v is FieldShape {
  return typeof v === 'string' && (FIELD_SHAPES as readonly string[]).includes(v);
}
