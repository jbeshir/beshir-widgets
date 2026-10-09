// Owner view for #/a/<id>/<secret>: the secret is checked on load (a truncated or replaced link
// gets a clear "this link doesn't work" state instead of a form that fails on Save), and a working
// link is remembered under "Your arms" on this device. Edit the display name, Discord username and
// display shape (PUT with the secret and If-Match rev), copy the edit link, or withdraw the entry
// (DELETE after a confirm dialog). The design itself is not editable here — change the arms by
// registering a new design and withdrawing this one.

import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_FIELD_SHAPE, DISCORD_MAX, DISPLAY_NAME_MAX, cleanDiscord, type FieldShape } from '../../lib/heraldry';
import { RECOVER_HASH, capabilityUrls } from '../../lib/route';
import type { ListStatus } from '../../lib/widgetState';
import * as store from '../../store';
import { CopyField, SecretLinkField } from '../CopyField';
import { Dialog } from '../overlay';
import { ShapePicker } from '../design/ShapePicker';
import { Shield } from '../Shield';

interface Props {
  id: string;
  secret: string;
  onStatus: (s: ListStatus) => void;
  hatching: boolean;
  onDeviceChange: () => void;
}

type Load =
  | { status: 'loading' }
  | { status: 'ok'; entry: store.ArmsEntry }
  | { status: 'error'; failure: store.Failure }
  | { status: 'denied' }
  | { status: 'withdrawn' };

const isDenied = (f: store.Failure) => f.status === 401 || f.status === 403;

