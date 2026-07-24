import { equationOfTime, solarLongitude } from './astro';

export const EQUATION_ZERO_RADIUS = 215;
export const EQUATION_PIXELS_PER_MINUTE = 6;
export const FRONT_RULE_HIT_WIDTH = 28;

/** Continuous centerline used by the front rule's semantic pointer hit area. */
export function frontRuleHitPath(extent: number): string {
  return `M 0 ${-extent} L 0 ${extent}`;
}

export function counterchangedRulePaths(
  orientation: 'horizontal' | 'vertical',
  extent: number,
  width: number,
): [string, string] {
  if (orientation === 'horizontal') {
    return [
      `M ${-extent} 0 L 0 0 L 0 ${width} L ${-extent} ${width} Z`,
      `M 0 ${-width} L ${extent} ${-width} L ${extent} 0 L 0 0 Z`,
    ];
  }
  return [
    `M 0 ${-extent} L 0 0 L ${-width} 0 L ${-width} ${-extent} Z`,
    `M 0 0 L ${width} 0 L ${width} ${extent} L 0 ${extent} Z`,
  ];
}

export function equationOfTimePoint(date: Date): { x: number; y: number; radius: number; longitude: number } {
  const longitude = solarLongitude(date);
  const radius = EQUATION_ZERO_RADIUS + equationOfTime(date) * EQUATION_PIXELS_PER_MINUTE;
  const radians = longitude * Math.PI / 180;
  return {
    x: -radius * Math.cos(radians),
    y: -radius * Math.sin(radians),
    radius,
    longitude,
  };
}
