import { useMemo } from 'preact/hooks';
import type { Session } from '../types';
import { hmToMinutes, shortDayLabel } from '../lib/time.js';
import { sessionEndMin } from '../lib/layout.js';
import { DayTimeGrid } from './DayTimeGrid';

interface Props {
  day: string;
  sessions: Session[];
  conflicts: Set<string>;
  trackColors: Record<string, { l: string; d: string }>;
  onOpenDetail: (id: string) => void;
  onOpenCalendar: () => void;
}

export function PlanSidebar({ day, sessions, conflicts, trackColors, onOpenDetail, onOpenCalendar }: Props) {
  const hasConflicts = useMemo(
    () => sessions.some((s) => conflicts.has(s.id)),
    [sessions, conflicts]
  );

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

  const pxPerMin = 0.8;

  return (
    <aside class="plan-sidebar" aria-label="Your plan for the selected day">
      <div class="plan-sidebar-head">
        <span class="plan-sidebar-title">Your plan · {shortDayLabel(day)}</span>
        <span class="plan-sidebar-count">{sessions.length} pick{sessions.length !== 1 ? 's' : ''}</span>
        {hasConflicts && <span class="plan-sidebar-conflict">⚠ overlaps</span>}
      </div>
      {sessions.length === 0 ? (
        <div class="plan-sidebar-empty">
          No picks for {shortDayLabel(day)} yet — click a class's ☆ to add it.
        </div>
      ) : (
        <DayTimeGrid
          day={day}
          sessions={sessions}
          rangeStartMin={rangeStartMin}
          rangeEndMin={rangeEndMin}
          pxPerMin={pxPerMin}
          conflicts={conflicts}
          trackColors={trackColors}
          onOpenDetail={onOpenDetail}
          showHeader={false}
        />
      )}
      <div class="plan-sidebar-footer">
        <button class="plan-sidebar-link" onClick={onOpenCalendar}>
          Open My Calendar →
        </button>
      </div>
    </aside>
  );
}
