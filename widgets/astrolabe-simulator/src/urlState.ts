import { normalizeDeg } from './astro';
import { CITIES } from './data/cities';
import { nearestPlate, PLATES } from './data/plates';
import type { AstrolabeState, Visibility } from './store';

const MANAGED_PARAMS = ['face', 'city', 'lat', 'lng', 'plate', 'platePolicy', 'rete', 'rule', 'alidade', 'hide', 'show', 'epoch'] as const;
const VISIBILITY_KEYS: (keyof Visibility)[] = [
  'almucantars', 'azimuths', 'unequalHours', 'ecliptic', 'artificialAssists', 'stars', 'rule', 'tropics',
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
  state.plateSelection = 'automatic';

  const plateParam = params.get('plate');
  const plate = finiteNumber(plateParam);
  if (plateParam === 'exact') {
    state.plateLatitude = Math.abs(state.location.lat);
    state.plateSelection = 'pinned';
  } else if (plate !== null && PLATES.some((candidate) => candidate.latitude === plate)) {
    state.plateLatitude = plate;
    state.plateSelection = 'pinned';
  }
  if (params.get('platePolicy') === 'automatic') {
    state.plateSelection = 'automatic';
    state.plateLatitude = nearestPlate(state.location.lat).latitude;
  }
  const epoch = params.get('epoch');
  if (epoch && !Number.isNaN(Date.parse(epoch))) state.epochIso = new Date(epoch).toISOString();

  for (const [param, key] of [
    ['rete', 'reteRotation'],
    ['rule', 'ruleRotation'],
    ['alidade', 'alidadeRotation'],
  ] as const) {
    const value = finiteNumber(params.get(param));
    if (value !== null) state[key] = normalizeDeg(value);
  }

  const hidden = new Set((params.get('hide') ?? '').split(',').filter(Boolean));
  const shown = new Set((params.get('show') ?? '').split(',').filter(Boolean));
  for (const key of VISIBILITY_KEYS) {
    if (hidden.has(key)) state.visibility[key] = false;
    if (shown.has(key)) state.visibility[key] = true;
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
  const exactPlate = Math.abs(state.location.lat);
  if (state.plateSelection === 'pinned' && state.plateLatitude === exactPlate && state.plateLatitude !== automaticPlate) {
    params.set('plate', 'exact');
  } else if (state.plateSelection === 'pinned' || state.plateLatitude !== automaticPlate) {
    params.set('plate', compactNumber(state.plateLatitude));
  }
  if (state.plateSelection === 'automatic' && state.plateLatitude !== automaticPlate) params.set('platePolicy', 'automatic');
  if (state.reteRotation !== defaults.reteRotation) params.set('rete', compactNumber(state.reteRotation));
  if (state.ruleRotation !== defaults.ruleRotation) params.set('rule', compactNumber(state.ruleRotation));
  if (state.alidadeRotation !== defaults.alidadeRotation) params.set('alidade', compactNumber(state.alidadeRotation));
  if (state.epochIso !== defaults.epochIso) params.set('epoch', state.epochIso);

  const hidden = VISIBILITY_KEYS.filter((key) => defaults.visibility[key] && !state.visibility[key]);
  const shown = VISIBILITY_KEYS.filter((key) => !defaults.visibility[key] && state.visibility[key]);
  if (hidden.length > 0) params.set('hide', hidden.join(','));
  if (shown.length > 0) params.set('show', shown.join(','));
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
