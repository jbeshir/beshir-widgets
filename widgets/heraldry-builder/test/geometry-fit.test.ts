// Charge slots must stay on the shield and on/off their ordinary: every slot's glyph disc (radius
// 0.4 × the slot box — the art fills ~80% of its box) lies inside the shield, inside the bordure
// ring's inner edge, on the ordinary it is charged on, or clear of the ordinary it sits between.

import { describe, expect, it } from 'vitest';
import {
  BETWEEN_SLOTS, FIELD_SLOTS, ORDINARY_PATHS, SHIELD_INSET_PATH, SHIELD_PATH, UNDER_CHIEF_SLOTS, onOrdinarySlots, slotsFor,
  type Slot,
} from '../src/lib/heraldry';
import type { Count, OrdinaryType } from '../src/lib/heraldry';

type Pt = [number, number];

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Parse the M/H/V/L/C/Z subset the shield and ordinary paths use into one polygon. */
function polygon(d: string): Pt[] {
  const tok = d.match(/[MHVLCZ]|-?\d+(?:\.\d+)?/g)!;
  const pts: Pt[] = [];
  let i = 0, cmd = '';
  let x = 0, y = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[A-Z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z') continue;
    if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); pts.push([x, y]); }
    else if (cmd === 'H') { x = num(); pts.push([x, y]); }
    else if (cmd === 'V') { y = num(); pts.push([x, y]); }
    else if (cmd === 'C') {
      const c1: Pt = [num(), num()], c2: Pt = [num(), num()], e: Pt = [num(), num()];
      pts.push(...bezier([x, y], c1, c2, e));
      [x, y] = e;
    }
  }
  return pts;
}

function inside(poly: Pt[], [px, py]: Pt): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Points on the glyph disc: centre plus 16 on its rim. */
function disc(s: Slot): Pt[] {
  const r = 0.4 * s.size;
  const out: Pt[] = [[s.x, s.y]];
  for (let k = 0; k < 16; k++) out.push([s.x + r * Math.cos((k * Math.PI) / 8), s.y + r * Math.sin((k * Math.PI) / 8)]);
  return out;
}

const SHIELD = polygon(SHIELD_PATH);
const INSET = polygon(SHIELD_INSET_PATH);
const poly = (t: OrdinaryType) => polygon(ORDINARY_PATHS[t].split('M').filter(Boolean).map((s) => `M${s}`)[0]);

describe('charge slots fit their ground', () => {
  it('field slots stay inside the shield and do not overlap each other', () => {
    for (const table of [FIELD_SLOTS, UNDER_CHIEF_SLOTS]) {
      for (const [key, slots] of Object.entries(table)) {
        for (const s of slots) expect(disc(s).every((p) => inside(SHIELD, p)), `${key} ${JSON.stringify(s)}`).toBe(true);
        slots.forEach((a, i) => slots.slice(i + 1).forEach((b) => {
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${key} overlap`).toBeGreaterThanOrEqual(0.8 * (a.size + b.size) / 2);
        }));
      }
    }
  });

  it('bordure charges stay inside the bordure', () => {
    for (const [key, slots] of Object.entries(FIELD_SLOTS)) {
      const [count, arrangement] = key.split(':');
      const placed = slotsFor({ type: 'bordure', tincture: 'argent' }, 'field', Number(count) as Count, arrangement as never);
      for (const s of placed) expect(disc(s).every((p) => inside(INSET, p)), `bordure ${key} ${JSON.stringify(s)}`).toBe(true);
      expect(placed.length === 0 || placed.length === slots.length).toBe(true);
    }
  });

  it('charges on an ordinary stay on it', () => {
    const types: OrdinaryType[] = ['fess', 'pale', 'chief', 'bend', 'bend-sinister', 'pile', 'chevron', 'cross', 'saltire'];
    for (const t of types) {
      for (const count of [1, 2, 3, 5] as Count[]) {
        for (const s of onOrdinarySlots(t, count)) {
          expect(disc(s).every((p) => inside(poly(t), p) && inside(SHIELD, p)), `${t} ${count} ${JSON.stringify(s)}`).toBe(true);
        }
      }
    }
  });

  it('charges between an ordinary stay clear of it and on the shield', () => {
    for (const [key, slots] of Object.entries(BETWEEN_SLOTS)) {
      const t = key.split(':')[0] as OrdinaryType;
      for (const s of slots) {
        expect(disc(s).every((p) => inside(SHIELD, p) && !inside(poly(t), p)), `${key} ${JSON.stringify(s)}`).toBe(true);
      }
    }
  });
});
