import { useEffect, useRef, useState } from 'preact/hooks';
import { mapStore, type ActiveMap, type MapChange, type SyncStatus } from './store';
import { parseHash, type Route } from './lib/route';
import { PALETTE } from './lib/palette';
import { MapSurface, type MapSurfaceApi } from './components/MapSurface';
import { ColorPicker } from './components/ColorPicker';
import { Legend } from './components/Legend';
import { PinEditor } from './components/PinEditor';
import { MapBar } from './components/MapBar';
import { ReadonlyView } from './components/ReadonlyView';
import { MapKey } from './components/MapKey';
import { RoyalEncampments } from './components/RoyalEncampments';
import type { RoyalEncampment } from './data/mapKey';

// Zoom level a Royal-Encampments jump lands at — tight enough to read block labels, loose enough to
// keep the surrounding neighbourhood in view.
const ENCAMPMENT_JUMP_SCALE = 3.5;

type AppMode = 'loading' | 'edit' | 'readonly' | 'error';
type WidgetState = 'ready' | 'empty' | 'populated' | 'loading' | 'error';
type DockPanel = 'key' | 'royals' | 'legend' | null;

function widgetStateFor(mode: AppMode, pinCount: number): WidgetState {
  if (mode === 'loading') return 'loading';
  if (mode === 'error') return 'error';
  if (mode === 'readonly') return pinCount > 0 ? 'populated' : 'empty';
  // edit: `ready` = a fresh, editable, still-empty map (first paint, idle); `populated` = ≥1 pin.
  return pinCount > 0 ? 'populated' : 'ready';
}

function setWidgetState(state: WidgetState): void {
  document.documentElement.dataset.widgetState = state;
}

// A caller-generated, monotonic id — never crypto.randomUUID (the journey harness freezes Date and
// Math.random, not crypto, but a plain counter is simplest and needs no polyfill either way).
let pinCounter = 0;
function genId(): string {
  pinCounter += 1;
  return `pin-${pinCounter}`;
}

// No map hash ⇒ an immediately-editable local draft (no landing gate); a map hash ⇒ load it.
function initialMode(): AppMode {
  if (typeof location === 'undefined') return 'edit';
  return parseHash(location.hash).mode === 'landing' ? 'edit' : 'loading';
}

