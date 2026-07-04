import { PALETTE } from '../lib/palette';

interface Props {
  selected: string;
  onSelect: (key: string) => void;
  idPrefix: string;
  caption?: string;
  /**
   * Compact = dots only (no per-swatch name pill), for the floating pin editor and the slim colour
   * toolbar. The selected colour's name is shown once as a caption beside the row (with `caption` as an
   * optional prefix, e.g. "New pin:") so a visible text cue for the active choice always exists.
   */
  compact?: boolean;
}

// Reused both as the "colour for the next pin" picker (shown only while no pin is being edited) and
// inside PinEditor for recolouring an existing pin. Colour is never the only cue — the selected name is
// always shown (as per-swatch text in the full variant, or a single caption in the compact variant).
// Roving tabindex + arrow-key navigation follows the standard ARIA radiogroup pattern.
export function ColorPicker({ selected, onSelect, idPrefix, caption, compact = false }: Props) {
  const selectedIndex = Math.max(0, PALETTE.findIndex((c) => c.key === selected));
  const selectedName = PALETTE[selectedIndex].name;

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
    <div class={`color-picker${compact ? ' color-picker-compact' : ''}`}>
      {!compact && caption && <p class="color-picker-caption">{caption}</p>}
      <div class="color-swatches" role="radiogroup" aria-label="Pin colour" onKeyDown={handleKeyDown}>
        {PALETTE.map((color, index) => (
          <button
            key={color.key}
            type="button"
            id={`${idPrefix}-${color.key}`}
            class={`color-swatch${compact ? ' color-swatch-compact' : ''}${color.key === selected ? ' selected' : ''}`}
            data-testid="color-swatch"
            role="radio"
            aria-checked={color.key === selected}
            aria-label={color.name}
            title={color.name}
            tabIndex={index === selectedIndex ? 0 : -1}
            style={{ '--swatch-color-light': color.light, '--swatch-color-dark': color.dark }}
            onClick={() => onSelect(color.key)}
          >
            <span class="color-swatch-dot" aria-hidden="true" />
            {!compact && <span class="color-swatch-name">{color.name}</span>}
          </button>
        ))}
      </div>
      {compact && (
        <p class="color-picker-selected">
          {caption ? `${caption} ` : ''}
          <span class="color-picker-selected-name">{selectedName}</span>
        </p>
      )}
    </div>
  );
}
