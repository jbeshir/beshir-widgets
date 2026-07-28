/**
 * Tutorial-ready observable store (PLAN §4): a hand-rolled module singleton
 * (no state library — see PLAN §1) so `window.astrolabe` gives a stable
 * programmatic API independent of component mount. Rendering is a pure
 * function of this state; components read it via `useStore()`.
 */

import { useEffect, useState } from 'preact/hooks';
import { nearestPlate } from './data/plates';
import { normalizeDeg } from './astro';
import { searchFromState, stateFromSearch } from './urlState';

export type Face = 'front' | 'back';

export interface Location {
  label: string;
  lat: number;
  lng: number;
  manual: boolean;
}

export interface Visibility {
  almucantars: boolean;
  azimuths: boolean;
  unequalHours: boolean;
  ecliptic: boolean;
  stars: boolean;
  rule: boolean;
  tropics: boolean;
  calendar: boolean;
  zodiacScale: boolean;
  shadowSquare: boolean;
  backUnequalHours: boolean;
  equationOfTime: boolean;
  alidade: boolean;
}

export interface AstrolabeState {
  face: Face;
  location: Location;
  plateSelection: 'automatic' | 'pinned';
  plateLatitude: number;
  reteRotation: number;
  ruleRotation: number;
  alidadeRotation: number;
  visibility: Visibility;
  highlight: string | null;
  reducedMotion: boolean;
  epochIso: string;
}
export type ChangeSource = 'user' | 'tutorial' | 'url' | 'host' | 'reset';
export interface ChangeMeta { source: ChangeSource; operationId?: number; syncUrl?: boolean }
export interface StoreChange {
  previous: AstrolabeState; current: AstrolabeState; changedKeys: readonly (keyof AstrolabeState)[]; meta: ChangeMeta;
}

export type LocationInput = Partial<Location> & { name?: string; lat: number; lng: number };

function resolveReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const DEFAULT_LOCATION: Location = { label: 'London', lat: 51.5, lng: -0.12, manual: false };
const DEFAULT_EPOCH_ISO = new Date().toISOString();

function defaultState(): AstrolabeState {
  return {
    face: 'front',
    location: { ...DEFAULT_LOCATION },
    plateSelection: 'automatic',
    plateLatitude: nearestPlate(DEFAULT_LOCATION.lat).latitude,
    reteRotation: 0,
    ruleRotation: 0,
    alidadeRotation: 0,
    visibility: {
      almucantars: true,
      azimuths: true,
      unequalHours: true,
      ecliptic: true,
      stars: true,
      rule: true,
      tropics: true,
      calendar: true,
      zodiacScale: true,
      shadowSquare: true,
      backUnequalHours: true,
      equationOfTime: true,
      alidade: true,
    },
    highlight: null,
    reducedMotion: resolveReducedMotion(),
    epochIso: DEFAULT_EPOCH_ISO,
  };
}

const defaults = defaultState();
let state: AstrolabeState = typeof window === 'undefined'
  ? defaults
  : stateFromSearch(window.location.search, defaults);
const listeners = new Set<(state: AstrolabeState) => void>();
const changeListeners = new Set<(change: StoreChange) => void>();

