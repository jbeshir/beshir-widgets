import type { AstrolabeState, Face } from '../store';
import type { ConceptId } from './concepts';
import type { FrameRef, PartRef } from './parts';

/** The twelve lessons, in course order (SYLLABUS §2). */
export type LessonId =
  | 'front.foundations.v1' | 'back.measure-altitude.v1' | 'front.local-sky.v1'
  | 'front.read-star.v1' | 'back.sun-place.v1' | 'solar.time-by-sun.v1'
  | 'solar.events.v1' | 'night.time-by-star.v1' | 'back.equation-time.v1'
  | 'front.unequal-hours.v1' | 'front.set-sky.v1' | 'back.shadow-square.v1';
export type Snapshot = Pick<AstrolabeState,
  'face' | 'location' | 'plateSelection' | 'plateLatitude' | 'reteRotation' |
  'ruleRotation' | 'alidadeRotation' | 'visibility' | 'epochIso'>;
export type RotationField = 'reteRotation' | 'ruleRotation' | 'alidadeRotation';
export type Predicate =
  | { kind: 'angleNear'; field: RotationField; value: number; tolerance: number }
  | {
    kind: 'frontGeometry';
    body: { raDeg: number; decDeg: number };
    position?: { altitude: number; azimuth: number; tolerance: number };
    rulePoint?: { raDeg: number; decDeg: number; tolerance: number };
  }
  | { kind: 'faceIs'; value: Face }
  /** Either end of the alidade crosses `value` degrees on a red altitude scale. */
  | { kind: 'alidadeAltitude'; value: number; tolerance: number }
  /** Either end of the alidade lies on the radial of ecliptic longitude `value` (the date line). */
  | { kind: 'alidadeLongitude'; value: number; tolerance: number }
  | { kind: 'plateIs'; latitude: number; tolerance: number }
  | { kind: 'allOf'; predicates: readonly Predicate[] };

/** A reading or prediction question. Not a function of the instrument state, so not a `Predicate`. */
export interface ChoiceOption { label: string; correct?: boolean; misconception?: string }
export interface ChoiceCheck { kind: 'choice'; prompt: string; options: readonly ChoiceOption[] }
export type LessonCheck = Predicate | ChoiceCheck;

export interface AngleMotion {
  field: RotationField;
  from: number;
  to: number;
}
/** A guide-performed motion. `durationMs` is the animation length (angle) or the pause before the swap (face, plate). */
export type AngleDemonstration = AngleMotion & { kind?: 'angle'; durationMs: number; companion?: AngleMotion };
export type FaceDemonstration = { kind: 'face'; to: Face; durationMs: number };
/** `from` defaults to the plate shown before the step opened. */
export type PlateDemonstration = { kind: 'plate'; to: number; from?: number; durationMs: number };
export type Demonstration = AngleDemonstration | FaceDemonstration | PlateDemonstration;

export type StepMode = 'demonstrate' | 'your-turn' | 'read' | 'explain';
export interface LessonStep {
  id: string;
  title: string;
  /** Why the step matters to the operation (shown above the instruction). */
  purpose: string;
  /** The instruction: the physical action and the part or scale to use. */
  body: string;
  /** The visible alignment or scale crossing that completes the step. */
  stopCue?: string;
  /** What the resulting position or reading means. */
  result: string;
  /** Parts of the instrument to emphasise while the step is open. */
  highlights: readonly PartRef[];
  /**
   * What Magnify (manual, and automatic on a phone) frames instead of the
   * highlights: the reading spot and, when it matters, the tool being moved
   * (e.g. 'alidade-edge', 'rule-edge'). Must be on the step's face.
   */
  frame?: readonly FrameRef[];
  snapshot: Snapshot;
  demonstration?: Demonstration;
  check?: LessonCheck;
  mode: StepMode;
  introduces: readonly ConceptId[];
  uses: readonly ConceptId[];
  /** Your-turn steps: the state patch that satisfies `check`. Never shown to the learner. */
  solution?: Partial<Snapshot>;
}
export interface Lesson {
  id: LessonId;
  version: 1;
  title: string;
  summary: string;
  prerequisites: readonly LessonId[];
  steps: readonly LessonStep[];
}
