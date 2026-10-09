// Public entry view for #/a/<id>.

import { useEffect, useState } from 'preact/hooks';
import type { NormDesign } from '../../lib/heraldry';
import type { ListStatus } from '../../lib/widgetState';
import * as store from '../../store';
import { EntryBody } from './EntryDetail';

interface Props {
  id: string;
  onStatus: (s: ListStatus) => void;
  hatching: boolean;
  onLoad: (design: NormDesign) => void;
}

export function EntryPage({ id, onStatus, hatching, onLoad }: Props) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ok'; entry: store.ArmsEntry; sample: boolean } | { status: 'error'; failure: store.Failure }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    store.getEntry(id).then((r) => {
      if (live) setState(r.ok ? { status: 'ok', entry: r.entry, sample: r.sample } : { status: 'error', failure: r });
    });
    return () => { live = false; };
  }, [id, attempt]);

  useEffect(() => onStatus(state.status === 'ok' ? 'populated' : state.status), [state.status]);

  return (
    <div class="entry-page" data-testid="entry-page">
      <a class="text-link back-link" href="#/" data-testid="back-to-registry">← Back to the registry</a>
      {state.status === 'loading' && <p class="panel-message" aria-busy="true" role="status">Loading these arms…</p>}
      {state.status === 'error' && (
        <div class="panel-message panel-error" role="alert" data-testid="entry-error">
          <p>
            <strong>{state.failure.status === 404 ? "These arms aren't in the registry." : "These arms couldn't be loaded."}</strong>{' '}
            {state.failure.status === 404 ? 'They may have been withdrawn, or the link is mistyped.' : state.failure.message}
          </p>
          {state.failure.status !== 404 && <button type="button" class="button-secondary" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
        </div>
      )}
      {state.status === 'ok' && <EntryBody entry={state.entry} sample={state.sample} hatching={hatching} onLoad={onLoad} />}
    </div>
  );
}
