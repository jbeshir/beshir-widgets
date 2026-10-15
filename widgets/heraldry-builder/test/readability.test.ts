// Readability: the score looks at contrast, charge size and charge detail, bands read "Easy to spot /
// OK / Hard to read", and the nudge names the single biggest thing to change.

import { describe, expect, it } from 'vitest';
import { BAND_LABEL, BAND_RANGE, blazon, normalise, readability, resolve, isReadabilityBand, type Design } from '../src/lib/heraldry';
import { generatedDesigns } from './design-generator';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import { V } from './validation-cases';

const chg = (id: string, paint: string, extra: object = {}, attrs: object = {}) => group(charge(id, attrs), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);

/** A design that follows the rules, or an error naming the problem. */
function legal(...input: Parameters<typeof arms>): Design {
  const r = normalise(arms(...input));
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.design;
}

const points = (d: Design, factor: string) => readability(d).breakdown.find((b) => b.factor === factor)!.points;

describe('readability bands', () => {
  it('are named for what the visitor sees', () => {
    expect(BAND_LABEL).toEqual({ bold: 'Easy to spot', fine: 'OK', busy: 'Hard to read' });
    expect(BAND_RANGE).toEqual({ bold: '0–2', fine: '3–4', busy: '5+' });
    expect(isReadabilityBand('fine')).toBe(true);
    expect(isReadabilityBand('toString')).toBe(false);
  });

  it('scores the validation rows', () => {
    for (const c of V.filter((x) => x.score !== undefined)) {
      const r = readability(nd(c.design));
      expect([r.score, r.band], c.id).toEqual([c.score, c.band]);
    }
  });

  it('keeps a bold single charge in the top band', () => {
    expect(readability(legal('azure', chg('lion', 'or'))).band).toBe('bold');
    expect(readability(legal('gules', chg('eagle', 'or'))).band).toBe('bold');
  });

  it.each([
    ['Sable, six lions rampant Or', legal('sable', chg('lion', 'or', { count: 6 }))],
    ['Per saltire Or and Argent', nd(arms(div('per-saltire', 'or', 'argent')))],
    ['Per pale Azure and Sable', nd(arms(div('per-pale', 'azure', 'sable')))],
  ])('%s is not in the top band', (_name, d) => {
    expect(readability(d).band).not.toBe('bold');
  });

  it('weighs charges by how many there are and how small they are', () => {
    expect(points(legal('azure', chg('mullet', 'or')), 'count')).toBe(0);
    expect(points(legal('azure', chg('mullet', 'or', { count: 3 })), 'count')).toBe(1);
    expect(points(legal('azure', chg('mullet', 'or', { count: 4 })), 'count')).toBe(2);
    expect(points(legal('azure', chg('mullet', 'or', { count: 6 })), 'count')).toBeGreaterThanOrEqual(3);
    // One charge on an ordinary is drawn small.
    expect(points(legal('azure', ord('fess', 'argent', { charged: [chg('mullet', 'gules')] })), 'count')).toBe(1);
  });

  it('adds a point for each further group of charges', () => {
    const one = legal('azure', ord('fess', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }));
    const two = legal('azure', ord('fess', 'or', { charged: [chg('rose', 'gules', { count: 3 })] }), chg('mullet', 'or', { count: 3 }));
    expect(points(two, 'count')).toBe(points(one, 'count') + 1);
  });

  it('takes detail from the charge, not its category, and the most detailed group counts', () => {
    const detail = (id: string) => points(legal('azure', chg(id, 'or')), 'detail');
    expect(detail('eagle')).toBe(0);
    expect(detail('lion')).toBe(1);
    expect(detail('key')).toBe(1);
    expect(detail('dragon')).toBe(2);
    expect(detail('gear')).toBe(0);
    expect(points(legal('azure', ord('fess', 'argent', { charged: [chg('dragon', 'gules')] }), chg('rose', 'argent', { count: 2 })), 'detail')).toBe(2);
  });

  it('charges a point for each ordinary and one for pictures on a band', () => {
    expect(points(legal('azure', ord('fess', 'or')), 'ordinary')).toBe(1);
    expect(points(nd(arms('gules', chg('mullet', 'argent', { count: 3 }), ord('chief', 'or'), ord('bordure', 'argent'))), 'ordinary')).toBe(2);
    expect(points(legal('azure', ord('fess', 'or')), 'tertiary')).toBe(0);
    expect(points(legal('azure', ord('fess', 'or', { charged: [chg('rose', 'gules')] })), 'tertiary')).toBe(1);
  });

  it('counts a charge lying half on a tincture of its own class', () => {
    // Gules on Or and Azure: contrasts with Or only.
    expect(points(nd(arms(div('per-pale', 'or', 'azure'), chg('mullet', 'gules'))), 'straddle')).toBe(1);
    // Third tincture on a metal-and-colour field: colour mullet over metal and colour halves.
    expect(points(legal(div('per-pale', 'argent', 'sable'), chg('sun', 'or')), 'straddle')).toBe(1);
    expect(points(legal('azure', chg('mullet', 'or')), 'straddle')).toBe(0);
    // A band half on a look-alike tincture counts as well.
    expect(points(nd(arms(div('per-pale', 'or', 'azure'), ord('fess', 'gules'))), 'straddle')).toBe(1);
    // A fur is one part of the background: a sable lion on ermine lies on a metal, its spots are no look-alike half.
    expect(points(legal({ k: 'fur', fur: 'ermine', colours: null }, chg('lion', 'sable')), 'straddle')).toBe(0);
  });

  it('names a background of stripes, checks or fur as patterned, not plain', () => {
    const label = (d: Design) => readability(d).breakdown.find((b) => b.factor === 'division')!.label;
    expect(label(legal({ k: 'fur', fur: 'ermine', colours: null }, chg('lion', 'sable')))).toBe('Patterned background');
    expect(label(legal({ k: 'variation', variation: 'barry', parts: ['or', 'azure'] }, ord('bend', 'gules')))).toBe('Patterned background');
    expect(label(legal('azure', chg('mullet', 'or')))).toBe('Plain background');
  });

  it('treats celestine as a metal', () => {
    expect(points(nd(arms(div('per-pale', 'celestine', 'argent'), chg('mullet', 'gules'))), 'touching')).toBeGreaterThan(0);
    expect(points(legal(div('per-pale', 'celestine', 'sable'), chg('mullet', 'or')), 'touching')).toBe(0);
  });

  it('names its factors without heraldic jargon', () => {
    const d = legal('azure', ord('fess', 'or', { charged: [chg('mullet', 'gules', { count: 3 })] }));
    const labels = readability(d).breakdown.map((b) => b.label).join(' | ');
    expect(labels).not.toMatch(/tincture|ordinary|charge|field/i);
    expect(labels).toMatch(/Pictures on the band/);
    expect(labels).toMatch(/colours/);
    expect(labels).toMatch(/Band or shape/);
  });
});

