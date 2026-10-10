// Example arms in a small box that folds away (open on a device's first visit, folded after), with
// "Surprise me" in its top corner, outside the fold so it is always in view and first in tab order. Each example loads into the builder; its caption is
// its accessible name and tooltip.

import type { ShapedDesign } from '../../lib/heraldry';
import { EXAMPLE_DESIGNS } from '../../lib/presets';
import { Shield } from '../Shield';

interface Props {
  /** Whether the box starts open; the visitor can open or fold it at any time. */
  defaultOpen: boolean;
  /** Load a design; `caption` says what it is, for the announcement. */
  onPick: (pick: ShapedDesign, caption: string) => void;
  onSurprise: () => void;
}

export function Examples({ defaultOpen, onPick, onSurprise }: Props) {
  return (
    <div class="examples">
      <button type="button" class="button-secondary button-small examples-surprise" data-testid="surprise-me" onClick={onSurprise}>
        Surprise me
      </button>
      <details class="examples-box" data-testid="examples" open={defaultOpen}>
        <summary class="examples-summary" data-testid="examples-summary">
          Examples
          <span class="step-chevron" aria-hidden="true" />
        </summary>
        <ul class="examples-list">
          {EXAMPLE_DESIGNS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                class="example"
                data-testid={`example-${p.id}`}
                aria-label={p.caption}
                title={p.caption}
                onClick={() => onPick({ design: p.design, shape: p.shape }, p.caption)}
              >
                <Shield design={p.design} shape={p.shape} size={36} label={null} />
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
