// Owner view for #/a/<id>/<secret>: edit the display name and contact (PUT with the secret and
// If-Match rev), or withdraw the entry (DELETE after a confirm dialog). The design itself is not
// editable here — change the arms by registering a new design and withdrawing this one.

import { useEffect, useRef, useState } from 'preact/hooks';
import { CONTACT_MAX, DISPLAY_NAME_MAX } from '../../lib/heraldry';
import { capabilityUrls } from '../../lib/route';
import type { ListStatus } from '../../lib/widgetState';
import * as store from '../../store';
import { CopyField } from '../CopyField';
import { Dialog } from '../overlay';
import { Shield } from '../Shield';

interface Props {
  id: string;
  secret: string;
  onStatus: (s: ListStatus) => void;
  hatching: boolean;
  onDeviceChange: () => void;
}

type Load = { status: 'loading' } | { status: 'ok'; entry: store.ArmsEntry } | { status: 'error'; failure: store.Failure } | { status: 'withdrawn' };

export function OwnerView({ id, secret, onStatus, hatching, onDeviceChange }: Props) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'stale'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const withdrawRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    setLoad({ status: 'loading' });
    setMessage(null);
    store.getEntry(id).then((r) => {
      if (!live) return;
      if (!r.ok) return setLoad({ status: 'error', failure: r });
      setLoad({ status: 'ok', entry: r.entry });
      setName(r.entry.displayName);
      setContact(r.entry.contact ?? '');
    });
    return () => { live = false; };
  }, [id, attempt]);

  useEffect(() => onStatus(load.status === 'ok' || load.status === 'withdrawn' ? 'populated' : load.status), [load.status]);

  const save = async (e: Event) => {
    e.preventDefault();
    if (load.status !== 'ok' || busy) return;
    if (!name.trim()) return setMessage({ kind: 'error', text: 'Enter a display name.' });
    const entry = load.entry;
    setBusy(true);
    setMessage(null);
    const r = await store.update(id, secret, entry.rev, { displayName: name, contact: contact.trim() || null, design: entry.design });
    setBusy(false);
    if (r.ok) {
      setLoad({ status: 'ok', entry: r.entry });
      setName(r.entry.displayName);
      setContact(r.entry.contact ?? '');
      store.rememberArms({ id, registry: r.entry.registry.id, displayName: r.entry.displayName, blazon: r.entry.blazon, secret });
      onDeviceChange();
      setMessage({ kind: 'ok', text: 'Saved.' });
    } else if (r.code === 'conflict') {
      setMessage({ kind: 'stale', text: 'These arms were changed elsewhere since you opened this page. Reload to see the latest version, then make your edit again.' });
    } else if (r.status === 401 || r.status === 403) {
      setMessage({ kind: 'error', text: "That edit link isn't valid for these arms, so nothing was changed." });
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
    } else if (r.status === 401 || r.status === 403) {
      setMessage({ kind: 'error', text: "That edit link isn't valid for these arms, so they weren't withdrawn." });
    } else {
      setMessage({ kind: 'error', text: r.message });
    }
  };

  return (
    <div class="entry-page owner-view" data-testid="owner-view">
      <a class="text-link back-link" href="#/" data-testid="back-to-registry">← Back to the registry</a>
      {load.status === 'loading' && <p class="panel-message" aria-busy="true" role="status">Loading your arms…</p>}
      {load.status === 'error' && (
        <div class="panel-message panel-error" role="alert" data-testid="owner-error">
          <p>
            <strong>{load.failure.status === 404 ? "These arms aren't in the registry." : "Your arms couldn't be loaded."}</strong>{' '}
            {load.failure.status === 404 ? 'They may already have been withdrawn.' : load.failure.message}
          </p>
          {load.failure.status !== 404 && <button type="button" class="button-secondary" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
        </div>
      )}
      {load.status === 'withdrawn' && (
        <div class="panel-message" role="status" data-testid="withdrawn">
          <p><strong>Withdrawn.</strong> These arms have been removed from the registry, and the name is free to use again.</p>
        </div>
      )}
      {load.status === 'ok' && (
        <>
          <h2 class="owner-title">Edit your registered arms</h2>
          <div class="register-summary">
            <Shield design={load.entry.design} size={96} hatching={hatching} />
            <p class="blazon blazon-small">{load.entry.blazon}</p>
          </div>
          <form class="register-form" onSubmit={save} noValidate>
            <label class="field-label" for="own-name">Display name <span class="public-tag">Public — anyone can see this</span></label>
            <input id="own-name" class="text-input" data-testid="owner-name" maxLength={DISPLAY_NAME_MAX} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
            <p class="field-hint">{name.length} of {DISPLAY_NAME_MAX} characters</p>
            <label class="field-label" for="own-contact">Contact (optional) <span class="public-tag">Public — anyone can see this</span></label>
            <input id="own-contact" class="text-input" data-testid="owner-contact" maxLength={CONTACT_MAX} value={contact} onInput={(e) => setContact((e.currentTarget as HTMLInputElement).value)} />
            <p class="field-hint">{contact.length} of {CONTACT_MAX} characters</p>
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
          <CopyField label="Share link (public)" value={capabilityUrls(id, null).share} testid="owner-share-link" />
        </>
      )}
      {confirming && (
        <Dialog title="Withdraw these arms?" testid="withdraw-dialog" onClose={() => !busy && setConfirming(false)}>
          <div class="register-form">
            <p>This removes the arms from the registry for everyone. You can register the same design again later, but this entry and its links will stop working.</p>
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
