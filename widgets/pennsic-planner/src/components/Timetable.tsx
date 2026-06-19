import { useMemo, useRef, useEffect } from 'preact/hooks';
import type { Session, PlacedSession } from '../types';
import { assignLanes } from '../lib/layout.js';
import { SessionBlock } from './SessionBlock';

const PX_PER_MIN = 1.2;
const MIN_LANE_WIDTH = 160;
const GUTTER_WIDTH = 54;
const LEAD_PAD_MIN = 15;

interface Props {
  sessions: Session[];
  planIds: string[];
  onToggle: (id: string) => void;
  trackColors: Record<string, { l: string; d: string }>;
  selectedDay: string;
}

function getHourLabels(dayStart: number, dayEnd: number): { hour: number; label: string }[] {
  const labels: { hour: number; label: string }[] = [];
  const startHour = Math.floor(dayStart / 60);
  const endHour = Math.ceil(dayEnd / 60);
  for (let h = startHour; h <= endHour; h++) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    labels.push({ hour: h, label: `${h12} ${ampm}` });
  }
  return labels;
}

export function Timetable({ sessions, planIds, onToggle, trackColors, selectedDay }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const placed = useMemo(
    () => assignLanes(sessions) as PlacedSession[],
    [sessions]
  );

  const { dayStart, dayEnd, totalHeight, maxLanes, laneAreaMinWidth } = useMemo(() => {
    if (sessions.length === 0) {
      const s = 8 * 60;
      return { dayStart: s, dayEnd: s + 60 * 15, totalHeight: 60 * 15 * PX_PER_MIN, maxLanes: 1, laneAreaMinWidth: 300 };
    }
    let minStart = Infinity;
    let maxEnd = -Infinity;
    let mxLanes = 1;
    for (const p of placed) {
      if (p.startMin < minStart) minStart = p.startMin;
      if (p.endMin > maxEnd) maxEnd = p.endMin;
      if (p.lanes > mxLanes) mxLanes = p.lanes;
    }
    // Floor to nearest 15 min with small lead
    const dStart = Math.floor((minStart - LEAD_PAD_MIN) / 15) * 15;
    // Round up to nearest hour (with trailing padding after last session)
    const dEnd = Math.ceil((maxEnd + 30) / 60) * 60;
    return {
      dayStart: dStart,
      dayEnd: dEnd,
      totalHeight: (dEnd - dStart) * PX_PER_MIN,
      maxLanes: mxLanes,
      laneAreaMinWidth: Math.max(300, mxLanes * MIN_LANE_WIDTH),
    };
  }, [sessions, placed]);

  const hourLabels = useMemo(() => getHourLabels(dayStart, dayEnd), [dayStart, dayEnd]);

  // Reset scroll to top on day change so first session is visible
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }, [selectedDay]);

  if (sessions.length === 0) {
    return (
      <div class="empty-state">
        <h3>No sessions match</h3>
        <p>Try adjusting your filters, or select a different day.</p>
      </div>
    );
  }

  return (
    <div class="timetable-wrap" ref={wrapRef} role="region" aria-label="Session timetable">
      <div class="timetable-inner" style={{ height: `${totalHeight + 24}px` }}>
        {/* Sticky time gutter */}
        <div
          class="time-gutter"
          style={{ width: `${GUTTER_WIDTH}px`, height: `${totalHeight + 24}px` }}
          aria-hidden="true"
        >
          {hourLabels.map(({ hour, label }) => {
            const topPx = (hour * 60 - dayStart) * PX_PER_MIN;
            return (
              <span key={hour} class="hour-label" style={{ top: `${topPx}px` }}>
                {label}
              </span>
            );
          })}
        </div>

        {/* Sessions area */}
        <div
          class="sessions-area"
          style={{ minWidth: `${laneAreaMinWidth}px`, height: `${totalHeight + 24}px` }}
        >
          {/* Hour lines */}
          {hourLabels.map(({ hour }) => {
            const topPx = (hour * 60 - dayStart) * PX_PER_MIN;
            return (
              <div key={hour} class="hour-line" style={{ top: `${topPx}px` }} aria-hidden="true" />
            );
          })}

          {/* Session blocks */}
          {placed.map((p) => (
            <SessionBlock
              key={p.session.id}
              placed={p}
              dayStart={dayStart}
              pxPerMin={PX_PER_MIN}
              inPlan={planIds.includes(p.session.id)}
              trackColor={trackColors[p.session.track] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' }}
              onToggle={() => onToggle(p.session.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
