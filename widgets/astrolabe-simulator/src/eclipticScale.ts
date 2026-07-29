export type EclipticTickLevel = 'half-degree' | 'degree' | 'five-degree' | 'ten-degree';

export interface EclipticTick {
  longitude: number;
  level: EclipticTickLevel;
  inset: number;
}

/** Half-degree engraving with progressively longer whole-degree divisions. */
export function eclipticTicks(): EclipticTick[] {
  return Array.from({ length: 720 }, (_, halfDegreeIndex) => {
    const longitude = halfDegreeIndex / 2;
    if (halfDegreeIndex % 20 === 0) return { longitude, level: 'ten-degree', inset: 24 };
    if (halfDegreeIndex % 10 === 0) return { longitude, level: 'five-degree', inset: 20 };
    if (halfDegreeIndex % 2 === 0) return { longitude, level: 'degree', inset: 15 };
    return { longitude, level: 'half-degree', inset: 10 };
  });
}

export function eclipticLabels(): number[] {
  return Array.from({ length: 36 }, (_, index) => index * 10);
}
