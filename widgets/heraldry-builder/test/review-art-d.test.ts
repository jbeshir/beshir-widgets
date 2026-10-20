// The drawings the phase-D art review found hard to name at nametag size (findings A-4 … A-29 and the rules review's R-9,
// /workspace/pd/review/findings-art.md): each is pinned by the feature that tells it apart, measured on its drawing — a line across the
// drawing and the stretches of it that lie inside (even-odd), or the share of a held item that lies over its holder. The redrawn beasts and
// birds whose feature is a matter of shape (the dragon, swan, boar, eagle close, dolphin, sea-lion, dove) and the demi cuts are pinned by
// the render golden.

import { describe, expect, it } from 'vitest';
import { chargePath, overlaidArt, pathRings, resolve, type Charge } from '../src/lib/heraldry';
import type { Pt } from '../src/lib/heraldry/geometry';
import { charge } from './helpers';

type Rings = readonly (readonly Pt[])[];

/** A charge as the design reads it, with its defaults filled in. */
function resolved(item: object): Charge {
  const r = resolve({ v: 2, field: 'azure', groups: [{ item: charge('', item), paint: 'or' }] });
  if (!r.ok || r.design.groups[0].item.k !== 'charge') throw new Error(JSON.stringify(item));
  return r.design.groups[0].item;
}

const drawing = (item: object): Rings => pathRings(chargePath(resolved(item)));

/** The stretches [from, to] of the line y = `at` (or x = `at`) that lie inside the drawing, in order. */
function inside(rs: Rings, at: number, vertical = false): Array<[number, number]> {
  const cuts = rs.flatMap((r) => r.flatMap((p, i) => {
    const q = r[(i + 1) % r.length];
    const [a0, b0, a1, b1] = vertical ? [p[1], p[0], q[1], q[0]] : [p[0], p[1], q[0], q[1]];
    return (b0 > at) !== (b1 > at) ? [a0 + ((at - b0) * (a1 - a0)) / (b1 - b0)] : [];
  })).sort((a, b) => a - b);
  return Array.from({ length: cuts.length / 2 }, (_, i): [number, number] => [cuts[2 * i], cuts[2 * i + 1]]);
}

const widths = (stretches: Array<[number, number]>) => stretches.map(([a, b]) => b - a);
const lowest = (rs: Rings) => Math.max(...rs.flat().map(([, y]) => y));
const highest = (rs: Rings) => Math.min(...rs.flat().map(([, y]) => y));

function isInside(rs: Rings, x: number, y: number): boolean {
  let odd = false;
  for (const r of rs) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}

/** The share of a held item's area (sampled on a grid of whole units) that lies over its holder's drawing. */
function heldOverHolder(holder: object, how: string, item: string): number {
  const o = overlaidArt(resolved({ ...holder, holds: [{ how, item: charge(item), paint: 'argent' }] }));
  const held = o.overlays.find((p) => p.part === 'held');
  if (!held) throw new Error(`${JSON.stringify(holder)} holds nothing`);
  const body = pathRings(o.art), piece = pathRings(held.d);
  let all = 0, over = 0;
  for (let x = 0.5; x < 100; x++) for (let y = 0.5; y < 100; y++) if (isInside(piece, x, y)) { all++; if (isInside(body, x, y)) over++; }
  return over / all;
}

