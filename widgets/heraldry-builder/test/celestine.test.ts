// Celestine, the non-standard cyan metal: rule of tincture in every layer, blazon and gloss,
// signature, tags, search synonyms, readability, difference text, picker options and hatching.

import { describe, it, expect } from 'vitest';
import {
  COLOURS, METALS, NON_STANDARD_NOTE, TINCTURES, TINCTURE_CLASS, TINCTURE_CODE, TINCTURE_FILL, TINCTURE_HATCHING,
  blazon, chargeTinctureChoices, contrastFailure, deriveTags, designTinctures, explainDifferences, filtersToTags, gloss,
  isNonStandard, normalise, ordinaryTinctureChoices, parseSearchParams, readability, resolve, searchEntries, signature,
  queryWords, type NormDesign, type Tincture,
} from '../src/lib/heraldry';
import { setDivision } from '../src/lib/builder';
import sample from '../src/data/sample-registry.json';
import { sampleSearchEntries, searchEntryOf } from './sample-search-entries';

const plain = (tincture: string) => ({ kind: 'plain', tincture });

function nd(input: unknown): NormDesign {
  const r = resolve(input);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.design;
}

const valid = (input: unknown) => normalise(input).ok;
const isColour = (t: Tincture) => TINCTURE_CLASS[t] === 'colour';

/** Whether `top` may lie on `under` (one contact) by the rule of tincture. */
const legalOn = (top: Tincture, under: Tincture) => top !== under && TINCTURE_CLASS[top] !== TINCTURE_CLASS[under];

describe('celestine is a non-standard metal', () => {
  it('is listed with the metals and is the only non-standard tincture', () => {
    expect(METALS).toEqual(['or', 'argent', 'celestine']);
    expect(TINCTURES).toHaveLength(8);
    expect(TINCTURE_CLASS.celestine).toBe('metal');
    expect(TINCTURES.filter(isNonStandard)).toEqual(['celestine']);
    expect(NON_STANDARD_NOTE.celestine).toMatch(/cyan treated as a metal/);
    expect(NON_STANDARD_NOTE.celestine).toMatch(/new tincture proposed for modern heraldry/);
  });

  it('has a fill no other tincture uses and a hatching pattern no other tincture uses', () => {
    expect(new Set(TINCTURES.map((t) => TINCTURE_FILL[t].toLowerCase())).size).toBe(TINCTURES.length);
    expect(new Set(TINCTURES.map((t) => TINCTURE_HATCHING[t])).size).toBe(TINCTURES.length);
    expect(TINCTURE_HATCHING.celestine).toBe('wavy');
  });
});

