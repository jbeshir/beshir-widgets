// The blazon (display serif) with its plain-English gloss and a copy button.

import { useEffect, useState } from 'preact/hooks';
import { blazon, gloss, type NormDesign } from '../../lib/heraldry';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function BlazonPanel({ design }: { design: NormDesign }) {
  const text = blazon(design);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => setCopied('idle'), [text]);

  return (
    <section class="blazon-panel" aria-labelledby="blazon-title">
      <h2 id="blazon-title" class="section-label">Blazon</h2>
      <p class="blazon" data-testid="blazon" lang="en">{text}</p>
      <p class="gloss" data-testid="gloss">{gloss(design)}</p>
      <div class="blazon-actions">
        <button
          type="button"
          class="button-secondary button-small"
          data-testid="copy-blazon"
          onClick={async () => setCopied((await copyText(text)) ? 'copied' : 'failed')}
        >
          {copied === 'copied' ? 'Copied' : 'Copy blazon'}
        </button>
        <span class="copy-status" role="status" aria-live="polite">
          {copied === 'copied' ? 'Blazon copied to the clipboard.' : copied === 'failed' ? 'Copy failed — select the text instead.' : ''}
        </span>
      </div>
    </section>
  );
}
