// Owner view for #/a/<id>/<secret>: the secret is checked on load (a truncated or replaced link
// gets a clear "this link doesn't work" state instead of a form that fails on Save), and a working
// link is remembered under "Your arms" on this device. Edit the display name, Discord username and
// display shape (PUT with the secret and If-Match rev), copy the edit link, or withdraw the entry
// (DELETE after a confirm dialog, in a separate section at the foot). The design itself is not
// editable here — the page says so: change the arms by withdrawing this entry and registering anew.

import { useEffect, useRef, useState } from 'preact/hooks';
import { API_ERROR, DEFAULT_FIELD_SHAPE, DISCORD_MAX, DISPLAY_NAME_MAX, cleanDiscord, type FieldShape } from '../../lib/heraldry/next';
import { RECOVER_HASH, editUrl, shareUrl } from '../../lib/route';
import { useFocusOnChange } from '../../lib/useFocusOnChange';
import type { ListStatus } from '../../lib/widgetState';
import * as store from '../../store';
import { CopyField, SecretLinkField } from '../CopyField';
import { Dialog } from '../overlay';
import { ShapePicker } from '../design/ShapePicker';
import { SavePicture } from '../SavePicture';
import { Shield } from '../next/Shield';

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

const NO_FIELD_ERRORS = { name: null, discord: null };

const isDenied = (f: store.Failure) => {
  const code = store.failureCode(f);
  return code === API_ERROR.unauthorized || code === API_ERROR.forbidden;
};

