// The art loader of the browser build (lazy.ts makes the one the app reads): the main chunk's art is there at once, and every other
// charge's comes with its category's module, loaded when first wanted. A module of its own, with no state but what `artLoader` makes, so
// a test can make a loader with stub category modules.

import type { ArtKey, ArtPaths } from '../types';
import { ALIAS_SOURCE, CHARGES, isAliasId, type ChargeCategory, type ChargeId } from '../../charges';

/** What lazy.ts exports in the place of index.ts. */
export interface ArtLoader {
  /** The path of one drawing, or undefined when the charge has no such drawing or its category's art has not loaded yet (it is asked for). */
  pathFor: (id: ChargeId, key: ArtKey) => string | undefined;
  /** Whether the art of these charges is loaded. */
  artReady: (ids: readonly ChargeId[]) => boolean;
  /**
   * Loads the art of these charges, asking again for a category that failed to load; settles when it is there, or when a category failed
   * to load again (its charges then stay drawn as the fallback).
   */
  loadArtFor: (ids: readonly ChargeId[]) => Promise<void>;
  /** Calls `listener` whenever art starts or finishes loading, with whether any is still loading. Returns the unsubscribe. */
  onArtChange: (listener: (pending: boolean) => void) => () => void;
}

/**
 * A loader of the art in `main` and in the category modules `categories` loads. A category that failed to load is not asked for again by
 * drawing (each draw would ask again, fail and draw again, for as long as the page is open: offline, or after a deploy renamed the chunks),
 * only by `loadArtFor`, which is what opening, loading or saving a design calls.
 */
export function artLoader(main: ArtPaths, categories: Record<ChargeCategory, () => Promise<ArtPaths>>): ArtLoader {
  const loaded = new Map<ChargeCategory, ArtPaths>();
  const loading = new Map<ChargeCategory, Promise<void>>();
  const failed = new Set<ChargeCategory>();
  const listeners = new Set<(pending: boolean) => void>();

  // an alias has no art of its own: it is drawn from its source's
  const drawnFrom = (id: ChargeId): ChargeId => (isAliasId(id) ? ALIAS_SOURCE[id] : id);
  const inMain = (id: ChargeId): boolean => Object.prototype.hasOwnProperty.call(main, drawnFrom(id));
  const categoryOf = (id: ChargeId): ChargeCategory => CHARGES[drawnFrom(id)].category;

  /** Tells the listeners once the current task is done (a load can be asked for while a component draws). */
  function changed(): void {
    queueMicrotask(() => {
      for (const listener of listeners) listener(loading.size > 0);
    });
  }

  function loadCategory(cat: ChargeCategory): Promise<void> {
    if (loaded.has(cat)) return Promise.resolve();
    const current = loading.get(cat);
    if (current) return current;
    failed.delete(cat);
    const load = categories[cat]()
      .then((paths) => { loaded.set(cat, paths); }, () => { failed.add(cat); })
      .finally(() => {
        loading.delete(cat);
        changed();
      });
    loading.set(cat, load);
    changed();
    return load;
  }

  return {
    pathFor(id, key) {
      if (isAliasId(id)) return undefined;
      if (inMain(id)) return main[id]![key];
      const cat = categoryOf(id), paths = loaded.get(cat);
      if (!paths && !failed.has(cat)) void loadCategory(cat);
      return paths?.[id]?.[key];
    },
    artReady: (ids) => ids.every((id) => inMain(id) || loaded.has(categoryOf(id))),
    loadArtFor(ids) {
      const cats = new Set(ids.filter((id) => !inMain(id)).map(categoryOf));
      return Promise.all([...cats].map(loadCategory)).then(() => {});
    },
    onArtChange(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
