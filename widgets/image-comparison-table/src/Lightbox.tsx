import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { Selection } from './App';
import type { Table } from './tables';

type Props = {
  table: Table;
  selection: Selection;
  onClose: () => void;
  onNavigate: (dRow: number, dCol: number) => void;
};

export function Lightbox({ table, selection, onClose, onNavigate }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const row = table.rows[selection.rowIdx];
  const col = table.columns[selection.colIdx];
  const cell = row?.cells[col?.id];

  // Open as a native modal on mount. showModal() puts the dialog in the top
  // layer, traps focus, and restores focus to the previously-focused element
  // automatically on close — so no hand-rolled focus trap/restore is needed.
  // Background scroll is not reliably locked by showModal(), so keep the cheap
  // body overflow lock.
  useLayoutEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Bridge the native dialog's cancel/close events to onClose() so Preact
  // unmounts the (conditionally-mounted) component and clears the selection.
  // In Preact core, wire these via addEventListener on the ref — onCancel/onClose
  // JSX props are not reliable here (see FINDINGS). Esc fires `cancel`; explicit
  // dismissals (close button, backdrop click) call dlg.close(), which fires `close`.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onCloseEvt = () => onClose();
    dlg.addEventListener('cancel', onCancel);
    dlg.addEventListener('close', onCloseEvt);
    return () => {
      dlg.removeEventListener('cancel', onCancel);
      dlg.removeEventListener('close', onCloseEvt);
    };
  }, [onClose]);

  // Arrow keys navigate between cells. Esc is handled by the native `cancel`
  // event above, so this handler only deals with the four arrows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          onNavigate(0, -1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          onNavigate(0, 1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          onNavigate(-1, 0);
          return;
        case 'ArrowDown':
          e.preventDefault();
          onNavigate(1, 0);
          return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onNavigate]);

  const captionId = useMemo(() => 'lightbox-caption', []);
  const titleId = useMemo(() => 'lightbox-title', []);

  if (!cell || !row || !col) return null;

  const canPrevCol = selection.colIdx > 0;
  const canNextCol = selection.colIdx < table.columns.length - 1;
  const canPrevRow = selection.rowIdx > 0;
  const canNextRow = selection.rowIdx < table.rows.length - 1;

  const showPrompt = !col.reference && row.prompt;

  return (
    <dialog
      class="lb-backdrop"
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={captionId}
      onClick={(e) => {
        if (e.target === e.currentTarget) dialogRef.current?.close();
      }}
    >
      <div class="lb-dialog">
        <div class="lb-figure">
          <button
            type="button"
            class="lb-nav lb-nav--left"
            aria-label="Previous column"
            onClick={() => onNavigate(0, -1)}
            disabled={!canPrevCol}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>

          <img
            class="lb-image"
            src={cell.full}
            alt={cell.alt}
            draggable={false}
          />

          <button
            type="button"
            class="lb-nav lb-nav--right"
            aria-label="Next column"
            onClick={() => onNavigate(0, 1)}
            disabled={!canNextCol}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div class="lb-meta">
          <div class="lb-meta-head">
            <h2 id={titleId} class="lb-title">
              <span class="lb-theme">{row.label}</span>
              <span class="lb-sep" aria-hidden="true">›</span>
              <span class="lb-model">{col.label}</span>
              {col.reference
                ? <span class="lb-tag">reference</span>
                : <span class="lb-tag">2026 AI</span>}
            </h2>
            <button
              type="button"
              class="lb-close"
              aria-label="Close (Esc)"
              ref={closeRef}
              onClick={() => dialogRef.current?.close()}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
                <path d="M4 4l12 12M16 4L4 16" />
              </svg>
            </button>
          </div>

          <div id={captionId} class="lb-caption">
            {showPrompt ? (
              <>
                <span class="lb-caption-label">Prompt</span>
                <q class="lb-prompt">{row.prompt}</q>
              </>
            ) : (
              <span class="lb-caption-note">Pre-existing reference artwork — not generated from a prompt.</span>
            )}
          </div>

          <div class="lb-hints" aria-hidden="true">
            <kbd>←</kbd><kbd>→</kbd> columns &nbsp;·&nbsp; <kbd>↑</kbd><kbd>↓</kbd> rows &nbsp;·&nbsp; <kbd>Esc</kbd> close
          </div>

          <div class="lb-paging" aria-hidden="true">
            <span class={`lb-dot${canPrevRow ? ' lb-dot--on' : ''}`}>↑</span>
            <span class={`lb-dot${canPrevCol ? ' lb-dot--on' : ''}`}>←</span>
            <span class="lb-pos">
              row {selection.rowIdx + 1}/{table.rows.length} · col {selection.colIdx + 1}/{table.columns.length}
            </span>
            <span class={`lb-dot${canNextCol ? ' lb-dot--on' : ''}`}>→</span>
            <span class={`lb-dot${canNextRow ? ' lb-dot--on' : ''}`}>↓</span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
