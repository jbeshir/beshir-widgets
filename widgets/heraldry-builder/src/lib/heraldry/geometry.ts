// Shield geometry: the outline of every field shape in one shared viewBox
// (0 0 100 120), partition-line regions, ordinary shapes and the charge slot tables the five-point
// tincture probe relies on. All paths are SVG path strings; renderers clip everything to the shape's
// outline.
//
// The heater shield is the canonical layout: the rule of tincture is judged on it alone, so a design
// gets the same verdict in every shape. The other shapes reuse the heater's construction (lines
// through the fess point, bands of the same width) around their own fess point and outline, with
// slot tables of their own (shape-slots.ts) that keep every charge on the same part of the field as
// its canonical slot while fitting the shape.

import {
  ON_COUNTS, ORDINARY_TYPES, chargeContext, type Count, type Arrangement, type Division, type Field, type NormDesign,
  type Ordinary, type OrdinaryType, type Placement,
} from './design';
import { CHARGES, type ChargeId } from './charges';
import type { FieldShape } from './shape';
import { SHAPED_SLOT_ROWS, type SlotContext, type SlotRow } from './shape-slots';
import type { Tincture } from './tinctures';

export const SHIELD_VIEWBOX = '0 0 100 120';

interface Point { x: number; y: number }

/** Heater shield: straight top and sides to y=60, then two curves meeting at the base point. */
export const SHIELD_PATH = 'M0 0H100V60C100 92 76 110 50 120C24 110 0 92 0 60Z';
/** The heater inset by 10 units — the inner edge of its bordure. */
const SHIELD_INSET_PATH = 'M10 10H90V60C90 86 70 102 50 110C30 102 10 86 10 60Z';

/** The layout every verdict is computed on. */
const CANONICAL_SHAPE: FieldShape = 'heater';

