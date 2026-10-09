// Register… dialog: display name (public), email (private; the edit link is emailed to it) and an
// optional Discord username (public), a "What's public?" popover nested inside the dialog, then a
// success view. The share link is the primary thing to take away; the edit link sits in a masked
// "Secret — don't share" box with a line saying whether it was emailed. Bottom sheet on narrow
// screens (Dialog handles that). A server 409 duplicate / too-close is shown with the same panel as
// "Check availability".

import { useRef, useState } from 'preact/hooks';
import { DISCORD_MAX, DISPLAY_NAME_MAX, EMAIL_MAX, blazon, cleanDiscord, cleanDisplayName, cleanEmail, type FieldShape, type MailOutcome, type NormDesign } from '../lib/heraldry';
import { capabilityUrls, registryParam } from '../lib/route';
import * as store from '../store';
import { TakenPanel } from './Availability';
import { CopyField, SecretLinkField } from './CopyField';
import { Dialog, Popover } from './overlay';
import { Shield } from './Shield';

interface Props {
  design: NormDesign;
  shape: FieldShape;
  onClose: () => void;
  onRegistered: () => void;
}

type Field = 'displayName' | 'email' | 'discord';
type FieldErrors = Record<Field, string | null>;
const NO_ERRORS: FieldErrors = { displayName: null, email: null, discord: null };

function isField(f: string | undefined): f is Field {
  return f === 'displayName' || f === 'email' || f === 'discord';
}

type Checked = { ok: true; displayName: string; email: string; discord: string | null } | { ok: false; errors: FieldErrors };

/** The same checks the Worker makes, so most mistakes are caught before sending. */
function validate(name: string, email: string, discord: string): Checked {
  const n = cleanDisplayName(name);
  const e = cleanEmail(email);
  const d = cleanDiscord(discord);
  if (n.ok && e.ok && d.ok) return { ok: true, displayName: n.value, email: e.value, discord: d.value };
  return {
    ok: false,
    errors: { displayName: n.ok ? null : n.message, email: e.ok ? null : e.message, discord: d.ok ? null : d.message },
  };
}

