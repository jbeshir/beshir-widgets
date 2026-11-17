import { describe, expect, it } from 'vitest';
import { STARS } from './data/stars';
import { capricornRadius, orientRetePoint, project } from './geometry';
import { sideOfRadial } from './labelPlacement';
import { BLADE_WIDTH, STAR_NAME_FONT, pointerBase, reteDimensions, reteMetalPath, retePointers, reteStructure, starNameLength } from './reteGeometry';

const R = 340;
const onPlate = STARS.filter((star) => star.onPlate);

describe('pierced rete construction', () => {
  it('ends every star pointer exactly at the projected star', () => {
    for (const pointer of retePointers(onPlate, R)) {
      const outline = pointer.outline;
      expect(outline[0]).toEqual(pointer.tip);
      // The tip is a sharp point: the blade's two sides meet there at an acute angle.
      const [a, b] = [outline[1], outline[outline.length - 1]];
      const angle = Math.acos(((a.x - pointer.tip.x) * (b.x - pointer.tip.x) + (a.y - pointer.tip.y) * (b.y - pointer.tip.y))
        / (Math.hypot(a.x - pointer.tip.x, a.y - pointer.tip.y) * Math.hypot(b.x - pointer.tip.x, b.y - pointer.tip.y))) * 180 / Math.PI;
      expect(angle).toBeLessThan(60);
      expect(pointer.path).toContain(`${pointer.tip.x.toFixed(2)} ${pointer.tip.y.toFixed(2)}`);
    }
    const sirius = STARS.find((star) => star.name === 'Sirius')!;
    const projected = project(sirius.raDeg, sirius.decDeg, R);
    expect(retePointers([sirius], R)[0].tip).toEqual({ x: projected.x, y: projected.y });
  });

  it('anchors each pointer on structural metal, inside the Capricorn ring', () => {
    const rim = capricornRadius(R);
    for (const star of onPlate) {
      const p = project(star.raDeg, star.decDeg, R);
      const base = pointerBase(p, R);
      expect(Math.hypot(base.x, base.y)).toBeLessThanOrEqual(rim);
    }
    for (const pointer of retePointers(onPlate, R)) {
      for (const vertex of pointer.outline) expect(Math.hypot(vertex.x, vertex.y)).toBeLessThan(rim - reteDimensions(R).capricornWidth + 1);
    }
  });

  it('keeps the tracery lean: a handful of structural members', () => {
    expect(reteStructure(R).length).toBeLessThanOrEqual(6);
    const d = reteDimensions(R);
    expect(d.barWidth).toBeLessThan(d.capricornWidth);
    // Ring + 2 ecliptic contours + equator arc + 2 bars + hub + a blade (and at most a stem) per pointer.
    const pointers = retePointers(onPlate, R);
    const path = reteMetalPath(R, pointers);
    const contours = path.match(/Z/g)?.length ?? 0;
    expect(contours).toBeGreaterThanOrEqual(8 + onPlate.length);
    expect(contours).toBeLessThanOrEqual(8 + 2 * onPlate.length);
  });

  it('lays every blade on the side the rule leaves open, so the rule laid on a star never covers its point or name', () => {
    for (const [index, pointer] of retePointers(onPlate, R).entries()) {
      // The rete frame reaches the screen by a proper rotation, so the screen sense is the same here.
      for (const vertex of pointer.outline) expect(sideOfRadial(pointer.tip, vertex, 'ccw')).toBeGreaterThanOrEqual(-1e-9);
      // One straight side lies on the radial line through the star (the rule's edge when it is laid on the star).
      expect(Math.abs(sideOfRadial(pointer.tip, pointer.outline[pointer.outline.length - 1], 'ccw'))).toBeLessThan(1e-9);
      const star = onPlate[index];
      if (!star.label) { expect(pointer.labelAt).toBeUndefined(); continue; }
      // The name is engraved on the blade: centred across it and fitting along it.
      expect(pointer.labelAt).toBeDefined();
      expect(sideOfRadial(pointer.tip, pointer.labelAt!, 'ccw')).toBeCloseTo(BLADE_WIDTH / 2, 9);
      expect(BLADE_WIDTH).toBeGreaterThan(STAR_NAME_FONT * 1.2);
      const along = Math.hypot(pointer.outline[2].x - pointer.tip.x, pointer.outline[2].y - pointer.tip.y);
      expect(along).toBeGreaterThan(starNameLength(star.name) + 12);
      // The locator ring (radius 22 on desktop, 37 on a phone) opens a 100° gap towards nameSide: every point of the
      // name's box at those radii lies within 50° of it, so the ring never cuts the name.
      expect(pointer.nameSide).toBeDefined();
      const gap = pointer.nameSide! * Math.PI / 180;
      for (let s = 14; s <= starNameLength(star.name) + 14; s += 1) {
        for (const w of [BLADE_WIDTH / 2 - STAR_NAME_FONT / 2, BLADE_WIDTH / 2, BLADE_WIDTH / 2 + STAR_NAME_FONT / 2]) {
          const x = pointer.along.x * s + pointer.across.x * w;
          const y = pointer.along.y * s + pointer.across.y * w;
          const r = Math.hypot(x, y);
          if (r < 12 || r > 40) continue;
          const off = Math.abs(((Math.atan2(y, x) - gap) * 180 / Math.PI + 540) % 360 - 180);
          expect(off).toBeLessThan(50);
        }
      }
    }
  });

  it('keeps the blade clear of the rule body on screen, at any rete angle', () => {
    // Screen mapping of the rendered rete (orientation inside the single y flip) and rule (rotate inside the flip).
    const reteToScreen = (p: { x: number; y: number }, rotation: number) => { const o = orientRetePoint(p, rotation); return { x: o.x, y: -o.y }; };
    const ruleToScreen = (q: { x: number; y: number }, rho: number) => {
      const r = rho * Math.PI / 180;
      return { x: q.x * Math.cos(r) - q.y * Math.sin(r), y: -(q.x * Math.sin(r) + q.y * Math.cos(r)) };
    };
    const cross = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.y - a.y * b.x;
    for (const rotation of [0, 47, 133, 251]) {
      for (const pointer of retePointers(onPlate, R)) {
        const tip = reteToScreen(pointer.tip, rotation);
        // Rule rotation laying its +y arm (and so its edge) through the star.
        const rho = Math.atan2(-tip.x, -tip.y) * 180 / Math.PI;
        const dir = ruleToScreen({ x: 0, y: 1 }, rho);
        expect(cross(dir, tip)).toBeCloseTo(0, 6);
        // The arm's body lies on +x of its own frame.
        const bodySide = Math.sign(cross(dir, ruleToScreen({ x: 10, y: 100 }, rho)));
        for (const vertex of pointer.outline.slice(1, -1)) {
          expect(Math.sign(cross(dir, reteToScreen(vertex, rotation)))).toBe(-bodySide);
        }
      }
    }
  });
});
