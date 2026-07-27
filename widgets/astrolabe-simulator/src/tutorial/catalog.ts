import type { AstrolabeState } from '../store';
import { equatorialToHorizontal, localSiderealTime } from '../astro';
import { STARS } from '../data/stars';
import type { FutureTopic, Lesson, LessonStep, Snapshot } from './types';

const epochIso = '2026-07-14T12:00:00.000Z';
const lessonLocation = { label: 'London', lat: 51.5, lng: -0.12, manual: false } as const;
const sirius = STARS.find((star) => star.name === 'Sirius');
if (!sirius) throw new Error('Sirius is required by the known-star tutorial');
const siriusSidereal = localSiderealTime(new Date(epochIso), lessonLocation.lng);
const siriusObservation = equatorialToHorizontal(
  sirius.raDeg,
  sirius.decDeg,
  lessonLocation.lat,
  siriusSidereal,
);
export const SIRIUS_FIXTURE = {
  star: sirius,
  reteRotation: siriusSidereal,
  ruleRotation: siriusObservation.hourAngle,
  altitude: siriusObservation.altitude,
} as const;
const visibility: AstrolabeState['visibility'] = {
  almucantars: true, azimuths: true, unequalHours: true, ecliptic: true, stars: true,
  rule: true, tropics: true, calendar: true, zodiacScale: true, shadowSquare: true,
  backUnequalHours: true, equationOfTime: true, alidade: true,
};
const base = (face: 'front' | 'back', rotations: Partial<Pick<Snapshot, 'reteRotation' | 'ruleRotation' | 'alidadeRotation'>> = {}): Snapshot => ({
  face,
  location: { ...lessonLocation },
  plateSelection: 'pinned',
  plateLatitude: 51.5,
  reteRotation: rotations.reteRotation ?? 0,
  ruleRotation: rotations.ruleRotation ?? 0,
  alidadeRotation: rotations.alidadeRotation ?? 0,
  visibility: { ...visibility },
  epochIso,
});
const step = (id: string, title: string, body: string, target: LessonStep['target'], snapshot: Snapshot, result: string, extra: Partial<LessonStep> = {}): LessonStep =>
  ({ id, title, body, target, snapshot, result, ...extra });

