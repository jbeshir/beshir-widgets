import { describe, expect, it } from 'vitest';
import { reteEdgeGrain } from './reteTexture';

describe('rete edge texture', () => {
  it('keeps every grain mark in a narrow band inside the accurate rim', () => {
    const radius = 500;
    const marks = reteEdgeGrain(radius);
    expect(marks).toHaveLength(96);
    for (const mark of marks) {
      const midpointRadius = Math.hypot(
        (mark.x1 + mark.x2) / 2,
        (mark.y1 + mark.y2) / 2,
      );
      expect(midpointRadius).toBeGreaterThan(radius - 5.1);
      expect(midpointRadius).toBeLessThan(radius - 1.4);
    }
  });

  it('uses faint, uneven marks rather than deforming the rim', () => {
    const marks = reteEdgeGrain(500);
    const lengths = marks.map((mark) => Math.hypot(mark.x2 - mark.x1, mark.y2 - mark.y1));
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(1.5);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(6.5);
    expect(new Set(lengths.map((length) => length.toFixed(2))).size).toBeGreaterThan(80);
    expect(Math.min(...marks.map((mark) => mark.opacity))).toBeGreaterThanOrEqual(0.08);
    expect(Math.max(...marks.map((mark) => mark.opacity))).toBeLessThanOrEqual(0.22);
  });

  it('is deterministic so its pattern visibly follows rotation', () => {
    expect(reteEdgeGrain(500)).toEqual(reteEdgeGrain(500));
  });
});
