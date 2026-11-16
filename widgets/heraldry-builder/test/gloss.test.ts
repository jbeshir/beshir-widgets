// Plain-English gloss: left/right as you look at the shield. Each construct gets a sentence of its own.

import { describe, expect, it } from 'vitest';
import { CHARGE_IDS, betweenWords, gloss } from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import { generatedDesigns, generatedRichDesigns } from './design-generator';
import { V } from './validation-cases';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const say = (...input: Parameters<typeof arms>) => gloss(nd(arms(...input)));

describe('validation rows', () => {
  for (const c of V.filter((x) => x.gloss)) it(`${c.id}: ${c.gloss}`, () => expect(gloss(nd(c.design))).toBe(c.gloss));
});

describe('new constructs', () => {
  it('words the layouts', () => {
    expect(say('vert', chg('rose', 'argent', { count: 5 }))).toBe('A green shield with five white roses, in rows of two, two and one.');
    expect(say('vert', chg('rose', 'argent', { count: 3, arrangement: 'rows-1-2' }))).toBe('A green shield with three white roses, one above two.');
    expect(say('vert', chg('rose', 'argent', { count: 8, arrangement: 'in-orle' }))).toBe('A green shield with eight white roses, in a ring around the edge.');
    expect(say('vert', chg('rose', 'argent', { count: 6, arrangement: 'in-annulo' }))).toBe('A green shield with six white roses, in a ring.');
    expect(say('sable', chg('sword', 'or', { count: 2, arrangement: 'crossed' }))).toBe('A black shield with two gold swords, crossed like an X.');
    expect(say('vert', chg('rose', 'argent', { count: 3, arrangement: 'in-chief' }))).toBe('A green shield with three white roses, in a row along the top.');
    expect(say('vert', chg('rose', 'argent', { count: 1, arrangement: 'in-base' }))).toBe('A green shield with a white rose, near the bottom.');
    expect(say('vert', chg('rose', 'argent', { count: 4, arrangement: 'rows-2-2' }))).toBe('A green shield with four white roses, in two rows of two.');
    expect(say('vert', chg('rose', 'argent', { count: 9, arrangement: 'rows-3-3-3' }))).toBe('A green shield with nine white roses, in rows of three, three and three.');
  });

  it('words the hare, the cogwheel and the sun with a face', () => {
    expect(say('argent', chg('hare', 'sable', {}, { posture: 'courant' }))).toBe('A white shield with a black hare running.');
    expect(say('gules', chg('gear', 'or'))).toBe('A red shield with a gold gear.');
    expect(say('azure', chg('sun', 'or', {}, { mods: [{ id: 'in-splendour' }] }))).toBe('A blue shield with a gold sun with a face.');
    expect(say('azure', chg('sun', 'or', { count: 2 }, { mods: [{ id: 'in-splendour' }] }))).toBe('A blue shield with two gold suns with faces, in a vertical line.');
  });

  it('words a group on a chief and one on a band with something between', () => {
    expect(say('gules', chg('mullet', 'argent', { count: 3 }), ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 3 })] })))
      .toBe('A red shield with three white five-pointed stars, two above one, and a gold band across the top carrying three red roses.');
    expect(say('azure', ord('fess', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }), chg('mullet', 'or', { count: 3 })))
      .toBe('A blue shield with a gold horizontal band across the middle, carrying three red roses, and three gold five-pointed stars, two above and one below.');
    expect(say('gules', ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 2 })] })))
      .toBe('A red shield with a gold band across the top carrying two red roses.');
  });

  it('words charges set around the primary charges and how they stand', () => {
    expect(say('azure', chg('lion', 'or'), chg('rose', 'argent', { count: 3, relation: 'between' })))
      .toBe('A blue shield with a gold lion rearing up between three white roses, two above and one below.');
    expect(say('sable', chg('sword', 'or', { count: 2, arrangement: 'crossed' }), chg('mullet', 'argent', { count: 4, relation: 'between', arrangement: 'in-cross' })))
      .toBe('A black shield with two gold swords, crossed like an X, between four white five-pointed stars, one above, one below and one on each side.');
    expect(say('vert', chg('tree', 'or'), chg('crescent', 'or', { count: 2, relation: 'between', arrangement: 'in-pale' }), ord('bordure', 'argent')))
      .toBe('A green shield with a gold tree between two gold crescent moons, one above and one below, and a white border around the edge.');
  });

  it('words charges in chief, in base or in canton beside the primary', () => {
    expect(say('purpure', chg('bee', 'or'), chg('mullet', 'argent', { count: 3, position: 'chief' })))
      .toBe('A purple shield with a gold bee and three white five-pointed stars, in a row along the top.');
    expect(say('argent', ord('chevron', 'sable'), chg('crescent', 'sable', { position: 'base' })))
      .toBe('A white shield with a black upside-down V and a black crescent moon, near the bottom.');
    expect(say('sable', chg('dragon', 'argent'), chg('crescent', 'argent', { position: 'canton' }), ord('bordure', 'argent')))
      .toBe('A black shield with a white dragon rearing up and a white crescent moon, in the top-left corner, and a white border around the edge.');
  });

  it('words a chief and a bordure beside a band', () => {
    expect(say('gules', ord('fess', 'argent'), ord('chief', 'azure'))).toBe('A red shield with a white horizontal band across the middle and a blue band across the top.');
  });

  it('words a band with a counterchanged colour', () => {
    expect(say(div('per-pale', 'argent', 'gules'), ord('fess', 'counterchanged')))
      .toBe('A shield split vertically, white on the left and red on the right, with a horizontal band across the middle in the opposite colours of the field (red on white, white on red).');
  });
});

