import type { AstrolabeState } from '../store';
import { equatorialToHorizontal, localSiderealTime, normalizeDeg, solarLongitude } from '../astro';
import { eclipticPoint } from '../geometry';
import { STARS } from '../data/stars';
import type { FutureTopic, Lesson, LessonStep, Snapshot } from './types';

const epochIso = '2026-07-14T12:00:00.000Z';
const lessonLocation = { label: 'London', lat: 51.5, lng: -0.12, manual: false } as const;
const sirius = STARS.find((star) => star.name === 'Sirius');
if (!sirius) throw new Error('Sirius is required by the known-star tutorial');
const siriusSidereal = localSiderealTime(new Date(epochIso), lessonLocation.lng);
const sunLongitude = solarLongitude(new Date(epochIso));
const sunPoint = eclipticPoint(sunLongitude, 380);
const rotatedSun = {
  x: sunPoint.x * Math.cos(siriusSidereal * Math.PI / 180) - sunPoint.y * Math.sin(siriusSidereal * Math.PI / 180),
  y: sunPoint.x * Math.sin(siriusSidereal * Math.PI / 180) + sunPoint.y * Math.cos(siriusSidereal * Math.PI / 180),
};
export const SUN_FIXTURE = {
  eclipticLongitude: sunLongitude,
  reteRotation: siriusSidereal,
  ruleRotation: normalizeDeg(Math.atan2(-rotatedSun.x, rotatedSun.y) * 180 / Math.PI),
} as const;
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
  azimuth: siriusObservation.azimuth,
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
    title: 'Locate a star at a given date and time',
    summary: 'Set the sky from the calendar and time scales, then locate Sirius and read its position.',
    steps: [
      step('choose-observation', 'Choose the place, date, and time', 'Use London on July 14, 2026, at 11:54 local apparent solar time. The 51.5° plate supplies London’s local horizon and altitude grid.', 'instrument', base('back'), 'The place, plate, date, and solar time for the example are known.'),
      step('find-date', 'Find the date on the calendar', 'On the back, find July 14 on the calendar ring. A radial line from the center through that date continues into the adjacent ecliptic-longitude scale.', 'back.calendar', base('back'), 'July 14 is located on the calendar ring.'),
      step('read-sun-longitude', 'Read the Sun’s ecliptic longitude', `Follow the July 14 radial line to about ${SUN_FIXTURE.eclipticLongitude.toFixed(1)}° on the adjacent scale. This is the Sun’s ecliptic longitude: its position around the ecliptic measured from 0° to 360°.`, 'back.ecliptic-longitude', base('back', { alidadeRotation: SUN_FIXTURE.eclipticLongitude }), `The Sun’s ecliptic longitude is about ${SUN_FIXTURE.eclipticLongitude.toFixed(1)}°.`, { demonstration: { field: 'alidadeRotation', from: 0, to: SUN_FIXTURE.eclipticLongitude, durationMs: 700 } }),
      step('find-sun-point', 'Find the same longitude on the front', `Turn to the front and find ${SUN_FIXTURE.eclipticLongitude.toFixed(1)}° on the rete’s ecliptic ring. The Sun marker shows this point for the selected date.`, 'front.sun', base('front'), 'The Sun’s date position is identified on the ecliptic ring.'),
      step('set-time', 'Set the rule to the time', 'Place the rule at 11:54 on the limb’s 24-hour scale. Keep the rule there: it now represents the requested local apparent solar time.', 'front.rule', base('front', { ruleRotation: SUN_FIXTURE.ruleRotation }), 'The rule marks 11:54 local apparent solar time.', { demonstration: { field: 'ruleRotation', from: 90, to: SUN_FIXTURE.ruleRotation, durationMs: 700 } }),
      step('set-sky', 'Set the sky', 'Rotate the rete until the Sun marker for July 14 lies under the rule. Do not move the rule. This alignment orients the whole star map for the chosen date and time.', 'front.rete', base('front', { reteRotation: 0, ruleRotation: SUN_FIXTURE.ruleRotation }), 'The Sun marker and time rule are aligned, so the sky is set.', { demonstration: { field: 'reteRotation', from: 0, to: SUN_FIXTURE.reteRotation, durationMs: 800 }, check: { kind: 'angleNear', field: 'reteRotation', value: SUN_FIXTURE.reteRotation, tolerance: 2 } }),
      step('find-sirius', 'Locate Sirius', 'Find the Sirius pointer on the rete. Because the entire rete is now set, the pointer shows where Sirius lies in London’s sky at the chosen date and time.', 'front.star.sirius', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), 'Sirius is located on the set star map.'),
      step('read-position', 'Read Sirius on the plate', 'Read the fixed altitude and azimuth curves beneath the Sirius pointer. It lies just above the southern meridian.', 'front.altitude-grid', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), `Sirius is approximately ${SIRIUS_FIXTURE.altitude.toFixed(1)}° above the horizon at azimuth ${SIRIUS_FIXTURE.azimuth.toFixed(1)}°.`),
      step('sirius-result', 'Interpret the result', 'Sirius is above the horizon and slightly west of due south. The date and time set the entire sky; Sirius was read from that setting rather than aligned independently.', 'instrument', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), `Sirius is located at approximately ${SIRIUS_FIXTURE.altitude.toFixed(1)}° altitude and ${SIRIUS_FIXTURE.azimuth.toFixed(1)}° azimuth.`),
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
  { category: 'Front astronomy', title: 'Find the Sun’s ecliptic longitude for any date', prerequisite: 'Planned: choose a date and transfer it from the calendar scale to degrees of ecliptic longitude.' },
  { category: 'Front astronomy', title: 'Predict when a star rises and sets', prerequisite: 'Planned: follow a chosen star to the eastern and western horizon.' },
  { category: 'Back calculations', title: 'Convert a calendar date to ecliptic longitude', prerequisite: 'Planned: follow a chosen date to its degree on the adjacent ecliptic-longitude scale.' },
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