export function RegisterDialog({ design, shape, onClose, onRegistered }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [discord, setDiscord] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [taken, setTaken] = useState<store.Failure | null>(null);
  const [created, setCreated] = useState<{ registered: store.Registered; email: string } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLButtonElement>(null);
  const offline = store.isOffline();
  const refs: Record<Field, { current: HTMLInputElement | null }> = {
    displayName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    discord: useRef<HTMLInputElement>(null),
  };

  const showErrors = (next: FieldErrors) => {
    setErrors(next);
    const first = (['displayName', 'email', 'discord'] as const).find((f) => next[f] !== null);
    if (first) refs[first].current?.focus();
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy || offline) return;
    const checked = validate(name, email, discord);
    setFormError(null);
    setTaken(null);
    if (!checked.ok) return showErrors(checked.errors);
    setErrors(NO_ERRORS);
    setBusy(true);
    const r = await store.register({
      registry: registryParam(), displayName: checked.displayName, email: checked.email, contact: { discord: checked.discord }, design, shape,
    });
    setBusy(false);
    if (r.ok) {
      setCreated({ registered: r.created, email: checked.email });
      onRegistered();
    } else if (r.code === 'duplicate' || r.code === 'too_close') {
      setTaken(r);
    } else if (isField(r.field)) {
      showErrors({ ...NO_ERRORS, [r.field]: r.message });
    } else {
      setFormError(r.message);
    }
  };

  if (created) {
    const { registered } = created;
    const urls = capabilityUrls(registered.id, registered.editSecret);
    return (
      <Dialog title="Your arms are registered" onClose={onClose} testid="register-dialog" class="register-dialog">
        <div data-testid="register-success" class="register-success">
          <div class="register-summary">
            <Shield design={design} shape={shape} size={72} />
            <div>
              <p class="summary-name">{name.trim()}</p>
              <p class="blazon blazon-small">{registered.blazon}</p>
            </div>
          </div>
          <p>Registered in {registered.registry.name}. Share this link so people can see your arms:</p>
          <CopyField label="Share link (public)" value={urls.share} testid="share-link" buttonLabel="Copy share link" emphasis="primary" />
          {urls.edit && <SecretLinkField value={urls.edit} testid="edit-link" />}
          <MailStatus outcome={registered.editLinkEmail} email={created.email} />
          <p class="field-hint">
            A copy is kept under “Your arms” on this device. Lost it later? Use “Lost your link?” at the top of the page and we’ll email you a new one.
          </p>
          <div class="dialog-actions">
            <button type="button" class="button-secondary" data-testid="register-done" onClick={onClose}>Done</button>
          </div>
        </div>
      </Dialog>
    );
  }

  const describedBy = (f: Field, hint: string) => (errors[f] ? `${hint} reg-${f}-error` : hint);
  return (
    <Dialog title="Register your arms" onClose={onClose} testid="register-dialog" class="register-dialog" initialFocus={refs.displayName} owns={infoOpen ? 'public-info-popover-box' : undefined}>
      <form class="register-form" onSubmit={submit} noValidate>
        <div class="register-summary">
          <Shield design={design} shape={shape} size={72} />
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
            <p><strong>Public:</strong> the arms (shield and blazon), the display name and the Discord username if you give one. Anyone can search for the arms and read them.</p>
            <p><strong>Private:</strong> your email address and your edit link. The address is only used to send you the link that lets you change the name or Discord username, or withdraw the entry.</p>
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
          ref={refs.displayName}
          class="text-input"
          data-testid="register-name"
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          value={name}
          onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          aria-invalid={errors.displayName ? 'true' : undefined}
          aria-describedby={describedBy('displayName', 'reg-name-count')}
          required
        />
        <p class="field-hint" id="reg-name-count" aria-live="off">{name.length} of {DISPLAY_NAME_MAX} characters</p>
        <FieldError field="displayName" message={errors.displayName} />

        <label class="field-label" for="reg-email">
          Email <span class="public-tag">Private — never shown</span>
        </label>
        <input
          id="reg-email"
          ref={refs.email}
          class="text-input"
          type="email"
          data-testid="register-email"
          maxLength={EMAIL_MAX}
          autoComplete="email"
          inputMode="email"
          value={email}
          onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
          aria-invalid={errors.email ? 'true' : undefined}
          aria-describedby={describedBy('email', 'reg-email-hint')}
          required
        />
        <p class="field-hint" id="reg-email-hint">Used only to send you your edit/withdraw link. Never shown publicly.</p>
        <FieldError field="email" message={errors.email} />

        <label class="field-label" for="reg-discord">
          Discord username (optional) <span class="public-tag">Public — shown on your entry</span>
        </label>
        <input
          id="reg-discord"
          ref={refs.discord}
          class="text-input"
          data-testid="register-discord"
          maxLength={DISCORD_MAX + 1}
          autoComplete="off"
          autoCapitalize="none"
          spellcheck={false}
          value={discord}
          onInput={(e) => setDiscord((e.currentTarget as HTMLInputElement).value)}
          aria-invalid={errors.discord ? 'true' : undefined}
          aria-describedby={describedBy('discord', 'reg-discord-hint')}
        />
        <p class="field-hint" id="reg-discord-hint">So people at the party can find you, e.g. alex.smith. Shown as plain text.</p>
        <FieldError field="discord" message={errors.discord} />

        {formError && <p class="form-error" role="alert" data-testid="register-error">{formError}</p>}
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

const FIELD_TESTID: Record<Field, string> = { displayName: 'register-name-error', email: 'register-email-error', discord: 'register-discord-error' };

function FieldError({ field, message }: { field: Field; message: string | null }) {
  if (!message) return null;
  return <p class="form-error" id={`reg-${field}-error`} data-testid={FIELD_TESTID[field]}>{message}</p>;
}

/** Whether the edit link reached the owner's inbox. The address shown is what they typed here; the API never returns it. */
function MailStatus({ outcome, email }: { outcome: MailOutcome; email: string }) {
  if (outcome === 'sent') {
    return (
      <p class="mail-status" data-testid="register-mail-status" data-outcome={outcome}>
        We’ve emailed it to you at the address you gave ({email}).
      </p>
    );
  }
  return (
    <p class="mail-status mail-status-failed" data-testid="register-mail-status" data-outcome={outcome} role="note">
      <strong>We couldn’t email you the edit link</strong>
      {outcome === 'disabled' ? ' (email isn’t set up on this server)' : ''}. Your arms are registered — copy the edit link now and keep it somewhere safe.
    </p>
  );
}
