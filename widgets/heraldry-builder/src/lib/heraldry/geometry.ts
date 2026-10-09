// Shield geometry (FINDINGS §4.1): heater outline in viewBox 0 0 100 120, partition-line regions,
// ordinary shapes, and the fixed charge slot tables the five-point tincture probe relies on.
// All paths are SVG path strings; renderers clip everything to SHIELD_PATH.

import {
  chargeContext, type Count, type Arrangement, type Division, type Field, type NormDesign,
  type Ordinary, type OrdinaryType, type Placement,
} from './design';
import type { Tincture } from './tinctures';

export const SHIELD_VIEWBOX = '0 0 100 120';
export const SHIELD_WIDTH = 100;
export const SHIELD_HEIGHT = 120;
export const FESS_POINT = { x: 50, y: 50 } as const;

/** Heater shield: straight top and sides to y=60, then two curves meeting at the base point. */
export const SHIELD_PATH = 'M0 0H100V60C100 92 76 110 50 120C24 110 0 92 0 60Z';
/** The shield inset by 10 units — the inner edge of a bordure. */
export const SHIELD_INSET_PATH = 'M10 10H90V60C90 86 70 102 50 110C30 102 10 86 10 60Z';

/** Charge artwork viewBox (FINDINGS §5.3). */
export const CHARGE_VIEWBOX = '0 0 100 100';

