import { useMemo } from 'preact/hooks';
import type { Session } from '../types';
import { to12h, longDayLabel } from '../lib/time.js';
import { buildIcs } from '../lib/ics.js';

interface Props {
  sessions: Session[];
  conflicts: Set<string>;
  onRemove: (id: string) => void;
}

function downloadIcs(sessions: Session[]) {
  const text = buildIcs(sessions) as string;
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pennsic-plan-2026.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function MyPlan({ sessions, conflicts, onRemove }: Props) {
  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!map.has(s.day)) map.set(s.day, []);
      map.get(s.day)!.push(s);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([day, list]) => ({
      day,
      sessions: list.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
  }, [sessions]);

  const conflictCount = useMemo(() => conflicts.size, [conflicts]);

  if (sessions.length === 0) {
    return (
      <div class="plan-view">
        <div class="empty-state">
          <h3>Your plan is empty</h3>
          <p>Browse the Timetable and click any session to add it to your plan.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="plan-view">
      <div class="plan-summary">
        <button
          class="plan-export-btn"
          onClick={() => downloadIcs(sessions)}
          aria-label="Export plan to calendar file"
        >
          Export to Calendar (.ics)
        </button>
        <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} planned
        </span>
      </div>

      {conflictCount > 0 && (
        <div class="conflict-banner" role="alert">
          ⚠ {conflictCount} session{conflictCount !== 1 ? 's' : ''} have time conflicts
        </div>
      )}

      {byDay.map(({ day, sessions: list }) => (
        <div key={day} class="plan-day-group">
          <h3 class="plan-day-heading">{longDayLabel(day)}</h3>
          {list.map((s) => (
            <div key={s.id} class={`plan-item${conflicts.has(s.id) ? ' conflict' : ''}`}>
              <div class="plan-item-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                  <div class="plan-item-title">{s.title}</div>
                  {conflicts.has(s.id) && (
                    <span class="plan-item-conflict-badge">⚠ conflict</span>
                  )}
                </div>
                <div class="plan-item-meta">
                  <span>{to12h(s.startTime)}–{to12h(s.endTime)}</span>
                  {s.location && <span>· {s.location}</span>}
                  {s.instructor && <span>· {s.instructor}</span>}
                  {s.hasFee && <span>· <strong>$</strong></span>}
                  {s.adultOnly && <span>· 18+</span>}
                </div>
              </div>
              <button
                class="plan-remove-btn"
                onClick={() => onRemove(s.id)}
                aria-label={`Remove ${s.title} from plan`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
