// Read-only link field with a Copy button (share link, private edit link, entry link).

import { useState } from 'preact/hooks';

interface Props {
  label: string;
  value: string;
  testid: string;
  hint?: string;
}

export function CopyField({ label, value, testid, hint }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const id = `${testid}-input`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Clipboard unavailable (insecure context): select the text so Ctrl/Cmd+C works.
      (document.getElementById(id) as HTMLInputElement | null)?.select();
      setState('failed');
    }
  };

  return (
    <div class="copy-field">
      <label class="field-label" for={id}>{label}</label>
      <div class="copy-row">
        <input id={id} class="text-input" readOnly value={value} data-testid={testid} onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
        <button type="button" class="button-secondary" data-testid={`copy-${testid}`} onClick={copy}>
          {state === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      {hint && <p class="field-hint">{hint}</p>}
      <p class="field-hint" role="status">{state === 'copied' ? 'Copied to the clipboard.' : state === 'failed' ? 'Couldn’t copy automatically — the link is selected, press Ctrl+C.' : ''}</p>
    </div>
  );
}