describe('rule of tincture with celestine', () => {
  it('contrast predicate: legal on every colour, metal on metal on Or and Argent, same on itself (both ways)', () => {
    for (const t of TINCTURES) {
      const expected = t === 'celestine' ? 'same' : isColour(t) ? null : 'metal-on-metal';
      expect(contrastFailure('celestine', [t]), `celestine on ${t}`).toBe(expected);
      expect(contrastFailure(t, ['celestine']), `${t} on celestine`).toBe(expected);
    }
  });

  it('as a charge on the field', () => {
    for (const field of TINCTURES) {
      const d = { v: 1, field: plain(field), charges: { charge: 'mullet', count: 1, placement: 'field', tincture: 'celestine' } };
      expect(valid(d), `celestine mullet on ${field}`).toBe(legalOn('celestine', field));
    }
  });

  it('as an ordinary on the field', () => {
    for (const field of TINCTURES) {
      const d = { v: 1, field: plain(field), ordinary: { type: 'fess', tincture: 'celestine' } };
      expect(valid(d), `celestine fess on ${field}`).toBe(legalOn('celestine', field));
    }
  });

  it('as the field under an ordinary and under a charge', () => {
    for (const top of TINCTURES) {
      expect(valid({ v: 1, field: plain('celestine'), ordinary: { type: 'bend', tincture: top } }), `${top} bend`).toBe(legalOn(top, 'celestine'));
      expect(valid({ v: 1, field: plain('celestine'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: top } }), `${top} lion`).toBe(legalOn(top, 'celestine'));
    }
  });

  it('as an ordinary carrying charges, and as charges on an ordinary', () => {
    for (const t of TINCTURES) {
      const onCelestine = { v: 1, field: plain('sable'), ordinary: { type: 'pale', tincture: 'celestine' }, charges: { charge: 'key', count: 1, placement: 'ordinary', tincture: t } };
      expect(valid(onCelestine), `${t} key on a celestine pale`).toBe(legalOn(t, 'celestine'));
      const celestineOn = { v: 1, field: plain('or'), ordinary: { type: 'pale', tincture: 'gules' }, charges: { charge: 'key', count: 1, placement: 'ordinary', tincture: 'celestine' } };
      expect(valid(celestineOn)).toBe(true);
    }
  });

  it('straddling a divided field: celestine counts as a metal on either side', () => {
    const straddling = (t1: string, t2: string, tincture: string) =>
      valid({ v: 1, field: { kind: 'divided', division: 'per-pale', tinctures: [t1, t2] }, charges: { charge: 'rose', count: 1, placement: 'field', tincture } });
    expect(straddling('celestine', 'argent', 'gules')).toBe(true);
    expect(straddling('celestine', 'or', 'argent')).toBe(false); // a two-metal field needs a colour charge
    expect(straddling('celestine', 'or', 'sable')).toBe(true);
    expect(straddling('azure', 'vert', 'celestine')).toBe(true);
    expect(straddling('argent', 'or', 'celestine')).toBe(false);
    expect(straddling('celestine', 'azure', 'celestine')).toBe(false); // touches its own tincture
  });

  it('picker options block metals on celestine and list celestine among the metals', () => {
    const d = nd({ v: 1, field: plain('celestine'), charges: { charge: 'lion', count: 1, placement: 'field', tincture: 'gules' } });
    const ch = chargeTinctureChoices(d);
    for (const c of ch) expect(c.allowed, c.value).toBe(isColour(c.value));
    expect(ch.find((c) => c.value === 'or')!.reason)
      .toBe('Or on Celestine would be metal on metal. Metals must sit on colours (Gules, Azure, Vert, Sable or Purpure).');
    const onGules = ordinaryTinctureChoices(nd({ v: 1, field: plain('gules') }), 'chevron');
    expect(onGules.find((c) => c.value === 'celestine')!.allowed).toBe(true);
    expect(onGules.find((c) => c.value === 'vert')!.reason).toMatch(/\(Or, Argent or Celestine\)\.$/);
  });

  it('a new division of a celestine field picks a colour for its other half', () => {
    const d = setDivision(nd({ v: 1, field: plain('celestine') }), 'per-pale');
    expect(d.field).toEqual({ kind: 'divided', division: 'per-pale', tinctures: ['celestine', 'gules'] });
  });
});

