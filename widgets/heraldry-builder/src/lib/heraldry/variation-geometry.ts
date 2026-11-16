// Where the two tinctures of a field variation (barry, paly, checky, ...) lie in a shape's bounding box: the
// region paths the renderer fills and the membership test the rules and counterchanging use. The first-named
// tincture lies in the dexter chief corner (the top stripe of barry, the left one of paly), and every pattern is
// anchored there, so a shape's own outline decides what shows. Pure geometry, no tinctures.

import { DEFAULT_PIECES, type Variation } from './divisions';
import { boundedMemo } from './memo';
import { notSupported, type Lines } from './design';
import { contourPath, type Contour } from './contour';
import { LINE_PROFILE, featureMiddle, fieldSide, fitPeriod, runAlong, visibleSpan, type ComplexLine, type LaidLine } from './lines';

/** The bounding box of a shape: what the stripes and the grid are laid out over. */
export interface Box { x0: number; y0: number; x1: number; y1: number }

type Pt = [number, number];

const r2 = (n: number) => Math.round(n * 100) / 100;
const polygon = (p: readonly Pt[]) => `M${p.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;
const rect = (xa: number, ya: number, xb: number, yb: number): Pt[] => [[xa, ya], [xb, ya], [xb, yb], [xa, yb]];

/** How far a stripe runs past the box, so a shape's outline and not the stripe ends the picture. */
const REACH = 60;
/** Cells across checky and the paly-bendy lattice, bars down barry bendy, and lozenges and fusils across the box. */
const CHECKY_COLUMNS = 6;
const LOZENGY_COLUMNS = 5;
const FUSILY_COLUMNS = 6;
const LATTICE_ROWS = 6;
const LATTICE_COLUMNS = 6;
/** How tall a lozenge is against its width, and a fusil. */
const LOZENGE_RATIO = 1.3;
const FUSIL_RATIO = 2.4;
/** The three piles of pily: the share of the width a pile's base takes. */
const PILE_BASE = 1 / 4;
const PILES = 3;

/** A pattern of cells in two tinctures: the polygons of each, and which one a point lies in. */
interface Pattern {
  /** Polygons of the first and the second tincture. */
  polygons: () => [Pt[][], Pt[][]];
  /** Whether (x,y) lies in the first tincture. */
  inFirst: (x: number, y: number) => boolean;
}

const even = (n: number): boolean => ((n % 2) + 2) % 2 === 0;

/** `n` stripes across [lo, hi): the stripe index of a coordinate, clamped to the stripes. */
const stripeAt = (v: number, lo: number, hi: number, n: number): number => Math.min(n - 1, Math.max(0, Math.floor(((v - lo) * n) / (hi - lo))));

/** Equal stripes along one axis of the box, as polygons made from a band between two coordinates. */
function stripes(n: number, lo: number, hi: number, band: (a: number, b: number) => Pt[], at: (x: number, y: number) => number): Pattern {
  return {
    polygons: () => {
      const first: Pt[][] = [], second: Pt[][] = [];
      for (let i = 0; i < n; i++) (even(i) ? first : second).push(band(lo + ((hi - lo) * i) / n, lo + ((hi - lo) * (i + 1)) / n));
      return [first, second];
    },
    inFirst: (x, y) => even(stripeAt(at(x, y), lo, hi, n)),
  };
}

/** Whether a polygon lies wholly outside a box, so that it can be left out. */
const missesBox = (p: readonly Pt[], { x0, y0, x1, y1 }: Box): boolean =>
  Math.max(...p.map(([x]) => x)) < x0 || Math.min(...p.map(([x]) => x)) > x1 || Math.max(...p.map(([, y]) => y)) < y0 || Math.min(...p.map(([, y]) => y)) > y1;

/**
 * A lattice of cells that alternate in two directions at once: each cell is the polygon of its index pair, left out when it
 * misses the box. `index` gives a point's cell indices.
 */
function lattice(box: Box, rows: readonly number[], cols: readonly number[], cell: (i: number, j: number) => Pt[], index: (x: number, y: number) => [number, number]): Pattern {
  return {
    polygons: () => {
      const first: Pt[][] = [], second: Pt[][] = [];
      for (const i of rows) for (const j of cols) {
        const c = cell(i, j);
        if (!missesBox(c, box)) (even(i + j) ? first : second).push(c);
      }
      return [first, second];
    },
    inFirst: (x, y) => { const [i, j] = index(x, y); return even(i + j); },
  };
}

const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);

/** Diamonds centred on a lattice with spacing (a, b) anchored at the box corner; the second tincture fills the diamonds halfway between. */
function diamonds(box: Box, columns: number, ratio: number): Pattern {
  const a = (box.x1 - box.x0) / columns, b = a * ratio;
  const cols = range(-1, columns + 1), rows = range(-1, Math.ceil((box.y1 - box.y0) / b) + 1);
  const diamond = (cx: number, cy: number): Pt[] => [[cx, cy - b / 2], [cx + a / 2, cy], [cx, cy + b / 2], [cx - a / 2, cy]];
  return {
    polygons: () => [
      rows.flatMap((j) => cols.map((i) => diamond(box.x0 + i * a, box.y0 + j * b))),
      rows.flatMap((j) => cols.map((i) => diamond(box.x0 + (i + 0.5) * a, box.y0 + (j + 0.5) * b))),
    ],
    inFirst: (x, y) => {
      const u = (x - box.x0) / a, w = (y - box.y0) / b;
      return Math.abs(u - Math.round(u)) + Math.abs(w - Math.round(w)) <= 0.5;
    },
  };
}

/** The three piles of pily: the first tincture is the field they stand on, the second the piles from the chief to the base. */
function piles(box: Box): Pattern {
  const w = box.x1 - box.x0, h = box.y1 - box.y0, half = (w * PILE_BASE) / 2;
  const centre = (i: number) => box.x0 + (w * (2 * i + 1)) / (2 * PILES);
  // The piles are drawn turning the other way round from the field, so that they are holes in it; they run on past the top edge.
  const reach = (half * (h + REACH)) / h;
  return {
    polygons: () => [
      [rect(box.x0 - REACH, box.y0 - REACH, box.x1 + REACH, box.y1 + REACH)],
      range(0, PILES - 1).map((i) => [[centre(i) - reach, box.y0 - REACH], [centre(i), box.y1], [centre(i) + reach, box.y0 - REACH]] as Pt[]),
    ],
    inFirst: (x, y) => !range(0, PILES - 1).some((i) => Math.abs(x - centre(i)) <= half * (1 - (y - box.y0) / h)),
  };
}

function patternOf(variation: Variation, pieces: number | null, box: Box): Pattern {
  const n = pieces ?? DEFAULT_PIECES;
  const { x0, y0, x1, y1 } = box;
  const w = x1 - x0, h = y1 - y0;
  switch (variation) {
    case 'barry': return stripes(n, y0, y1, (a, b) => rect(x0 - REACH, a, x1 + REACH, b), (_, y) => y);
    case 'paly': return stripes(n, x0, x1, (a, b) => rect(a, y0 - REACH, b, y1 + REACH), (x) => x);
    // Bends run along y = x + t: the stripes are bands of t, the first one in the sinister chief corner (bendy sinister: dexter chief).
    case 'bendy': return stripes(n, y0 - x1, y1 - x0, (a, b) => [[x0 - REACH, x0 - REACH + a], [x1 + REACH, x1 + REACH + a], [x1 + REACH, x1 + REACH + b], [x0 - REACH, x0 - REACH + b]], (x, y) => y - x);
    case 'bendy-sinister': return stripes(n, y0 + x0, y1 + x1, (a, b) => [[x0 - REACH, a - x0 + REACH], [x1 + REACH, a - x1 - REACH], [x1 + REACH, b - x1 - REACH], [x0 - REACH, b - x0 + REACH]], (x, y) => y + x);
    // Chevronelly: nested chevrons y = u + |x - centre|, the first at the top.
    case 'chevronny': {
      const cx = (x0 + x1) / 2, lo = y0 - w / 2, reach = w / 2 + REACH;
      return stripes(n, lo, y1, (a, b) => [[cx - reach, a + reach], [cx, a], [cx + reach, a + reach], [cx + reach, b + reach], [cx, b], [cx - reach, b + reach]], (x, y) => y - Math.abs(x - cx));
    }
    case 'checky': {
      const s = w / CHECKY_COLUMNS;
      return lattice(box, range(0, CHECKY_COLUMNS - 1), range(0, Math.ceil(h / s) - 1), (i, j) => rect(x0 + i * s, y0 + j * s, x0 + (i + 1) * s, y0 + (j + 1) * s), (x, y) => [Math.floor((x - x0) / s), Math.floor((y - y0) / s)]);
    }
    case 'lozengy': return diamonds(box, LOZENGY_COLUMNS, LOZENGE_RATIO);
    case 'fusily': return diamonds(box, FUSILY_COLUMNS, FUSIL_RATIO);
    case 'pily': return piles(box);
    // Barry bendy: the bars cut by bends into a lattice of parallelograms.
    case 'barry-bendy': {
      const bar = h / LATTICE_ROWS, band = w / 2;
      const t0 = y0 - x1;
      return lattice(box, range(0, LATTICE_ROWS - 1), range(0, Math.ceil((y1 - x0 - t0) / band) - 1),
        (i, j) => {
          const [ya, yb, ta, tb] = [y0 + i * bar, y0 + (i + 1) * bar, t0 + j * band, t0 + (j + 1) * band];
          return [[ya - ta, ya], [ya - tb, ya], [yb - tb, yb], [yb - ta, yb]];
        },
        (x, y) => [Math.floor((y - y0) / bar), Math.floor((y - x - t0) / band)]);
    }
    // Paly bendy: the palets cut by bends.
    case 'paly-bendy': {
      const pale = w / LATTICE_COLUMNS, band = w / 2;
      const t0 = y0 - x1;
      return lattice(box, range(0, LATTICE_COLUMNS - 1), range(0, Math.ceil((y1 - x0 - t0) / band) - 1),
        (i, j) => {
          const [xa, xb, ta, tb] = [x0 + i * pale, x0 + (i + 1) * pale, t0 + j * band, t0 + (j + 1) * band];
          return [[xa, xa + ta], [xb, xb + ta], [xb, xb + tb], [xa, xa + tb]];
        },
        (x, y) => [Math.floor((x - x0) / pale), Math.floor((y - x - t0) / band)]);
    }
    default: return variation satisfies never;
  }
}

/** A rotation by `turn` degrees clockwise about the box's middle. */
function turnAbout(box: Box, turn: number): (p: Pt) => Pt {
  const [cx, cy] = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
  const a = (turn * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return ([x, y]) => (turn === 0 ? [x, y] : [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]);
}

/**
 * Region paths [first tincture, second tincture] of a variation over a box, its stripes' boundaries drawn with the variation's line,
 * turned `turn` degrees clockwise about the box's middle (a charge's own frame); with the shape's outline, or the element's, as a clip
 * they cover it exactly.
 */
export function variationRegions(variation: Variation, pieces: number | null, lines: Lines, box: Box, turn = 0): [string, string] {
  if (lines.a !== 'plain') return linedRegions(variation, pieces ?? DEFAULT_PIECES, lines.a, box, turn);
  const [first, second] = patternOf(variation, pieces, box).polygons();
  const turned = turnAbout(box, turn);
  return [first.map((p) => polygon(p.map(turned))).join(''), second.map((p) => polygon(p.map(turned))).join('')];
}

/** The stripes a line is drawn on: each boundary, at offset `t` across them, as its two far ends; and the range of `t` over the box. */
interface StripeLines { ends: (t: number) => [Pt, Pt]; lo: number; hi: number; centre: number }

function stripeLines(variation: Variation, line: ComplexLine, { x0, y0, x1, y1 }: Box): StripeLines {
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  switch (variation) {
    case 'barry': return { ends: (t) => [[x0 - REACH, t], [x1 + REACH, t]], lo: y0, hi: y1, centre: cy };
    case 'paly': return { ends: (t) => [[t, y0 - REACH], [t, y1 + REACH]], lo: x0, hi: x1, centre: cx };
    case 'bendy': return { ends: (t) => [[x0 - REACH, x0 - REACH + t], [x1 + REACH, x1 + REACH + t]], lo: y0 - x1, hi: y1 - x0, centre: cy - cx };
    case 'bendy-sinister': return { ends: (t) => [[x0 - REACH, t - x0 + REACH], [x1 + REACH, t - x1 - REACH]], lo: y0 + x0, hi: y1 + x1, centre: cy + cx };
    // Stripes that turn a corner (chevronny) take no line yet; the others have no stripes.
    default: return notSupported({ category: 'line-of-partition', detail: `${line}-on-${variation}` });
  }
}

/** A stripe's line may take this share of the stripe's width at most, so that a narrow stripe still reads. */
const LINE_SHARE_OF_STRIPE = 0.8;

const linedMemo = boundedMemo<[string, string]>(2000);

/**
 * Stripes whose boundaries are drawn with a complex line: every boundary the same line, fitted to the chord of the middle one and in
 * phase across the box, so the stripes keep one width (both edges of a stripe pair as `parallel` edges do).
 */
function linedRegions(variation: Variation, n: number, line: ComplexLine, box: Box, turn: number): [string, string] {
  return linedMemo(JSON.stringify([variation, n, line, box, turn]), () => drawnLinedRegions(variation, n, line, box, turn));
}

function drawnLinedRegions(variation: Variation, n: number, line: ComplexLine, box: Box, turn: number): [string, string] {
  const { ends, lo, hi, centre } = stripeLines(variation, line, box);
  const turned = turnAbout(box, turn);
  const outline = rect(box.x0, box.y0, box.x1, box.y1).map(turned);
  const middle = turned([(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2]);
  const at = (t: number): [Pt, Pt] => { const [p, q] = ends(t); return [turned(p), turned(q)]; };
  const unit = ([p, q]: [Pt, Pt]): Pt => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
  const dir = unit(at(centre)), side = fieldSide(dir);
  const normal: Pt = [side * dir[1], -side * dir[0]];
  const ts = Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  const across = (p: Pt) => p[0] * normal[0] + p[1] * normal[1];
  const width = Math.abs(across(at(ts[1])[0]) - across(at(ts[0])[0]));
  const depth = Math.min(LINE_PROFILE[line].depth, LINE_SHARE_OF_STRIPE * width);
  const [m0, m1] = visibleSpan(...at(centre), outline) ?? [0, 1];
  const period = fitPeriod(line, m1 - m0, 1);
  // each boundary moved back by where its features lie, so that it straddles the line it is on (as a division's line does)
  const shift = featureMiddle(line) * depth;
  const boundary = (t: number): { ends: [Pt, Pt]; laid: LaidLine } => {
    const [p, q] = at(t).map(([x, y]): Pt => [x - shift * normal[0], y - shift * normal[1]]);
    const [s0, s1] = visibleSpan(p, q, outline) ?? [0, 0];
    const anchor = (middle[0] - p[0]) * dir[0] + (middle[1] - p[1]) * dir[1];
    return { ends: [p, q], laid: { origin: p, dir, run: { line, side, depth, period, anchor, span: [s0 - period, s1 + period] } } };
  };
  const bounds = ts.map((t, i) => (i === 0 || i === n ? { ends: at(t), laid: null } : boundary(t)));
  const stripe = (i: number): Contour => {
    const [[p0, q0], l0] = [bounds[i].ends, bounds[i].laid], [[p1, q1], l1] = [bounds[i + 1].ends, bounds[i + 1].laid];
    return { start: p0, edges: [
      { via: [], to: q0, run: l0 && runAlong(l0, p0, q0) },
      { via: [], to: q1, run: null },
      { via: [], to: p1, run: l1 && runAlong(l1, q1, p1) },
    ] };
  };
  const stripes = Array.from({ length: n }, (_, i) => contourPath(stripe(i)));
  return [stripes.filter((_, i) => even(i)).join(''), stripes.filter((_, i) => !even(i)).join('')];
}

/** Whether (x,y) lies in the first tincture of a variation. Points on a boundary count as the second. */
export function inFirstRegion(variation: Variation, pieces: number | null, box: Box, x: number, y: number): boolean {
  return patternOf(variation, pieces, box).inFirst(x, y);
}
