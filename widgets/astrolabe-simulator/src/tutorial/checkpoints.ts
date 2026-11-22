import type { AstrolabeState } from '../store';
import { equatorialToHorizontal } from '../astro';
import { orientRetePoint, project } from '../geometry';
import type { Predicate } from './types';

/** Guards float noise when a value sits exactly on a tolerance boundary. */
const EPSILON = 1e-9;

export function circularDistance(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}
/** Distance between two directions of an undirected line (period 180). */
export function lineDistance(a: number, b: number): number {
  const d = (((a - b) % 180) + 180) % 180;
  return Math.min(d, 180 - d);
}

export function evaluateCheckpoint(predicate: Predicate, state: AstrolabeState): boolean {
  switch (predicate.kind) {
    case 'faceIs': return state.face === predicate.value;
    case 'alidadeAltitude':
      // Either end may be used: the edge crosses h on one side and 180 - h on the other.
      return Math.min(
        lineDistance(state.alidadeRotation, predicate.value),
        lineDistance(state.alidadeRotation, 180 - predicate.value),
      ) <= predicate.tolerance + EPSILON;
    case 'alidadeLongitude':
      return lineDistance(state.alidadeRotation, 180 - predicate.value) <= predicate.tolerance + EPSILON;
    case 'plateIs': return Math.abs(state.plateLatitude - predicate.latitude) <= predicate.tolerance + EPSILON;
    case 'allOf': return predicate.predicates.every((item) => evaluateCheckpoint(item, state));
    case 'angleNear': return circularDistance(state[predicate.field], predicate.value) <= predicate.tolerance + EPSILON;
    case 'frontGeometry': return evaluateFrontGeometry(predicate, state);
  }
}

function evaluateFrontGeometry(predicate: Extract<Predicate, { kind: 'frontGeometry' }>, state: AstrolabeState): boolean {
  if (state.face !== 'front') return false;
  if (predicate.position) {
    const observed = equatorialToHorizontal(
      predicate.body.raDeg,
      predicate.body.decDeg,
      state.plateLatitude,
      state.reteRotation,
    );
    if (
      Math.abs(observed.altitude - predicate.position.altitude) > predicate.position.tolerance ||
      circularDistance(observed.azimuth, predicate.position.azimuth) > predicate.position.tolerance
    ) return false;
  }
  if (predicate.rulePoint) {
    const point = orientRetePoint(
      project(predicate.rulePoint.raDeg, predicate.rulePoint.decDeg, 1),
      state.reteRotation,
    );
    const rule = state.ruleRotation * Math.PI / 180;
    const perpendicular = Math.abs(point.x * Math.cos(rule) + point.y * Math.sin(rule)) /
      Math.hypot(point.x, point.y);
    if (perpendicular > Math.sin(predicate.rulePoint.tolerance * Math.PI / 180)) return false;
    // The point must lie under the Sun end (the arm at +y when the rule is unturned), not just on the line.
    if (point.x * -Math.sin(rule) + point.y * Math.cos(rule) <= 0) return false;
  }
  return true;
}
