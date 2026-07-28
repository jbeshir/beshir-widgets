import type { AstrolabeState } from '../store';

export type LessonId = 'front.parts.v1' | 'front.align-star.v1' | 'back.unequal-hours.v1';
export type TargetId =
  | 'instrument' | 'front.plate' | 'front.altitude-grid' | 'front.rete'
  | 'front.star.sirius' | 'front.sun' | 'front.rule' | 'back.altitude-scale'
  | 'back.calendar' | 'back.ecliptic-longitude'
  | 'back.horary.vi' | 'back.alidade';
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
  category: 'Orientation' | 'Front operations' | 'Back operations';
  title: string;
  summary: string;
  steps: readonly LessonStep[];
}
export interface FutureTopic {
  category: string;
  title: string;
  prerequisite: string;
}
