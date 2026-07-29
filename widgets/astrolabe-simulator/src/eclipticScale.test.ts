import { describe, expect, it } from 'vitest';
import { eclipticLabels, eclipticTicks } from './eclipticScale';

describe('front ecliptic scale', () => {
  it('engraves every half degree exactly once around the full circle', () => {
    const ticks = eclipticTicks();
    expect(ticks).toHaveLength(720);
    expect(ticks[0].longitude).toBe(0);
    expect(ticks.at(-1)?.longitude).toBe(359.5);
    expect(new Set(ticks.map((tick) => tick.longitude)).size).toBe(720);
  });

  it('uses a readable hierarchy at whole, five, and ten degrees', () => {
    const ticks = eclipticTicks();
    expect(ticks.filter((tick) => tick.level === 'half-degree')).toHaveLength(360);
    expect(ticks.filter((tick) => tick.level === 'degree')).toHaveLength(288);
    expect(ticks.filter((tick) => tick.level === 'five-degree')).toHaveLength(36);
    expect(ticks.filter((tick) => tick.level === 'ten-degree')).toHaveLength(36);
    expect(ticks.find((tick) => tick.longitude === 10)?.inset)
      .toBeGreaterThan(ticks.find((tick) => tick.longitude === 10.5)?.inset ?? 0);
  });

  it('labels longitude numerically every ten degrees', () => {
    expect(eclipticLabels()).toEqual(Array.from({ length: 36 }, (_, index) => index * 10));
  });
});
