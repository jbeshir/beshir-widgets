import { useRef } from 'preact/hooks';
import { shortDayLabel } from '../lib/time.js';

interface Props {
  days: string[];
  dayCounts: Record<string, number>;
  selected: string;
  onChange: (day: string) => void;
}

export function DayPicker({ days, dayCounts, selected, onChange }: Props) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const idx = days.indexOf(selected);
    let next: number;
    if (e.key === 'ArrowRight') next = (idx + 1) % days.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + days.length) % days.length;
    else if (e.key === 'Home') next = 0;
    else next = days.length - 1;
    onChange(days[next]);
    tabRefs.current[next]?.focus();
  }

  return (
    <div class="day-tabs-outer">
      <div class="day-tabs" role="tablist" aria-label="Event day" onKeyDown={handleKeyDown}>
        {days.map((d, i) => {
          const count = dayCounts[d] ?? 0;
          return (
            <button
              key={d}
              ref={(el: HTMLButtonElement | null) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`day-tab-${d}`}
              aria-selected={d === selected}
              aria-controls="schedule-panel"
              tabIndex={d === selected ? 0 : -1}
              class={`day-tab${d === selected ? ' active' : ''}`}
              onClick={() => onChange(d)}
              aria-label={`${shortDayLabel(d)}, ${count} sessions`}
            >
              <span class="day-tab-label">{shortDayLabel(d)}</span>
              <span class="day-tab-count">{count}</span>
            </button>
          );
        })}
      </div>
      <label class="sr-only" for="jump-to-day-select">Jump to day</label>
      <select
        id="jump-to-day-select"
        class="jump-to-day"
        value={selected}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      >
        {days.map((d) => {
          const count = dayCounts[d] ?? 0;
          return (
            <option key={d} value={d}>
              {shortDayLabel(d)} ({count})
            </option>
          );
        })}
      </select>
    </div>
  );
}
