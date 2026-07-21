/**
 * Pure stereographic-projection geometry for the planispheric astrolabe.
 * All formulas are lifted from FINDINGS.md §1–3; section numbers are cited
 * inline. No DOM access — this module is safe to unit-test under plain node.
 *
 * Coordinate convention (FINDINGS "Conventions" + PLAN §3): computed in the
 * FINDINGS frame, origin at the north celestial pole, +y pointing "down"
 * toward the south horizon / Tropic of Capricorn, +x toward the west. To
 * render with the zenith at the TOP of the screen, callers negate y exactly
 * once (see `flipY`) — apply it uniformly to plate, rete and rule so the
 * overlays continue to register with each other.
 */

const OBLIQUITY_DEG = 23.44; // ε, obliquity of the ecliptic (FINDINGS §1, fixed constant per §10.4)

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export interface Point {
  x: number;
  y: number;
}

export interface CircleGeom {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
}

/**
 * A degenerate projection: a circle through the projection point becomes a
 * straight line (FINDINGS §1.3). `orientation` + `value` locate it: a
 * horizontal line has constant y = value; a vertical line has constant
 * x = value.
 */
export interface LineGeom {
  kind: 'line';
  orientation: 'horizontal' | 'vertical';
  value: number;
}

export type HorizonGeom = CircleGeom | LineGeom;

export interface ProjectedPoint {
  x: number;
  y: number;
  r: number;
  onPlate: boolean;
}

export interface SelfCheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

/** Negate y once at render time to put the zenith at the top of the screen. */
export function flipY(y: number): number {
  return -y;
}

/**
 * Radius of the declination circle δ, projected stereographically from the
 * south celestial pole onto the equatorial plane. FINDINGS §1.1 (exact):
 *   r(δ) = R·cosδ/(1+sinδ) = R·tan((90°−δ)/2)
 */
export function rOfDec(decDeg: number, R: number): number {
  return R * Math.tan(deg2rad((90 - decDeg) / 2));
}

/** Tropic of Cancer (δ=+ε) radius, ≈0.6566·R. FINDINGS §1.2. */
export function tropicCancerRadius(R: number): number {
  return rOfDec(OBLIQUITY_DEG, R);
}

/** Celestial equator (δ=0) radius, = R. FINDINGS §1.2. */
export function equatorRadius(R: number): number {
  return rOfDec(0, R);
}

/** Tropic of Capricorn (δ=−ε) radius, ≈1.5232·R — also the plate rim. FINDINGS §1.2. */
export function tropicCapricornRadius(R: number): number {
  return rOfDec(-OBLIQUITY_DEG, R);
}

/**
 * The Capricorn rim radius, exposed by its own name for the SVG `<clipPath>`
 * that clips almucantars/azimuths/ecliptic/stars to the plate. FINDINGS §1.2.
 */
export function capricornRadius(R: number): number {
  return tropicCapricornRadius(R);
}

/**
 * Circle of constant altitude `a` for plate latitude `φ`. FINDINGS §2.1
 * (verified against Morrison):
 *   center = (0, R·cosφ/(sinφ+sin a)), radius = R·cos a/(sinφ+sin a)
 */
export function almucantar(phiDeg: number, aDeg: number, R: number): CircleGeom {
  const phi = deg2rad(phiDeg);
  const a = deg2rad(aDeg);
  const denom = Math.sin(phi) + Math.sin(a);
  return {
    kind: 'circle',
    cx: 0,
    cy: (R * Math.cos(phi)) / denom,
    r: (R * Math.cos(a)) / denom,
  };
}

/**
 * The horizon is the a=0 almucantar. FINDINGS §2.1/§2.4: as φ→0 the horizon
 * center and radius diverge and the horizon degenerates into the straight
 * line y=0 (a diameter through the pole) — guarded here to avoid overflow.
 */
export function horizon(phiDeg: number, R: number): HorizonGeom {
  if (Math.abs(phiDeg) < 1.5) {
    return { kind: 'line', orientation: 'horizontal', value: 0 };
  }
  return almucantar(phiDeg, 0, R);
}

/**
 * Vertical (azimuth) circle through the zenith and nadir, for azimuth `A′`
 * measured from the prime vertical (east–west line). FINDINGS §2.2:
 *   h = R·secφ, center = (±h·tan A′, −R·tanφ), radius = h/cos A′
 * A′ = ±90° (i.e. the meridian, A=0/180°) degenerates to the straight
 * vertical line x=0 (the N–S diameter through zenith and nadir) — guarded.
 */
export function azimuth(phiDeg: number, aPrimeDeg: number, R: number): HorizonGeom {
  const phi = deg2rad(phiDeg);
  const aPrime = deg2rad(aPrimeDeg);
  const h = R / Math.cos(phi);
  const cosAp = Math.cos(aPrime);
  if (Math.abs(cosAp) < 1e-9) {
    return { kind: 'line', orientation: 'vertical', value: 0 };
  }
  return {
    kind: 'circle',
    cx: h * Math.tan(aPrime),
    cy: -R * Math.tan(phi),
    r: h / cosAp,
  };
}

