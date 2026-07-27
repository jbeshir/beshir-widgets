import type { AstrolabeState } from '../store';
import type { Predicate } from './types';

export function circularDistance(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

export function evaluateCheckpoint(predicate: Predicate, state: AstrolabeState): boolean {
  if (predicate.kind === 'faceIs') return state.face === predicate.value;
  return circularDistance(state[predicate.field], predicate.value) <= predicate.tolerance;
}
