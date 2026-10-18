// Every charge's path strings, statically imported: the art is ready as soon as the module is. The generated charges are traced
// when their modules load (art/procedural).

import type { ArtKey } from '../types';
import type { ChargeId } from '../../charges';
import { PATHS_CORE } from './core';
import { PATHS_BEAST } from './beast';
import { PATHS_MONSTER } from './monster';
import { PATHS_BIRD } from './bird';
import { PATHS_PLANT } from './plant';
import { PATHS_GEOMETRIC } from './geometric';
import { PATHS_CROSS } from './cross';
import { PATHS_OBJECT } from './object';
import { PATHS_MODERN } from './modern';
import { PATHS_STARS } from '../procedural/stars';
import { PATHS_SHAPES } from '../procedural/shapes';
import { PATHS_FOILS } from '../procedural/foils';
import { PATHS_KNOTS } from '../procedural/knots';
import { PATHS_CROSSES } from '../procedural/crosses';

export { CORE_ART_IDS } from './core';

/** One path per drawing in viewBox 0 0 100 100, drawn with fill-rule evenodd. */
export const CHARGE_ART: Readonly<Record<ChargeId, Readonly<Partial<Record<ArtKey, string>>>>> = Object.freeze({
  ...PATHS_CORE, ...PATHS_BEAST, ...PATHS_MONSTER, ...PATHS_BIRD, ...PATHS_PLANT, ...PATHS_GEOMETRIC, ...PATHS_CROSS, ...PATHS_OBJECT, ...PATHS_MODERN,
  ...PATHS_STARS, ...PATHS_SHAPES, ...PATHS_FOILS, ...PATHS_KNOTS, ...PATHS_CROSSES,
});

/** The path of one drawing, or undefined when the charge has no such drawing. */
export function pathFor(id: ChargeId, key: ArtKey): string | undefined {
  return CHARGE_ART[id][key];
}
