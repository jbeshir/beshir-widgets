// Charge artwork as point rings, for tests that check where the drawn art lies on the shield.
import type { ArtPose, Slot } from '../src/lib/heraldry';

export type Pt = [number, number];

/** Each drawing as rings of points in its 0–100 box (the art is M/L/Z polygons only). */
export function rings(d: string): Pt[][] {
  return d.split('M').filter(Boolean).map((sub) => {
    const n = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
    return Array.from({ length: n.length / 2 }, (_, i): Pt => [n[2 * i], n[2 * i + 1]]);
  });
}

/** A drawing's rings placed in a drawn box on the shield, turned with the charge and posed as `chargeTransform` poses it. */
export function placePosed(rs: Pt[][], box: Slot, _pose: ArtPose): Pt[][] {
  const a = (box.rotation * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return rs.map((r) => r.map(([x, y]): Pt => {
    const dx = (x - 50) * box.size / 100, dy = (y - 50) * box.size / 100;
    return [box.x + dx * cos - dy * sin, box.y + dx * sin + dy * cos];
  }));
}
