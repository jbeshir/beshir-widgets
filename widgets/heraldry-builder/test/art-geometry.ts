// Charge artwork as point rings, for tests that check where the drawn art lies on the shield.
import type { Slot } from '../src/lib/heraldry';

export type Pt = [number, number];

/** Each drawing as rings of points in its 0–100 box (the art is M/L/Z polygons only). */
export function rings(d: string): Pt[][] {
  return d.split('M').filter(Boolean).map((sub) => {
    const n = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
    return Array.from({ length: n.length / 2 }, (_, i): Pt => [n[2 * i], n[2 * i + 1]]);
  });
}

/** A drawing's rings placed in a drawn box on the shield. */
export const place = (rs: Pt[][], box: Slot): Pt[][] =>
  rs.map((r) => r.map(([x, y]): Pt => [box.x + (x - 50) * box.size / 100, box.y + (y - 50) * box.size / 100]));
