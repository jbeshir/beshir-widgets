import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { blazon, type NormDesign } from './lib/heraldry';
import { DEFAULT_DESIGN, assess, sameDesign } from './lib/builder';
import { registryParam } from './lib/route';
import { useRoute } from './lib/useRoute';
import { computeWidgetState, type ListStatus, type Tab } from './lib/widgetState';
import * as store from './store';
import { Availability, outcomeMessage, type CheckOutcome } from './components/Availability';
import { DesignTab } from './components/design/DesignTab';
import { RegistryPanel } from './components/registry/RegistryPanel';
import { YourArmsPanel } from './components/YourArmsPanel';
import { RegisterDialog } from './components/RegisterDialog';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'design', label: 'Design' },
  { id: 'registry', label: 'Registry' },
  { id: 'yours', label: 'Your arms' },
];
const TAB_TESTID: Record<Tab, string> = { design: 'tab-design', registry: 'tab-registry', yours: 'tab-yours' };
const DRAFT_DEBOUNCE_MS = 400;
const ANNOUNCE_DEBOUNCE_MS = 700;

export function App() {
  const route = useRoute();
  const [tab, setTab] = useState<Tab>(route.mode === 'builder' ? 'design' : 'registry');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]));
  const [ready, setReady] = useState(false);

  const [design, setDesign] = useState<NormDesign>(() => store.loadDraft() ?? DEFAULT_DESIGN);
  const report = useMemo(() => assess(design), [design]);
  const [hatching, setHatching] = useState(false);

  const [check, setCheck] = useState<{ design: NormDesign; outcome: CheckOutcome } | null>(null);
  const [checking, setChecking] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registryStatus, setRegistryStatus] = useState<ListStatus>('loading');
  const [yours, setYours] = useState<store.DeviceArms[]>(() => store.deviceArms());
  // One persistent polite live region: messages are written into it (never inserted with their own
  // role), so assistive tech reliably announces them.
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((m: string) => setAnnouncement((cur) => (cur === m ? `${m}\u00a0` : m)), []);
  const focusPreview = useRef(false);

  // An entry/owner link opens the registry tab (it shows the public entry page / owner view).
  useEffect(() => {
    if (route.mode !== 'builder') selectTab('registry');
  }, [route]);

  const selectTab = useCallback((t: Tab) => {
    setTab(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    if (t === 'yours') setYours(store.deviceArms());
  }, []);

  // Draft autosave (debounced), flushed when the page is hidden.
  const latest = useRef(design);
  latest.current = design;
  useEffect(() => {
    const save = () => (sameDesign(latest.current, DEFAULT_DESIGN) ? store.clearDraft() : store.saveDraft(latest.current));
    const t = setTimeout(save, DRAFT_DEBOUNCE_MS);
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', save);
    };
  }, [design]);

  const startOver = () => {
    setDesign(DEFAULT_DESIGN);
    store.clearDraft();
  };

  const announceWhenInteractive = (m: string, tries = 20) => {
    const app = document.getElementById('app');
    if (app?.hasAttribute('inert') && tries > 0) setTimeout(() => announceWhenInteractive(m, tries - 1), 50);
    else setTimeout(() => announce(m), 100);
  };

  // "Load into builder" from an entry: adopt its design and go to the Design tab.
  const loadDesign = (nd: NormDesign) => {
    setDesign(nd);
    setCheck(null);
    if (route.mode !== 'builder') location.hash = '#/';
    selectTab('design');
    window.scrollTo(0, 0);
    focusPreview.current = true;
    // The entry sheet keeps #app inert until it unmounts, so announce once inert is lifted.
    announceWhenInteractive(`Loaded into the builder: ${blazon(nd)}`);
  };

  // After "Load into builder" the opener (a registry card) is hidden, so focus the preview instead of
  // dropping to <body>. Runs after the entry sheet has unmounted and restored (nothing) focus.
  useEffect(() => {
    if (!focusPreview.current || tab !== 'design') return;
    focusPreview.current = false;
    document.querySelector<HTMLElement>('[data-testid=shield-preview]')?.focus({ preventScroll: true });
  }, [tab, design]);

  // Rule violations are announced once the user pauses (not on every arrow-key selection).
  useEffect(() => {
    if (report.status !== 'violation') return;
    const t = setTimeout(() => announce(`This design breaks a rule: ${report.problems.map((p) => p.message).join(' ')}`), ANNOUNCE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [report]);

  const checkShown = !!check && sameDesign(check.design, design);

  // Check availability (offline: against the bundled sample; online: POST /api/arms/check).
  const onCheck = async () => {
    const snapshot = design;
    setChecking(true);
    const outcome = await store.check(registryParam(), snapshot);
    setChecking(false);
    setCheck({ design: snapshot, outcome });
    announce(outcomeMessage(outcome));
  };

  // ── data-widget-state: the single place it is computed (PLAN §7) ──
  const widgetState = computeWidgetState({
    tab,
    design: report.status,
    checkShown,
    registry: registryStatus,
    yours: yours.length ? 'populated' : 'empty',
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.widgetState = widgetState;
  }, [widgetState]);

  // #widget-ready once fonts are loaded and the first frame has painted.
  useEffect(() => {
    let cancelled = false;
    const done = () => requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) setReady(true); }));
    if (document.fonts?.ready) document.fonts.ready.then(done, done);
    else done();
    return () => { cancelled = true; };
  }, []);

  // Report natural height to the embedding page.
  useEffect(() => {
    let lastHeight = -1;
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(document.body.getBoundingClientRect().height);
      if (height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage({ type: 'resize', height }, '*');
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    if (n < 0) return;
    e.preventDefault();
    selectTab(TABS[n].id);
    document.getElementById(`tab-${TABS[n].id}`)?.focus();
  };

  return (
    <main class="container">
      <section class="card">
        <header class="card-header">
          <h1>Heraldry Builder</h1>
          <p class="hint">Design rule-checked coats of arms, read their blazon, and register them in a community armorial.</p>
        </header>

        <div class="tabs" role="tablist" aria-label="Sections" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              class="tab"
              aria-selected={tab === t.id ? 'true' : 'false'}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              data-testid={TAB_TESTID[t.id]}
              onClick={() => selectTab(t.id)}
            >
              {t.label}
              {t.id === 'yours' && yours.length > 0 && <span class="tab-count">{yours.length}</span>}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="panel-design" aria-labelledby="tab-design" hidden={tab !== 'design'} class="tab-panel">
          <DesignTab
            design={design}
            report={report}
            onChange={setDesign}
            onStartOver={startOver}
            hatching={hatching}
            onHatching={setHatching}
            onCheck={onCheck}
            checking={checking}
            onRegister={() => setRegisterOpen(true)}
            availability={(jump) => check ? (checkShown ? <Availability outcome={check.outcome} onJump={jump} /> : (
              <p class="availability-stale" data-testid="availability-stale">Your design changed since the last check. Check availability again.</p>
            )) : null}
          />
        </div>
        <div role="tabpanel" id="panel-registry" aria-labelledby="tab-registry" hidden={tab !== 'registry'} class="tab-panel">
          {visited.has('registry') && <RegistryPanel
              route={route}
              onStatus={setRegistryStatus}
              hatching={hatching}
              onLoadDesign={loadDesign}
              onDeviceChange={() => setYours(store.deviceArms())}
            />}
        </div>
        <div role="tabpanel" id="panel-yours" aria-labelledby="tab-yours" hidden={tab !== 'yours'} class="tab-panel">
          <YourArmsPanel items={yours} onBrowse={() => selectTab('registry')} />
        </div>
      </section>

      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-status">{announcement}</div>

      {registerOpen && (
        <RegisterDialog design={design} onClose={() => setRegisterOpen(false)} onRegistered={() => setYours(store.deviceArms())} />
      )}
      {ready && <div id="widget-ready" style={{ display: 'none' }} aria-hidden="true" />}
    </main>
  );
}
