// The design breaks a rule after a lower-layer change: list the problems by layer and offer a
// one-click fix when a single tincture swap (or a structural refit) clears them.

import { fitCharges, suggestTinctureFix, type Issue, type NormDesign } from '../../lib/heraldry';
import { LAYER_LABEL, assess, sameDesign } from '../../lib/builder';

interface Props {
  design: NormDesign;
  problems: Issue[];
  onFix: (nd: NormDesign) => void;
  /** Scroll to and focus the builder section that holds a problem. */
  onGoTo: (layer: Issue['layer']) => void;
}

export function ViolationPanel({ design, problems, onFix, onGoTo }: Props) {
  const layers = [...new Set(problems.map((p) => LAYER_LABEL[p.layer]))];
  const tinctureFix = suggestTinctureFix(design);
  const refit = fitCharges(design);
  const structuralFix = !tinctureFix && !sameDesign(refit, design) && assess(refit).status !== 'violation' ? refit : null;
  return (
    <section class="violation" data-testid="violation-panel" aria-labelledby="violation-title">
      <h2 id="violation-title" class="violation-title">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M10 2L19 18H1Z" fill="currentColor" />
          <path d="M10 8v4.5M10 14.6v.4" stroke="var(--violation-bg)" stroke-width="2" stroke-linecap="round" />
        </svg>
        This design breaks a rule ({layers.join(', ').toLowerCase()})
      </h2>
      <ul class="violation-list">
        {problems.map((p, i) => (
          <li key={i} data-layer={p.layer}>
            <strong>{LAYER_LABEL[p.layer]}:</strong> {p.message}{' '}
            <button type="button" class="text-button" data-testid="violation-goto" onClick={() => onGoTo(p.layer)}>Go to {LAYER_LABEL[p.layer].toLowerCase()}</button>
          </li>
        ))}
      </ul>
      {tinctureFix && (
        <button type="button" class="button-primary button-small" data-testid="violation-fix" onClick={() => onFix(tinctureFix.design)}>
          Fix: {tinctureFix.label.charAt(0).toLowerCase() + tinctureFix.label.slice(1)}
        </button>
      )}
      {structuralFix && (
        <button type="button" class="button-primary button-small" data-testid="violation-fix" onClick={() => onFix(structuralFix)}>
          Fix: rearrange the charges to fit
        </button>
      )}
      {!tinctureFix && !structuralFix && (
        <p class="violation-help">Change a tincture above to clear it — blocked swatches explain why.</p>
      )}
    </section>
  );
}
