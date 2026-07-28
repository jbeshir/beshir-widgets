export type LimbTickLevel = 'degree' | 'five-degree' | 'hour';

export interface LimbTick {
  degrees: number;
  level: LimbTickLevel;
  inset: number;
}

/**
 * The front limb keeps its 24-hour labels, but its engraving is angular:
 * every degree, with longer marks at 5° and at each 15° hour.
 */
export function limbTicks(): LimbTick[] {
  return Array.from({ length: 360 }, (_, degrees) => {
    if (degrees % 15 === 0) return { degrees, level: 'hour', inset: 18 };
    if (degrees % 5 === 0) return { degrees, level: 'five-degree', inset: 12 };
    return { degrees, level: 'degree', inset: 7 };
  });
}

export function limbHourLabels(): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour);
}
