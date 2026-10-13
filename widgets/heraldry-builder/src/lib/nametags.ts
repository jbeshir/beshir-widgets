// What goes on a nametag sheet: one entry's tag, once or repeated to fill an A4 page.

import type { ShapedDesign } from './heraldry';

/** Two columns of four on A4. */
export const TAGS_PER_PAGE = 8;

export interface Nametag {
  displayName: string;
  blazon: string;
  arms: ShapedDesign;
}

/** How many copies of the tag go on the sheet: one, or as many as fill the page. */
export type Copies = 'one' | 'fill';

/** The tag as it goes on paper for a choice of copies. */
export function sheetTags<T>(tag: T, copies: Copies): readonly T[] {
  return Array.from({ length: copies === 'fill' ? TAGS_PER_PAGE : 1 }, () => tag);
}
