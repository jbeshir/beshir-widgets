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
      step('meet-instrument', 'Meet the instrument', 'The mater holds the working parts. This lesson uses a fixed latitude plate, a moving rete, and a reading rule.', 'instrument', base('front'), 'The front is set for London at noon on July 14, 2026.'),
      step('fixed-plate', 'Find the fixed plate', 'The plate carries the horizon, altitude circles, and azimuths for 51.5° north.', 'front.plate', base('front'), 'The plate remains fixed while the sky turns.'),
      step('moving-rete', 'Turn the moving sky', 'Rotate the rete to 45°. The star map turns over the fixed latitude plate, placing the sky in a new orientation.', 'front.rete', base('front', { reteRotation: 45 }), 'The rete is at 45° while the plate remains fixed.', { demonstration: { field: 'reteRotation', from: 0, to: 45, durationMs: 700 } }),
      step('reading-rule', 'Use the reading rule', 'Rotate the rule to 90°. It provides a reading edge across the plate and rete without moving either engraving.', 'front.rule', base('front', { reteRotation: 45, ruleRotation: 90 }), 'The rule is at 90°, independently of the rete.', { demonstration: { field: 'ruleRotation', from: 0, to: 90, durationMs: 700 } }),
      step('return-rete', 'Return the rete', 'Use the rete control, keyboard arrows, or drag to return it to 0°.', 'front.rete', base('front', { reteRotation: 45, ruleRotation: 90 }), 'The rete is back at 0°.', { check: { kind: 'angleNear', field: 'reteRotation', value: 0, tolerance: 2 } }),
      step('orientation-result', 'Orientation complete', 'You can now distinguish the fixed coordinate plate from the moving sky and reading edge.', 'instrument', base('front'), 'Result: plate fixed; rete and rule independently movable.'),
    ],
  },
  {
    id: 'front.align-star.v1', version: 1, category: 'Front operations',
    title: 'Read a star’s position on a prepared astrolabe',
    summary: 'Use a prepared sky setting to find Sirius and read the star’s altitude. A later lesson will teach how to set the sky from a date and time.',
    steps: [
      step('fixture', 'Start from a prepared setting', 'This example begins with the astrolabe prepared for London at noon on July 14, 2026. Here you will practise reading the star map; a later lesson will teach the separate operation of setting the sky from a date and time.', 'instrument', base('front'), 'The prepared astrolabe is ready for the reading exercise.'),
      step('find-sirius', 'Find Sirius', 'Sirius is labelled on the rete; the rete carries it with the rotating sky.', 'front.star.sirius', base('front'), 'Sirius is identified on the rete.'),
      step('show-grid', 'Read the fixed grid', 'Altitude circles on the plate remain fixed beneath the star map.', 'front.altitude-grid', base('front'), 'The altitude grid is visible.'),
      step('rotate-sky', 'Set the sky for the observation', `Rotate the rete to ${SIRIUS_FIXTURE.reteRotation.toFixed(1)}°. This places the star map over the fixed plate for the example place and time.`, 'front.rete', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation }), `The sky is oriented with the rete at ${SIRIUS_FIXTURE.reteRotation.toFixed(1)}°.`, { demonstration: { field: 'reteRotation', from: 0, to: SIRIUS_FIXTURE.reteRotation, durationMs: 800 } }),
      step('move-rule', 'Place the rule', `Move the rule to ${SIRIUS_FIXTURE.ruleRotation.toFixed(1)}° so its edge passes through Sirius.`, 'front.rule', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation }), 'The rule passes through Sirius.', { check: { kind: 'angleNear', field: 'ruleRotation', value: SIRIUS_FIXTURE.ruleRotation, tolerance: 2 } }),
      step('read-altitude', 'Read the altitude', 'At Sirius, read the fixed altitude circle beneath the star pointer. The rule helps you keep your place while you trace the reading to the labelled grid.', 'front.altitude-grid', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation, ruleRotation: SIRIUS_FIXTURE.ruleRotation }), `Sirius is approximately ${Math.round(SIRIUS_FIXTURE.altitude)}° above the horizon.`),
      step('sirius-result', 'Interpret the reading', 'The star pointer lies near the 21° altitude circle, so Sirius is about 21° above the horizon in this example. The simulator omits small corrections such as atmospheric refraction and the slow change in star positions over centuries.', 'instrument', base('front', { reteRotation: SIRIUS_FIXTURE.reteRotation, ruleRotation: SIRIUS_FIXTURE.ruleRotation }), `Sirius has an altitude of approximately ${SIRIUS_FIXTURE.altitude.toFixed(1)}°.`),
    ],
  },
  {
    id: 'back.unequal-hours.v1', version: 1, category: 'Back operations',
    title: 'Read a temporal hour on the double horary quadrant',
    summary: 'Reproduce the documented traditional July 14 unequal-hour construction.',
    steps: [
      step('turn-back', 'Turn to the back', 'The back carries the altitude scale, double horary quadrant, and alidade.', 'instrument', base('back'), 'The back face is shown.'),
      step('find-altitude', 'Find the altitude scale', 'The red outer numbers read altitude from the horizon toward the zenith.', 'back.altitude-scale', base('back'), 'The altitude scale is identified.'),
      step('noon-altitude', 'Set noon altitude', 'Rotate the alidade until its reading edge meets 70° on the outer altitude scale, the Sun’s noon altitude in this example.', 'back.alidade', base('back', { alidadeRotation: 70 }), 'The alidade marks a noon altitude of 70°.', { demonstration: { field: 'alidadeRotation', from: 0, to: 70, durationMs: 700 }, check: { kind: 'angleNear', field: 'alidadeRotation', value: 70, tolerance: 1 } }),
      step('curve-six', 'Locate curve VI', 'Curve VI is the noon divider shared by the mirrored morning and afternoon sequences.', 'back.horary.vi', base('back', { alidadeRotation: 70 }), 'Curve VI supplies the pivot distance.'),
      step('transfer-distance', 'Remember the noon crossing', 'Note how far the alidade’s reading edge crosses curve VI from the center. You will find that same distance again after setting the observed altitude; its new position indicates the temporal hour.', 'back.horary.vi', base('back', { alidadeRotation: 70 }), 'The distance from the center to the noon crossing is the distance to carry into the next reading.'),
      step('observed-altitude', 'Set observed altitude', 'Rotate the alidade until its reading edge meets 27.5° on the outer altitude scale. Then locate the point on that edge at the same distance from the center as the noon crossing.', 'back.alidade', base('back', { alidadeRotation: 27.5 }), 'The alidade marks 27.5°, ready for the transferred-distance reading.', { demonstration: { field: 'alidadeRotation', from: 70, to: 27.5, durationMs: 700 }, check: { kind: 'angleNear', field: 'alidadeRotation', value: 27.5, tolerance: 1 } }),
      step('choose-afternoon', 'Choose the afternoon sequence', 'After noon, read the mirrored VI–XII labels on the right-hand sequence.', 'back.horary.vi', base('back', { alidadeRotation: 27.5 }), 'The afternoon sequence is selected.'),
      step('interpolate-hour', 'Interpolate the curve', 'The transferred point lies near hour X. Historical interpolation between engraved curves is approximate.', 'back.horary.vi', base('back', { alidadeRotation: 27.5 }), 'Approximate temporal hour X after noon.'),
      step('unequal-result', 'Unequal-hour result', 'The 70° noon and 27.5° observed-altitude construction gives a traditional approximate reading.', 'instrument', base('back', { alidadeRotation: 27.5 }), 'Result: approximately temporal hour X after noon.'),
    ],
  },
] as const satisfies readonly Lesson[];

