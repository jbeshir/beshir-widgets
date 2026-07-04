import { useRef, useState } from 'preact/hooks';
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

// A touch drag only arms after this long a hold, so a finger brushing a pin (scrolling, reaching for
// something else) never nudges it — a quick tap or an early drift always falls through as a no-op.
// Matches iOS's UILongPressGestureRecognizer default (minimumPressDuration / allowableMovement).
const TOUCH_HOLD_MS = 500;
const TOUCH_HOLD_TOLERANCE_PX = 10;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// A single pin over the map surface, positioned by the pin's normalized [0,1] coordinates. Drag is
// implemented with pointer capture on this element: once captured, subsequent pointermove/pointerup
// events (and the click they produce) keep targeting this button rather than whatever is visually
// underneath, so a drag never bubbles up as an "add pin" click on the surface. Arrow keys nudge the
// pin by a fixed step for keyboard-only placement; Enter/Space already open the editor via the
// button's native click activation.
//
// Mouse/pen drag arms immediately on pointerdown, as before — a precise pointer has no accidental-touch
// risk. Touch instead goes through a hold-and-drag: pointerdown starts a timer rather than arming the
// drag, so an accidental brush or a normal tap (release before the timer fires) never moves the pin;
// only a held-still finger past `TOUCH_HOLD_MS` arms it, at which point it drags freely like a mouse.
export function PinMarker({ pin, editable, editing, highlighted, showLabel, onSelect, onDragMove, onKeyMove }: Props) {
  const color = PALETTE.find((c) => c.key === pin.color) ?? PALETTE[0];
  const trimmedLabel = pin.label.trim();
  const label = trimmedLabel || 'unlabelled pin';

  const holdTimerRef = useRef<number | null>(null);
  const holdOriginRef = useRef<{ x: number; y: number } | null>(null);
  const armedRef = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'pending' | 'dragging'>('idle');

  function clearHold() {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdOriginRef.current = null;
    armedRef.current = false;
    setPhase('idle');
  }

  function handlePointerDown(e: PointerEvent) {
    e.stopPropagation();
    if (!editable) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') {
      holdOriginRef.current = { x: e.clientX, y: e.clientY };
      armedRef.current = false;
      setPhase('pending');
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        armedRef.current = true;
        setPhase('dragging');
        navigator.vibrate?.(10);
      }, TOUCH_HOLD_MS);
    } else {
      // Mouse/pen: precise pointer, no accidental-touch risk — drag arms immediately as before, with no
      // pending/dragging visual (that affordance exists only to make the touch hold legible).
      armedRef.current = true;
    }
  }

  // The pan/zoom surface (this pin's ancestor) binds d3-zoom on mousedown/touchstart. Stop those here
  // so grabbing a pin drags the pin, never pans the map underneath it. (pointerdown is stopped above;
  // mouse/touch events are a separate stream and must be stopped too.)
  function stopGestureStart(e: Event) {
    e.stopPropagation();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!editable || e.buttons === 0) return;
    if (!armedRef.current) {
      // Still within the hold window (or already abandoned it) — a drift past tolerance means this was
      // a brush or a pan attempt, not a hold, so give up on arming rather than letting it jump on arrival.
      const origin = holdOriginRef.current;
      if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > TOUCH_HOLD_TOLERANCE_PX) {
        clearHold();
      }
      return;
    }
    onDragMove(pin.id, e.clientX, e.clientY);
  }

  function handlePointerUp() {
    clearHold();
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
      class={`pin-marker${editing ? ' editing' : ''}${highlighted ? ' highlighted' : ''}${phase !== 'idle' ? ` pin-${phase}` : ''}`}
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
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