describe('celestine in words, signature and tags', () => {
  const field = nd({ v: 1, field: plain('celestine'), charges: { charge: 'crescent', count: 1, placement: 'field', tincture: 'gules' } });
  const fess = nd({ v: 1, field: plain('gules'), ordinary: { type: 'fess', tincture: 'celestine' } });
  const charges = nd({ v: 1, field: plain('sable'), charges: { charge: 'mullet', count: 3, placement: 'field', tincture: 'celestine' } });

  it('blazons as Celestine, capitalised like the others', () => {
    expect(blazon(field)).toBe('Celestine, a crescent Gules');
    expect(blazon(fess)).toBe('Gules, a fess Celestine');
    expect(blazon(charges)).toBe('Sable, three mullets Celestine');
    expect(blazon(nd({ v: 1, field: { kind: 'divided', division: 'per-fess', tinctures: ['celestine', 'azure'] } })))
      .toBe('Per fess Celestine and Azure');
  });

  it('glosses as sky blue (celestine)', () => {
    expect(gloss(field)).toBe('A sky blue (celestine) shield with a red crescent moon.');
    expect(gloss(fess)).toBe('A red shield with a sky blue (celestine) horizontal band across the middle.');
    expect(gloss(charges)).toBe('A black shield with three sky blue (celestine) five-pointed stars, two above one.');
  });

  it('has its own signature code, distinct from every other tincture code and separator-free', () => {
    expect(TINCTURE_CODE.celestine).toBe('ce');
    const codes = TINCTURES.map((t) => TINCTURE_CODE[t]);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z]+$/);
    expect(signature(field)).toBe('v1|F:plain:ce|O:-|C:crescent:1:field:single:-:gu');
    // Swapping celestine for any other tincture always changes the signature.
    for (const t of TINCTURES.filter((x) => x !== 'celestine')) {
      expect(signature({ ...field, field: { kind: 'plain', tincture: t } })).not.toBe(signature(field));
    }
  });

  it('derives celestine tags and accepts celestine filters', () => {
    expect(deriveTags(field)).toEqual(expect.arrayContaining(['field-tincture:celestine', 'tincture:celestine']));
    expect(deriveTags(fess)).toContain('ordinary-tincture:celestine');
    expect(deriveTags(charges)).toContain('charge-tincture:celestine');
    expect(filtersToTags({ tincture: 'celestine', chargeTincture: 'celestine' }))
      .toEqual({ ok: true, tags: ['tincture:celestine', 'charge-tincture:celestine'] });
  });

  it('counts as a tincture for readability', () => {
    expect(designTinctures(fess)).toEqual(['gules', 'celestine']);
    expect(readability(field).band).toBe('bold');
  });

  it('names celestine in difference text', () => {
    const argent = nd({ v: 1, field: plain('argent'), charges: { charge: 'crescent', count: 1, placement: 'field', tincture: 'gules' } });
    expect(explainDifferences(field, argent).map((n) => n.text)).toEqual(['field tincture (Celestine ↔ Argent)']);
  });
});

describe('search synonyms for celestine', () => {
  it('reads the everyday words as the celestine tincture, whole words only', () => {
    for (const q of ['cyan', 'Sky Blue', 'light blue', 'TURQUOISE']) expect(queryWords(q).flat(), q).toContain('celestine');
    expect(queryWords('cyanotype').flat()).not.toContain('celestine');
    expect(queryWords('blue').flat()).not.toContain('celestine');
  });

  const find = (q: string, extra: (typeof sampleSearchEntries)[number][] = []) => {
    const parsed = parseSearchParams({ q });
    if (!parsed.ok) throw new Error(parsed.message);
    return searchEntries([...sampleSearchEntries, ...extra], parsed.query).items.map((i) => i.id);
  };

  it('finds celestine arms by cyan, sky blue, light blue or turquoise', () => {
    for (const q of ['cyan', 'sky blue', 'Light Blue', 'turquoise', 'celestine']) expect(find(q), q).toEqual(['demo-017']);
  });

  it('still matches the words literally in display names', () => {
    const named = searchEntryOf({ ...sample.entries[0], id: 'x-cyan', displayName: 'Cyan Okoro', registeredAt: '2026-02-01T00:00:00Z' });
    expect(find('cyan', [named])).toEqual(['x-cyan', 'demo-017']);
  });

  it('every sample entry is a valid design, including the celestine one', () => {
    const celestine = sample.entries.filter((e) => deriveTags(nd(e.design)).includes('tincture:celestine'));
    expect(celestine.map((e) => e.id)).toEqual(['demo-017']);
    expect(normalise(celestine[0].design).ok).toBe(true);
  });
});

describe('colour classes stay exhaustive', () => {
  it('every tincture is exactly one of metal or colour', () => {
    expect([...METALS, ...COLOURS].sort()).toEqual([...TINCTURES].sort());
  });
});
