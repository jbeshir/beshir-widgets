// The SENA corrections of the phase-C rules review (findings R-1 … R-12, /workspace/pc/review/findings-rules.md): Table 7's one and two on per
// chevron inverted, a charge where three parts meet, each cotise on its own ground, charges in cross judged on the lines, the baton dexter,
// a canton of one tincture, counterchanging over gyronny one charge to each gyron, and the A3B3a exception for an ordinary over the line.
// Designs are read from blazons by the SCA matcher, so each case is also a round trip.

import { describe, expect, it } from 'vitest';
import { blazon, canonicalSlots, counterchangeUnavailable, differences, validate, type Design } from '../src/lib/heraldry';
import { explainMatch } from './sca/match';

/** The design a blazon reads as; a test fails when it doesn't read. */
function read(text: string): Design {
  const m = explainMatch(text);
  if (!m.match?.design) throw new Error(`${text}: ${m.status}`);
  return m.match.design;
}

const issues = (text: string) => validate(read(text)).map((i) => i.message);

describe('Table 7: three on per chevron inverted stand one and two (R-1)', () => {
  it('lays them one in the V and two below, and "one and two" is no change', () => {
    const d = read('Per chevron inverted purpure and vert, three roses Or.');
    const [top, left, right] = canonicalSlots(d, [0]);
    expect(top.x).toBe(50);
    expect(left.y).toBe(right.y);
    expect(top.y).toBeLessThan(left.y);
    expect(differences(d, read('Per chevron inverted purpure and vert, three roses one and two Or.'))).toEqual([]);
    expect(blazon(d)).toBe('Per chevron inverted purpure and vert, three roses Or.');
  });

  it('accepts the heart on argent in the V and the roses on sable below (37262)', () => {
    expect(issues('Per chevron inverted argent and sable, a heart gules and two roses argent.')).toEqual([]);
  });
});

describe('a charge where the three parts of a per pall meet lies on all three (SENA A3B4a, R-2)', () => {
  it('refuses SENA\'s mullet on a field two-thirds colour, inverted or not, and keeps the one in chief', () => {
    expect(issues('Per pall inverted argent, gules and azure, a mullet sable.')).toHaveLength(1);
    expect(issues('Per pall argent, gules and azure, a mullet sable.')).toHaveLength(1);
    expect(issues('Per pall inverted argent, gules and azure, in chief a mullet sable.')).toEqual([]);
    expect(issues('Per pall inverted argent, Or and azure, a mullet sable.')).toEqual([]);
  });
});

describe('each cotise contrasts with the part of the field it lies on (SENA A3B4a, App I2c; R-3)', () => {
  it('refuses a cotise wholly on a part of its own class, on every cotised host', () => {
    for (const text of [
      'Per fess argent and azure, a fess gules cotised Or.',
      'Per pale argent and azure, a pale gules endorsed Or.',
      'Per bend argent and azure, a bend gules cotised Or.',
      'Per chevron argent and azure, a chevron gules cotised Or.',
      'Quarterly argent and azure, a cross gules cotised Or.',
      'Per saltire argent and azure, a saltire gules cotised Or.',
    ]) expect(issues(text), text).toEqual([expect.stringMatching(/^A cotise of the \w+ \(Or\) lies on Argent: metal on metal$/)]);
  });

  it('still accepts cotises that contrast with both parts, on a plain field, and counterchanged', () => {
    expect(issues('Per fess argent and Or, a fess azure cotised sable.')).toEqual([]);
    expect(issues('Argent, a fess gules cotised sable.')).toEqual([]);
    expect(issues('Per fess argent and azure, a fess gules cotised counterchanged.')).toEqual([]);
  });
});

describe('four charges in cross on a field whose lines meet at the fess point stand on the lines (R-4)', () => {
  it('accepts them on gyronny, gyronny arrondi and quarterly, as the College registers them', () => {
    expect(issues('Gyronny azure and Or, in cross four roses gules.')).toEqual([]);
    expect(issues('Gyronny arrondi azure and Or, in cross four roses gules.')).toEqual([]);
    expect(issues('Gyronny sable and argent, four roses in cross gules.')).toEqual([]);
    expect(issues('Quarterly azure and Or, in cross four roses gules.')).toEqual([]);
  });

  it('still refuses them where one stands wholly on a part it does not contrast with', () => {
    expect(issues('Gyronny of six azure and Or, in cross four roses gules.')).toHaveLength(1);
  });
});

