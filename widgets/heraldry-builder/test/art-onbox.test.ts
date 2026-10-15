// Where each charge carries the charges on it: every drawing's on-box (a rectangle in its 100×100 art) lies inside
// the drawn shape, and only the charges with no room for a charge on them have none.

import { describe, expect, it } from 'vitest';
import { ART_ON_BOX, CHARGE_ART, CHARGE_IDS, chargeOnBox, pointInPolygon } from '../src/lib/heraldry';
import { rings, type Pt } from './art-geometry';

/** The charges whose drawings are too slender or too ringed to carry a charge. */
const CARRIES_NONE = ['key', 'sword', 'anchor', 'musical-note', 'gear', 'annulet', 'cross-crosslet', 'estoile', 'spark'];

/** The share of the box's sample points (a unit grid) that lie inside the drawing, even-odd across its rings. */
function shareInside(d: string, box: { x: number; y: number; w: number; h: number }): number {
  const rs = rings(d);
  let inside = 0, total = 0;
  for (let x = box.x + 0.5; x < box.x + box.w; x++) {
    for (let y = box.y + 0.5; y < box.y + box.h; y++) {
      total += 1;
      if (rs.filter((r) => pointInPolygon(x, y, r as Pt[])).length % 2 === 1) inside += 1;
    }
  }
  return inside / total;
}

describe('the on-box of a charge', () => {
  it('has one for every drawing of every charge that carries charges, and for no other', () => {
    for (const id of CHARGE_IDS) {
      const drawn = Object.keys(CHARGE_ART[id]).sort();
      const boxed = Object.keys(ART_ON_BOX[id]).sort();
      expect(boxed, id).toEqual(CARRIES_NONE.includes(id) ? [] : drawn);
    }
  });

  it('lies at least 90% inside its drawing, within the art box', () => {
    for (const id of CHARGE_IDS) {
      for (const [posture, box] of Object.entries(ART_ON_BOX[id])) {
        const where = `${id} ${posture}`;
        expect(box!.x, where).toBeGreaterThanOrEqual(0);
        expect(box!.y, where).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.w, where).toBeLessThanOrEqual(100);
        expect(box!.y + box!.h, where).toBeLessThanOrEqual(100);
        expect(shareInside(CHARGE_ART[id][posture as keyof (typeof CHARGE_ART)[typeof id]]!, box!), where).toBeGreaterThanOrEqual(0.9);
      }
    }
  });

  it('is big enough to carry something: at least 16 units of the 100 on a side', () => {
    for (const id of CHARGE_IDS) {
      for (const [posture, box] of Object.entries(ART_ON_BOX[id])) expect(Math.min(box!.w, box!.h), `${id} ${posture}`).toBeGreaterThanOrEqual(16);
    }
  });

  it('is found by posture, falling back to the default posture and then the posture-less drawing', () => {
    expect(chargeOnBox('lion', 'passant')).toEqual(ART_ON_BOX.lion.passant);
    expect(chargeOnBox('lion', null)).toEqual(ART_ON_BOX.lion.rampant);
    expect(chargeOnBox('heart', null)).toEqual(ART_ON_BOX.heart._);
    expect(chargeOnBox('key', null)).toBeNull();
  });
});
