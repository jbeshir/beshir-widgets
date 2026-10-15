// Procedural SVG patterns: a repeating tile of a ground colour and a few marks, small data rather than art.
// Pure data, no DOM; Shield.tsx turns a spec into a <pattern>.

import type { Tincture } from './tinctures';

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
