// How the browser build reads charge art (vite.config.ts puts this module in the place of index.ts, whose exports it has): the main
// chunk's art (main.ts) is there at once, and every other charge's is loaded with its category's module, which the build splits into a
// chunk of its own. Until it has loaded, `pathFor` gives undefined for its charges, so they are drawn as the art-less fallback, and asks
// for the category: a shield drawn anywhere gets its art, and the app draws again when it comes (onArtChange). How it loads is
// loader.ts's, which test/lazy/art-lazy-runtime.test.ts runs with stub category modules.

import type { ArtKey, ArtPaths } from '../types';
import type { ChargeCategory, ChargeId } from '../../charges';
import { MAIN_ART } from './main';
import { artLoader } from './loader';

export { CORE_ART_IDS } from './core';

/** Each category's module of art outside the main chunk, loaded when first wanted. */
const CATEGORY_ART: Record<ChargeCategory, () => Promise<ArtPaths>> = {
  beast: () => import('./beast').then((m) => m.PATHS_BEAST),
  monster: () => import('./monster').then((m) => m.PATHS_MONSTER),
  bird: () => import('./bird').then((m) => m.PATHS_BIRD),
  plant: () => import('./plant').then((m) => m.PATHS_PLANT),
  geometric: () => import('./geometric').then((m) => m.PATHS_GEOMETRIC),
  cross: () => import('./cross').then((m) => m.PATHS_CROSS),
  object: () => import('./object').then((m) => m.PATHS_OBJECT),
  modern: () => import('./modern').then((m) => m.PATHS_MODERN),
};

const loader = artLoader(MAIN_ART, CATEGORY_ART);

// declared as index.ts declares them, so the two modules have the same type (test/art-lazy.test.ts)
export function pathFor(id: ChargeId, key: ArtKey): string | undefined {
  return loader.pathFor(id, key);
}

export const artReady = loader.artReady;

export function loadArtFor(ids: readonly ChargeId[]): Promise<void> {
  return loader.loadArtFor(ids);
}

export function onArtChange(listener: (pending: boolean) => void): () => void {
  return loader.onArtChange(listener);
}
