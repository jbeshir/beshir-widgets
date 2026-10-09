// "Your arms" tab: entries registered from this device (kept in localStorage by the store), each
// with a link to its owner view when the private edit link is saved here.

import { entryHash, ownerHash } from '../lib/route';
import type { DeviceArms } from '../store';

export function YourArmsPanel({ items, onBrowse }: { items: DeviceArms[]; onBrowse: () => void }) {
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
  return (
    <div>
      <p class="muted yours-note">Saved in this browser only. Clearing site data removes the private links.</p>
      <ul class="yours-list" data-testid="yours-list">
        {items.map((a) => (
          <li key={a.id} class="yours-item" data-testid="yours-item">
            <span class="yours-name">{a.displayName}</span>
            <span class="yours-blazon">{a.blazon}</span>
            <span class="yours-links">
              {a.secret && <a class="text-link" href={ownerHash(a.id, a.secret)}>Edit or withdraw</a>}
              <a class="text-link" href={entryHash(a.id)}>View</a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