describe('the redrawn charges keep the feature that names them (art review)', () => {
  it('raises a bear passant\'s dexter forepaw well clear of the ground, and keeps a bear statant\'s on it (A-4)', () => {
    // how far the lowest point of the front quarter of the drawing (the dexter forepaw) is above the ground line (its lowest point)
    const clear = (posture: string) => { const d = drawing({ charge: 'bear', posture }).flat(); return lowest([d]) - lowest([d.filter(([x]) => x < 25)]); };
    expect(clear('passant')).toBeGreaterThanOrEqual(12);
    expect(clear('statant')).toBeLessThan(4);
  });

  it('draws a comet\'s tail as three streamers apart from each other (A-5)', () => {
    const d = drawing({ charge: 'comet' });
    const tail = inside(d, highest(d) + 0.79 * (lowest(d) - highest(d)));
    expect(tail).toHaveLength(3);
    expect(tail.slice(1).map(([a], i) => a - tail[i][1]).every((gap) => gap >= 5)).toBe(true);
  });

  it('draws a seeblatt with a stalk and a notch in each flank, so it is not a heart (A-6)', () => {
    const d = drawing({ charge: 'seeblatt' });
    // a stalk: one narrow stretch for the top 8 units
    for (const y of [highest(d) + 1, highest(d) + 8]) {
      expect(inside(d, y)).toHaveLength(1);
      expect(widths(inside(d, y))[0]).toBeLessThan(10);
    }
    // below the widest point the leaf narrows to its point, but widens again under each notch
    const profile = Array.from({ length: 40 }, (_, i) => widths(inside(d, 40 + i)).reduce((a, b) => a + b, 0));
    expect(profile.some((w, i) => i >= 5 && w > profile[i - 5] + 3)).toBe(true);
    expect(widths(inside(drawing({ charge: 'heart' }), highest(d) + 1))).toHaveLength(2);
  });

  it('forks a martlet\'s tail (A-7)', () => {
    const d = drawing({ charge: 'martlet' });
    const fork = inside(d, 85, true);
    expect(fork).toHaveLength(2);
    expect(fork[1][0] - fork[0][1]).toBeGreaterThanOrEqual(6);
  });

  it('splits each end of a cross moline into two horns at least 9 across, with a notch 6 deep between them (A-8)', () => {
    const d = drawing({ charge: 'cross-moline' });
    const horns = inside(d, highest(d) + 6);
    expect(horns).toHaveLength(2);
    expect(widths(horns).every((w) => w >= 9)).toBe(true);
  });

  it('stands the middle point of a cross patonce\'s ends at least 7 past the two outer points (A-9)', () => {
    const d = drawing({ charge: 'cross-patonce' });
    // the top arm's outer points are its highest points away from the middle
    const outer = Math.min(...d.flat().filter(([x]) => Math.abs(x - 50) > 10 && Math.abs(x - 50) < 30).map(([, y]) => y));
    expect(outer - highest(d)).toBeGreaterThanOrEqual(7);
  });

  it('draws a dagger with a short guard and a blade tapering to its point, not as a Latin cross (A-11)', () => {
    const d = drawing({ charge: 'dagger' });
    const height = lowest(d) - highest(d);
    const guard = Math.max(...Array.from({ length: 86 }, (_, i) => Math.max(0, ...widths(inside(d, 7.5 + i)))));
    expect(guard).toBeLessThanOrEqual(0.36 * height);
    const blade = (share: number) => widths(inside(d, highest(d) + share * height))[0];
    expect(blade(0.1)).toBeLessThanOrEqual(0.75 * blade(0.4));
  });

  it('draws a rapier with a blade much slimmer than the sword\'s and as long a guard (A-22)', () => {
    const blade = (id: string) => widths(inside(drawing({ charge: id }), 40))[0];
    expect(blade('rapier')).toBeLessThanOrEqual(0.6 * blade('sword'));
    const reach = (id: string) => { const xs = drawing({ charge: id }).flat().map(([x]) => x); return Math.max(...xs) - Math.min(...xs); };
    expect(reach('rapier')).toBeGreaterThanOrEqual(0.8 * reach('sword'));
  });
});

describe('a held item lies beside its holder, not over it (A-14, A-27, R-9: in the holder\'s own tincture it would not be seen)', () => {
  it('sets an item sustained by an eagle displayed or a wyvern at the talon or claw, off the body (A-14)', () => {
    expect(heldOverHolder({ charge: 'eagle' }, 'sustaining', 'axe')).toBeLessThan(0.3);
    expect(heldOverHolder({ charge: 'wyvern' }, 'sustaining', 'axe')).toBeLessThan(0.3);
    expect(heldOverHolder({ charge: 'wyvern', posture: 'erect' }, 'sustaining', 'axe')).toBeLessThan(0.3);
  });

  it('has a standing or sitting beast hold a sword by its grip, leaning out before it, not planted on the ground beside it (A-27)', () => {
    const holders = [
      ...['statant', 'sejant', 'couchant'].map((posture) => ({ charge: 'lion', posture })),
      ...['statant', 'sejant'].map((posture) => ({ charge: 'lion', posture, gaze: 'guardant' })),
      { charge: 'goat', posture: 'statant' }, { charge: 'hare', posture: 'sejant' },
      ...['passant', 'sejant'].map((posture) => ({ charge: 'unicorn', posture })),
      { charge: 'wolf', posture: 'sejant' }, { charge: 'fox', posture: 'sejant' }, { charge: 'eagle', posture: 'close' }, { charge: 'owl' },
    ];
    for (const holder of holders) expect(heldOverHolder(holder, 'maintaining', 'sword'), JSON.stringify(holder)).toBeLessThan(0.4);
  });

  it('keeps the sable swords of regid:6799\'s sable squirrels mostly off them (R-9)', () => {
    expect(heldOverHolder({ charge: 'squirrel' }, 'maintaining', 'sword')).toBeLessThan(0.5);
  });

  it('has an owl hold a key in its beak below its eyes, not across one (A-19)', () => {
    const o = overlaidArt(resolved({ charge: 'owl', holds: [{ how: 'in-beak', item: charge('key'), paint: 'argent' }] }));
    const owl = pathRings(o.art), key = pathRings(o.overlays.find((p) => p.part === 'held')!.d);
    // the eyes: the holes in the upper half of the drawing wider than the beak
    const span = (r: readonly Pt[], k: 0 | 1) => Math.max(...r.map((p) => p[k])) - Math.min(...r.map((p) => p[k]));
    const eyes = owl.filter((r) => isInside(owl.filter((other) => other !== r), ...r[0]) && Math.max(...r.map(([, y]) => y)) < 50 && span(r, 0) > 8);
    expect(eyes).toHaveLength(2);
    let hits = 0;
    for (let x = 0.5; x < 100; x++) for (let y = 0.5; y < 100; y++) if (isInside(key, x, y) && eyes.some((eye) => isInside([eye], x, y))) hits++;
    expect(hits).toBe(0);
  });
});
