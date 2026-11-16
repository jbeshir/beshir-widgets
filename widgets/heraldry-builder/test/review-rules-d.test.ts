// The SENA corrections of the phase-D rules review (findings R-1 … R-9 and the orientation findings A-1, A-2, A-3, A-20 of the art review,
// /workspace/pd/review/): arrows and pheons point to center by their points, a feather fesswise lies quill to dexter, compact tergiant
// creatures differ by App L1c's orientation groups, the owl is close, a head is substantially different from its beast, to center in annulo
// is a step from core practice, the peacock is close by default, a delf is not turned, a vol has its tips up, and a bear's or horse's head
// may be crowned. Designs are read from blazons by the SCA matcher where it reads them, so those cases are also round trips.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, blazon, candidateKey, chargePath, coreSteps, differences, isClear, keysMayConflict, pathRings, type Design,
} from '../src/lib/heraldry';
import { explainMatch } from './sca/match';
import { arms, charge, group, nd } from './helpers';

/** The design a blazon reads as; a test fails when it doesn't read. */
function read(text: string): Design {
  const m = explainMatch(text);
  if (!m.match?.design) throw new Error(`${text}: ${m.status}`);
  return m.match.design;
}

/** Two blazons' differences as `attr:kind:rule`. */
const between = (a: string, b: string) => differences(read(a), read(b)).map((d) => `${d.attr}:${d.kind}:${d.rule}`);

describe('compact tergiant creatures turn by App L1c\'s groups, a distinct change only (R-2, A5G7a)', () => {
  it('gives a bee, a butterfly, a scorpion or a frog in another group one DC, and never an SC', () => {
    expect(between('Argent, a bee sable.', 'Argent, a bee inverted sable.')).toEqual(['posture:dc:A5G7']);
    expect(between('Argent, a bee sable.', 'Argent, a bee bendwise sable.')).toEqual(['posture:dc:A5G7']);
    expect(between('Argent, a butterfly bendwise azure.', 'Argent, a butterfly bendwise sinister azure.')).toEqual(['posture:dc:A5G7']);
    expect(between('Or, a scorpion inverted gules.', 'Or, a scorpion gules.')).toEqual(['posture:dc:A5G7']);
    expect(between('Azure, a frog bendwise sinister argent.', 'Azure, a frog argent.')).toEqual(['posture:dc:A5G7']);
  });

  it('keeps registered pairs clear: a bee bendwise (2011) and a bee fesswise (2026), a bee inverted and a bee charged (2019, 2022)', () => {
    expect(isClear(differences(read('(Fieldless) A bee bendwise argent.'), read('(Fieldless) A bee fesswise argent.')))).toBe(true);
    expect(isClear(differences(read('Gules, a bee inverted proper.'), read('Gules, on a bee proper a heart gules.')))).toBe(true);
    // creatures of different types turned differently: the type only (A5E5a gives them no comparable orientation)
    expect(between('Argent, a bee sable.', 'Argent, a butterfly inverted sable.')).toEqual(['type:sc:A5E2']);
  });
});

describe('the owl is close (R-3, GoT Table 5 "Owl — Close guardant")', () => {
  it('is a substantial change of posture from an eagle displayed or a raven rising, and none from a raven close', () => {
    expect(between('Argent, an owl gules.', 'Argent, an eagle gules.')).toEqual(['posture:sc:A5E5', 'type:dc:A5G4']);
    expect(between('Argent, an owl gules.', 'Argent, a raven rising gules.')).toEqual(['posture:sc:A5E5', 'type:dc:A5G4']);
    expect(between('Argent, an owl gules.', 'Argent, a raven gules.')).toEqual(['type:dc:A5G4']);
    expect(blazon(read('Argent, an owl close gules.'))).toBe('Argent, an owl gules.');
  });
});

