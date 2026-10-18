// Finding a picture in the charge picker by typing: the words each charge is known by, and the ranked search through them.
// The same word handling as the registry search (queryWords, matchesWords), so "star" and "wolves" find what they find there.

import { CATEGORY_LABEL, CHARGE_IDS, CHARGES, type ChargeId } from './charges';
import { chargeLabel } from './plain-words';
import { matchesWords, normaliseWords, queryWords } from './search-terms';

/** The words a name or plural is typed as: the blazon name, the plain word, and their plurals. */
function nameWords(id: ChargeId): string[] {
  const { name, plural, plain } = CHARGES[id];
  return [name, plural, ...(plain ? [plain.word, plain.plural] : [])].map(normaliseWords);
}

/** What a charge is searched through, padded with a space at each end (see buildSearchText): names, glosses, everyday words, kind. */
export function chargeSearchText(id: ChargeId): string {
  const { glossName, glossPlural, search, category } = CHARGES[id];
  return ` ${normaliseWords([...nameWords(id), chargeLabel(id), glossName, glossPlural, ...search, CATEGORY_LABEL[category]].join(' '))} `;
}

const SEARCH_TEXT: Record<ChargeId, string> = Object.fromEntries(CHARGE_IDS.map((id) => [id, chargeSearchText(id)])) as Record<ChargeId, string>;

/** 0 when the query is a whole name, 1 when it starts one, else 2. */
function rank(id: ChargeId, typed: string): number {
  const names = nameWords(id);
  return names.includes(typed) ? 0 : names.some((n) => n.startsWith(typed)) ? 1 : 2;
}

/** The charges the query finds: exact names first, then names it starts, then the other word matches, each in `CHARGE_IDS` order. */
export function searchCharges(query: string): ChargeId[] {
  const words = queryWords(query);
  if (!words.length) return [];
  const typed = normaliseWords(query);
  const ranked = CHARGE_IDS.filter((id) => matchesWords(SEARCH_TEXT[id], words)).map((id) => ({ id, rank: rank(id, typed) }));
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.id);
}
