import { useEffect, useRef, useState } from 'preact/hooks';

type Props = {
  prompt: string;
  rowLabel: string;
  note?: string;
};

export function InfoPopover({ prompt, rowLabel, note }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const wrap = wrapRef.current;
      if (wrap && !wrap.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Restore focus to the trigger when the popover closes (after having been open).
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  return (
    <span class="info-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        class={`info-btn${open ? ' info-btn--open' : ''}`}
        aria-label={`Show generation prompt for ${rowLabel}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <span class="info-popover" role="dialog" aria-label={`Generation prompt for ${rowLabel}`}>
          <span class="info-arrow" aria-hidden="true" />
          <span class="info-popover-head">
            <span class="info-popover-title">Prompt</span>
            <button
              type="button"
              class="info-popover-close"
              aria-label="Close prompt"
              ref={closeBtnRef}
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          </span>
          <span class="info-popover-body">
            <q class="prompt-text">{prompt}</q>
            {note && <span class="prompt-note">{note}</span>}
          </span>
        </span>
      )}
    </span>
  );
}
