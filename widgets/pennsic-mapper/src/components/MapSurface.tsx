import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { Pin } from '../store';
import { PinMarker } from './PinMarker';
import mapUrl from '../assets/pennsic-53-official-map.png';

// Imperative handle the surface hands back to App via `registerApi`, so a sibling panel (Royal
// Encampments) can drive the map. Calling `focusOn` synchronously inside a click handler mirrors the
// zoom buttons exactly (direct d3-zoom manipulation, one render) — no state→effect round-trip that
// would race a test harness reading the resulting transform.
export interface MapSurfaceApi {
  /** Pan/zoom so the normalized [0,1] point sits at the viewport centre at `scale`, then pulse it. */
  focusOn: (x: number, y: number, scale: number) => void;
}

interface Props {
  pins: Pin[];
  editable: boolean;
  editingPinId: string | null;
  highlightPinId: string | null;
  /** Whether to render the always-on text label beside each pin (Layers → "Show pin labels"). */
  showLabels: boolean;
  onAddPin: (x: number, y: number) => void;
  onMovePin: (id: string, x: number, y: number) => void;
  onSelectPin: (id: string) => void;
  /** Called on mount with the imperative API (and with null on unmount) so App can drive the map. */
  registerApi?: (api: MapSurfaceApi | null) => void;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.6;

// The official map PNG's natural pixel dimensions (portrait). These set ONLY the fitted zoom level and
// centring below — NOT the size of the clip viewport, which fills the full available (full-bleed) space.
const IMG_W = 1648;
const IMG_H = 2551;

// The map is shown "contain"-fitted — the whole image visible, letter/pillar-boxed inside the full-bleed
// viewport — but implemented via the d3-zoom transform, not CSS `object-fit`. Given the viewport size,
// this returns the fitted image box (fW×fH: the zoom wrapper's un-transformed footprint, which is also
// the pin coordinate box) and the translate that centres it. The fit scale is baked into fW/fH, so the
// fitted "whole map" view is exactly d3 scale k=1 (= MIN_SCALE): pins counter-scale by 1/k = 1 there,
// unchanged from before, and zooming past k=1 reveals crisp map across the ENTIRE viewport — no longer
// clipped to a portrait box on a wide window.
function fitBox(cW: number, cH: number): { fW: number; fH: number; tx: number; ty: number } {
  const s = Math.min(cW / IMG_W, cH / IMG_H);
  const fW = IMG_W * s;
  const fH = IMG_H * s;
  return { fW, fH, tx: (cW - fW) / 2, ty: (cH - fH) / 2 };
}

// Clamp a translate on one axis so the scaled content never opens a gap inside the viewport: centre it
// when it is smaller than the viewport (the pillar/letterbox at the fitted view and low zoom), else
// clamp to the edges. Mirrors d3-zoom's own constrain against the extents set in `applyFit`, so an
// imperative jump (`focusOn`) lands exactly where a pan gesture would settle.
function clampAxis(t: number, content: number, viewport: number): number {
  if (content <= viewport) return (viewport - content) / 2;
  return Math.min(0, Math.max(viewport - content, t));
}

const MAP_ALT = 'Official Pennsic LIII (2026) land map showing camp blocks, roads, and a legend';
const MAP_KEYBOARD_LABEL =
  'Camp map — press Enter or Space to drop a pin at the centre of the view; use the zoom-in and zoom-out buttons that follow to read camp block labels';

// The base-map layer + pin overlay, wrapped in a pan/zoom surface. The real official map is dense, so
// it is pan/zoomable via d3-zoom (wheel, drag, pinch) plus explicit zoom buttons for keyboard/touch.
//
// *** Pin math under pan/zoom ***
// A single `.map-zoom-wrapper` div holds BOTH the <img> and the pin overlay and carries the current
// pan/zoom as a CSS `transform: translate(x,y) scale(k)` (origin 0,0). Because pins live inside that
// same transformed wrapper — positioned by their normalized [0,1] coordinates as left/top percentages
// — they are glued to the map at every zoom level and can never drift out of sync with it.
// Translating a screen click into a normalized image coordinate inverts that transform (see
// `normalize`); rendering is the forward transform, applied by the browser to the wrapper. Pin markers
// counter-scale by 1/k in CSS so they stay a constant on-screen size (they don't balloon when zoomed).
//
// A drag on the surface pans the map; a plain click (no drag) drops a pin. d3-zoom's `start`/`zoom`/
// `end` events tell us whether a gesture actually moved, so a pan never ends by dropping a stray pin.
export function MapSurface({ pins, editable, editingPinId, highlightPinId, showLabels, onAddPin, onMovePin, onSelectPin, registerApi }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  // Set true on `end` of a gesture that actually panned, so the trailing `click` doesn't drop a pin.
  const suppressClickRef = useRef(false);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  // The zoom wrapper's un-transformed footprint = the fitted image box (see `fitBox`). Sized in px from
  // the viewport on mount/resize so the wrapper always keeps the image's aspect ratio (the pin
  // coordinate box) even though the clip viewport around it is full-bleed and a different aspect.
  const [fit, setFit] = useState<{ fW: number; fH: number }>({ fW: 0, fH: 0 });
  // A transient "you are here" pulse dropped by a Royal-Encampments jump; cleared on a timer.
  const [blockPulse, setBlockPulse] = useState<{ x: number; y: number; nonce: number } | null>(null);
  const pulseNonceRef = useRef(0);

  // useLayoutEffect (not useEffect) so the fitted transform + wrapper size are set before the first
  // paint — the wrapper starts at 0×0 for one un-painted commit, then this fills it in synchronously.
  useLayoutEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const sel = select(node);
    let panMoved = false;

    const zoomBehavior = d3Zoom<HTMLDivElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .on('start', () => {
        panMoved = false;
        suppressClickRef.current = false;
      })
      .on('zoom', (event: { transform: ZoomTransform; sourceEvent?: Event }) => {
        transformRef.current = event.transform;
        setTransform(event.transform);
        const src = event.sourceEvent?.type;
        if (src === 'mousemove' || src === 'touchmove' || src === 'pointermove') panMoved = true;
      })
      .on('end', () => {
        if (panMoved) suppressClickRef.current = true;
      });

    // Double-click should not zoom — on an editable map it would otherwise drop two pins AND zoom.
    sel.call(zoomBehavior).on('dblclick.zoom', null);
    zoomRef.current = zoomBehavior;

    // Fit the whole map into the full-bleed viewport and centre it. The clip viewport (.map-surface)
    // fills the full available space; the image's aspect ratio only sets this fitted scale (baked into
    // fW/fH, so the fitted view is d3 k=1 = the reset target) and the centring translate. The zoom
    // `extent` is the viewport and `translateExtent` is the fitted image box, so d3 centres the map when
    // it is smaller than the viewport (pillar/letterbox at the fit) and clamps to the edges once zoomed
    // in — letting a wide window pan across the map's full width, with the ambient backdrop only ever
    // showing in the true letterbox/pillarbox gaps.
    //
    // On the FIRST layout this sets the fitted view; on a later resize it preserves the user's zoom
    // multiple and re-centres whatever map point was at the viewport centre (rather than snapping back to
    // fit) — `prev` holds the geometry the live transform was computed against so we can read that point.
    let prev: { cW: number; cH: number; fW: number; fH: number } | null = null;
    function applyFit(): void {
      const el = surfaceRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cW = Math.max(1, r.width);
      const cH = Math.max(1, r.height);
      const { fW, fH, tx, ty } = fitBox(cW, cH);
      zoomBehavior.extent([[0, 0], [cW, cH]]).translateExtent([[0, 0], [fW, fH]]);
      setFit({ fW, fH });
      if (!prev) {
        zoomBehavior.transform(sel, zoomIdentity.translate(tx, ty).scale(MIN_SCALE));
      } else {
        const t = transformRef.current;
        const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.k));
        // Normalized map point at the viewport centre under the PREVIOUS geometry…
        const nx = clamp01((prev.cW / 2 - t.x) / t.k / prev.fW);
        const ny = clamp01((prev.cH / 2 - t.y) / t.k / prev.fH);
        // …re-centred at the same zoom multiple under the new geometry (clamped like a pan gesture).
        const ntx = clampAxis(cW / 2 - k * nx * fW, k * fW, cW);
        const nty = clampAxis(cH / 2 - k * ny * fH, k * fH, cH);
        zoomBehavior.transform(sel, zoomIdentity.translate(ntx, nty).scale(k));
      }
      prev = { cW, cH, fW, fH };
    }
    applyFit();
    const ro = new ResizeObserver(applyFit);
    ro.observe(node);

    return () => {
      ro.disconnect();
      sel.on('.zoom', null);
      zoomRef.current = null;
    };
  }, []);

  // A Royal-Encampments jump: pan/zoom so the normalized point sits at the viewport centre at the
  // requested scale, then drop a transient pulse there. Applied instantly (no d3 transition) so it
  // never depends on a running clock — matching the zoom buttons, and safe under the journey harness's
  // frozen Date. The transform is clamped to the same translateExtent the pan gestures use, so the
  // jump can never push the map off-screen. Closes over refs + stable setters only, so the once-
  // registered instance below stays correct for the component's lifetime.
  function focusOn(x: number, y: number, scale: number): void {
    const node = surfaceRef.current;
    const zb = zoomRef.current;
    if (!node || !zb) return;
    const r = node.getBoundingClientRect();
    const cW = Math.max(1, r.width);
    const cH = Math.max(1, r.height);
    const { fW, fH } = fitBox(cW, cH);
    const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    // Centre the point: screen_centre = t + k·(point·fittedImageBox) ⇒ t = centre − k·point·fittedBox.
    let tx = cW / 2 - k * x * fW;
    let ty = cH / 2 - k * y * fH;
    // Clamp exactly as the pan gestures do (centre when the scaled map is smaller than the viewport,
    // else clamp to the edges), so a jump can never open a gap or push the map off-screen.
    tx = clampAxis(tx, k * fW, cW);
    ty = clampAxis(ty, k * fH, cH);
    zb.transform(select(node), zoomIdentity.translate(tx, ty).scale(k));
    pulseNonceRef.current += 1;
    setBlockPulse({ x, y, nonce: pulseNonceRef.current });
    // Bring the map into view if a row deep in the encampments list scrolled it off-screen (common on
    // mobile). `block: 'nearest'` is a no-op when the map is already visible; instant (not smooth) so it
    // never depends on a running clock under the journey harness.
    node.scrollIntoView({ block: 'nearest' });
  }

  // Hand the imperative API to App on mount; withdraw it on unmount. Registered once — `focusOn` only
  // reads stable refs/setters, so the first-render instance is valid for this surface's whole life.
  useEffect(() => {
    registerApi?.({ focusOn });
    return () => registerApi?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear the jump pulse ~1.9s after it lands (setTimeout, not the frozen Date, so it still fires).
  useEffect(() => {
    if (!blockPulse) return;
    const id = setTimeout(
      () => setBlockPulse((cur) => (cur && cur.nonce === blockPulse.nonce ? null : cur)),
      1900,
    );
    return () => clearTimeout(id);
  }, [blockPulse]);

  // Screen (client) coordinates → normalized [0,1] image coordinates, inverting the current pan/zoom.
  function normalize(clientX: number, clientY: number): { x: number; y: number } {
    const r = surfaceRef.current!.getBoundingClientRect();
    const t = transformRef.current;
    const px = clientX - r.left;
    const py = clientY - r.top;
    // screen = translate(t.x,t.y) + scale(t.k) · wrapperLocal  ⇒  wrapperLocal = (screen − t)/t.k
    const wx = (px - t.x) / t.k;
    const wy = (py - t.y) / t.k;
    // Normalize by the fitted image box (the wrapper's footprint), NOT the surface — the surface is now
    // full-bleed and a different aspect ratio, so dividing by it would skew the coordinate. Dividing by
    // the image-aspect fit box is what keeps a normalized [0,1] coordinate glued to the same map pixel.
    const { fW, fH } = fitBox(Math.max(1, r.width), Math.max(1, r.height));
    return { x: clamp01(wx / fW), y: clamp01(wy / fH) };
  }

  function handleClick(e: MouseEvent): void {
    if (!editable) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false; // this click is the tail of a pan — swallow it, don't add a pin
      return;
    }
    const { x, y } = normalize(e.clientX, e.clientY);
    onAddPin(x, y);
  }

  function handleDragMove(id: string, clientX: number, clientY: number): void {
    const { x, y } = normalize(clientX, clientY);
    onMovePin(id, x, y);
  }

  // Only the surface's own key events, not ones bubbling up from a focused pin marker inside it.
  function handleKeyDown(e: KeyboardEvent): void {
    if (!editable || e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    // Centre of the currently visible viewport, mapped back into image space (so it lands on-screen
    // even when zoomed/panned).
    const r = surfaceRef.current!.getBoundingClientRect();
    const { x, y } = normalize(r.left + r.width / 2, r.top + r.height / 2);
    onAddPin(x, y);
  }

  function zoomByStep(factor: number): void {
    const node = surfaceRef.current;
    const zb = zoomRef.current;
    if (!node || !zb) return;
    zb.scaleBy(select(node), factor);
  }

  // Reset returns to the fitted, centred "whole map" view — the same transform `applyFit` sets on mount,
  // recomputed for the current viewport (NOT bare zoomIdentity, which would top-left-anchor the map).
  function resetZoom(): void {
    const node = surfaceRef.current;
    const zb = zoomRef.current;
    if (!node || !zb) return;
    const r = node.getBoundingClientRect();
    const { tx, ty } = fitBox(Math.max(1, r.width), Math.max(1, r.height));
    zb.transform(select(node), zoomIdentity.translate(tx, ty).scale(MIN_SCALE));
  }

  const wrapperStyle = {
    // The wrapper's un-transformed size = the fitted image box, so it keeps the image's aspect ratio (the
    // pin coordinate box) inside the full-bleed clip viewport; the d3 transform scales/centres it.
    width: `${fit.fW}px`,
    height: `${fit.fH}px`,
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    '--zoom': String(transform.k),
  } as Record<string, string>;

  return (
    <div class="map-frame">
      {/* Decorative ambient wash of the map filling the canvas gutters (see .map-canvas-backdrop). Behind
          everything, aria-hidden, pointer-events:none — it is NOT the coordinate reference, so it cannot
          affect pin math; the crisp .map-surface below is the sole pin coordinate box. */}
      <div class="map-canvas-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${mapUrl})` }} />
      <div
        class={editable ? 'map-surface map-surface-editable' : 'map-surface'}
        data-testid="map-surface"
        ref={surfaceRef}
        onClick={handleClick}
        tabIndex={editable ? 0 : undefined}
        role={editable ? 'group' : undefined}
        aria-label={editable ? MAP_KEYBOARD_LABEL : undefined}
        onKeyDown={editable ? handleKeyDown : undefined}
      >
        <div class="map-zoom-wrapper" style={wrapperStyle}>
          <img class="map-surface-img" src={mapUrl} alt={MAP_ALT} draggable={false} />
          <div class="pin-layer">
            {blockPulse && (
              <div
                key={blockPulse.nonce}
                class="block-pulse"
                data-testid="block-pulse"
                aria-hidden="true"
                style={{ left: `${blockPulse.x * 100}%`, top: `${blockPulse.y * 100}%` }}
              />
            )}
            {pins.map((pin) => (
              <PinMarker
                key={pin.id}
                pin={pin}
                editable={editable}
                editing={pin.id === editingPinId}
                highlighted={pin.id === highlightPinId}
                showLabel={showLabels}
                onSelect={onSelectPin}
                onDragMove={handleDragMove}
                onKeyMove={onMovePin}
              />
            ))}
          </div>
        </div>
      </div>
      <div class="map-zoom-controls" role="group" aria-label="Map zoom">
        <button
          type="button"
          class="map-zoom-btn"
          data-testid="zoom-in"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => zoomByStep(ZOOM_STEP)}
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          class="map-zoom-btn"
          data-testid="zoom-out"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => zoomByStep(1 / ZOOM_STEP)}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          class="map-zoom-btn"
          data-testid="zoom-reset"
          aria-label="Reset zoom"
          title="Reset zoom"
          onClick={resetZoom}
        >
          <span aria-hidden="true">⟲</span>
        </button>
      </div>
    </div>
  );
}
