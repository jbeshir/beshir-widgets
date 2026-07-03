import { PALETTE } from '../lib/palette';

interface Props {
  selected: string;
  onSelect: (key: string) => void;
  idPrefix: string;
  caption?: string;
}

// Reused both as the "colour for the next pin" picker (shown only while no pin is being edited) and
// inside PinEditor for recolouring an existing pin. Colour is never the only cue — the name is always
// shown. Roving tabindex + arrow-key navigation follows the standard ARIA radiogroup pattern.
export function ColorPicker({ selected, onSelect, idPrefix, caption }: Props) {
  const selectedIndex = Math.max(0, PALETTE.findIndex((c) => c.key === selected));

  function handleKeyDown(e: KeyboardEvent) {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') delta = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') delta = -1;
    else return;
    e.preventDefault();
    const next = PALETTE[(selectedIndex + delta + PALETTE.length) % PALETTE.length];
    onSelect(next.key);
    document.getElementById(`${idPrefix}-${next.key}`)?.focus();
  }

  return (
    <div class="color-picker">
      {caption && <p class="color-picker-caption">{caption}</p>}
      <div class="color-swatches" role="radiogroup" aria-label="Pin colour" onKeyDown={handleKeyDown}>
        {PALETTE.map((color, index) => (
          <button
            key={color.key}
            type="button"
            id={`${idPrefix}-${color.key}`}
            class={`color-swatch${color.key === selected ? ' selected' : ''}`}
            data-testid="color-swatch"
            role="radio"
            aria-checked={color.key === selected}
            aria-label={color.name}
            tabIndex={index === selectedIndex ? 0 : -1}
            style={{ '--swatch-color-light': color.light, '--swatch-color-dark': color.dark }}
            onClick={() => onSelect(color.key)}
          >
            <span class="color-swatch-dot" aria-hidden="true" />
            <span class="color-swatch-name">{color.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
