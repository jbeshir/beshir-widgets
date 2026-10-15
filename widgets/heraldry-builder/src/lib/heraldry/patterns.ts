// Procedural SVG patterns: a repeating tile of a ground colour and a few marks, small data rather than art.
// Pure data, no DOM; Shield.tsx turns a spec into a <pattern>. The drawings are original placeholders.

import { FUR_SPEC, TINCTURE_CODE, TINCTURE_FILL, type Tincture } from './tinctures';
import { furColours, type FurPaint } from './fur';
import { notSupported, type SemyPaint, type TreatedPaint } from './design';
import { isDrawnTreatment, type DrawnTreatment } from './divisions';
import { chargePath } from './charge-art';

/** A flat colour: a tincture of the palette, or a natural colour (a charge's palette, which is no tincture). */
export type SolidColour = { k: 'tincture'; t: Tincture } | { k: 'proper'; hex: string };

/** The colour a flat colour is painted in. */
export const colourHex = (c: SolidColour): string => (c.k === 'tincture' ? TINCTURE_FILL[c.t] : c.hex);

/** One repeating tile: a `width` × `height` ground with marks drawn on it, optionally scaled or turned as a whole; a mark may be placed within the tile by a transform of its own. */
export interface PatternSpec {
  /** Names the tile: equal ids are equal tiles, so a shield defines each once. */
  id: string;
  width: number;
  height: number;
  /** The tile's `patternTransform` (scaling it to the element it paints), or null. */
  transform: string | null;
  ground: SolidColour;
  marks: ReadonlyArray<{ d: string; colour: SolidColour; transform: string | null }>;
}

/**
 * One ermine spot: a tapering tail with three tufts over it, drawn from its top (the tail's root) downwards, about
 * 6.4 wide and 13.6 tall. Relative commands only, so a path is `M{x} {y}` followed by this.
 */
export const ERMINE_SPOT =
  'c1.9 1.6 2.1 3.6.9 8.2l-.9 1.8-.9-1.8c-1.2-4.6-1-6.6.9-8.2zm-3.2-1.8a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0zm2.4-1a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0zm2.4 1a.8.8 0 1 0 1.6 0 .8.8 0 1 0-1.6 0z';

const spotAt = (x: number, y: number): string => `M${x} ${y}${ERMINE_SPOT}`;

