import type { AstrolabeState } from '../store';
import { equatorialToHorizontal, localSiderealTime, normalizeDeg, solarLongitude } from '../astro';
import { eclipticPoint, orientRetePoint } from '../geometry';
import { alidadeRotationForLongitude } from '../backGeometry';
import { STARS } from '../data/stars';
import type { FutureTopic, Lesson, LessonStep, Snapshot } from './types';

const epochIso = '2026-07-14T12:00:00.000Z';
const lessonLocation = { label: 'London', lat: 51.5, lng: -0.12, manual: false } as const;
const sirius = STARS.find((star) => star.name === 'Sirius');
if (!sirius) throw new Error('Sirius is required by the known-star tutorial');
const siriusSidereal = localSiderealTime(new Date(epochIso), lessonLocation.lng);
const sunLongitude = solarLongitude(new Date(epochIso));
const sunPoint = eclipticPoint(sunLongitude, 380);
const rotatedSun = orientRetePoint(sunPoint, siriusSidereal);
export const SUN_FIXTURE = {
  eclipticLongitude: sunLongitude,
  alidadeRotation: alidadeRotationForLongitude(sunLongitude),
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
  ruleRotation: normalizeDeg(-siriusObservation.hourAngle),
  altitude: siriusObservation.altitude,
  azimuth: siriusObservation.azimuth,
} as const;
const latitudeRad = lessonLocation.lat * Math.PI / 180;
const declinationRad = sirius.decDeg * Math.PI / 180;
const horizonHourAngle = Math.acos(-Math.tan(latitudeRad) * Math.tan(declinationRad)) * 180 / Math.PI;
const ruleRotationForSidereal = (reteRotation: number) => {
  const point = orientRetePoint(sunPoint, reteRotation);
  return normalizeDeg(Math.atan2(-point.x, point.y) * 180 / Math.PI);
};
const pathEvent = (reteRotation: number) => {
  const observation = equatorialToHorizontal(sirius.raDeg, sirius.decDeg, lessonLocation.lat, reteRotation);
  return {
    reteRotation: normalizeDeg(reteRotation),
    ruleRotation: ruleRotationForSidereal(reteRotation),
    altitude: observation.altitude,
    azimuth: observation.azimuth,
  };
};
export const SIRIUS_PATH_FIXTURE = {
  rising: pathEvent(sirius.raDeg - horizonHourAngle),
  culmination: pathEvent(sirius.raDeg),
  setting: pathEvent(sirius.raDeg + horizonHourAngle),
} as const;
const visibility: AstrolabeState['visibility'] = {
  almucantars: true, azimuths: true, unequalHours: true, ecliptic: true, artificialAssists: false, stars: true,
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
const plateSnapshot = (plateLatitude: number): Snapshot => ({ ...base('front'), plateLatitude });
const step = (id: string, title: string, body: string, target: LessonStep['target'], snapshot: Snapshot, result: string, extra: Partial<LessonStep> = {}): LessonStep =>
  ({ id, title, body, target, snapshot, result, ...extra });

export const LESSONS = [
  {
    id: 'front.foundations.v1', version: 1, category: 'Foundations',
    title: 'Understand and configure the astrolabe front',
    summary: 'Identify the fixed and moving parts, then choose the latitude plate used for a reading.',
    steps: [
      step('meet-instrument', 'Meet the instrument', 'The mater holds the working parts. On the front, a latitude plate supplies local coordinates, the rete carries the star map, and the rule provides a straight reading edge.', 'instrument', base('front'), 'The front is set for London at noon on July 14, 2026.'),
      step('fixed-plate', 'Find the fixed plate', 'The plate carries the horizon, altitude circles, and azimuths for 51.5° north.', 'front.plate', base('front'), 'The plate remains fixed while the sky turns.'),
      step('moving-rete', 'Turn the moving sky', 'Rotate the rete to 45°. The star map turns over the fixed latitude plate, placing the sky in a new orientation.', 'front.rete', base('front', { reteRotation: 45 }), 'The rete is at 45° while the plate remains fixed.', { demonstration: { field: 'reteRotation', from: 0, to: 45, durationMs: 700 }, check: { kind: 'angleNear', field: 'reteRotation', value: 45, tolerance: 2 } }),
      step('reading-rule', 'Use the reading rule', 'Rotate the rule to 90°. It provides a reading edge across the plate and rete without moving either engraving.', 'front.rule', base('front', { reteRotation: 45, ruleRotation: 90 }), 'The rule is at 90°, independently of the rete.', { demonstration: { field: 'ruleRotation', from: 0, to: 90, durationMs: 700 }, check: { kind: 'angleNear', field: 'ruleRotation', value: 90, tolerance: 2 } }),
      step('return-rete', 'Return the rete', 'Use the rete control, keyboard arrows, or drag to return it to 0°.', 'front.rete', base('front', { reteRotation: 45, ruleRotation: 90 }), 'The rete is back at 0°.', { check: { kind: 'angleNear', field: 'reteRotation', value: 0, tolerance: 2 } }),
      step('choose-plate', 'Choose the latitude plate', 'Select Exact 51.5° for London. A plate’s horizon and coordinate curves are constructed for one latitude, so this choice controls how the rete is read.', 'setup.plate', plateSnapshot(51.5), 'The exact 51.5° plate matches London.'),
      step('compare-mismatch', 'See what a nearby plate changes', 'Now compare the 50° plate. Its star map is unchanged, but its local horizon, altitude, and azimuth curves are 1.5° away from London’s latitude.', 'setup.plate-mismatch', plateSnapshot(50), 'The mismatch warning quantifies the 1.5° latitude difference.'),
      step('restore-plate', 'Restore the exact plate', 'Return to Exact 51.5° before making observations for London.', 'setup.plate', plateSnapshot(51.5), 'The plate and observation latitude match again.'),
      step('foundations-result', 'Foundations complete', 'You can distinguish the fixed local-coordinate plate from the independently moving rete and rule, and choose a plate appropriate to the observer’s latitude.', 'instrument', base('front'), 'Result: the instrument is configured with London’s exact latitude plate.'),
    ],
  },
  {
    id: 'front.set-sky.v1', version: 1, category: 'Front operations',
    title: 'Set the astrolabe for a date and time',
    summary: 'Convert a calendar date to ecliptic longitude, set the time, and orient the rete.',
    steps: [
      step('choose-observation', 'Choose the place, date, and time', 'Use London on July 14, 2026, at 11:54 local apparent solar time. The 51.5° plate supplies London’s local horizon and altitude grid.', 'instrument', base('back'), 'The place, plate, date, and solar time for the example are known.'),
      step('find-date', 'Find the date on the calendar', 'Rotate the alidade until the straight inner edge of one arm runs from the center through July 14 on the inner calendar ring. Its daily notches restart at 5, 10, 15, and so on within each unequal-width month.', 'back.calendar', base('back', { alidadeRotation: SUN_FIXTURE.alidadeRotation }), 'The alidade’s inner edge passes through July 14 on the fixed 365-day calendar ring.', { demonstration: { field: 'alidadeRotation', from: 0, to: SUN_FIXTURE.alidadeRotation, durationMs: 700 }, check: { kind: 'angleNear', field: 'alidadeRotation', value: SUN_FIXTURE.alidadeRotation, tolerance: 1 } }),
      step('read-sun-longitude', 'Read the Sun’s ecliptic longitude', `Keep the alidade fixed on July 14. Continue along its inner edge across the zodiac-sign band to the degree scale on the band’s outer side, where the edge meets about ${SUN_FIXTURE.eclipticLongitude.toFixed(1)}°. This is the Sun’s ecliptic longitude: its position around the ecliptic measured from 0° to 360°.`, 'back.ecliptic-longitude', base('back', { alidadeRotation: SUN_FIXTURE.alidadeRotation }), `The alidade’s inner edge carries July 14 across the zodiac band to an ecliptic longitude of about ${SUN_FIXTURE.eclipticLongitude.toFixed(1)}°.`),
      step('find-sun-point', 'Find the same longitude on the front', `Turn to the front and find ${SUN_FIXTURE.eclipticLongitude.toFixed(1)}° on the rete’s engraved ecliptic-longitude scale. Interpolate between the half-degree marks to identify the point for July 14.`, 'front.ecliptic', base('front'), 'The date’s ecliptic-longitude point is identified on the rete.'),
      step('set-time', 'Set the rule to the time', 'Place the rule at 11:54 on the limb’s 24-hour scale. Keep the rule there: it now represents the requested local apparent solar time.', 'front.rule', base('front', { ruleRotation: SUN_FIXTURE.ruleRotation }), 'The rule marks 11:54 local apparent solar time.', { demonstration: { field: 'ruleRotation', from: 90, to: SUN_FIXTURE.ruleRotation, durationMs: 700 }, check: { kind: 'angleNear', field: 'ruleRotation', value: SUN_FIXTURE.ruleRotation, tolerance: 2 } }),
      step('set-sky', 'Set the sky', `Rotate the rete until the ${SUN_FIXTURE.eclipticLongitude.toFixed(1)}° point you identified lies under the rule. Do not move the rule. This alignment orients the whole star map for the chosen date and time.`, 'front.rete', base('front', { reteRotation: 0, ruleRotation: SUN_FIXTURE.ruleRotation }), 'The date’s ecliptic-longitude point and time rule are aligned, so the sky is set.', { demonstration: { field: 'reteRotation', from: 0, to: SUN_FIXTURE.reteRotation, durationMs: 800 }, check: { kind: 'angleNear', field: 'reteRotation', value: SUN_FIXTURE.reteRotation, tolerance: 2 } }),
      step('setting-result', 'Date and time set', 'The rule fixes the requested time and the date’s ecliptic-longitude point lies beneath it. Every star on the rete now represents its position for this place, date, and time.', 'instrument', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), 'Result: the sky is set for London on July 14, 2026, at 11:54 local apparent solar time.'),
    ],
  },
  {
    id: 'front.read-star.v1', version: 1, category: 'Front operations',
    title: 'Read a star and follow its daily path',
    summary: 'Read Sirius from a known date-and-time setting, then follow it from rising to setting.',
    steps: [
      step('start-setting', 'Begin with a known setting', 'Use the London, July 14, 11:54 setting established in the preceding lesson: the rule marks the time and the date’s ecliptic-longitude point lies beneath it.', 'instrument', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), 'The whole rete represents London’s sky at the chosen date and time.'),
      step('find-sirius', 'Locate Sirius', 'Find Sirius on the rete. It is a star marker carried by the rotating map, not a separate pointer or control.', 'front.star.sirius', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), 'Sirius is identified on the set star map.'),
      step('read-position', 'Read Sirius on the plate', 'Read the fixed altitude and azimuth curves beneath Sirius. It lies just above the southern meridian.', 'front.altitude-grid', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), `Sirius is approximately ${SIRIUS_FIXTURE.altitude.toFixed(1)}° above the horizon at azimuth ${SIRIUS_FIXTURE.azimuth.toFixed(1)}°.`),
      step('interpret-position', 'Interpret the position', 'Altitude measures height above the horizon. Azimuth measures direction clockwise from north, so a value just over 180° places Sirius slightly west of due south.', 'instrument', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SUN_FIXTURE.ruleRotation }), `At this setting, Sirius is above the horizon at altitude ${SIRIUS_FIXTURE.altitude.toFixed(1)}° and azimuth ${SIRIUS_FIXTURE.azimuth.toFixed(1)}°.`),
      step('follow-rising', 'Follow Sirius to rising', 'Move the time rule earlier while keeping July 14’s ecliptic-longitude point beneath it, turning the rete with the rule until Sirius reaches the eastern horizon.', 'front.star.sirius', base('front', { reteRotation: SUN_FIXTURE.reteRotation, ruleRotation: SIRIUS_PATH_FIXTURE.rising.ruleRotation }), `Sirius rises near azimuth ${SIRIUS_PATH_FIXTURE.rising.azimuth.toFixed(1)}° east of north.`, { demonstration: { field: 'reteRotation', from: SUN_FIXTURE.reteRotation, to: SIRIUS_PATH_FIXTURE.rising.reteRotation, durationMs: 900 }, check: { kind: 'angleNear', field: 'reteRotation', value: SIRIUS_PATH_FIXTURE.rising.reteRotation, tolerance: 2 } }),
      step('follow-culmination', 'Follow Sirius to culmination', 'Continue turning the rule and rete together, always keeping the date point beneath the rule. Sirius culminates when it crosses the meridian and reaches its greatest altitude.', 'front.star.sirius', base('front', { reteRotation: SIRIUS_PATH_FIXTURE.rising.reteRotation, ruleRotation: SIRIUS_PATH_FIXTURE.culmination.ruleRotation }), `At culmination, Sirius is due south at altitude ${SIRIUS_PATH_FIXTURE.culmination.altitude.toFixed(1)}°.`, { demonstration: { field: 'reteRotation', from: SIRIUS_PATH_FIXTURE.rising.reteRotation, to: SIRIUS_PATH_FIXTURE.culmination.reteRotation, durationMs: 900 }, check: { kind: 'angleNear', field: 'reteRotation', value: SIRIUS_PATH_FIXTURE.culmination.reteRotation, tolerance: 2 } }),
      step('follow-setting', 'Follow Sirius to setting', 'Continue the same coupled motion until Sirius reaches the western horizon. The rule’s position on the limb gives the corresponding local apparent solar time.', 'front.star.sirius', base('front', { reteRotation: SIRIUS_PATH_FIXTURE.culmination.reteRotation, ruleRotation: SIRIUS_PATH_FIXTURE.setting.ruleRotation }), `Sirius sets near azimuth ${SIRIUS_PATH_FIXTURE.setting.azimuth.toFixed(1)}° west of north.`, { demonstration: { field: 'reteRotation', from: SIRIUS_PATH_FIXTURE.culmination.reteRotation, to: SIRIUS_PATH_FIXTURE.setting.reteRotation, durationMs: 900 }, check: { kind: 'angleNear', field: 'reteRotation', value: SIRIUS_PATH_FIXTURE.setting.reteRotation, tolerance: 2 } }),
      step('path-result', 'Daily path complete', 'A star’s marker stays fixed on the rete. Turning the rete through time carries it across the plate’s eastern horizon, meridian, and western horizon.', 'instrument', base('front', { reteRotation: SIRIUS_PATH_FIXTURE.setting.reteRotation, ruleRotation: SIRIUS_PATH_FIXTURE.setting.ruleRotation }), 'Result: Sirius has been followed from rising through culmination to setting.'),
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
  { category: 'Solar operations', title: 'Determine sunrise, noon, and sunset', prerequisite: 'Planned: choose a date and follow the Sun from the eastern horizon through culmination to the western horizon.' },
  { category: 'Solar operations', title: 'Read unequal hours on the front', prerequisite: 'Planned: use the Sun’s ecliptic-longitude point with the unequal-hour curves below the horizon.' },
  { category: 'Back operations', title: 'Measure altitude with the alidade', prerequisite: 'Planned: sight an object along the alidade and read its altitude from the limb.' },
  { category: 'Back operations', title: 'Use the equation-of-time loop', prerequisite: 'Planned: choose a date and read the difference between apparent and mean solar time.' },
  { category: 'Back operations', title: 'Measure height with the shadow square', prerequisite: 'Planned: enter a known distance and turn the observed shadow ratio into a height.' },
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
