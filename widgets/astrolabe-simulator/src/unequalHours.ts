import { OBLIQUITY_DEG, project, type ProjectedPoint } from './geometry';

export const UNEQUAL_HOUR_LINES = Array.from({ length: 11 }, (_, index) => index + 1);
const DECLINATION_STEP_DEG = 0.5;

function deg2rad(degrees: number): number {
  return degrees * Math.PI / 180;
}

function rad2deg(radians: number): number {
  return radians * 180 / Math.PI;
}

/**
 * Project one point on a front-plate unequal-hour line.
 *
 * A diurnal circle at fixed declination is below the horizon from western
 * setting hour angle H₀ to eastern rising hour angle 2π−H₀. Dividing that
 * arc into twelve equal angles is the traditional plate construction. The
 * Sun is read on these lines at night and its antipodal point during the day.
 *
 * See Ford, “Building a model astrolabe”, JBAA 122 (2012), pp. 39–40:
 * https://in-the-sky.org/astrolabe/astrolabe_jbaa.pdf
 */
export function unequalHourPoint(
  latitudeDeg: number,
  hour: number,
  declinationDeg: number,
  referenceRadius: number,
): ProjectedPoint | null {
  if (
    !Number.isFinite(latitudeDeg) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(declinationDeg) ||
    !Number.isFinite(referenceRadius) ||
    referenceRadius <= 0 ||
    hour < 0 ||
    hour > 12
  ) return null;

  const horizonCosine = -Math.tan(deg2rad(latitudeDeg)) * Math.tan(deg2rad(declinationDeg));
  if (horizonCosine < -1 || horizonCosine > 1) return null;

  const settingHourAngle = Math.acos(horizonCosine);
  const belowHorizonArc = 2 * Math.PI - 2 * settingHourAngle;
  const hourAngle = settingHourAngle + belowHorizonArc * hour / 12;
  return project(rad2deg(hourAngle), declinationDeg, referenceRadius);
}

/** Sample the solar-declination range used by the rendered ecliptic. */
export function unequalHourCurve(
  latitudeDeg: number,
  hour: number,
  referenceRadius: number,
): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];
  const steps = Math.ceil(2 * OBLIQUITY_DEG / DECLINATION_STEP_DEG);
  for (let index = 0; index <= steps; index += 1) {
    const declination = -OBLIQUITY_DEG + 2 * OBLIQUITY_DEG * index / steps;
    const point = unequalHourPoint(latitudeDeg, hour, declination, referenceRadius);
    if (point) points.push(point);
  }
  return points;
}

export function unequalHourPath(
  latitudeDeg: number,
  hour: number,
  referenceRadius: number,
): string {
  return unequalHourCurve(latitudeDeg, hour, referenceRadius)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}
