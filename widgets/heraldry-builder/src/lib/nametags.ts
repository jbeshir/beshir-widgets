// What goes on a nametag sheet: which entries, in what order, and how many to a page.

import type { DeviceArms } from './deviceArms';
import type { ShapedDesign } from './heraldry';

/** Two columns of four on A4. */
export const TAGS_PER_PAGE = 8;

export interface Nametag {
  id: string;
  displayName: string;
  blazon: string;
  arms: ShapedDesign;
}

export interface NametagSheet {
  tags: Nametag[];
  /** Ids that were asked for but could not be found or loaded. */
  missing: string[];
}

type RememberedArms = Pick<DeviceArms, 'id' | 'displayName' | 'blazon' | 'shield'>;

/**
 * The nametags for `ids` in that order, or for every remembered entry when `ids` is empty. Entries
 * remembered with their shield need no lookup; any other is loaded, and counted as missing when
 * that finds nothing.
 */
export async function collectNametags(
  ids: readonly string[],
  remembered: readonly RememberedArms[],
  load: (id: string) => Promise<Nametag | null>,
): Promise<NametagSheet> {
  const wanted = ids.length ? ids : remembered.map((r) => r.id);
  const found = await Promise.all(
    wanted.map(async (id): Promise<Nametag | null> => {
      const own = remembered.find((r) => r.id === id);
      if (own?.shield) return { id, displayName: own.displayName, blazon: own.blazon, arms: own.shield };
      return load(id);
    }),
  );
  return {
    tags: found.filter((t): t is Nametag => t !== null),
    missing: wanted.filter((_, i) => found[i] === null),
  };
}

/** The tags split into pages of `perPage`; no tags, no pages. */
export function paginate<T>(items: readonly T[], perPage: number = TAGS_PER_PAGE): T[][] {
  return Array.from({ length: Math.ceil(items.length / perPage) }, (_, i) => items.slice(i * perPage, (i + 1) * perPage));
}
