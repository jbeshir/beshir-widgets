// Readability: the score looks at contrast, charge size and charge detail, bands read "Easy to spot /
// OK / Hard to read", and the nudge names the single biggest thing to change.
import { describe, it, expect } from 'vitest';
import { BAND_LABEL, blazon, normalise, readability, resolve, type NormDesign } from '../src/lib/heraldry';
import { generatedDesigns } from './design-generator';
import { plain, div } from './helpers';

const group = (charge: string, count: number, tincture: string, extra: Record<string, unknown> = {}) =>
  ({ charge, count, placement: 'field', tincture, ...extra });

/** A design that follows the rules, or an error naming the problem. */
function arms(field: unknown, charges: unknown = null, ordinary: unknown = null): NormDesign {
  const r = normalise({ v: 1, field, ordinary, charges });
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.design;
}

/** A design as the builder holds it, whether or not it is complete enough to register. */
function drawn(field: unknown, charges: unknown = null): NormDesign {
  const r = resolve({ v: 1, field, ordinary: null, charges });
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.design;
}

describe('readability bands', () => {
  it('are named for what the visitor sees', () => {
    expect(BAND_LABEL).toEqual({ bold: 'Easy to spot', fine: 'OK', busy: 'Hard to read' });
  });

  it('keeps a bold single charge in the top band', () => {
    expect(readability(arms(plain('azure'), group('lion', 1, 'or'))).band).toBe('bold');
    expect(readability(arms(plain('gules'), group('eagle', 1, 'or'))).band).toBe('bold');
  });

  it.each([
    ['Sable, six lions rampant Or', arms(plain('sable'), group('lion', 6, 'or'))],
    ['Per saltire Or and Argent', drawn(div('per-saltire', 'or', 'argent'))],
    ['Per pale Azure and Sable', drawn(div('per-pale', 'azure', 'sable'))],
  ])('%s is not in the top band', (_name, d) => {
    expect(readability(d).band).not.toBe('bold');
  });

  it('weighs charges by how many there are and how small they are', () => {
    const points = (d: NormDesign) => readability(d).breakdown.find((b) => b.factor === 'count')!.points;
    expect(points(arms(plain('azure'), group('mullet', 1, 'or')))).toBe(0);
    expect(points(arms(plain('azure'), group('mullet', 3, 'or')))).toBe(1);
    expect(points(arms(plain('azure'), group('mullet', 4, 'or')))).toBe(2);
    expect(points(arms(plain('azure'), group('mullet', 6, 'or')))).toBeGreaterThanOrEqual(3);
    // One charge on an ordinary is drawn small.
    expect(points(arms(plain('azure'), group('mullet', 1, 'gules', { placement: 'ordinary' }), { type: 'fess', tincture: 'argent' }))).toBe(1);
  });

  it('takes detail from the charge, not its category', () => {
    const detail = (id: string) => readability(arms(plain('azure'), group(id, 1, 'or'))).breakdown.find((b) => b.factor === 'detail')!.points;
    expect(detail('eagle')).toBe(0);
    expect(detail('lion')).toBe(1);
    expect(detail('key')).toBe(1);
    expect(detail('dragon')).toBe(2);
    expect(detail('gear')).toBe(0);
  });

  it('counts a charge lying half on a tincture of its own class', () => {
    const straddle = (d: NormDesign) => readability(d).breakdown.find((b) => b.factor === 'straddle')!.points;
    // Gules on Or and Azure: contrasts with Or only.
    expect(straddle(arms(div('per-pale', 'or', 'azure'), group('mullet', 1, 'gules')))).toBe(1);
    // Third tincture on a metal-and-colour field: colour mullet over metal and colour halves.
    expect(straddle(arms(div('per-pale', 'argent', 'sable'), group('sun', 1, 'or')))).toBe(1);
    expect(straddle(arms(plain('azure'), group('mullet', 1, 'or')))).toBe(0);
  });

  it('treats celestine as a metal', () => {
    const touching = (d: NormDesign) => readability(d).breakdown.find((b) => b.factor === 'touching')!.points;
    expect(touching(arms(div('per-pale', 'celestine', 'argent'), group('mullet', 1, 'gules')))).toBeGreaterThan(0);
    expect(touching(arms(div('per-pale', 'celestine', 'sable'), group('mullet', 1, 'or')))).toBe(0);
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
  const nudge = (d: NormDesign) => readability(d).nudge;

  it('is absent from an easy-to-spot design', () => {
    expect(nudge(arms(plain('azure'), group('lion', 1, 'or')))).toBeNull();
  });

  it('names the number of charges', () => {
    expect(nudge(arms(plain('sable'), group('lion', 6, 'or')))).toBe('Try three lions instead of six');
  });

  it('names a gold-on-white split', () => {
    expect(nudge(arms(div('per-saltire', 'or', 'argent'), group('mullet', 1, 'gules')))).toBe('Gold on white is hard to see — try a colour');
  });

  it('names a blue-on-black split', () => {
    expect(nudge(arms(div('per-pale', 'azure', 'sable'), group('mullet', 1, 'or')))).toBe('Blue on black is hard to see — try a metal');
  });

  it('names a charge that lies half on a look-alike tincture', () => {
    expect(nudge(arms(div('per-pale', 'or', 'azure'), group('mullet', 1, 'gules'), null)))
      .toBe('The red star (mullet) is hard to see against the blue part of the background — try a plain background');
  });

  it('is present from the middle band onward and for every such design', () => {
    for (const d of generatedDesigns(1, 200)) {
      const r = readability(d);
      expect(r.nudge === null, blazon(d)).toBe(r.band === 'bold');
    }
  });
});
