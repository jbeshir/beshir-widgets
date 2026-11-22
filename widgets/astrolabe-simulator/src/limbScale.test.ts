import { describe, expect, it } from 'vitest';
import { solarLongitude } from './astro';
import { eclipticPoint, orientRetePoint } from './geometry';
import {
  LIMB_HOUR_RADIUS, LIMB_TICK_BASE, LIMB_TICK_RING, RULE_TIP_RADIUS, limbAngleForHour, limbHourAtAngle, limbHourLabels, limbTicks, ruleSunEndAngle,
} from './limbScale';

function circularDistance(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

describe('front limb scale', () => {
  it('keeps the hour numerals outboard of the tick ring, clear of the rule tip', () => {
    const longest = Math.max(...limbTicks().map((tick) => tick.inset));
    const shortest = Math.min(...limbTicks().map((tick) => tick.inset));
    expect(LIMB_TICK_BASE + longest).toBeLessThanOrEqual(LIMB_TICK_RING);
    // The tip reaches past every degree tick into the ring...
    expect(RULE_TIP_RADIUS).toBeGreaterThan(LIMB_TICK_BASE + shortest);
    expect(RULE_TIP_RADIUS).toBeLessThan(LIMB_TICK_RING);
    // ...and stops short of the numerals (25-unit glyphs, about 9 units half height).
    expect(LIMB_HOUR_RADIUS - 10).toBeGreaterThan(LIMB_TICK_RING);
    expect(LIMB_HOUR_RADIUS + 10).toBeLessThan(600);
  });

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
    expect(limbHourLabels().map((label) => label.hour)).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
  });

  it('engraves noon at the top, midnight at the bottom, increasing clockwise (FG-2a)', () => {
    const labels = new Map(limbHourLabels().map((label) => [label.hour, label.degrees]));
    expect(labels.get(12)).toBe(0);
    expect(labels.get(0)).toBe(180);
    expect(labels.get(18)).toBe(90);
    expect(labels.get(6)).toBe(270);
    for (let hour = 0; hour < 24; hour += 1) {
      expect(limbHourAtAngle(limbAngleForHour(hour))).toBeCloseTo(hour, 10);
    }
  });

  it('reads 08:17 at the Sun’s end of the rule over Sun@04-20 with the rete at 332.5° (FG-2 criterion 1)', () => {
    const rete = 332.5;
    const sun = orientRetePoint(
      eclipticPoint(solarLongitude(new Date(Date.UTC(2026, 3, 20, 12))), 1),
      rete,
    );
    // The rule rotation that lays the rule's edge over the Sun (ρ = α − θ).
    const rule = Math.atan2(-sun.x, sun.y) * 180 / Math.PI;
    // The Sun's own on-screen direction (single y flip), clockwise from the top.
    const sunScreenAngle = (Math.atan2(sun.x, sun.y) * 180 / Math.PI + 360) % 360;
    const sunEnd = ruleSunEndAngle(rule);
    expect(circularDistance(sunEnd, sunScreenAngle)).toBeLessThan(1e-9);
    expect(circularDistance(sunEnd, limbAngleForHour(8 + 17 / 60))).toBeLessThan(0.5);
    // The engraved 8 and 9 labels bracket the reading at the Sun's end.
    const labels = new Map(limbHourLabels().map((label) => [label.hour, label.degrees]));
    expect(sunEnd).toBeGreaterThan(labels.get(8) ?? Infinity);
    expect(sunEnd).toBeLessThan(labels.get(9) ?? -Infinity);
  });
});
