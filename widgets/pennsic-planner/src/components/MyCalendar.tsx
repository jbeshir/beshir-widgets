import { useMemo } from 'preact/hooks';
import type { Session } from '../types';
import { hmToMinutes } from '../lib/time.js';
import { sessionEndMin } from '../lib/layout.js';
import { downloadIcs } from '../lib/download.js';
import { DayTimeGrid } from './DayTimeGrid';

interface Props {
  sessions: Session[];
  conflicts: Set<string>;
  trackColors: Record<string, { l: string; d: string }>;
  onOpenDetail: (id: string) => void;
}

export function MyCalendar({ sessions, conflicts, trackColors, onOpenDetail }: Props) {
  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!map.has(s.day)) map.set(s.day, []);
      map.get(s.day)!.push(s);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, list]) => ({ day, sessions: list }));
  }, [sessions]);

  const { rangeStartMin, rangeEndMin } = useMemo(() => {
    if (sessions.length === 0) return { rangeStartMin: 540, rangeEndMin: 1080 };
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const s of sessions) {
      const start = hmToMinutes(s.startTime);
      const end = sessionEndMin(s);
      if (Number.isFinite(start) && start < minStart) minStart = start;
      if (Number.isFinite(end) && end > maxEnd) maxEnd = end;
    }
    return {
      rangeStartMin: Math.floor(minStart / 60) * 60,
      rangeEndMin: Math.ceil(maxEnd / 60) * 60,
    };
  }, [sessions]);

  const pxPerMin = 0.9;
  const conflictCount = conflicts.size;

  if (sessions.length === 0) {
    return (
      <div class="cal-view">
        <div class="empty-state">
          <p>No sessions in your plan yet — browse the Timetable and click a class's ☆ to add it.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="cal-view">
      <div class="cal-header">
        <span class="cal-header-count">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} planned
        </span>
        {conflictCount > 0 && (
          <span class="cal-header-conflicts">
            ⚠ {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
          </span>
        )}
        <button
          class="plan-export-btn"
          onClick={() => downloadIcs(sessions)}
          aria-label="Export plan to calendar file"
        >
          Export to Calendar (.ics)
        </button>
      </div>
      <div class="cal-grid">
        {byDay.map(({ day, sessions: daySessions }) => (
          <DayTimeGrid
            key={day}
            day={day}
            sessions={daySessions}
            rangeStartMin={rangeStartMin}
            rangeEndMin={rangeEndMin}
            pxPerMin={pxPerMin}
            conflicts={conflicts}
            trackColors={trackColors}
            onOpenDetail={onOpenDetail}
            showHeader={true}
          />
        ))}
      </div>
    </div>
  );
}
