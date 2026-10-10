// Plain-words-first wording for charges and ordinaries, the shared wording helpers, and the
// jargon-free readability breakdown.
import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, ORDINARY_TYPES, chargeLabel, chargeWords, normalise, ordinaryWords, readability, type NormDesign,
} from '../src/lib/heraldry';
import { capitalise, joinAnd, joinList } from '../src/lib/heraldry/words';
import { FILTER_SPECS } from '../src/components/registry/filters';
import { div, plain } from './helpers';

describe('charge labels', () => {
  it('lead with the everyday word and give the heraldic term second', () => {
    expect(chargeLabel('mullet')).toBe('Star · mullet');
    expect(chargeLabel('crescent')).toBe('Moon · crescent');
    expect(chargeLabel('fleur-de-lis')).toBe('Lily · fleur-de-lis');
  });

  it('leave a name that is already an everyday word alone', () => {
    expect(chargeLabel('lion')).toBe('Lion');
    expect(chargeLabel('open-book')).toBe('Open book');
    for (const id of CHARGE_IDS) expect(chargeLabel(id), id).toMatch(new RegExp(`${CHARGES[id].name}$`, 'i'));
  });

  it('are what the Picture filter offers, grouped by kind of picture', () => {
    const picture = FILTER_SPECS.find((s) => s.key === 'charge')!;
    expect(picture.options.find((o) => o.value === 'mullet')).toMatchObject({ label: 'Star · mullet' });
    expect(picture.options.find((o) => o.value === 'lion')).toMatchObject({ label: 'Lion' });
  });
});

describe('charge and ordinary words in a sentence', () => {
  it('put the plain word first and the heraldic term in brackets', () => {
    expect(chargeWords('mullet', 1)).toBe('star (mullet)');
    expect(chargeWords('mullet', 3)).toBe('stars (mullets)');
    expect(chargeWords('fleur-de-lis', 2)).toBe('lilies (fleurs-de-lis)');
    expect(chargeWords('lion', 1)).toBe('lion');
    expect(chargeWords('wolf', 2)).toBe('wolves');
    expect(ordinaryWords('fess')).toBe('horizontal band (fess)');
    expect(ordinaryWords('bordure')).toBe('border (bordure)');
    expect(ordinaryWords('cross')).toBe('cross');
    for (const type of ORDINARY_TYPES) expect(ordinaryWords(type), type).toMatch(/\S/);
  });
});

describe('wording helpers', () => {
  it('capitalise the first letter only', () => {
    expect(capitalise('gold on white')).toBe('Gold on white');
    expect(capitalise('')).toBe('');
  });

  it('join a list with commas and "and"', () => {
    expect(joinAnd([])).toBe('');
    expect(joinAnd(['lions'])).toBe('lions');
    expect(joinAnd(['lions', 'wolves'])).toBe('lions and wolves');
    expect(joinAnd(['lions', 'wolves', 'boars'])).toBe('lions, wolves and boars');
  });

  it('join a list with "or"', () => {
    expect(joinList(['lions'], 'or')).toBe('lions');
    expect(joinList(['lions', 'wolves', 'boars'], 'or')).toBe('lions, wolves or boars');
  });
});

describe('readability wording', () => {
  const arms = (field: unknown, ordinary: unknown, charges: unknown): NormDesign => {
    const r = normalise({ v: 1, field, ordinary, charges });
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
    return r.design;
  };

  it('names the factors without heraldic jargon', () => {
    const d = arms(plain('azure'), { type: 'fess', tincture: 'or' }, { charge: 'mullet', count: 3, placement: 'ordinary', tincture: 'gules' });
    const labels = readability(d).breakdown.map((b) => b.label).join(' | ');
    expect(labels).not.toMatch(/tincture|ordinary|charge|field/i);
    expect(labels).toMatch(/Pictures on the band/);
    expect(labels).toMatch(/colours/);
    expect(labels).toMatch(/Band or shape/);
  });

  it('names a charge plain word first in the nudge', () => {
    const crowded = arms(div('per-pale', 'gules', 'azure'), null, { charge: 'mullet', count: 6, placement: 'field', tincture: 'or' });
    expect(readability(crowded).nudge).toBe('Try three stars (mullets) instead of six');
  });
});
