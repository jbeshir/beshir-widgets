import { useEffect, useRef, useState } from 'preact/hooks';
import type { Pin } from '../store';
import { ColorPicker } from './ColorPicker';

interface Props {
  pin: Pin;
  onChangeLabel: (id: string, label: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Compact editor for the currently-selected pin, floated bottom-centre over the map (a bottom sheet on
// mobile) — never a big stacked card. The parent keys this component by pin id, so switching pins
// remounts it and resets the local label draft rather than needing an effect to resync from props.
export function PinEditor({ pin, onChangeLabel, onChangeColor, onDelete, onClose }: Props) {
  const [label, setLabel] = useState(pin.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function confirm() {
    onChangeLabel(pin.id, label);
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    } else if (e.key === 'Escape') {
      // Dismiss without saving the in-progress label draft — the sole way to back out of the editor
      // without either committing a change (Done) or destroying the pin (Delete pin).
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div class="pin-editor">
      <h2 class="sr-only">Edit pin</h2>
      <label class="pin-editor-field">
        <span class="pin-editor-field-label">Pin label</span>
        <input
          ref={inputRef}
          type="text"
          data-testid="label-input"
          value={label}
          maxLength={80}
          onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
        />
      </label>
      <ColorPicker
        selected={pin.color}
        onSelect={(key) => onChangeColor(pin.id, key)}
        idPrefix={`pin-${pin.id}`}
        caption="Colour:"
        compact
      />
      <div class="pin-editor-actions">
        <button type="button" class="button-primary" data-testid="label-confirm" onClick={confirm}>
          Done
        </button>
        <button type="button" class="button-danger" data-testid="delete-pin" onClick={() => onDelete(pin.id)}>
          Delete pin
        </button>
      </div>
    </div>
  );
}
