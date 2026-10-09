// Register… dialog (PLAN §6 item 6): display name + optional contact, both public, a "What's
// public?" popover nested inside the dialog, then a success view with the share and private edit
// links. Bottom sheet on narrow screens (Dialog handles that). A server 409 duplicate / too-close
// is shown with the same panel as "Check availability".

import { useRef, useState } from 'preact/hooks';
import { CONTACT_MAX, DISPLAY_NAME_MAX, blazon, type NormDesign } from '../lib/heraldry';
import { capabilityUrls, registryParam } from '../lib/route';
import * as store from '../store';
import { TakenPanel } from './Availability';
import { CopyField } from './CopyField';
import { Dialog, Popover } from './overlay';
import { Shield } from './Shield';

interface Props {
  design: NormDesign;
  onClose: () => void;
  onRegistered: () => void;
}

export function RegisterDialog({ design, onClose, onRegistered }: Props) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [taken, setTaken] = useState<store.Failure | null>(null);
  const [created, setCreated] = useState<store.Registered | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLButtonElement>(null);
  const offline = store.isOffline();
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy || offline) return;
    if (!name.trim()) {
      setError({ message: 'Enter a display name.', field: 'displayName' });
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setTaken(null);
    const r = await store.register({ registry: registryParam(), displayName: name, contact: contact.trim() || null, design });
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'duplicate' || r.code === 'too_close') {
        setTaken(r);
      } else {
        setError({ message: r.message, field: r.field });
        if (r.field === 'displayName') nameRef.current?.focus();
        else if (r.field === 'contact') contactRef.current?.focus();
      }
      return;
    }
    setCreated(r.created);
    onRegistered();
  };

  if (created) {
    const urls = capabilityUrls(created.id, created.editSecret);
    return (
      <Dialog title="Your arms are registered" onClose={onClose} testid="register-dialog" class="register-dialog">
        <div data-testid="register-success" class="register-success">
          <div class="register-summary">
            <Shield design={design} size={72} />
            <div>
              <p class="summary-name">{name.trim()}</p>
              <p class="blazon blazon-small">{created.blazon}</p>
            </div>
          </div>
          <p>Registered in {created.registry.name}. Anyone with the share link can see them.</p>
          <CopyField label="Share link (public)" value={urls.share} testid="share-link" />
          {urls.edit && (
            <>
              <CopyField label="Private edit link" value={urls.edit} testid="edit-link" />
              <p class="warning-note" data-testid="save-warning" role="note">
                <strong>Save this link now.</strong> It is the only way to edit or withdraw these arms, and we can't recover it.
                A copy is kept under "Your arms" on this device.
              </p>
            </>
          )}
          <div class="dialog-actions">
            <button type="button" class="button-primary" data-testid="register-done" onClick={onClose}>Done</button>
          </div>
        </div>
      </Dialog>
    );
  }

  const nameInvalid = error?.field === 'displayName';
  const contactInvalid = error?.field === 'contact';
  return (
    <Dialog title="Register your arms" onClose={onClose} testid="register-dialog" class="register-dialog" initialFocus={nameRef} owns={infoOpen ? 'public-info-popover-box' : undefined}>
      <form class="register-form" onSubmit={submit} noValidate>
        <div class="register-summary">
          <Shield design={design} size={72} />
          <p class="blazon blazon-small">{blazon(design)}</p>
        </div>

        <button
          type="button"
          ref={infoRef}
          class="text-button"
          data-testid="public-info-button"
          aria-expanded={infoOpen ? 'true' : 'false'}
          aria-controls="public-info-popover-box"
          onClick={() => setInfoOpen((v) => !v)}
        >
          What's public?
        </button>
        {infoOpen && (
          <Popover anchor={infoRef} onClose={() => setInfoOpen(false)} label="What's public?" testid="public-info-popover" id="public-info-popover-box" placement="above" class="info-popover">
            <p><strong>Public:</strong> the arms (shield and blazon), the display name and the contact. Anyone can search for and read them.</p>
            <p><strong>Private:</strong> your edit link. Only you hold it; use it to change the name or contact, or to withdraw the entry.</p>
            <p>Use a name you're happy to share, and leave the contact blank if you prefer.</p>
          </Popover>
        )}

        {offline && (
          <p class="offline-note" id="reg-offline" data-testid="register-offline" role="note">
            <strong>This offline copy can't register arms.</strong> Availability checks use the bundled sample only; open the hosted widget to register.
          </p>
        )}

        <label class="field-label" for="reg-name">
          Display name <span class="public-tag">Public — anyone can see this</span>
        </label>
        <input
          id="reg-name"
          ref={nameRef}
          class="text-input"
          data-testid="register-name"
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          value={name}
          onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          aria-invalid={nameInvalid ? 'true' : undefined}
          aria-describedby={nameInvalid ? 'reg-name-count reg-error' : 'reg-name-count'}
          required
        />
        <p class="field-hint" id="reg-name-count" aria-live="off">{name.length} of {DISPLAY_NAME_MAX} characters</p>

        <label class="field-label" for="reg-contact">
          Contact (optional) <span class="public-tag">Public — anyone can see this</span>
        </label>
        <input
          id="reg-contact"
          ref={contactRef}
          class="text-input"
          data-testid="register-contact"
          maxLength={CONTACT_MAX}
          value={contact}
          onInput={(e) => setContact((e.currentTarget as HTMLInputElement).value)}
          aria-invalid={contactInvalid ? 'true' : undefined}
          aria-describedby={contactInvalid ? 'reg-contact-count reg-error' : 'reg-contact-count'}
        />
        <p class="field-hint" id="reg-contact-count" aria-live="off">{contact.length} of {CONTACT_MAX} characters. Shown as plain text, never as a link.</p>

        {error && <p class="form-error" id="reg-error" role="alert" data-testid="register-error">{error.message}</p>}
        {taken && (
          <div role="alert" data-testid="register-taken">
            <TakenPanel
              verdict={taken.code === 'duplicate' ? 'duplicate' : 'too-close'}
              conflict={taken.conflict}
              differences={taken.differences}
              onView={onClose}
            />
          </div>
        )}
        <div class="dialog-actions">
          <button type="button" class="button-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" class="button-primary" data-testid="register-submit" disabled={busy || offline} aria-describedby={offline ? 'reg-offline' : undefined}>{busy ? 'Registering…' : 'Register'}</button>
        </div>
      </form>
    </Dialog>
  );
}
