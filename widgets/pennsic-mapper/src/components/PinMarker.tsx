import { PALETTE } from '../lib/palette';
import type { Pin } from '../store';

interface Props {
  pin: Pin;
  editable: boolean;
  editing: boolean;
  highlighted: boolean;
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
export function PinMarker({ pin, editable, editing, highlighted, onSelect, onDragMove, onKeyMove }: Props) {
  const color = PALETTE.find((c) => c.key === pin.color) ?? PALETTE[0];
  const label = pin.label.trim() || 'unlabelled pin';

  function handlePointerDown(e: PointerEvent) {
    e.stopPropagation();
    if (!editable) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
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
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span class="pin-marker-dot" aria-hidden="true" />
    </button>
  );
}
