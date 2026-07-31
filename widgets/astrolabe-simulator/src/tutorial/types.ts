import type { AstrolabeState } from '../store';

export type LessonId =
  | 'front.foundations.v1' | 'front.set-sky.v1' | 'front.read-star.v1'
  | 'solar.events.v1' | 'front.unequal-hours.v1' | 'back.measure-altitude.v1'
  | 'back.equation-time.v1' | 'back.shadow-square.v1' | 'back.unequal-hours.v1';
export type TargetId =
  | 'instrument' | 'setup.plate' | 'setup.plate-mismatch'
  | 'front.plate' | 'front.altitude-grid' | 'front.rete'
  | 'front.star.sirius' | 'front.ecliptic' | 'front.unequal-hours' | 'front.rule' | 'back.altitude-scale'
  | 'back.calendar' | 'back.ecliptic-longitude'
  | 'back.horary.vi' | 'back.equation-time' | 'back.shadow-square' | 'back.alidade';
export type Snapshot = Pick<AstrolabeState,
  'face' | 'location' | 'plateSelection' | 'plateLatitude' | 'reteRotation' |
  'ruleRotation' | 'alidadeRotation' | 'visibility' | 'epochIso'>;
export type Predicate =
  | { kind: 'angleNear'; field: 'reteRotation' | 'ruleRotation' | 'alidadeRotation'; value: number; tolerance: number }
  | { kind: 'faceIs'; value: 'front' | 'back' };
export interface LessonStep {
  id: string;
  title: string;
  body: string;
  result: string;
  target: TargetId;
  snapshot: Snapshot;
  demonstration?: { field: 'reteRotation' | 'ruleRotation' | 'alidadeRotation'; from: number; to: number; durationMs: number };
  check?: Predicate;
}
export interface Lesson {
  id: LessonId;
  version: 1;
  title: string;
  summary: string;
  steps: readonly LessonStep[];
}
