// Every charge's path strings, statically imported: the main chunk's (main.ts) and every category module's. The library reads them
// through index.ts; the browser build reads its art through lazy.ts instead, which loads a category's module when it is first
// wanted, so nothing in src imports this module but index.ts (tests and the art tools may).

import type { ArtKey } from '../types';
import type { AliasId, ChargeId } from '../../charges';
import { MAIN_ART } from './main';
import { PATHS_BEAST } from './beast';
import { PATHS_MONSTER } from './monster';
import { PATHS_BIRD } from './bird';
import { PATHS_PLANT } from './plant';
import { PATHS_GEOMETRIC } from './geometric';
import { PATHS_CROSS } from './cross';
import { PATHS_OBJECT } from './object';
import { PATHS_MODERN } from './modern';

/** The art of every charge but the aliases: one path per drawing in viewBox 0 0 100 100, drawn with fill-rule evenodd. */
export const CHARGE_ART: Readonly<Record<Exclude<ChargeId, AliasId>, Readonly<Partial<Record<ArtKey, string>>>>> = Object.freeze({
  ...MAIN_ART, ...PATHS_BEAST, ...PATHS_MONSTER, ...PATHS_BIRD, ...PATHS_PLANT, ...PATHS_GEOMETRIC, ...PATHS_CROSS, ...PATHS_OBJECT, ...PATHS_MODERN,
});
