// "Your arms" tab: entries registered from this device (kept in localStorage by the store), each
// with a link to its owner view when the private edit link is saved here.

import { useState } from 'preact/hooks';
import { entryHash, ownerHash, printHash } from '../lib/route';
import type { DeviceArms } from '../store';
import { Shield } from './Shield';

export function YourArmsPanel({ items, onBrowse }: { items: DeviceArms[]; onBrowse: () => void }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  if (!items.length) {
    return (
      <div class="panel-message" data-testid="yours-empty">
        <p><strong>Nothing registered from this device yet.</strong></p>
        <p>
          When you register arms, they are listed here with the private link that lets you edit or withdraw them. The list lives only in
          this browser, so also save the private link somewhere safe.
        </p>
        <button type="button" class="button-secondary" onClick={onBrowse}>Browse the registry</button>
      </div>
    );
  }
  const toggle = (id: string) => setPicked((cur) => (cur.has(id) ? new Set([...cur].filter((x) => x !== id)) : new Set(cur).add(id)));
  // In list order, and only entries still on the device.
  const printed = items.filter((a) => picked.has(a.id)).map((a) => a.id);
  return (
    <div>
      <p class="muted yours-note">Saved in this browser only. Clearing site data removes the private links.</p>
      <div class="yours-print">
        <a class="button-secondary" href={printHash(printed)} data-testid="print-nametags">
          {printed.length ? `Print ${printed.length} selected nametag${printed.length === 1 ? '' : 's'}` : 'Print nametags for all'}
        </a>
        <span class="muted yours-print-hint">Tick entries to print only some.</span>
      </div>
      <ul class="yours-list" data-testid="yours-list">
        {items.map((a) => (
          <li key={a.id} class={`yours-item${a.shield ? ' has-shield' : ''}`} data-testid="yours-item">
            <label class="yours-pick">
              <input type="checkbox" data-testid="yours-pick" checked={picked.has(a.id)} onChange={() => toggle(a.id)} />
              <span class="sr-only">Include {a.displayName} in the nametags</span>
            </label>
            {a.shield && <Shield design={a.shield.design} shape={a.shield.shape} size={40} label={null} class="yours-shield" />}
            <span class="yours-name">{a.displayName}</span>
            <span class="yours-blazon">{a.blazon}</span>
            <span class="yours-links">
              {a.secret && <a class="text-link" href={ownerHash(a.id, a.secret)}>Edit or withdraw</a>}
              <a class="text-link" href={entryHash(a.id)}>View</a>
              <a class="text-link" href={printHash([a.id])} data-testid="print-one">Print nametag</a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
