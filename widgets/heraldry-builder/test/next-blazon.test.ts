// The blazon emitter: SCA house style (RULES §F). The worked examples of the plan are the contract; the rest
// pins the factoring of tinctures, every layout word, which postures and layouts are left out, and spelling.

import { describe, expect, it } from 'vitest';
import { CHARGES, CHARGE_IDS, UnsupportedConstructError, postureTerm, blazon, normalise, resolve, type Design } from '../src/lib/heraldry/next';
import { arms, charge, div, group, nd, ordinary } from './next-helpers';
import { generatedDesigns } from './next-design-generator';
import { N, V } from './next-validation-cases';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const say = (...input: Parameters<typeof arms>) => blazon(nd(arms(...input)));

describe('worked examples', () => {
  for (const c of N) it(`${c.id}: ${c.blazon}`, () => expect(blazon(nd(c.design))).toBe(c.blazon));
  for (const c of V.filter((x) => x.blazon)) it(`${c.id}: ${c.blazon}`, () => expect(blazon(nd(c.design))).toBe(c.blazon));
});

describe('house style', () => {
  it('capitalises the first word and Or, nothing else, and ends with a full stop', () => {
    for (const d of generatedDesigns(11, 150)) {
      const text = blazon(d);
      expect(text, text).toMatch(/^[A-Z][^A-Z]*(Or[^A-Z]*)*\.$/);
      expect(text).not.toMatch(/\d/);
    }
  });

  it('writes numbers in words and a/an by the charge', () => {
    expect(say('azure', chg('open-book', 'or'))).toBe('Azure, an open book Or.');
    expect(say('azure', chg('eagle', 'or'))).toBe('Azure, an eagle Or.');
    expect(say('azure', chg('wolf', 'or', { count: 2 }))).toBe('Azure, in pale two wolves passant Or.');
    expect(say('azure', chg('anchor', 'or', { count: 12, arrangement: 'rows-4-4-4' }))).toBe('Azure, twelve anchors four, four and four Or.');
  });

  it('uses the SCA spellings', () => {
    expect(say('azure', chg('fleur-de-lis', 'or', { count: 3 }))).toBe('Azure, three fleurs-de-lys Or.');
    expect(say('azure', chg('gear', 'or', { count: 3 }))).toBe('Azure, three cogwheels Or.');
    expect(say('azure', chg('sun', 'or', {}, { mods: [{ id: 'in-splendour' }] }))).toBe('Azure, a sun in splendor Or.');
    expect(say('gules', chg('lightbulb', 'or', { count: 2 }))).toBe('Gules, in pale two lightbulbs Or.');
  });
});

describe('postures', () => {
  it('leave out the posture GoT Table 5 assumes, and state every other', () => {
    expect(say('gules', chg('lion', 'or', {}, { posture: 'rampant' }))).toBe('Gules, a lion Or.');
    expect(say('gules', chg('lion', 'or', {}, { posture: 'passant' }))).toBe('Gules, a lion passant Or.');
    expect(say('gules', chg('unicorn', 'argent', {}, { posture: 'rampant' }))).toBe('Gules, a unicorn argent.');
    expect(say('gules', chg('dragon', 'argent', {}, { posture: 'rampant' }))).toBe('Gules, a dragon argent.');
    expect(say('gules', chg('eagle', 'argent'))).toBe('Gules, an eagle argent.');
    expect(say('gules', chg('fish', 'argent', {}, { posture: 'naiant' }))).toBe('Gules, a fish argent.');
    expect(say('gules', chg('fish', 'argent', {}, { posture: 'haurient' }))).toBe('Gules, a fish haurient argent.');
    expect(say('gules', chg('wolf', 'argent', {}, { posture: 'rampant' }))).toBe('Gules, a wolf rampant argent.');
    expect(say('gules', chg('boar', 'argent'))).toBe('Gules, a boar passant argent.');
    expect(say('gules', chg('goat', 'argent'))).toBe('Gules, a goat statant argent.');
  });

  it('use a charge’s own word for a posture', () => {
    expect(say('gules', chg('stag', 'argent', {}, { posture: 'passant' }))).toBe('Gules, a stag trippant argent.');
    expect(say('gules', chg('stag', 'argent'))).toBe('Gules, a stag statant argent.');
    expect(say('gules', chg('hare', 'argent', {}, { posture: 'courant' }))).toBe('Gules, a hare courant argent.');
    expect(say('gules', chg('hare', 'argent'))).toBe('Gules, a hare sejant argent.');
  });

  it('say nothing for the postureless owl, bee and the like', () => {
    expect(say('gules', chg('owl', 'argent'))).toBe('Gules, an owl argent.');
    expect(say('gules', chg('bee', 'argent', { count: 3 }))).toBe('Gules, three bees argent.');
  });
});

