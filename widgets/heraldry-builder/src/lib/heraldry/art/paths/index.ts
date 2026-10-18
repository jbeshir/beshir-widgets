// Every charge's path strings, statically imported: the art is ready as soon as the module is.

import type { ArtKey } from '../types';
import type { ChargeId } from '../../charges';
import { PATHS_CORE } from './core';
import { PATHS_BEAST } from './beast';
import { PATHS_MONSTER } from './monster';
import { PATHS_BIRD } from './bird';
import { PATHS_PLANT } from './plant';
import { PATHS_GEOMETRIC } from './geometric';
import { PATHS_OBJECT } from './object';
import { PATHS_MODERN } from './modern';

export { CORE_ART_IDS } from './core';

/** One path per drawing in viewBox 0 0 100 100, drawn with fill-rule evenodd. */
export const CHARGE_ART: Readonly<Record<ChargeId, Readonly<Partial<Record<ArtKey, string>>>>> = Object.freeze({
  ...PATHS_CORE, ...PATHS_BEAST, ...PATHS_MONSTER, ...PATHS_BIRD, ...PATHS_PLANT, ...PATHS_GEOMETRIC, ...PATHS_OBJECT, ...PATHS_MODERN,
});

/** The path of one drawing, or undefined when the charge has no such drawing. */
export function pathFor(id: ChargeId, key: ArtKey): string | undefined {
  return CHARGE_ART[id][key];
}
