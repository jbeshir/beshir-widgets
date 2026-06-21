import { useMemo } from 'preact/hooks';
import type { Session } from '../types';
import { hmToMinutes, to12h } from '../lib/time.js';
import { SessionBlock } from './SessionBlock';

interface Props {
  sessions: Session[];
  planIds: string[];
  onToggle: (id: string) => void;
  onOpenDetail: (id: string) => void;
  trackColors: Record<string, { l: string; d: string }>;
  selectedDay: string;
  conflicts?: Set<string>;
  readOnly?: boolean;
}

export function Timetable({ sessions, planIds, onToggle, onOpenDetail, trackColors, selectedDay, conflicts, readOnly }: Props) {
  const planSet = useMemo(() => new Set(planIds), [planIds]);

  const slots = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const existing = map.get(s.startTime);
      if (existing) existing.push(s);
      else map.set(s.startTime, [s]);
    }
    return [...map.entries()]
      .map(([time, list]) => ({
        time,
        minutes: hmToMinutes(time),
        sessions: [...list].sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.minutes - b.minutes);
  }, [sessions]);

  return (
    <div
      class="schedule-panel"
      id="schedule-panel"
      role="tabpanel"
      aria-labelledby={`day-tab-${selectedDay}`}
      tabIndex={0}
    >
      {sessions.length === 0 ? (
        <div class="empty-state">
          <h3>No sessions match</h3>
          <p>Try adjusting your filters, or select a different day.</p>
        </div>
      ) : (
        slots.map(({ time, sessions: slotSessions }) => (
          <section class="slot" key={time}>
            <h3 class="slot-header">
              {to12h(time)}
              <span class="slot-count">· {slotSessions.length} {slotSessions.length === 1 ? 'class' : 'classes'}</span>
            </h3>
            <div class="slot-sessions">
              {slotSessions.map((s) => (
                <SessionBlock
                  key={s.id}
                  session={s}
                  inPlan={planSet.has(s.id)}
                  trackColor={trackColors[s.track] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' }}
                  onToggle={() => onToggle(s.id)}
                  onOpenDetail={() => onOpenDetail(s.id)}
                  conflict={conflicts?.has(s.id)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