function notify(syncUrl = true): void {
  for (const listener of listeners) listener(state);
  if (syncUrl && typeof window !== 'undefined') {
    const search = searchFromState(window.location.search, state, defaults);
    const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

export function getState(): AstrolabeState {
  return state;
}

export function subscribe(fn: (state: AstrolabeState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function subscribeChanges(fn: (change: StoreChange) => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

const ROTATION_KEYS = ['reteRotation', 'ruleRotation', 'alidadeRotation'] as const;

/**
 * Shallow-merges top-level state, but deep-merges `visibility`/`location` so
 * a tutorial (or a control) can pass either a full nested object or a sparse
 * partial without clobbering untouched fields. Never throws on partial or
 * malformed input — patches are applied field-by-field.
 */
export function applyTransaction(patch: Partial<AstrolabeState>, meta: ChangeMeta = { source: 'host' }): StoreChange | null {
  if (!patch || typeof patch !== 'object') return null;
  const previous = state;
  const next: AstrolabeState = { ...state };

  for (const key of Object.keys(patch) as (keyof AstrolabeState)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    if (key === 'visibility' && value && typeof value === 'object') {
      next.visibility = { ...state.visibility, ...(value as Partial<Visibility>) };
    } else if (key === 'location' && value && typeof value === 'object') {
      next.location = { ...state.location, ...(value as Partial<Location>) };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key] = value;
    }
  }

  for (const key of ROTATION_KEYS) {
    if (typeof next[key] === 'number' && Number.isFinite(next[key])) {
      next[key] = normalizeDeg(next[key]);
    }
  }

  const changedKeys = (Object.keys(next) as (keyof AstrolabeState)[]).filter((key) => {
    if (key === 'location' || key === 'visibility') return JSON.stringify(previous[key]) !== JSON.stringify(next[key]);
    return previous[key] !== next[key];
  });
  if (changedKeys.length === 0) return null;
  state = next;
  const change = { previous, current: state, changedKeys, meta };
  for (const listener of changeListeners) listener(change);
  notify(meta.syncUrl !== false);
  return change;
}

export function setState(patch: Partial<AstrolabeState>): void {
  applyTransaction(patch, { source: 'host' });
}

export function setFace(face: Face): void {
  applyTransaction({ face }, { source: 'user' });
}

/**
 * Accepts a preset `City` ({name,lat,lng}) or a manual location patch
 * ({label,lat,lng,manual}). Auto-selects the nearest plate unless a plate
 * has been pinned manually via `selectPlate`.
 */
export function setLocation(input: LocationInput): void {
  if (!input || typeof input.lat !== 'number' || typeof input.lng !== 'number') return;
  const label = input.label ?? input.name ?? 'Custom';
  const manual = input.manual ?? false;
  const patch: Partial<AstrolabeState> = { location: { label, lat: input.lat, lng: input.lng, manual } };
  if (state.plateSelection === 'automatic') patch.plateLatitude = nearestPlate(input.lat).latitude;
  applyTransaction(patch, { source: 'user' });
}

/** Pins a specific plate latitude; subsequent `setLocation` calls won't override it. */
export function selectPlate(lat: number): void {
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return;
  applyTransaction({ plateSelection: 'pinned', plateLatitude: lat }, { source: 'user' });
}

export function setRete(deg: number): void {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return;
  applyTransaction({ reteRotation: deg }, { source: 'user' });
}

export function setRule(deg: number): void {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return;
  applyTransaction({ ruleRotation: deg }, { source: 'user' });
}

export function setAlidade(deg: number): void {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return;
  applyTransaction({ alidadeRotation: deg }, { source: 'user' });
}

export function toggleLayer(key: keyof Visibility): void {
  if (!(key in state.visibility)) return;
  applyTransaction({ visibility: { [key]: !state.visibility[key] } as Partial<Visibility> }, { source: 'user' });
}

export function setHighlight(key: string | null): void {
  setState({ highlight: key });
}

export function reset(): void {
  const previous = state;
  state = defaultState();
  const change: StoreChange = { previous, current: state, changedKeys: Object.keys(state) as (keyof AstrolabeState)[], meta: { source: 'reset' } };
  for (const listener of changeListeners) listener(change);
  notify();
}

export function useStore(): AstrolabeState {
  const [snapshot, setSnapshot] = useState(getState);
  useEffect(() => subscribe(setSnapshot), []);
  return snapshot;
}

const api = {
  getState,
  setState,
  applyTransaction,
  subscribe,
  subscribeChanges,
  setFace,
  setLocation,
  selectPlate,
  setRete,
  setRule,
  setAlidade,
  toggleLayer,
  setHighlight,
  reset,
};

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).astrolabe = api;
}
