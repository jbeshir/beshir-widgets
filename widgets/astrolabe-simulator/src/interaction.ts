import { normalizeDeg } from './astro';

/** Screen-space angle with positive values counterclockwise. */
export function angleFromPointer(svg: SVGSVGElement, clientX: number, clientY: number): number {
  const ctm = svg.getScreenCTM();
  let centerX: number;
  let centerY: number;
  if (ctm) {
    const point = new DOMPoint(0, 0).matrixTransform(ctm);
    centerX = point.x;
    centerY = point.y;
  } else {
    const rect = svg.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
  }
  return normalizeDeg(Math.atan2(centerY - clientY, clientX - centerX) * 180 / Math.PI);
}

/** Smallest signed change from one circular angle to another. */
export function rotationDelta(from: number, to: number): number {
  let delta = normalizeDeg(to) - normalizeDeg(from);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export function keyRotate(current: number, key: string, shift: boolean): number {
  const step = shift ? 10 : 1;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return normalizeDeg(current - step);
    case 'ArrowRight':
    case 'ArrowUp':
      return normalizeDeg(current + step);
    case 'Home':
      return 0;
    default:
      return current;
  }
}