export const FUTURE_TOPICS: readonly FutureTopic[] = [
  { category: 'Setup and construction', title: 'Choose a plate and understand latitude mismatch', prerequisite: 'Planned: compare your latitude with the available plates and estimate the effect on a reading.' },
  { category: 'Setup and construction', title: 'Compare two latitude plates', prerequisite: 'Planned: make the same reading on two plates and compare the difference.' },
  { category: 'Setup and construction', title: 'Southern-hemisphere construction', prerequisite: 'Unavailable with the current northern-hemisphere plates.' },
  { category: 'Front astronomy', title: 'Find date and time from a known star', prerequisite: 'Planned: enter a measured star position and work backwards to a date and time.' },
  { category: 'Front astronomy', title: 'Determine sunrise and sunset', prerequisite: 'Planned: choose a date and follow the Sun to the horizon.' },
  { category: 'Front astronomy', title: 'Read front unequal hours', prerequisite: 'Planned: use the Sun’s ecliptic position with the unequal-hour curves below the horizon.' },
  { category: 'Front astronomy', title: 'Locate the Sun for any date', prerequisite: 'Planned: choose a date and place the Sun at its corresponding point on the ecliptic.' },
  { category: 'Front astronomy', title: 'Predict when a star rises and sets', prerequisite: 'Planned: follow a chosen star to the eastern and western horizon.' },
  { category: 'Back calculations', title: 'Convert a calendar date to zodiac longitude', prerequisite: 'Planned: align a chosen date with the adjacent zodiac scale.' },
  { category: 'Back calculations', title: 'Use the equation-of-time loop', prerequisite: 'Planned: choose a date and read the difference between apparent and mean solar time.' },
  { category: 'Back calculations', title: 'Measure height with the shadow square', prerequisite: 'Planned: enter a known distance and turn the observed shadow ratio into a height.' },
  { category: 'Assessment and tools', title: 'Place your own measurement markers', prerequisite: 'Planned: mark positions on the instrument and return to them while practising.' },
  { category: 'Assessment and tools', title: 'Check your understanding', prerequisite: 'Planned: answer guided questions and revisit the steps that need more practice.' },
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
