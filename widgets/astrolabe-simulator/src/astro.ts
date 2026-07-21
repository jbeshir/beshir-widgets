/**
 * DOM-free solar-position and angle helpers. FINDINGS §5.3 for the solar
 * longitude model; no other module here touches the DOM, so this stays
 * unit-testable under plain node alongside geometry.ts.
 */

const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const MS_PER_DAY = 86400000;

/** Normalize an angle in degrees to the range [0, 360). */
export function normalizeDeg(x: number): number {
  const m = x % 360;
  return m < 0 ? m + 360 : m;
}

/** Convert an hours/minutes/seconds right-ascension triple to degrees. */
export function raDegFromHMS(h: number, m: number, s: number): number {
  return normalizeDeg(15 * (h + m / 60 + s / 3600));
}

/**
 * Apparent solar ecliptic longitude λ (degrees), FINDINGS §5.3:
 *   D = days since J2000.0 (2000-01-01T12:00:00Z)
 *   g = (357.529 + 0.98560028·D) mod 360        (mean anomaly)
 *   L = (280.459 + 0.98564736·D) mod 360        (mean longitude)
 *   λ = L + 1.915·sin(g) + 0.020·sin(2g)        (±0.01°)
 */
export function solarLongitude(date: Date): number {
  const D = (date.getTime() - J2000_EPOCH_MS) / MS_PER_DAY;
  const g = normalizeDeg(357.529 + 0.98560028 * D);
  const L = normalizeDeg(280.459 + 0.98564736 * D);
  const gRad = (g * Math.PI) / 180;
  const lambda = L + 1.915 * Math.sin(gRad) + 0.02 * Math.sin(2 * gRad);
  return normalizeDeg(lambda);
}
