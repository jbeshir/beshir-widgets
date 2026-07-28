import { describe, expect, it } from 'vitest';
import { limbHourLabels, limbTicks } from './limbScale';

describe('front limb scale', () => {
  it('engraves every degree exactly once', () => {
    const ticks = limbTicks();
    expect(ticks).toHaveLength(360);
    expect(ticks.map((tick) => tick.degrees)).toEqual(
      Array.from({ length: 360 }, (_, degrees) => degrees),
    );
  });

  it('distinguishes degree, five-degree, and 15-degree hour divisions', () => {
    const ticks = limbTicks();
    expect(ticks.filter((tick) => tick.level === 'degree')).toHaveLength(288);
    expect(ticks.filter((tick) => tick.level === 'five-degree')).toHaveLength(48);
    expect(ticks.filter((tick) => tick.level === 'hour')).toHaveLength(24);
    expect(ticks.find((tick) => tick.degrees === 15)?.inset)
      .toBeGreaterThan(ticks.find((tick) => tick.degrees === 5)?.inset ?? 0);
    expect(ticks.find((tick) => tick.degrees === 5)?.inset)
      .toBeGreaterThan(ticks.find((tick) => tick.degrees === 1)?.inset ?? 0);
  });

  it('retains one label for each of the 24 hours', () => {
    expect(limbHourLabels()).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
  });
});
