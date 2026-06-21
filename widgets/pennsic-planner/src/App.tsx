import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import type { Session } from './types';
import { planStore } from './store';
import type { PlanChange, ActiveCalendar, SyncStatus } from './store';
import { DEFAULT_EVENT, getEvent } from './data/events';
import { parseHash, editHash } from './lib/route';
import type { Route } from './lib/route';
import {
  listDeviceCalendars,
  forgetDeviceCalendar,
  clearDeviceCalendars,
} from './lib/deviceCalendars';
import type { DeviceCalendar } from './lib/deviceCalendars';
import { findConflicts } from './lib/layout.js';
import { Tabs } from './components/Tabs';
import type { TabId } from './components/Tabs';
import { CalendarBar } from './components/CalendarBar';
import type { Mode } from './components/CalendarBar';
import { DayPicker } from './components/DayPicker';
import { Filters } from './components/Filters';
import { Timetable } from './components/Timetable';
import { MyCalendar } from './components/MyCalendar';
import { PlanSidebar } from './components/PlanSidebar';
import { SharedView } from './components/SharedView';
import { SessionDetail } from './components/SessionDetail';
import { About } from './components/About';

// AppMode adds the transient/terminal states that have no calendar bar of their own.
type AppMode = Mode | 'loading' | 'notfound' | 'missing-event' | 'error';

const EMPTY: Session[] = [];

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

function initialMode(): AppMode {
  if (typeof location === 'undefined') return 'landing';
  return parseHash(location.hash).mode === 'landing' ? 'landing' : 'loading';
}

