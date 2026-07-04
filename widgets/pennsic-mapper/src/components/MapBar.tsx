import { useEffect, useRef, useState } from 'preact/hooks';
import type { ActiveMap, SyncStatus } from '../store';
import { capabilityUrls } from '../lib/route';

interface Props {
  map: ActiveMap;
  sync: { status: SyncStatus; message?: string };
  onRename: (name: string) => void;
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  idle: 'Saved',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved — will retry',
  conflict: 'Reloaded',
  // `local` = an untouched/offline draft, not an error — reads calm, not alarming.
  local: 'Not synced',
};

const STATUS_CLASS: Record<SyncStatus, string> = {
  idle: 'saved',
  saving: 'saving',
  saved: 'saved',
  error: 'error',
  conflict: 'error',
  // Neutral (not the warning `pending` style): an offline/local map is a normal resting state.
  local: 'neutral',
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
  describedBy,
}: {
  testId: string;
  url: string | null;
  label: string;
  ariaLabel: string;
  describedBy?: string;
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
      aria-describedby={describedBy}
      onClick={handleClick}
    >
      {copied ? 'Copied!' : label}
    </button>
  );
}

// The floating top bar: a compact rename field, the sync badge, and a Share button that toggles a small
// popover with the edit/share link rows. While the map is still a local-only draft the link rows render
// disabled, with the "links appear once saved" caption above them (wired via aria-describedby) as the
// primary cue for that state.
export function MapBar({ map, sync, onRename }: Props) {
  const [name, setName] = useState(map.name);
  const [shareOpen, setShareOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shareWrapRef = useRef<HTMLDivElement>(null);
  const shareToggleRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pending = map.id === 'local-draft';
  const urls = capabilityUrls(map.id, map.secret);
  const linksInfoId = 'map-bar-links-info';

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
      if (!shareWrapRef.current?.contains(e.target as Node)) setShareOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShareOpen(false);
        shareToggleRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [shareOpen]);

  return (
    <div class="map-topbar">
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
      <SyncBadge status={sync.status} message={sync.message} />
      <div class="share-wrap" ref={shareWrapRef}>
        <button
          ref={shareToggleRef}
          type="button"
          class="button-secondary share-toggle"
          data-testid="share-toggle"
          aria-haspopup="dialog"
          aria-expanded={shareOpen}
          onClick={() => setShareOpen((v) => !v)}
        >
          Share
        </button>
        {shareOpen && (
          <div ref={popoverRef} tabIndex={-1} class="share-popover" data-testid="share-popover" role="dialog" aria-label="Share this map">
            {pending && (
              <p class="map-bar-link-caption" id={linksInfoId}>
                Links appear once your map is saved online.
              </p>
            )}
            <div class="map-bar-link-row">
              <span class="map-bar-link-label">Edit link</span>
              <CopyButton
                testId="copy-edit-link"
                url={pending ? null : urls.edit}
                label="Copy"
                ariaLabel="Copy edit link"
                describedBy={pending ? linksInfoId : undefined}
              />
            </div>
            <p class="map-bar-link-subtext">Anyone with this link can edit</p>
            <div class="map-bar-link-row">
              <span class="map-bar-link-label">Share link</span>
              <CopyButton
                testId="copy-share-link"
                url={pending ? null : urls.share}
                label="Copy"
                ariaLabel="Copy share link"
                describedBy={pending ? linksInfoId : undefined}
              />
            </div>
            <p class="map-bar-link-subtext">Anyone with this link can view & duplicate</p>
          </div>
        )}
      </div>
    </div>
  );
}
