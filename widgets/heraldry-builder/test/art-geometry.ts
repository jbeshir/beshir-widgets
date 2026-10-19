// Charge artwork as point rings, for tests that check where the drawn art lies on the shield.
import { CHARGES, aliasPath, isAliasId, type ArtPose, type ChargeId, type Slot } from '../src/lib/heraldry';
import type { ArtKey } from '../src/lib/heraldry/art/types';
import { CHARGE_ART } from '../src/lib/heraldry/art/paths/all';

export type Pt = [number, number];

/** A charge's drawings by key: its own, or, for an alias, those computed from the drawings of the charge it is drawn from (PLAN-D §2.4). */
export const chargeArt = (id: ChargeId): Partial<Record<ArtKey, string>> =>
  isAliasId(id) ? Object.fromEntries(Object.keys(CHARGES[id].drawings).map((key) => [key, aliasPath(id, key as ArtKey)!])) : CHARGE_ART[id];


/** Each drawing as rings of points in its 0–100 box (the art is M/L/Z polygons only). */
export function rings(d: string): Pt[][] {
  return d.split('M').filter(Boolean).map((sub) => {
    const n = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
    return Array.from({ length: n.length / 2 }, (_, i): Pt => [n[2 * i], n[2 * i + 1]]);
  });
}

/** A drawing's rings placed in a drawn box on the shield, turned with the charge and posed as `chargeTransform` poses it. */
export function placePosed(rs: Pt[][], box: Slot, pose: ArtPose): Pt[][] {
  const a = ((box.rotation + pose.turn) * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a), k = (pose.fit * box.size) / 100;
  return rs.map((r) => r.map(([x, y]): Pt => {
    const dx = (pose.mirror ? 50 - x : x - 50) * k, dy = (y - 50) * k;
    return [box.x + dx * cos - dy * sin, box.y + dx * sin + dy * cos];
  }));
}
