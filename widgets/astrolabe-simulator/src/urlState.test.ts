import { describe, expect, it } from 'vitest';
import type { AstrolabeState } from './store';
import { searchFromState, stateFromSearch } from './urlState';

const defaults: AstrolabeState = {
  face: 'front',
  location: { label: 'London', lat: 51.5, lng: -0.12, manual: false },
  plateLatitude: 50,
  reteRotation: 0,
  ruleRotation: 0,
  alidadeRotation: 0,
  visibility: {
    almucantars: true, azimuths: true, unequalHours: true, ecliptic: true,
    stars: true, rule: true, tropics: true, calendar: true, zodiacScale: true,
    shadowSquare: true, backUnequalHours: true, equationOfTime: true, alidade: true,
  },
  highlight: null,
  reducedMotion: false,
};

describe('astrolabe URL state', () => {
  it('round-trips a shareable preset-city configuration', () => {
    const configured: AstrolabeState = {
      ...defaults,
      face: 'back',
      location: { label: 'Edinburgh', lat: 55.9533, lng: -3.1883, manual: false },
      plateLatitude: 55,
      reteRotation: 27.5,
      ruleRotation: 182,
      alidadeRotation: 45,
      visibility: { ...defaults.visibility, shadowSquare: false, calendar: false },
    };
    const search = searchFromState('', configured, defaults);
    expect(search).toBe('?face=back&city=Edinburgh&rete=27.5&rule=182&alidade=45&hide=calendar%2CshadowSquare');
    expect(stateFromSearch(search, defaults)).toEqual(configured);
  });

  it('round-trips custom coordinates and a non-nearest plate', () => {
    const configured: AstrolabeState = {
      ...defaults,
      location: { label: 'Custom', lat: 47.61, lng: -122.33, manual: true },
      plateLatitude: 50,
      visibility: { ...defaults.visibility },
    };
    const restored = stateFromSearch(searchFromState('', configured, defaults), defaults);
    expect(restored.location).toEqual(configured.location);
    expect(restored.plateLatitude).toBe(50);
  });

  it('normalizes rotations and ignores malformed or out-of-range values', () => {
    const restored = stateFromSearch('?face=sideways&city=Missing&lat=200&lng=nope&plate=47&rete=-10&rule=721', defaults);
    expect(restored.face).toBe('front');
    expect(restored.location).toEqual(defaults.location);
    expect(restored.plateLatitude).toBe(50);
    expect(restored.reteRotation).toBe(350);
    expect(restored.ruleRotation).toBe(1);
  });

  it('preserves unrelated host parameters and removes defaults', () => {
    expect(searchFromState('?embedded=1&face=back&rete=20', defaults, defaults)).toBe('?embedded=1');
  });

  it('ignores unknown hidden-layer names', () => {
    const restored = stateFromSearch('?hide=stars,notARealLayer', defaults);
    expect(restored.visibility.stars).toBe(false);
    expect(restored.visibility.azimuths).toBe(true);
  });
});
