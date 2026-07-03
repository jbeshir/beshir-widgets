import { useRef } from 'preact/hooks';
import type { Pin } from '../store';
import { PinMarker } from './PinMarker';
import lightMapUrl from '../assets/basemap-light.svg';
import darkMapUrl from '../assets/basemap-dark.svg';

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

const MAP_ALT = 'Schematic map of the Pennsic War campsite';
const MAP_KEYBOARD_LABEL = 'Camp map — press Enter to drop a pin at the centre';

// The base-map layer + pin overlay. Both theme variants are rendered and CSS picks the visible one
// via prefers-color-scheme, so pins line up identically regardless of which is shown. A click on the
// surface (not on a pin) drops a new pin at the normalized position; dragging an existing pin is
// handled by PinMarker via pointer capture, so it never reaches this element's click handler. When
// editable, the surface itself is focusable so a keyboard user can drop a pin at the centre with
// Enter/Space — kept a plain div with role="group" (not role="button") since it also contains the
// pin <button>s themselves.
export function MapSurface({ pins, editable, editingPinId, highlightPinId, onAddPin, onMovePin, onSelectPin }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function normalize(clientX: number, clientY: number): { x: number; y: number } {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }

  function handleClick(e: MouseEvent) {
    if (!editable) return;
    const { x, y } = normalize(e.clientX, e.clientY);
    onAddPin(x, y);
  }

  function handleDragMove(id: string, clientX: number, clientY: number) {
    const { x, y } = normalize(clientX, clientY);
    onMovePin(id, x, y);
  }

  // Only the surface's own key events, not ones bubbling up from a focused pin marker inside it.
  function handleKeyDown(e: KeyboardEvent) {
    if (!editable || e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onAddPin(0.5, 0.5);
  }

  return (
    <div
      class="map-surface"
      data-testid="map-surface"
      ref={ref}
      onClick={handleClick}
      tabIndex={editable ? 0 : undefined}
      role={editable ? 'group' : undefined}
      aria-label={editable ? MAP_KEYBOARD_LABEL : undefined}
      onKeyDown={editable ? handleKeyDown : undefined}
    >
      <img class="map-surface-img map-surface-img-light" src={lightMapUrl} alt={MAP_ALT} draggable={false} />
      <img class="map-surface-img map-surface-img-dark" src={darkMapUrl} alt={MAP_ALT} draggable={false} />
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
  );
}
