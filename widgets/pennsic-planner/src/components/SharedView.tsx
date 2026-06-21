import type { Session } from '../types';
import { MyCalendar } from './MyCalendar';

interface Props {
  name: string;
  eventName: string;
  sessions: Session[];
  conflicts: Set<string>;
  trackColors: Record<string, { l: string; d: string }>;
  onOpenDetail: (id: string) => void;
  onBrowse: () => void;
  onDuplicate: () => void;
  busy: boolean;
}

// The read-only share view: just the shared plan as the My Calendar time-grid, with a secondary
// invitation to browse/build your own and a deliberately sidelined duplicate-to-edit link. No
// timetable browser, tabs, or filters.
export function SharedView({
  name,
  eventName,
  sessions,
  conflicts,
  trackColors,
  onOpenDetail,
  onBrowse,
  onDuplicate,
  busy,
}: Props) {
  return (
    <div class="shared-view">
      <div class="shared-view-head">
        <span class="shared-view-eyebrow">Shared calendar</span>
        <h2 class="shared-view-title">{name}</h2>
      </div>

      {sessions.length === 0 ? (
        <div class="empty-state shared-view-empty">
          <p>This shared calendar doesn’t have any sessions yet.</p>
        </div>
      ) : (
        <MyCalendar
          sessions={sessions}
          conflicts={conflicts}
          trackColors={trackColors}
          onOpenDetail={onOpenDetail}
        />
      )}

      <div class="shared-view-browse">
        <button class="shared-view-browse-link" onClick={onBrowse}>
          Browse the full {eventName} schedule and build your own calendar →
        </button>
      </div>

      <div class="shared-view-footer">
        <button class="shared-view-dup-link" onClick={onDuplicate} disabled={busy}>
          {busy ? 'Copying…' : 'Duplicate this calendar to edit your own copy'}
        </button>
      </div>
    </div>
  );
}
