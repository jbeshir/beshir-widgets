// A non-modal note shown after the builder changed more than was asked for — a starting design or
// "Surprise me" replaced work in progress, or a count or placement brought its partner along — with
// a one-click way back. Each kind has its own spot (replaced: above the builder; adjusted: under the
// picture controls); the status region is always mounted so assistive tech announces the note when
// it appears.

import type { Replacement } from '../../lib/builder';

export function ReplacedNotice({ replacement, kind, onUndo }: { replacement: Replacement | null; kind: Replacement['kind']; onUndo: () => void }) {
  const shown = replacement?.kind === kind ? replacement : null;
  return (
    <div role="status" data-testid={`${kind}-status`}>
      {shown && (
        <p class="replaced-notice" data-testid={`${kind}-notice`}>
          <span>{shown.kind === 'adjusted' ? shown.note : 'Replaced your design.'}</span>
          <button type="button" class="button-tertiary" data-testid={`${kind}-undo`} onClick={onUndo}>Undo</button>
        </p>
      )}
    </div>
  );
}
