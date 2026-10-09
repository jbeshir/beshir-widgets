// The printable nametag sheet (#/print/…): per tag the shield in its chosen shape, the display name
// large and the blazon small, eight to an A4 page with cut lines. On screen it is a preview of the
// paper (always light, whatever the theme); in print only the pages are drawn.

import { useEffect, useRef, useState } from 'preact/hooks';
import { collectNametags, paginate, type NametagSheet } from '../lib/nametags';
import * as store from '../store';
import { Shield } from './Shield';

interface Props {
  /** Entries to print; none means every entry remembered on this device. */
  ids: string[];
  hatching: boolean;
  onBack: () => void;
}

/** Names longer than this are set smaller so they still fit beside the shield. */
const LONG_NAME = 20;

type State = { status: 'loading' } | { status: 'ready'; sheet: NametagSheet };

async function loadTag(id: string) {
  const r = await store.getEntry(id);
  return r.ok ? { id, displayName: r.entry.displayName, blazon: r.entry.blazon, arms: { design: r.entry.design, shape: r.entry.shape } } : null;
}

export function PrintView({ ids, hatching, onBack }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const heading = useRef<HTMLHeadingElement>(null);
  const key = ids.join(',');

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    collectNametags(ids, store.deviceArms(), loadTag).then((sheet) => {
      if (live) setState({ status: 'ready', sheet });
    });
    return () => { live = false; };
  }, [key]);

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  const sheet = state.status === 'ready' ? state.sheet : null;
  const pages = sheet ? paginate(sheet.tags) : [];
  const count = sheet?.tags.length ?? 0;

  return (
    <main class="print-view" data-testid="print-view">
      <div class="print-toolbar">
        <h1 tabIndex={-1} ref={heading} data-testid="print-heading">Print nametags</h1>
        <p class="print-count" role="status" data-testid="print-count">
          {state.status === 'loading' && 'Getting your arms…'}
          {sheet && (count
            ? `${count} nametag${count === 1 ? '' : 's'} on ${pages.length} A4 page${pages.length === 1 ? '' : 's'}. Print on plain paper, then cut along the dashed lines.`
            : 'There is nothing to print yet.')}
        </p>
        {sheet && sheet.missing.length > 0 && (
          <p class="print-missing" data-testid="print-missing" role="note">
            {sheet.missing.length === 1 ? 'One entry' : `${sheet.missing.length} entries`} couldn’t be loaded and {sheet.missing.length === 1 ? 'is' : 'are'} left out.
          </p>
        )}
        <div class="print-actions">
          <button type="button" class="button-primary" data-testid="print-now" disabled={count === 0} onClick={() => window.print()}>Print</button>
          <button type="button" class="button-secondary" data-testid="print-back" onClick={onBack}>Back</button>
        </div>
      </div>
      <div class="print-pages" aria-busy={state.status === 'loading' ? 'true' : undefined}>
        {pages.map((page, p) => (
          <section class="print-page" key={p} aria-label={`Page ${p + 1} of ${pages.length}`} data-testid="print-page">
            {page.map((t) => (
              <article class="nametag" key={t.id} data-testid="nametag">
                <Shield design={t.arms.design} shape={t.arms.shape} hatching={hatching} class="nametag-shield" />
                <div class="nametag-text">
                  <h2 class={`nametag-name${t.displayName.length > LONG_NAME ? ' nametag-name-long' : ''}`}>{t.displayName}</h2>
                  <p class="nametag-blazon">{t.blazon}</p>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
