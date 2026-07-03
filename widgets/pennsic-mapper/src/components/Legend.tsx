import { PALETTE } from '../lib/palette';
import type { Pin } from '../store';

interface Props {
  pins: Pin[];
  highlightPinId: string | null;
  onSelect: (id: string) => void;
}

// Read-mostly list of every pin on the map — the primary accessibility aid alongside on-map labels,
// since it renders the same colour + text pairing without relying on hover/position to disambiguate.
export function Legend({ pins, highlightPinId, onSelect }: Props) {
  if (pins.length === 0) {
    return (
      <div class="legend legend-empty" data-testid="legend">
        <p class="legend-hint">Click the map to drop your first pin.</p>
      </div>
    );
  }

  return (
    <ul class="legend" data-testid="legend">
      {pins.map((pin) => {
        const color = PALETTE.find((c) => c.key === pin.color) ?? PALETTE[0];
        return (
          <li key={pin.id}>
            <button
              type="button"
              class={`legend-row${pin.id === highlightPinId ? ' highlighted' : ''}`}
              onClick={() => onSelect(pin.id)}
            >
              <span
                class="legend-swatch"
                aria-hidden="true"
                style={{ '--swatch-color-light': color.light, '--swatch-color-dark': color.dark }}
              />
              <span class="legend-label">{pin.label.trim() || 'Unlabelled'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
