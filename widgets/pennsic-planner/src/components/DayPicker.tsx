import { shortDayLabel } from '../lib/time.js';

interface Props {
  days: string[];
  dayCounts: Record<string, number>;
  selected: string;
  onChange: (day: string) => void;
}

export function DayPicker({ days, dayCounts, selected, onChange }: Props) {
  return (
    <div class="day-picker-outer">
      <div class="day-picker" role="tablist" aria-label="Select day">
        {days.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === selected}
            class={`day-pill${d === selected ? ' active' : ''}`}
            onClick={() => onChange(d)}
            aria-label={shortDayLabel(d) + ', ' + (dayCounts[d] ?? 0) + ' sessions'}
          >
            <span class="day-pill-label">{shortDayLabel(d)}</span>
            <span class="day-pill-count">{dayCounts[d] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