export function OwnerView({ id, secret, onStatus, hatching, onDeviceChange }: Props) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [discord, setDiscord] = useState('');
  const [shape, setShape] = useState<FieldShape>(DEFAULT_FIELD_SHAPE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'stale'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name: string | null; discord: string | null }>(NO_FIELD_ERRORS);
  const [confirming, setConfirming] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const discordRef = useRef<HTMLInputElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  // Focus goes to the screen's heading (or the notice standing in for it) once it has loaded.
  const landing = useFocusOnChange<HTMLDivElement & HTMLHeadingElement>(load.status === 'loading' ? null : load.status);

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
    setFieldErrors(NO_FIELD_ERRORS);
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
    const handle = cleanDiscord(discord);
    const errors = { name: name.trim() ? null : 'Enter a display name.', discord: handle.ok ? null : handle.message };
    setFieldErrors(errors);
    setMessage(null);
    if (errors.name) return nameRef.current?.focus();
    if (!handle.ok) return discordRef.current?.focus();
    const entry = load.entry;
    setBusy(true);
    const r = await store.update(id, secret, entry.rev, { displayName: name, contact: { discord: handle.value }, design: entry.design, shape });
    setBusy(false);
    if (r.ok) {
      adopt(r.entry);
      setMessage({ kind: 'ok', text: 'Saved.' });
    } else if (store.failureCode(r) === API_ERROR.conflict) {
      setMessage({ kind: 'stale', text: 'These arms were changed elsewhere since you opened this page. Reload to see the latest version, then make your edit again.' });
    } else if (isDenied(r)) {
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

  const notFound = load.status === 'error' && store.failureCode(load.failure) === API_ERROR.notFound;
  return (
    <div class="entry-page owner-view" data-testid="owner-view">
      <a class="text-link back-link" href="#/" data-testid="back-to-registry">← Back to the registry</a>
      {load.status === 'loading' && <p class="panel-message" aria-busy="true" role="status">Checking your edit link…</p>}
      {load.status === 'error' && (
        <div class="panel-message panel-error" role="alert" tabIndex={-1} ref={landing} data-testid="owner-error">
          <p>
            <strong>{notFound ? "These arms aren't in the registry." : "Your arms couldn't be loaded."}</strong>{' '}
            {notFound ? 'They may already have been withdrawn.' : load.failure.message}
          </p>
          {!notFound && <button type="button" class="button-secondary" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
        </div>
      )}
      {load.status === 'denied' && (
        <div class="panel-message panel-error" role="alert" tabIndex={-1} ref={landing} data-testid="owner-denied">
          <p><strong>This edit link doesn't work.</strong></p>
          <p>
            It may have been cut short when it was copied or pasted — check you have all of it — or replaced by a newer link
            (getting a new link by email stops the old one working).
          </p>
          <a class="text-link text-link-block" href={RECOVER_HASH} data-testid="owner-denied-recover">Get a new link by email</a>
        </div>
      )}
      {load.status === 'withdrawn' && (
        <div class="panel-message" role="status" tabIndex={-1} ref={landing} data-testid="withdrawn">
          <p><strong>Withdrawn.</strong> These arms have been removed from the registry, and the design is free to register again.</p>
        </div>
      )}
      {load.status === 'ok' && (
        <>
          <h2 class="owner-title" tabIndex={-1} ref={landing}>Edit your registered arms</h2>
          <div class="register-summary">
            <Shield design={load.entry.design} shape={shape} size={64} hatching={hatching} />
            <p class="blazon blazon-small">{load.entry.blazon}</p>
          </div>
          <p class="field-hint" data-testid="owner-design-note">
            The design can't be changed after registering. To use a different design, withdraw these arms and register a new one.
          </p>
          <form class="register-form" onSubmit={save} noValidate>
            <label class="field-label" for="own-name">Display name <span class="public-tag">Public — anyone can see this</span></label>
            <input
              id="own-name"
              ref={nameRef}
              class="text-input"
              data-testid="owner-name"
              maxLength={DISPLAY_NAME_MAX}
              value={name}
              onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
              aria-invalid={fieldErrors.name ? 'true' : undefined}
              aria-describedby={fieldErrors.name ? 'own-name-count own-name-error' : 'own-name-count'}
            />
            <p class="field-hint" id="own-name-count">{name.length} of {DISPLAY_NAME_MAX} characters</p>
            {fieldErrors.name && <p class="form-error" id="own-name-error" data-testid="owner-name-error">{fieldErrors.name}</p>}
            <label class="field-label" for="own-discord">Discord username (optional) <span class="public-tag">Public — shown on your entry</span></label>
            <input
              id="own-discord"
              ref={discordRef}
              class="text-input"
              data-testid="owner-discord"
              maxLength={DISCORD_MAX + 1}
              autoComplete="off"
              autoCapitalize="none"
              spellcheck={false}
              value={discord}
              onInput={(e) => setDiscord((e.currentTarget as HTMLInputElement).value)}
              aria-invalid={fieldErrors.discord ? 'true' : undefined}
              aria-describedby={fieldErrors.discord ? 'own-discord-hint own-discord-error' : 'own-discord-hint'}
            />
            <p class="field-hint" id="own-discord-hint">Leave blank to remove it.</p>
            {fieldErrors.discord && <p class="form-error" id="own-discord-error" data-testid="owner-discord-error">{fieldErrors.discord}</p>}
            <ShapePicker design={load.entry.design} value={shape} onChange={setShape} idPrefix="owner-shape" />
            {message && message.kind !== 'ok' && (
              <div class={`owner-message owner-message-${message.kind}`} role="alert" data-testid={message.kind === 'stale' ? 'owner-stale' : 'owner-message'}>
                <p>{message.text}</p>
                {message.kind === 'stale' && <button type="button" class="button-secondary" data-testid="owner-reload" onClick={() => setAttempt((n) => n + 1)}>Reload</button>}
              </div>
            )}
            <div class="dialog-actions owner-actions">
              <button type="submit" class="button-primary" data-testid="owner-save" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
            {/* One persistent status region: "Saved." is written into it, so it is announced reliably. */}
            <div role="status" data-testid={message?.kind === 'ok' ? 'owner-message' : undefined}>
              {message?.kind === 'ok' && <p class="owner-message owner-message-ok">{message.text}</p>}
            </div>
          </form>
          <SavePicture design={load.entry.design} shape={shape} hatching={hatching} displayName={name} />
          <CopyField label="Share link (public)" value={shareUrl(id)} testid="owner-share-link" buttonLabel="Copy share link" emphasis="secondary" />
          <SecretLinkField value={editUrl(id, secret)} testid="owner-edit-link" />
          <section class="danger-zone" aria-labelledby="danger-title">
            <h3 id="danger-title">Withdraw these arms</h3>
            <p>Removes them from the registry for everyone. You can register a design again afterwards.</p>
            <button type="button" class="button-danger" data-testid="owner-withdraw" disabled={busy} onClick={() => setConfirming(true)}>Withdraw these arms…</button>
          </section>
        </>
      )}
      {confirming && (
        <Dialog
          title="Withdraw these arms?"
          testid="withdraw-dialog"
          initialFocus={keepRef}
          footer={
            <div class="dialog-actions">
              <button type="button" ref={keepRef} class="button-secondary" data-testid="withdraw-cancel" onClick={() => setConfirming(false)}>Keep them</button>
              <button type="button" class="button-danger" data-testid="withdraw-confirm" disabled={busy} onClick={withdraw}>{busy ? 'Withdrawing…' : 'Withdraw'}</button>
            </div>
          }
          onClose={() => !busy && setConfirming(false)}
        >
          <p>This removes the arms from the registry for everyone, and the design is free to register again — by anyone. This entry and its links will stop working.</p>
        </Dialog>
      )}
    </div>
  );
}
