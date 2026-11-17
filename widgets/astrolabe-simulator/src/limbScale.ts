/**
 * Radial layout of the front limb (540 to 600). As on period instruments the
 * tick ring is inboard and the hour numerals ride outboard of it, so the
 * rule's tip can reach into the ticks without ever covering a numeral.
 */
export const LIMB_TICK_BASE = 545;
/** Engraved circle closing the tick ring; the numerals sit outside it. */
export const LIMB_TICK_RING = 568;
export const LIMB_HOUR_RADIUS = 585;
/** Distance from the pivot to each tip of the front rule: inside the tick ring, short of the numerals. */
export const RULE_TIP_RADIUS = 562;

export type LimbTickLevel = 'degree' | 'five-degree' | 'hour';

export interface LimbTick {
  degrees: number;
  level: LimbTickLevel;
  inset: number;
}

export interface LimbHourLabel {
  hour: number;
  /** Clockwise angle on screen, measured from the top of the limb. */
  degrees: number;
}

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * The front limb keeps its 24-hour labels, but its engraving is angular:
 * every degree, with longer marks at 5° and at each 15° hour.
 */
export function limbTicks(): LimbTick[] {
  return Array.from({ length: 360 }, (_, degrees) => {
    if (degrees % 15 === 0) return { degrees, level: 'hour', inset: 22 };
    if (degrees % 5 === 0) return { degrees, level: 'five-degree', inset: 15 };
    return { degrees, level: 'degree', inset: 9 };
  });
}

/**
 * Screen position of a local apparent solar time on the 24-hour limb:
 * noon (12) on the upper meridian, midnight (0/24) at the bottom, hours
 * increasing clockwise, as engraved on physical 24-hour limbs (FG-2a).
 */
export function limbAngleForHour(hours: number): number {
  return normalize((hours - 12) * 15);
}

/** Inverse of `limbAngleForHour`: the hour engraved at a clockwise screen angle. */
export function limbHourAtAngle(degrees: number): number {
  return (((12 + normalize(degrees) / 15) % 24) + 24) % 24;
}

export function limbHourLabels(): LimbHourLabel[] {
  return Array.from({ length: 24 }, (_, hour) => ({ hour, degrees: limbAngleForHour(hour) }));
}

/**
 * Clockwise screen angle of the rule's Sun end. The rule is drawn along the
 * +y axis of the plate's computation frame, rotated by `rotate(ρ)` inside the
 * single `scale(1,-1)` flip; the tutorial fixtures choose ρ so that this +y
 * end lies over the Sun (ρ = α − θ).
 */
export function ruleSunEndAngle(ruleRotation: number): number {
  const rho = ruleRotation * Math.PI / 180;
  // (0, 1) rotated by ρ in the computation frame, then flipped to screen.
  const x = -Math.sin(rho);
  const screenY = -Math.cos(rho);
  return normalize(Math.atan2(x, -screenY) * 180 / Math.PI);
}
