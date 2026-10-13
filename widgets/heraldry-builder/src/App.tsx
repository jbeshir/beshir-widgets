import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DEFAULT_FIELD_SHAPE, blazon, type Companion, type FieldShape, type Design, type ShapedDesign } from './lib/heraldry/next';
import { DEFAULT_DESIGN, adjustDesign, assess, isUntouched, sameDesign, replaceDesign, undoStillOffered, type Replacement } from './lib/next/builder';
import { surpriseDesign } from './lib/presets';
import { RECOVER_HASH, entryHash, parseHash, registryParam } from './lib/route';
import { useRoute } from './lib/useRoute';
import { computeWidgetState, type ListStatus, type Tab } from './lib/widgetState';
import * as store from './store';
import { Availability, outcomeMessage, type CheckOutcome } from './components/Availability';
import { DesignTab } from './components/design/DesignTab';
import { ReplacedNotice } from './components/design/ReplacedNotice';
import { RegistryPanel } from './components/registry/RegistryPanel';
import { YourArmsPanel } from './components/YourArmsPanel';
import { PrintView } from './components/PrintView';
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
  const [tab, setTab] = useState<Tab>(route.mode === 'builder' ? 'design' : route.mode === 'yours' ? 'yours' : 'registry');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]));
  const [ready, setReady] = useState(false);

  const [draft] = useState(() => store.loadDraft());
  const [design, setDesign] = useState<Design>(draft?.design ?? DEFAULT_DESIGN);
  const [shape, setShape] = useState<FieldShape>(draft?.shape ?? DEFAULT_FIELD_SHAPE);
  const report = useMemo(() => assess(design), [design]);
  const [hatching, setHatching] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !store.welcomeDismissed());
  // The examples box is open on this device's first visit to the Design tab, folded on later ones.
  const [examplesOpen] = useState(() => !store.examplesSeen());

  const [check, setCheck] = useState<{ design: Design; outcome: CheckOutcome } | null>(null);
  const [checking, setChecking] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registryStatus, setRegistryStatus] = useState<ListStatus>('loading');
  const [yours, setYours] = useState<store.DeviceArms[]>(() => store.deviceArms());
  // One persistent polite live region: messages are written into it (never inserted with their own
  // role), so assistive tech reliably announces them.
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((m: string) => setAnnouncement((cur) => (cur === m ? `${m}\u00a0` : m)), []);
  const focusPreview = useRef(false);
  const [replaced, setReplaced] = useState<Replacement | null>(null);

  // The nametag sheet replaces the app on screen (the app stays mounted, hidden, so no state is lost).
  // Back returns to the page it was opened from (the entry's page when the sheet was the first page
  // opened) and puts focus back where the visitor left it.
  const printing = route.mode === 'print';
  const backHash = useRef<string | null>(null);
  const printOpener = useRef<Element | null>(null);
  const printedId = useRef<string | null>(null);
  useEffect(() => {
    if (!printing) backHash.current = location.hash || '#/';
  }, [route]);
  useEffect(() => {
    const on = () => {
      if (parseHash(location.hash).mode === 'print' && printedId.current === null) printOpener.current = document.activeElement;
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (route.mode === 'print') {
      printedId.current = route.id;
      return;
    }
    const id = printedId.current;
    if (id === null) return;
    printedId.current = null;
    // A link in an entry sheet closed with the sheet, so fall back to the card that opened the sheet.
    const card = document.querySelector(`[data-testid=result-card][data-id="${CSS.escape(id)}"]`);
    const target = [printOpener.current, card].find((el): el is HTMLElement => el instanceof HTMLElement && el.isConnected && !el.closest('[hidden]'));
    (target ?? document.getElementById(`tab-${tab}`))?.focus();
  }, [printing]);

  // An entry, owner or recovery link opens the registry tab (it shows that page in place of the list);
  // #/print without an entry opens Your arms.
  useEffect(() => {
    if (route.mode === 'yours') selectTab('yours');
    else if (route.mode !== 'builder' && route.mode !== 'print') selectTab('registry');
  }, [route]);

  const selectTab = useCallback((t: Tab) => {
    setTab(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    if (t === 'yours') setYours(store.deviceArms());
  }, []);

  // Draft autosave (debounced), flushed when the page is hidden.
  const latest = useRef<ShapedDesign>({ design, shape });
  latest.current = { design, shape };
  useEffect(() => {
    const save = () => (isUntouched(latest.current) ? store.clearDraft() : store.saveDraft(latest.current));
    const t = setTimeout(save, DRAFT_DEBOUNCE_MS);
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', save);
    };
  }, [design, shape]);

  const startOver = () => {
    setDesign(DEFAULT_DESIGN);
    setShape(DEFAULT_FIELD_SHAPE);
    setReplaced(null);
    store.clearDraft();
  };

  // Undo is offered only while the replacement is as it was put there.
  useEffect(() => {
    if (replaced && !undoStillOffered(replaced, { design, shape })) setReplaced(null);
  }, [replaced, design, shape]);

  const undoReplace = () => {
    if (!replaced) return;
    setDesign(replaced.previous.design);
    setShape(replaced.previous.shape);
    setReplaced(null);
    setCheck(null);
    focusPreview.current = true;
    announce(`Restored your design: ${blazon(replaced.previous.design)}`);
  };

  // An example or a surprise design replaces the builder's design; focus goes to the preview so the change is seen and heard.
  const applyDesign = ({ design: nd, shape: s }: ShapedDesign, caption: string) => {
    setReplaced(replaceDesign({ design, shape }, { design: nd, shape: s }));
    setDesign(nd);
    setShape(s);
    setCheck(null);
    focusPreview.current = true;
    announce(`Loaded ${caption}: ${blazon(nd)}`);
  };

  // A count or placement that brought its partner along: applied, with the note and Undo under the controls.
  const adjust = (nd: Design, companion: Companion) => {
    setReplaced(adjustDesign({ design, shape }, nd, companion));
    setDesign(nd);
  };

  const dismissWelcome = () => {
    store.dismissWelcome();
    setWelcomeOpen(false);
  };

  useEffect(() => {
    if (tab === 'design') store.markExamplesSeen();
  }, [tab]);

  const announceWhenInteractive = (m: string, tries = 20) => {
    const app = document.getElementById('app');
    if (app?.hasAttribute('inert') && tries > 0) setTimeout(() => announceWhenInteractive(m, tries - 1), 50);
    else setTimeout(() => announce(m), 100);
  };

  // "Load into builder" from an entry: adopt its design and shape and go to the Design tab.
  const loadDesign = ({ design: nd, shape: s }: ShapedDesign) => {
    setReplaced(replaceDesign({ design, shape }, { design: nd, shape: s }));
    setDesign(nd);
    setShape(s);
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

  // ── data-widget-state: the single place it is computed ──
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
    <>
    <main class="container" hidden={printing}>
      <section class="card">
        <header class="card-header">
          <h1>Heraldry Builder</h1>
          <p class="hint">Design a personal coat of arms for your nametag, then register it so nobody else in the registry has the same one.</p>
          <a class="text-link header-recover" href={RECOVER_HASH} data-testid="header-recover-link">Lost your link? / Withdraw my registration</a>
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
          <ReplacedNotice replacement={replaced} kind="replaced" onUndo={undoReplace} onFix={null} />
          <DesignTab
            design={design}
            shape={shape}
            report={report}
            onChange={setDesign}
            onAdjust={adjust}
            adjusted={(onFix) => <ReplacedNotice replacement={replaced} kind="adjusted" onUndo={undoReplace} onFix={onFix} />}
            onShape={setShape}
            onStartOver={startOver}
            examplesOpen={examplesOpen}
            onLoadExample={applyDesign}
            onSurprise={() => applyDesign(surpriseDesign(Math.random), 'a surprise design')}
            onDismissWelcome={welcomeOpen ? dismissWelcome : null}
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
        <RegisterDialog design={design} shape={shape} hatching={hatching} onClose={() => setRegisterOpen(false)} onRegistered={() => setYours(store.deviceArms())} />
      )}
      {ready && <div id="widget-ready" style={{ display: 'none' }} aria-hidden="true" />}
    </main>
    {route.mode === 'print' && <PrintView id={route.id} hatching={hatching} onBack={() => { location.hash = backHash.current ?? entryHash(route.id); }} />}
    </>
  );
}
