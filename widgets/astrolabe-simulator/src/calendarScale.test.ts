import { describe, expect, it } from 'vitest';
import { calendarDayTicks, calendarMonthStarts } from './calendarScale';

describe('calendar-ring ticks', () => {
  it('restarts the five-day cadence within every month', () => {
    const ticks = calendarDayTicks();
    for (let month = 0; month < 12; month += 1) {
      const monthTicks = ticks.filter((tick) => tick.month === month);
      expect(monthTicks.filter((tick) => tick.isFiveDayTick).map((tick) => tick.dayOfMonth))
        .toEqual([5, 10, 15, 20, 25, 30].filter((day) => day <= monthTicks.length));
      expect(monthTicks[0]).toMatchObject({ dayOfMonth: 1, isFiveDayTick: false });
    }
  });

  it('is a fixed 365-day engraving with no leap-day notch', () => {
    const ticks = calendarDayTicks();
    expect(ticks).toHaveLength(365);
    expect(ticks.filter((tick) => tick.month === 1)).toHaveLength(28);
    const march = ticks.filter((tick) => tick.month === 2);
    expect(march[0]).toMatchObject({ dayOfMonth: 1, isFiveDayTick: false });
    expect(march[4]).toMatchObject({ dayOfMonth: 5, isFiveDayTick: true });
  });

  it('gives months unequal angular spans rather than equal twelfths', () => {
    const starts = calendarMonthStarts();
    const spans = starts.map((start, month) => {
      const end = month === 11 ? starts[0] + 360 : starts[month + 1];
      return ((end - start) + 360) % 360;
    });
    expect(new Set(spans.map((span) => span.toFixed(3))).size).toBeGreaterThan(6);
    expect(spans[1]).toBeLessThan(spans[0]);
    expect(spans.some((span) => Math.abs(span - 30) > 1)).toBe(true);
  });
});
