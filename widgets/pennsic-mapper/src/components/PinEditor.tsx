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

// Inline (not popover) editor for the currently-selected pin, rendered in normal document flow
// directly below the map surface. The parent keys this component by pin id, so switching pins
// remounts it and resets the local label draft rather than needing an effect to resync from props.
export function PinEditor({ pin, onChangeLabel, onChangeColor, onDelete, onClose }: Props) {
  const [label, setLabel] = useState(pin.label);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    containerRef.current?.scrollIntoView({ block: 'nearest' });
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
    }
  }

  return (
    <div class="pin-editor" ref={containerRef}>
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
        caption="This pin's colour"
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
