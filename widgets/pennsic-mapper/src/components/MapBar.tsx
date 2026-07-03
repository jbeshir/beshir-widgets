import { useRef, useState } from 'preact/hooks';
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
  local: 'Not saved — will retry',
};

const STATUS_CLASS: Record<SyncStatus, string> = {
  idle: 'saved',
  saving: 'saving',
  saved: 'saved',
  error: 'error',
  conflict: 'error',
  local: 'pending',
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

// The map's name, sync status, and share/edit link panel. Unlike pennsic-planner's popover-gated
// SharePopover, the link panel here is always visible (just disabled) while the map is still a
// local-only draft — the "links appear once saved" caption is the primary cue for that state, so it
// sits above the disabled rows and is wired to them via aria-describedby.
export function MapBar({ map, sync, onRename }: Props) {
  const [name, setName] = useState(map.name);
  const inputRef = useRef<HTMLInputElement>(null);
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

  return (
    <div class="map-bar">
      <div class="map-bar-row">
        <input
          ref={inputRef}
          type="text"
          class="map-bar-name"
          data-testid="rename-map"
          value={name}
          maxLength={80}
          aria-label="Map name"
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onBlur={commitName}
          onKeyDown={handleKeyDown}
        />
        <SyncBadge status={sync.status} message={sync.message} />
      </div>
      <div class="map-bar-links">
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
    </div>
  );
}
