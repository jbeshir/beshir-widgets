// Celestine, the non-standard cyan metal: rule of tincture in every layer, blazon and gloss,
// signature, tags, search synonyms, readability, difference text, picker options and hatching.

import { describe, it, expect } from 'vitest';
import {
  COLOURS, METALS, NON_STANDARD_TINCTURES, TINCTURES, TINCTURE_CLASS, TINCTURE_CODE, TINCTURE_FILL, TINCTURE_HATCHING,
  blazon, contrastFailure, deriveTags, designTinctures, explainDifferences, fieldTinctures, filtersToTags, gloss, groupTinctureChoices,
  normalise, parseSearchParams, queryWords, readability, searchEntries, signature, type Design, type Tincture,
} from '../src/lib/heraldry/next';
import { setDivision } from '../src/lib/next/builder';
import sample from '../src/data/sample-registry.json';
import { sampleSearchEntries, searchEntryOf } from './next-sample-search-entries';
import { arms, charge, div, filters, group, nd, ordinary, searchParams } from './next-helpers';

const valid = (input: unknown) => normalise(input).ok;
const isColour = (t: Tincture) => TINCTURE_CLASS[t] === 'colour';

/** Whether `top` may lie on `under` (one contact) by the rule of tincture. */
const legalOn = (top: Tincture, under: Tincture) => top !== under && TINCTURE_CLASS[top] !== TINCTURE_CLASS[under];

const chg = (id: string, paint: string, extra: object = {}) => group(charge(id), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);

describe('celestine is a non-standard metal', () => {
  it('is listed with the metals and is the only non-standard tincture', () => {
    expect(METALS).toEqual(['or', 'argent', 'celestine']);
    expect(TINCTURES).toHaveLength(8);
    expect(TINCTURE_CLASS.celestine).toBe('metal');
    expect(TINCTURES.filter((t) => NON_STANDARD_TINCTURES.has(t))).toEqual(['celestine']);
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
    for (const field of TINCTURES) expect(valid(arms(field, chg('mullet', 'celestine'))), `celestine mullet on ${field}`).toBe(legalOn('celestine', field));
  });

  it('as an ordinary on the field', () => {
    for (const field of TINCTURES) expect(valid(arms(field, ord('fess', 'celestine'))), `celestine fess on ${field}`).toBe(legalOn('celestine', field));
  });

  it('as the field under an ordinary and under a charge', () => {
    for (const top of TINCTURES) {
      expect(valid(arms('celestine', ord('bend', top))), `${top} bend`).toBe(legalOn(top, 'celestine'));
      expect(valid(arms('celestine', chg('lion', top))), `${top} lion`).toBe(legalOn(top, 'celestine'));
    }
  });

  it('as an ordinary carrying charges, and as charges on an ordinary', () => {
    for (const t of TINCTURES) {
      expect(valid(arms('sable', ord('pale', 'celestine', { charged: [chg('key', t)] }))), `${t} key on a celestine pale`).toBe(legalOn(t, 'celestine'));
    }
    expect(valid(arms('or', ord('pale', 'gules', { charged: [chg('key', 'celestine')] })))).toBe(true);
  });

  it('straddling a divided field: celestine counts as a metal on either side', () => {
    const straddling = (t1: string, t2: string, paint: string) => valid(arms(div('per-pale', t1, t2), chg('rose', paint)));
    expect(straddling('celestine', 'argent', 'gules')).toBe(true);
    expect(straddling('celestine', 'or', 'argent')).toBe(false); // a two-metal field needs a colour charge
    expect(straddling('celestine', 'or', 'sable')).toBe(true);
    expect(straddling('azure', 'vert', 'celestine')).toBe(true);
    expect(straddling('argent', 'or', 'celestine')).toBe(false);
    expect(straddling('celestine', 'azure', 'celestine')).toBe(false); // touches its own tincture
  });

  it('picker options block metals on celestine and list celestine among the metals', () => {
    const d = nd(arms('celestine', chg('lion', 'gules')));
    const ch = groupTinctureChoices(d, [0]).filter((c) => c.value !== 'counterchanged');
    for (const c of ch) expect(c.allowed, c.value).toBe(isColour(c.value as Tincture));
    const or = ch.find((c) => c.value === 'or')!;
    expect(or.allowed ? '' : or.reason).toMatch(/metal/i);
    const onGules = groupTinctureChoices(nd(arms('gules', ord('chevron', 'or'))), [0]);
    expect(onGules.find((c) => c.value === 'celestine')!.allowed).toBe(true);
    const vert = onGules.find((c) => c.value === 'vert')!;
    expect(vert.allowed).toBe(false);
  });

  it('a new division of a celestine field picks a colour for its other half', () => {
    const d = setDivision(nd(arms('celestine')), 'per-pale');
    expect(fieldTinctures(d)).toEqual(['celestine', 'gules']);
  });
});

describe('celestine in words, signature and tags', () => {
  const field = nd(arms('celestine', chg('crescent', 'gules')));
  const fess = nd(arms('gules', ord('fess', 'celestine')));
  const charges = nd(arms('sable', chg('mullet', 'celestine', { count: 3 })));

  it('blazons as celestine, lower case like the other tinctures', () => {
    expect(blazon(field)).toBe('Celestine, a crescent gules.');
    expect(blazon(fess)).toBe('Gules, a fess celestine.');
    expect(blazon(charges)).toBe('Sable, three mullets celestine.');
    expect(blazon(nd(arms(div('per-fess', 'celestine', 'azure'))))).toBe('Per fess celestine and azure.');
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
    expect(signature(field)).toBe('arms|ce|P:c.crescent:1:single:gu');
    // Swapping celestine for any other tincture always changes the signature.
    for (const t of TINCTURES.filter((x) => x !== 'celestine')) {
      expect(signature({ ...field, field: { k: 'tincture', t } } as Design)).not.toBe(signature(field));
    }
  });

  it('derives celestine tags and accepts celestine filters', () => {
    expect(deriveTags(field)).toEqual(expect.arrayContaining(['field-tincture:celestine', 'tincture:celestine']));
    expect(deriveTags(fess)).toContain('ordinary-tincture:celestine');
    expect(deriveTags(charges)).toContain('charge-tincture:celestine');
    expect(filtersToTags(filters({ tincture: 'celestine', chargeTincture: 'celestine' })))
      .toEqual({ ok: true, tags: ['tincture:celestine', 'charge-tincture:celestine'] });
  });

  it('counts as a tincture for readability', () => {
    expect(designTinctures(fess)).toEqual(['gules', 'celestine']);
    expect(readability(field).band).toBe('bold');
  });

  it('names celestine in difference text', () => {
    const argent = nd(arms('argent', chg('crescent', 'gules')));
    expect(explainDifferences(field, argent).map((n) => n.text)).toEqual(['background colour (Celestine ↔ Argent)']);
  });
});

describe('search synonyms for celestine', () => {
  it('reads the everyday words as the celestine tincture, whole words only', () => {
    for (const q of ['cyan', 'Sky Blue', 'light blue', 'TURQUOISE']) expect(queryWords(q).flat(), q).toContain('celestine');
    expect(queryWords('cyanotype').flat()).not.toContain('celestine');
    expect(queryWords('blue').flat()).not.toContain('celestine');
  });

  const find = (q: string, extra: (typeof sampleSearchEntries)[number][] = []) => {
    const parsed = parseSearchParams(searchParams({ q }));
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
