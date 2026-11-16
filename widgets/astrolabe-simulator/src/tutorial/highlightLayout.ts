/**
 * Pure decisions behind the step-highlight halos (tutorial/highlights.ts),
 * kept free of the DOM so they can be unit-tested.
 *
 * A highlight never repaints the engraving it emphasises. It adds a two-tone
 * halo (a pale core next to the mark, a dark highlight-blue rim outside it)
 * beneath a copy of the mark in its own colours, and, for a single tick,
 * numeral or star, a ring that locates it. The halo copies live in layers the
 * instrument renders for them:
 *
 *   'under'  first child of a rotating part: halos of the part's own metal,
 *            painted beneath the metal so only the outer half shows; in a
 *            static face, beneath its engraving: the band round a whole
 *            scale, so every tick and numeral is painted on top of it;
 *   'over'   last child of a rotating part, or the end of a static base
 *            layer: halos of whole scales and parts, under any moving part;
 *   'top'    the end of the moving layer, in the frame of the part: halos and
 *            locators of single point-like marks (a tick, a numeral), above
 *            the rule or alidade, so the mark a stop cue names is found even
 *            when metal lies on it. A star blade and a plate line stay where
 *            they physically are (under the rule, under the rete); only a
 *            star's locator ring is lifted.
 *
 * A whole scale (many ticks and numerals) is emphasised by one band round it
 * (`data-hl-outline="band"`), never a halo per mark, so its ticks stay countable.
 */
export type HaloKind = 'text' | 'stroke' | 'body' | 'outline';
export type HaloLayer = 'under' | 'over' | 'top';
export type HaloFrame = 'base' | 'rete' | 'rule' | 'alidade';

export interface HaloSource {
  tag: string;
  /** Computed `fill` (a `url(...)` paint marks a solid metal or brass body). */
  fill: string;
  /** Invisible highlight-only outline (`data-hl-outline`). */
  outline: boolean;
}

export function haloKind({ tag, fill, outline }: HaloSource): HaloKind {
  if (outline) return 'outline';
  if (tag === 'text') return 'text';
  if (tag === 'use' || /url\(/.test(fill)) return 'body';
  return 'stroke';
}

/** Whether the halo is followed by a copy of the mark itself in its own colours. */
export function redrawsMark(kind: HaloKind): boolean {
  return kind === 'text' || kind === 'stroke';
}

/**
 * `pointLike`: a single tick, numeral or star tip (one that gets a locator ring).
 * `band`: the outline round a whole scale.
 */
export function haloLayer(kind: HaloKind, frame: HaloFrame, pointLike: boolean, band = false): HaloLayer {
  if (band) return frame === 'base' ? 'under' : 'over';
  if (kind === 'body' && frame !== 'base') return 'under';
  if (pointLike && (kind === 'text' || kind === 'stroke')) return 'top';
  return 'over';
}

/** Rotating parts carry their own over layer above everything else in them except the pin, so their 'top' is 'over'. */
export function layerFor(layer: HaloLayer, frame: HaloFrame): HaloLayer {
  return layer === 'top' && (frame === 'rule' || frame === 'alidade') ? 'over' : layer;
}

/** Composes ancestor `transform` attributes (outermost first) into one attribute value. */
export function chainTransforms(outerToInner: readonly (string | null | undefined)[]): string {
  return outerToInner.map((value) => value?.trim()).filter((value): value is string => Boolean(value)).join(' ');
}

/** Point-like owners get a locator ring: a tick (line), a numeral (text) or a star tip (anchor). */
export function wantsLocator(ownerTags: readonly { tag: string; anchored: boolean }[]): boolean {
  return ownerTags.length > 0 && ownerTags.length <= 2 && ownerTags.every(({ tag, anchored }) => anchored || tag === 'line' || tag === 'text');
}

/**
 * Dash offset (path length 360) that opens a locator ring's 100° gap towards `gapDeg`
 * (the direction, in the ring's own space, of the engraved name next to a star tip).
 * The dash runs 0..260 of the pattern, so the gap's centre is at 310.
 */
export const LOCATOR_GAP = 100;
export function locatorGapOffset(gapDeg: number): number {
  return (((310 - gapDeg) % 360) + 360) % 360;
}

/** WCAG relative luminance and contrast, for the colour claims in theme.css. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (index: number) => {
    const c = parseInt(value.slice(index, index + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
