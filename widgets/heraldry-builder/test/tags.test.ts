// Search tags derived from a design, and the public filters that map onto them.

import { describe, expect, it } from 'vitest';
import { NO_FILTERS, deriveTags, filtersToTags, matchesTags, type Design } from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const tags = (...input: Parameters<typeof arms>): string[] => deriveTags(nd(arms(...input)));

describe('deriveTags', () => {
  it('tags the field: plain or the division, and each field tincture', () => {
    expect(tags('azure', chg('lion', 'or'))).toEqual(expect.arrayContaining(['field:plain', 'field-tincture:azure']));
    const divided = tags(div('per-bend', 'argent', 'sable'), chg('rose', 'gules'));
    expect(divided).toEqual(expect.arrayContaining(['division:per-bend', 'field-tincture:argent', 'field-tincture:sable']));
    expect(divided).not.toContain('field:plain');
  });

  it('tags an ordinary and its tincture', () => {
    expect(tags('azure', ord('bend', 'or'))).toEqual(expect.arrayContaining(['ordinary:bend', 'ordinary-tincture:or']));
  });

  it('tags a charge: id, category, tincture, count, posture and layout', () => {
    expect(tags('gules', chg('wolf', 'argent', { count: 2 }))).toEqual(expect.arrayContaining([
      'charge:wolf', 'charge-category:beast', 'charge-tincture:argent', 'charge-count:2', 'posture:passant', 'layout:in-pale',
    ]));
    expect(tags('gules', chg('rose', 'argent', { count: 5 }))).toEqual(expect.arrayContaining(['layout:rows-2-2-1']));
    expect(tags('gules', chg('rose', 'argent', { count: 3, arrangement: 'in-chief' }))).toContain('layout:in-chief');
    expect(tags('gules', chg('rose', 'argent'))).toContain('layout:single');
    expect(tags('gules', chg('rose', 'argent'))).not.toEqual(expect.arrayContaining([expect.stringMatching(/^posture:/)]));
  });

  it('drops the posture group and the arrangement tag of the old vocabulary', () => {
    const all = tags('gules', chg('lion', 'argent'));
    expect(all.some((t) => t.startsWith('posture-group:') || t.startsWith('arrangement:'))).toBe(false);
  });

  it('tags where the pictures are: between a band, on a band, on a top bar', () => {
    expect(tags('vert', ord('chevron', 'or'), chg('rose', 'argent', { count: 3 }))).toContain('placement:between');
    expect(tags('or', ord('pale', 'sable', { charged: [chg('flame', 'or', { count: 3 })] }))).toContain('placement:on-ordinary');
    const chief = tags('gules', chg('mullet', 'argent', { count: 3 }), ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }));
    expect(chief).toContain('placement:on-chief');
    expect(chief).not.toContain('placement:on-ordinary');
    expect(tags('gules', ord('bordure', 'or', { charged: [chg('rose', 'gules', { count: 8 })] }))).toContain('placement:on-bordure');
    expect(tags('gules', chg('lion', 'or'), chg('mullet', 'argent', { count: 3, position: 'chief' }))).toContain('placement:in-chief');
    expect(tags('gules', ord('fess', 'or'), chg('mullet', 'argent', { position: 'canton' }))).toContain('placement:in-canton');
    expect(tags('gules', chg('mullet', 'argent', { count: 3 }))).not.toEqual(expect.arrayContaining([expect.stringMatching(/^placement:/)]));
  });

  it('tags every tincture of the design once, and counterchanged adds none', () => {
    const all = tags('azure', ord('fess', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }));
    expect(all.filter((t) => t.startsWith('tincture:'))).toEqual(['tincture:azure', 'tincture:or', 'tincture:gules']);
    const cc = tags(div('per-pale', 'or', 'azure'), chg('mullet', 'counterchanged', { count: 3 }));
    expect(cc.filter((t) => t.startsWith('tincture:'))).toEqual(['tincture:or', 'tincture:azure']);
    expect(cc).toContain('charge-tincture:counterchanged');
    expect(tags(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged'))).toContain('ordinary-tincture:counterchanged');
  });

  it('carries the tags of both charges of a design with a tertiary and a secondary group', () => {
    const all = tags('azure', ord('fess', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }), chg('mullet', 'or', { count: 3 }));
    expect(all).toEqual(expect.arrayContaining(['charge:rose', 'charge:mullet', 'charge-tincture:gules', 'charge-tincture:or', 'charge-count:3']));
  });

  it('ends with the readability band and has no duplicates', () => {
    const all = tags('azure', chg('lion', 'or'));
    expect(all[all.length - 1]).toBe('readability:bold');
    expect(new Set(all).size).toBe(all.length);
  });

  it('is the same for a design and its canonical form', () => {
    const d: Design = nd(arms('azure', chg('rose', 'or', { count: 3 }), ord('fess', 'argent')));
    expect(deriveTags(d)).toEqual(deriveTags(nd(JSON.parse(JSON.stringify(d)))));
  });
});

describe('filtersToTags', () => {
  it('maps each filter to its tag and ignores blanks', () => {
    expect(filtersToTags(NO_FILTERS)).toEqual({ ok: true, tags: [] });
    expect(filtersToTags({
      tincture: 'or', fieldTincture: 'azure', chargeTincture: 'counterchanged', charge: 'wolf', category: 'beast', posture: 'courant',
      ordinary: 'chief', division: 'per-fess',
    })).toEqual({
      ok: true,
      tags: ['tincture:or', 'field-tincture:azure', 'charge-tincture:counterchanged', 'charge:wolf', 'charge-category:beast', 'posture:courant', 'ordinary:chief', 'division:per-fess'],
    });
    expect(filtersToTags({ ...NO_FILTERS, division: 'plain' })).toEqual({ ok: true, tags: ['field:plain'] });
  });

  it('accepts every posture and rejects what is not in a vocabulary, naming the parameter', () => {
    expect(filtersToTags({ ...NO_FILTERS, posture: 'trippant' })).toEqual({ ok: false, param: 'posture', message: 'Unknown posture "trippant".' });
    expect(filtersToTags({ ...NO_FILTERS, tincture: 'counterchanged' }).ok).toBe(false);
    expect(filtersToTags({ ...NO_FILTERS, category: 'fish' })).toMatchObject({ ok: false, param: 'category' });
    expect(filtersToTags({ ...NO_FILTERS, division: 'barry' })).toMatchObject({ ok: false, param: 'division' });
  });
});

describe('matchesTags', () => {
  it('needs every required tag', () => {
    const d = nd(arms('azure', chg('lion', 'or')));
    expect(matchesTags(d, [])).toBe(true);
    expect(matchesTags(d, ['charge:lion', 'tincture:or'])).toBe(true);
    expect(matchesTags(d, ['charge:lion', 'tincture:vert'])).toBe(false);
  });
});