export const LESSONS = [
  {
    id: 'front.parts.v1', version: 1, category: 'Orientation',
    title: 'Meet the front: fixed plate, moving sky, reading rule',
    summary: 'Learn which parts stay fixed and which turn, then reconstruct a reading.',
    steps: [
      step('meet-instrument', 'Meet the instrument', 'The mater holds the working parts. This lesson uses a fixed latitude plate, a moving rete, and a reading rule.', 'instrument', base('front'), 'The front is ready at the deterministic July 14, 2026 epoch.'),
      step('fixed-plate', 'Find the fixed plate', 'The plate carries the horizon, altitude circles, and azimuths for 51.5° north.', 'front.plate', base('front'), 'The plate remains fixed while the sky turns.'),
      step('moving-rete', 'Turn the moving sky', 'Replay turns the rete from 0° to 45° by the shortest path.', 'front.rete', base('front', { reteRotation: 45 }), 'The rete is at 45°.', { demonstration: { field: 'reteRotation', from: 0, to: 45, durationMs: 700 } }),
      step('reading-rule', 'Use the reading rule', 'The rule crosses the plate and rete without moving either engraving.', 'front.rule', base('front', { reteRotation: 45, ruleRotation: 90 }), 'The rule is at 90°.', { demonstration: { field: 'ruleRotation', from: 0, to: 90, durationMs: 700 } }),
      step('return-rete', 'Return the rete', 'Use the rete control, keyboard arrows, or drag to return it to 0°.', 'front.rete', base('front', { reteRotation: 45, ruleRotation: 90 }), 'The rete is back at 0°.', { check: { kind: 'angleNear', field: 'reteRotation', value: 0, tolerance: 2 } }),
      step('orientation-result', 'Orientation complete', 'You can now distinguish the fixed coordinate plate from the moving sky and reading edge.', 'instrument', base('front'), 'Result: plate fixed; rete and rule independently movable.'),
    ],
  },
  {
    id: 'front.align-star.v1', version: 1, category: 'Front operations',
    title: 'Align Sirius and read the altitude grid',
    summary: 'Stage a known-star observation and read a checked plate-grid result.',
    steps: [
      step('fixture', 'Set the observation', 'Use London, the 51.5° plate, and July 14, 2026 so the result is reproducible.', 'instrument', base('front'), 'The observation fixture is set.'),
      step('find-sirius', 'Find Sirius', 'Sirius is labelled on the rete; the rete carries it with the rotating sky.', 'front.star.sirius', base('front'), 'Sirius is identified on the rete.'),
      step('show-grid', 'Read the fixed grid', 'Altitude circles on the plate remain fixed beneath the star map.', 'front.altitude-grid', base('front'), 'The altitude grid is visible.'),
      step('rotate-sky', 'Align the sky', `Replay demonstrates the checked sidereal orientation of ${SIRIUS_FIXTURE.reteRotation.toFixed(1)}°.`, 'front.rete', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation }), `The rete is at ${SIRIUS_FIXTURE.reteRotation.toFixed(1)}°.`, { demonstration: { field: 'reteRotation', from: 0, to: SIRIUS_FIXTURE.reteRotation, durationMs: 800 } }),
      step('move-rule', 'Place the rule', `Move the rule to ${SIRIUS_FIXTURE.ruleRotation.toFixed(1)}° so its edge passes through Sirius.`, 'front.rule', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation }), 'The rule passes through Sirius.', { check: { kind: 'angleNear', field: 'ruleRotation', value: SIRIUS_FIXTURE.ruleRotation, tolerance: 2 } }),
      step('read-altitude', 'Read the altitude', 'Follow the rule to the fixed altitude circle under Sirius.', 'front.altitude-grid', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation, ruleRotation: SIRIUS_FIXTURE.ruleRotation }), `Sirius is approximately ${Math.round(SIRIUS_FIXTURE.altitude)}° above the horizon.`),
      step('interpret', 'Interpret the reading', 'This is a geometric fixture reading; refraction and precession are outside this compact model.', 'front.star.sirius', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation, ruleRotation: SIRIUS_FIXTURE.ruleRotation }), `Textual result: Sirius altitude ≈ ${SIRIUS_FIXTURE.altitude.toFixed(1)}°.`),
      step('sirius-result', 'Known-star result', 'The star, rule, and plate now agree on the checked reading.', 'instrument', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation, ruleRotation: SIRIUS_FIXTURE.ruleRotation }), `Result: Sirius altitude approximately ${Math.round(SIRIUS_FIXTURE.altitude)}°.`),
    ],
  },
  {
    id: 'back.unequal-hours.v1', version: 1, category: 'Back operations',
    title: 'Read a temporal hour on the double horary quadrant',
    summary: 'Reproduce the documented traditional July 14 unequal-hour construction.',
    steps: [
      step('turn-back', 'Turn to the back', 'The back carries the altitude scale, double horary quadrant, and alidade.', 'instrument', base('back'), 'The back face is shown.'),
      step('find-altitude', 'Find the altitude scale', 'The red outer numbers read altitude from the horizon toward the zenith.', 'back.altitude-scale', base('back'), 'The altitude scale is identified.'),
      step('noon-altitude', 'Set noon altitude', 'Replay demonstrates setting the alidade to the fixture’s 70° noon solar altitude.', 'back.alidade', base('back', { alidadeRotation: 70 }), 'Noon altitude is 70°.', { demonstration: { field: 'alidadeRotation', from: 0, to: 70, durationMs: 700 }, check: { kind: 'angleNear', field: 'alidadeRotation', value: 70, tolerance: 1 } }),
      step('curve-six', 'Locate curve VI', 'Curve VI is the noon divider shared by the mirrored morning and afternoon sequences.', 'back.horary.vi', base('back', { alidadeRotation: 70 }), 'Curve VI supplies the pivot distance.'),
      step('transfer-distance', 'Transfer the pivot distance', 'Keep the curve-VI crossing’s distance from the center; this is the traditional geometric transfer.', 'back.horary.vi', base('back', { alidadeRotation: 70 }), 'The curve-VI pivot distance is retained.'),
      step('observed-altitude', 'Set observed altitude', 'Replay demonstrates moving the alidade to the documented observed altitude of 27.5°.', 'back.alidade', base('back', { alidadeRotation: 27.5 }), 'Observed altitude is 27.5°.', { demonstration: { field: 'alidadeRotation', from: 70, to: 27.5, durationMs: 700 }, check: { kind: 'angleNear', field: 'alidadeRotation', value: 27.5, tolerance: 1 } }),
      step('choose-afternoon', 'Choose the afternoon sequence', 'After noon, read the mirrored VI–XII labels on the right-hand sequence.', 'back.horary.vi', base('back', { alidadeRotation: 27.5 }), 'The afternoon sequence is selected.'),
      step('interpolate-hour', 'Interpolate the curve', 'The transferred point lies near hour X. Historical interpolation between engraved curves is approximate.', 'back.horary.vi', base('back', { alidadeRotation: 27.5 }), 'Approximate temporal hour X after noon.'),
      step('unequal-result', 'Unequal-hour result', 'The 70° noon and 27.5° observed-altitude construction gives a traditional approximate reading.', 'instrument', base('back', { alidadeRotation: 27.5 }), 'Result: approximately temporal hour X after noon.'),
    ],
  },
] as const satisfies readonly Lesson[];

