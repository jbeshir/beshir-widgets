// A non-modal note shown after a starting design or "Surprise me" replaced work in progress, with a
// one-click way back. The status region is always mounted so assistive tech announces the note
// when it appears.

export function ReplacedNotice({ onUndo, visible }: { onUndo: () => void; visible: boolean }) {
  return (
    <div role="status" data-testid="replaced-status">
      {visible && (
        <p class="replaced-notice" data-testid="replaced-notice">
          <span>Replaced your design.</span>
          <button type="button" class="button-tertiary" data-testid="replaced-undo" onClick={onUndo}>Undo</button>
        </p>
      )}
    </div>
  );
}
