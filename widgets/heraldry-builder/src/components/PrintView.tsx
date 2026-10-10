// The printable nametag sheet (#/print/…): per tag the shield in its chosen shape, the display name
// large and the blazon small, eight to an A4 page with cut lines. By default each tag is repeated to
// fill the sheet; "1 of each" prints every entry once. On screen it is a preview of the paper (always
// light, whatever the theme; two across from tablet width up, one across on phones with a note);
// in print only the pages are drawn.

import { useEffect, useRef, useState } from 'preact/hooks';
import { TAGS_PER_PAGE, collectNametags, paginate, sheetTags, type Copies, type NametagSheet } from '../lib/nametags';
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
  const [copies, setCopies] = useState<Copies>('fill');
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
  const entries = sheet?.tags.length ?? 0;
  const tags = sheet ? sheetTags(sheet.tags, copies) : [];
  const pages = paginate(tags);
  const count = tags.length;

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
        {entries > 0 && (
          <fieldset class="print-copies" data-testid="print-copies">
            <legend>Copies</legend>
            <label class="print-copies-option">
              <input type="radio" name="print-copies" value="one" data-testid="print-copies-one" checked={copies === 'one'} onChange={() => setCopies('one')} />
              1 of each
            </label>
            <label class="print-copies-option">
              <input type="radio" name="print-copies" value="fill" data-testid="print-copies-fill" checked={copies === 'fill'} onChange={() => setCopies('fill')} />
              Fill the sheet
            </label>
          </fieldset>
        )}
        <p class="print-layout-note">On paper they print two across and four down, {TAGS_PER_PAGE} to a page.</p>
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
            {page.map((t, i) => (
              // Repeated copies of a tag are announced once.
              <article class="nametag" key={`${t.id}-${i}`} data-testid="nametag" aria-hidden={tags.indexOf(t) === p * TAGS_PER_PAGE + i ? undefined : 'true'}>
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
