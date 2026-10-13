// A non-modal note shown after the builder changed more than was asked for — an example or
// "Surprise me" replaced work in progress, or a count or placement brought its partner along — with
// a one-click way back. Each kind has its own spot (replaced: above the builder; adjusted: under the
// picture controls); the status region is always mounted so assistive tech announces the note when
// it appears. When an adjustment leaves the charges' colour breaking the rule, the violation panel's
// fix sits beside Undo too, so it is in reach wherever that panel is on screen.

import { suggestTinctureFix, type Design } from '../../lib/heraldry/next';
import { chargesClash, fixText, picturePath, type Replacement } from '../../lib/next/builder';

interface Props {
  replacement: Replacement | null;
  kind: Replacement['kind'];
  onUndo: () => void;
  /** Apply the rule fix offered beside Undo; null where none is offered (a replaced design). */
  onFix: ((nd: Design) => void) | null;
}

export function ReplacedNotice({ replacement, kind, onUndo, onFix }: Props) {
  const shown = replacement?.kind === kind ? replacement : null;
  const adjustedDesign = shown?.kind === 'adjusted' ? shown.replacement.design : null;
  const picture = adjustedDesign && picturePath(adjustedDesign);
  const fix = onFix && adjustedDesign && picture && chargesClash(adjustedDesign, picture) ? suggestTinctureFix(adjustedDesign) : null;
  return (
    <div role="status" data-testid={`${kind}-status`}>
      {shown && (
        <p class="replaced-notice" data-testid={`${kind}-notice`}>
          <span>{shown.kind === 'adjusted' ? shown.note : 'Replaced your design.'}</span>
          {onFix && fix && (
            <button type="button" class="button-primary button-small" data-testid={`${kind}-fix`} onClick={() => onFix(fix.design)}>
              {fixText(fix.label)}
            </button>
          )}
          <button type="button" class="button-tertiary" data-testid={`${kind}-undo`} onClick={onUndo}>Undo</button>
        </p>
      )}
    </div>
  );
}
