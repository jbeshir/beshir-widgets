// Starting designs: bold ready-made arms to load into the builder, plus "Surprise me".

import type { ShapedDesign } from '../../lib/heraldry';
import { STARTING_DESIGNS } from '../../lib/presets';
import { Shield } from '../Shield';

interface Props {
  /** Load a design; `caption` says what it is, for the announcement. */
  onPick: (pick: ShapedDesign, caption: string) => void;
  onSurprise: () => void;
}

export function StartingGallery({ onPick, onSurprise }: Props) {
  return (
    <section class="gallery" data-testid="starting-gallery" aria-labelledby="gallery-title">
      <div class="gallery-head">
        <h2 id="gallery-title" class="section-label">Start from an example</h2>
        <button type="button" class="button-secondary button-small" data-testid="surprise-me" onClick={onSurprise}>
          Surprise me
        </button>
      </div>
      <ul class="gallery-list">
        {STARTING_DESIGNS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              class="gallery-item"
              data-testid={`starting-${p.id}`}
              aria-label={`Start from: ${p.caption}`}
              onClick={() => onPick({ design: p.design, shape: p.shape }, p.caption)}
            >
              <Shield design={p.design} shape={p.shape} size={64} label={null} />
              <span class="gallery-caption">{p.caption}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
