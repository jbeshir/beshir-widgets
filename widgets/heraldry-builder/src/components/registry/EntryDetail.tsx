// Entry detail: big shield, blazon, gloss, name, public contact (plain text), share link and a
// "Load into builder" action. Shown as a sheet over the registry (card press) and inline for the
// public route #/a/<id>. Search results carry no contact, so it is fetched with store.getEntry.

import { useEffect, useState } from 'preact/hooks';
import { gloss, type NormDesign } from '../../lib/heraldry';
import { capabilityUrls } from '../../lib/route';
import * as store from '../../store';
import { CopyField } from '../CopyField';
import { Dialog } from '../overlay';
import { Shield } from '../Shield';

interface Summary {
  id: string;
  displayName: string;
  design: NormDesign;
  blazon: string;
}

interface BodyProps {
  entry: Summary;
  /** Fetch the public contact; sample entries come from the bundled registry. */
  sample: boolean;
  hatching: boolean;
  onLoad: (design: NormDesign) => void;
}

type ContactState = { status: 'loading' } | { status: 'ready'; contact: string | null } | { status: 'unavailable'; message: string };

export function EntryBody({ entry, sample, hatching, onLoad }: BodyProps) {
  const [contact, setContact] = useState<ContactState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setContact({ status: 'loading' });
    store.getEntry(entry.id, { sample }).then((r) => {
      if (!live) return;
      setContact(r.ok ? { status: 'ready', contact: r.entry.contact } : { status: 'unavailable', message: r.message });
    });
    return () => { live = false; };
  }, [entry.id, sample]);

  return (
    <div class="entry-detail">
      <div class="entry-shield">
        <Shield design={entry.design} hatching={hatching} size={160} />
      </div>
      <div class="entry-text">
        <h3 class="entry-name" data-testid="entry-name">{entry.displayName}</h3>
        <p class="blazon" data-testid="entry-blazon">{entry.blazon}</p>
        <p class="gloss" data-testid="entry-gloss">{gloss(entry.design)}</p>
        <p class="entry-contact" data-testid="entry-contact">
          <span class="entry-contact-label">Contact (public): </span>
          {contact.status === 'loading' && <span>Loading…</span>}
          {contact.status === 'ready' && (contact.contact ? <span>{contact.contact}</span> : <span class="muted">None given</span>)}
          {contact.status === 'unavailable' && <span class="muted">Not available ({contact.message})</span>}
        </p>
      </div>
      <CopyField label="Share link" value={capabilityUrls(entry.id, null).share} testid="entry-share-link" />
      <div class="dialog-actions entry-actions">
        <button type="button" class="button-primary" data-testid="load-into-builder" onClick={() => onLoad(entry.design)}>
          Load into builder
        </button>
      </div>
    </div>
  );
}

interface SheetProps extends BodyProps {
  onClose: () => void;
}

export function EntrySheet({ onClose, onLoad, ...rest }: SheetProps) {
  return (
    <Dialog title="Registered arms" layer="sheet" testid="entry-sheet" class="entry-sheet" onClose={onClose}>
      <EntryBody {...rest} onLoad={(d) => { onLoad(d); onClose(); }} />
    </Dialog>
  );
}