describe('layout words', () => {
  const lone = (count: number, arrangement: string | undefined, field: unknown = 'vert', paint = 'argent') =>
    say(field, chg('rose', paint, { count, ...(arrangement ? { arrangement } : {}) }));

  it('lines and positions lead the charges', () => {
    expect(lone(3, 'in-pale')).toBe('Vert, in pale three roses argent.');
    expect(lone(3, 'in-fess')).toBe('Vert, in fess three roses argent.');
    expect(lone(3, 'in-bend')).toBe('Vert, in bend three roses argent.');
    expect(lone(3, 'in-bend-sinister')).toBe('Vert, in bend sinister three roses argent.');
    expect(lone(1, 'in-chief')).toBe('Vert, in chief a rose argent.');
    expect(lone(2, 'in-chief')).toBe('Vert, in chief two roses argent.');
    expect(lone(2, 'in-base')).toBe('Vert, in base two roses argent.');
  });

  it('count patterns follow the charges', () => {
    expect(lone(3, 'rows-1-2')).toBe('Vert, three roses one and two argent.');
    expect(lone(4, 'rows-2-2')).toBe('Vert, four roses two and two argent.');
    expect(lone(6, undefined)).toBe('Vert, six roses argent.');
    expect(lone(6, undefined, div('per-pale', 'azure', 'vert'), 'argent')).toBe('Per pale azure and vert, six roses three, two and one argent.');
    expect(lone(7, undefined)).toBe('Vert, seven roses three, three and one argent.');
    expect(lone(10, undefined)).toBe('Vert, ten roses argent.');
    expect(lone(10, 'rows-4-4-2')).toBe('Vert, ten roses four, four and two argent.');
    expect(lone(4, 'in-cross')).toBe('Vert, four roses in cross argent.');
    expect(lone(4, 'in-saltire')).toBe('Vert, four roses in saltire argent.');
    expect(lone(5, 'in-orle')).toBe('Vert, five roses in orle argent.');
    expect(lone(3, 'in-annulo')).toBe('Vert, three roses in annulo argent.');
  });

  it('leaves out what Table 7 assumes', () => {
    expect(lone(3, undefined)).toBe('Vert, three roses argent.');
    expect(lone(3, 'rows-2-1')).toBe('Vert, three roses argent.');
    expect(lone(4, undefined, div('quarterly', 'azure', 'or'), 'argent')).toBe('Quarterly azure and Or, four roses argent.');
    expect(lone(4, undefined, div('per-saltire', 'azure', 'or'), 'argent')).toBe('Per saltire azure and Or, four roses argent.');
    expect(lone(2, undefined, div('per-pale', 'azure', 'or'), 'gules')).toBe('Per pale azure and Or, two roses gules.');
  });

  it('states a layout that departs from the table', () => {
    expect(lone(2, 'in-fess', div('per-fess', 'azure', 'or'), 'argent')).toBe('Per fess azure and Or, in fess two roses argent.');
    expect(lone(4, 'rows-2-2', div('per-saltire', 'azure', 'or'), 'argent')).toBe('Per saltire azure and Or, four roses two and two argent.');
  });

  it('says nothing about charges placed by an ordinary', () => {
    expect(say('vert', ord('fess', 'or'), chg('rose', 'argent', { count: 4 }))).toBe('Vert, a fess Or between four roses argent.');
    expect(say('vert', ord('bend', 'or', { charged: [chg('rose', 'argent', { count: 4 })] }))).toBe('Vert, on a bend Or four roses argent.');
  });
});

