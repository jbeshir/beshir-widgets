/** A box in instrument fractions: 0..1 across and down the instrument. */
export interface FractionBox { x0: number; y0: number; x1: number; y1: number }
export interface MagnifyView { zoom: number; cx: number; cy: number; fits: boolean }

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 4;
/** Breathing room around the highlighted parts, as a fraction of the instrument. */
const PADDING = 0.05;
/** A step's own `frame` is the region its author chose, so it gets only a sliver of room (a half-width part still fits at 2x). */
export const FRAME_PADDING = 0.01;

/**
 * The zoom and centre that frame `box`. Zoom is at least 2x; `fits` says the
 * padded box really fits at that zoom (a large part, like the rete, does not,
 * and is then only centred). Without a box the centre of the instrument is used.
 * `reserveTop` (a fraction of the instrument) is a strip across the top of the view that the box keeps out of: the Magnify button lies there.
 */
export function magnifyView(box: FractionBox | null, padding = PADDING, reserveTop = 0): MagnifyView {
  if (!box) return { zoom: MIN_ZOOM, cx: 0.5, cy: 0.5, fits: false };
  const wanted = Math.min(1 / (box.x1 - box.x0 + 2 * padding), (1 - reserveTop) / (box.y1 - box.y0 + 2 * padding));
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, wanted));
  const half = 0.5 / zoom;
  const clamp = (value: number, low = half) => Math.min(1 - half, Math.max(low, value));
  return {
    zoom,
    cx: clamp((box.x0 + box.x1) / 2),
    // The box sits in the lower part of the view; the top strip is left to the Magnify button. The view may run past the top edge of the instrument for it.
    cy: clamp((box.y0 + box.y1) / 2 - reserveTop / (2 * zoom), half - reserveTop / zoom),
    fits: wanted >= MIN_ZOOM,
  };
}

/** The smallest box holding both (either may be null). */
export function unionBox(a: FractionBox | null, b: FractionBox | null): FractionBox | null {
  if (!a || !b) return a ?? b;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** CSS transform (origin at the top-left) that puts the view's centre in the middle of the frame. */
export function magnifyTransform(view: MagnifyView): string {
  const tx = (0.5 - view.zoom * view.cx) * 100;
  const ty = (0.5 - view.zoom * view.cy) * 100;
  return `translate(${tx.toFixed(3)}%, ${ty.toFixed(3)}%) scale(${view.zoom.toFixed(4)})`;
}