const r2 = (n: number) => Math.round(n * 100) / 100;
const pts = (p: Array<[number, number]>) => `M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;

/** A circle as four cubic arcs (so path parsers that know only M/L/C/Z can read it). */
function circlePath(cx: number, cy: number, r: number): string {
  const k = r2(r * 0.5523);
  return `M${cx} ${cy - r}C${r2(cx + k)} ${cy - r} ${cx + r} ${r2(cy - k)} ${cx + r} ${cy}`
    + `C${cx + r} ${r2(cy + k)} ${r2(cx + k)} ${cy + r} ${cx} ${cy + r}`
    + `C${r2(cx - k)} ${cy + r} ${cx - r} ${r2(cy + k)} ${cx - r} ${cy}`
    + `C${cx - r} ${r2(cy - k)} ${r2(cx - k)} ${cy - r} ${cx} ${cy - r}Z`;
}

/** A lozenge with the given centre and half-diagonals, shrunk so each side moves `inset` inwards. */
function lozengePath(cx: number, cy: number, hx: number, hy: number, inset: number): string {
  const k = 1 - (inset * Math.hypot(hx, hy)) / (hx * hy);
  return pts([[cx, cy - hy * k], [cx + hx * k, cy], [cx, cy + hy * k], [cx - hx * k, cy]]);
}

// ── Field shapes ────────────────────────────────────────────────────────────

/** The proportions a shape's layout is built from. */
interface ShapeFrame {
  outline: string;
  /** Inner edge of the bordure: the outline moved inwards (the lozenge's bordure is a little narrower). */
  inset: string;
  /** Where the partition lines and the arms of a cross or saltire meet. */
  fessPoint: Point;
  /** Lower edge of the chief. */
  chiefBase: number;
  /** The pile: two corners on the top edge and its point. */
  pile: [[number, number], [number, number], [number, number]];
}

const SHAPE_FRAME: Record<FieldShape, ShapeFrame> = {
  heater: {
    outline: SHIELD_PATH, inset: SHIELD_INSET_PATH, fessPoint: { x: 50, y: 50 }, chiefBase: 30,
    pile: [[20, 0], [80, 0], [50, 95]],
  },
  banner: {
    outline: 'M0 10H100V110H0Z', inset: 'M10 20H90V100H10Z', fessPoint: { x: 50, y: 60 }, chiefBase: 40,
    pile: [[20, 10], [80, 10], [50, 105]],
  },
  round: {
    outline: circlePath(50, 60, 50), inset: circlePath(50, 60, 40), fessPoint: { x: 50, y: 60 }, chiefBase: 40,
    pile: [[20, 10], [80, 10], [50, 105]],
  },
  lozenge: {
    outline: lozengePath(50, 60, 50, 60, 0), inset: lozengePath(50, 60, 50, 60, 8), fessPoint: { x: 50, y: 60 }, chiefBase: 46,
    pile: [[16, 0], [84, 0], [50, 110]],
  },
};

// ── Field partitions ────────────────────────────────────────────────────────

/** Which field tincture lies at (x,y) in the canonical layout; points exactly on a line count as t2. */
function fieldTinctureAt(field: Field, x: number, y: number): Tincture {
  if (field.kind === 'plain') return field.tincture;
  const [t1, t2] = field.tinctures;
  return inFirstPart(field.division, SHAPE_FRAME[CANONICAL_SHAPE].fessPoint, x, y) ? t1 : t2;
}

/** Whether (x,y) lies in the first part of a division whose lines meet at `fess`. */
export function inFirstPart(division: Division, fess: Point, x: number, y: number): boolean {
  const dx = x - fess.x, dy = y - fess.y;
  switch (division) {
    case 'per-pale': return dx < 0;
    case 'per-fess': return dy < 0;
    case 'per-bend': return dy < dx;
    case 'per-bend-sinister': return dy < -dx;
    case 'per-saltire': return (dy < dx && dy < -dx) || (dy > dx && dy > -dx);
    case 'quarterly': return dx < 0 === dy < 0;
    case 'per-chevron': return dy < Math.abs(dx) - CHEVRON_APEX_RISE;
  }
}

/** How far the chevron's apex (and the per-chevron line's) sits above the fess point. */
const CHEVRON_APEX_RISE = 10;
/** Partition regions and ordinaries run this far past the frame; the outline clips them. */
const OVER = { x0: -40, x1: 140, y0: -40, y1: 160 };

/** Region paths [t1-part, t2-part] for lines meeting at `fess`, covering the whole frame. */
function partitionRegions(fess: Point): Record<Division, [string, string]> {
  const { x: cx, y: cy } = fess;
  const { x0, x1, y0, y1 } = OVER;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE;
  const limb = apexY + (x1 - cx);
  const k = 100;
  return {
    'per-pale': [pts([[x0, y0], [cx, y0], [cx, y1], [x0, y1]]), pts([[cx, y0], [x1, y0], [x1, y1], [cx, y1]])],
    'per-fess': [pts([[x0, y0], [x1, y0], [x1, cy], [x0, cy]]), pts([[x0, cy], [x1, cy], [x1, y1], [x0, y1]])],
    'per-bend': [
      pts([[x0, y0], [x1, y0], [x1, bend(x1)], [x0, bend(x0)]]),
      pts([[x0, bend(x0)], [x1, bend(x1)], [x1, y1], [x0, y1]]),
    ],
    'per-bend-sinister': [
      pts([[x0, y0], [x1, y0], [x1, sinister(x1)], [x0, sinister(x0)]]),
      pts([[x0, sinister(x0)], [x1, sinister(x1)], [x1, y1], [x0, y1]]),
    ],
    'per-saltire': [
      pts([[cx - k, cy - k], [cx + k, cy - k], [cx, cy]]) + pts([[cx, cy], [cx + k, cy + k], [cx - k, cy + k]]),
      pts([[cx - k, cy - k], [cx, cy], [cx - k, cy + k]]) + pts([[cx + k, cy - k], [cx + k, cy + k], [cx, cy]]),
    ],
    'per-chevron': [
      pts([[x0, y0], [x1, y0], [x1, limb], [cx, apexY], [x0, limb]]),
      pts([[x0, limb], [cx, apexY], [x1, limb], [x1, y1], [x0, y1]]),
    ],
    quarterly: [
      pts([[x0, y0], [cx, y0], [cx, cy], [x0, cy]]) + pts([[cx, cy], [x1, cy], [x1, y1], [cx, y1]]),
      pts([[cx, y0], [x1, y0], [x1, cy], [cx, cy]]) + pts([[x0, cy], [cx, cy], [cx, y1], [x0, y1]]),
    ],
  };
}

// ── Ordinaries ──────────────────────────────────────────────────────────────

const BAND_HALF = 15;                   // fess and pale: 30 wide
const BEND_HALF = 15 * Math.SQRT2;      // 30-wide band, measured perpendicular to a 45° line
const CROSS_HALF = 12;                  // 24-wide arms
const SALTIRE_HALF = 12 * Math.SQRT2;   // 24-wide arms
const CHEVRON_THICK = 22 * Math.SQRT2;  // 22-wide band, measured perpendicular to its limbs

function ordinaryPaths(f: ShapeFrame): Record<OrdinaryType, string> {
  const { x: cx, y: cy } = f.fessPoint;
  const { x0, x1, y0, y1 } = OVER;
  const d = BEND_HALF, sd = SALTIRE_HALF, c = CROSS_HALF;
  const bend = (x: number) => cy + (x - cx);
  const sinister = (x: number) => cy - (x - cx);
  const apexY = cy - CHEVRON_APEX_RISE;
  const reach = 80; // limbs and saltire arms run this far (horizontally) from their centre
  return {
    fess: pts([[x0, cy - BAND_HALF], [x1, cy - BAND_HALF], [x1, cy + BAND_HALF], [x0, cy + BAND_HALF]]),
    pale: pts([[cx - BAND_HALF, y0], [cx + BAND_HALF, y0], [cx + BAND_HALF, y1], [cx - BAND_HALF, y1]]),
    bend: pts([[cx - reach, bend(cx - reach) - d], [cx + reach, bend(cx + reach) - d], [cx + reach, bend(cx + reach) + d], [cx - reach, bend(cx - reach) + d]]),
    'bend-sinister': pts([[cx - reach, sinister(cx - reach) - d], [cx + reach, sinister(cx + reach) - d], [cx + reach, sinister(cx + reach) + d], [cx - reach, sinister(cx - reach) + d]]),
    chevron: pts([
      [cx - reach, apexY + reach], [cx, apexY], [cx + reach, apexY + reach],
      [cx + reach, apexY + reach + CHEVRON_THICK], [cx, apexY + CHEVRON_THICK], [cx - reach, apexY + reach + CHEVRON_THICK],
    ]),
    cross: pts([
      [cx - c, y0], [cx + c, y0], [cx + c, cy - c], [x1, cy - c], [x1, cy + c], [cx + c, cy + c],
      [cx + c, y1], [cx - c, y1], [cx - c, cy + c], [x0, cy + c], [x0, cy - c], [cx - c, cy - c],
    ]),
    saltire: pts([
      [cx, cy - sd], [cx + reach, cy - reach - sd], [cx + reach, cy - reach + sd], [cx + sd, cy], [cx + reach, cy + reach - sd], [cx + reach, cy + reach + sd],
      [cx, cy + sd], [cx - reach, cy + reach + sd], [cx - reach, cy + reach - sd], [cx - sd, cy], [cx - reach, cy - reach + sd], [cx - reach, cy - reach - sd],
    ]),
    chief: pts([[x0, y0], [x1, y0], [x1, f.chiefBase], [x0, f.chiefBase]]),
    bordure: f.outline + f.inset,
    pile: pts(f.pile),
  };
}

/** The bordure is a ring (outline minus inset) and needs evenodd; everything else is nonzero. */
export const ORDINARY_FILL_RULE: Record<OrdinaryType, 'nonzero' | 'evenodd'> = {
  fess: 'nonzero', pale: 'nonzero', bend: 'nonzero', 'bend-sinister': 'nonzero', chevron: 'nonzero',
  cross: 'nonzero', saltire: 'nonzero', chief: 'nonzero', bordure: 'evenodd', pile: 'nonzero',
};

// ── Charge slots ────────────────────────────────────────────────────────────

/** Slot centre and box size in shield units. Order is reading order (top→bottom, left→right). */
export interface Slot { x: number; y: number; size: number }

/** The box a charge's art is drawn in: the slot scaled by the charge's optical scale about its centre. */
export function drawnBox(slot: Slot, charge: ChargeId): Slot {
  return { x: slot.x, y: slot.y, size: r2(slot.size * CHARGES[charge].scale) };
}

const S = (size: number, ...xy: Array<readonly [number, number]>): Slot[] => xy.map(([x, y]) => ({ x, y, size }));

/** placement 'field' with no ordinary (also scaled for a bordure). Key `${count}:${arrangement}`. */
const FIELD_SLOTS: Record<string, Slot[]> = {
  '1:single': S(90, [50, 54]),
  '2:in-pale': S(48, [50, 29], [50, 81]),
  '2:in-fess': S(48, [27, 52], [73, 52]),
  '2:in-bend': S(42, [30, 31], [70, 72]),
  '2:in-bend-sinister': S(42, [70, 31], [30, 72]),
  '3:two-and-one': S(44, [27, 29], [73, 29], [50, 77]),
  '3:in-pale': S(35, [50, 20], [50, 56], [50, 92]),
  '3:in-fess': S(32, [18, 52], [50, 52], [82, 52]),
  '3:in-bend': S(31, [24, 24], [50, 50], [75, 75]),
  '3:in-bend-sinister': S(31, [76, 24], [50, 50], [25, 75]),
  '4:two-and-two': S(40, [27, 29], [73, 29], [31, 73], [69, 73]),
  '4:in-cross': S(34, [50, 21], [20, 55], [80, 55], [50, 89]),
  '5:in-saltire': S(30, [23, 25], [77, 25], [50, 55], [31, 85], [69, 85]),
  '5:in-cross': S(30, [50, 18], [18, 51], [50, 51], [82, 51], [50, 86]),
  '6:three-two-one': S(31, [19, 21], [50, 21], [81, 21], [34, 52], [66, 52], [50, 84]),
};

/** placement 'field' under a chief. */
const UNDER_CHIEF_SLOTS: Record<string, Slot[]> = {
  '1:single': S(62, [50, 70]),
  '2:in-fess': S(42, [27, 67], [73, 67]),
  '3:two-and-one': S(35, [27, 53], [73, 53], [50, 89]),
  '3:in-fess': S(32, [18, 66], [50, 66], [82, 66]),
};

/** placement 'field' with a "between" ordinary. Key `${ordinary}:${count}`. */
export const BETWEEN_SLOTS: Record<string, Slot[]> = {
  'fess:2': S(30, [50, 19], [50, 86]),
  'fess:3': S(30, [28, 19], [72, 19], [50, 86]),
  'pale:2': S(30, [20, 50], [80, 50]),
  'bend:2': S(30, [76, 24], [24, 80]),
  'bend-sinister:2': S(29, [24, 24], [76, 80]),
  'chevron:3': S(32, [25, 22], [75, 22], [50, 94]),
  'cross:4': S(24, [20, 20], [80, 20], [21, 81], [79, 81]),
  'saltire:4': S(25, [50, 18], [16, 50], [84, 50], [50, 90]),
  'pile:2': S(26, [19, 76], [81, 76]),
};

const BORDURE_SCALE = 0.86;
const BORDURE_ORIGIN = { x: 50, y: 55 };

function withinBordure(slots: Slot[]): Slot[] {
  return slots.map((s) => ({
    x: r2(BORDURE_ORIGIN.x + (s.x - BORDURE_ORIGIN.x) * BORDURE_SCALE),
    y: r2(BORDURE_ORIGIN.y + (s.y - BORDURE_ORIGIN.y) * BORDURE_SCALE),
    size: r2(s.size * BORDURE_SCALE),
  }));
}

/** Positions along an ordinary's axis: 1 centred, 2 at ±15, 3 at 0 and ±28. */
function alongAxis(cx: number, cy: number, dx: number, dy: number, count: number, size: number): Slot[] {
  const offsets = count === 1 ? [0] : count === 2 ? [-15, 15] : count === 3 ? [-28, 0, 28] : [];
  return offsets.map((o) => ({ x: r2(cx + o * dx), y: r2(cy + o * dy), size }));
}

const DIAG = Math.SQRT1_2;
const CHEVRON_MID = 40 + CHEVRON_THICK / 2; // centre line of the heater's chevron at its apex

/** Heater slots for charges ON an ordinary (upright, never turned bendwise in v1). */
function onOrdinarySlots(type: OrdinaryType, count: Count): Slot[] {
  switch (type) {
    case 'fess': return alongAxis(50, 50, 1, 0, count, 27);
    case 'pale': return alongAxis(50, 50, 0, 1, count, 27);
    case 'chief': return alongAxis(50, 15, 1, 0, count, 26);
    case 'bend': return alongAxis(50, 50, DIAG, DIAG, count, 25.5);
    case 'bend-sinister': return alongAxis(50, 50, DIAG, -DIAG, count, 25.5);
    // The pile narrows towards its point, so its slots are tuned rather than evenly spaced.
    case 'pile':
      return count === 1 ? S(24, [50, 34]) : count === 2 ? S(22, [50, 22], [50, 48]) : count === 3 ? S(20, [50, 14], [50, 36], [50, 58]) : [];
    case 'chevron': {
      const apex: [number, number] = [50, r2(CHEVRON_MID)];
      const limbY = r2(CHEVRON_MID + 26);
      return count === 1 ? S(24, apex) : count === 2 ? S(24, [24, limbY], [76, limbY]) : count === 3 ? S(24, apex, [24, limbY], [76, limbY]) : [];
    }
    case 'cross':
      return count === 1 ? S(26, [50, 50]) : count === 5 ? S(24, [50, 19], [19, 50], [50, 50], [81, 50], [50, 88]) : [];
    case 'saltire':
      return count === 1 ? S(28, [50, 50]) : count === 5 ? S(24, [24, 24], [76, 24], [50, 50], [24, 76], [76, 76]) : [];
    case 'bordure': return [];
  }
}

/**
 * Every slot table of one shape. field/bordure/underChief are keyed `${count}:${arrangement}`,
 * between/on `${ordinary}:${count}`.
 */
export type SlotTables = Record<SlotContext, Record<string, Slot[]>>;

const HEATER_SLOTS: SlotTables = {
  field: FIELD_SLOTS,
  bordure: Object.fromEntries(Object.entries(FIELD_SLOTS).map(([k, slots]) => [k, withinBordure(slots)])),
  underChief: UNDER_CHIEF_SLOTS,
  between: BETWEEN_SLOTS,
  on: Object.fromEntries(
    ORDINARY_TYPES.flatMap((t) => ON_COUNTS[t].map((n) => [`${t}:${n}`, onOrdinarySlots(t, n)]))
  ),
};

function fromRows(rows: Record<SlotContext, Record<string, SlotRow>>): SlotTables {
  const table = (r: Record<string, SlotRow>) => Object.fromEntries(Object.entries(r).map(([k, [size, ...xy]]) => [k, S(size, ...xy)]));
  return { field: table(rows.field), bordure: table(rows.bordure), underChief: table(rows.underChief), between: table(rows.between), on: table(rows.on) };
}

// ── Layouts ─────────────────────────────────────────────────────────────────

/** Everything needed to draw a design in one shape. */
interface ShapeLayout {
  outline: string;
  /** Inner edge of the bordure. */
  inset: string;
  fessPoint: Point;
  regions: Record<Division, [string, string]>;
  ordinaries: Record<OrdinaryType, string>;
  slots: SlotTables;
}

function layout(shape: FieldShape, slots: SlotTables): ShapeLayout {
  const f = SHAPE_FRAME[shape];
  return { outline: f.outline, inset: f.inset, fessPoint: f.fessPoint, regions: partitionRegions(f.fessPoint), ordinaries: ordinaryPaths(f), slots };
}

export const SHAPE_LAYOUT: Record<FieldShape, ShapeLayout> = {
  heater: layout('heater', HEATER_SLOTS),
  banner: layout('banner', fromRows(SHAPED_SLOT_ROWS.banner)),
  round: layout('round', fromRows(SHAPED_SLOT_ROWS.round)),
  lozenge: layout('lozenge', fromRows(SHAPED_SLOT_ROWS.lozenge)),
};

/** Field as tincture-filled regions, in paint order. */
export function fieldRegions(field: Field, shape: FieldShape): Array<{ tincture: Tincture; d: string }> {
  const l = SHAPE_LAYOUT[shape];
  if (field.kind === 'plain') return [{ tincture: field.tincture, d: l.outline }];
  const [a, b] = l.regions[field.division];
  return [{ tincture: field.tinctures[0], d: a }, { tincture: field.tinctures[1], d: b }];
}

/**
 * Slots for a charge group in context and shape. Returns [] when the combination has no slot table
 * (i.e. it is structurally illegal — structuralIssues() reports why).
 */
export function slotsFor(ordinary: Ordinary | null, placement: Placement, count: Count, arrangement: Arrangement, shape: FieldShape): Slot[] {
  const t = SHAPE_LAYOUT[shape].slots;
  const ctx = chargeContext(ordinary, placement);
  const key = `${count}:${arrangement}`;
  switch (ctx) {
    case 'field': return t.field[key] ?? [];
    case 'bordure': return t.bordure[key] ?? [];
    case 'chief': return t.underChief[key] ?? [];
    case 'between': return ordinary ? (t.between[`${ordinary.type}:${count}`] ?? []) : [];
    case 'on': return ordinary ? (t.on[`${ordinary.type}:${count}`] ?? []) : [];
  }
}

/** The canonical (heater) slots: the ones the rule of tincture probes. */
export function chargeSlots(nd: NormDesign): Slot[] {
  return shapedChargeSlots(nd, CANONICAL_SHAPE);
}

/** Where the charges are drawn in a given shape. */
export function shapedChargeSlots(nd: NormDesign, shape: FieldShape): Slot[] {
  const c = nd.charges;
  return c ? slotsFor(nd.ordinary, c.placement, c.count, c.arrangement, shape) : [];
}

/** The five probe points of a slot: centre and ±0.3·size horizontally/vertically. */
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

// ── Counterchanged charges ──────────────────────────────────────────────────

/** One part of a counterchanged charge: a partition region it overlaps, filled with the field's other tincture. */
interface CounterchangedPart { region: 0 | 1; d: string; tincture: Tincture }

/** Grid steps across a drawn box when finding the regions it overlaps (corners and edges included). */
const PART_GRID = 8;

/**
 * How counterchanged charges are painted in a shape: for every drawn slot, the partition regions its
 * drawn box overlaps (sampled on a grid that includes the box's corners and edges), each to be
 * filled with the field's other tincture. [] unless the charges are counterchanged on a divided field.
 */
export function counterchangedParts(nd: NormDesign, shape: FieldShape): CounterchangedPart[][] {
  const c = nd.charges, f = nd.field;
  if (!c || c.tincture !== 'counterchanged' || f.kind !== 'divided') return [];
  const l = SHAPE_LAYOUT[shape];
  const [d1, d2] = l.regions[f.division];
  const [t1, t2] = f.tinctures;
  return shapedChargeSlots(nd, shape).map((s) => {
    const box = drawnBox(s, c.charge);
    const x0 = box.x - box.size / 2, y0 = box.y - box.size / 2, step = box.size / PART_GRID;
    const firsts = new Set<boolean>();
    for (let i = 0; i <= PART_GRID; i++) {
      for (let j = 0; j <= PART_GRID; j++) firsts.add(inFirstPart(f.division, l.fessPoint, x0 + i * step, y0 + j * step));
    }
    const parts: CounterchangedPart[] = [];
    if (firsts.has(true)) parts.push({ region: 0, d: d1, tincture: t2 });
    if (firsts.has(false)) parts.push({ region: 1, d: d2, tincture: t1 });
    return parts;
  });
}
