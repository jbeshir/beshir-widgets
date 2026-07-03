import { useEffect, useRef, useState } from 'preact/hooks';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { Pin } from '../store';
import { PinMarker } from './PinMarker';
import mapUrl from '../assets/pennsic-53-official-map.png';

interface Props {
  pins: Pin[];
  editable: boolean;
  editingPinId: string | null;
  highlightPinId: string | null;
  onAddPin: (x: number, y: number) => void;
  onMovePin: (id: string, x: number, y: number) => void;
  onSelectPin: (id: string) => void;
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
export function MapSurface({ pins, editable, editingPinId, highlightPinId, onAddPin, onMovePin, onSelectPin }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  // Set true on `end` of a gesture that actually panned, so the trailing `click` doesn't drop a pin.
  const suppressClickRef = useRef(false);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);

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
      <p class="map-caption">
        <span class="map-caption-hint">Scroll, pinch, or drag to explore — zoom in to read camp block labels.</span>
        <span class="map-caption-credit">
          Official Pennsic LIII land map · Map by Aakin, updated by Genoveva, Marit &amp; Tananda.
        </span>
      </p>
    </div>
  );
}
