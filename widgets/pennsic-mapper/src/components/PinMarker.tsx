import { PALETTE } from '../lib/palette';
import type { Pin } from '../store';

interface Props {
  pin: Pin;
  editable: boolean;
  editing: boolean;
  highlighted: boolean;
  /** Show the pin's text label on the map (the "Show pin labels" layer toggle; on by default). */
  showLabel: boolean;
  onSelect: (id: string) => void;
  onDragMove: (id: string, clientX: number, clientY: number) => void;
  onKeyMove: (id: string, x: number, y: number) => void;
}

const NUDGE_STEP = 0.02;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// A single pin over the map surface, positioned by the pin's normalized [0,1] coordinates. Drag is
// implemented with pointer capture on this element: once captured, subsequent pointermove/pointerup
// events (and the click they produce) keep targeting this button rather than whatever is visually
// underneath, so a drag never bubbles up as an "add pin" click on the surface. Arrow keys nudge the
// pin by a fixed step for keyboard-only placement; Enter/Space already open the editor via the
// button's native click activation.
export function PinMarker({ pin, editable, editing, highlighted, showLabel, onSelect, onDragMove, onKeyMove }: Props) {
  const color = PALETTE.find((c) => c.key === pin.color) ?? PALETTE[0];
  const trimmedLabel = pin.label.trim();
  const label = trimmedLabel || 'unlabelled pin';

  function handlePointerDown(e: PointerEvent) {
    e.stopPropagation();
    if (!editable) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  // The pan/zoom surface (this pin's ancestor) binds d3-zoom on mousedown/touchstart. Stop those here
  // so grabbing a pin drags the pin, never pans the map underneath it. (pointerdown is stopped above;
  // mouse/touch events are a separate stream and must be stopped too.)
  function stopGestureStart(e: Event) {
    e.stopPropagation();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!editable || e.buttons === 0) return;
    onDragMove(pin.id, e.clientX, e.clientY);
  }

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    onSelect(pin.id);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!editable) return;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -NUDGE_STEP;
    else if (e.key === 'ArrowRight') dx = NUDGE_STEP;
    else if (e.key === 'ArrowUp') dy = -NUDGE_STEP;
    else if (e.key === 'ArrowDown') dy = NUDGE_STEP;
    else return;
    e.preventDefault();
    e.stopPropagation();
    onKeyMove(pin.id, clamp01(pin.x + dx), clamp01(pin.y + dy));
  }

  return (
    <button
      type="button"
      class={`pin-marker${editing ? ' editing' : ''}${highlighted ? ' highlighted' : ''}`}
      data-testid="pin-marker"
      data-pin-id={pin.id}
      style={{
        left: `${pin.x * 100}%`,
        top: `${pin.y * 100}%`,
        '--pin-color-light': color.light,
        '--pin-color-dark': color.dark,
      }}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onMouseDown={stopGestureStart}
      onTouchStart={stopGestureStart}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span class="pin-marker-dot" aria-hidden="true" />
      {/* Always-on map label (Layers → "Show pin labels"). Only rendered for pins that actually carry a
          label — an empty pill would be map noise. aria-hidden: the button's aria-label already voices the
          name, so the visible pill is a pure visual duplicate. pointer-events:none (see CSS) so the pill
          never expands the hit target or swallows a nearby map click; the dot stays the sole target. The
          pill counter-scales with the marker, so it keeps a constant, legible on-screen size at any zoom. */}
      {showLabel && trimmedLabel && (
        <span class="pin-marker-label" data-testid="pin-label" aria-hidden="true">
          {trimmedLabel}
        </span>
      )}
    </button>
  );
}