/** Zenith point for plate latitude φ (δ=φ). FINDINGS §2.3. */
export function zenith(phiDeg: number, R: number): Point {
  return { x: 0, y: R * Math.tan(deg2rad((90 - phiDeg) / 2)) };
}

/** Nadir point for plate latitude φ (δ=−φ). FINDINGS §2.3. */
export function nadir(phiDeg: number, R: number): Point {
  return { x: 0, y: -R * Math.tan(deg2rad((90 + phiDeg) / 2)) };
}

/**
 * The ecliptic ring: an off-center circle tangent internally to Cancer and
 * reaching out to Capricorn. FINDINGS §3.1:
 *   R_ecliptic = R·secε ≈ 1.0903·R, center_offset = R·tanε ≈ 0.4335·R
 *   center = (0, −R·tanε)   (offset toward Capricorn)
 */
export function eclipticCircle(R: number): CircleGeom {
  const eps = deg2rad(OBLIQUITY_DEG);
  return { kind: 'circle', cx: 0, cy: -R * Math.tan(eps), r: R / Math.cos(eps) };
}

/**
 * Project a plate point given its azimuthal plate angle (right ascension α
 * for the rete, or local hour angle H for the "live sky") and declination.
 * FINDINGS §1.4: r = R·tan((90°−δ)/2), x = r·sinθ, y = r·cosθ.
 */
export function project(angleDeg: number, decDeg: number, R: number): ProjectedPoint {
  const r = rOfDec(decDeg, R);
  const theta = deg2rad(angleDeg);
  return {
    x: r * Math.sin(theta),
    y: r * Math.cos(theta),
    r,
    onPlate: decDeg >= -OBLIQUITY_DEG,
  };
}

/**
 * Place a zodiac/ecliptic-longitude point λ on the plate: convert to
 * equatorial coordinates, then project by right ascension. FINDINGS §3.2:
 *   δ(λ) = asin(sinε·sinλ), α(λ) = atan2(cosε·sinλ, cosλ)
 */
export function eclipticPoint(lambdaDeg: number, R: number): ProjectedPoint {
  const eps = deg2rad(OBLIQUITY_DEG);
  const lambda = deg2rad(lambdaDeg);
  const decDeg = rad2deg(Math.asin(Math.sin(eps) * Math.sin(lambda)));
  const raDeg = rad2deg(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)));
  return project(raDeg, decDeg, R);
}

function approxEqual(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) < eps;
}

/**
 * Ship-with-the-module acceptance checks (PLAN §3/§12, FINDINGS-derived
 * constants). DOM-free so it can run under plain node.
 */
export function selfCheck(): SelfCheckResult[] {
  const R = 1;
  const results: SelfCheckResult[] = [];

  const cancer = tropicCancerRadius(R) / R;
  const equator = equatorRadius(R) / R;
  const capricorn = tropicCapricornRadius(R) / R;
  const tropicOk =
    approxEqual(cancer, 0.6566, 0.001) &&
    approxEqual(equator, 1, 0.001) &&
    approxEqual(capricorn, 1.5232, 0.001);
  results.push({
    name: 'tropic-radii-ratios',
    pass: tropicOk,
    detail: `cancer=${cancer.toFixed(4)}, equator=${equator.toFixed(4)}, capricorn=${capricorn.toFixed(4)} (expected 0.6566 / 1.0000 / 1.5232)`,
  });

  const phiTest = 45;
  const alm90 = almucantar(phiTest, 90, R);
  const zen = zenith(phiTest, R);
  const collapseOk = approxEqual(alm90.r, 0, 1e-6) && approxEqual(alm90.cy, zen.y, 1e-6);
  results.push({
    name: 'almucantar-90-collapses-to-zenith',
    pass: collapseOk,
    detail: `almucantar(45,90)={cy:${alm90.cy.toFixed(6)},r:${alm90.r.toFixed(6)}}, zenith(45)={y:${zen.y.toFixed(6)}}`,
  });

  const hz = horizon(45, R);
  const hzOk = hz.kind === 'circle' && approxEqual(hz.cy, R, 0.001) && approxEqual(hz.r, R * Math.SQRT2, 0.001);
  results.push({
    name: 'horizon-45',
    pass: hzOk,
    detail:
      hz.kind === 'circle'
        ? `horizon(45)={cy:${hz.cy.toFixed(4)},r:${hz.r.toFixed(4)}} (expected cy=R=${R}, r=R√2=${(R * Math.SQRT2).toFixed(4)})`
        : 'horizon(45) unexpectedly degenerated to a line',
  });

  const ecl = eclipticCircle(R);
  const eclOk = approxEqual(ecl.r, 1.0903, 0.001) && approxEqual(Math.abs(ecl.cy), 0.4335, 0.001);
  results.push({
    name: 'ecliptic-constants',
    pass: eclOk,
    detail: `eclipticCircle={r:${ecl.r.toFixed(4)},offset:${Math.abs(ecl.cy).toFixed(4)}} (expected r≈1.0903, offset≈0.4335)`,
  });

  return results;
}
