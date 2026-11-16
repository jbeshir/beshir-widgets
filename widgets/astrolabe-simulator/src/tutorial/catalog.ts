import type { AstrolabeState, Face } from '../store';
import { equationOfTime, equatorialToHorizontal, normalizeDeg, solarLongitude } from '../astro';
import { OBLIQUITY_DEG, orientRetePoint, project } from '../geometry';
import { alidadeRotationForLongitude } from '../backGeometry';
import { limbHourAtAngle, ruleSunEndAngle } from '../limbScale';
import { shadowSquareIntersection, shadowSquareReading } from '../shadowSquare';
import { STARS } from '../data/stars';
import { isValidPartRef, type FrameRef, type PartRef } from './parts';
import type {
  ChoiceCheck, ChoiceOption, Demonstration, Lesson, LessonCheck, LessonStep, Predicate, RotationField, Snapshot,
} from './types';

/*
 * The Astrolabe Guide course (SYLLABUS.md §2). Every number the learner reads
 * in the copy, and every check, is computed here from the same pure functions
 * that draw the instrument. Rotation angles appear only in snapshots, checks,
 * demonstrations and solutions; the copy names engraved marks instead.
 */

// ---------------------------------------------------------------------------
// Fixed lesson setting (SYLLABUS §0.1)

const LATITUDE = 51.5;
const LONGITUDE = -0.12;
const LONDON = { label: 'London', lat: LATITUDE, lng: LONGITUDE, manual: false } as const;
export const APRIL = '2026-04-20T12:00:00.000Z';
export const OCTOBER = '2026-10-23T12:00:00.000Z';
const RAD = Math.PI / 180;
const ROME_PLATE = 40.93;
const BRISTOL_LONGITUDE = -2.6;
const EYE_HEIGHT = 1.6;

export interface Body { raDeg: number; decDeg: number }
export interface SunOnDate extends Body { longitude: number; equationMinutes: number }

function sunOn(dateIso: string): SunOnDate {
  const date = new Date(dateIso);
  const longitude = solarLongitude(date);
  const l = longitude * RAD;
  const e = OBLIQUITY_DEG * RAD;
  return {
    longitude,
    raDeg: normalizeDeg(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) / RAD),
    decDeg: Math.asin(Math.sin(e) * Math.sin(l)) / RAD,
    equationMinutes: equationOfTime(date),
  };
}
function starBody(name: string): Body {
  const star = STARS.find((item) => item.name === name);
  if (!star) throw new Error(`${name} is required by the course`);
  return { raDeg: star.raDeg, decDeg: star.decDeg };
}
const opposite = (body: Body): Body => ({ raDeg: normalizeDeg(body.raDeg + 180), decDeg: -body.decDeg });

/** Altitude and azimuth of a body with the rete at `rete`, on a plate for `latitude`. */
export const positionAt = (body: Body, rete: number, latitude = LATITUDE) =>
  equatorialToHorizontal(body.raDeg, body.decDeg, latitude, rete);
/** Rule rotation whose Sun end lies over the body. */
export function ruleOver(body: Body, rete: number): number {
  const point = orientRetePoint(project(body.raDeg, body.decDeg, 1), rete);
  return normalizeDeg(Math.atan2(-point.x, point.y) / RAD);
}
/** Hour angle at which a body stands at `altitude`, east (rising) or west (sinking). */
function hourAngleAtAltitude(body: Body, altitude: number, side: 'east' | 'west'): number {
  const cosine = (Math.sin(altitude * RAD) - Math.sin(LATITUDE * RAD) * Math.sin(body.decDeg * RAD))
    / (Math.cos(LATITUDE * RAD) * Math.cos(body.decDeg * RAD));
  const hourAngle = Math.acos(cosine) / RAD;
  return side === 'east' ? -hourAngle : hourAngle;
}
const reteWhen = (body: Body, altitude: number, side: 'east' | 'west') =>
  normalizeDeg(body.raDeg + hourAngleAtAltitude(body, altitude, side));
/** Local apparent time read where the rule's Sun end meets the limb hour scale. */
export const limbTime = (rule: number): number => limbHourAtAngle(ruleSunEndAngle(rule));
const ruleForTime = (hours: number): number => normalizeDeg((12 - hours) * 15);

// ---------------------------------------------------------------------------
// Formatting for copy