/** Bell outline of vair (width 10 at the base, 6 at the top, 12 tall), centred on `cx`, point-up or turned over. */
function bell(cx: number, top: number, inverted: boolean): string {
  const profile: ReadonlyArray<[number, number]> = [[3, 0], [3.3, 3.6], [4, 6], [4.7, 8.4], [5, 12]];
  const side = (sign: 1 | -1) => profile.map(([half, y]) => [cx + sign * half, top + (inverted ? 12 - y : y)]);
  const points = [...side(-1), ...side(1).reverse()];
  return `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
}

/** A crutch-head of potent: a bar of three squares of 4 with a stem of one beneath it, or (turned over) above it. */
const crutch = (x: number, y: number, inverted: boolean): string =>
  inverted ? `M${x + 4} ${y}h4v4h4v4h-12v-4h4z` : `M${x} ${y}h12v4h-4v4h-4v-4h-4z`;

interface Tile { width: number; height: number; marks: readonly string[] }

/** The ermine family's tile: two spots, the second half a tile along and down, so the spots stand in staggered rows. */
const ERMINE_TILE: Tile = { width: 20, height: 30, marks: [spotAt(5, 4.5), spotAt(15, 19.5)] };

/** Vair's tiles. Plain: each row of bells is set half a bell along from the last; counter: like bases meet; en pointe: the bells stand in columns. */
const VAIR_TILES = {
  plain: { width: 16, height: 24, marks: [bell(8, 0, false), bell(16, 12, false), bell(0, 12, false)] },
  counter: { width: 16, height: 24, marks: [bell(8, 0, false), bell(8, 12, true)] },
  'en-pointe': { width: 16, height: 12, marks: [bell(8, 0, false)] },
} satisfies Record<string, Tile>;

/** Potent's tiles, the same layouts: crutch-heads interlock in blocks of 16 × 8, each block set against the one beneath it. */
const POTENT_TILES = {
  plain: { width: 16, height: 16, marks: [crutch(0, 0, false), crutch(8, 8, false), crutch(-8, 8, false)] },
  counter: { width: 16, height: 16, marks: [crutch(0, 0, false), crutch(0, 8, true)] },
  'en-pointe': { width: 16, height: 8, marks: [crutch(0, 0, false)] },
} satisfies Record<string, Tile>;

const tileOf = (fur: FurPaint['fur']): Tile => {
  const { family, layout } = FUR_SPEC[fur];
  return family === 'ermine' ? ERMINE_TILE : family === 'vair' ? VAIR_TILES[layout] : POTENT_TILES[layout];
};

/**
 * The pattern of a fur drawn `scale` times its nominal size (a tile is about 20 units across at 1; the field takes 0.5, so
 * eight or so tiles span a shield): the first colour is the ground, the second the spots, bells or crutch-heads.
 */
export function furPattern(fur: FurPaint, scale: number): PatternSpec {
  const [ground, ink] = furColours(fur);
  const { width, height, marks } = tileOf(fur.fur);
  const colour = (t: Tincture): SolidColour => ({ k: 'tincture', t });
  return {
    id: `${fur.fur}-${TINCTURE_CODE[ground]}-${TINCTURE_CODE[ink]}-${Math.round(scale * 1000)}`,
    width,
    height,
    transform: scale === 1 ? null : `scale(${scale})`,
    ground: colour(ground),
    marks: marks.map((d) => ({ d, colour: colour(ink), transform: null })),
  };
}

/** A line of a treatment, 2 thick, as a filled shape: a horizontal run from (x,y), or a vertical one. */
const across = (x: number, y: number, length: number): string => `M${x} ${y}h${length}v2h-${length}z`;
const down = (x: number, y: number, length: number): string => `M${x} ${y}h2v${length}h-2z`;

/** A mark of a treatment's tile: drawn in the ink, or in the ground to hide what lies beneath it. */
interface TreatmentMark { d: string; ink: boolean }

const inInk = (d: string): TreatmentMark => ({ d, ink: true });

/** A scale hanging from (x,y): a half disc of ground, so it covers the scales beneath it, with a voided ring 2 thick, 20 wide, round it, and in a papellony a smaller ring within. */
function scale(x: number, y: number, inner: boolean): TreatmentMark[] {
  const disc = { d: `M${x} ${y}a10 10 0 0 0 20 0z`, ink: false };
  const ring = inInk(`M${x} ${y}a10 10 0 0 0 20 0h-2a8 8 0 0 1-16 0z`);
  return inner ? [disc, ring, inInk(`M${x + 5} ${y}a5 5 0 0 0 10 0h-2a3 3 0 0 1-6 0z`)] : [disc, ring];
}

/** Rows of scales 5 apart, each row half a scale along from the last; the row above overlaps the one below, so it is drawn last (the tile's wrapped-round halves first). */
const scaleRows = (inner: boolean): TreatmentMark[] =>
  [[10, 5], [-10, 5], [10, -5], [-10, -5], [0, 0]].flatMap(([x, y]) => scale(x, y, inner));

/** The treatments' tiles: a wall of bricks 20 × 6 (each row set half a brick along from the last), and rows of voided scales without and with the second ring. */
const TREATMENT_TILES: Record<DrawnTreatment, { width: number; height: number; marks: readonly TreatmentMark[] }> = {
  masoned: { width: 20, height: 12, marks: [across(0, 0, 20), across(0, 6, 20), down(0, 0, 6), down(10, 6, 6)].map(inInk) },
  scaly: { width: 20, height: 10, marks: scaleRows(false) },
  papellony: { width: 20, height: 10, marks: scaleRows(true) },
};

/** The pattern of a treated tincture drawn `scale` times its nominal size (a tile is 20 across at 1): the tincture is the ground, the ink the lines. */
export function treatmentPattern(p: TreatedPaint, scale: number): PatternSpec {
  const tile = isDrawnTreatment(p.treatment) ? TREATMENT_TILES[p.treatment] : notSupported({ category: 'field-treatment', detail: p.treatment });
  const colour = (t: Tincture): SolidColour => ({ k: 'tincture', t });
  return {
    id: `${p.treatment}-${TINCTURE_CODE[p.ground.t]}-${TINCTURE_CODE[p.ink]}-${Math.round(scale * 1000)}`,
    width: tile.width,
    height: tile.height,
    transform: scale === 1 ? null : `scale(${scale})`,
    ground: colour(p.ground.t),
    marks: tile.marks.map((m) => ({ d: m.d, colour: colour(m.ink ? p.ink : p.ground.t), transform: null })),
  };
}

/** A semy's tile is a square of this many units, with one charge in its middle. */
const SEMY_TILE = 28;
/** How much of the tile's side a strewn charge's drawing (100 units across) spans. */
const SEMY_CHARGE_SHARE = 0.6;

/**
 * The pattern of a semy drawn `scale` times its nominal size: the ground with the charge strewn on it. The tiling is turned 45°
 * about the origin (the shield's top left corner), so the charges stand in rows half a place apart, and each charge is turned back
 * upright about the middle of its tile. The charge's drawing is in the pattern once, however many are strewn.
 */
export function semyPattern(p: SemyPaint, scale: number): PatternSpec {
  const middle = SEMY_TILE / 2;
  const colour = (t: Tincture): SolidColour => ({ k: 'tincture', t });
  return {
    id: `semy-${p.charge.charge}-${TINCTURE_CODE[p.ground.t]}-${TINCTURE_CODE[p.ink.t]}-${Math.round(scale * 1000)}`,
    width: SEMY_TILE,
    height: SEMY_TILE,
    transform: `rotate(45) scale(${scale})`,
    ground: colour(p.ground.t),
    marks: [{
      d: chargePath(p.charge.charge, null, []),
      colour: colour(p.ink.t),
      transform: `rotate(-45 ${middle} ${middle}) translate(${middle} ${middle}) scale(${SEMY_CHARGE_SHARE * SEMY_TILE / 100}) translate(-50 -50)`,
    }],
  };
}
