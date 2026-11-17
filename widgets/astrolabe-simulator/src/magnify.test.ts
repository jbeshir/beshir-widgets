import { describe, expect, it } from 'vitest';
import { magnifyTransform, magnifyView, unionBox, MAX_ZOOM, MIN_ZOOM, FRAME_PADDING } from './magnify';

describe('magnify view', () => {
  it('falls back to 2x on the centre without highlights', () => {
    expect(magnifyView(null)).toEqual({ zoom: MIN_ZOOM, cx: 0.5, cy: 0.5, fits: false });
  });
  it('frames a small box with padding, capped at 4x', () => {
    const tiny = magnifyView({ x0: 0.4, y0: 0.4, x1: 0.42, y1: 0.41 });
    expect(tiny.zoom).toBe(MAX_ZOOM);
    const medium = magnifyView({ x0: 0.3, y0: 0.3, x1: 0.5, y1: 0.4 });
    expect(medium.zoom).toBeCloseTo(1 / 0.3, 6);
    expect(medium.fits).toBe(true);
  });
  it('never goes below 2x and reports a large box as not fitting', () => {
    const large = magnifyView({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(large.zoom).toBe(MIN_ZOOM);
    expect(large.fits).toBe(false);
  });
  it('keeps the view inside the instrument', () => {
    const corner = magnifyView({ x0: 0, y0: 0, x1: 0.05, y1: 0.05 });
    expect(corner.cx).toBeCloseTo(0.5 / corner.zoom, 6);
    expect(corner.cy).toBeCloseTo(0.5 / corner.zoom, 6);
    expect(magnifyTransform(corner)).toMatch(/^translate\(0\.000%, 0\.000%\) scale\(4\.0000\)$/);
  });
  it('maps the centre of the view to the middle of the frame', () => {
    const view = magnifyView({ x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 });
    const [tx] = /translate\((-?[\d.]+)%/.exec(magnifyTransform(view))!.slice(1).map(Number);
    expect(view.zoom * view.cx + tx / 100).toBeCloseTo(0.5, 3);
  });
  it('gives a step frame less room, so a half-width part still fits at 2x', () => {
    const half = { x0: 0.26, y0: 0.4, x1: 0.73, y1: 0.54 };
    expect(magnifyView(half).fits).toBe(false);
    expect(magnifyView(half, FRAME_PADDING).fits).toBe(true);
  });
});

describe('magnify view with a reserved strip (the Magnify button)', () => {
  it('keeps the box out of the top strip', () => {
    const reserve = 0.15;
    const box = { x0: 0.3, y0: 0.4, x1: 0.5, y1: 0.5 };
    const view = magnifyView(box, FRAME_PADDING, reserve);
    const top = view.cy - 0.5 / view.zoom;
    expect((box.y0 - top) * view.zoom).toBeGreaterThanOrEqual(reserve - 1e-9);
  });
  it('lets the view run past the top of the instrument for a box at the top edge', () => {
    const reserve = 0.15;
    const view = magnifyView({ x0: 0.4, y0: 0.02, x1: 0.5, y1: 0.08 }, FRAME_PADDING, reserve);
    expect((0.02 - (view.cy - 0.5 / view.zoom)) * view.zoom).toBeGreaterThanOrEqual(reserve - 1e-9);
  });
  it('asks for more room: a box that fits at 2x without the strip may not fit with it', () => {
    const box = { x0: 0.2, y0: 0.2, x1: 0.68, y1: 0.68 };
    expect(magnifyView(box, FRAME_PADDING).fits).toBe(true);
    expect(magnifyView(box, FRAME_PADDING, 0.15).fits).toBe(false);
  });
  it('unions boxes', () => {
    expect(unionBox({ x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.4 }, { x0: 0.2, y0: 0.1, x1: 0.5, y1: 0.3 })).toEqual({ x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.4 });
    expect(unionBox(null, { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });
});
