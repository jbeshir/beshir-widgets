export interface ReteGrainMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

function noise(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Deterministic, sparse tangential grain near the rete's circular outer edge.
 * The marks are visual texture only; no calibrated geometry is displaced.
 */
export function reteEdgeGrain(radius: number, count = 96): ReteGrainMark[] {
  return Array.from({ length: count }, (_, index) => {
    const step = 2 * Math.PI / count;
    const angle = index * step + (noise(index, 1) - 0.5) * step * 0.8;
    const localRadius = radius - 1.5 - noise(index, 2) * 3.5;
    const length = 1.5 + noise(index, 3) * 5;
    const asymmetry = (noise(index, 4) - 0.5) * length * 0.7;
    const x = localRadius * Math.sin(angle);
    const y = localRadius * Math.cos(angle);
    const tangentX = Math.cos(angle);
    const tangentY = -Math.sin(angle);

    return {
      x1: x - tangentX * (length / 2 + asymmetry),
      y1: y - tangentY * (length / 2 + asymmetry),
      x2: x + tangentX * (length / 2 - asymmetry),
      y2: y + tangentY * (length / 2 - asymmetry),
      opacity: 0.08 + noise(index, 5) * 0.14,
    };
  });
}
