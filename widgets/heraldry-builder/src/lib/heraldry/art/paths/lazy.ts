// How the browser build reads charge art (vite.config.ts puts this module in the place of index.ts, whose exports it has): the main
// chunk's art (main.ts) is there at once, and every other charge's is loaded with its category's module, which the build splits into a
// chunk of its own. Until it has loaded, `pathFor` gives undefined for its charges, so they are drawn as the art-less fallback, and asks
// for the category: a shield drawn anywhere gets its art, and the app draws again when it comes (onArtChange). Never read by tests.

import type { ArtKey, ArtPaths } from '../types';
import { CHARGES, type ChargeCategory, type ChargeId } from '../../charges';
import { MAIN_ART } from './main';

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

const MAIN: ArtPaths = MAIN_ART;
const loaded = new Map<ChargeCategory, ArtPaths>();
const loading = new Map<ChargeCategory, Promise<void>>();
const listeners = new Set<(pending: boolean) => void>();

const inMain = (id: ChargeId): boolean => Object.prototype.hasOwnProperty.call(MAIN, id);

/** Tells the listeners once the current task is done (a load can be asked for while a component draws). */
function changed(): void {
  queueMicrotask(() => {
    for (const listener of listeners) listener(loading.size > 0);
  });
}

/** Loads a category's art; settles when it is loaded or has failed to load (then a later call tries again). */
function loadCategory(cat: ChargeCategory): Promise<void> {
  if (loaded.has(cat)) return Promise.resolve();
  const current = loading.get(cat);
  if (current) return current;
  const load = CATEGORY_ART[cat]()
    .then((paths) => { loaded.set(cat, paths); }, () => {})
    .finally(() => {
      loading.delete(cat);
      changed();
    });
  loading.set(cat, load);
  changed();
  return load;
}

/** The path of one drawing, or undefined when the charge has no such drawing or its category's art has not loaded yet (it is asked for). */
export function pathFor(id: ChargeId, key: ArtKey): string | undefined {
  if (inMain(id)) return MAIN[id]![key];
  const cat = CHARGES[id].category, paths = loaded.get(cat);
  if (!paths) void loadCategory(cat);
  return paths?.[id]?.[key];
}

/** Whether the art of these charges is loaded. */
export const artReady = (ids: readonly ChargeId[]): boolean => ids.every((id) => inMain(id) || loaded.has(CHARGES[id].category));

/** Loads the art of these charges; settles when it is there, or when a category failed to load (its charges then stay drawn as the fallback). */
export function loadArtFor(ids: readonly ChargeId[]): Promise<void> {
  const cats = new Set(ids.filter((id) => !inMain(id)).map((id) => CHARGES[id].category));
  return Promise.all([...cats].map(loadCategory)).then(() => {});
}

/** Calls `listener` whenever art starts or finishes loading, with whether any is still loading. Returns the unsubscribe. */
export function onArtChange(listener: (pending: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