export const FUTURE_TOPICS: readonly FutureTopic[] = [
  { category: 'Setup and construction', title: 'Choose a plate and quantify mismatch', prerequisite: 'Needs stable checkpoint and readout APIs.' },
  { category: 'Setup and construction', title: 'Compare two latitude plates', prerequisite: 'Needs deterministic comparison snapshots.' },
  { category: 'Setup and construction', title: 'Southern-hemisphere construction', prerequisite: 'Needs southern geometry; current plates are northern only.' },
  { category: 'Front astronomy', title: 'Find date/time from a known star', prerequisite: 'Needs observation inputs and a validated solver.' },
  { category: 'Front astronomy', title: 'Determine sunrise and sunset', prerequisite: 'Needs date input, event solving, and a refraction policy.' },
  { category: 'Front astronomy', title: 'Read front unequal hours', prerequisite: 'Needs targetable curves and a checked readout.' },
  { category: 'Front astronomy', title: 'Locate the Sun for an arbitrary date', prerequisite: 'Needs user epoch controls and fixture validation.' },
  { category: 'Front astronomy', title: 'Predict star rise and set', prerequisite: 'Needs precession and time calculations.' },
  { category: 'Back calculations', title: 'Convert calendar date to zodiac longitude', prerequisite: 'Needs a date cursor and computed readout.' },
  { category: 'Back calculations', title: 'Use the equation-of-time loop', prerequisite: 'Needs date selection and validated lookup semantics.' },
  { category: 'Back calculations', title: 'Measure height with the shadow square', prerequisite: 'Needs physical baseline input and a result calculation.' },
  { category: 'Assessment and tools', title: 'Freeform measurement markers', prerequisite: 'Needs persistent accessible annotations.' },
  { category: 'Assessment and tools', title: 'Branching assessment and saved answers', prerequisite: 'Needs a versioned branching and privacy policy.' },
];

export function validateCatalog(lessons: readonly Lesson[] = LESSONS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const lesson of lessons) {
    if (!/^[a-z]+(?:[.-][a-z]+)*\.v\d+$/.test(lesson.id)) errors.push(`Malformed lesson ID: ${lesson.id}`);
    if (!lesson.title.trim() || !lesson.summary.trim() || lesson.steps.length === 0) errors.push(`Incomplete lesson: ${lesson.id}`);
    if (ids.has(lesson.id)) errors.push(`Duplicate ID: ${lesson.id}`); ids.add(lesson.id);
    const stepIds = new Set<string>();
    for (const item of lesson.steps) {
      if (!/^[a-z][a-z0-9-]*$/.test(item.id) || stepIds.has(item.id)) errors.push(`Invalid step: ${lesson.id}/${item.id}`);
      stepIds.add(item.id);
      if (!item.title.trim() || !item.body.trim() || !item.result.trim()) errors.push(`Empty content: ${lesson.id}/${item.id}`);
      for (const value of [item.snapshot.plateLatitude, item.snapshot.reteRotation, item.snapshot.ruleRotation, item.snapshot.alidadeRotation]) {
        if (!Number.isFinite(value)) errors.push(`Non-finite snapshot: ${lesson.id}/${item.id}`);
      }
      if (Number.isNaN(Date.parse(item.snapshot.epochIso))) errors.push(`Invalid epoch: ${lesson.id}/${item.id}`);
    }
  }
  return errors;
}