describe('factoring tinctures (RULES §F.4)', () => {
  it('writes a tincture once across linked elements that share it', () => {
    expect(say('vert', ord('chevron', 'or'), chg('rose', 'or', { count: 3 }), ord('chief', 'or'))).toBe('Vert, a chevron between three roses and a chief Or.');
    expect(say('azure', ord('fess', 'or'), chg('rose', 'or', { count: 3 }))).toBe('Azure, a fess between three roses Or.');
    expect(say('gules', chg('mullet', 'or', { count: 3 }), ord('bordure', 'or'))).toBe('Gules, three mullets and a bordure Or.');
  });

  it('stops where a tincture differs, and uses a comma there', () => {
    expect(say('gules', chg('mullet', 'or', { count: 3 }), ord('bordure', 'argent'))).toBe('Gules, three mullets Or, a bordure argent.');
    expect(say('vert', ord('chevron', 'or'), chg('rose', 'argent', { count: 3 }), ord('chief', 'argent')))
      .toBe('Vert, a chevron Or between three roses and a chief argent.');
  });

  it('factors counterchanged like a tincture', () => {
    expect(say(div('per-pale', 'argent', 'gules'), chg('lion', 'counterchanged'), ord('chief', 'counterchanged'))).toBe('Per pale argent and gules, a lion and a chief counterchanged.');
  });

  it('never factors into or out of a tertiary', () => {
    expect(say('azure', ord('fess', 'or', { charged: [chg('rose', 'or', { count: 3 })] }))).toBe('Azure, on a fess Or three roses Or.');
    expect(say('gules', chg('mullet', 'or', { count: 3 }), ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 3 })] })))
      .toBe('Gules, three mullets and on a chief Or three roses gules.');
    expect(say('gules', ord('chief', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }))).toBe('Gules, on a chief Or three roses gules.');
  });

  it('puts a tertiary after what is set between', () => {
    expect(say('azure', ord('fess', 'or', { charged: [chg('rose', 'or', { count: 2 })] }), chg('mullet', 'or', { count: 3 })))
      .toBe('Azure, on a fess between three mullets Or two roses Or.');
  });
});

describe('fields', () => {
  it('names the division and the parts in model order', () => {
    expect(say(div('per-bend-sinister', 'sable', 'or'), chg('sun', 'gules'))).toBe('Per bend sinister sable and Or, a sun gules.');
    expect(say(div('per-chevron', 'or', 'sable'), ord('chief', 'gules'))).toBe('Per chevron Or and sable, a chief gules.');
    expect(say(div('per-saltire', 'argent', 'azure'), ord('bordure', 'gules'))).toBe('Per saltire argent and azure, a bordure gules.');
  });
});

describe('every charge', () => {
  it('blazons with its table name and plural, and its posture unless the College assumes it', () => {
    for (const id of CHARGE_IDS) {
      const meta = CHARGES[id];
      const posture = meta.defaultPosture && meta.defaultPosture !== meta.scaDefaultPosture ? ` ${postureTerm(id, meta.defaultPosture)}` : '';
      expect(blazon(nd(arms('azure', chg(id, 'or')))), id).toBe(`Azure, ${meta.article} ${meta.name}${posture} Or.`);
      expect(blazon(nd(arms('azure', chg(id, 'or', { count: 3 })))), id).toBe(`Azure, three ${meta.plural}${posture} Or.`);
    }
  });
});

describe('what it will not write', () => {
  it('throws the typed error for a badge, and never reaches a design normalise would not pass', () => {
    const badge = resolve({ v: 2, kind: 'badge', groups: [chg('lion', 'or')] });
    expect(badge.ok).toBe(true);
    expect(() => blazon((badge as { design: Design }).design)).toThrow(UnsupportedConstructError);
    const odd = resolve(arms('azure', ord('fess', 'or'), ord('bend', 'argent', { role: 'overall' })));
    expect(odd.ok && normalise(odd.design).design).toBeNull();
  });

  it('writes any generated design in one sentence', () => {
    for (const d of generatedDesigns(31, 200)) expect(blazon(d).split('. ').length, blazon(d)).toBe(1);
  });
});
