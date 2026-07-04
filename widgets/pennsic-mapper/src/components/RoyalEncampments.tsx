import { ROYAL_ENCAMPMENTS, type RoyalEncampment } from '../data/mapKey';

interface Props {
  /** Pan/zoom the map to a block's approximate location and pulse-highlight it. */
  onJump: (camp: RoyalEncampment) => void;
  /** Block code of the last-jumped encampment, marked as the current selection (persists past focus). */
  activeBlock?: string | null;
  defaultOpen?: boolean;
}

// The map's printed "Royal Encampments" list, hoisted into a clean, scannable table. Each row is a
// button that jumps the map to that kingdom's block — reusing MapSurface's focus plumbing — so a
// visitor can find their kingdom's camp without hunting the raster. Collapsible so it never buries
// the map + pin workflow. The last-jumped row keeps a persistent "current" marker (independent of
// focus) so it's clear where you last went even after the on-map pulse fades.
export function RoyalEncampments({ onJump, activeBlock, defaultOpen = false }: Props) {
  return (
    <details class="info-panel royal-encampments" data-testid="royal-encampments" open={defaultOpen}>
      <summary class="info-panel-summary">
        <span class="info-panel-heading">
          <span class="info-panel-title">Royal encampments</span>
          <span class="info-panel-hint">Find a kingdom’s block — tap to jump the map there</span>
        </span>
      </summary>
      <div class="info-panel-body">
        <ul class="royals-list" role="list">
          {ROYAL_ENCAMPMENTS.map((camp) => {
            const active = camp.block === activeBlock;
            return (
              <li key={camp.block}>
                <button
                  type="button"
                  class={`royals-row${active ? ' is-active' : ''}`}
                  data-testid={`royal-jump-${camp.block}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onJump(camp)}
                  title={`Jump to ${camp.kingdom} (block ${camp.block})`}
                >
                  <span class="royals-kingdom">{camp.kingdom}</span>
                  <span class="royals-block" aria-hidden="true">{camp.block}</span>
                  <span class="sr-only">block {camp.block}, jump to it on the map</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p class="royals-note">Block locations are approximate — the map jumps you to the right neighbourhood.</p>
      </div>
    </details>
  );
}