export function App() {
  const [mode, setModeState] = useState<AppMode>(initialMode);
  const [active, setActive] = useState<ActiveMap | null>(mapStore.getActive());
  const [sync, setSync] = useState<{ status: SyncStatus; message?: string }>({ status: 'idle' });
  const [selectedColor, setSelectedColor] = useState<string>(PALETTE[0].key);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [highlightPinId, setHighlightPinId] = useState<string | null>(null);
  // Which dock panel is open. Single-open: opening one closes the others AND the pin editor, so at most
  // one bottom sheet is ever shown (matters most on mobile). Kept deterministic from App state.
  const [openPanel, setOpenPanel] = useState<DockPanel>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  // The currently-mounted MapSurface's imperative API (only one surface is ever mounted at a time).
  const mapApiRef = useRef<MapSurfaceApi | null>(null);
  // Last royal-encampment jumped to: drives the persistent row marker + the screen-reader announcement.
  const [jumpedBlock, setJumpedBlock] = useState<string | null>(null);
  const [jumpAnnounce, setJumpAnnounce] = useState('');

  // Kept alongside the `mode` state itself: the `subscribe` listener below can fire synchronously
  // inside a store call (e.g. startLocalDraft), before Preact has applied a pending setModeState, so it
  // reads this ref rather than the possibly-stale `mode` closure variable.
  const modeRef = useRef<AppMode>(mode);
  modeRef.current = mode;

  function transitionMode(next: AppMode): void {
    modeRef.current = next;
    setModeState(next);
  }

  const applyRouteRef = useRef<(route: Route) => Promise<void>>(async () => {});
  applyRouteRef.current = async (route: Route) => {
    if (route.mode === 'landing') {
      // No-gate local-first flow: on any no-hash load, immediately start an editable draft so the map is
      // interactive from first paint. startLocalDraft is offline-safe under file:// (no fetch — emits a
      // non-blocking 'local' sync status), so this never triggers a network call the render/journey
      // gates would treat as a failure.
      transitionMode('edit');
      mapStore.startLocalDraft('Untitled map');
      setWidgetState('ready');
      setReady(true);
      return;
    }

    transitionMode('loading');
    setWidgetState('loading');
    const result = await mapStore.open(route.id, route.mode === 'edit' ? route.secret : null);
    if (!result.ok) {
      transitionMode('error');
      setWidgetState('error');
      setReady(true);
      return;
    }
    const editable = route.mode === 'edit' && !!result.map.secret;
    const next: AppMode = editable ? 'edit' : 'readonly';
    transitionMode(next);
    setWidgetState(widgetStateFor(next, result.map.pins.length));
    setReady(true);
  };

  useEffect(() => {
    const unsub = mapStore.subscribe((change: MapChange) => {
      if (change.type === 'active') {
        setActive(change.map);
        setWidgetState(widgetStateFor(modeRef.current, change.map ? change.map.pins.length : 0));
      } else {
        setSync({ status: change.status, message: change.message });
      }
    });

    function handleHashChange(): void {
      void applyRouteRef.current(parseHash(location.hash));
    }
    window.addEventListener('hashchange', handleHashChange);

    function handlePageHide(): void {
      void mapStore.flush();
    }
    window.addEventListener('pagehide', handlePageHide);

    void applyRouteRef.current(parseHash(location.hash));

    return () => {
      unsub();
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleAddPin(x: number, y: number): void {
    if (mode !== 'edit') return;
    const id = genId();
    mapStore.addPin({ id, x, y, color: selectedColor, label: '' });
    setOpenPanel(null); // adding/selecting a pin opens the editor → close any open dock panel
    setEditingPinId(id);
    setWidgetState('populated');
  }

  function handleMovePin(id: string, x: number, y: number): void {
    if (mode !== 'edit') return;
    mapStore.movePin(id, x, y);
  }

  function handleSelectPin(id: string): void {
    if (mode === 'edit') {
      setOpenPanel(null);
      setEditingPinId(id);
      return;
    }
    setHighlightPinId(id);
    setTimeout(() => setHighlightPinId((cur) => (cur === id ? null : cur)), 1500);
  }

  function handleChangeLabel(id: string, label: string): void {
    mapStore.updatePin(id, { label });
  }

  function handleChangeColor(id: string, color: string): void {
    mapStore.updatePin(id, { color });
  }

  function handleDeletePin(id: string): void {
    mapStore.removePin(id);
    setEditingPinId(null);
  }

  function handleRename(name: string): void {
    mapStore.setName(name);
  }

  // Opening a dock panel closes the pin editor (mutual exclusion); closing it just clears that panel.
  function handlePanelToggle(name: Exclude<DockPanel, null>, isOpen: boolean): void {
    if (isOpen) {
      setOpenPanel(name);
      setEditingPinId(null);
    } else {
      setOpenPanel((cur) => (cur === name ? null : cur));
    }
  }

  async function handleDuplicate(): Promise<void> {
    if (!active || busy) return;
    setBusy(true);
    const pins = active.pins;
    const name = `Copy of ${active.name}`;
    transitionMode('edit');
    mapStore.startLocalDraft(name);
    // Fresh ids throughout: the source pins' ids may collide with this session's own counter.
    for (const p of pins) mapStore.addPin({ id: genId(), x: p.x, y: p.y, color: p.color, label: p.label });
    setBusy(false);
    setWidgetState(widgetStateFor('edit', pins.length));
  }

  function goLanding(): void {
    // Clearing the hash re-enters the no-hash branch → a fresh editable draft.
    location.hash = '';
  }

  // Pan/zoom the active map to a royal encampment block. Driven synchronously through MapSurface's
  // imperative API so the transform lands in the same click that requested it. Also marks the row and
  // announces the jump: the on-map pulse is aria-hidden and can fade off-screen, so screen-reader and
  // mobile users get a durable, non-visual confirmation of where they landed.
  function handleJumpToBlock(camp: RoyalEncampment): void {
    // Close any open dock panel so the map's pan/zoom/pulse is visible — on mobile the open panel is a
    // 70cqh bottom sheet that would otherwise hide the very reaction the jump triggers.
    setOpenPanel(null);
    mapApiRef.current?.focusOn(camp.x, camp.y, ENCAMPMENT_JUMP_SCALE);
    setJumpedBlock(camp.block);
    setJumpAnnounce(`Jumped to ${camp.kingdom}, block ${camp.block}.`);
  }

  const registerMapApi = (api: MapSurfaceApi | null): void => {
    mapApiRef.current = api;
  };

  const editingPin = active && editingPinId ? active.pins.find((p) => p.id === editingPinId) ?? null : null;
  const selectedColorName = PALETTE.find((c) => c.key === selectedColor)?.name ?? PALETTE[0].name;

  return (
    <div class="app">
      {mode === 'loading' && (
        <div class="overlay-center">
          <div class="status-card" role="status">
            <p>Loading map…</p>
          </div>
        </div>
      )}

      {mode === 'error' && (
        <div class="overlay-center">
          <div class="status-card">
            <p class="status-eyebrow">Pennsic Mapper</p>
            <p role="alert">We couldn't load that map. It may be offline, deleted, or the link may be wrong.</p>
            <button type="button" class="button-secondary" onClick={goLanding}>
              Back to start
            </button>
          </div>
        </div>
      )}

      {mode === 'edit' && active && (
        <>
          <h1 class="sr-only">{active.name}</h1>
          <MapSurface
            pins={active.pins}
            editable
            editingPinId={editingPinId}
            highlightPinId={highlightPinId}
            onAddPin={handleAddPin}
            onMovePin={handleMovePin}
            onSelectPin={handleSelectPin}
            registerApi={registerMapApi}
          />
          <MapBar map={active} sync={sync} onRename={handleRename} />
          <div class="panel-dock">
            <MapKey open={openPanel === 'key'} onToggle={(o) => handlePanelToggle('key', o)} />
            <RoyalEncampments
              onJump={handleJumpToBlock}
              activeBlock={jumpedBlock}
              open={openPanel === 'royals'}
              onToggle={(o) => handlePanelToggle('royals', o)}
            />
            <details
              class="info-panel legend-panel"
              open={openPanel === 'legend'}
              onToggle={(e) => handlePanelToggle('legend', (e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary class="info-panel-summary" title="Your pins">
                <span class="info-panel-heading">
                  <h2 class="info-panel-title">Your pins</h2>
                  <span class="info-panel-hint">{active.pins.length} pinned</span>
                </span>
              </summary>
              <div class="info-panel-body legend-panel-body">
                <Legend pins={active.pins} highlightPinId={highlightPinId} onSelect={handleSelectPin} />
              </div>
            </details>
          </div>
          {editingPin ? (
            <PinEditor
              key={editingPin.id}
              pin={editingPin}
              onChangeLabel={handleChangeLabel}
              onChangeColor={handleChangeColor}
              onDelete={handleDeletePin}
              onClose={() => setEditingPinId(null)}
            />
          ) : (
            <div class="color-toolbar">
              <ColorPicker
                selected={selectedColor}
                onSelect={setSelectedColor}
                idPrefix="next-pin"
                caption="New pin:"
                compact
              />
            </div>
          )}
          {/* First-run invitation: shown only while the editable map is still empty (0 pins). Once a pin
              exists it has served its purpose and is hidden. Visible at all widths (see .map-hint CSS);
              the trailing detail collapses to just the core instruction on tablet/mobile. */}
          {active.pins.length === 0 && (
            <p class="map-hint">
              Click the map to drop a pin
              <span class="map-hint-detail"> · scroll or drag to explore · {selectedColorName} selected</span>
            </p>
          )}
        </>
      )}

      {mode === 'readonly' && active && (
        <ReadonlyView
          map={active}
          highlightPinId={highlightPinId}
          busy={busy}
          registerMapApi={registerMapApi}
          activeBlock={jumpedBlock}
          onSelectPin={handleSelectPin}
          onDuplicate={handleDuplicate}
          onJumpToBlock={handleJumpToBlock}
        />
      )}

      {/* Polite, visually-hidden announcer for royal-encampment jumps (the on-map pulse is aria-hidden). */}
      <div class="sr-only" role="status" aria-live="polite">{jumpAnnounce}</div>

      {ready && <div id="widget-ready" style={{ display: 'none' }} aria-hidden="true" />}
    </div>
  );
}
