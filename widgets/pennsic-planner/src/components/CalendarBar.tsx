import { useState, useEffect } from 'preact/hooks';
import type { ActiveCalendar, SyncStatus } from '../store';
import type { DeviceCalendar } from '../lib/deviceCalendars';
import { capabilityUrls, editHash, shareHash } from '../lib/route';

export type Mode = 'landing' | 'edit' | 'readonly';

interface Props {
  mode: Mode;
  active: ActiveCalendar | null;
  eventName: string;
  sync: { status: SyncStatus; message?: string };
  justCreated: boolean;
  busy: boolean;
  onCreate: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onDismissCreated: () => void;
  deviceCalendars: DeviceCalendar[];
  onForgetDevice: (id: string) => void;
  onClearDevices: () => void;
}

export function CalendarBar(props: Props) {
  const { mode } = props;
  if (mode === 'landing') return <LandingBar {...props} />;
  if (mode === 'readonly') return <ReadonlyBar {...props} />;
  return <EditBar {...props} />;
}

function LandingBar({ onCreate, busy, deviceCalendars, onForgetDevice, onClearDevices }: Props) {
  return (
    <div class="cal-bar cal-bar-landing">
      <div class="cal-bar-cta">
        <div class="cal-bar-cta-text">
          <strong>Build a shareable calendar.</strong>
          <span> Star classes to start one — it saves online and lives at a link you can bookmark and share.</span>
        </div>
        <button class="cal-create-btn" onClick={onCreate} disabled={busy}>
          {busy ? 'Creating…' : '+ Create calendar'}
        </button>
      </div>
      {deviceCalendars.length > 0 && (
        <DeviceList list={deviceCalendars} onForget={onForgetDevice} onClear={onClearDevices} />
      )}
    </div>
  );
}

function ReadonlyBar({ active, onDuplicate, busy }: Props) {
  return (
    <div class="cal-bar cal-bar-readonly" role="note">
      <div class="cal-bar-readonly-text">
        <strong>{active?.name ?? 'Shared calendar'}</strong>
        <span> · viewing a shared calendar (read-only)</span>
      </div>
      <button class="cal-create-btn" onClick={onDuplicate} disabled={busy}>
        {busy ? 'Copying…' : 'Duplicate to edit'}
      </button>
    </div>
  );
}

function EditBar({ active, sync, justCreated, onRename, onDismissCreated }: Props) {
  const [draft, setDraft] = useState(active?.name ?? '');

  // Keep the input in step when the active calendar changes underneath us (open / conflict reload).
  useEffect(() => {
    setDraft(active?.name ?? '');
  }, [active?.id, active?.name]);

  if (!active) return null;
  const urls = capabilityUrls(active.id, active.secret);

  function commitName() {
    const next = draft.trim();
    if (next && next !== active!.name) onRename(next);
    else setDraft(active!.name);
  }

  return (
    <div class="cal-bar cal-bar-edit">
      <div class="cal-bar-row">
        <label class="sr-only" for="cal-name-input">Calendar name</label>
        <input
          id="cal-name-input"
          class="cal-name-input"
          value={draft}
          maxLength={200}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Calendar name"
        />
        <SyncBadge sync={sync} />
      </div>

      {justCreated ? (
        <div class="cal-keep-link" role="status">
          <div class="cal-keep-link-head">
            <strong>This is your calendar — keep this link to come back and edit it.</strong>
            <button class="cal-dismiss" aria-label="Dismiss" onClick={onDismissCreated}>×</button>
          </div>
          <p class="cal-keep-link-note">
            The link is the only way back in — there are no accounts. Bookmark the edit link, and share
            the read-only link with others.
          </p>
          <div class="cal-link-grid">
            <LinkCopyRow label="Edit link (keep private)" value={urls.edit ?? ''} />
            <LinkCopyRow label="Read-only share link" value={urls.share} />
          </div>
        </div>
      ) : (
        <div class="cal-link-grid cal-link-grid-compact">
          <LinkCopyRow label="Edit link" value={urls.edit ?? ''} />
          <LinkCopyRow label="Share link" value={urls.share} />
        </div>
      )}
    </div>
  );
}

function SyncBadge({ sync }: { sync: { status: SyncStatus; message?: string } }) {
  const map: Record<SyncStatus, { text: string; cls: string }> = {
    idle: { text: 'Saved', cls: 'saved' },
    saving: { text: 'Saving…', cls: 'saving' },
    saved: { text: 'Saved', cls: 'saved' },
    error: { text: sync.message ?? 'Save failed', cls: 'error' },
    conflict: { text: 'Reloaded', cls: 'error' },
  };
  const m = map[sync.status];
  return (
    <span class={`cal-sync cal-sync-${m.cls}`} role="status" title={sync.message ?? ''}>
      {m.text}
    </span>
  );
}

function LinkCopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div class="cal-link-row">
      <span class="cal-link-label">{label}</span>
      <div class="cal-link-field">
        <input class="cal-link-input" readOnly value={value} onFocus={(e) => (e.target as HTMLInputElement).select()} />
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }
  return (
    <button class={`cal-copy-btn${copied ? ' copied' : ''}`} onClick={copy} disabled={!value}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function DeviceList({
  list,
  onForget,
  onClear,
}: {
  list: DeviceCalendar[];
  onForget: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <details class="device-cals">
      <summary class="device-cals-summary">
        Your calendars on this device <span class="device-cals-count">({list.length})</span>
      </summary>
      <p class="device-cals-note">
        A convenience list stored only in this browser — clearing it loses these shortcuts, never a
        calendar (each still lives at its link).
      </p>
      <ul class="device-cals-list">
        {list.map((c) => (
          <li key={c.id} class="device-cal-item">
            <a class="device-cal-link" href={c.secret ? editHash(c.id, c.secret) : shareHash(c.id)}>
              {c.name}
            </a>
            <span class="device-cal-mode">{c.secret ? 'edit' : 'read-only'}</span>
            <button class="device-cal-forget" aria-label={`Forget ${c.name}`} onClick={() => onForget(c.id)}>
              Forget
            </button>
          </li>
        ))}
      </ul>
      <button class="device-cals-clear" onClick={onClear}>Clear this list</button>
    </details>
  );
}

async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