describe('between', () => {
  it('spreads the charges as the layout does', () => {
    expect(betweenWords('fess', 2)).toBe('one above and one below');
    expect(betweenWords('fess', 4)).toBe('two above and two below');
    expect(betweenWords('fess', 6)).toBe('three above and three below');
    expect(betweenWords('pale', 4)).toBe('two on each side');
    expect(betweenWords('bend-sinister', 6)).toBe('three on each side');
    expect(betweenWords('chevron', 3)).toBe('two above and one below');
    expect(betweenWords('cross', 4)).toBe('one in each quarter');
    expect(betweenWords('saltire', 4)).toBe('one above, one below and one on each side');
    expect(betweenWords('pile', 2)).toBe('one on each side');
    expect(betweenWords('pile', 3)).toBeNull();
    expect(betweenWords('fess', 5)).toBeNull();
  });

  it('reads one on each side as a single charge', () => {
    expect(say('vert', ord('pale', 'argent'), chg('rose', 'or', { count: 2 }))).toBe('A green shield with a white vertical band down the middle and a gold rose on each side.');
    expect(say('vert', ord('pale', 'argent'), chg('rose', 'or', { count: 4 }))).toBe('A green shield with a white vertical band down the middle and four gold roses, two on each side.');
    expect(say('vert', ord('cross', 'argent'), chg('rose', 'or', { count: 4 }))).toBe('A green shield with a white cross and a gold rose in each quarter.');
  });

  it('glosses a count the ordinary does not take (a structure error) plainly', () => {
    expect(say('vert', ord('fess', 'argent'), chg('rose', 'or', { count: 5 }))).toBe('A green shield with a white horizontal band across the middle and five gold roses.');
  });
});

describe('every charge', () => {
  it('has a gloss name in singular and plural', () => {
    for (const id of CHARGE_IDS) {
      expect(say('azure', chg(id, 'or')), id).toMatch(/^An? blue shield with an? gold /);
      expect(say('azure', chg(id, 'or', { count: 3 })), id).toMatch(/with three gold /);
    }
  });

  it('never throws on, and always ends a sentence for, generated designs', () => {
    for (const d of [...generatedDesigns(9, 200), ...generatedRichDesigns(9, 200)]) expect(gloss(d)).toMatch(/\.$/);
  });
});
