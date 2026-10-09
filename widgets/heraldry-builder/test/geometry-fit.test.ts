// Charge slots must stay on the shield and on/off their ordinary: every slot's glyph disc (radius
// 0.4 × the slot box — the art fills ~80% of its box) lies inside the shield, inside the bordure
// ring's inner edge, on the ordinary it is charged on, or clear of the ordinary it sits between.
// The same holds for the real artwork: every vertex of every drawing, drawn in its optically scaled
// box, stays on the shield (clear of its edge) and neighbouring charges never overlap. Art also stays
// on, or clear of, a fess, pale, chief, bend, pile or cross; the chevron's and saltire's arms are
// narrower than a square charge's corners, so for those the glyph disc above is the check.

import { describe, expect, it } from 'vitest';
import {
  BETWEEN_SLOTS, CHARGES, CHARGE_ART, CHARGE_IDS, FIELD_SLOTS, ORDINARY_PATHS, ORDINARY_TYPES, SHIELD_INSET_PATH, SHIELD_PATH,
  UNDER_CHIEF_SLOTS, drawnBox, onOrdinarySlots, slotsFor, type ChargeId, type Slot,
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

// ── Real artwork in its optically scaled box ────────────────────────────────

/** Each drawing as rings of points in its 0–100 box (the art is M/L/Z polygons only). */
function rings(d: string): Pt[][] {
  return d.split('M').filter(Boolean).map((sub) => {
    const n = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
    return Array.from({ length: n.length / 2 }, (_, i): Pt => [n[2 * i], n[2 * i + 1]]);
  });
}

const DRAWINGS = CHARGE_IDS.flatMap((id) => Object.entries(CHARGE_ART[id]).map(([posture, d]) => ({ id, label: `${id} ${posture}`, rings: rings(d!) })));

const place = (rs: Pt[][], box: Slot): Pt[][] =>
  rs.map((r) => r.map(([x, y]): Pt => [box.x + (x - 50) * box.size / 100, box.y + (y - 50) * box.size / 100]));

/** Even-odd point-in-drawing test across all of a drawing's rings. */
const inDrawing = (rs: Pt[][], p: Pt) => rs.filter((r) => inside(r, p)).length % 2 === 1;

/** Distance from p to the nearest edge of a polygon. */
function edgeDistance(poly: Pt[], [px, py]: Pt): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i];
    const L = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const t = L ? Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / L)) : 0;
    best = Math.min(best, Math.hypot(px - x1 - t * (x2 - x1), py - y1 - t * (y2 - y1)));
  }
  return best;
}

/** Clear of the shield's edge by at least a unit, so the outline never touches a charge. */
const SHIELD_MARGIN = 1;
const onShield = (p: Pt) => inside(SHIELD, p) && edgeDistance(SHIELD, p) >= SHIELD_MARGIN;

interface Ground { name: string; slots: Slot[]; fits: (p: Pt) => boolean }

/** Ordinaries whose band is wide enough for the art's corners, so the real art must respect them. */
const ART_RESPECTS: readonly OrdinaryType[] = ['fess', 'pale', 'chief', 'bend', 'bend-sinister', 'pile', 'cross'];
const respects = (t: OrdinaryType) => ART_RESPECTS.includes(t);

function grounds(): Ground[] {
  const out: Ground[] = [];
  for (const [key, slots] of Object.entries(FIELD_SLOTS)) {
    out.push({ name: `field ${key}`, slots, fits: onShield });
    const [count, arrangement] = key.split(':');
    const placed = slotsFor({ type: 'bordure', tincture: 'argent' }, 'field', Number(count) as Count, arrangement as never);
    out.push({ name: `bordure ${key}`, slots: placed, fits: (p) => inside(INSET, p) });
  }
  for (const [key, slots] of Object.entries(UNDER_CHIEF_SLOTS)) out.push({ name: `under chief ${key}`, slots, fits: (p) => onShield(p) && !inside(poly('chief'), p) });
  for (const [key, slots] of Object.entries(BETWEEN_SLOTS)) {
    const t = key.split(':')[0] as OrdinaryType;
    out.push({ name: `between ${key}`, slots, fits: (p) => onShield(p) && !(respects(t) && inside(poly(t), p)) });
  }
  for (const t of ORDINARY_TYPES.filter((o) => o !== 'bordure')) {
    for (const count of [1, 2, 3, 5] as Count[]) {
      const slots = onOrdinarySlots(t, count);
      if (slots.length) out.push({ name: `on ${t} ${count}`, slots, fits: (p) => onShield(p) && (!respects(t) || inside(poly(t), p)) });
    }
  }
  return out;
}

describe('charge artwork fits its ground at its optical scale', () => {
  it('every charge has an optical scale between 0.85 and 1.2', () => {
    for (const id of CHARGE_IDS) {
      expect(CHARGES[id].scale, id).toBeGreaterThanOrEqual(0.85);
      expect(CHARGES[id].scale, id).toBeLessThanOrEqual(1.2);
    }
  });

  it('drawnBox scales the slot about its centre', () => {
    const slot = { x: 50, y: 54, size: 90 };
    for (const id of CHARGE_IDS) expect(drawnBox(slot, id)).toEqual({ x: 50, y: 54, size: Math.round(90 * CHARGES[id].scale * 100) / 100 });
  });

  for (const g of grounds()) {
    it(`${g.name}: every drawing stays on its ground and clear of its neighbours`, () => {
      for (const dr of DRAWINGS) {
        const placed = g.slots.map((s) => place(dr.rings, drawnBox(s, dr.id as ChargeId)));
        for (const rs of placed) {
          const off = rs.flat().find((p) => !g.fits(p));
          expect(off, `${dr.label} leaves its ground at ${off}`).toBeUndefined();
        }
        placed.forEach((a, i) => placed.forEach((b, j) => {
          if (i === j) return;
          const hit = a.flat().find((p) => inDrawing(b, p));
          expect(hit, `${dr.label}: charge ${i + 1} overlaps charge ${j + 1} at ${hit}`).toBeUndefined();
        }));
      }
    });
  }
});
