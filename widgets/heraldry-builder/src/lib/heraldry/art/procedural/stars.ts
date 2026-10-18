// Generated stars (PLAN-D §2.6): the compass star, a mullet of eight points whose four cardinal points are longer.

import type { ArtPaths } from '../types';
import { ringsPath, star } from '../geometry';

export const PATHS_STARS = {
  'compass-star': { _: ringsPath([star(8, [43, 26], 9)]) },
} satisfies ArtPaths;
