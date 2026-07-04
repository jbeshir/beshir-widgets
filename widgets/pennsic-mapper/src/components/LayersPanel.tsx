interface Props {
  /** Whether on-map pin labels are currently shown. */
  showLabels: boolean;
  onToggleLabels: (show: boolean) => void;
  /** Controlled disclosure state for the dock's single-open mutual exclusion (uncontrolled if omitted). */
  open?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

// A dock panel for map display options, matching the collapsible <details> pattern of the other dock
// panels (Map key / Encampments / Your pins). For now it carries a single control — a toggle for the
// always-on pin labels drawn on the map — and is intentionally minimal; it's the seam a fuller layers
// system could grow from, not that system built ahead of need.
export function LayersPanel({ showLabels, onToggleLabels, open, onToggle }: Props) {
  return (
    <details
      class="info-panel layers-panel"
      data-testid="layers-panel"
      open={open}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="info-panel-summary" title="Layers">
        <span class="info-panel-heading">
          <h2 class="info-panel-title">Layers</h2>
          <span class="info-panel-hint">Show or hide map annotations</span>
        </span>
      </summary>
      <div class="info-panel-body layers-panel-body">
        <label class="layers-toggle">
          <input
            type="checkbox"
            class="layers-toggle-input"
            data-testid="toggle-pin-labels"
            checked={showLabels}
            onChange={(e) => onToggleLabels((e.currentTarget as HTMLInputElement).checked)}
          />
          <span class="layers-toggle-text">Show pin labels</span>
        </label>
      </div>
    </details>
  );
}