const pad = (value: number) => String(value).padStart(2, '0');
const wrapHours = (hours: number) => ((hours % 24) + 24) % 24;
/** 24-hour clock time, rounded to the minute. */
export function clock(hours: number): string {
  const minutes = Math.round(wrapHours(hours) * 60) % (24 * 60);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
function duration(hours: number): string {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`;
}
const deg = (value: number, digits = 0) => `${value.toFixed(digits)}°`;
const signedMinutes = (minutes: number) => `${minutes < 0 ? '−' : '+'}${Math.abs(Math.round(minutes))} min`;
const metres = (value: number) => `${value.toFixed(1)} m`;
/** Hour numeral nearest a reading (a minute of slack so 04:59.98 counts as 5). */
const hourMark = (hours: number): PartRef => ({ part: 'limb-hour-scale', hour: Math.floor(wrapHours(hours) + 1 / 60) % 24 });
/** Half-degree ecliptic tick nearest a longitude. */
const eclipticTick = (longitude: number): PartRef => ({ part: 'ecliptic-scale', longitude: normalizeDeg(Math.round(longitude * 2) / 2) });
/** Red altitude numeral (the minute-arm quadrant, where a height set by turning up from 0 is read). */
const red = (altitude: number): PartRef => ({ part: 'altitude-scale', altitude });
/** Magnify for a height read off the alidade: the red numerals 10° either side of the reading frame the tip and the mark it reads. */
const redAround = (altitude: number): PartRef[] => [red(Math.max(0, Math.round(altitude / 10) * 10 - 10)), red(Math.min(90, Math.round(altitude / 10) * 10 + 10))];
/** A level rule (Sun end at 6 on the limb), clear of the meridian. */
const ASIDE_LEVEL = 90;

// ---------------------------------------------------------------------------
// Worked values

const SUN_APRIL = sunOn(APRIL);
const SUN_OCTOBER = sunOn(OCTOBER);
const SIRIUS = starBody('Sirius');
const REGULUS = starBody('Regulus');
const ARCTURUS = starBody('Arcturus');
const CAPELLA = starBody('Capella');
const VEGA = starBody('Vega');
const DENEB = starBody('Deneb');
const ALTAIR = starBody('Altair');

const siriusRise = reteWhen(SIRIUS, 0, 'east');
export const FOUNDATIONS = {
  sirius: SIRIUS,
  riseRete: siriusRise,
  riseAzimuth: positionAt(SIRIUS, siriusRise).azimuth,
  riseRule: ruleOver(SIRIUS, siriusRise),
  culminationRete: SIRIUS.raDeg,
  culminationAltitude: positionAt(SIRIUS, SIRIUS.raDeg).altitude,
  culminationRule: ruleOver(SIRIUS, SIRIUS.raDeg),
} as const;

/** Supplied measurements (SYLLABUS §2, Lesson 2). */
export const MEASURED = { aprilSun: 30, octoberSun: 20, starSighting: 47, aprilBetween: 35 } as const;

const LOCAL_SKY_RETE = SIRIUS.raDeg;
export const LOCAL_SKY = {
  rete: LOCAL_SKY_RETE,
  rule: 300,
  sirius: positionAt(SIRIUS, LOCAL_SKY_RETE),
  regulus: positionAt(REGULUS, LOCAL_SKY_RETE),
  siriusOnRome: positionAt(SIRIUS, LOCAL_SKY_RETE, ROME_PLATE),
} as const;

const arcturusRise = reteWhen(ARCTURUS, 0, 'east');
const arcturusSet = reteWhen(ARCTURUS, 0, 'west');
const capellaLowest = normalizeDeg(CAPELLA.raDeg + 180);
export const STAR_PATH = {
  start: 80,
  /**
   * The rule is kept turned aside, at least 30° from Arcturus at the start, rising, culmination and setting and from
   * Capella's lowest point; its upper half lies right of the zenith, clear of the height-circle labels and "Zenith".
   */
  rule: 330,
  riseRete: arcturusRise,
  rise: positionAt(ARCTURUS, arcturusRise),
  culminationRete: ARCTURUS.raDeg,
  culmination: positionAt(ARCTURUS, ARCTURUS.raDeg),
  setRete: arcturusSet,
  set: positionAt(ARCTURUS, arcturusSet),
  capellaRete: capellaLowest,
  capella: positionAt(CAPELLA, capellaLowest),
  vegaLowest: positionAt(VEGA, normalizeDeg(VEGA.raDeg + 180)).altitude,
} as const;

export const SUN_PLACE = {
  april: { ...SUN_APRIL, alidade: alidadeRotationForLongitude(SUN_APRIL.longitude), rule: ruleOver(SUN_APRIL, 0) },
  october: { ...SUN_OCTOBER, alidade: alidadeRotationForLongitude(SUN_OCTOBER.longitude), rule: ruleOver(SUN_OCTOBER, 0) },
  july: sunOn('2026-07-14T12:00:00.000Z').longitude,
} as const;

function timeBySun(sun: SunOnDate, altitude: number, side: 'east' | 'west') {
  const rete = reteWhen(sun, altitude, side);
  const rule = ruleOver(sun, rete);
  const time = limbTime(rule);
  return { altitude, side, rete, rule, time, azimuth: positionAt(sun, rete).azimuth, hourAngle: Math.abs(12 - time) * 15 };
}
const keystoneApril = timeBySun(SUN_APRIL, MEASURED.aprilSun, 'east');
const keystoneOctober = timeBySun(SUN_OCTOBER, MEASURED.octoberSun, 'west');
const minutesPerDegree = (sun: Body, altitude: number, side: 'east' | 'west') =>
  Math.abs(hourAngleAtAltitude(sun, altitude + 0.5, side) - hourAngleAtAltitude(sun, altitude - 0.5, side)) * 4;
export const TIME_BY_SUN = {
  april: keystoneApril,
  october: keystoneOctober,
  aprilStartRete: reteWhen(SUN_APRIL, 0, 'east'),
  /** A later 20 April sighting between two height circles (Lesson 6, interpolation). */
  between: timeBySun(SUN_APRIL, MEASURED.aprilBetween, 'east'),
  minutesPerDegreeAt30: minutesPerDegree(SUN_APRIL, MEASURED.aprilSun, 'east'),
  altitudeAt11: positionAt(SUN_APRIL, normalizeDeg(SUN_APRIL.raDeg - 15)).altitude,
  noonAltitude: positionAt(SUN_APRIL, SUN_APRIL.raDeg).altitude,
} as const;

function solarDay(sun: SunOnDate) {
  const event = (rete: number) => {
    const rule = ruleOver(sun, rete);
    const position = positionAt(sun, rete);
    return { rete, rule, time: limbTime(rule), altitude: position.altitude, azimuth: position.azimuth };
  };
  const sunrise = event(reteWhen(sun, 0, 'east'));
  const noon = event(sun.raDeg);
  const sunset = event(reteWhen(sun, 0, 'west'));
  const dayHours = wrapHours(sunset.time - sunrise.time);
  return { sunrise, noon, sunset, dayHours, arc: dayHours * 15 };
}
export const SOLAR_EVENTS = { april: solarDay(SUN_APRIL), october: solarDay(SUN_OCTOBER) } as const;

function timeByStar(star: Body, sun: SunOnDate, altitude: number, side: 'east' | 'west') {
  const rete = reteWhen(star, altitude, side);
  const rule = ruleOver(sun, rete);
  const sunPosition = positionAt(sun, rete);
  return { star, altitude, rete, rule, time: limbTime(rule), azimuth: positionAt(star, rete).azimuth, sunAltitude: sunPosition.altitude, sunAzimuth: sunPosition.azimuth };
}
export const TIME_BY_STAR = {
  april: { ...timeByStar(ARCTURUS, SUN_APRIL, 40, 'east'), start: 120 },
  october: { ...timeByStar(VEGA, SUN_OCTOBER, 50, 'west'), start: VEGA.raDeg },
} as const;

/** Sundial time → watch time for London (or another longitude), with summer time. */
function toWatch(apparent: number, equation: number, longitude = LONGITUDE) {
  const mean = apparent - equation / 60;
  const longitudeMinutes = -longitude * 4;
  const zone = mean + longitudeMinutes / 60;
  return { apparent, mean, longitudeMinutes, zone, summer: zone + 1 };
}
export const CLOCK_TIME = {
  april: { equation: SUN_APRIL.equationMinutes, ...toWatch(keystoneApril.time, SUN_APRIL.equationMinutes), alidade: normalizeDeg(180 - SUN_APRIL.longitude) },
  october: { equation: SUN_OCTOBER.equationMinutes, ...toWatch(keystoneOctober.time, SUN_OCTOBER.equationMinutes), alidade: normalizeDeg(180 - SUN_OCTOBER.longitude) },
  bristol: toWatch(keystoneOctober.time, SUN_OCTOBER.equationMinutes, BRISTOL_LONGITUDE),
} as const;
/**
 * The same conversion as the learner works it in Lesson 9: whole minutes throughout, starting from
 * the sundial time read to the minute, so every sum shown in the copy gives the answer shown.
 */
function watchInMinutes(apparent: number, equation: number, longitude = LONGITUDE) {
  const start = Math.round(apparent * 60);
  const equationWhole = Math.round(equation);
  const longitudeMinutes = -longitude * 4;
  const longitudeWhole = Math.round(longitudeMinutes);
  const mean = start - equationWhole;
  const zone = mean + longitudeWhole;
  return { apparent: start / 60, equation: equationWhole, mean: mean / 60, longitudeMinutes, longitudeWhole, zone: zone / 60, summer: (zone + 60) / 60 };
}
export const WATCH = {
  april: watchInMinutes(keystoneApril.time, SUN_APRIL.equationMinutes),
  october: watchInMinutes(keystoneOctober.time, SUN_OCTOBER.equationMinutes),
  bristol: watchInMinutes(keystoneOctober.time, SUN_OCTOBER.equationMinutes, BRISTOL_LONGITUDE),
  /** Late July, when the sundial is slow and the three corrections add up. */
  julyEquation: equationOfTime(new Date('2026-07-26T12:00:00.000Z')),
  /** Mid-month equation of time, for instruments without a loop. */
  table: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .map((month, index) => ({ month, minutes: equationOfTime(new Date(Date.UTC(2026, index, 15, 12))) })),
} as const;

function seasonalHour(sun: SunOnDate, day: ReturnType<typeof solarDay>, hour: number) {
  const sunriseHourAngle = -day.arc / 2;
  const rete = normalizeDeg(sun.raDeg + sunriseHourAngle + day.arc * hour / 12);
  const rule = ruleOver(sun, rete);
  const nadir = opposite(sun);
  const nadirPosition = positionAt(nadir, rete);
  return { hour, rete, rule, time: limbTime(rule), nadir, nadirLongitude: normalizeDeg(sun.longitude + 180), nadirAltitude: nadirPosition.altitude, nadirAzimuth: nadirPosition.azimuth, hourMinutes: day.dayHours * 60 / 12 };
}
export const SEASONAL_HOURS = {
  april: seasonalHour(SUN_APRIL, SOLAR_EVENTS.april, 3),
  october: seasonalHour(SUN_OCTOBER, SOLAR_EVENTS.october, 9),
  octoberThird: SOLAR_EVENTS.october.sunrise.time + 3 * SOLAR_EVENTS.october.dayHours / 12,
} as const;

/** Lesson 9 run backwards, in whole minutes as Lesson 9 works it: London's half minute does not change the minute. */
function skyAt(sun: SunOnDate, summerTime: number) {
  const zone = summerTime - 1;
  const mean = zone + Math.round(LONGITUDE * 4) / 60;
  const apparent = mean + Math.round(sun.equationMinutes) / 60;
  const rule = ruleForTime(apparent);
  const rete = normalizeDeg(sun.raDeg + (apparent - 12) * 15);
  return { summerTime, zone, mean, apparent, rule, rete };
}
const skyOctober = skyAt(SUN_OCTOBER, 21);
const skyApril = skyAt(SUN_APRIL, 22);
export const SET_SKY = {
  october: { ...skyOctober, vega: positionAt(VEGA, skyOctober.rete), deneb: positionAt(DENEB, skyOctober.rete), altair: positionAt(ALTAIR, skyOctober.rete), capella: positionAt(CAPELLA, skyOctober.rete) },
  april: { ...skyApril, arcturus: positionAt(ARCTURUS, skyApril.rete), regulus: positionAt(REGULUS, skyApril.rete), vega: positionAt(VEGA, skyApril.rete) },
} as const;

function shadowReading(angle: number) {
  const intersection = shadowSquareIntersection(angle);
  if (!intersection) throw new Error(`A ${angle}° sighting must cross the shadow square`);
  return { angle, edge: intersection.edge, reading: shadowSquareReading(intersection) };
}
const steep = shadowReading(60);
const low = shadowReading(30);
const corner = shadowReading(45);
export const SHADOW = {
  corner,
  steep: { ...steep, distance: 12, height: 12 * 12 / steep.reading },
  low: { ...low, distance: 36, height: 36 * low.reading / 12 },
  eyeHeight: EYE_HEIGHT,
} as const;

// ---------------------------------------------------------------------------
// Snapshot, check and step builders

const visibility: AstrolabeState['visibility'] = {
  almucantars: true, azimuths: true, unequalHours: true, ecliptic: true, artificialAssists: false, stars: true,
  rule: true, tropics: true, calendar: true, zodiacScale: true, shadowSquare: true,
  backUnequalHours: true, equationOfTime: true, alidade: true,
};
interface Setting { rete?: number; rule?: number; alidade?: number; plate?: number }
const at = (epochIso: string, face: Face, setting: Setting = {}): Snapshot => ({
  face,
  location: { ...LONDON },
  plateSelection: 'pinned',
  plateLatitude: setting.plate ?? LATITUDE,
  reteRotation: setting.rete ?? 0,
  ruleRotation: setting.rule ?? 0,
  alidadeRotation: setting.alidade ?? 0,
  visibility: { ...visibility },
  epochIso,
});

const near = (field: RotationField, value: number, tolerance = 1): Predicate => ({ kind: 'angleNear', field, value, tolerance });
const altitudeSet = (value: number): Predicate => ({ kind: 'alidadeAltitude', value, tolerance: 1 });
const dateLine = (longitude: number): Predicate => ({ kind: 'alidadeLongitude', value: longitude, tolerance: 1 });
const plateIs = (latitude: number): Predicate => ({ kind: 'plateIs', latitude, tolerance: 0.01 });
/** The body stands where it is with the rete at `rete`; optionally the rule lies over `ruleBody`. */
function standsAt(body: Body, rete: number, ruleBody?: Body, tolerance = 1): Predicate {
  const position = positionAt(body, rete);
  return {
    kind: 'frontGeometry',
    body: { raDeg: body.raDeg, decDeg: body.decDeg },
    position: { altitude: position.altitude, azimuth: position.azimuth, tolerance },
    ...(ruleBody ? { rulePoint: { raDeg: ruleBody.raDeg, decDeg: ruleBody.decDeg, tolerance: 1 } } : {}),
  };
}
const ruleOn = (body: Body): Predicate => ({
  kind: 'frontGeometry', body: { raDeg: body.raDeg, decDeg: body.decDeg },
  rulePoint: { raDeg: body.raDeg, decDeg: body.decDeg, tolerance: 1 },
});
const allOf = (...predicates: Predicate[]): Predicate => ({ kind: 'allOf', predicates });
/** Options are written correct-first; a fixed rotation (from the prompt) keeps the answer from always sitting first. */
function choice(prompt: string, options: ChoiceOption[]): ChoiceCheck {
  const shift = [...prompt].reduce((sum, character) => sum + character.charCodeAt(0), 0) % options.length;
  return { kind: 'choice', prompt, options: [...options.slice(shift), ...options.slice(0, shift)] };
}
const right = (label: string): ChoiceOption => ({ label, correct: true });
const wrong = (label: string, misconception: string): ChoiceOption => ({ label, misconception });
/** Reading a height off an alidade left where a sighting put it (Lessons 6 and 8). */
const alidadeHeight = (value: number): ChoiceCheck => choice('What height does the alidade show?', [
  right(`${value}°`),
  wrong(`${180 - value}°`, 'That is a black number on the outer degree scale. Heights are read on the red scale only.'),
  wrong(`${90 - value}°`, 'That is the distance from the vertical line. Heights count up from the horizontal line, 0, towards the red 90.'),
]);

const turn = (field: RotationField, from: number, to: number, durationMs = 700, companion?: { field: RotationField; from: number; to: number }): Demonstration =>
  ({ field, from, to, durationMs, ...(companion ? { companion } : {}) });

interface StepSpec {
  id: string; title: string; purpose: string; body: string; stopCue?: string; result: string;
  highlights?: readonly PartRef[]; frame?: readonly FrameRef[]; introduces?: LessonStep['introduces']; uses?: LessonStep['uses'];
  snapshot: Snapshot; check?: LessonCheck; demonstration?: Demonstration; solution?: Partial<Snapshot>;
}
const base = (spec: StepSpec) => ({
  id: spec.id, title: spec.title, purpose: spec.purpose, body: spec.body, result: spec.result,
  highlights: spec.highlights ?? [], introduces: spec.introduces ?? [], uses: spec.uses ?? [], snapshot: spec.snapshot,
  ...(spec.stopCue ? { stopCue: spec.stopCue } : {}),
  ...(spec.frame ? { frame: spec.frame } : {}),
});
/** Explain: no check. */
const explain = (spec: StepSpec): LessonStep => ({ ...base(spec), mode: 'explain' });
/** Read: a reading or prediction question. */
const read = (spec: StepSpec & { check: ChoiceCheck }): LessonStep => ({ ...base(spec), mode: 'read', check: spec.check });
/** Demonstrate: the guide moves the part; the check passes when it stops. */
const demonstrate = (spec: StepSpec & { demonstration: Demonstration; check: Predicate }): LessonStep =>
  ({ ...base(spec), mode: 'demonstrate', demonstration: spec.demonstration, check: spec.check });
/** Your turn: the learner moves the part from the snapshot to the `solution`. */
const yourTurn = (spec: StepSpec & { check: Predicate; solution: Partial<Snapshot> }): LessonStep =>
  ({ ...base(spec), mode: 'your-turn', check: spec.check, solution: spec.solution });

// ---------------------------------------------------------------------------
// Lesson 1 — Meet the astrolabe

const F = FOUNDATIONS;
const foundations: Lesson = {
  id: 'front.foundations.v1', version: 1, prerequisites: [],
  title: 'Meet the astrolabe: what stays fixed and what turns',
  summary: 'Name the parts on both faces, turn the star map and the rule on the front, turn the instrument over, and move the sighting bar on the back.',
  steps: [
    explain({
      id: 'meet-instrument', title: 'Meet the instrument',
      purpose: 'Before using the astrolabe, learn the names of its main pieces.',
      body: 'Look at the whole front. The mater is the thick brass disc that holds everything; its raised outer rim is the limb. The throne at the top carries the ring the instrument hangs from.',
      result: 'Everything else sits inside the mater, held on its central pin; some pieces stay fixed and some turn. The front shows London’s 51.5° plate with the moving parts at their starting positions; no date or time has been set.',
      highlights: ['mater', 'limb', 'throne'], introduces: ['mater', 'limb', 'throne'],
      snapshot: at(APRIL, 'front'),
    }),
    explain({
      id: 'fixed-plate', title: 'Find the fixed plate',
      purpose: 'Separate what stays still, you the observer, from what turns, the sky.',
      body: 'Find the plate: the engraved disc lying in the hollow of the mater. A plate is made for one latitude. This one is for London, 51.5° north.',
      result: 'The plate never moves while you take a reading.',
      highlights: ['plate'], introduces: ['plate'], uses: ['mater'],
      snapshot: at(APRIL, 'front'),
    }),
    demonstrate({
      id: 'moving-rete', title: 'Turn the sky',
      purpose: 'See that the star map turns over the fixed plate.',
      body: 'The pierced frame on top is the rete, a map of the sky. Each pointed tongue ends at a star. Watch the rete turn clockwise until the tip of Sirius touches the horizon, the large off-centre circle on the plate, on its left side.',
      stopCue: 'Sirius’s tip sits on the horizon circle, left of centre.',
      result: 'You have just watched Sirius rise. The plate did not move; only the sky did.',
      highlights: ['rete', { part: 'star-pointer', star: 'sirius' }, 'horizon'],
      introduces: ['rete', 'star-pointer', 'horizon', 'rotate-rete'], uses: ['plate'],
      snapshot: at(APRIL, 'front'),
      demonstration: turn('reteRotation', 0, F.riseRete),
      check: standsAt(SIRIUS, F.riseRete),
    }),
    demonstrate({
      id: 'reading-rule', title: 'Lay the rule across a star',
      purpose: 'Meet the rule, the pointer that carries a point out to the edge.',
      body: 'The rule is the straight pointer lying on top of the rete. One straight edge of each arm, marked by a fine dark line, runs exactly through the centre: that is the reading edge. One half of the rule carries engraved numbers; later lessons call it the Sun end. Watch the rule turn until the edge of that numbered half runs through Sirius’s tip.',
      stopCue: 'The edge of the rule’s numbered half runs through Sirius’s tip.',
      result: 'The rule’s line now joins the centre, the star and a point on the limb.',
      highlights: ['rule', 'rule-edge', { part: 'star-pointer', star: 'sirius' }],
      introduces: ['rule', 'fiducial-edge', 'lay-rule'], uses: ['star-pointer', 'rete', 'limb'],
      snapshot: at(APRIL, 'front', { rete: F.riseRete }),
      demonstration: turn('ruleRotation', 0, F.riseRule),
      check: ruleOn(SIRIUS),
    }),
    yourTurn({
      id: 'your-turn-front', title: 'Your turn: turn the sky and follow with the rule',
      purpose: 'Do both front movements yourself.',
      body: 'The rule has been turned aside. Drag the rete clockwise (or focus it and press the right arrow key) until Sirius stands on the straight vertical line above the centre, at its highest. Then turn the rule until the edge of its numbered half runs through Sirius again.',
      stopCue: 'Sirius’s tip is on the vertical line and the edge of the rule’s numbered half runs through it.',
      result: 'A star climbs from the horizon to a highest point while the plate stays still.',
      highlights: ['rete', 'rule', { part: 'star-pointer', star: 'sirius' }], uses: ['rotate-rete', 'lay-rule', 'star-pointer'],
      // The rule is turned aside, off Sirius and off the vertical line the learner steers it to.
      snapshot: at(APRIL, 'front', { rete: F.riseRete, rule: LOCAL_SKY.rule }),
      check: standsAt(SIRIUS, F.culminationRete, SIRIUS),
      solution: { reteRotation: F.culminationRete, ruleRotation: F.culminationRule },
    }),
    explain({
      id: 'limb-scales', title: 'Read the limb',
      purpose: 'Preview the scale where every timing lesson ends.',
      body: 'Follow the rule out to the limb. The limb carries 360 one-degree ticks and 24 hour numbers, one every 15°, with 12 at the top and the hours increasing clockwise.',
      result: 'Once the rule lies over the Sun, the limb gives the time. No Sun has been placed yet, so this is not a time.',
      highlights: ['limb-degree-scale', 'limb-hour-scale'], introduces: ['limb-degree-scale', 'limb-hour-scale'], uses: ['rule', 'limb'],
      snapshot: at(APRIL, 'front', { rete: F.culminationRete, rule: F.culminationRule }),
    }),
    demonstrate({
      id: 'turn-to-back', title: 'Turn the instrument over',
      purpose: 'Many tasks use both faces, so learn to turn the instrument over.',
      body: 'The button marked Show back turns the astrolabe over. Watch the guide press it.',
      stopCue: 'The back, with its rings of scales, is showing.',
      result: 'The button now reads Show front. The back has its own fixed engravings and its own moving bar.',
      highlights: ['face-toggle', 'mater'], introduces: ['turn-over'], uses: ['mater'],
      snapshot: at(APRIL, 'front', { rete: F.culminationRete, rule: F.culminationRule }),
      demonstration: { kind: 'face', to: 'back', durationMs: 600 },
      check: { kind: 'faceIs', value: 'back' },
    }),
    explain({
      id: 'read-back-scales', title: 'The outer rings: degrees and heights',
      purpose: 'Name the back’s scales now, so later lessons can simply point to them.',
      body: 'Start at the edge. The outermost ring is the degree scale, 0 to 360, with black numbers. Just inside it are the red numbers of the altitude scale, which counts heights: 0 at the horizontal line, 90 at the top.',
      result: 'Lesson 2 uses the red scale for every measured height. The black numbers belong to the degree scale.',
      highlights: ['back-degree-scale', 'altitude-scale'], introduces: ['back-degree-scale', 'altitude-scale'], uses: ['turn-over'],
      snapshot: at(APRIL, 'back'),
    }),
    explain({
      id: 'read-date-rings', title: 'The date rings',
      purpose: 'Name the two rings that turn a date into the Sun’s place.',
      body: 'Further in come the zodiac band, twelve signs from ARI to PIS, and inside it the calendar ring, JAN to DEC, with a tick for every day.',
      result: 'A straight edge laid across a date also crosses the zodiac band and the degree scale. Lesson 5 uses this.',
      highlights: ['zodiac-scale', 'calendar-scale'], introduces: ['zodiac-scale', 'calendar-scale'], uses: ['back-degree-scale'],
      snapshot: at(APRIL, 'back'),
    }),
    explain({
      id: 'read-back-centre', title: 'The middle of the back',
      purpose: 'Know what the engravings in the middle are for.',
      body: 'In the middle are the shadow square in the lower half, for measuring heights (Lesson 12); the equation-of-time loop, for turning sundial time into clock time (Lesson 9); and the double horary quadrant in the upper half, which this course only names.',
      result: 'None of the back’s engravings move. Each is a table you read with a straight edge.',
      highlights: ['shadow-square', 'eot-curve', 'horary-quadrant'], introduces: ['shadow-square', 'eot-curve', 'horary-quadrant'],
      snapshot: at(APRIL, 'back'),
    }),
    demonstrate({
      id: 'move-alidade', title: 'Move the alidade',
      purpose: 'Meet the back’s moving bar and its reading edge.',
      body: 'The alidade is the sighting bar pivoted at the centre. Watch it turn until it stands upright over the vertical engraved line, pointing at the red 90 at the top.',
      stopCue: 'The alidade stands upright over the vertical line, its tip at the red 90.',
      result: 'Held up to the sky, an upright alidade would sight straight overhead. Its edge reads any back scale it crosses.',
      highlights: ['alidade', 'alidade-edge', 'back-axes'], introduces: ['alidade', 'rotate-alidade', 'back-axes'], uses: ['fiducial-edge', 'altitude-scale'],
      snapshot: at(APRIL, 'back'),
      demonstration: turn('alidadeRotation', 0, 90),
      check: near('alidadeRotation', 90),
    }),
    explain({
      id: 'foundations-result', title: 'Two faces, three moving parts',
      purpose: 'Gather the names together, and avoid a naming trap in older books.',
      body: 'Front: the plate stays fixed; the rete and the rule turn. Back: the scales stay fixed; the alidade turns. Older books can confuse you here: Chaucer calls the back’s sighting bar the “rule” and the front pointer the “label”. This course uses the modern names, alidade and rule.',
      result: 'Both faces and their independently moving parts have been identified; no observational date or time setting is implied.',
      highlights: ['alidade'], introduces: ['old-part-names'], uses: ['alidade', 'rule'],
      snapshot: at(APRIL, 'back', { alidade: 90 }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 2 — Set a measured altitude

const measureAltitude: Lesson = {
  id: 'back.measure-altitude.v1', version: 1, prerequisites: ['front.foundations.v1'],
  title: 'Set a measured altitude on the alidade',
  summary: 'Learn how a real astrolabe measures height, then put measured heights on the alidade and read them back.',
  steps: [
    explain({
      id: 'physical-sighting', title: 'How a real astrolabe measures',
      purpose: 'Know what a real instrument does that this screen cannot.',
      body: 'On a real astrolabe you hang the instrument from the ring at the throne so it hangs straight down, then turn the alidade until your target shows through both of its sights. For the Sun, never look at it: turn the alidade until the sunlight through the upper sight falls on the lower one. This flat picture has no sights, so every measured height in the course is given to you.',
      result: 'The course starts from the number your sighting would give.',
      highlights: ['alidade', 'throne'], introduces: ['sighting'], uses: ['alidade', 'throne'],
      // Upright, as Lesson 1 left it: lying level it would hide the horizontal line and the red 0.
      snapshot: at(APRIL, 'back', { alidade: 90 }),
    }),
    explain({
      id: 'given-altitude', title: 'What altitude means',
      purpose: 'Be clear about the quantity you are carrying.',
      body: `Altitude is how high something stands above the horizon: 0° on the horizon, 90° straight overhead. On the back it is counted on the red scale, from the horizontal line up to 90 at the top. Your first measurement: the Sun on the morning of 20 April, at ${deg(MEASURED.aprilSun)}.`,
      result: 'The horizontal line and the red scale are the instrument’s own “horizon to overhead”.',
      highlights: ['altitude-scale', 'back-axes'], introduces: ['altitude'], uses: ['altitude-scale', 'back-axes', 'horizon'],
      snapshot: at(APRIL, 'back', { alidade: 90 }),
    }),
    demonstrate({
      id: 'set-alidade', title: `Set ${deg(MEASURED.aprilSun)} on the alidade`,
      purpose: 'Put the measured number on the instrument.',
      body: `Watch one end of the alidade turn up from the horizontal line until its edge points at ${MEASURED.aprilSun} on the red scale.`,
      stopCue: `The edge points at the red ${MEASURED.aprilSun}, along the outer ring’s tick for it.`,
      result: 'The alidade now holds the Sun’s measured height, ready to use.',
      highlights: ['alidade-edge', 'altitude-scale'], introduces: ['set-altitude'], uses: ['altitude', 'rotate-alidade', 'fiducial-edge'],
      // Magnify the red numerals round the mark the edge turns to.
      frame: redAround(MEASURED.aprilSun),
      snapshot: at(APRIL, 'back'),
      demonstration: turn('alidadeRotation', 0, MEASURED.aprilSun),
      check: altitudeSet(MEASURED.aprilSun),
    }),
    read({
      id: 'read-between', title: 'Read a height between the numbers',
      purpose: 'Practise reading the scale, not only setting it.',
      body: 'Here the alidade has been left where a star sighting put it. The red numbers come every 10°, and the outer ring’s one-degree ticks line up with them. Count the ticks past the nearest red number below the edge.',
      stopCue: 'Count the ticks past the red 40.',
      result: `The edge is at ${MEASURED.starSighting}°. The black numbers belong to the outer degree scale, not to altitude.`,
      highlights: ['altitude-scale'], introduces: ['read-altitude-scale'], uses: ['altitude-scale', 'back-degree-scale'],
      // Magnify the alidade's tip between the red 40 and 50.
      frame: redAround(MEASURED.starSighting),
      snapshot: at(APRIL, 'back', { alidade: MEASURED.starSighting }),
      check: choice('What altitude is set on the alidade?', [
        right(`${MEASURED.starSighting}°`),
        wrong(`${50 - (MEASURED.starSighting - 40)}°`, `That adds the ${50 - MEASURED.starSighting} ticks between the edge and the red 50 to 40. Count from one red number only: 40 plus ${MEASURED.starSighting - 40} ticks is ${MEASURED.starSighting}, and so is 50 minus ${50 - MEASURED.starSighting}.`),
        wrong(`${180 - MEASURED.starSighting}°`, 'That is a black number on the outer degree scale. Altitude is read on the red scale only.'),
      ]),
    }),
    yourTurn({
      id: 'second-altitude', title: 'Your turn: an afternoon measurement',
      purpose: 'Set a second measurement yourself.',
      body: `On the afternoon of 23 October the Sun was measured at ${deg(MEASURED.octoberSun)}. Turn the alidade (drag it, or focus it and use the arrow keys) until its edge points at ${MEASURED.octoberSun} on the red scale.`,
      stopCue: `The edge points at the red ${MEASURED.octoberSun}, along the outer ring’s tick for it.`,
      result: `The alidade holds ${deg(MEASURED.octoberSun)}. You will use this measurement again when you tell the time.`,
      highlights: ['altitude-scale'], uses: ['set-altitude', 'rotate-alidade'],
      // The red numerals from the alidade's start (47) down to the target, so a phone shows the mark and the tool.
      frame: [red(10), red(50)],
      snapshot: at(OCTOBER, 'back', { alidade: MEASURED.starSighting }),
      check: altitudeSet(MEASURED.octoberSun),
      solution: { alidadeRotation: MEASURED.octoberSun },
    }),
    explain({
      id: 'altitude-result', title: 'Carry the number forward',
      purpose: 'Link the measurement to the front of the instrument.',
      body: `Write the numbers down: ${deg(MEASURED.aprilSun)} on the morning of 20 April, and ${deg(MEASURED.octoberSun)} on the afternoon of 23 October. The front plate has circles for the same heights, which Lesson 3 introduces.`,
      result: `Two measurements, ${deg(MEASURED.aprilSun)} and ${deg(MEASURED.octoberSun)}, have been set and read on the altitude scale.`,
      highlights: ['alidade'], uses: ['altitude'],
      snapshot: at(OCTOBER, 'back', { alidade: MEASURED.octoberSun }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 3 — Read height and direction

const L = LOCAL_SKY;
const skySetting = { rete: L.rete, rule: L.rule };
const localSky: Lesson = {
  id: 'front.local-sky.v1', version: 1, prerequisites: ['front.foundations.v1', 'back.measure-altitude.v1'],
  title: 'Read height and direction on your latitude plate',
  summary: 'Learn the horizon, zenith, height circles and direction lines, read where two stars are, and see why the plate must match your latitude.',
  steps: [
    explain({
      id: 'horizon-zenith', title: 'Your horizon and your zenith',
      purpose: 'See the plate as your own sky: you stand at its middle.',
      body: 'The horizon circle separates the sky (inside it) from the ground (outside it). The dot marked Zenith is the point straight above your head.',
      result: 'Anything inside the horizon circle is above the ground.',
      highlights: ['horizon', 'zenith'], introduces: ['zenith'], uses: ['horizon', 'plate'],
      snapshot: at(APRIL, 'front', skySetting),
    }),
    explain({
      id: 'almucantars', title: 'Circles of equal height',
      purpose: 'Connect the heights on the back to lines on the front.',
      body: `The off-centre circles between the horizon and the zenith are almucantars, circles of equal height, engraved every 10° and labelled 10° to 80°. The horizon is 0°. The ${deg(MEASURED.aprilSun)} circle holds every point ${deg(MEASURED.aprilSun)} up: the same ${deg(MEASURED.aprilSun)} you set on the alidade.`,
      result: 'A height from the back becomes a circle on the front. The circles are crowded on one side and spread on the other; trust their labels, not their spacing.',
      highlights: [{ part: 'almucantar', altitude: 30 }], introduces: ['almucantar'], uses: ['altitude', 'horizon', 'zenith'],
      snapshot: at(APRIL, 'front', skySetting),
    }),
    explain({
      id: 'directions', title: 'Directions on the plate',
      purpose: 'Tell east from west on the plate; later lessons depend on it.',
      body: 'The straight line running up through the zenith is the meridian; its top end points due south. The curves running from the zenith down to the horizon are azimuth lines: compass directions every 30°, labelled at their feet and counted clockwise from north. The 90° line (east) is on the left; the 270° line (west) is on the right.',
      result: 'On the front of a northern astrolabe, east is on the left and west is on the right.',
      highlights: ['meridian-line', { part: 'azimuth-line', azimuth: 90 }, { part: 'azimuth-line', azimuth: 270 }],
      introduces: ['meridian-line', 'azimuth-line', 'azimuth', 'east-west'], uses: ['zenith', 'horizon'],
      snapshot: at(APRIL, 'front', skySetting),
    }),
    explain({
      id: 'read-sirius', title: 'Worked reading: Sirius',
      purpose: 'Follow one complete reading of a star’s position.',
      body: `Sirius’s tip is on the meridian, between the 20° and 30° circles, about a fifth of the way from the 20° circle towards the 30° circle. So Sirius is about ${deg(L.sirius.altitude)} high, due south (azimuth 180°).`,
      result: 'You estimate between engraved lines, as with any scale.',
      highlights: [{ part: 'star-pointer', star: 'sirius' }, { part: 'almucantar', altitude: 20 }, { part: 'almucantar', altitude: 30 }, 'meridian-line'],
      introduces: ['read-alt-az', 'interpolate'], uses: ['almucantar', 'azimuth-line', 'meridian-line', 'star-pointer'],
      snapshot: at(APRIL, 'front', skySetting),
    }),
    read({
      id: 'read-regulus', title: 'Your turn: read Regulus',
      purpose: 'Make a reading on your own.',
      body: 'Find Regulus’s pointer. Read its height from the almucantars and its direction from the azimuth lines.',
      stopCue: 'The two height circles either side of the tip, and the nearest azimuth line.',
      result: `Regulus is about ${deg(L.regulus.altitude)} up, in the east-south-east: azimuth about ${deg(L.regulus.azimuth)}, just short of the 120° line.`,
      highlights: [{ part: 'star-pointer', star: 'regulus' }], uses: ['read-alt-az', 'interpolate', 'east-west'],
      // The reading needs the tip, the 30° and 40° numerals and the 120° foot numeral (only the star is highlighted); framing just those numerals, not whole circles, lets the phone magnify.
      frame: [{ part: 'star-pointer', star: 'regulus' }, { label: { part: 'almucantar', altitude: 30 } }, { label: { part: 'almucantar', altitude: 40 } }, { label: { part: 'azimuth-line', azimuth: 120 } }],
      snapshot: at(APRIL, 'front', skySetting),
      check: choice('Where is Regulus?', [
        right(`About ${deg(L.regulus.altitude)} high, in the east-south-east`),
        wrong(`About ${deg(L.regulus.altitude)} high, in the west-south-west`, 'East and west are swapped. On the front, east is the left half of the plate.'),
        wrong(`About ${deg(60 - L.regulus.altitude)} high, in the east-south-east`, 'That counts down from the 30° circle. Heights grow towards the zenith, so count up from 30°.'),
      ]),
    }),
    {
      ...base({
        id: 'compare-plate', title: 'Why the plate must match your latitude',
        purpose: 'See that the plate stands for you and your place, while the rete is the sky.',
        body: `Watch the guide swap in the Clima V plate, made for Rome (${deg(ROME_PLATE, 2)}). The rete does not move, yet Sirius now sits about ${deg(L.siriusOnRome.altitude)} up, because this horizon and these height circles are drawn for a different place.`,
        stopCue: `The horizon circle visibly changes and Sirius crosses the ${deg(30)} circle.`,
        result: 'The wrong plate gives wrong heights, and so wrong times.',
        highlights: ['plate', 'horizon', 'plate-selector', { part: 'almucantar', altitude: 30 }], introduces: ['plate-latitude', 'choose-plate'], uses: ['plate', 'horizon', 'almucantar', 'read-alt-az'],
        snapshot: at(APRIL, 'front', skySetting),
      }),
      mode: 'demonstrate',
      demonstration: { kind: 'plate', from: LATITUDE, to: ROME_PLATE, durationMs: 700 },
      check: plateIs(ROME_PLATE),
    },
    yourTurn({
      id: 'restore-plate', title: 'Your turn: choose London’s plate',
      purpose: 'Choose the right plate yourself.',
      body: `In the Plate menu, choose Exact, the plate drawn for your own latitude (${deg(LATITUDE, 1)}). A ready-made set might only offer 50°; the warning banner above the lesson would then tell you it is 1.5° off.`,
      stopCue: `The warning banner disappears, and Sirius is back near ${deg(L.sirius.altitude)}.`,
      result: 'Every later lesson uses London’s exact plate. On a real instrument, use the plate nearest your latitude: heights will be off by about the difference, so times near sunrise and sunset suffer most.',
      highlights: ['plate-selector', 'plate-mismatch'], uses: ['choose-plate', 'plate-latitude', 'read-alt-az'],
      snapshot: at(APRIL, 'front', { ...skySetting, plate: ROME_PLATE }),
      check: plateIs(LATITUDE),
      solution: { plateLatitude: LATITUDE, plateSelection: 'pinned' },
    }),
    explain({
      id: 'local-sky-result', title: 'What the plate tells you',
      purpose: 'Sum up what the plate gives you.',
      body: 'Any point under the rete can be read as a height (from the almucantars) and a direction (from the azimuth lines), for your latitude.',
      result: `Positions have been read as altitude and azimuth on London’s 51.5° plate: Sirius about ${deg(L.sirius.altitude)} due south, Regulus about ${deg(L.regulus.altitude)} in the east-south-east.`,
      highlights: ['plate'], uses: ['read-alt-az'],
      snapshot: at(APRIL, 'front', skySetting),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 4 — Follow a star

const P = STAR_PATH;
const readStar: Lesson = {
  id: 'front.read-star.v1', version: 1, prerequisites: ['front.local-sky.v1'],
  title: 'Follow a star from rising to setting',
  summary: 'See the sky turn about the pole, follow Arcturus from rising through its highest point to setting, and meet a star that never sets.',
  steps: [
    explain({
      id: 'sky-turns', title: 'The sky turns about the pole',
      purpose: 'Understand why it is the sky that turns on an astrolabe.',
      body: 'The central pin is the north celestial pole, the still point of the sky. The astrolabe is drawn from where you stand: your plate stays put, and the sky (the rete) turns clockwise about the pole once a day, carrying every star with it. That is how the Earth’s turning looks from the ground.',
      result: 'Turning the rete clockwise lets time run forward.',
      highlights: ['pin', 'rete'], introduces: ['celestial-pole', 'daily-rotation'], uses: ['rete', 'plate'],
      snapshot: at(APRIL, 'front', { rete: P.start, rule: P.rule }),
    }),
    explain({
      id: 'find-arcturus', title: 'Find Arcturus',
      purpose: 'Pick the star to follow.',
      body: 'Find Arcturus’s pointer. Right now it is below the horizon, outside the circle on the left (east) side.',
      result: 'Arcturus has not risen yet.',
      highlights: [{ part: 'star-pointer', star: 'arcturus' }, 'horizon'], uses: ['star-pointer', 'horizon', 'east-west'],
      snapshot: at(APRIL, 'front', { rete: P.start, rule: P.rule }),
    }),
    demonstrate({
      id: 'follow-rising', title: 'Rising',
      purpose: 'See rising as a star crossing the eastern horizon.',
      body: 'Watch the rete turn clockwise until Arcturus’s tip touches the horizon on the east side. Then read its direction from the azimuth lines.',
      stopCue: 'The tip is on the horizon, just short of the 60° azimuth line.',
      result: `Arcturus rises in the north-east, at azimuth about ${deg(P.rise.azimuth)}: just short of the 60° line.`,
      highlights: [{ part: 'star-pointer', star: 'arcturus' }, 'horizon', { part: 'azimuth-line', azimuth: 60 }], introduces: ['rising'], uses: ['rotate-rete', 'horizon', 'azimuth-line'],
      snapshot: at(APRIL, 'front', { rete: P.start, rule: P.rule }),
      demonstration: turn('reteRotation', P.start, P.riseRete, 900),
      check: standsAt(ARCTURUS, P.riseRete),
    }),
    yourTurn({
      id: 'follow-culmination', title: 'Your turn: the highest point',
      purpose: 'Find the star’s highest point yourself.',
      body: 'Keep turning the rete clockwise until Arcturus crosses the meridian, the straight line above the centre. Read its height there.',
      stopCue: 'Arcturus’s tip is on the meridian line.',
      result: `Arcturus culminates due south at about ${deg(P.culmination.altitude)}: its greatest height of the day.`,
      highlights: [{ part: 'star-pointer', star: 'arcturus' }, 'meridian-line', { part: 'almucantar', altitude: 60 }], introduces: ['culmination'], uses: ['rotate-rete', 'meridian-line', 'read-alt-az'],
      snapshot: at(APRIL, 'front', { rete: P.riseRete, rule: P.rule }),
      check: standsAt(ARCTURUS, P.culminationRete),
      solution: { reteRotation: P.culminationRete },
    }),
    yourTurn({
      id: 'follow-setting', title: 'Your turn: setting',
      purpose: 'Complete the star’s path across the sky.',
      body: 'Keep turning clockwise until Arcturus’s tip touches the horizon on the west side.',
      stopCue: 'The tip is on the horizon, right of the meridian.',
      result: `Arcturus sets in the north-west, at azimuth about ${deg(P.set.azimuth)}, mirroring its rising.`,
      highlights: [{ part: 'star-pointer', star: 'arcturus' }, 'horizon'], introduces: ['setting'], uses: ['rotate-rete', 'horizon'],
      snapshot: at(APRIL, 'front', { rete: P.culminationRete, rule: P.rule }),
      check: standsAt(ARCTURUS, P.setRete),
      solution: { reteRotation: P.setRete },
    }),
    read({
      id: 'path-symmetry', title: 'What the path shows',
      purpose: 'Predict what holds for every star, not just Arcturus.',
      body: 'Think back over the path you followed: up from the eastern horizon, across the meridian, down to the western horizon.',
      result: 'Every star stands highest on the meridian, halfway between its rising and setting points.',
      highlights: ['meridian-line'], uses: ['culmination', 'rising', 'setting', 'meridian-line'],
      snapshot: at(APRIL, 'front', { rete: P.setRete, rule: P.rule }),
      check: choice('Where does a star stand highest?', [
        right('On the meridian'),
        wrong('Always at the zenith', 'Only a star that passes straight overhead reaches the zenith. Arcturus peaked well below it, on the meridian.'),
        wrong('On the east side, as it rises', 'A rising star is still climbing. It keeps climbing until it reaches the meridian.'),
      ]),
    }),
    yourTurn({
      id: 'circumpolar', title: 'Your turn: a star that never sets',
      purpose: 'Meet the stars close to the pole that never go below the horizon.',
      body: 'Turn the rete either way until Capella is at its lowest: on the meridian line below the pin.',
      stopCue: 'Capella’s tip is on the meridian line below the pin, still inside the horizon.',
      result: `Even at its lowest Capella is about ${deg(P.capella.altitude, 1)} above the northern horizon, so from London it never sets. Vega only just clears the horizon (${deg(P.vegaLowest, 1)}).`,
      highlights: [{ part: 'star-pointer', star: 'capella' }, 'pin', 'horizon', 'meridian-line'], introduces: ['circumpolar'], uses: ['rotate-rete', 'celestial-pole', 'read-alt-az', 'meridian-line'],
      snapshot: at(APRIL, 'front', { rete: P.setRete, rule: P.rule }),
      check: standsAt(CAPELLA, P.capellaRete, undefined, 1.5),
      solution: { reteRotation: P.capellaRete },
    }),
    explain({
      id: 'path-result', title: 'Daily path complete',
      purpose: 'Sum up a star’s day.',
      body: 'Rising in the east, culminating on the meridian, setting in the west; and stars near the pole never set at all.',
      result: `Arcturus has been followed from rising in the north-east (azimuth ${deg(P.rise.azimuth)}), to its highest point, due south and ${deg(P.culmination.altitude)} high, to setting in the north-west (azimuth ${deg(P.set.azimuth)}); Capella never sets. The pointers never move on the rete: turning the rete is the passing of the night.`,
      highlights: ['rete'], uses: ['daily-rotation'],
      snapshot: at(APRIL, 'front', { rete: P.capellaRete, rule: P.rule }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 5 — Find the Sun's place

const S = SUN_PLACE;
const aprilTick = eclipticTick(S.april.longitude);
const octoberTick = eclipticTick(S.october.longitude);
const sunPlace: Lesson = {
  id: 'back.sun-place.v1', version: 1, prerequisites: ['front.foundations.v1', 'front.read-star.v1'],
  title: 'Find the Sun’s place for any date',
  summary: 'Carry a calendar date across the back scales to the Sun’s place on the ecliptic, then find that point on the star map.',
  steps: [
    explain({
      id: 'suns-path', title: 'The Sun has no pointer',
      purpose: 'See why the date has to come first.',
      body: 'The off-centre ring on the rete is the ecliptic, the Sun’s yearly path among the stars. The stars have fixed pointers, but the Sun creeps round the ecliptic about 1° a day, so where it is depends on the date.',
      result: 'To use the Sun, first find where it is on the ecliptic today.',
      highlights: ['ecliptic-ring'], introduces: ['ecliptic'], uses: ['rete', 'star-pointer'],
      snapshot: at(APRIL, 'front'),
    }),
    demonstrate({
      id: 'date-to-longitude', title: 'Lay the alidade across the date',
      purpose: 'Use the back’s calendar as a ready-made table from date to the Sun’s place.',
      body: 'Watch the alidade turn until its edge passes through 20 April on the calendar ring. The 20 is one of the longer ticks, which come every five days within each month.',
      stopCue: 'The edge runs through the 20 April tick.',
      result: 'The same straight edge now also crosses the zodiac band and the degree scale at this date’s value.',
      highlights: [{ part: 'calendar-scale', date: '04-20' }, 'alidade-edge'], introduces: ['date-to-longitude'], uses: ['alidade', 'calendar-scale', 'fiducial-edge'],
      snapshot: at(APRIL, 'back'),
      demonstration: turn('alidadeRotation', 0, S.april.alidade),
      check: dateLine(S.april.longitude),
    }),
    read({
      id: 'read-longitude', title: 'Read the Sun’s longitude',
      purpose: 'Get the number you will carry to the front.',
      body: 'Follow the same end of the alidade outwards, across the zodiac band to the outer degree scale. Read the sign and the degrees.',
      stopCue: 'The edge crosses the zodiac band right at the boundary, with TAU on the far side; on the degree scale it is a little under halfway from 30° to 31°.',
      result: `On 20 April the Sun’s ecliptic longitude is about ${deg(S.april.longitude, 1)}, the very start of Taurus. Longitude is counted 0° to 360° from the start of Aries.`,
      highlights: ['zodiac-scale', 'back-degree-scale'], introduces: ['ecliptic-longitude', 'zodiac-sign', 'read-longitude'],
      // Magnify the alidade's date end: the date tick, the ARI–TAU boundary and the degree ticks round the reading.
      frame: [{ part: 'calendar-scale', date: '04-20' }, { part: 'back-degree-scale', degree: 25 }, { part: 'back-degree-scale', degree: 35 }], uses: ['back-degree-scale', 'zodiac-scale'],
      snapshot: at(APRIL, 'back', { alidade: S.april.alidade }),
      check: choice('Where is the Sun on 20 April?', [
        right(`About ${deg(S.april.longitude, 1)}, at the start of Taurus`),
        wrong(`About ${deg(S.april.longitude + 180, 1)}`, 'That is read at the other end of the alidade. Follow the end that passes through the date.'),
        wrong(`About ${deg(2 * Math.floor(S.april.longitude) - S.april.longitude, 1)}`, 'That counts the small ticks backwards. The degrees increase clockwise round the back, from 0° at the left up towards the top.'),
      ]),
    }),
    demonstrate({
      id: 'find-sun-point', title: `Find ${deg(S.april.longitude, 1)} on the rete`,
      purpose: 'Carry the Sun’s place to the front.',
      body: `On the rete, the ecliptic carries its own degree scale with half-degree ticks. Find ${deg(S.april.longitude, 1)}, a little short of the 30½ tick, and watch the rule turn until the edge of its numbered half, the Sun end, crosses the ecliptic there.`,
      stopCue: `The edge of the rule’s Sun end crosses the ecliptic at the ${deg(S.april.longitude, 1)} point.`,
      result: 'This point stands for the Sun for the whole of 20 April. Call it the Sun’s date point.',
      highlights: [aprilTick, 'rule-edge'], introduces: ['ecliptic-scale', 'sun-date-point', 'find-sun-point'], uses: ['ecliptic', 'ecliptic-longitude', 'lay-rule'],
      snapshot: at(APRIL, 'front'),
      demonstration: turn('ruleRotation', 0, S.april.rule),
      check: ruleOn(SUN_APRIL),
    }),
    explain({
      id: 'true-edge', title: 'Use the right edge of the band',
      purpose: 'Avoid reading the wrong edge of the ecliptic band.',
      body: 'The ecliptic band has two edges. The true ecliptic is the edge that just touches the Tropic of Cancer (the smallest circle centred on the pin) at 90° and reaches the Tropic of Capricorn (the plate’s rim) at 270°. It crosses the celestial equator, the middle circle, at 0° and 180°; on the rete, a narrow half-ring runs along half of the equator. Set the Sun’s point on that edge.',
      result: 'The degree numbers are crowded on one side of the band and spread out on the other. That is correct; trust the engraved numbers.',
      highlights: ['ecliptic-edge', 'tropic-cancer', 'equator', 'tropic-capricorn'], introduces: ['true-ecliptic-edge', 'tropic-cancer', 'equator', 'tropic-capricorn'], uses: ['ecliptic', 'ecliptic-scale'],
      // Rete turned so the band and the rete's half-ring clear the three circles' labels; rule turned aside.
      snapshot: at(APRIL, 'front', { rete: 310, rule: ASIDE_LEVEL }),
    }),
    yourTurn({
      id: 'second-date', title: 'Your turn: 23 October',
      purpose: 'Find a second date yourself.',
      body: 'On the back, turn the alidade until its edge passes through 23 October: three short ticks past the long 20 October tick.',
      stopCue: 'The edge runs through the 23 October tick.',
      result: 'The Sun’s place for 23 October lies along this line.',
      highlights: [{ part: 'calendar-scale', date: '10-23' }], uses: ['date-to-longitude'],
      // The edge's tip is added to the view by Magnify itself, now and at the answer.
      frame: [{ part: 'calendar-scale', date: '10-23' }],
      // Starts 32° short of the date line, so a phone's Magnify shows the edge and the tick together.
      snapshot: at(OCTOBER, 'back', { alidade: S.october.alidade - 32 }),
      check: dateLine(S.october.longitude),
      solution: { alidadeRotation: S.october.alidade },
    }),
    read({
      id: 'read-second', title: 'Read it',
      frame: [{ part: 'calendar-scale', date: '10-23' }, { part: 'back-degree-scale', degree: 205 }, { part: 'back-degree-scale', degree: 215 }],
      purpose: 'Make the second reading.',
      body: 'Read the zodiac band and the degree scale at the date end of the alidade.',
      stopCue: 'The edge crosses the zodiac band right at the boundary, with SCO on the far side; on the degree scale it is just past 210°.',
      result: `About ${deg(S.october.longitude, 1)}, the start of Scorpio: almost exactly opposite 20 April.`,
      highlights: ['back-degree-scale'], uses: ['read-longitude', 'zodiac-sign'],
      snapshot: at(OCTOBER, 'back', { alidade: S.october.alidade }),
      check: choice('Where is the Sun on 23 October?', [
        right(`About ${deg(S.october.longitude, 1)}, at the start of Scorpio`),
        wrong(`About ${deg(S.october.longitude - 180, 1)}`, 'That is the other end of the alidade. Read at the end that passes through 23 October.'),
        wrong(`About ${deg(S.october.longitude - 1, 1)}`, 'That is one tick short. The edge lies just past the 210° mark, not before it.'),
      ]),
    }),
    yourTurn({
      id: 'find-second-point', title: `Your turn: find ${deg(S.october.longitude, 1)} on the rete`,
      purpose: 'Find a Sun point yourself, and notice something about opposite dates.',
      body: `Turn the rule until the edge of its Sun end, the numbered half, crosses the ecliptic at ${deg(S.october.longitude, 1)}, just past the 210 mark.`,
      stopCue: 'The edge of the rule’s Sun end crosses the ecliptic just past 210°.',
      result: 'Look along the rule: its other half crosses the ecliptic near 30°. Opposite points of the ecliptic always lie on one straight line through the pole.',
      highlights: [octoberTick, aprilTick], introduces: ['opposite-points'], uses: ['find-sun-point', 'true-ecliptic-edge'],
      // Rule turned aside, well clear of the line through both points.
      snapshot: at(OCTOBER, 'front', { rule: ASIDE_LEVEL }),
      check: ruleOn(SUN_OCTOBER),
      solution: { ruleRotation: S.october.rule },
    }),
    explain({
      id: 'sun-place-result', title: 'The Sun’s place is the date',
      purpose: 'Sum up the method and its limits.',
      body: `20 April gives ${deg(S.april.longitude, 1)} (Taurus begins); 23 October gives ${deg(S.october.longitude, 1)} (Scorpio begins); mid-July gives about ${deg(S.july)}, near the Cancer edge, where the days are long. The engraved calendar is a fixed 365-day year. Old instruments often carry the Julian calendar, which is now days out. Many real retes also number the ecliptic sign by sign, 0 to 30 within each sign, not 0 to 360: there ${deg(S.april.longitude, 1)} is ${deg(S.april.longitude - 30, 1)} into Taurus and ${deg(S.october.longitude, 1)} is ${deg(S.october.longitude - 210, 1)} into Scorpio.`,
      result: `The Sun’s date point is ${deg(S.april.longitude, 1)} on 20 April and ${deg(S.october.longitude, 1)} on 23 October. Every timing lesson begins here.`,
      highlights: ['ecliptic-ring'], uses: ['sun-date-point'],
      snapshot: at(OCTOBER, 'front', { rule: S.october.rule }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 6 — Tell the time from the Sun's height (keystone)

const K = TIME_BY_SUN;
const kApril = K.april;
const kOctober = K.october;
const beforeNoon = 12 - kApril.time;
const timeBySunLesson: Lesson = {
  id: 'solar.time-by-sun.v1', version: 1, prerequisites: ['back.measure-altitude.v1', 'front.local-sky.v1', 'back.sun-place.v1'],
  title: 'Tell the time from the Sun’s height',
  summary: 'From a date and a measured height of the Sun, set the Sun on its height circle on the correct side and read the time on the limb.',
  steps: [
    explain({
      id: 'the-task', title: 'The question and what you know',
      purpose: 'Frame the task the astrolabe was built for.',
      body: `London, 20 April, morning. The Sun was measured at ${deg(MEASURED.aprilSun)} (Lesson 2) and its date point is ${deg(SUN_APRIL.longitude, 1)} (Lesson 5). The method: put the Sun’s point on its height circle, on the correct side, lay the rule over it, and read the limb.`,
      result: 'Two things you know, the date and the height, give one thing you want: the time.',
      highlights: [aprilTick], uses: ['sun-date-point', 'altitude'],
      snapshot: at(APRIL, 'front', { rete: K.aprilStartRete }),
    }),
    read({
      id: 'set-altitude', title: 'Read the measurement off the alidade',
      purpose: 'Start from the measured number, as you would on a real instrument.',
      body: 'On the back, the alidade is where your sighting of the Sun left it. Read the height where its edge crosses the red scale.',
      stopCue: 'The red number under the alidade’s edge.',
      result: `The height you will carry to the front is ${deg(MEASURED.aprilSun)}.`,
      highlights: ['alidade-edge', 'altitude-scale'], frame: redAround(MEASURED.aprilSun), uses: ['read-altitude-scale', 'altitude-scale'],
      snapshot: at(APRIL, 'back', { alidade: MEASURED.aprilSun }),
      check: alidadeHeight(MEASURED.aprilSun),
    }),
    read({
      id: 'choose-side', title: 'Morning or afternoon?',
      purpose: 'Decide the side first: in a day, the Sun’s point crosses each height circle below its noon height twice, once rising and once sinking.',
      body: 'It is morning, so the Sun is still climbing. Decide which half of the plate its point goes on.',
      result: 'East, the left half. A body that is still climbing is east of the meridian; one that is sinking is west of it. The highlighted line runs from the zenith to the due-east point of the horizon.',
      highlights: ['meridian-line', { part: 'azimuth-line', azimuth: 90 }], introduces: ['side-of-sky'], uses: ['east-west', 'meridian-line', 'rising'],
      // Rule turned aside, off the highlighted meridian.
      snapshot: at(APRIL, 'front', { rete: K.aprilStartRete, rule: LOCAL_SKY.rule }),
      check: choice('Which half of the plate does the morning Sun go on?', [
        right('East, the left half'),
        wrong('West, the right half', 'The west half is for the afternoon, when the Sun is sinking. In the morning it is climbing in the east.'),
        wrong('On the meridian', 'The Sun reaches the meridian only at noon, its highest point. In the morning it has not got there yet.'),
      ]),
    }),
    demonstrate({
      id: 'set-sun', title: 'Put the Sun on its height circle',
      purpose: 'Make the central alignment of the whole method.',
      body: `Watch the rete turn until the ${deg(SUN_APRIL.longitude, 1)} point sits on the ${deg(MEASURED.aprilSun)} almucantar, left of the meridian. The Sun’s point climbs from the eastern horizon to the ${deg(MEASURED.aprilSun)} circle.`,
      stopCue: `The ${deg(SUN_APRIL.longitude, 1)} tick touches the ${deg(MEASURED.aprilSun)} circle on the east side.`,
      result: 'The whole sky now stands as it did at the moment of the measurement.',
      highlights: [aprilTick, { part: 'almucantar', altitude: MEASURED.aprilSun }], introduces: ['set-on-almucantar'], uses: ['rotate-rete', 'almucantar', 'side-of-sky', 'sun-date-point'],
      // The rule stays turned aside, as in choose-side, so the meridian the copy names is not hidden.
      snapshot: at(APRIL, 'front', { rete: K.aprilStartRete, rule: LOCAL_SKY.rule }),
      demonstration: turn('reteRotation', K.aprilStartRete, kApril.rete, 900),
      check: standsAt(SUN_APRIL, kApril.rete),
    }),
    demonstrate({
      id: 'read-time', title: 'Lay the rule and read the time',
      purpose: 'Turn the setting into a time.',
      body: 'Watch the rule turn until the edge of its numbered half, the Sun end, runs over the Sun’s point. Then read the hour where that end meets the limb. (The numbers engraved along the rule are a declination scale; this course uses them only to tell the Sun end. On a real rule, which may be numbered on both halves or on neither, the Sun end is simply the half you lay over the Sun.)',
      stopCue: `The rule’s Sun end is just past the ${hourMarkNumber(kApril.time)} on the limb’s hour scale.`,
      result: `The time is about ${clock(kApril.time)} local apparent time: sundial time, in which 12:00 is the moment the Sun crosses the meridian.`,
      highlights: ['rule-edge', hourMark(kApril.time)], introduces: ['read-time', 'local-apparent-time'], uses: ['lay-rule', 'limb-hour-scale'],
      snapshot: at(APRIL, 'front', { rete: kApril.rete, rule: LOCAL_SKY.rule }),
      demonstration: turn('ruleRotation', LOCAL_SKY.rule, kApril.rule),
      check: standsAt(SUN_APRIL, kApril.rete, SUN_APRIL),
    }),
    read({
      id: 'degrees-to-hours', title: 'Check it with the degree ticks',
      purpose: 'Learn to turn degrees into hours, which also lets you read a limb with no hour numbers.',
      body: `The sky turns 15° an hour, so one degree of limb is 4 minutes. Measure from the 12 at the top to the rule: count whole hour marks first, 15° each, then the degree ticks past the last one. The rule stands about ${deg(kApril.hourAngle)} east of the noon line.`,
      stopCue: `${['No', 'One', 'Two', 'Three', 'Four', 'Five'][wholeHours(kApril.hourAngle)]} hour marks (${deg(wholeHours(kApril.hourAngle) * 15)}) from 12 back to ${12 - wholeHours(kApril.hourAngle)}, then about ${Math.round(kApril.hourAngle - wholeHours(kApril.hourAngle) * 15)} more ticks to the rule: ${deg(kApril.hourAngle)}.`,
      result: `${deg(kApril.hourAngle, 1)} ÷ 15 is ${duration(beforeNoon)} before noon, which is ${clock(kApril.time)}. The rule’s distance from the noon line is the Sun’s hour angle. If your own limb is numbered I to XII twice, the upper XII is noon; if it has only degrees, count them from the top as here.`,
      highlights: ['limb-degree-scale', 'rule-edge'], introduces: ['degrees-to-hours', 'hour-angle'],
      // Magnify the whole count: from the 12 at the top, past the hour marks, to the rule's end.
      frame: [{ part: 'limb-hour-scale', hour: 12 }, hourMark(kApril.time)], uses: ['limb-degree-scale', 'read-time'],
      snapshot: at(APRIL, 'front', { rete: kApril.rete, rule: kApril.rule }),
      check: choice(`What time is ${deg(kApril.hourAngle)} before noon?`, [
        right(clock(kApril.time)),
        wrong(clock(12 + beforeNoon), 'That counts the hours after noon. The rule is on the morning (east) side, so count back from 12.'),
        wrong(clock(12 - decimalSlip(beforeNoon)), `That reads ${beforeNoon.toFixed(2)} hours as ${Math.floor(beforeNoon)} h ${Math.round((beforeNoon % 1) * 100)} min. A decimal hour is not minutes: 0.${Math.round((beforeNoon % 1) * 100)} of an hour is ${Math.round((beforeNoon % 1) * 60)} minutes.`),
      ]),
    }),
    read({
      id: 'second-altitude', title: 'Your turn, example 2: the measurement',
      purpose: 'Use the same method on a different day, at a different time.',
      body: `London, 23 October, afternoon. The Sun’s date point is ${deg(SUN_OCTOBER.longitude, 1)}. Your sighting has left the alidade in place: read the height it shows.`,
      stopCue: 'The red number under the alidade’s edge.',
      result: `The Sun was ${deg(MEASURED.octoberSun)} high. Same procedure, different day and side of the sky.`,
      highlights: ['alidade-edge', 'altitude-scale'], frame: redAround(MEASURED.octoberSun), uses: ['read-altitude-scale', 'altitude-scale'],
      snapshot: at(OCTOBER, 'back', { alidade: MEASURED.octoberSun }),
      check: alidadeHeight(MEASURED.octoberSun),
    }),
    yourTurn({
      id: 'second-set-sun', title: 'Your turn: set the Sun',
      purpose: 'Make the side decision and the alignment yourself.',
      body: `It is afternoon. The Sun’s ${deg(SUN_OCTOBER.longitude, 1)} point is on the meridian at the moment. Turn the rete until that point sits on the ${deg(MEASURED.octoberSun)} almucantar on the correct side.`,
      stopCue: `The ${deg(SUN_OCTOBER.longitude, 1)} tick touches the ${deg(MEASURED.octoberSun)} circle, right of the meridian.`,
      result: 'An afternoon Sun is in the west.',
      highlights: [octoberTick, { part: 'almucantar', altitude: MEASURED.octoberSun }], uses: ['set-on-almucantar', 'side-of-sky'],
      // The rule is turned aside: at rest it would lie along the meridian, over the Sun's point and its 210 numeral.
      snapshot: at(OCTOBER, 'front', { rete: SUN_OCTOBER.raDeg, rule: ASIDE_LEVEL }),
      check: standsAt(SUN_OCTOBER, kOctober.rete),
      solution: { reteRotation: kOctober.rete },
    }),
    yourTurn({
      id: 'second-read-time', title: 'Your turn: read the time',
      purpose: 'Finish the second example.',
      body: 'Turn the rule until the edge of its Sun end, the numbered half, runs over the Sun’s point, and read the hour at that end.',
      stopCue: `The Sun end is about a third of the way from ${hourMarkNumber(kOctober.time)} to ${hourMarkNumber(kOctober.time) + 1}.`,
      result: `About ${clock(kOctober.time)} local apparent time: ${deg(kOctober.hourAngle, 1)} west of noon is ${duration(kOctober.time - 12)} after noon.`,
      highlights: [octoberTick, hourMark(kOctober.time)], uses: ['read-time', 'degrees-to-hours'],
      frame: [octoberTick, hourMark(kOctober.time), hourMark(kOctober.time + 1)],
      // The rule lies on the meridian, 35° from the Sun's point: close enough to Magnify together, far enough to look unsolved.
      snapshot: at(OCTOBER, 'front', { rete: kOctober.rete, rule: 0 }),
      check: standsAt(SUN_OCTOBER, kOctober.rete, SUN_OCTOBER),
      solution: { ruleRotation: kOctober.rule },
    }),
    yourTurn({
      id: 'between-circles', title: 'Your turn: a height between the circles',
      purpose: 'Set a measurement that falls between two engraved height circles, as most real sightings do.',
      body: `Back to 20 April. A later sighting gave ${deg(MEASURED.aprilBetween)}: halfway between the ${deg(30)} and ${deg(40)} circles, which are 10° apart. Turn the rete until the ${deg(SUN_APRIL.longitude, 1)} point sits halfway between them, on the east side. Then lay the rule’s Sun end over it and read the limb.`,
      stopCue: `The ${deg(SUN_APRIL.longitude, 1)} tick sits midway between the ${deg(30)} and ${deg(40)} circles, left of the meridian, and the rule’s Sun end runs over it, between ${hourMarkNumber(K.between.time)} and ${hourMarkNumber(K.between.time) + 1}.`,
      result: `The Sun stands at ${deg(MEASURED.aprilBetween)}, and the limb shows about ${clock(K.between.time)}: later than ${clock(kApril.time)}, because the morning Sun is still climbing.`,
      highlights: [aprilTick, { part: 'almucantar', altitude: 30 }, { part: 'almucantar', altitude: 40 }],
      frame: [aprilTick, { part: 'almucantar', altitude: 30 }, { part: 'almucantar', altitude: 40 }, hourMark(K.between.time), hourMark(K.between.time + 1)], uses: ['set-on-almucantar', 'interpolate', 'side-of-sky', 'read-time'],
      // The rule starts 33° from its answer, clear of the Sun's point, so Magnify can show the tool and the limb together.
      snapshot: at(APRIL, 'front', { rete: kApril.rete, rule: 80 }),
      check: standsAt(SUN_APRIL, K.between.rete, SUN_APRIL),
      solution: { reteRotation: K.between.rete, ruleRotation: K.between.rule },
    }),
    explain({
      id: 'time-result', title: 'What you have, and how good it is',
      purpose: 'Understand what kind of time this is, and when to trust it.',
      body: `${clock(kApril.time)} and ${clock(kOctober.time)} are sundial times, not the time on your watch; Lesson 9 converts them. Avoid measuring within about an hour and a half of noon. On 20 April a 1° error in height is about ${Math.round(K.minutesPerDegreeAt30)} minutes at ${deg(MEASURED.aprilSun)}, but the Sun rises less than 2° in the whole last hour before noon (${deg(K.altitudeAt11, 1)} at 11:00, ${deg(K.noonAltitude, 1)} at noon), so near noon a small error becomes a large one.`,
      result: `20 April, ${deg(MEASURED.aprilSun)} morning Sun → ${clock(kApril.time)}; 23 October, ${deg(MEASURED.octoberSun)} afternoon Sun → ${clock(kOctober.time)} local apparent time. This is Chaucer’s third conclusion, the use the instrument was built for.`,
      highlights: ['meridian-line'], introduces: ['near-noon-accuracy'], uses: ['local-apparent-time', 'almucantar'],
      snapshot: at(OCTOBER, 'front', { rete: kOctober.rete, rule: kOctober.rule }),
    }),
  ],
};
/** Hours misread as hours and hundredths of an hour taken as minutes (3.72 h as 3 h 72 min). */
function decimalSlip(hours: number): number {
  return Math.floor(hours) + Math.round((hours % 1) * 100) / 60;
}
/** Whole hour spaces (15° each) in an angle measured round the limb. */
function wholeHours(degrees: number): number {
  return Math.floor(degrees / 15);
}
function hourMarkNumber(hours: number): number {
  const ref = hourMark(hours);
  return typeof ref === 'object' && ref.part === 'limb-hour-scale' ? ref.hour : 0;
}

// ---------------------------------------------------------------------------
// Lesson 7 — Sunrise, noon, sunset

const EA = SOLAR_EVENTS.april;
const EO = SOLAR_EVENTS.october;
const solarEvents: Lesson = {
  id: 'solar.events.v1', version: 1, prerequisites: ['solar.time-by-sun.v1'],
  title: 'Find sunrise, noon, sunset and the length of the day',
  summary: 'Carry the Sun’s date point to the eastern horizon, the meridian and the western horizon, and read the times, the noon height and the length of the day.',
  steps: [
    explain({
      id: 'horizon-is-zero', title: 'Sunrise is altitude 0°',
      purpose: 'Reuse the time-telling method with a new height.',
      body: `Sunrise is the moment the Sun’s point reaches the horizon, the 0° height circle, on the east side; sunset is the same on the west side. Use ${deg(SUN_APRIL.longitude, 1)} for 20 April. The rete is where Lesson 6’s first example left it, with the Sun’s point on the ${deg(MEASURED.aprilSun)} circle; the rule is turned aside.`,
      result: 'No new parts are needed.',
      highlights: ['horizon', aprilTick], uses: ['horizon', 'sun-date-point', 'side-of-sky'],
      snapshot: at(APRIL, 'front', { rete: kApril.rete, rule: LOCAL_SKY.rule }),
    }),
    demonstrate({
      id: 'find-sunrise', title: 'Sunrise',
      purpose: 'See the Sun set on the horizon, and the time read from it.',
      body: 'Watch the rete turn back (anticlockwise) until the Sun’s point sits on the eastern horizon, with the rule following it. Then read the rule’s Sun end on the limb.',
      stopCue: `The ${deg(SUN_APRIL.longitude, 1)} tick is on the horizon, left side; the Sun end of the rule is at ${hourMarkNumber(EA.sunrise.time)}.`,
      result: `Sunrise is at ${clock(EA.sunrise.time)} local apparent time, in the east-north-east (azimuth about ${deg(EA.sunrise.azimuth)}).`,
      highlights: ['horizon', hourMark(EA.sunrise.time)], introduces: ['sunrise'], uses: ['set-on-almucantar', 'read-time'],
      snapshot: at(APRIL, 'front', { rete: kApril.rete, rule: kApril.rule }),
      demonstration: turn('reteRotation', kApril.rete, EA.sunrise.rete, 900, { field: 'ruleRotation', from: kApril.rule, to: EA.sunrise.rule }),
      check: standsAt(SUN_APRIL, EA.sunrise.rete, SUN_APRIL),
    }),
    yourTurn({
      id: 'find-noon', title: 'Your turn: noon and the noon height',
      purpose: 'Find the Sun’s crossing of the meridian.',
      body: 'Turn the rete clockwise until the Sun’s point crosses the meridian. Lay the rule’s Sun end over it. Read the time and the Sun’s height.',
      stopCue: 'The point is on the meridian line, and the rule’s Sun end points straight up at 12.',
      result: `Local apparent noon is 12:00, by definition. The Sun’s point sits on the ${deg(Math.round(EA.noon.altitude / 10) * 10)} circle, so the noon height is about ${deg(EA.noon.altitude)}: its greatest height of the day.`,
      highlights: [aprilTick, 'meridian-line', { part: 'almucantar', altitude: 50 }], introduces: ['local-noon', 'noon-altitude'], uses: ['meridian-line', 'read-alt-az', 'read-time'],
      // The rule starts off the Sun's point (low on the eastern horizon) so its tick can be seen.
      snapshot: at(APRIL, 'front', { rete: EA.sunrise.rete, rule: 320 }),
      check: standsAt(SUN_APRIL, EA.noon.rete, SUN_APRIL),
      solution: { reteRotation: EA.noon.rete, ruleRotation: EA.noon.rule },
    }),
    yourTurn({
      id: 'find-sunset', title: 'Your turn: sunset',
      purpose: 'Complete the day.',
      body: 'Keep turning clockwise until the Sun’s point reaches the western horizon. Lay the rule’s Sun end over it and read the limb.',
      stopCue: `The point is on the horizon, right side; the Sun end of the rule is at ${hourMarkNumber(EA.sunset.time)}.`,
      result: `Sunset is at ${clock(EA.sunset.time)}, in the west-north-west (azimuth about ${deg(EA.sunset.azimuth)}).`,
      highlights: [aprilTick, 'horizon', hourMark(EA.sunset.time)], introduces: ['sunset'], uses: ['read-time', 'horizon'],
      // The rule starts off the Sun's point (on the meridian) so its tick can be seen.
      snapshot: at(APRIL, 'front', { rete: EA.noon.rete, rule: 300 }),
      check: standsAt(SUN_APRIL, EA.sunset.rete, SUN_APRIL),
      solution: { reteRotation: EA.sunset.rete, ruleRotation: EA.sunset.rule },
    }),
    read({
      id: 'day-length', title: 'How long is the day?',
      purpose: 'Get the day’s length from two readings.',
      body: `You read sunrise at ${clock(EA.sunrise.time)} and sunset at ${clock(EA.sunset.time)}. The rule swept round the limb between them.`,
      result: `${clock(EA.sunset.time)} − ${clock(EA.sunrise.time)} = ${duration(EA.dayHours)}. The rule swept ${Math.round(EA.dayHours)} hour-spaces of 15° each round the limb, ${deg(EA.arc)} in all.`,
      highlights: ['limb-degree-scale'], introduces: ['day-length'], uses: ['sunrise', 'sunset', 'degrees-to-hours'],
      snapshot: at(APRIL, 'front', { rete: EA.sunset.rete, rule: EA.sunset.rule }),
      check: choice('How long is the Sun above the horizon on 20 April?', [
        right(duration(EA.dayHours)),
        wrong(duration(24 - EA.dayHours), 'That is the night: the time from sunset round to the next sunrise.'),
        wrong(duration(EA.dayHours / 2), 'That only runs from sunrise to noon. The day lasts until sunset.'),
      ]),
    }),
    yourTurn({
      id: 'second-sunrise', title: 'Your turn: sunrise on 23 October',
      purpose: 'Work a second day yourself.',
      body: `Use the ${deg(SUN_OCTOBER.longitude, 1)} point, which is on the meridian at the moment: note its height there, just under the ${deg(30)} circle. Find sunrise: set the point on the eastern horizon and lay the rule’s Sun end over it.`,
      stopCue: `The ${deg(SUN_OCTOBER.longitude, 1)} tick is on the eastern horizon and the rule’s Sun end runs over it.`,
      result: `Sunrise is at about ${clock(EO.sunrise.time)}, in the east-south-east (azimuth about ${deg(EO.sunrise.azimuth)}).`,
      highlights: ['horizon', octoberTick, { part: 'almucantar', altitude: 30 }], uses: ['sunrise', 'read-time', 'noon-altitude'],
      // The rule starts turned aside, so the Sun's point on the meridian can be seen.
      snapshot: at(OCTOBER, 'front', { rete: EO.noon.rete, rule: LOCAL_SKY.rule }),
      check: standsAt(SUN_OCTOBER, EO.sunrise.rete, SUN_OCTOBER),
      solution: { reteRotation: EO.sunrise.rete, ruleRotation: EO.sunrise.rule },
    }),
    yourTurn({
      id: 'second-sunset', title: 'Your turn: sunset and day length',
      purpose: 'Finish the second day.',
      body: 'Find sunset, then work out how long the day is.',
      stopCue: `The ${deg(SUN_OCTOBER.longitude, 1)} tick is on the western horizon and the rule’s Sun end runs over it.`,
      result: `Sunset is at about ${clock(EO.sunset.time)}; the day lasts about ${duration(EO.dayHours)}, and the noon height is only ${deg(EO.noon.altitude)}.`,
      highlights: [octoberTick, 'horizon', hourMark(EO.sunset.time)], uses: ['sunset', 'day-length', 'noon-altitude'],
      // The rule starts off the Sun's point (on the eastern horizon) so its tick can be seen.
      snapshot: at(OCTOBER, 'front', { rete: EO.sunrise.rete, rule: 0 }),
      check: standsAt(SUN_OCTOBER, EO.sunset.rete, SUN_OCTOBER),
      solution: { reteRotation: EO.sunset.rete, ruleRotation: EO.sunset.rule },
    }),
    explain({
      id: 'interpret-day', title: 'Compare the two days',
      purpose: 'See how the season shapes the day, and how the real sky differs.',
      body: `In April the Sun rises north of east (${deg(EA.sunrise.azimuth)}) and the day lasts ${Math.round(EA.dayHours)} hours. In October it rises south of east (${deg(EO.sunrise.azimuth)}) and the day lasts about ${Math.round(EO.dayHours)} hours. The astrolabe’s horizon is a perfect geometric line: the real Sun’s upper edge, lifted by the air, appears a few minutes before the ${clock(EA.sunrise.time)} and ${clock(EO.sunrise.time)} found here, and lingers a few minutes after sunset.`,
      result: `20 April: ${clock(EA.sunrise.time)}–${clock(EA.sunset.time)}, ${duration(EA.dayHours)}; 23 October: ${clock(EO.sunrise.time)}–${clock(EO.sunset.time)}, ${duration(EO.dayHours)} (local apparent time, geometric horizon). The rising direction and the day length both follow from the Sun’s place.`,
      highlights: ['horizon', { part: 'azimuth-line', azimuth: 90 }, { part: 'azimuth-line', azimuth: 120 }], introduces: ['rising-azimuth', 'geometric-horizon'], uses: ['sunrise', 'azimuth-line', 'day-length'],
      // October sunrise, rule turned aside: the Sun's point sits just south of east, between the 90° and 120° lines.
      snapshot: at(OCTOBER, 'front', { rete: EO.sunrise.rete, rule: 330 }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 8 — Time by a star

const NA = TIME_BY_STAR.april;
const NO = TIME_BY_STAR.october;
/** About 49° from the second-read solution, over 45° from its 180° flip, and clear of Vega at its 50° western setting; near enough for Magnify to show the tool and the answer together. */
const ASIDE_SECOND_READ = 282;
/** Clear of Arcturus's blade when the rete stands at its start (a level rule lay across it). */
const NIGHT_ASIDE = 60;
const timeByStarLesson: Lesson = {
  id: 'night.time-by-star.v1', version: 1, prerequisites: ['front.read-star.v1', 'solar.time-by-sun.v1'],
  title: 'Tell the time at night from a star',
  summary: 'Set a measured star on its height circle, then read the time at the Sun’s hidden date point.',
  steps: [
    explain({
      id: 'night-problem', title: 'No Sun to measure',
      purpose: 'Tell the time when the Sun is down.',
      body: 'At night you measure a bright star you can recognise. What you know: 20 April, evening; Arcturus has just been measured, still in the east and climbing.',
      result: 'The star sets the sky; the Sun still gives the time.',
      highlights: [{ part: 'star-pointer', star: 'arcturus' }], uses: ['star-pointer', 'side-of-sky'],
      // The rule is turned aside here and in the next steps, off the meridian and the crossing of the 40° circle with it.
      snapshot: at(APRIL, 'front', { rete: NA.start, rule: NIGHT_ASIDE }),
    }),
    read({
      id: 'star-altitude', title: 'Read the measurement off the alidade',
      purpose: 'Start from the star’s measured height.',
      body: 'On the back, the alidade is where your sighting of Arcturus left it. Read the height on the red scale.',
      stopCue: 'The red number under the alidade’s edge.',
      result: `Arcturus’s height is ${deg(NA.altitude)}.`,
      highlights: ['alidade-edge', 'altitude-scale'], frame: redAround(NA.altitude), uses: ['read-altitude-scale', 'altitude-scale'],
      snapshot: at(APRIL, 'back', { alidade: NA.altitude }),
      check: alidadeHeight(NA.altitude),
    }),
    demonstrate({
      id: 'set-star', title: 'Put the star on its height circle',
      purpose: 'Make the same alignment as with the Sun, using a star pointer.',
      body: `Watch the rete turn until Arcturus’s tip sits on the ${deg(NA.altitude)} almucantar on the east side.`,
      stopCue: `The tip touches the ${deg(NA.altitude)} circle, left of the meridian.`,
      result: 'The sky is set for the moment of the measurement.',
      highlights: [{ part: 'star-pointer', star: 'arcturus' }, { part: 'almucantar', altitude: NA.altitude }], uses: ['set-on-almucantar', 'side-of-sky'],
      snapshot: at(APRIL, 'front', { rete: NA.start, rule: NIGHT_ASIDE }),
      demonstration: turn('reteRotation', NA.start, NA.rete, 900),
      check: standsAt(ARCTURUS, NA.rete),
    }),
    read({
      id: 'where-to-read', title: 'Where do you read the time?',
      purpose: 'Choose the right point to lay the rule over.',
      body: `You could lay the rule over Arcturus, over the ${deg(NA.altitude)} circle, or over the Sun’s date point (${deg(SUN_APRIL.longitude, 1)}), which is now below the horizon.`,
      result: 'Always the Sun’s point. Clock hours count the Sun’s turning, not a star’s.',
      highlights: [aprilTick, { part: 'star-pointer', star: 'arcturus' }], introduces: ['time-from-sun-point'], uses: ['sun-date-point', 'local-apparent-time'],
      snapshot: at(APRIL, 'front', { rete: NA.rete, rule: ASIDE_LEVEL }),
      check: choice('Which point gives the time?', [
        right('The Sun’s date point, even below the horizon'),
        wrong('Arcturus', 'A star’s place gives star time, which drifts about 4 minutes a day against the clock. Hours are counted by the Sun.'),
        wrong(`Where the ${deg(NA.altitude)} circle meets the meridian`, 'Nothing stands there: it is just a crossing of two engraved lines.'),
      ]),
    }),
    demonstrate({
      id: 'read-at-sun', title: 'Read the time at the Sun’s point',
      purpose: 'Finish the first example.',
      body: `Without moving the rete, watch the rule turn until the edge of its Sun end runs over the ${deg(SUN_APRIL.longitude, 1)} point. Read the Sun end on the limb.`,
      stopCue: `The Sun end is just past ${hourMarkNumber(NA.time)}.`,
      result: `The time is about ${clock(NA.time)} local apparent time. The Sun is well below the north-western horizon (about ${deg(-NA.sunAltitude)}, deeper than this plate’s height circles go), so it is getting dark.`,
      highlights: [aprilTick, hourMark(NA.time)], uses: ['read-time', 'time-from-sun-point'],
      snapshot: at(APRIL, 'front', { rete: NA.rete, rule: ASIDE_LEVEL }),
      demonstration: turn('ruleRotation', ASIDE_LEVEL, NA.rule),
      check: standsAt(ARCTURUS, NA.rete, SUN_APRIL),
    }),
    read({
      id: 'second-star-altitude', title: 'Your turn, example 2: Vega',
      purpose: 'Use a different star, season and side of the sky.',
      body: '23 October, evening. Vega has been measured in the west, past its highest point. Read the height your sighting left on the alidade.',
      stopCue: 'The red number under the alidade’s edge.',
      result: `Vega’s height is ${deg(NO.altitude)}.`,
      highlights: ['alidade-edge', 'altitude-scale'], frame: redAround(NO.altitude), uses: ['read-altitude-scale', 'altitude-scale'],
      snapshot: at(OCTOBER, 'back', { alidade: NO.altitude }),
      check: alidadeHeight(NO.altitude),
    }),
    yourTurn({
      id: 'second-set-star', title: 'Your turn: set Vega',
      purpose: 'Make the alignment yourself.',
      body: `Vega is on the meridian at the moment. Turn the rete until Vega’s tip sits on the ${deg(NO.altitude)} almucantar on the west side.`,
      stopCue: `The tip touches the ${deg(NO.altitude)} circle, right of the meridian.`,
      result: 'Vega never sets from London (Lesson 4), so “west” here means after it has passed its highest point.',
      highlights: [{ part: 'star-pointer', star: 'vega' }, { part: 'almucantar', altitude: NO.altitude }], uses: ['set-on-almucantar', 'circumpolar'],
      // The rule is turned aside, off Vega on the meridian and off its 50° western target.
      snapshot: at(OCTOBER, 'front', { rete: NO.start, rule: 60 }),
      check: standsAt(VEGA, NO.rete),
      solution: { reteRotation: NO.rete },
    }),
    yourTurn({
      id: 'second-read', title: 'Your turn: read the time',
      purpose: 'Finish the second example.',
      body: `Turn the rule until the edge of its Sun end runs over the Sun’s ${deg(SUN_OCTOBER.longitude, 1)} point, and read the limb.`,
      stopCue: `The Sun end is a little under halfway from ${hourMarkNumber(NO.time)} to ${hourMarkNumber(NO.time) + 1}.`,
      result: `The time is about ${clock(NO.time)} local apparent time.`,
      highlights: [octoberTick, hourMark(NO.time)], uses: ['read-time', 'time-from-sun-point'],
      frame: [octoberTick, hourMark(NO.time), hourMark(NO.time + 1)],
      // The rule starts well aside of the solution and of its flipped position (and off Vega), so nothing looks solved.
      snapshot: at(OCTOBER, 'front', { rete: NO.rete, rule: ASIDE_SECOND_READ }),
      check: standsAt(VEGA, NO.rete, SUN_OCTOBER),
      solution: { ruleRotation: NO.rule },
    }),
    explain({
      id: 'night-result', title: 'Night readings and the real sky',
      purpose: 'Know what to watch for when you try this outside.',
      body: `${clock(NA.time)} and ${clock(NO.time)} are again sundial times. In the real sky the hard part is recognising the star, so start with one or two you cannot mistake. Avoid stars near the meridian, for the same reason as the noon Sun.`,
      result: `Arcturus ${deg(NA.altitude)} east on 20 April → ${clock(NA.time)}; Vega ${deg(NO.altitude)} west on 23 October → ${clock(NO.time)} local apparent time. Any star on the rete is a night clock.`,
      highlights: ['rete'], uses: ['near-noon-accuracy', 'local-apparent-time'],
      snapshot: at(OCTOBER, 'front', { rete: NO.rete, rule: NO.rule }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 9 — Clock time

const CA = CLOCK_TIME.april;
const CO = CLOCK_TIME.october;
const WA = WATCH.april;
const WO = WATCH.october;
const WB = WATCH.bristol;
const halfMinute = `${WA.longitudeMinutes.toFixed(1)} min`;

const eotTable = WATCH.table.map((row) => `${row.month} ${Math.round(row.minutes) === 0 ? '0' : signedMinutes(row.minutes).replace(' min', '')}`).join(', ');
const equationTime: Lesson = {
  id: 'back.equation-time.v1', version: 1, prerequisites: ['back.sun-place.v1', 'solar.time-by-sun.v1'],
  title: 'Turn astrolabe time into the time on your watch',
  summary: 'Read the equation of time for the date on the back, then apply it, your longitude and summer time to turn sundial time into clock time.',
  steps: [
    explain({
      id: 'three-differences', title: 'Why your watch disagrees',
      purpose: 'Understand why the astrolabe and your watch give different times.',
      body: 'The astrolabe gives sundial time for your exact place. Your watch keeps one even time for a whole zone, set by the zone’s meridian (Greenwich for Britain, 15° E for central Europe), plus an hour in summer. So there are three corrections: the equation of time, your longitude, and summer time.',
      result: `They can work against each other. In late October the sundial is a quarter of an hour fast, but summer time puts the watch an hour ahead, so the watch is only about three quarters of an hour ahead of the sundial. In late July the sundial is about ${Math.round(-WATCH.julyEquation)} minutes slow as well, and the watch is over an hour ahead.`,
      highlights: ['eot-curve'], uses: ['local-apparent-time'],
      snapshot: at(APRIL, 'back'),
    }),
    explain({
      id: 'eot-loop', title: 'The equation-of-time loop',
      purpose: 'Meet the first correction and where it is engraved.',
      body: 'Through the year the sundial runs up to about 16 minutes fast or 14 minutes slow. The equation of time is sundial time minus even (mean) time. On this back it is the loop, read against the minute scale on one arm of the alidade. Where the loop lies outside the scale’s 0 mark, the sundial is ahead (plus); inside it, behind (minus).',
      result: `Each date’s point on the loop gives that day’s correction. Most real astrolabes have no loop: use a printed table instead. Approximate mid-month values, sundial minus mean time, in minutes: ${eotTable}.`,
      highlights: ['eot-curve', 'alidade-minute-scale'], introduces: ['equation-of-time', 'alidade-minute-scale'], uses: ['eot-curve', 'alidade'],
      snapshot: at(APRIL, 'back'),
    }),
    demonstrate({
      id: 'lay-minute-arm', title: 'Lay the minute arm over the date',
      purpose: 'Put the arm that carries the minute numbers on the date’s side.',
      body: 'Watch the alidade turn so that the arm carrying the minute numbers runs through 20 April on the calendar ring.',
      stopCue: 'The minute arm’s edge passes through the 20 April tick and crosses the loop.',
      result: 'Where the loop crosses the minute scale is today’s equation.',
      highlights: [{ part: 'calendar-scale', date: '04-20' }, 'alidade-minute-scale'], uses: ['date-to-longitude', 'alidade-minute-scale'],
      snapshot: at(APRIL, 'back'),
      demonstration: turn('alidadeRotation', 0, CA.alidade),
      check: near('alidadeRotation', CA.alidade),
    }),
    read({
      id: 'read-eot', title: 'Read the equation',
      purpose: 'Get the number of minutes.',
      body: 'Read the minute scale where the loop crosses it. The numbers are upside down here: outward from 0 is plus.',
      stopCue: 'The loop crosses just outside the 0 mark, at the first minute tick.',
      result: `About ${signedMinutes(CA.equation)}: the sundial is a minute ahead of even time.`,
      highlights: ['eot-curve', 'alidade-minute-scale'], introduces: ['read-eot'],
      // Magnify the minute scale, where the loop crosses it, not the whole loop.
      frame: ['alidade-minute-scale'], uses: ['alidade-minute-scale', 'equation-of-time'],
      snapshot: at(APRIL, 'back', { alidade: CA.alidade }),
      check: choice('What is the equation of time on 20 April?', [
        right(signedMinutes(CA.equation)),
        wrong(signedMinutes(-CA.equation), 'The sign is the wrong way round. The loop lies outside the 0 mark, so the sundial is ahead: plus.'),
        wrong(signedMinutes(CO.equation), 'That is where the loop crosses the other arm, beyond the pivot. Read only the arm that runs through the date.'),
      ]),
    }),
    read({
      id: 'apply-corrections', title: `From ${clock(WA.apparent)} to your watch`,
      purpose: 'Apply all three corrections to the first example.',
      body: `Start from Lesson 6’s ${clock(WA.apparent)}, and work in whole minutes. First subtract the equation: ${clock(WA.apparent)} − ${WA.equation} min = ${clock(WA.mean)} local mean time. Then your longitude: London is ${deg(-LONGITUDE, 2)} west of Greenwich; each degree is 4 minutes, and west means add, so +${halfMinute}, which does not change the minute: still ${clock(WA.zone)} GMT. Finally, British Summer Time is in force on 20 April: add an hour.`,
      result: `${clock(WA.summer)} BST.`,
      highlights: ['eot-curve'], introduces: ['local-mean-time', 'longitude-correction', 'summer-time'], uses: ['read-eot', 'degrees-to-hours'],
      snapshot: at(APRIL, 'back', { alidade: CA.alidade }),
      check: choice('What does your phone say?', [
        right(clock(WA.summer)),
        wrong(clock(WA.zone), 'That forgets summer time. British Summer Time adds an hour from late March to late October.'),
        wrong(clock(WA.apparent + (WA.equation + WA.longitudeWhole) / 60 + 1), 'That adds the equation instead of subtracting it. A sundial that is ahead must be set back.'),
      ]),
    }),
    yourTurn({
      id: 'second-minute-arm', title: 'Your turn: 23 October',
      purpose: 'Find a second, much larger correction yourself.',
      body: 'Turn the alidade until the arm carrying the minute numbers runs through 23 October. It will point into the lower right, across the shadow square: almost opposite where it pointed for 20 April.',
      stopCue: 'The minute arm’s edge passes through the 23 October tick.',
      result: '23 October is almost opposite 20 April on the ring, which is why the arm has swung round.',
      highlights: [{ part: 'calendar-scale', date: '10-23' }], uses: ['date-to-longitude', 'alidade-minute-scale'],
      // Magnify shows the tick and the part of the arm that reaches it, so the part to turn is on screen.
      frame: [{ part: 'calendar-scale', date: '10-23' }, 'alidade-minute-scale'],
      // Starts level: left where the 20 April step put it, the other arm would lie over (and hide) the 23 October tick.
      snapshot: at(OCTOBER, 'back'),
      check: near('alidadeRotation', CO.alidade),
      solution: { alidadeRotation: CO.alidade },
    }),
    read({
      id: 'second-read-eot', title: 'Your turn: read the equation',
      purpose: 'Read the second correction.',
      body: 'Read the loop against the minute scale.',
      stopCue: 'The loop crosses just beyond the +15 mark.',
      result: `About ${signedMinutes(CO.equation)}: the sundial is a quarter of an hour fast.`,
      highlights: ['alidade-minute-scale'], uses: ['read-eot'],
      snapshot: at(OCTOBER, 'back', { alidade: CO.alidade }),
      check: choice('What is the equation of time on 23 October?', [
        right(signedMinutes(CO.equation)),
        wrong(signedMinutes(-CO.equation), 'The sign is the wrong way round. The loop lies well outside the 0 mark, so the sundial is ahead.'),
        wrong(signedMinutes(CA.equation), 'That is the other arm’s crossing, near the pivot, which belongs to 20 April.'),
      ]),
    }),
    read({
      id: 'second-apply', title: `Your turn: from ${clock(WO.apparent)} to your watch`,
      purpose: 'Apply the three corrections yourself.',
      body: `Start from Lesson 6’s ${clock(WO.apparent)} and apply the three corrections, in whole minutes. British Summer Time is still in force on 23 October 2026; it ends on 25 October.`,
      result: `${clock(WO.apparent)} − ${WO.equation} min = ${clock(WO.mean)}; +${halfMinute} does not change the minute, so ${clock(WO.zone)} GMT; + 1 h = ${clock(WO.summer)} BST.`,
      highlights: ['eot-curve'], uses: ['local-mean-time', 'longitude-correction', 'summer-time'],
      snapshot: at(OCTOBER, 'back', { alidade: CO.alidade }),
      check: choice('What does your phone say?', [
        right(clock(WO.summer)),
        wrong(clock(WO.apparent + (WO.equation + WO.longitudeWhole) / 60 + 1), `That adds the equation. The sundial is ${WO.equation} minutes ahead, so take ${WO.equation} minutes off.`),
        wrong(clock(WO.zone), 'That forgets summer time, which is still in force until 25 October.'),
      ]),
    }),
    read({
      id: 'longitude-drill', title: 'Same reading, another town',
      purpose: 'See the longitude correction at a size you can notice.',
      body: `Bristol is at almost the same latitude (51.45° N, so the same plate) but ${deg(-BRISTOL_LONGITUDE, 1)} west. Suppose the 23 October reading of ${clock(WB.apparent)} had been made there.`,
      result: `${(-BRISTOL_LONGITUDE).toFixed(1)} × 4 = ${WB.longitudeMinutes.toFixed(1)} min, about ${WB.longitudeWhole} min. So ${clock(WB.mean)} local mean time + ${WB.longitudeWhole} min = ${clock(WB.zone)} GMT, which is ${clock(WB.summer)} BST.`,
      uses: ['longitude-correction'],
      snapshot: at(OCTOBER, 'back', { alidade: CO.alidade }),
      check: choice('What would a phone in Bristol say?', [
        right(clock(WB.summer)),
        wrong(clock(WB.mean - WB.longitudeWhole / 60 + 1), 'That subtracts for west. West of Greenwich the Sun comes late, so add 4 minutes per degree.'),
        wrong(clock(WO.summer), 'That is London’s answer. Bristol is further west, so its correction is larger.'),
      ]),
    }),
    explain({
      id: 'eot-result', title: 'The full chain',
      purpose: 'Put the whole conversion together, and try it for real.',
      body: 'Astrolabe time minus the equation gives local mean time; add 4 minutes per degree west of your time zone’s meridian (subtract per degree east) for zone time. For Britain that meridian is Greenwich (0°); central Europe uses 15° E, US Eastern time 75° W. Then add the summer hour for your watch. For a first real session: on a clear morning at least an hour and a half from noon, measure the Sun three times and average, work out the time, convert it, and compare with your phone. Within about 10 minutes either way is a good result for a hand-held instrument.',
      result: `${clock(WA.apparent)} → ${clock(WA.summer)} BST on 20 April; ${clock(WO.apparent)} → ${clock(WO.summer)} BST on 23 October (${clock(WB.summer)} in Bristol). The astrolabe has become a watch.`,
      highlights: ['eot-curve'], uses: ['local-mean-time', 'near-noon-accuracy'],
      snapshot: at(OCTOBER, 'back', { alidade: CO.alidade }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 10 — Seasonal hours

const UA = SEASONAL_HOURS.april;
const UO = SEASONAL_HOURS.october;
/** Rule turned aside, clear of the hour lines' western starts, line VI and the April nadir point. */
const ASIDE_UNEQUAL = 330;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const unequalHours: Lesson = {
  id: 'front.unequal-hours.v1', version: 1, prerequisites: ['back.sun-place.v1', 'solar.events.v1'],
  title: 'Tell the seasonal (unequal) hour',
  summary: 'Divide the day into twelve seasonal hours, then use the Sun’s opposite point and the hour lines under the horizon to find when an hour ends.',
  steps: [
    read({
      id: 'temporal-hours', title: 'Hours that stretch with the season',
      purpose: 'Work out a seasonal hour before looking for it on the plate.',
      body: `Medieval “hours of the day” split the time from sunrise to sunset into 12 equal parts. On 20 April the day is ${Math.round(EA.dayHours)} hours long, so each hour is ${Math.round(UA.hourMinutes)} minutes. On 23 October the day is ${duration(EO.dayHours)}.`,
      result: `${Math.round(EO.dayHours)} h ÷ 12 is about ${Math.round(UO.hourMinutes)} minutes. The sixth hour always ends at noon, sundial time.`,
      introduces: ['unequal-hour'], uses: ['day-length', 'sunrise', 'sunset'],
      snapshot: at(APRIL, 'front', { rete: EA.sunrise.rete, rule: EA.sunrise.rule }),
      check: choice('How long is one seasonal hour on 23 October?', [
        right(`About ${Math.round(UO.hourMinutes)} min`),
        wrong('60 min', 'That is an equal hour. A seasonal hour is a twelfth of the daylight, and October days are short.'),
        wrong(`About ${Math.round(UA.hourMinutes)} min`, 'That is April’s hour. October’s daylight is shorter, so its hours are too.'),
      ]),
    }),
    explain({
      id: 'hour-lines', title: 'The hour lines under the horizon',
      purpose: 'Find the engraving that marks seasonal hours.',
      body: 'Below the horizon the plate carries 11 curved unequal-hour lines, numbered I to XI. They run from the western horizon (the start) round to the eastern horizon (the end of XII); line VI lies on the meridian below the pole.',
      result: 'They divide the hidden half of the sky into twelve parts.',
      highlights: ['unequal-hour-line', { part: 'unequal-hour-line', hour: 6 }], introduces: ['unequal-hour-line'], uses: ['horizon', 'meridian-line'],
      // A rete angle that leaves the starts of lines I–III clear of the ecliptic ring, and the rule turned aside off line VI.
      snapshot: at(APRIL, 'front', { rete: UO.rete, rule: ASIDE_UNEQUAL }),
    }),
    explain({
      id: 'opposite-point', title: 'Use the Sun’s opposite point',
      purpose: 'Learn the trick that makes the lines usable by day.',
      body: `By day the Sun is above the horizon, where there are no hour lines. So use the point exactly opposite it on the ecliptic, its nadir. For ${deg(SUN_APRIL.longitude, 1)} that is ${deg(UA.nadirLongitude, 1)}. As in Lesson 5, a rule laid over the Sun also crosses it. Here the Sun is rising; the rule is turned aside so that you can see the ${deg(UA.nadirLongitude, 1)} point, low on the western side.`,
      result: 'When the Sun has done three hours of its day, its nadir has done three hours of the night side.',
      highlights: [eclipticTick(UA.nadirLongitude)], introduces: ['sun-nadir-point'], uses: ['opposite-points', 'sun-date-point', 'rule'],
      snapshot: at(APRIL, 'front', { rete: EA.sunrise.rete, rule: ASIDE_UNEQUAL }),
    }),
    demonstrate({
      id: 'end-of-hour-three', title: `Turn to the end of hour ${ROMAN[UA.hour]}`,
      purpose: 'See the opposite point set on an hour line.',
      body: `Watch the rete turn clockwise, with the rule following, until the opposite point (${deg(UA.nadirLongitude, 1)}) sits on line ${ROMAN[UA.hour]}: the third line counting from the western horizon.`,
      stopCue: `The ${deg(UA.nadirLongitude, 1)} tick is on line ${ROMAN[UA.hour]}.`,
      result: `The ${ordinal(UA.hour)} seasonal hour of 20 April is ending, and the rule’s Sun end still runs through the Sun’s ${deg(SUN_APRIL.longitude, 1)} point.`,
      highlights: [{ part: 'unequal-hour-line', hour: UA.hour }, eclipticTick(UA.nadirLongitude)], uses: ['unequal-hour-line', 'sun-nadir-point', 'rotate-rete', 'lay-rule'],
      // Magnify the reading spot: the opposite point, where line III and the rule's other half cross it (the whole line is too long).
      frame: [eclipticTick(UA.nadirLongitude - 2), eclipticTick(UA.nadirLongitude + 2)],
      snapshot: at(APRIL, 'front', { rete: EA.sunrise.rete, rule: EA.sunrise.rule }),
      demonstration: turn('reteRotation', EA.sunrise.rete, UA.rete, 900, { field: 'ruleRotation', from: EA.sunrise.rule, to: UA.rule }),
      check: standsAt(UA.nadir, UA.rete, SUN_APRIL),
    }),
    read({
      id: 'read-hour-three', title: 'Read the equal time',
      purpose: 'Turn the seasonal hour into ordinary clock hours.',
      body: 'Read the rule’s Sun end on the limb.',
      stopCue: 'The Sun end is halfway between 8 and 9.',
      result: `${clock(UA.time)}, which matches ${clock(EA.sunrise.time)} + 3 × ${Math.round(UA.hourMinutes)} min. Lesson 6’s ${clock(kApril.time)} was just before the end of hour ${ROMAN[UA.hour]}.`,
      highlights: [hourMark(UA.time)], uses: ['read-time', 'unequal-hour'],
      snapshot: at(APRIL, 'front', { rete: UA.rete, rule: UA.rule }),
      check: choice(`When does hour ${ROMAN[UA.hour]} end on 20 April?`, [
        right(clock(UA.time)),
        wrong(clock(UA.time + 12), 'That is read at the nadir’s end of the rule. The time is always read at the Sun’s end.'),
        wrong(clock(UA.time + 1), 'That is an hour too late. Read the limb where the Sun end actually lies.'),
      ]),
    }),
    yourTurn({
      id: 'end-of-hour-nine', title: `Your turn: hour ${ROMAN[UO.hour]} on 23 October`,
      purpose: 'Find a seasonal hour in the afternoon yourself.',
      body: `The Sun is at ${deg(SUN_OCTOBER.longitude, 1)}, so its opposite point is ${deg(UO.nadirLongitude, 1)}; right now the Sun is on the meridian. Turn the rete until the opposite point sits on line ${ROMAN[UO.hour]}, the third line after VI towards the eastern horizon, and keep the rule’s Sun end over the Sun.`,
      stopCue: `The ${deg(UO.nadirLongitude, 1)} tick is on line ${ROMAN[UO.hour]}, and the rule’s Sun end runs through ${deg(SUN_OCTOBER.longitude, 1)}.`,
      result: `The ${ordinal(UO.hour)} seasonal hour of 23 October is ending.`,
      highlights: [{ part: 'unequal-hour-line', hour: UO.hour }], uses: ['unequal-hour-line', 'sun-nadir-point', 'rotate-rete', 'lay-rule'],
      // Both halves of the stop cue: the hour line to reach and the Sun's tick the rule must keep running through.
      frame: [{ part: 'unequal-hour-line', hour: UO.hour }, eclipticTick(SUN_OCTOBER.longitude)],
      snapshot: at(OCTOBER, 'front', { rete: EO.noon.rete, rule: EO.noon.rule }),
      check: standsAt(UO.nadir, UO.rete, SUN_OCTOBER),
      solution: { reteRotation: UO.rete, ruleRotation: UO.rule },
    }),
    read({
      id: 'read-hour-nine', title: 'Your turn: read it',
      purpose: 'Finish the second example.',
      body: 'Read the limb at the rule’s Sun end.',
      result: `About ${clock(UO.time)}, which matches sunrise (${clock(EO.sunrise.time)}) plus nine hours of about ${Math.round(UO.hourMinutes)} minutes.`,
      highlights: [hourMark(UO.time)], uses: ['read-time'],
      snapshot: at(OCTOBER, 'front', { rete: UO.rete, rule: UO.rule }),
      check: choice(`When does hour ${ROMAN[UO.hour]} end on 23 October?`, [
        right(clock(UO.time)),
        wrong(clock(EO.sunrise.time + UO.hour), 'That assumes 60-minute hours. October’s seasonal hours are only about 50 minutes long.'),
        wrong(clock(UO.time - 12), 'That is read at the nadir’s end of the rule. Read the Sun’s end.'),
      ]),
    }),
    explain({
      id: 'unequal-result', title: 'Same hour, different clock',
      purpose: 'See what seasonal hours meant to the people who kept them.',
      body: `“The end of the third hour” was ${clock(UA.time)} in April; in October it would be about half past nine: sunrise at ${clock(EO.sunrise.time)} plus three hours of about ${Math.round(UO.hourMinutes)} minutes. Church bells and markets kept these hours. The back’s horary quadrant does the same job from a height measurement alone; it is not covered in this course.`,
      result: `On 20 April hour ${ROMAN[UA.hour]} ends at ${clock(UA.time)}; on 23 October hour ${ROMAN[UO.hour]} ends at ${clock(UO.time)} local apparent time. Seasonal hours are fractions of daylight, not fixed lengths.`,
      highlights: ['unequal-hour-line'], uses: ['unequal-hour', 'horary-quadrant'],
      snapshot: at(OCTOBER, 'front', { rete: UO.rete, rule: UO.rule }),
    }),
  ],
};
function ordinal(value: number): string {
  return ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'][value] ?? String(value);
}

// ---------------------------------------------------------------------------
// Lesson 11 — Set the sky for a time

const YO = SET_SKY.october;
const YA = SET_SKY.april;
/** Where the rule's Sun end starts in second-set-time: 2½ hours (37½°) short of the answer. */
const SET_TIME_START = 18.5;
const setSky: Lesson = {
  id: 'front.set-sky.v1', version: 1, prerequisites: ['night.time-by-star.v1', 'back.equation-time.v1'],
  title: 'Set the sky for a date and clock time: what is up tonight?',
  summary: 'Undo the clock corrections, set the rule to the sundial time, turn the Sun’s date point under it, and read which stars are up.',
  steps: [
    read({
      id: 'reverse-problem', title: 'From the watch back to the astrolabe',
      purpose: 'Run Lesson 9 backwards, from a clock time to sundial time.',
      body: `What will be up at ${clock(YO.summerTime)} BST tonight, 23 October? Undo each correction in reverse order, in whole minutes: take off the summer hour; London’s half minute of longitude does not change the minute; then add the equation (${signedMinutes(CO.equation)}).`,
      result: `${clock(YO.zone)} GMT + ${Math.round(CO.equation)} min: about ${clock(YO.apparent)} local apparent time.`,
      uses: ['summer-time', 'longitude-correction', 'local-mean-time', 'equation-of-time'],
      snapshot: at(OCTOBER, 'front', { rete: SUN_OCTOBER.raDeg }),
      check: choice('What sundial time is that?', [
        right(clock(YO.apparent)),
        wrong(clock(YO.mean - Math.round(CO.equation) / 60), 'That subtracts the equation. Going from the watch to the sundial, add it.'),
        wrong(clock(YO.apparent + 1), 'That keeps the summer hour. Take it off first.'),
      ]),
    }),
    demonstrate({
      id: 'set-time', title: 'Set the rule to the time',
      purpose: 'Let the rule stand for a time before the sky is set.',
      body: `${clock(YO.apparent)} is ${duration(YO.apparent - 12)} after noon, so the Sun’s hour angle is about ${deg((YO.apparent - 12) * 15)} west of the noon line. Watch the rule turn until its Sun end points to ${clock(YO.apparent)} on the limb: a quarter of the way from ${Math.floor(YO.apparent)} to ${Math.floor(YO.apparent) + 1}.`,
      stopCue: `The Sun end is a quarter of the way past ${Math.floor(YO.apparent)}.`,
      result: 'The rule now marks the moment you asked about.',
      highlights: ['rule', hourMark(YO.apparent)], introduces: ['set-time'], uses: ['lay-rule', 'limb-hour-scale', 'degrees-to-hours', 'hour-angle'],
      snapshot: at(OCTOBER, 'front', { rete: SUN_OCTOBER.raDeg }),
      demonstration: turn('ruleRotation', 0, YO.rule),
      check: near('ruleRotation', YO.rule),
    }),
    demonstrate({
      id: 'set-sky', title: 'Bring the Sun under the rule',
      purpose: 'Turn the whole sky to match that time.',
      body: `Without moving the rule, watch the rete turn until the Sun’s ${deg(SUN_OCTOBER.longitude, 1)} point lies under the rule.`,
      stopCue: `The ${deg(SUN_OCTOBER.longitude, 1)} tick is on the edge of the rule’s Sun end, below the western horizon.`,
      result: `Every star pointer now stands where that star will be at ${clock(YO.summerTime)} BST.`,
      highlights: [octoberTick, 'rule-edge'], introduces: ['set-sky-for-time'], uses: ['rotate-rete', 'sun-date-point', 'time-from-sun-point'],
      snapshot: at(OCTOBER, 'front', { rete: SUN_OCTOBER.raDeg, rule: YO.rule }),
      demonstration: turn('reteRotation', SUN_OCTOBER.raDeg, YO.rete, 900),
      check: allOf(near('ruleRotation', YO.rule), ruleOn(SUN_OCTOBER)),
    }),
    read({
      id: 'read-sky', title: 'What is up?',
      purpose: 'Use the setting to see the sky.',
      body: 'Read Vega’s height and direction; then find Deneb, Altair and Capella, also marked.',
      result: `Vega is about ${deg(YO.vega.altitude)} up in the west. Deneb is nearly overhead (${deg(YO.deneb.altitude)}), Altair is lower in the south-west (${deg(YO.altair.altitude)}), and Capella is rising in the north-east (${deg(YO.capella.altitude)}). Lesson 8 found Vega at ${deg(NO.altitude)} at ${clock(NO.time)}, a little later; it is sinking, so that fits.`,
      highlights: [{ part: 'star-pointer', star: 'vega' }, { part: 'star-pointer', star: 'deneb' }, { part: 'star-pointer', star: 'altair' }, { part: 'star-pointer', star: 'capella' }],
      uses: ['read-alt-az'],
      snapshot: at(OCTOBER, 'front', { rete: YO.rete, rule: YO.rule }),
      check: choice('Where is Vega?', [
        right(`About ${deg(YO.vega.altitude)} high, in the west`),
        wrong(`About ${deg(YO.vega.altitude)} high, in the east`, 'East and west are swapped. Vega is on the right half of the plate, which is west.'),
        wrong('Below the horizon', 'Vega’s tip is well inside the horizon circle, so it is up.'),
      ]),
    }),
    read({
      id: 'second-reverse', title: `Your turn: 20 April, ${clock(YA.summerTime)} BST`,
      purpose: 'Work the reverse conversion yourself.',
      body: `Convert ${clock(YA.summerTime)} BST on 20 April to sundial time.`,
      result: `${clock(YA.zone)} GMT; the half minute does not change the minute; plus ${Math.round(CA.equation)} minute: about ${clock(YA.apparent)}, just past ${Math.floor(YA.apparent)}:00.`,
      uses: ['summer-time', 'longitude-correction', 'equation-of-time'],
      snapshot: at(APRIL, 'front'),
      check: choice('What sundial time is that?', [
        right(`About ${clock(YA.apparent)}`),
        wrong(`About ${clock(YA.apparent + 1)}`, 'That keeps the summer hour. Take it off first.'),
        wrong(`About ${clock(YA.mean - Math.round(CA.equation) / 60)}`, 'That subtracts the equation. Going from the watch to the sundial, add it.'),
      ]),
    }),
    yourTurn({
      id: 'second-set-time', title: 'Your turn: set the rule',
      purpose: 'Set the rule to a time yourself.',
      body: `Turn the rule until its Sun end points to ${clock(YA.apparent)}, just past the ${Math.floor(YA.apparent)} on the limb.`,
      stopCue: `The Sun end is just past ${Math.floor(YA.apparent)}.`,
      result: 'The rule marks the moment in the question.',
      highlights: [hourMark(YA.apparent)], uses: ['set-time'],
      // The rule starts with its Sun end between 18 and 19, so Magnify shows the target and the end to turn.
      frame: [hourMark(SET_TIME_START), hourMark(YA.apparent)],
      snapshot: at(APRIL, 'front', { rule: ruleForTime(SET_TIME_START) }),
      check: near('ruleRotation', YA.rule),
      solution: { ruleRotation: YA.rule },
    }),
    yourTurn({
      id: 'second-set-sky', title: 'Your turn: set the sky',
      purpose: 'Turn the sky to match the time yourself.',
      body: `Turn the rete until the ${deg(SUN_APRIL.longitude, 1)} point lies under the rule’s Sun end. Do not move the rule.`,
      stopCue: `The ${deg(SUN_APRIL.longitude, 1)} tick is on the edge of the rule’s Sun end, below the north-western horizon.`,
      result: `The sky is set for ${clock(YA.summerTime)} BST on 20 April.`,
      highlights: [aprilTick], uses: ['set-sky-for-time'],
      // The tick travels half way round to the rule: frame both, so a phone keeps the whole instrument in view.
      frame: [aprilTick, 'rule-edge'],
      snapshot: at(APRIL, 'front', { rule: YA.rule }),
      check: allOf(near('ruleRotation', YA.rule), ruleOn(SUN_APRIL)),
      solution: { reteRotation: YA.rete },
    }),
    read({
      id: 'second-read-sky', title: 'Your turn: read Arcturus',
      purpose: 'Check this lesson against Lesson 8.',
      body: 'Find Arcturus and read where it is.',
      result: `About ${deg(YA.arcturus.altitude)} up in the east-south-east. Lesson 8 had it at ${deg(NA.altitude)} at ${clock(NA.time)}, a few minutes later and still climbing, so the two lessons agree.`,
      highlights: [{ part: 'star-pointer', star: 'arcturus' }], uses: ['read-alt-az'],
      snapshot: at(APRIL, 'front', { rete: YA.rete, rule: YA.rule }),
      check: choice('Where is Arcturus?', [
        right(`About ${deg(YA.arcturus.altitude)} high, in the east-south-east`),
        wrong(`About ${deg(YA.arcturus.altitude)} high, in the west-south-west`, 'East and west are swapped. Arcturus is on the left half of the plate, which is east.'),
        wrong(`About ${deg(P.culmination.altitude)} high, in the south`, 'That is Arcturus at its highest (Lesson 4). Tonight at this hour it has not reached the meridian yet.'),
      ]),
    }),
    explain({
      id: 'setting-result', title: 'A map of tonight’s sky',
      purpose: 'Sum up the timekeeping thread.',
      body: 'You can now go either way between the sky and your watch: from a measurement to the clock (Lessons 6 to 9), and from the clock to the sky (this lesson).',
      result: `${clock(YO.summerTime)} BST on 23 October shows Vega ${deg(YO.vega.altitude)} up in the west; ${clock(YA.summerTime)} BST on 20 April shows Arcturus ${deg(YA.arcturus.altitude)} up in the east-south-east. The astrolabe is a clock and a star map in one.`,
      highlights: ['rete'], uses: ['set-sky-for-time'],
      snapshot: at(APRIL, 'front', { rete: YA.rete, rule: YA.rule }),
    }),
  ],
};

// ---------------------------------------------------------------------------
// Lesson 12 — Shadow square

const H = SHADOW;
const reading = (value: number) => value.toFixed(1);
/** Heights worked from the reading as shown (one decimal), so the sums in the copy give the answers in the copy. */
const shownSteep = Number(reading(SHADOW.steep.reading));
const shownLow = Number(reading(SHADOW.low.reading));
const steepHeight = SHADOW.steep.distance * 12 / shownSteep;
const lowHeight = SHADOW.low.distance * shownLow / 12;
const meanHeight = (Number(steepHeight.toFixed(1)) + Number(lowHeight.toFixed(1))) / 2;
const shadowSquare: Lesson = {
  id: 'back.shadow-square.v1', version: 1, prerequisites: ['front.foundations.v1', 'back.measure-altitude.v1'],
  title: 'Measure a height with the shadow square',
  summary: 'Use the shadow square’s twelve-part sides to turn a sighting angle and a paced distance into a height. Two readings from different distances should agree. You can take this lesson any time after Lesson 2.',
  steps: [
    explain({
      id: 'the-problem', title: 'Measuring a tower without climbing it',
      purpose: 'Meet a surveyor’s use of the astrolabe.',
      body: 'You pace your distance from a tower on level ground, then sight its top through the alidade. The sighting happens outside this picture, so the angle is given to you.',
      result: 'An angle and a distance together give a height.',
      highlights: ['shadow-square'], uses: ['sighting', 'alidade'],
      snapshot: at(APRIL, 'back'),
    }),
    explain({
      id: 'the-square', title: 'The two shadow scales',
      purpose: 'Name the two scales and know which one to use.',
      body: 'The square is two halves side by side, and each half is divided into 12 along each side. The end that crosses the square is the alidade’s other end, below the pivot. For a sighting below 45° it crosses an upright side, marked UMBRA VERSA: height ÷ distance = reading ÷ 12. For a sighting above 45° it crosses the bottom, marked UMBRA RECTA: height ÷ distance = 12 ÷ reading.',
      result: 'The square is a ready-made table of height against distance.',
      highlights: ['shadow-square', 'umbra-versa', 'umbra-recta'], introduces: ['umbra-versa', 'umbra-recta', 'shadow-ratio'], uses: ['shadow-square'],
      snapshot: at(APRIL, 'back'),
    }),
    demonstrate({
      id: 'corner', title: 'The 45° corner',
      purpose: 'Start from the easiest case.',
      body: 'Watch the alidade turn to a 45° sighting. Its edge passes through the corner of the square.',
      stopCue: 'The edge runs exactly through the corner.',
      result: 'At 45° the height above your eye equals your distance. So you can walk back until the top is at 45°, then pace the distance.',
      highlights: ['shadow-square'], introduces: ['shadow-corner'], uses: ['set-altitude', 'shadow-ratio'],
      snapshot: at(APRIL, 'back'),
      demonstration: turn('alidadeRotation', 0, H.corner.angle),
      check: near('alidadeRotation', H.corner.angle),
    }),
    yourTurn({
      id: 'steep', title: `Your turn: ${H.steep.distance} m away, top at ${deg(H.steep.angle)}`,
      purpose: 'Set a steep sighting.',
      body: `You stand ${H.steep.distance} m from the tower and its top is at ${deg(H.steep.angle)}. Set that sighting on the alidade.`,
      stopCue: `The edge crosses the red ${H.steep.angle}.`,
      result: 'The alidade’s other end now crosses the bottom of the square: the sighting is steep, so read UMBRA RECTA.',
      // The red mark the cue names; the square it then crosses is read (and highlighted) in the next step.
      highlights: [red(H.steep.angle)], uses: ['set-altitude'],
      // Magnify the red mark to reach and the alidade's tip, now at 45°.
      frame: [red(40), red(H.steep.angle)],
      snapshot: at(APRIL, 'back', { alidade: H.corner.angle }),
      check: altitudeSet(H.steep.angle),
      solution: { alidadeRotation: H.steep.angle },
    }),
    read({
      id: 'read-recta', title: 'Read the bottom scale',
      purpose: 'Read the square.',
      body: 'Read where the edge crosses the bottom scale. Its twelfths are counted outwards from the middle, below the pivot, to 12 at the corner.',
      result: `Just under 7 (${reading(H.steep.reading)}).`,
      highlights: ['umbra-recta'], introduces: ['read-shadow-square'], uses: ['umbra-recta'],
      snapshot: at(APRIL, 'back', { alidade: H.steep.angle }),
      check: choice('What does the bottom scale read?', [
        right(`About ${reading(H.steep.reading)}`),
        wrong('12', 'Twelve is the corner, where a 45° sighting crosses. A steeper sighting crosses further along the bottom.'),
        wrong(`About ${reading(12 - H.steep.reading)}`, 'That counts from the corner. The numbers start below the pivot and reach 12 at the corner.'),
      ]),
    }),
    read({
      id: 'calculate-recta', title: 'Work out the height',
      purpose: 'Turn the reading into a height without turning the ratio upside down.',
      body: `For UMBRA RECTA, height = distance × 12 ÷ reading. The distance is ${H.steep.distance} m.`,
      result: `${H.steep.distance} × 12 ÷ ${reading(H.steep.reading)} ≈ ${metres(steepHeight)} above your eye.`,
      highlights: ['umbra-recta'], uses: ['shadow-ratio', 'read-shadow-square'],
      snapshot: at(APRIL, 'back', { alidade: H.steep.angle }),
      check: choice('How high is the top above your eye?', [
        right(`About ${metres(steepHeight)}`),
        wrong(`About ${metres(H.steep.distance * shownSteep / 12)}`, 'That turns the ratio upside down. For a steep sighting the tower is higher than you are far away.'),
        wrong(`${H.steep.distance} m`, 'That is the distance. Height equals distance only at the 45° corner.'),
      ]),
    }),
    yourTurn({
      id: 'low', title: `Your turn: ${H.low.distance} m away, top at ${deg(H.low.angle)}`,
      purpose: 'Measure the same tower from further away, on the other scale.',
      body: `Now you stand ${H.low.distance} m from the tower and its top is at ${deg(H.low.angle)}. Set that sighting on the alidade.`,
      stopCue: `The edge crosses the red ${H.low.angle}.`,
      result: 'The alidade’s other end now crosses an upright side of the square: the sighting is low, so read UMBRA VERSA.',
      highlights: [red(H.low.angle)], frame: [red(H.low.angle), red(H.steep.angle)], uses: ['set-altitude'],
      snapshot: at(APRIL, 'back', { alidade: H.steep.angle }),
      check: altitudeSet(H.low.angle),
      solution: { alidadeRotation: H.low.angle },
    }),
    read({
      id: 'read-versa', title: 'Read and calculate',
      purpose: 'Finish the second measurement.',
      body: 'Read UMBRA VERSA where the edge crosses it (its twelfths are counted down from the horizontal line to 12 at the corner), then use height = distance × reading ÷ 12.',
      result: `The reading is ${reading(H.low.reading)}, so ${H.low.distance} × ${reading(H.low.reading)} ÷ 12 = ${metres(lowHeight)}. The first measurement gave ${metres(steepHeight)}: the same tower, within the reading error.`,
      highlights: ['umbra-versa'], frame: ['umbra-versa'], uses: ['read-shadow-square', 'umbra-versa'],
      snapshot: at(APRIL, 'back', { alidade: H.low.angle }),
      check: choice('How high is the top above your eye?', [
        right(`About ${metres(lowHeight)}`),
        wrong(`About ${metres(H.low.distance * 12 / shownLow)}`, 'That turns the ratio upside down. A low sighting means the tower is lower than you are far away.'),
        wrong(`About ${metres(H.low.reading)}`, 'That is the reading itself. Multiply by the distance and divide by 12.'),
      ]),
    }),
    explain({
      id: 'account-eye-level', title: 'Add your own height',
      purpose: 'Avoid the common last-step mistake.',
      body: `The square measures from the pivot, which is at your eye. Add your eye height: ${metres(H.eyeHeight)}.`,
      result: `${deg(H.steep.angle)} at ${H.steep.distance} m gave ${metres(steepHeight)} and ${deg(H.low.angle)} at ${H.low.distance} m gave ${metres(lowHeight)} above the eye: on average ${metres(meanHeight)}. With ${metres(H.eyeHeight)} eye height the tower is about ${metres(meanHeight + H.eyeHeight)} tall. Two readings that agree build trust; if they disagree, one ratio was turned upside down.`,
      highlights: ['back-axes'], introduces: ['eye-height'], uses: ['shadow-ratio', 'back-axes'],
      snapshot: at(APRIL, 'back', { alidade: H.low.angle }),
    }),
  ],
};

export const LESSONS: readonly Lesson[] = [
  foundations, measureAltitude, localSky, readStar, sunPlace, timeBySunLesson,
  solarEvents, timeByStarLesson, equationTime, unequalHours, setSky, shadowSquare,
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
      if (!item.title.trim() || !item.purpose.trim() || !item.body.trim() || !item.result.trim()) errors.push(`Empty content: ${lesson.id}/${item.id}`);
      for (const value of [item.snapshot.plateLatitude, item.snapshot.reteRotation, item.snapshot.ruleRotation, item.snapshot.alidadeRotation]) {
        if (!Number.isFinite(value)) errors.push(`Non-finite snapshot: ${lesson.id}/${item.id}`);
      }
      if (Number.isNaN(Date.parse(item.snapshot.epochIso))) errors.push(`Invalid epoch: ${lesson.id}/${item.id}`);
      for (const ref of item.highlights) if (!isValidPartRef(ref)) errors.push(`Unknown highlight ${JSON.stringify(ref)}: ${lesson.id}/${item.id}`);
      if (item.check?.kind === 'choice') {
        const { options } = item.check;
        if (!item.check.prompt.trim()) errors.push(`Choice without prompt: ${lesson.id}/${item.id}`);
        if (options.length < 2 || options.length > 4) errors.push(`Choice needs 2-4 options: ${lesson.id}/${item.id}`);
        if (options.filter((option) => option.correct).length !== 1) errors.push(`Choice needs exactly one correct option: ${lesson.id}/${item.id}`);
        if (options.some((option) => !option.label.trim() || (!option.correct && !option.misconception?.trim()))) {
          errors.push(`Every distractor needs a misconception note: ${lesson.id}/${item.id}`);
        }
        if (new Set(options.map((option) => option.label)).size !== options.length) errors.push(`Choice options must differ: ${lesson.id}/${item.id}`);
      }
    }
  }
  return errors;
}
