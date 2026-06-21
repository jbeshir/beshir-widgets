import type { JSX } from 'preact';
import type { Session, PlacedSession } from '../types';
import { assignLanes } from '../lib/layout.js';
import { to12h, shortDayLabel } from '../lib/time.js';

const BLOCK_VERT_PAD = 8;
const TITLE_LINE_H = 14;
const TIME_H = 14;
const LOC_H = 14;

function toCompactHour(minOfDay: number): string {
  const total = ((Math.round(minOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12} ${ampm}`;
}

interface Props {
  day: string;
  sessions: Session[];
  rangeStartMin: number;
  rangeEndMin: number;
  pxPerMin: number;
  conflicts: Set<string>;
  trackColors: Record<string, { l: string; d: string }>;
  onOpenDetail: (id: string) => void;
  showHeader?: boolean;
}

export function DayTimeGrid({ day, sessions, rangeStartMin, rangeEndMin, pxPerMin, conflicts, trackColors, onOpenDetail, showHeader = true }: Props) {
  const bodyHeight = (rangeEndMin - rangeStartMin) * pxPerMin;

  const hours: number[] = [];
  for (let h = rangeStartMin; h <= rangeEndMin; h += 60) {
    hours.push(h);
  }

  const placed = assignLanes(sessions) as PlacedSession[];

  return (
    <div class="dtg-col">
      {showHeader && <div class="dtg-col-header">{shortDayLabel(day)}</div>}
      <div class="dtg-scale">
        <div class="dtg-gutter" style={{ height: bodyHeight }}>
          {hours.map((h, i) => (
            <div
              key={h}
              class="dtg-hour-label"
              style={{
                top: (h - rangeStartMin) * pxPerMin,
                transform: i === 0 ? 'none' : undefined,
              }}
            >
              {toCompactHour(h)}
            </div>
          ))}
        </div>
        <div class="dtg-body" style={{ height: bodyHeight }}>
          {hours.map((h) => (
            <div
              key={h}
              class="dtg-hourline"
              style={{ top: (h - rangeStartMin) * pxPerMin }}
            />
          ))}
          {placed.map(({ session: s, startMin, endMin, lane, lanes }) => {
            const top = (startMin - rangeStartMin) * pxPerMin;
            const height = Math.max((endMin - startMin) * pxPerMin, 30);
            const tc = trackColors[s.track] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' };
            const blockStyle: JSX.CSSProperties & Record<string, unknown> = {
              top,
              height,
              left: `${(lane / lanes) * 100}%`,
              width: `${(1 / lanes) * 100}%`,
              '--tc-l': tc.l,
              '--tc-d': tc.d,
            };
            const reservedH = BLOCK_VERT_PAD + TIME_H + (s.location ? LOC_H : 0);
            const titleLines = Math.max(1, Math.floor((height - reservedH) / TITLE_LINE_H));
            const blockClass = `dtg-block${conflicts.has(s.id) ? ' conflict' : ''}`;
            const ariaLabel = `${s.title}, ${to12h(s.startTime)}–${to12h(s.endTime)}${s.location ? ', ' + s.location : ''}`;
            return (
              <div
                key={s.id}
                class={blockClass}
                style={blockStyle}
                role="button"
                tabIndex={0}
                aria-label={ariaLabel}
                title={`${s.title}\n${to12h(s.startTime)}–${to12h(s.endTime)}${s.location ? '\n' + s.location : ''}`}
                onClick={() => onOpenDetail(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenDetail(s.id);
                  }
                }}
              >
                <div class="dtg-block-title" style={{ WebkitLineClamp: titleLines }}>{s.title}</div>
                <div class="dtg-block-time">{to12h(s.startTime)}–{to12h(s.endTime)}</div>
                {s.location && <div class="dtg-block-loc">{s.location}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
