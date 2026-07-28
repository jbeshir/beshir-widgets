import type { Point } from './geometry';

function radialOffset(angle: number): number {
  return 0.45 * Math.cos(angle - 0.8)
    + 0.9 * Math.sin(3 * angle + 0.4)
    + 0.55 * Math.sin(7 * angle - 0.7)
    + 0.3 * Math.cos(11 * angle);
}

/** A restrained, deterministic hand-finished edge around the accurate rete. */
export function reteRimPoints(radius: number, samples = 180): Point[] {
  return Array.from({ length: samples }, (_, index) => {
    const angle = 2 * Math.PI * index / samples;
    const localRadius = radius + radialOffset(angle);
    return {
      x: localRadius * Math.sin(angle),
      y: localRadius * Math.cos(angle),
    };
  });
}

export function reteRimPath(radius: number, samples = 180): string {
  const points = reteRimPoints(radius, samples);
  return `${points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`,
  ).join(' ')} Z`;
}
