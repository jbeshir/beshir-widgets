export type TabId = 'timetable' | 'instructors' | 'plan' | 'about';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  planCount: number;
  planLabel: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'timetable', label: 'Timetable' },
  { id: 'instructors', label: 'Instructors' },
  { id: 'plan', label: 'My Calendar' },
  { id: 'about', label: 'About' },
];

export function Tabs({ active, onChange, planCount, planLabel }: Props) {
  return (
    <nav class="tabs" role="tablist" aria-label="Planner sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          class={`tab-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.id === 'plan' ? (planCount > 0 ? `${planLabel} (${planCount})` : planLabel) : t.label}
        </button>
      ))}
    </nav>
  );
}
