// Plain-words-first wording for charges, ordinaries, layouts and groups, the shared wording helpers.

import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, CHARGES, DIVISIONS, DIVISION_LABEL, DIVISION_NAME, ORDINARY_LABEL, ORDINARY_NAME, TINCTURE_NAME, ORDINARY_TYPES, POSTURES, TINCTURE_LABEL, TINCTURES,
  chargeLabel, chargeWords, groupLabel, layoutKey, layoutLabel, layoutCandidates, ordinaryWords, postureLabel, ROW_PATTERNS,
} from '../src/lib/heraldry';
import { capitalise, joinAnd, joinList } from '../src/lib/heraldry/words';
import { arms, charge, div, group, nd, ordinary } from './helpers';

describe('charge labels', () => {
  it('lead with the everyday word and give the heraldic term second', () => {
    expect(chargeLabel('mullet')).toBe('Star · mullet');
    expect(chargeLabel('crescent')).toBe('Moon · crescent');
    expect(chargeLabel('fleur-de-lis')).toBe('Lily · fleur-de-lys');
  });

  it('leave a name that is already an everyday word alone', () => {
    expect(chargeLabel('lion')).toBe('Lion');
    expect(chargeLabel('open-book')).toBe('Open book');
    expect(chargeLabel('gear')).toBe('Cogwheel');
    for (const id of CHARGE_IDS) expect(chargeLabel(id), id).toMatch(new RegExp(`${CHARGES[id].name}$`, 'i'));
  });
});

describe('charge and ordinary words in a sentence', () => {
  it('put the plain word first and the heraldic term in brackets', () => {
    expect(chargeWords('mullet', 1)).toBe('star (mullet)');
    expect(chargeWords('mullet', 3)).toBe('stars (mullets)');
    expect(chargeWords('fleur-de-lis', 2)).toBe('lilies (fleurs-de-lys)');
    expect(chargeWords('lion', 1)).toBe('lion');
    expect(chargeWords('wolf', 2)).toBe('wolves');
    expect(ordinaryWords('fess')).toBe('horizontal band (fess)');
    expect(ordinaryWords('bordure')).toBe('border (bordure)');
    expect(ordinaryWords('cross')).toBe('cross');
  });

  it('cover every division, ordinary and tincture', () => {
    for (const type of ORDINARY_TYPES) expect(ordinaryWords(type), type).toMatch(/\S/);
    for (const type of ORDINARY_TYPES) expect(ORDINARY_LABEL[type].term, type).toMatch(/\S/);
    for (const division of DIVISIONS) expect(DIVISION_LABEL[division].plain, division).toMatch(/\S/);
    for (const t of [...TINCTURES, 'counterchanged' as const]) expect(TINCTURE_LABEL[t].term, t).toMatch(/\S/);
    expect(TINCTURE_LABEL.counterchanged.plain).toBe('Swapped colours');
    // The terms are the model's own names, not a second copy.
    for (const type of ORDINARY_TYPES) expect(ORDINARY_LABEL[type].term, type).toBe(ORDINARY_NAME[type]);
    for (const division of DIVISIONS) expect(DIVISION_LABEL[division].term, division).toBe(DIVISION_NAME[division]);
    for (const t of TINCTURES) expect(TINCTURE_LABEL[t].term, t).toBe(TINCTURE_NAME[t]);
  });
});

describe('postures', () => {
  it('lead with the plain word and give the charge’s own term in brackets', () => {
    expect(postureLabel('lion', 'rampant')).toBe('Rearing up (rampant)');
    expect(postureLabel('stag', 'passant')).toBe('Walking (trippant)');
    expect(postureLabel('hare', 'courant')).toBe('Running (courant)');
    expect(postureLabel('dragon', 'rampant')).toBe('Rearing up (segreant)');
    expect(postureLabel('eagle', 'displayed')).toBe('Wings spread (displayed)');
    expect(postureLabel('lion', 'rampant', 'default')).toBe('Rearing up (rampant, default)');
  });

  it('label every drawn posture of every charge', () => {
    for (const id of CHARGE_IDS) for (const p of CHARGES[id].postures ?? []) expect(postureLabel(id, p), `${id} ${p}`).toMatch(/\(.+\)$/);
    expect(POSTURES).toContain('courant');
  });
});

describe('layout labels', () => {
  it('label the fixed layouts, the rows by their numbers and every key the layouts can make', () => {
    expect(layoutLabel('in-chief')).toEqual({ plain: 'Along the top', term: 'in chief' });
    expect(layoutLabel('in-base')).toEqual({ plain: 'Along the bottom', term: 'in base' });
    expect(layoutLabel('in-orle')).toEqual({ plain: 'Around the edge', term: 'in orle' });
    expect(layoutLabel('in-annulo')).toEqual({ plain: 'In a ring', term: 'in annulo' });
    expect(layoutLabel('crossed')).toEqual({ plain: 'Crossed like an X', term: 'in saltire' });
    expect(layoutLabel('rows-2-1')).toEqual({ plain: 'Two above, one below', term: 'two and one' });
    expect(layoutLabel('rows-3-2-1')).toEqual({ plain: 'Three, two, one', term: 'three, two and one' });
    expect(layoutLabel('rows-2-2-1')).toEqual({ plain: 'Rows of 2, 2 and 1', term: 'two, two and one' });
    expect(layoutLabel('in-pale').plain).toBe('Stacked up and down');
    expect(() => layoutLabel('in-mystery')).toThrow(RangeError);
    const d = nd(arms('azure', group(charge('rose'), 'or')));
    for (let n = 1; n <= 12; n++) for (const l of layoutCandidates(d, [0], n)) expect(layoutLabel(layoutKey(l)).plain, `${n} ${layoutKey(l)}`).toMatch(/\S/);
    for (const rows of ROW_PATTERNS) expect(layoutLabel(`rows-${rows.join('-')}`).term).toMatch(/\S/);
  });
});

describe('group labels', () => {
  it('name each group by its place', () => {
    const d = nd(arms('azure',
      group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }),
      group(charge('mullet'), 'or', { count: 3 })));
    expect(d.groups.map((_, i) => groupLabel(d, [i]))).toEqual(['Band or shape', 'Picture']);
    expect(groupLabel(d, [0, 0])).toBe('Pictures on the band');
    const chief = nd(arms('gules', group(charge('mullet'), 'argent', { count: 3 }), group(ordinary('chief'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] })));
    expect(chief.groups.map((_, i) => groupLabel(chief, [i]))).toEqual(['Picture', 'Top bar']);
    expect(groupLabel(chief, [1, 0])).toBe('Pictures on the top bar');
    const border = nd(arms('sable', group(charge('wolf'), 'or'), group(ordinary('bordure'), 'argent')));
    expect(groupLabel(border, [1])).toBe('Border');
    expect(groupLabel(nd(arms(div('per-pale', 'azure', 'or'), group(charge('lion'), 'gules'))), [0])).toBe('Picture');
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