export function App() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [active, setActive] = useState<ActiveCalendar | null>(null);
  const [sync, setSync] = useState<{ status: SyncStatus; message?: string }>({ status: 'idle' });
  const [justCreated, setJustCreated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<DeviceCalendar[]>([]);

  // View state — deliberately preserved across mode switches (create / duplicate / hash changes).
  const [activeTab, setActiveTab] = useState<TabId>('timetable');
  const [selectedDay, setSelectedDay] = useState<string>(() => getBusiestDay(DEFAULT_EVENT.sessions));
  const [trackFilter, setTrackFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refreshDevices() {
    setDevices(listDeviceCalendars());
  }

  // applyRoute resolves a parsed hash into a concrete mode, loading the calendar from D1 when needed.
  // It is kept in a ref so the hashchange listener always calls the latest closure.
  const applyRouteRef = useRef<(route: Route) => Promise<void>>(async () => {});
  applyRouteRef.current = async (route: Route) => {
    if (route.mode === 'landing') {
      planStore.clear();
      setMode('landing');
      setJustCreated(false);
      refreshDevices();
      setReady(true);
      return;
    }

    const existing = planStore.getActive();
    if (existing && existing.id === route.id) {
      // Already in memory (just created / duplicated, or a same-id hash tweak). Don't refetch.
      finalizeCalendarMode(route, existing);
      return;
    }

    setMode('loading');
    const res = await planStore.open(route.id, route.mode === 'edit' ? route.secret : null);
    if (!res.ok) {
      setMode(res.reason === 'notfound' ? 'notfound' : 'error');
      setReady(true);
      return;
    }
    setJustCreated(false);
    refreshDevices();
    finalizeCalendarMode(route, res.calendar);
  };

  function finalizeCalendarMode(route: Route, cal: ActiveCalendar) {
    if (!getEvent(cal.eventId)) {
      setMode('missing-event');
      setReady(true);
      return;
    }
    const editable = route.mode === 'edit' && !!cal.secret;
    setMode(editable ? 'edit' : 'readonly');
    setReady(true);
  }

  // Subscribe to the store and wire up routing once.
  useEffect(() => {
    refreshDevices();
    const unsub = planStore.subscribe((change: PlanChange) => {
      if (change.type === 'active') {
        setActive(change.calendar);
      } else if (change.type === 'sync') {
        setSync({ status: change.status, message: change.message });
        if (savedTimer.current) clearTimeout(savedTimer.current);
        if (change.status === 'saved') {
          savedTimer.current = setTimeout(() => setSync({ status: 'idle' }), 2000);
        }
      }
    });

    const onHashChange = () => void applyRouteRef.current(parseHash(location.hash));
    window.addEventListener('hashchange', onHashChange);
    // Flush any pending debounced edit before the tab goes away.
    const onPageHide = () => void planStore.flush();
    window.addEventListener('pagehide', onPageHide);

    void applyRouteRef.current(parseHash(location.hash));

    return () => {
      unsub();
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('pagehide', onPageHide);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ResizeObserver → postMessage for iframe embedding (unchanged invariant).
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

  // The event whose schedule we're showing: the active calendar's in edit/readonly, else the default.
  const eventDef = useMemo(() => {
    if ((mode === 'edit' || mode === 'readonly') && active) return getEvent(active.eventId) ?? null;
    if (mode === 'missing-event') return null;
    return DEFAULT_EVENT;
  }, [mode, active]);

  const dataset = eventDef ? eventDef.sessions : EMPTY;
  const browsing = mode === 'landing' || mode === 'edit' || mode === 'readonly';
  const readOnly = mode === 'readonly';

  const planIds = useMemo(
    () => (browsing && active ? active.sessionIds : []),
    [browsing, active]
  );

  // Keep the selected day valid as the dataset (event) changes.
  useEffect(() => {
    const days = getDays(dataset);
    if (days.length === 0) return;
    setSelectedDay((prev) => (days.includes(prev) ? prev : getBusiestDay(dataset)));
  }, [dataset]);

  const days = useMemo(() => getDays(dataset), [dataset]);

  const dayCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of dataset) c[s.day] = (c[s.day] ?? 0) + 1;
    return c;
  }, [dataset]);

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

  // Track → jewel-tone color pair {l: light-mode, d: dark-mode}. Per-hue lightness keeps white text
  // legible across all hues.
  const trackColors = useMemo(() => {
    const sorted = [...tracks].sort();
    const count = sorted.length || 1;
    const map: Record<string, { l: string; d: string }> = {};
    sorted.forEach((t, i) => {
      const hue = Math.round((i / count) * 360);
      let s = 55, lit = 37;
      if (hue >= 40 && hue < 80) { s = 58; lit = 31; }
      else if (hue >= 80 && hue < 220) { s = 50; lit = 33; }
      const litD = hue >= 80 && hue < 220 ? lit + 7 : lit + 12;
      const sD = Math.max(s - 4, 44);
      map[t] = { l: `hsl(${hue},${s}%,${lit}%)`, d: `hsl(${hue},${sD}%,${litD}%)` };
    });
    return map;
  }, [tracks]);

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

  const planSet = useMemo(() => new Set(planIds), [planIds]);
  const planSessions = useMemo(
    () => dataset.filter((s) => planSet.has(s.id)),
    [dataset, planSet]
  );
  const conflicts = useMemo(() => findConflicts(planSessions) as Set<string>, [planSessions]);
  const openSession = useMemo(
    () => dataset.find((s) => s.id === openSessionId) ?? null,
    [dataset, openSessionId]
  );

  function defaultCalendarName(): string {
    return `My ${DEFAULT_EVENT.name} plan`;
  }

  async function createWith(sessionIds: string[]): Promise<void> {
    if (busy) return;
    setBusy(true);
    const created = await planStore.create(defaultCalendarName(), sessionIds);
    setBusy(false);
    if (!created) return; // failure already surfaced via the sync badge
    setJustCreated(true);
    refreshDevices();
    location.hash = editHash(created.id, created.secret);
  }

  async function handleToggle(id: string): Promise<void> {
    if (mode === 'edit') {
      planStore.togglePlan(id);
    } else if (mode === 'landing') {
      await createWith([id]); // create-on-add: one step from browsing to an editable calendar
    }
    // readonly: toggles are not shown
  }

  async function handleDuplicate(): Promise<void> {
    if (!active || busy) return;
    setBusy(true);
    const created = await planStore.create(`Copy of ${active.name}`, active.sessionIds);
    setBusy(false);
    if (!created) return;
    setJustCreated(true);
    refreshDevices();
    location.hash = editHash(created.id, created.secret);
  }

  function handleOpenDetail(id: string) { setOpenSessionId(id); }
  function handleNavigateDetail(id: string) {
    setOpenSessionId(id);
    const t = dataset.find((s) => s.id === id);
    if (t) setSelectedDay(t.day);
  }
  function handleCloseDetail() { setOpenSessionId(null); }

  function goLanding() {
    if (location.hash) location.hash = '';
    else void applyRouteRef.current({ mode: 'landing' });
  }

  const eventName = eventDef ? eventDef.name : 'Pennsic';
  // The plan tab only renders outside read-only mode, so the label is always "My Calendar".
  const planLabel = 'My Calendar';

  return (
    <div class="container" ref={containerRef}>
      {ready && <div id="widget-ready" style={{ display: 'none' }} aria-hidden="true" />}
      <div class="card">
        <div class="card-header">
          <h1>{eventName} Planner</h1>
          {eventDef && (
            <p class="hint">
              {eventDef.year} · {dataset.length.toLocaleString()} classes · {days.length} days · {tracks.length} tracks
            </p>
          )}
        </div>

        {mode === 'loading' && (
          <div class="loading-state">Loading calendar…</div>
        )}

        {(mode === 'notfound' || mode === 'error') && (
          <div class="cal-message">
            <h2>{mode === 'notfound' ? 'Calendar not found' : 'Could not load that calendar'}</h2>
            <p>
              {mode === 'notfound'
                ? 'This link doesn’t point to a calendar — it may have been mistyped.'
                : 'Something went wrong reaching the server. Try again in a moment.'}
            </p>
            <button class="cal-create-btn" onClick={goLanding}>Browse the schedule</button>
          </div>
        )}

        {mode === 'missing-event' && (
          <div class="cal-message">
            <h2>This event’s schedule is no longer available</h2>
            <p>
              This calendar belongs to an event whose schedule isn’t bundled in this version of the
              planner anymore. Your picks are still stored, but they can’t be shown here.
            </p>
            <button class="cal-create-btn" onClick={goLanding}>Browse the current schedule</button>
          </div>
        )}

        {/* Read-only share view: the shared plan only — no timetable browser, tabs, or filters. */}
        {mode === 'readonly' && active && eventDef && (
          <SharedView
            name={active.name}
            eventName={eventName}
            sessions={planSessions}
            conflicts={conflicts}
            trackColors={trackColors}
            onOpenDetail={handleOpenDetail}
            onBrowse={goLanding}
            onDuplicate={() => void handleDuplicate()}
            busy={busy}
          />
        )}

        {browsing && mode !== 'readonly' && (
          <>
            <CalendarBar
              mode={mode as Mode}
              active={active}
              eventName={eventName}
              sync={sync}
              justCreated={justCreated}
              busy={busy}
              onCreate={() => void createWith([])}
              onRename={(name) => planStore.setName(name)}
              onDismissCreated={() => setJustCreated(false)}
              deviceCalendars={devices}
              onForgetDevice={(id) => { forgetDeviceCalendar(id); refreshDevices(); }}
              onClearDevices={() => { clearDeviceCalendars(); refreshDevices(); }}
            />

            <Tabs active={activeTab} onChange={setActiveTab} planCount={planIds.length} planLabel={planLabel} />

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
                      readOnly={readOnly}
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

            {activeTab === 'about' && <About eventName={eventName} />}
          </>
        )}
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
          readOnly={readOnly}
          addLabel={mode === 'landing' ? 'Add & create calendar' : 'Add to plan'}
        />
      )}
    </div>
  );
}
