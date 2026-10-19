// Finding a picture in the charge picker by typing: the words each charge is known by, and the ranked search through them.
// The same word handling as the registry search (queryWords, matchesWords), so "star" and "wolves" find what they find there.

import { CATEGORY_LABEL, CHARGE_FORMS, CHARGE_IDS, CHARGES, type ChargeId } from './charges';
import { FORM_LABEL, chargeLabel } from './plain-words';
import { matchesWords, normaliseWords, queryWords } from './search-terms';

/** The words a name or plural is typed as: the blazon name, the plain word, and their plurals. */
function nameWords(id: ChargeId): string[] {
  const { name, plural, plain } = CHARGES[id];
  return [name, plural, ...(plain ? [plain.word, plain.plural] : [])].map(normaliseWords);
}

/** The words of the shapes a charge is also drawn in: "demi", "head", its head's name ("wolf's head"); its Shape row draws them. */
function formWords(id: ChargeId): string[] {
  const { forms, headName } = CHARGES[id];
  return [...forms.map((f) => FORM_LABEL[f].term), ...(forms.includes('head') && headName ? [headName.one, headName.many] : [])];
}

/** What a charge is searched through, padded with a space at each end (see buildSearchText): names, glosses, everyday words, shapes, kind. */
export function chargeSearchText(id: ChargeId): string {
  const { glossName, glossPlural, search, category } = CHARGES[id];
  return ` ${normaliseWords([...nameWords(id), chargeLabel(id), glossName, glossPlural, ...search, ...formWords(id), CATEGORY_LABEL[category]].join(' '))} `;
}

const FORM_TERMS: ReadonlySet<string> = new Set(CHARGE_FORMS.map((f) => FORM_LABEL[f].term));

/** True when the query names a shape a charge is drawn in ("wolf head", "demi"), which is chosen in the charge's own Shape row. */
export function searchesForm(query: string): boolean {
  return queryWords(query).some((w) => w.some((alt) => FORM_TERMS.has(alt)));
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
