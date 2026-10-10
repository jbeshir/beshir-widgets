// "Lost your link? / Withdraw my registration".
//   #/recover          → type the email address you registered with; the Worker emails a single-use
//                        30-minute link per entry that address owns (the answer never says whether
//                        it owns any).
//   #/recover/<token>  → the emailed link: shows the entry first, and only an explicit click uses the
//                        token up — "Get a new edit link" (the old one stops working; the new one is
//                        remembered on this device) or "Withdraw this registration". Link scanners
//                        that merely open the page can't burn the token.

import { useEffect, useRef, useState } from 'preact/hooks';
import { API_ERROR, EMAIL_MAX, cleanEmail, type ApiErrorCode } from '../../lib/heraldry';
import { RECOVER_HASH, capabilityUrls, ownerHash } from '../../lib/route';
import type { ListStatus } from '../../lib/widgetState';
import * as store from '../../store';
import { SecretLinkField } from '../CopyField';
import { Dialog } from '../overlay';
import { Shield } from '../Shield';

/** Focus the screen's heading when it opens, so keyboard and screen-reader users land on it. */
function useHeadingFocus() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return ref;
}

export function RecoverRequest({ onStatus }: { onStatus: (s: ListStatus) => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const heading = useHeadingFocus();
  const inputRef = useRef<HTMLInputElement>(null);
  const offline = store.isOffline();

  useEffect(() => onStatus('populated'), []);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy || offline) return;
    const checked = cleanEmail(email);
    if (!checked.ok) {
      setError(checked.message);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    const r = await store.requestRecovery(checked.value);
    setBusy(false);
    if (r.ok) setSent(r.message);
    else setError(r.message);
  };

  return (
    <div class="entry-page recover-view" data-testid="recover-view">
      <a class="text-link back-link" href="#/" data-testid="back-to-registry">← Back to the registry</a>
      <h2 class="owner-title recover-heading" tabIndex={-1} ref={heading}>Lost your link? / Withdraw my registration</h2>
      {sent ? (
        <div class="owner-message" role="status" data-testid="recover-sent">
          <p><strong>Check your inbox.</strong> {sent}</p>
          <p>Nothing arrived? Check your spam folder, and that you typed the address you registered with.</p>
        </div>
      ) : (
        <form class="register-form" onSubmit={submit} noValidate>
          <p>
            Type the email address you registered with. If it owns any arms, we’ll email it a link for each entry. A link works
            once, for 30 minutes, and lets you get a new edit link or withdraw the registration.
          </p>
          {offline && (
            <p class="offline-note" id="recover-offline" data-testid="recover-offline" role="note">
              <strong>This offline copy can't send email.</strong> Open the hosted widget to get a new link.
            </p>
          )}
          <label class="field-label" for="recover-email">Email</label>
          <input
            id="recover-email"
            ref={inputRef}
            class="text-input"
            type="email"
            data-testid="recover-email"
            maxLength={EMAIL_MAX}
            autoComplete="email"
            inputMode="email"
            value={email}
            onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'recover-email-hint recover-email-error' : 'recover-email-hint'}
          />
          <p class="field-hint" id="recover-email-hint">Used only to send you the link. Never shown publicly.</p>
          {error && <p class="form-error" id="recover-email-error" data-testid="recover-email-error">{error}</p>}
          <div class="dialog-actions recover-actions">
            <button type="submit" class="button-primary" data-testid="recover-submit" disabled={busy || offline} aria-describedby={offline ? 'recover-offline' : undefined}>
              {busy ? 'Sending…' : 'Email me a link'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type Redeem =
  | { status: 'loading' }
  | { status: 'error'; failure: store.Failure }
  | { status: 'ready'; entry: store.RecoveryEntry }
  | { status: 'recovered'; entry: store.RecoveryEntry; recovered: store.Recovered }
  | { status: 'withdrawn' };

const TOKEN_CODES: readonly (ApiErrorCode | null)[] = [API_ERROR.tokenInvalid, API_ERROR.tokenUsed, API_ERROR.tokenExpired];

export function RecoverRedeem({ token, onStatus, hatching, onDeviceChange }: {
  token: string;
  onStatus: (s: ListStatus) => void;
  hatching: boolean;
  onDeviceChange: () => void;
}) {
  const [state, setState] = useState<Redeem>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const heading = useHeadingFocus();

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    store.lookupRecovery(token).then((r) => {
      if (live) setState(r.ok ? { status: 'ready', entry: r.entry } : { status: 'error', failure: r });
    });
    return () => { live = false; };
  }, [token]);

  useEffect(() => onStatus(state.status === 'loading' || state.status === 'error' ? state.status : 'populated'), [state.status]);

  const fail = (f: store.Failure) => {
    if (TOKEN_CODES.includes(store.failureCode(f))) setState({ status: 'error', failure: f });
    else setActionError(f.message);
  };

  const newLink = async (entry: store.RecoveryEntry) => {
    setBusy(true);
    setActionError(null);
    const r = await store.redeemRecovery(token, { design: entry.design, shape: entry.shape });
    setBusy(false);
    if (!r.ok) return fail(r);
    setState({ status: 'recovered', entry, recovered: r.recovered });
    onDeviceChange();
  };

  const withdraw = async () => {
    setBusy(true);
    setActionError(null);
    const r = await store.withdrawByRecovery(token);
    setBusy(false);
    setConfirming(false);
    if (!r.ok) return fail(r);
    setState({ status: 'withdrawn' });
    onDeviceChange();
  };

  return (
    <div class="entry-page recover-view" data-testid="redeem-view">
      <a class="text-link back-link" href="#/" data-testid="back-to-registry">← Back to the registry</a>
      <h2 class="owner-title recover-heading" tabIndex={-1} ref={heading}>Your registration</h2>
      {state.status === 'loading' && <p class="panel-message" aria-busy="true" role="status">Checking your link…</p>}
      {state.status === 'error' && <RedeemError failure={state.failure} />}
      {(state.status === 'ready' || state.status === 'recovered') && (
        <div class="register-summary">
          <Shield design={state.entry.design} shape={state.entry.shape} size={96} hatching={hatching} />
          <div>
            <p class="summary-name" data-testid="redeem-name">{state.entry.displayName}</p>
            <p class="blazon blazon-small">{state.entry.blazon}</p>
            <p class="field-hint">In {state.entry.registry.name}</p>
          </div>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <p>Choose what to do. This link works once.</p>
          {actionError && <p class="form-error" role="alert" data-testid="redeem-error">{actionError}</p>}
          <div class="dialog-actions recover-actions">
            <button type="button" class="button-primary" data-testid="redeem-new-link" disabled={busy} onClick={() => newLink(state.entry)}>
              {busy ? 'Working…' : 'Get a new edit link'}
            </button>
            <button type="button" class="button-danger" data-testid="redeem-withdraw" disabled={busy} onClick={() => setConfirming(true)}>
              Withdraw this registration
            </button>
          </div>
          <p class="field-hint">A new edit link replaces the old one: the old link stops working.</p>
        </>
      )}
      {state.status === 'recovered' && (
        <div class="register-success" data-testid="redeem-recovered">
          <div class="owner-message" role="status">
            <p><strong>Here’s your new edit link.</strong> The old one no longer works. It’s also saved under “Your arms” on this device.</p>
          </div>
          <SecretLinkField value={capabilityUrls(state.recovered.id, state.recovered.editSecret).edit ?? ''} testid="redeem-edit-link" />
          <a class="text-link back-link" href={ownerHash(state.recovered.id, state.recovered.editSecret)} data-testid="redeem-open-owner">Open the edit page</a>
        </div>
      )}
      {state.status === 'withdrawn' && (
        <div class="panel-message" role="status" data-testid="redeem-withdrawn">
          <p><strong>Withdrawn.</strong> These arms have been removed from the registry, and the design is free to register again.</p>
        </div>
      )}
      {confirming && (
        <Dialog title="Withdraw this registration?" testid="redeem-withdraw-dialog" onClose={() => !busy && setConfirming(false)}>
          <div class="register-form">
            <p>This removes the arms from the registry for everyone, and the design is free to register again — by anyone. The entry and its links will stop working.</p>
            <div class="dialog-actions">
              <button type="button" class="button-secondary" data-testid="redeem-withdraw-cancel" onClick={() => setConfirming(false)}>Keep them</button>
              <button type="button" class="button-danger" data-testid="redeem-withdraw-confirm" disabled={busy} onClick={withdraw}>{busy ? 'Withdrawing…' : 'Withdraw'}</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function RedeemError({ failure }: { failure: store.Failure }) {
  const code = store.failureCode(failure);
  const title =
    code === API_ERROR.tokenUsed ? 'This link has already been used.'
    : code === API_ERROR.tokenExpired ? 'This link has expired.'
    : code === API_ERROR.tokenInvalid ? "This link doesn't work — check you copied all of it."
    : "Your registration couldn't be loaded.";
  const detail = TOKEN_CODES.includes(code) ? 'Each emailed link works once, for 30 minutes.' : failure.message;
  return (
    <div class="panel-message panel-error" role="alert" data-testid="redeem-link-error" data-code={code ?? failure.kind}>
      <p><strong>{title}</strong> {detail}</p>
      <a class="text-link" href={RECOVER_HASH} data-testid="redeem-ask-again">Ask for a new link</a>
    </div>
  );
}