describe('a baton is a bend couped, a baton sinister a bend sinister couped (RULES-C §C.2, R-5)', () => {
  it('reads both, and compares them with the bend and the bend sinister', () => {
    const baton = read('Gules, a baton argent.'), sinister = read('Gules, a baton sinister argent.');
    expect(blazon(sinister)).toBe('Gules, a baton sinister argent.');
    expect(differences(baton, read('Gules, a bend couped argent.'))).toEqual([]);
    expect(differences(sinister, read('Gules, a bend sinister couped argent.'))).toEqual([]);
    expect(differences(baton, read('Gules, a bend argent.')).map((x) => `${x.kind}:${x.rule}`)).toEqual(['dc:A5G4']);
    expect(differences(baton, sinister).map((x) => `${x.kind}:${x.rule}`)).toEqual(['sc:A5E2']);
  });

  it('takes a fieldless baton as a couped band, the badge gap, not a refusal', () => {
    const m = explainMatch('(Fieldless) A baton sinister vair.');
    expect(m.status).toBe('unsupported');
    expect(m.gaps).toEqual([{ category: 'fieldless', detail: 'couped-ordinary' }]);
  });

  it('draws the baton from dexter chief', () => {
    const [slot] = canonicalSlots(read('Gules, a baton argent, in sinister chief a mullet Or.'), [1]);
    expect(slot.x).toBeGreaterThan(50);
  });
});

describe('a canton or quarter is of a single tincture (SENA A6C1, R-6)', () => {
  it('refuses one divided, varied or with a sinister form, and keeps a fur', () => {
    for (const text of ['Argent, a canton checky azure and Or.', 'Argent, a canton per pale azure and gules.', 'Argent, a quarter per pale azure and gules.', 'Sable, a sinister canton checky vert and argent.']) {
      expect(issues(text), text).toEqual([expect.stringMatching(/must be of one tincture: a divided one reads as an augmentation \(SENA A6C1\)/)]);
    }
    expect(issues('Sable, a canton ermine.')).toEqual([]);
  });
});

describe('counterchanged over gyronny: one charge, or one to each gyron in annulo (L33, R-7)', () => {
  it('allows what the College registers under SENA and refuses the rest', () => {
    expect(issues('Gyronny sable and Or, eight roundels in annulo counterchanged.')).toEqual([]);
    expect(issues('Gyronny of six sable and Or, six roundels in annulo counterchanged.')).toEqual([]);
    expect(issues('Gyronny argent and azure, a lion counterchanged.')).toEqual([]);
    const six = read('Gyronny sable and Or, six roundels in annulo counterchanged.');
    expect(counterchangeUnavailable(six, [0])).toMatch(/only a single charge, or eight in annulo, one to each gyron/);
    expect(counterchangeUnavailable(read('Gyronny argent and azure, a saltire counterchanged.'), [0])).toMatch(/a band or cross can't be counterchanged over gyronny/);
  });
});

describe('a divided field may share a tincture when an ordinary separates its parts (SENA A3B3a, R-11)', () => {
  it('accepts the ordinary over the line, and refuses the field without it or with the band moved off it', () => {
    expect(issues('Per pale argent and ermine, a pale gules.')).toEqual([]);
    expect(issues('Per fess argent and ermine, a fess gules.')).toEqual([]);
    expect(issues('Per pale gules and gules masoned Or, a pale argent.')).toEqual([]);
    expect(issues('Per fess argent and ermine, a lion gules.')).toEqual([expect.stringMatching(/can't share a tincture/)]);
    expect(issues('Per fess argent and ermine, a fess gules, a chief azure.').some((m) => /can't share a tincture/.test(m))).toBe(true);
  });
});
