import { useEffect, useRef, useState } from 'preact/hooks';
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
export function MapSurface({ pins, editable, editingPinId, highlightPinId, onAddPin, onMovePin, onSelectPin, registerApi }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  // Set true on `end` of a gesture that actually panned, so the trailing `click` doesn't drop a pin.
  const suppressClickRef = useRef(false);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  // A transient "you are here" pulse dropped by a Royal-Encampments jump; cleared on a timer.
  const [blockPulse, setBlockPulse] = useState<{ x: number; y: number; nonce: number } | null>(null);
  const pulseNonceRef = useRef(0);

  useEffect(() => {
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

    function applyExtents(): void {
      const el = surfaceRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      // Keep [0,0]–[w,h] (the map at k=1) always covering the viewport: no panning the map off-screen.
      zoomBehavior.extent([[0, 0], [w, h]]).translateExtent([[0, 0], [w, h]]);
    }
    applyExtents();
    const ro = new ResizeObserver(applyExtents);
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
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    // Centre the point: screen_centre = t + k·(point·size) ⇒ t = centre − k·point·size.
    let tx = w / 2 - k * x * w;
    let ty = h / 2 - k * y * h;
    // Clamp so [0,0]–[w,h] keeps covering the viewport (t ∈ [size·(1−k), 0]).
    tx = Math.min(0, Math.max(w * (1 - k), tx));
    ty = Math.min(0, Math.max(h * (1 - k), ty));
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
    return { x: clamp01(wx / r.width), y: clamp01(wy / r.height) };
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

  function resetZoom(): void {
    const node = surfaceRef.current;
    const zb = zoomRef.current;
    if (!node || !zb) return;
    zb.transform(select(node), zoomIdentity);
  }

  const wrapperStyle = {
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
