import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import sessionsData from './data/sessions-2026.json';
import type { Session } from './types';
import { planStore } from './store';
import type { PlanChange } from './store';
import { findConflicts } from './lib/layout.js';
import { Tabs } from './components/Tabs';
import type { TabId } from './components/Tabs';
import { DayPicker } from './components/DayPicker';
import { Filters } from './components/Filters';
import { Timetable } from './components/Timetable';
import { MyCalendar } from './components/MyCalendar';
import { PlanSidebar } from './components/PlanSidebar';
import { SessionDetail } from './components/SessionDetail';
import { ImportExport } from './components/ImportExport';
import { About } from './components/About';

const BUNDLED = sessionsData as Session[];

function getDays(ds: Session[]): string[] {
  const s = new Set<string>();
  for (const r of ds) s.add(r.day);
  return [...s].sort();
}

function getBusiestDay(ds: Session[]): string {
  const counts: Record<string, number> = {};
  for (const s of ds) counts[s.day] = (counts[s.day] ?? 0) + 1;
  const days = Object.keys(counts).sort();
  if (days.length === 0) return '';
  return days.reduce((best, d) => (counts[d] > counts[best] ? d : best), days[0]);
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [dataset, setDataset] = useState<Session[]>(BUNDLED);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('timetable');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [trackFilter, setTrackFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Init from store
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedDs, storedPlan] = await Promise.all([
        planStore.getDataset(),
        planStore.getPlan(),
      ]);
      if (cancelled) return;
      const ds = storedDs ?? BUNDLED;
      setDataset(ds);
      setPlanIds(storedPlan);
      setSelectedDay(getBusiestDay(ds));
      setLoading(false);
    })();

    const unsub = planStore.subscribe((change: PlanChange) => {
      if (change.type === 'plan') {
        setPlanIds(change.ids);
      } else if (change.type === 'dataset') {
        const ds = change.dataset ?? BUNDLED;
        setDataset(ds);
        const days = getDays(ds);
        setSelectedDay((prev) => (days.includes(prev) ? prev : getBusiestDay(ds)));
        setTrackFilter([]);
        setLocationFilter('');
        setTextFilter('');
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Mark ready after first render of loaded state
  useEffect(() => {
    if (!loading) {
      setReady(true);
    }
  }, [loading]);

  // ResizeObserver → postMessage for iframe embedding
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.parent.postMessage({ type: 'resize', height: el.scrollHeight }, '*');
      }, 100);
    });
    ro.observe(el);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, []);

  // Derived: unique days
  const days = useMemo(() => getDays(dataset), [dataset]);

  // Derived: day session counts
  const dayCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of dataset) c[s.day] = (c[s.day] ?? 0) + 1;
    return c;
  }, [dataset]);

  // Derived: unique tracks & locations
  const tracks = useMemo(() => {
    const s = new Set<string>();
    for (const r of dataset) s.add(r.track);
    return [...s].sort();
  }, [dataset]);

  const locations = useMemo(() => {
    const s = new Set<string>();
    for (const r of dataset) if (r.location) s.add(r.location);
    return [...s].sort();
  }, [dataset]);

  // Derived: track → jewel-tone color pair {l: light-mode, d: dark-mode}
  // Per-hue lightness keeps white text legible across all hues.
  const trackColors = useMemo(() => {
    const sorted = [...tracks].sort();
    const count = sorted.length || 1;
    const map: Record<string, { l: string; d: string }> = {};
    sorted.forEach((t, i) => {
      const hue = Math.round((i / count) * 360);
      let s = 55, lit = 37;
      if (hue >= 40 && hue < 80) { s = 58; lit = 31; }        // yellows → deep amber
      else if (hue >= 80 && hue < 220) { s = 50; lit = 33; }  // greens/cyans → rich dark
      const litD = hue >= 80 && hue < 220 ? lit + 7 : lit + 12;
      const sD = Math.max(s - 4, 44);
      map[t] = { l: `hsl(${hue},${s}%,${lit}%)`, d: `hsl(${hue},${sD}%,${litD}%)` };
    });
    return map;
  }, [tracks]);

  // Derived: filtered sessions for selected day
  const filteredSessions = useMemo(() => {
    let ss = dataset.filter((s) => s.day === selectedDay);
    if (trackFilter.length > 0) ss = ss.filter((s) => trackFilter.includes(s.track));
    if (locationFilter) ss = ss.filter((s) => s.location === locationFilter);
    if (textFilter) {
      const q = textFilter.toLowerCase();
      ss = ss.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.instructor ?? '').toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q)
      );
    }
    return ss;
  }, [dataset, selectedDay, trackFilter, locationFilter, textFilter]);

  // Derived: plan sessions
  const planSet = useMemo(() => new Set(planIds), [planIds]);
  const planSessions = useMemo(
    () => dataset.filter((s) => planSet.has(s.id)),
    [dataset, planSet]
  );

  // Derived: conflicts
  const conflicts = useMemo(
    () => findConflicts(planSessions) as Set<string>,
    [planSessions]
  );

  // Derived: open session for detail lightbox
  const openSession = useMemo(
    () => dataset.find((s) => s.id === openSessionId) ?? null,
    [dataset, openSessionId]
  );

  async function handleToggle(id: string) {
    await planStore.togglePlan(id);
  }

  function handleOpenDetail(id: string) {
    setOpenSessionId(id);
  }

  function handleNavigateDetail(id: string) {
    setOpenSessionId(id);
    const t = dataset.find((s) => s.id === id);
    if (t) setSelectedDay(t.day);
  }

  function handleCloseDetail() {
    setOpenSessionId(null);
  }

  if (loading) {
    return (
      <div class="container">
        <div class="card">
          <div class="loading-state">Loading Pennsic 53 schedule…</div>
        </div>
      </div>
    );
  }

  return (
    <div class="container" ref={containerRef}>
      {ready && <div id="widget-ready" style={{ display: 'none' }} aria-hidden="true" />}
      <div class="card">
        <div class="card-header">
          <h1>Pennsic 53 Planner</h1>
          <p class="hint">2026 · 1,836 classes · 14 days · 37 tracks</p>
        </div>

        <Tabs active={activeTab} onChange={setActiveTab} planCount={planIds.length} />

        {activeTab === 'timetable' && (
          <>
            <DayPicker
              days={days}
              dayCounts={dayCounts}
              selected={selectedDay}
              onChange={setSelectedDay}
            />
            <Filters
              tracks={tracks}
              trackFilter={trackFilter}
              onTrackFilter={setTrackFilter}
              locations={locations}
              locationFilter={locationFilter}
              onLocationFilter={setLocationFilter}
              textFilter={textFilter}
              onTextFilter={setTextFilter}
              resultCount={filteredSessions.length}
              trackColors={trackColors}
            />
            <div class="picker-layout">
              <div class="picker-main">
                <Timetable
                  sessions={filteredSessions}
                  planIds={planIds}
                  onToggle={handleToggle}
                  onOpenDetail={handleOpenDetail}
                  trackColors={trackColors}
                  selectedDay={selectedDay}
                  conflicts={conflicts}
                />
              </div>
              <PlanSidebar
                day={selectedDay}
                sessions={planSessions.filter((s) => s.day === selectedDay)}
                conflicts={conflicts}
                trackColors={trackColors}
                onOpenDetail={handleOpenDetail}
                onOpenCalendar={() => setActiveTab('plan')}
              />
            </div>
          </>
        )}

        {activeTab === 'plan' && (
          <MyCalendar
            sessions={planSessions}
            conflicts={conflicts}
            trackColors={trackColors}
            onOpenDetail={handleOpenDetail}
          />
        )}

        {activeTab === 'import' && (
          <ImportExport
            planSessions={planSessions}
            currentPlanIds={planIds}
          />
        )}

        {activeTab === 'about' && <About />}
      </div>

      {openSession && (
        <SessionDetail
          session={openSession}
          allSessions={dataset}
          planSet={planSet}
          conflicts={conflicts}
          trackColor={trackColors[openSession.track] ?? { l: 'hsl(220,55%,37%)', d: 'hsl(220,51%,49%)' }}
          onToggle={handleToggle}
          onNavigate={handleNavigateDetail}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}
