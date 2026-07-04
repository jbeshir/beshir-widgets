import { useEffect, useRef, useState } from 'preact/hooks';
import type { ActiveMap, SyncStatus } from '../store';
import { capabilityUrls } from '../lib/route';

interface Props {
  map: ActiveMap;
  sync: { status: SyncStatus; message?: string };
  onRename: (name: string) => void;
  /** Share popover open state, owned by App so it is the single mutual-exclusion authority (Fix 1). */
  shareOpen: boolean;
  onShareToggle: (open: boolean) => void;
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  idle: 'Saved',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved — will retry',
  conflict: 'Reloaded',
};

const STATUS_CLASS: Record<SyncStatus, string> = {
  idle: 'saved',
  saving: 'saving',
  saved: 'saved',
  error: 'error',
  conflict: 'error',
};

function SyncBadge({ status, message }: { status: SyncStatus; message?: string }) {
  return (
    <span class={`sync-badge sync-badge-${STATUS_CLASS[status]}`} role="status" title={message ?? ''}>
      {STATUS_TEXT[status]}
    </span>
  );
}

/** Copy to clipboard, falling back to a hidden textarea + execCommand where the Clipboard API is unavailable. */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({
  testId,
  url,
  label,
  ariaLabel,
}: {
  testId: string;
  url: string | null;
  label: string;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (!url) return;
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      class="button-secondary"
      data-testid={testId}
      disabled={!url}
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

// The floating top bar for an EDITABLE map: a compact rename field, the sync badge, and a Share button
// that toggles a small popover with the edit/share link rows. This bar only ever renders once a real
// row exists (creation is gated), so the links are always live — there is no "not saved yet" state.
export function MapBar({ map, sync, onRename, shareOpen, onShareToggle }: Props) {
  const [name, setName] = useState(map.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const shareWrapRef = useRef<HTMLDivElement>(null);
  const shareToggleRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const urls = capabilityUrls(map.id, map.secret);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== map.name) onRename(trimmed);
    else setName(map.name);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') inputRef.current?.blur();
  }

  // Focus management + dismissal for the share popover (role="dialog"). On open, move focus into the
  // dialog (first enabled Copy button, else the dialog container). Dismiss on outside pointerdown or
  // Escape; on Escape, return focus to the Share toggle (standard dialog behaviour).
  useEffect(() => {
    if (!shareOpen) return;
    const firstFocusable =
      popoverRef.current?.querySelector<HTMLElement>('button:not([disabled])') ?? popoverRef.current;
    firstFocusable?.focus();
    function onPointer(e: PointerEvent) {
      if (!shareWrapRef.current?.contains(e.target as Node)) onShareToggle(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onShareToggle(false);
        shareToggleRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    // Depend on shareOpen ONLY. `onShareToggle` is a fresh closure each App render, but the listeners here
    // only ever call it to flip stable state setters — a captured copy stays correct. Excluding it keeps
    // this dialog's focus-management effect from re-running on unrelated parent re-renders (e.g. an
    // autosave 'saving'→'saved' tick), which would otherwise yank focus back to the first Copy button
    // mid-interaction. This mirrors the identity-stable behaviour the local useState setter had before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareOpen]);

  // While the popover is open, lift the top bar's whole stacking context above the dock (see
  // .map-topbar.share-open in styles.css). The popover is a descendant of this bar, so its own z-index is
  // trapped inside the bar's context — raising the BAR is what actually floats the popover over the dock.
  return (
    <div class={`map-topbar${shareOpen ? ' share-open' : ''}`}>
      {/* The rename field + a pencil affordance so it's visibly an editable field, not static text. The
          pencil is only ever here (this bar renders only for editable maps; the read-only view uses a
          different, non-editable title), so its presence itself signals "this map's name is editable". */}
      <div class="map-topbar-name-field">
        <button
          type="button"
          class="map-topbar-edit"
          data-testid="edit-map-name"
          aria-label="Rename map"
          title="Rename map"
          onClick={() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus();
            el.select();
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path
              d="M13.6 3.9a1.6 1.6 0 0 1 2.3 2.3l-8 8L4.5 15.5l1.3-3.4 7.8-8.2Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          class="map-topbar-name"
          data-testid="rename-map"
          value={name}
          maxLength={80}
          aria-label="Map name"
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onBlur={commitName}
          onKeyDown={handleKeyDown}
        />
      </div>
      <SyncBadge status={sync.status} message={sync.message} />
      <div class="share-wrap" ref={shareWrapRef}>
        <button
          ref={shareToggleRef}
          type="button"
          class="button-secondary share-toggle"
          data-testid="share-toggle"
          aria-haspopup="dialog"
          aria-expanded={shareOpen}
          onClick={() => onShareToggle(!shareOpen)}
        >
          Share
        </button>
        {shareOpen && (
          <div ref={popoverRef} tabIndex={-1} class="share-popover" data-testid="share-popover" role="dialog" aria-label="Share this map">
            <div class="map-bar-link-row">
              <span class="map-bar-link-label">Edit link</span>
              <CopyButton testId="copy-edit-link" url={urls.edit} label="Copy" ariaLabel="Copy edit link" />
            </div>
            <p class="map-bar-link-subtext">Anyone with this link can edit</p>
            <div class="map-bar-link-row">
              <span class="map-bar-link-label">Share link</span>
              <CopyButton testId="copy-share-link" url={urls.share} label="Copy" ariaLabel="Copy share link" />
            </div>
            <p class="map-bar-link-subtext">Anyone with this link can view & duplicate</p>
          </div>
        )}
      </div>
    </div>
  );
}