export function OwnerView({ id, secret, onStatus, hatching, onDeviceChange }: Props) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [discord, setDiscord] = useState('');
  const [shape, setShape] = useState<FieldShape>(DEFAULT_FIELD_SHAPE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'stale'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const withdrawRef = useRef<HTMLButtonElement>(null);

  const adopt = (entry: store.ArmsEntry) => {
    setLoad({ status: 'ok', entry });
    setName(entry.displayName);
    setDiscord(entry.contact.discord ?? '');
    setShape(entry.shape);
    store.rememberArms({
      id, registry: entry.registry.id, displayName: entry.displayName, blazon: entry.blazon,
      shield: { design: entry.design, shape: entry.shape }, secret,
    });
    onDeviceChange();
  };

  useEffect(() => {
    let live = true;
    setLoad({ status: 'loading' });
    setMessage(null);
    Promise.all([store.getEntry(id), store.checkOwner(id, secret)]).then(([entry, owner]) => {
      if (!live) return;
      if (!entry.ok) return setLoad({ status: 'error', failure: entry });
      if (!owner.ok) return setLoad(isDenied(owner) ? { status: 'denied' } : { status: 'error', failure: owner });
      adopt(entry.entry);
    });
    return () => { live = false; };
  }, [id, secret, attempt]);

  useEffect(() => onStatus(load.status === 'ok' || load.status === 'withdrawn' ? 'populated' : load.status === 'denied' ? 'error' : load.status), [load.status]);

  const save = async (e: Event) => {
    e.preventDefault();
    if (load.status !== 'ok' || busy) return;
    if (!name.trim()) return setMessage({ kind: 'error', text: 'Enter a display name.' });
    const handle = cleanDiscord(discord);
    if (!handle.ok) return setMessage({ kind: 'error', text: handle.message });
    const entry = load.entry;
    setBusy(true);
    setMessage(null);
    const r = await store.update(id, secret, entry.rev, { displayName: name, contact: { discord: handle.value }, design: entry.design, shape });
    setBusy(false);
    if (r.ok) {
      adopt(r.entry);
      setMessage({ kind: 'ok', text: 'Saved.' });
    } else if (r.code === 'conflict') {
      setMessage({ kind: 'stale', text: 'These arms were changed elsewhere since you opened this page. Reload to see the latest version, then make your edit again.' });
    } else if (r.status === 401 || r.status === 403) {
      setLoad({ status: 'denied' });
    } else {
      setMessage({ kind: 'error', text: r.message });
    }
  };

  const withdraw = async () => {
    setBusy(true);
    const r = await store.withdraw(id, secret);
    setBusy(false);
    setConfirming(false);
    if (r.ok) {
      setLoad({ status: 'withdrawn' });
      onDeviceChange();
    } else if (isDenied(r)) {
      setLoad({ status: 'denied' });
    } else {
      setMessage({ kind: 'error', text: r.message });
    }
  };

  const urls = capabilityUrls(id, secret);
  return (
    <div class="entry-page owner-view" data-testid="owner-view">
      <a class="text-link back-link" href="#/" data-testid="back-to-registry">← Back to the registry</a>
      {load.status === 'loading' && <p class="panel-message" aria-busy="true" role="status">Checking your edit link…</p>}
      {load.status === 'error' && (
        <div class="panel-message panel-error" role="alert" data-testid="owner-error">
          <p>
            <strong>{load.failure.status === 404 ? "These arms aren't in the registry." : "Your arms couldn't be loaded."}</strong>{' '}
            {load.failure.status === 404 ? 'They may already have been withdrawn.' : load.failure.message}
          </p>
          {load.failure.status !== 404 && <button type="button" class="button-secondary" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
        </div>
      )}
      {load.status === 'denied' && (
        <div class="panel-message panel-error" role="alert" data-testid="owner-denied">
          <p><strong>This edit link doesn't work.</strong></p>
          <p>
            It may have been cut short when it was copied or pasted — check you have all of it — or replaced by a newer link
            (getting a new link by email stops the old one working).
          </p>
          <a class="text-link" href={RECOVER_HASH} data-testid="owner-denied-recover">Get a new link by email</a>
        </div>
      )}
      {load.status === 'withdrawn' && (
        <div class="panel-message" role="status" data-testid="withdrawn">
          <p><strong>Withdrawn.</strong> These arms have been removed from the registry, and the design is free to register again.</p>
        </div>
      )}
      {load.status === 'ok' && (
        <>
          <h2 class="owner-title">Edit your registered arms</h2>
          <div class="register-summary">
            <Shield design={load.entry.design} shape={shape} size={96} hatching={hatching} />
            <p class="blazon blazon-small">{load.entry.blazon}</p>
          </div>
          <form class="register-form" onSubmit={save} noValidate>
            <label class="field-label" for="own-name">Display name <span class="public-tag">Public — anyone can see this</span></label>
            <input id="own-name" class="text-input" data-testid="owner-name" maxLength={DISPLAY_NAME_MAX} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
            <p class="field-hint">{name.length} of {DISPLAY_NAME_MAX} characters</p>
            <label class="field-label" for="own-discord">Discord username (optional) <span class="public-tag">Public — shown on your entry</span></label>
            <input
              id="own-discord"
              class="text-input"
              data-testid="owner-discord"
              maxLength={DISCORD_MAX + 1}
              autoComplete="off"
              autoCapitalize="none"
              spellcheck={false}
              value={discord}
              onInput={(e) => setDiscord((e.currentTarget as HTMLInputElement).value)}
              aria-describedby="own-discord-hint"
            />
            <p class="field-hint" id="own-discord-hint">Leave blank to remove it.</p>
            <ShapePicker design={load.entry.design} value={shape} onChange={setShape} idPrefix="owner-shape" />
            {message && (
              <div class={`owner-message owner-message-${message.kind}`} role={message.kind === 'ok' ? 'status' : 'alert'} data-testid={message.kind === 'stale' ? 'owner-stale' : 'owner-message'}>
                <p>{message.text}</p>
                {message.kind === 'stale' && <button type="button" class="button-secondary" data-testid="owner-reload" onClick={() => setAttempt((n) => n + 1)}>Reload</button>}
              </div>
            )}
            <div class="dialog-actions owner-actions">
              <button type="button" ref={withdrawRef} class="button-danger" data-testid="owner-withdraw" disabled={busy} onClick={() => setConfirming(true)}>Withdraw these arms</button>
              <button type="submit" class="button-primary" data-testid="owner-save" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
          <CopyField label="Share link (public)" value={urls.share} testid="owner-share-link" buttonLabel="Copy share link" emphasis="secondary" />
          {urls.edit && <SecretLinkField value={urls.edit} testid="owner-edit-link" />}
        </>
      )}
      {confirming && (
        <Dialog title="Withdraw these arms?" testid="withdraw-dialog" onClose={() => !busy && setConfirming(false)}>
          <div class="register-form">
            <p>This removes the arms from the registry for everyone, and the design is free to register again — by anyone. This entry and its links will stop working.</p>
            <div class="dialog-actions">
              <button type="button" class="button-secondary" data-testid="withdraw-cancel" onClick={() => setConfirming(false)}>Keep them</button>
              <button type="button" class="button-danger" data-testid="withdraw-confirm" disabled={busy} onClick={withdraw}>{busy ? 'Withdrawing…' : 'Withdraw'}</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