const r2 = (n: number) => Math.round(n * 100) / 100;
const pts = (p: Array<[number, number]>) => `M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;

// ── Field partitions ────────────────────────────────────────────────────────

/** Which field tincture lies at (x,y) — §4.3 rules; points exactly on a line count as t2. */
export function fieldTinctureAt(field: Field, x: number, y: number): Tincture {
  if (field.kind === 'plain') return field.tincture;
  const [t1, t2] = field.tinctures;
  return inFirstPart(field.division, x, y) ? t1 : t2;
}

export function inFirstPart(division: Division, x: number, y: number): boolean {
  switch (division) {
    case 'per-pale': return x < 50;
    case 'per-fess': return y < 50;
    case 'per-bend': return y < x;
    case 'per-bend-sinister': return y < 100 - x;
    case 'per-saltire': return (y < x && y < 100 - x) || (y > x && y > 100 - x);
    case 'quarterly': return x < 50 === y < 50;
    case 'per-chevron': return y < 40 + Math.abs(x - 50);
  }
}

/** Region paths [t1-part, t2-part] covering the 100×120 box (clip to SHIELD_PATH when drawing). */
export const PARTITION_REGIONS: Record<Division, [string, string]> = {
  'per-pale': [pts([[0, 0], [50, 0], [50, 120], [0, 120]]), pts([[50, 0], [100, 0], [100, 120], [50, 120]])],
  'per-fess': [pts([[0, 0], [100, 0], [100, 50], [0, 50]]), pts([[0, 50], [100, 50], [100, 120], [0, 120]])],
  'per-bend': [pts([[0, 0], [100, 0], [100, 100]]), pts([[0, 0], [100, 100], [100, 120], [0, 120]])],
  'per-bend-sinister': [pts([[0, 0], [100, 0], [0, 100]]), pts([[100, 0], [100, 120], [0, 120], [0, 100]])],
  'per-saltire': [
    pts([[0, 0], [100, 0], [50, 50]]) + pts([[50, 50], [100, 100], [100, 120], [0, 120], [0, 100]]),
    pts([[0, 0], [50, 50], [0, 100]]) + pts([[100, 0], [100, 100], [50, 50]]),
  ],
  'per-chevron': [pts([[0, 0], [100, 0], [100, 90], [50, 40], [0, 90]]), pts([[0, 90], [50, 40], [100, 90], [100, 120], [0, 120]])],
  quarterly: [
    pts([[0, 0], [50, 0], [50, 50], [0, 50]]) + pts([[50, 50], [100, 50], [100, 120], [50, 120]]),
    pts([[50, 0], [100, 0], [100, 50], [50, 50]]) + pts([[0, 50], [50, 50], [50, 120], [0, 120]]),
  ],
};

/** Field as tincture-filled regions, in paint order. */
export function fieldRegions(field: Field): Array<{ tincture: Tincture; d: string }> {
  if (field.kind === 'plain') return [{ tincture: field.tincture, d: SHIELD_PATH }];
  const [a, b] = PARTITION_REGIONS[field.division];
  return [{ tincture: field.tinctures[0], d: a }, { tincture: field.tinctures[1], d: b }];
}

// ── Ordinaries ──────────────────────────────────────────────────────────────

const BEND_HALF = 15 * Math.SQRT2;      // 30-wide band, measured perpendicular to a 45° line
const SALTIRE_HALF = 12 * Math.SQRT2;   // 24-wide arms
const CHEVRON_THICK = 22 * Math.SQRT2;  // 22-wide band, measured perpendicular to its limbs

/** Geometric constants used by both the shapes and the on-ordinary slots. */
export const ORDINARY_GEOMETRY = {
  fess: { y0: 35, y1: 65 },
  pale: { x0: 35, x1: 65 },
  bendHalfVertical: BEND_HALF,
  chevron: { apexY: 40, thickness: CHEVRON_THICK },
  chief: { y1: 30 },
  bordure: { inset: 10 },
  pile: { top: [[20, 0], [80, 0]] as const, point: [50, 95] as const },
} as const;

const d = BEND_HALF;
const sd = SALTIRE_HALF;
export const ORDINARY_PATHS: Record<OrdinaryType, string> = {
  fess: pts([[-5, 35], [105, 35], [105, 65], [-5, 65]]),
  pale: pts([[35, -5], [65, -5], [65, 125], [35, 125]]),
  bend: pts([[-30, -30 - d], [130, 130 - d], [130, 130 + d], [-30, -30 + d]]),
  'bend-sinister': pts([[-30, 130 - d], [130, -30 - d], [130, -30 + d], [-30, 130 + d]]),
  chevron: pts([[-30, 120], [50, 40], [130, 120], [130, 120 + CHEVRON_THICK], [50, 40 + CHEVRON_THICK], [-30, 120 + CHEVRON_THICK]]),
  cross: pts([[38, -5], [62, -5], [62, 38], [105, 38], [105, 62], [62, 62], [62, 125], [38, 125], [38, 62], [-5, 62], [-5, 38], [38, 38]]),
  saltire: pts([
    [50, 50 - sd], [130, -30 - sd], [130, -30 + sd], [50 + sd, 50], [130, 130 - sd], [130, 130 + sd],
    [50, 50 + sd], [-30, 130 + sd], [-30, 130 - sd], [50 - sd, 50], [-30, -30 + sd], [-30, -30 - sd],
  ]),
  chief: pts([[-5, -5], [105, -5], [105, 30], [-5, 30]]),
  bordure: SHIELD_PATH + SHIELD_INSET_PATH,
  pile: pts([[20, 0], [80, 0], [50, 95]]),
};

/** The bordure is a ring (outline minus inset) and needs evenodd; everything else is nonzero. */
export const ORDINARY_FILL_RULE: Record<OrdinaryType, 'nonzero' | 'evenodd'> = {
  fess: 'nonzero', pale: 'nonzero', bend: 'nonzero', 'bend-sinister': 'nonzero', chevron: 'nonzero',
  cross: 'nonzero', saltire: 'nonzero', chief: 'nonzero', bordure: 'evenodd', pile: 'nonzero',
};

// ── Charge slots ────────────────────────────────────────────────────────────

/** Slot centre and box size in shield units. Order is reading order (top→bottom, left→right). */
export interface Slot { x: number; y: number; size: number }

const S = (size: number, ...xy: Array<[number, number]>): Slot[] => xy.map(([x, y]) => ({ x, y, size }));

/** placement 'field' with no ordinary (also scaled for a bordure). Key `${count}:${arrangement}`. */
export const FIELD_SLOTS: Record<string, Slot[]> = {
  '1:single': S(72, [50, 55]),
  '2:in-pale': S(44, [50, 30], [50, 82]),
  '2:in-fess': S(44, [28, 55], [72, 55]),
  '2:in-bend': S(42, [28, 30], [70, 74]),
  '2:in-bend-sinister': S(42, [72, 30], [30, 74]),
  '3:two-and-one': S(40, [28, 30], [72, 30], [50, 76]),
  '3:in-pale': S(32, [50, 20], [50, 56], [50, 92]),
  '3:in-fess': S(33, [19, 52], [50, 52], [81, 52]),
  '3:in-bend': S(32, [22, 22], [50, 50], [78, 78]),
  '3:in-bend-sinister': S(32, [78, 22], [50, 50], [22, 78]),
  '4:two-and-two': S(36, [28, 30], [72, 30], [31, 72], [69, 72]),
  '4:in-cross': S(32, [50, 22], [20, 55], [80, 55], [50, 88]),
  '5:in-saltire': S(28, [24, 26], [76, 26], [50, 55], [30, 86], [70, 86]),
  '5:in-cross': S(28, [50, 18], [18, 50], [50, 50], [82, 50], [50, 86]),
  '6:three-two-one': S(28, [20, 22], [50, 22], [80, 22], [34, 52], [66, 52], [50, 84]),
};

/** placement 'field' under a chief. */
export const UNDER_CHIEF_SLOTS: Record<string, Slot[]> = {
  '1:single': S(56, [50, 71]),
  '2:in-fess': S(38, [28, 70], [72, 70]),
  '3:two-and-one': S(32, [28, 54], [72, 54], [50, 90]),
  '3:in-fess': S(30, [19, 68], [50, 68], [81, 68]),
};

/** placement 'field' with a "between" ordinary. Key `${ordinary}:${count}`. */
export const BETWEEN_SLOTS: Record<string, Slot[]> = {
  'fess:2': S(30, [50, 19], [50, 86]),
  'fess:3': S(30, [28, 19], [72, 19], [50, 86]),
  'pale:2': S(30, [20, 50], [80, 50]),
  'bend:2': S(30, [76, 24], [24, 80]),
  'bend-sinister:2': S(30, [24, 24], [76, 80]),
  'chevron:3': S(32, [25, 22], [75, 22], [50, 94]),
  'cross:4': S(28, [21, 21], [79, 21], [21, 82], [79, 82]),
  'saltire:4': S(25, [50, 18], [16, 50], [84, 50], [50, 90]),
  'pile:2': S(28, [20, 75], [80, 75]),
};

const BORDURE_SCALE = 0.8;
const BORDURE_ORIGIN = { x: 50, y: 55 };

function withinBordure(slots: Slot[]): Slot[] {
  return slots.map((s) => ({
    x: r2(BORDURE_ORIGIN.x + (s.x - BORDURE_ORIGIN.x) * BORDURE_SCALE),
    y: r2(BORDURE_ORIGIN.y + (s.y - BORDURE_ORIGIN.y) * BORDURE_SCALE),
    size: r2(s.size * BORDURE_SCALE),
  }));
}

/** Positions along an ordinary's axis: 1 centred, 2 at ±15, 3 at 0 and ±28 (§4.1). */
function alongAxis(cx: number, cy: number, dx: number, dy: number, count: number, size: number): Slot[] {
  const offsets = count === 1 ? [0] : count === 2 ? [-15, 15] : count === 3 ? [-28, 0, 28] : [];
  return offsets.map((o) => ({ x: r2(cx + o * dx), y: r2(cy + o * dy), size }));
}

const DIAG = Math.SQRT1_2;
const CHEVRON_MID = 40 + CHEVRON_THICK / 2; // centre line of the chevron at its apex

/** Slots for charges ON an ordinary (upright, never turned bendwise in v1). */
export function onOrdinarySlots(type: OrdinaryType, count: Count): Slot[] {
  switch (type) {
    case 'fess': return alongAxis(50, 50, 1, 0, count, 27);
    case 'pale': return alongAxis(50, 50, 0, 1, count, 27);
    case 'chief': return alongAxis(50, 15, 1, 0, count, 26);
    case 'bend': return alongAxis(50, 50, DIAG, DIAG, count, 26);
    case 'bend-sinister': return alongAxis(50, 50, DIAG, -DIAG, count, 26);
    // The pile narrows towards its point, so its slots are tuned rather than evenly spaced.
    case 'pile':
      return count === 1 ? S(24, [50, 34]) : count === 2 ? S(22, [50, 22], [50, 48]) : count === 3 ? S(20, [50, 14], [50, 36], [50, 58]) : [];
    case 'chevron': {
      const apex: [number, number] = [50, r2(CHEVRON_MID)];
      const limbY = r2(CHEVRON_MID + 26);
      return count === 1 ? S(24, apex) : count === 2 ? S(24, [24, limbY], [76, limbY]) : count === 3 ? S(24, apex, [24, limbY], [76, limbY]) : [];
    }
    case 'cross':
      return count === 1 ? S(26, [50, 50]) : count === 5 ? S(26, [50, 19], [19, 50], [50, 50], [81, 50], [50, 88]) : [];
    case 'saltire':
      return count === 1 ? S(28, [50, 50]) : count === 5 ? S(24, [24, 24], [76, 24], [50, 50], [24, 76], [76, 76]) : [];
    case 'bordure': return [];
  }
}

/**
 * Slots for a charge group in context. Returns [] when the combination has no slot table
 * (i.e. it is structurally illegal — structuralIssues() reports why).
 */
export function slotsFor(ordinary: Ordinary | null, placement: Placement, count: Count, arrangement: Arrangement): Slot[] {
  const ctx = chargeContext(ordinary, placement);
  const key = `${count}:${arrangement}`;
  switch (ctx) {
    case 'field': return FIELD_SLOTS[key] ?? [];
    case 'bordure': return FIELD_SLOTS[key] ? withinBordure(FIELD_SLOTS[key]) : [];
    case 'chief': return UNDER_CHIEF_SLOTS[key] ?? [];
    case 'between': return ordinary ? (BETWEEN_SLOTS[`${ordinary.type}:${count}`] ?? []) : [];
    case 'on': return ordinary ? onOrdinarySlots(ordinary.type, count) : [];
  }
}

export function chargeSlots(nd: NormDesign): Slot[] {
  const c = nd.charges;
  return c ? slotsFor(nd.ordinary, c.placement, c.count, c.arrangement) : [];
}

/** The five probe points of a slot (§4.3): centre and ±0.3·size horizontally/vertically. */
export function probePoints(slot: Slot): Array<[number, number]> {
  const p = 0.3 * slot.size;
  return [[slot.x, slot.y], [slot.x - p, slot.y], [slot.x + p, slot.y], [slot.x, slot.y - p], [slot.x, slot.y + p]];
}

/** Field tinctures under a slot, in positional order (t1 before t2). */
export function slotContacts(field: Field, slot: Slot): Tincture[] {
  const seen = new Set<Tincture>();
  for (const [x, y] of probePoints(slot)) seen.add(fieldTinctureAt(field, x, y));
  if (field.kind === 'plain') return [...seen];
  return field.tinctures.filter((t, i) => seen.has(t) && field.tinctures.indexOf(t) === i);
}

/** Rough vertical/horizontal position words for a slot, used in messages ("upper", "left"). */
export function slotRow(slot: Slot): 'upper' | 'middle' | 'lower' {
  return slot.y < 42 ? 'upper' : slot.y > 66 ? 'lower' : 'middle';
}
export function slotColumn(slot: Slot): 'left' | 'centre' | 'right' {
  return slot.x < 40 ? 'left' : slot.x > 60 ? 'right' : 'centre';
}