describe('readability across generated designs', () => {
  it('spreads over all three bands without a catch-all', () => {
    const counts = { bold: 0, fine: 0, busy: 0 };
    const designs = generatedDesigns(1, 300);
    for (const d of designs) counts[readability(d).band]++;
    for (const n of Object.values(counts)) {
      expect(n).toBeGreaterThan(designs.length * 0.12);
      expect(n).toBeLessThan(designs.length * 0.6);
    }
  });
});

describe('readability nudge', () => {
  const nudge = (d: Design) => readability(d).nudge;

  it('is absent from an easy-to-spot design', () => {
    expect(nudge(legal('azure', chg('lion', 'or')))).toBeNull();
  });

  it('names the number of charges', () => {
    expect(nudge(legal('sable', chg('lion', 'or', { count: 6 })))).toBe('Try three lions instead of six');
    expect(nudge(nd(arms(div('per-pale', 'gules', 'azure'), chg('mullet', 'or', { count: 6 }))))).toBe('Try three stars (mullets) instead of six');
  });

  it('names a gold-on-white split', () => {
    expect(nudge(legal(div('per-saltire', 'or', 'argent'), chg('mullet', 'gules')))).toBe('Gold on white is hard to see — try a colour');
  });

  it('names a blue-on-black split', () => {
    expect(nudge(legal(div('per-pale', 'azure', 'sable'), chg('mullet', 'or')))).toBe('Blue on black is hard to see — try a metal');
  });

  it('names a charge that lies half on a look-alike tincture', () => {
    expect(nudge(nd(arms(div('per-pale', 'or', 'azure'), chg('mullet', 'gules')))))
      .toBe('The red star (mullet) is hard to see against the blue part of the background — try a plain background');
  });

  it('suggests a lighter count that fits, not one that would not', () => {
    // Twelve roses on the field: the nearest legal count at or below three is offered.
    expect(nudge(nd(arms('azure', chg('rose', 'or', { count: 12 }))))).toBe('Try three roses instead of twelve');
  });

  it('is present from the middle band onward and for every such design', () => {
    for (const d of generatedDesigns(1, 200)) {
      const r = readability(d);
      expect(r.nudge === null, blazon(d)).toBe(r.band === 'bold');
    }
  });
});

describe('readability of badly formed designs', () => {
  it('still scores a design that breaks the rules, and one whose layout has no room', () => {
    const r = resolve(arms('gules', chg('lion', 'azure', { count: 12 })));
    expect(r.ok && readability(r.design).score).toBeGreaterThan(0);
  });
});
