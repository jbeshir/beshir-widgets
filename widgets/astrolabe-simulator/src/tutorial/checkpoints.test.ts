import { describe, expect, it } from 'vitest';
import type { AstrolabeState } from '../store';
import { orientRetePoint, project } from '../geometry';
import { evaluateCheckpoint, lineDistance } from './checkpoints';
import type { Predicate } from './types';

const state = (patch: Partial<AstrolabeState> = {}): AstrolabeState => ({
  face: 'back',
  location: { label: 'London', lat: 51.5, lng: -0.12, manual: false },
  plateSelection: 'pinned',
  plateLatitude: 51.5,
  reteRotation: 0,
  ruleRotation: 0,
  alidadeRotation: 0,
  visibility: {
    almucantars: true, azimuths: true, unequalHours: true, ecliptic: true, artificialAssists: false, stars: true,
    rule: true, tropics: true, calendar: true, zodiacScale: true, shadowSquare: true,
    backUnequalHours: true, equationOfTime: true, alidade: true,
  },
  highlight: null,
  reducedMotion: false,
  epochIso: '2026-04-20T12:00:00.000Z',
  ...patch,
});

describe('lineDistance', () => {
  it.each([[0, 180, 0], [179, 1, 2], [10, 190, 0], [90, 0, 90], [-10, 10, 20]])('%s vs %s is %s', (a, b, d) =>
    expect(lineDistance(a, b)).toBeCloseTo(d, 10));
});

describe('alidadeAltitude', () => {
  const check: Predicate = { kind: 'alidadeAltitude', value: 30, tolerance: 1 };
  it('passes at either end of the alidade', () => {
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 30 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 150 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 210 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 330 }))).toBe(true);
  });
  it('fails away from both ends', () => {
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 90 }))).toBe(false);
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 60 }))).toBe(false);
  });
  it.each([30, 150, 210, 330])('is inclusive at tolerance ± 0.01 around %s', (centre) => {
    const tight: Predicate = { kind: 'alidadeAltitude', value: 30, tolerance: 1 };
    for (const sign of [1, -1]) {
      expect(evaluateCheckpoint(tight, state({ alidadeRotation: centre + sign * 0.99 }))).toBe(true);
      expect(evaluateCheckpoint(tight, state({ alidadeRotation: centre + sign * 1 }))).toBe(true);
      expect(evaluateCheckpoint(tight, state({ alidadeRotation: centre + sign * 1.01 }))).toBe(false);
    }
  });
  it('handles the horizontal wrap', () => {
    const level: Predicate = { kind: 'alidadeAltitude', value: 0, tolerance: 0.5 };
    expect(evaluateCheckpoint(level, state({ alidadeRotation: 359.6 }))).toBe(true);
    expect(evaluateCheckpoint(level, state({ alidadeRotation: 179.6 }))).toBe(true);
    expect(evaluateCheckpoint(level, state({ alidadeRotation: 0.51 }))).toBe(false);
  });
});

describe('alidadeLongitude', () => {
  // λ = 30.4 gives a = 149.6 (mod 180): the date line, read on either arm.
  const check: Predicate = { kind: 'alidadeLongitude', value: 30.4, tolerance: 0.5 };
  it('passes on both arms of the date line', () => {
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 149.6 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ alidadeRotation: 329.6 }))).toBe(true);
  });
  it('is inclusive at the boundary and fails beyond it', () => {
    for (const centre of [149.6, 329.6]) {
      for (const sign of [1, -1]) {
        expect(evaluateCheckpoint(check, state({ alidadeRotation: centre + sign * 0.49 }))).toBe(true);
        expect(evaluateCheckpoint(check, state({ alidadeRotation: centre + sign * 0.5 }))).toBe(true);
        expect(evaluateCheckpoint(check, state({ alidadeRotation: centre + sign * 0.51 }))).toBe(false);
      }
    }
  });
  it('wraps for longitudes of 0 and 180 and above', () => {
    const aries: Predicate = { kind: 'alidadeLongitude', value: 0, tolerance: 1 };
    expect(evaluateCheckpoint(aries, state({ alidadeRotation: 180 }))).toBe(true);
    expect(evaluateCheckpoint(aries, state({ alidadeRotation: 0.5 }))).toBe(true);
    expect(evaluateCheckpoint(aries, state({ alidadeRotation: 2 }))).toBe(false);
    const scorpio: Predicate = { kind: 'alidadeLongitude', value: 210.1, tolerance: 0.5 };
    expect(evaluateCheckpoint(scorpio, state({ alidadeRotation: 149.9 }))).toBe(true);
    expect(evaluateCheckpoint(scorpio, state({ alidadeRotation: 329.9 }))).toBe(true);
  });
});

