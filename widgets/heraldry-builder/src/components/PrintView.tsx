// The printable nametag sheet (#/print/<id>): one entry's tag with the shield in its chosen shape,
// the display name large and the blazon small, on an A4 page with cut lines. By default the tag is
// repeated to fill the page; "One" prints it once. On screen it is a preview of the paper (always
// light, whatever the theme; two across from tablet width up, one across on phones with a note);
// in print only the page is drawn.

import { useEffect, useRef, useState } from 'preact/hooks';
import { TAGS_PER_PAGE, sheetTags, type Copies, type Nametag } from '../lib/nametags';
import * as store from '../store';
import { Shield } from './Shield';

interface Props {
  id: string;
  hatching: boolean;
  onBack: () => void;
}

/** Names longer than this are set smaller so they still fit beside the shield. */
const LONG_NAME = 20;

type State = { status: 'loading' } | { status: 'ready'; tag: Nametag } | { status: 'missing' };

async function loadTag(id: string): Promise<State> {
  const r = await store.getEntry(id);
  return r.ok
    ? { status: 'ready', tag: { displayName: r.entry.displayName, blazon: r.entry.blazon, arms: { design: r.entry.design, shape: r.entry.shape } } }
    : { status: 'missing' };
}

export function PrintView({ id, hatching, onBack }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [copies, setCopies] = useState<Copies>('fill');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    loadTag(id).then((loaded) => {
      if (live) setState(loaded);
    });
    return () => { live = false; };
  }, [id]);

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  const tags = state.status === 'ready' ? sheetTags(state.tag, copies) : [];
  const count = tags.length;

  return (
    <main class="print-view" data-testid="print-view">
      <div class="print-toolbar">
        <h1 tabIndex={-1} ref={heading} data-testid="print-heading">Print nametags</h1>
        <p class="print-count" role="status" data-testid="print-count">
          {state.status === 'loading' && 'Getting the arms…'}
          {state.status === 'ready' && `${count} nametag${count === 1 ? '' : 's'} on one A4 page. Print on plain paper, then cut along the dashed lines.`}
          {state.status === 'missing' && 'These arms couldn’t be loaded, so there is nothing to print. Go back and try again in a moment.'}
        </p>
        {state.status === 'ready' && (
          <fieldset class="print-copies" data-testid="print-copies">
            <legend>Copies</legend>
            <label class="print-copies-option">
              <input type="radio" name="print-copies" value="one" data-testid="print-copies-one" checked={copies === 'one'} onChange={() => setCopies('one')} />
              One
            </label>
            <label class="print-copies-option">
              <input type="radio" name="print-copies" value="fill" data-testid="print-copies-fill" checked={copies === 'fill'} onChange={() => setCopies('fill')} />
              Fill the page
            </label>
          </fieldset>
        )}
        {state.status === 'ready' && <p class="print-layout-note">On paper the tags go two across and four down, {TAGS_PER_PAGE} to a page.</p>}
        <div class="print-actions">
          <button type="button" class="button-primary" data-testid="print-now" disabled={count === 0} onClick={() => window.print()}>Print</button>
          <button type="button" class="button-secondary" data-testid="print-back" onClick={onBack}>Back</button>
        </div>
      </div>
      <div class="print-pages" aria-busy={state.status === 'loading' ? 'true' : undefined}>
        {count > 0 && (
          <section class="print-page" aria-label="Nametag page" data-testid="print-page">
            {tags.map((t, i) => (
              // Repeated copies of the tag are announced once.
              <article class="nametag" key={i} data-testid="nametag" aria-hidden={i === 0 ? undefined : 'true'}>
                <Shield design={t.arms.design} shape={t.arms.shape} hatching={hatching} class="nametag-shield" />
                <div class="nametag-text">
                  <h2 class={`nametag-name${t.displayName.length > LONG_NAME ? ' nametag-name-long' : ''}`}>{t.displayName}</h2>
                  <p class="nametag-blazon">{t.blazon}</p>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
