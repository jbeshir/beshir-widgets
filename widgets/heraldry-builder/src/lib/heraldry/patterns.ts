// Procedural SVG patterns: a repeating tile of a ground colour and a few marks, small data rather than art.
// Pure data, no DOM; Shield.tsx turns a spec into a <pattern>. The drawings are original placeholders.

import { FUR_SPEC, TINCTURE_CODE, type Tincture } from './tinctures';
import { furColours, type FurPaint } from './fur';

/** A flat colour of the palette. */
export type SolidColour = { k: 'tincture'; t: Tincture };

/** One repeating tile: a `width` × `height` ground with marks drawn on it, optionally scaled or turned as a whole. */
export interface PatternSpec {
  /** Names the tile: equal ids are equal tiles, so a shield defines each once. */
  id: string;
  width: number;
  height: number;
  /** The tile's `patternTransform` (scaling it to the element it paints), or null. */
  transform: string | null;
  ground: SolidColour;
  marks: ReadonlyArray<{ d: string; colour: SolidColour }>;
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
    marks: marks.map((d) => ({ d, colour: colour(ink) })),
  };
}
