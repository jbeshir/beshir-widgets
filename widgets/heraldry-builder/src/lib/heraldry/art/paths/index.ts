// How the library reads charge art: every charge's path strings, statically imported (all.ts), so the art is ready as soon as the
// module is. Tests, the SSR goldens, the SCA and sample writers and the worker read it so. The browser build reads lazy.ts in its place
// (vite.config.ts), which has the same exports and loads the art outside the main chunk a category at a time.

import type { ArtKey } from '../types';
import { isAliasId, type ChargeId } from '../../charges';
import { CHARGE_ART } from './all';

export { CORE_ART_IDS } from './core';

/** The path of one drawing, or undefined when the charge has no such drawing (an alias has none: art/procedural/derived.ts). */
export function pathFor(id: ChargeId, key: ArtKey): string | undefined {
  return isAliasId(id) ? undefined : CHARGE_ART[id][key];
}

/** Whether the art of these charges is loaded: always, here. */
export const artReady = (_ids: readonly ChargeId[]): boolean => true;

/** Loads the art of these charges: it is loaded already. */
export function loadArtFor(_ids: readonly ChargeId[]): Promise<void> {
  return Promise.resolve();
}

/** Calls `listener` whenever art starts or finishes loading, with whether any is still loading: never, here. Returns the unsubscribe. */
export function onArtChange(_listener: (pending: boolean) => void): () => void {
  return () => {};
}
