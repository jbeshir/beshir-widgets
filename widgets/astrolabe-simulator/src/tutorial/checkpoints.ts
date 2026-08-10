import type { AstrolabeState } from '../store';
import { equatorialToHorizontal } from '../astro';
import { orientRetePoint, project } from '../geometry';
import type { Predicate } from './types';

export function circularDistance(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

export function evaluateCheckpoint(predicate: Predicate, state: AstrolabeState): boolean {
  if (predicate.kind === 'faceIs') return state.face === predicate.value;
  if (predicate.kind === 'frontGeometry') {
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
    }
    return true;
  }
  return circularDistance(state[predicate.field], predicate.value) <= predicate.tolerance;
}
