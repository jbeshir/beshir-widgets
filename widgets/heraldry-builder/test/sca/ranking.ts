// Which gaps to close first. Each record not passing has a set of gap categories, all of which
// must be closed before the widget can express it; a category's single-gap count is the records
// it alone blocks (their category set is exactly {X}), i.e. what closing it would unlock.
import { categoryOf } from './gaps';

export interface CategoryRank {
  id: string;
  /** Records whose only gap category is this one. */
  singleGap: number;
  /** Records with this gap among others. */
  records: number;
}

/** Every category occurring in `tagSets`, by single-gap count, then record count, then id. */
export function rankCategories(tagSets: readonly (readonly string[])[]): CategoryRank[] {
  const ranks = new Map<string, CategoryRank>();
  for (const cats of tagSets.map((tags) => new Set(tags.map(categoryOf)))) {
    for (const id of cats) {
      const r = ranks.get(id) ?? { id, singleGap: 0, records: 0 };
      r.records++;
      if (cats.size === 1) r.singleGap++;
      ranks.set(id, r);
    }
  }
  return [...ranks.values()].sort((a, b) => b.singleGap - a.singleGap || b.records - a.records || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