describe('a head is substantially different from its whole beast (R-4, A5E2), and a distinct change from its demi beast (V-2, A5G4)', () => {
  it('keeps the registry\'s pairs clear, a head and a demi beast one DC apart, and heads of one beast still compared', () => {
    expect(between('Argent, a bear rampant sable.', 'Argent, a bear\'s head couped sable.')).toEqual(['type:sc:A5E2']);
    expect(isClear(differences(read('Vert, a horse\'s head couped argent, a bordure Or.'), read('Vert, a horse rampant contourny argent, a bordure Or.')))).toBe(true);
    expect(isClear(differences(read('Argent, three boars statant gules.'), read('Argent, three boar\'s heads erased gules.')))).toBe(true);
    // a head shares its beast's registry key, as a demi beast does: the lookup returns all three and the comparison tells them apart
    expect(keysMayConflict(candidateKey(read('Argent, a bear rampant sable.')), candidateKey(read('Argent, a bear\'s head couped sable.')))).toBe(true);
    expect(candidateKey(read('Argent, a bear\'s head couped sable.')).primary).toBe('charge:bear');
    // a head against a demi beast is one DC (SENA A3D1b, herald question D7), so with a tincture changed too it is clear
    expect(between('Argent, a demi-lion gules.', 'Argent, a lion\'s head erased gules.')).toEqual(['type:dc:A5G4']);
    expect(between('Argent, a demi-lion gules.', 'Argent, a lion\'s head erased azure.')).toEqual(['type:dc:A5G4', 'tincture:dc:A5G3']);
    // couped against erased is no change (M4); a demi beast is still a distinct change from the whole one (M1)
    expect(between('Argent, a bear\'s head couped sable.', 'Argent, a bear\'s head erased sable.')).toEqual([]);
    expect(between('Vert, a demi-unicorn argent.', 'Vert, a unicorn argent.')).toEqual(['type:dc:A5G4']);
    // as a secondary group a head and its beast are one distinct change (A5G4)
    expect(between('Argent, a chevron between three bears rampant sable.', 'Argent, a chevron between three bear\'s heads couped sable.')).toEqual(['type:dc:A5G4']);
  });
});

describe('to center in annulo is a step from core practice (R-5, App G)', () => {
  it('counts it as the in-annulo step', () => {
    expect(coreSteps(read('Argent, eight arrows in annulo points to center, a bordure sable.'))).toEqual(['non-default-orientation-in-annulo-or-orle']);
  });
});

describe('the peacock is close by default (R-6, herald question D52: GoT Table 5 "Bird — Generally close")', () => {
  it('reads "a peacock" and writes it without the posture', () => {
    expect(CHARGES.peacock.scaDefaultPosture).toBe('close');
    expect(blazon(read('Argent, a peacock azure.'))).toBe('Argent, a peacock azure.');
  });
});

describe('the delf, the vol and crowned heads (A-2, A-3, A-20)', () => {
  it('turns no delf (a square has no axis) and crowns a bear\'s or a horse\'s head', () => {
    expect(CHARGES.delf.orient.allowed).toEqual([]);
    expect(blazon(nd(arms('argent', group(charge('bear', { form: 'head', parts: [{ part: 'crowned', paint: 'or' }] }), 'sable'))))).toBe('Argent, a bear\'s head couped sable crowned Or.');
    expect(CHARGES.horse.parts).toContain('crowned');
  });

  it('draws a vol as two wings raised about their roots, joined low, their tips up (elevated, not in lure, not turned over: A-3, V-1)', () => {
    const rings = (id: 'vol' | 'wing') => pathRings(chargePath({ charge: id, form: null, posture: null, gaze: null, mods: [] }));
    /** A ring's area, and its moment about y = 0: positive when the ring runs clockwise on the page. */
    const signed = (r: readonly (readonly [number, number])[]) => r.reduce((s, [x0, y0], i) => {
      const [x1, y1] = r[(i + 1) % r.length], cross = x0 * y1 - x1 * y0;
      return { a: s.a + cross / 2, y: s.y + ((y0 + y1) * cross) / 6 };
    }, { a: 0, y: 0 });
    const weightY = (id: 'vol' | 'wing') => {
      const parts = rings(id).map(signed);
      return parts.reduce((n, p) => n + p.y * Math.sign(p.a), 0) / parts.reduce((n, p) => n + Math.abs(p.a), 0);
    };
    // the wing is drawn bow at chief, its weight high; raised about its root its bow runs inside and its weight sinks below the middle
    expect(weightY('wing')).toBeLessThan(50);
    expect(weightY('vol')).toBeGreaterThan(50);
    // the dexter wing is the wing turned (its outline runs the same way round), not turned over; the sinister one is its mirror image
    const [dexter, sinister] = rings('vol');
    expect(Math.sign(signed(dexter).a)).toBe(Math.sign(signed(rings('wing')[0]).a));
    expect(Math.sign(signed(sinister).a)).toBe(-Math.sign(signed(dexter).a));
    // its tip is its highest point, out to dexter; the wings come closest below the middle, where their roots meet
    const highest = dexter.reduce((a, p) => (p[1] < a[1] ? p : a)), innermost = dexter.reduce((a, p) => (p[0] > a[0] ? p : a));
    expect(highest[0]).toBeLessThan(30);
    expect(innermost[1]).toBeGreaterThan(55);
  });
});