describe('plateIs', () => {
  const check: Predicate = { kind: 'plateIs', latitude: 51.5, tolerance: 0.01 };
  it('is inclusive at the tolerance and fails 0.01 beyond it', () => {
    expect(evaluateCheckpoint(check, state({ plateLatitude: 51.5 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ plateLatitude: 51.51 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ plateLatitude: 51.49 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ plateLatitude: 51.52 }))).toBe(false);
    expect(evaluateCheckpoint(check, state({ plateLatitude: 51.48 }))).toBe(false);
    expect(evaluateCheckpoint(check, state({ plateLatitude: 50 }))).toBe(false);
  });
});

describe('allOf', () => {
  const both: Predicate = {
    kind: 'allOf',
    predicates: [
      { kind: 'plateIs', latitude: 51.5, tolerance: 0.01 },
      { kind: 'angleNear', field: 'alidadeRotation', value: 90, tolerance: 1 },
    ],
  };
  it('needs every predicate', () => {
    expect(evaluateCheckpoint(both, state({ alidadeRotation: 90 }))).toBe(true);
    expect(evaluateCheckpoint(both, state({ alidadeRotation: 92 }))).toBe(false);
    expect(evaluateCheckpoint(both, state({ alidadeRotation: 90, plateLatitude: 40.93 }))).toBe(false);
  });
  it('is vacuously true when empty and nests', () => {
    expect(evaluateCheckpoint({ kind: 'allOf', predicates: [] }, state())).toBe(true);
    expect(evaluateCheckpoint({ kind: 'allOf', predicates: [both, { kind: 'faceIs', value: 'front' }] }, state({ alidadeRotation: 90 }))).toBe(false);
    expect(evaluateCheckpoint({ kind: 'allOf', predicates: [both, { kind: 'faceIs', value: 'back' }] }, state({ alidadeRotation: 90 }))).toBe(true);
  });
});

describe('angleNear boundary', () => {
  it('is inclusive at the tolerance', () => {
    const check: Predicate = { kind: 'angleNear', field: 'reteRotation', value: 10, tolerance: 1 };
    expect(evaluateCheckpoint(check, state({ reteRotation: 11 }))).toBe(true);
    expect(evaluateCheckpoint(check, state({ reteRotation: 11.01 }))).toBe(false);
    expect(evaluateCheckpoint(check, state({ reteRotation: 8.99 }))).toBe(false);
  });
});

describe('frontGeometry rulePoint (Sun end)', () => {
  const body = { raDeg: 30, decDeg: 10 };
  const check: Predicate = { kind: 'frontGeometry', body, rulePoint: { ...body, tolerance: 1 } };
  // The point's direction in plate coordinates (rete unturned); the Sun end lies at (−sin ρ, cos ρ).
  const p = orientRetePoint(project(body.raDeg, body.decDeg, 1), 0);
  const sunEnd = ((Math.atan2(-p.x, p.y) * 180) / Math.PI + 360) % 360;
  const at = (rule: number) => state({ face: 'front', reteRotation: 0, ruleRotation: rule });
  it('passes with the point under the Sun end', () => {
    expect(evaluateCheckpoint(check, at(sunEnd))).toBe(true);
  });
  it('fails with the point under the other end, though it is on the same line', () => {
    expect(evaluateCheckpoint(check, at(sunEnd + 180))).toBe(false);
  });
  it('is inclusive at the angular tolerance on the Sun end and fails just beyond it', () => {
    expect(evaluateCheckpoint(check, at(sunEnd + 0.99))).toBe(true);
    expect(evaluateCheckpoint(check, at(sunEnd - 0.99))).toBe(true);
    expect(evaluateCheckpoint(check, at(sunEnd + 1.01))).toBe(false);
    expect(evaluateCheckpoint(check, at(sunEnd + 180 + 0.5))).toBe(false);
  });
});
