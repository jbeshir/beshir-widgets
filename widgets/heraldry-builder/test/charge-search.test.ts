// The picture finder: every charge is found by what it is called, the ranking puts the best match first, and the
// popular list names real pictures once each.

import { describe, expect, it } from 'vitest';
import { CHARGE_IDS, CHARGES, POPULAR_CHARGE_IDS, searchCharges, type ChargeId } from '../src/lib/heraldry';

describe('searchCharges', () => {
  it('finds every charge by its name, its plural and each of its everyday words', () => {
    for (const id of CHARGE_IDS) {
      const { name, plural, plain, search } = CHARGES[id];
      for (const typed of [name, plural, ...(plain ? [plain.word, plain.plural] : []), ...search]) expect(searchCharges(typed), `${typed} → ${id}`).toContain(id);
    }
  });

  it('finds the stars by "star"', () => {
    const found = searchCharges('star');
    for (const id of ['mullet', 'estoile', 'compass-star'] as const) expect(found, id).toContain(id);
  });

  it('puts an exact name first, then the names it starts, then the other matches, each in picture order', () => {
    expect(searchCharges('star')[0]).toBe('mullet');
    expect(searchCharges('rose')[0]).toBe('rose');
    expect(searchCharges('cross crosslet')[0]).toBe('cross-crosslet');
    expect(searchCharges('cross')[0]).toBe('cross-crosslet');
    const rest = searchCharges('star').slice(1);
    expect(rest).toEqual(CHARGE_IDS.filter((id) => rest.includes(id)));
    expect(searchCharges('compass star')[0]).toBe('compass-star');
  });

  it('finds nothing for a query with no word to search for or no match', () => {
    expect(searchCharges('')).toEqual([]);
    expect(searchCharges('the')).toEqual([]);
    expect(searchCharges('zzzz')).toEqual([]);
  });
});

describe('the popular pictures', () => {
  it('are real pictures, each once, and include the original ones', () => {
    expect(new Set(POPULAR_CHARGE_IDS).size).toBe(POPULAR_CHARGE_IDS.length);
    expect(POPULAR_CHARGE_IDS.every((id: ChargeId) => CHARGE_IDS.includes(id))).toBe(true);
    expect(POPULAR_CHARGE_IDS.slice(0, 36)).toEqual(CHARGE_IDS.slice(0, 36));
    expect(POPULAR_CHARGE_IDS.slice(36)).toEqual(['cat', 'bear', 'horse', 'fox', 'raven', 'griffin', 'swan', 'phoenix', 'arrow', 'escallop', 'dolphin', 'tower']);
  });
});
