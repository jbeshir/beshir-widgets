import { useEffect, useRef, useState } from 'preact/hooks';
import { mapStore, type ActiveMap, type MapChange, type SyncStatus } from './store';
import { parseHash, type Route } from './lib/route';
import { PALETTE } from './lib/palette';
import { MapSurface } from './components/MapSurface';
import { ColorPicker } from './components/ColorPicker';
import { Legend } from './components/Legend';
import { PinEditor } from './components/PinEditor';
import { MapBar } from './components/MapBar';
import { ReadonlyView } from './components/ReadonlyView';

type AppMode = 'landing' | 'loading' | 'edit' | 'readonly' | 'error';
type WidgetState = 'ready' | 'empty' | 'populated' | 'loading' | 'error';

function widgetStateFor(mode: AppMode, pinCount: number): WidgetState {
  if (mode === 'loading') return 'loading';
  if (mode === 'error') return 'error';
  if (mode === 'landing') return 'ready';
  return pinCount > 0 ? 'populated' : 'empty';
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

function initialMode(): AppMode {
  if (typeof location === 'undefined') return 'landing';
  return parseHash(location.hash).mode === 'landing' ? 'landing' : 'loading';
}

export function App() {
  const [mode, setModeState] = useState<AppMode>(initialMode);
  const [active, setActive] = useState<ActiveMap | null>(mapStore.getActive());
  const [sync, setSync] = useState<{ status: SyncStatus; message?: string }>({ status: 'idle' });
  const [selectedColor, setSelectedColor] = useState<string>(PALETTE[0].key);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [highlightPinId, setHighlightPinId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

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
      mapStore.clear();
      transitionMode('landing');
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

  function startNewMap(): void {
    if (mode !== 'landing') return;
    transitionMode('edit');
    mapStore.startLocalDraft('Untitled map');
    setWidgetState('empty');
  }

  function handleAddPin(x: number, y: number): void {
    if (mode !== 'edit') return;
    const id = genId();
    mapStore.addPin({ id, x, y, color: selectedColor, label: '' });
    setEditingPinId(id);
    setWidgetState('populated');
  }

  function handleMovePin(id: string, x: number, y: number): void {
    if (mode !== 'edit') return;
    mapStore.movePin(id, x, y);
  }

  function handleSelectPin(id: string): void {
    if (mode === 'edit') {
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
    location.hash = '';
  }

  const editingPin = active && editingPinId ? active.pins.find((p) => p.id === editingPinId) ?? null : null;

  return (
    <div class="app">
      {mode === 'landing' && (
        <div class="landing">
          <p class="landing-eyebrow">Pennsic Mapper</p>
          <h1 class="landing-title">Sketch your camp on the war map</h1>
          <p class="landing-subtitle">Drop pins for your campsite, favourite haunts, and meetup spots — then share the link.</p>
          <MapSurface
            pins={[]}
            editable={false}
            editingPinId={null}
            highlightPinId={null}
            onAddPin={() => {}}
            onMovePin={() => {}}
            onSelectPin={() => {}}
          />
          <button type="button" class="button-primary" data-testid="start-new-map" onClick={startNewMap}>
            Start a new map
          </button>
        </div>
      )}

      {mode === 'loading' && (
        <div class="status-view" role="status">
          <p>Loading map…</p>
        </div>
      )}

      {mode === 'error' && (
        <div class="status-view">
          <p class="landing-eyebrow">Pennsic Mapper</p>
          <p role="alert">We couldn't load that map. It may be offline, deleted, or the link may be wrong.</p>
          <button type="button" class="button-secondary" onClick={goLanding}>
            Back to start
          </button>
        </div>
      )}

      {mode === 'edit' && active && (
        <main class="editor">
          <h1 class="sr-only">{active.name}</h1>
          <MapBar map={active} sync={sync} onRename={handleRename} />
          <MapSurface
            pins={active.pins}
            editable
            editingPinId={editingPinId}
            highlightPinId={highlightPinId}
            onAddPin={handleAddPin}
            onMovePin={handleMovePin}
            onSelectPin={handleSelectPin}
          />
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
            <ColorPicker
              selected={selectedColor}
              onSelect={setSelectedColor}
              idPrefix="next-pin"
              caption="Colour for new pins"
            />
          )}
          <Legend pins={active.pins} highlightPinId={highlightPinId} onSelect={handleSelectPin} />
        </main>
      )}

      {mode === 'readonly' && active && (
        <ReadonlyView
          map={active}
          highlightPinId={highlightPinId}
          busy={busy}
          onSelectPin={handleSelectPin}
          onDuplicate={handleDuplicate}
        />
      )}

      {ready && <div id="widget-ready" style={{ display: 'none' }} aria-hidden="true" />}
    </div>
  );
}
