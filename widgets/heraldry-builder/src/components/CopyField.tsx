// Copying to the clipboard: the `useCopy` hook, a read-only link field with a Copy button (share
// link, entry link), and the masked "Secret — don't share" box for private edit links.

import { useState } from 'preact/hooks';

type CopyState = 'idle' | 'copied' | 'failed';

/** Copy `value`; when the clipboard is unavailable (insecure context), `onFail` selects it instead. */
export function useCopy(value: string, onFail: () => void): { state: CopyState; copy: () => Promise<void> } {
  const [state, setState] = useState<CopyState>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      onFail();
      setState('failed');
    }
  };
  return { state, copy };
}

function copyStatus(state: CopyState, what: string): string {
  if (state === 'copied') return 'Copied to the clipboard.';
  if (state === 'failed') return `Couldn’t copy automatically — the ${what} is selected, press Ctrl+C.`;
  return '';
}

function selectInput(id: string) {
  (document.getElementById(id) as HTMLInputElement | null)?.select();
}

interface Props {
  label: string;
  value: string;
  testid: string;
  /** The Copy button's text, e.g. "Copy share link". */
  buttonLabel: string;
  /** A primary Copy button marks the link the user should take away first. */
  emphasis: 'primary' | 'secondary';
}

export function CopyField({ label, value, testid, buttonLabel, emphasis }: Props) {
  const id = `${testid}-input`;
  const { state, copy } = useCopy(value, () => selectInput(id));

  return (
    <div class="copy-field">
      <label class="field-label" for={id}>{label}</label>
      <div class="copy-row">
        <input id={id} class="text-input" readOnly value={value} data-testid={testid} onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
        <button type="button" class={emphasis === 'primary' ? 'button-primary' : 'button-secondary'} data-testid={`copy-${testid}`} onClick={copy}>
          {state === 'copied' ? 'Copied' : buttonLabel}
        </button>
      </div>
      <p class="field-hint" role="status">{copyStatus(state, 'link')}</p>
    </div>
  );
}

// The edit link is shown only this far before it is masked, so a screenshot or a glance over the
// shoulder doesn't give away the secret part.
const SHOWN_CHARS = 20;

/** A private edit link in a distinct warning box: masked until revealed, with its own Copy button. */
export function SecretLinkField({ value, testid }: { value: string; testid: string }) {
  const [revealed, setRevealed] = useState(false);
  const id = `${testid}-input`;
  const { state, copy } = useCopy(value, () => {
    setRevealed(true);
    requestAnimationFrame(() => selectInput(id));
  });
  const masked = `${value.slice(0, SHOWN_CHARS)}${'•'.repeat(8)}`;

  return (
    <div class="secret-box" data-testid={`${testid}-box`}>
      <p class="secret-title" id={`${testid}-title`}>
        <svg class="secret-lock" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M7 10V7a5 5 0 0 1 10 0v3h1.5a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5zm2 0h6V7a3 3 0 0 0-6 0zm3 4a1.5 1.5 0 0 0-.75 2.8V19h1.5v-2.2A1.5 1.5 0 0 0 12 14z" fill="currentColor" />
        </svg>
        Secret edit link — don’t share
      </p>
      <p class="secret-help">Anyone with this link can change or withdraw your arms. Keep it to yourself; send people the share link instead.</p>
      {revealed ? (
        <input id={id} class="text-input secret-value" readOnly value={value} data-testid={testid} aria-labelledby={`${testid}-title`} onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
      ) : (
        <p class="secret-value secret-masked" data-testid={testid} aria-label="Edit link, hidden">{masked}</p>
      )}
      <div class="secret-actions">
        <button type="button" class="button-secondary" data-testid={`copy-${testid}`} onClick={copy}>
          {state === 'copied' ? 'Copied' : 'Copy edit link'}
        </button>
        <button type="button" class="button-secondary" data-testid={`reveal-${testid}`} aria-pressed={revealed ? 'true' : 'false'} onClick={() => setRevealed((v) => !v)}>
          {revealed ? 'Hide' : 'Show'}
        </button>
      </div>
      <p class="field-hint" role="status">{copyStatus(state, 'edit link')}</p>
    </div>
  );
}
