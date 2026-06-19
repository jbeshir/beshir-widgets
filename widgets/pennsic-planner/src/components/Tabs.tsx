export type TabId = 'timetable' | 'plan' | 'import' | 'about';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
  planCount: number;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'timetable', label: 'Timetable' },
  { id: 'plan', label: 'My Calendar' },
  { id: 'import', label: 'Import / Export' },
  { id: 'about', label: 'About' },
];

export function Tabs({ active, onChange, planCount }: Props) {
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
          {t.id === 'plan' && planCount > 0 ? `${t.label} (${planCount})` : t.label}
        </button>
      ))}
    </nav>
  );
}
