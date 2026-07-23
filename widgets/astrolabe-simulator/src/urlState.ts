import { normalizeDeg } from './astro';
import { CITIES } from './data/cities';
import { nearestPlate, PLATES } from './data/plates';
import type { AstrolabeState, Visibility } from './store';

const MANAGED_PARAMS = ['face', 'city', 'lat', 'lng', 'plate', 'rete', 'rule', 'alidade', 'hide'] as const;
const VISIBILITY_KEYS: (keyof Visibility)[] = [
  'almucantars', 'azimuths', 'unequalHours', 'ecliptic', 'stars', 'rule', 'tropics',
  'calendar', 'zodiacScale', 'shadowSquare', 'backUnequalHours', 'equationOfTime', 'alidade',
];

function finiteNumber(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

export function stateFromSearch(search: string, defaults: AstrolabeState): AstrolabeState {
  const params = new URLSearchParams(search);
  const state: AstrolabeState = {
    ...defaults,
    location: { ...defaults.location },
    visibility: { ...defaults.visibility },
  };

  if (params.get('face') === 'back') state.face = 'back';

  const cityName = params.get('city');
  const city = cityName ? CITIES.find((candidate) => candidate.name === cityName) : undefined;
  const lat = finiteNumber(params.get('lat'));
  const lng = finiteNumber(params.get('lng'));
  if (city) {
    state.location = { label: city.name, lat: city.lat, lng: city.lng, manual: false };
  } else if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    state.location = { label: 'Custom', lat, lng, manual: true };
  }
  state.plateLatitude = nearestPlate(state.location.lat).latitude;

  const plate = finiteNumber(params.get('plate'));
  if (plate !== null && PLATES.some((candidate) => candidate.latitude === plate)) {
    state.plateLatitude = plate;
  }

  for (const [param, key] of [
    ['rete', 'reteRotation'],
    ['rule', 'ruleRotation'],
    ['alidade', 'alidadeRotation'],
  ] as const) {
    const value = finiteNumber(params.get(param));
    if (value !== null) state[key] = normalizeDeg(value);
  }

  const hidden = new Set((params.get('hide') ?? '').split(',').filter(Boolean));
  for (const key of VISIBILITY_KEYS) {
    if (hidden.has(key)) state.visibility[key] = false;
  }
  return state;
}

export function searchFromState(currentSearch: string, state: AstrolabeState, defaults: AstrolabeState): string {
  const params = new URLSearchParams(currentSearch);
  for (const key of MANAGED_PARAMS) params.delete(key);

  if (state.face !== defaults.face) params.set('face', state.face);
  if (state.location.manual) {
    params.set('lat', compactNumber(state.location.lat));
    params.set('lng', compactNumber(state.location.lng));
  } else if (state.location.label !== defaults.location.label) {
    params.set('city', state.location.label);
  }

  const automaticPlate = nearestPlate(state.location.lat).latitude;
  if (state.plateLatitude !== automaticPlate) params.set('plate', compactNumber(state.plateLatitude));
  if (state.reteRotation !== defaults.reteRotation) params.set('rete', compactNumber(state.reteRotation));
  if (state.ruleRotation !== defaults.ruleRotation) params.set('rule', compactNumber(state.ruleRotation));
  if (state.alidadeRotation !== defaults.alidadeRotation) params.set('alidade', compactNumber(state.alidadeRotation));

  const hidden = VISIBILITY_KEYS.filter((key) => !state.visibility[key]);
  if (hidden.length > 0) params.set('hide', hidden.join(','));
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
