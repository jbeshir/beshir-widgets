// Entry detail: big shield, blazon, gloss, name, public Discord username (plain text, with a copy
// button), share link, a "Load into builder" action and the "Lost your link? / Withdraw" entry
// point. Shown as a sheet over the registry (card press) and inline for the public route #/a/<id>.
// Search results carry no contact, so it is fetched with store.getEntry.

import type { Ref } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { gloss, type Contact, type FieldShape, type NormDesign, type ShapedDesign } from '../../lib/heraldry';
import { RECOVER_HASH, printHash, shareUrl } from '../../lib/route';
import * as store from '../../store';
import { CopyField, useCopy } from '../CopyField';
import { Dialog } from '../overlay';
import { SavePicture } from '../SavePicture';
import { Shield } from '../Shield';

interface Summary {
  id: string;
  displayName: string;
  design: NormDesign;
  shape: FieldShape;
  blazon: string;
}

interface BodyProps {
  entry: Summary;
  /** Fetch the public contact; sample entries come from the bundled registry. */
  sample: boolean;
  hatching: boolean;
  /** Open the entry's design, in its shape, in the builder. */
  onLoad: (arms: ShapedDesign) => void;
  /** Whether the Load / Print buttons sit in the body (a page) or are left to the caller (a sheet keeps them in its footer). */
  showActions: boolean;
  /** Receives the entry's name heading, so a page that shows the entry can focus it; none in a sheet (the dialog takes focus). */
  nameRef: Ref<HTMLHeadingElement> | null;
}

type ContactState = { status: 'loading' } | { status: 'ready'; contact: Contact } | { status: 'unavailable'; message: string };

export function EntryBody({ entry, sample, hatching, onLoad, showActions, nameRef }: BodyProps) {
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
        <Shield design={entry.design} shape={entry.shape} hatching={hatching} size={160} />
      </div>
      <div class="entry-text">
        <h3 class="entry-name" tabIndex={nameRef ? -1 : undefined} ref={nameRef ?? undefined} data-testid="entry-name">{entry.displayName}</h3>
        <p class="blazon" data-testid="entry-blazon">{entry.blazon}</p>
        <p class="gloss" data-testid="entry-gloss">{gloss(entry.design)}</p>
        <p class="entry-contact" data-testid="entry-contact">
          <span class="entry-contact-label">Discord (public): </span>
          {contact.status === 'loading' && <span>Loading…</span>}
          {contact.status === 'ready' && (contact.contact.discord ? <DiscordHandle handle={contact.contact.discord} /> : <span class="muted">None given</span>)}
          {contact.status === 'unavailable' && <span class="muted">Not available ({contact.message})</span>}
        </p>
      </div>
      <CopyField label="Share link" value={shareUrl(entry.id)} testid="entry-share-link" buttonLabel="Copy" emphasis="secondary" />
      {showActions && <EntryActions entry={entry} onLoad={onLoad} />}
      <a class="text-link entry-recover" href={RECOVER_HASH} data-testid="entry-recover-link">Your arms? Lost your link? / Withdraw my registration</a>
      <SavePicture design={entry.design} shape={entry.shape} hatching={hatching} displayName={entry.displayName} />
    </div>
  );
}

function EntryActions({ entry, onLoad }: { entry: Summary; onLoad: (arms: ShapedDesign) => void }) {
  return (
    <div class="dialog-actions entry-actions">
      <button type="button" class="button-primary" data-testid="load-into-builder" onClick={() => onLoad({ design: entry.design, shape: entry.shape })}>
        Load into builder
      </button>
      <a class="button-secondary" href={printHash([entry.id])} data-testid="print-nametag">Print nametag</a>
    </div>
  );
}

/** A Discord username as plain text (never a link) with a Copy button. */
function DiscordHandle({ handle }: { handle: string }) {
  const { state, copy } = useCopy(handle, () => {});
  return (
    <span class="contact-row">
      <span data-testid="entry-discord">{handle}</span>
      <button type="button" class="button-secondary button-small" data-testid="copy-entry-discord" aria-label={`Copy Discord username ${handle}`} onClick={copy}>
        {state === 'copied' ? 'Copied' : 'Copy'}
      </button>
      <span class="sr-only" role="status">{state === 'copied' ? 'Copied to the clipboard.' : state === 'failed' ? 'Couldn’t copy automatically.' : ''}</span>
    </span>
  );
}

interface SheetProps extends Omit<BodyProps, 'nameRef' | 'showActions'> {
  onClose: () => void;
}

export function EntrySheet({ onClose, onLoad, ...rest }: SheetProps) {
  const loadAndClose = (arms: ShapedDesign) => {
    onLoad(arms);
    onClose();
  };
  return (
    <Dialog
      title="Registered arms"
      layer="sheet"
      testid="entry-sheet"
      class="entry-sheet"
      onClose={onClose}
      footer={<EntryActions entry={rest.entry} onLoad={loadAndClose} />}
    >
      <EntryBody {...rest} nameRef={null} showActions={false} onLoad={loadAndClose} />
    </Dialog>
  );
}
