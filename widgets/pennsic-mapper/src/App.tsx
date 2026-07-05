import { useEffect, useRef, useState } from 'preact/hooks';
import { mapStore, type ActiveMap, type MapChange, type SyncStatus, type Pin } from './store';
import { parseHash, editHash, type Route } from './lib/route';
import { PALETTE } from './lib/palette';
import { MapSurface, type MapSurfaceApi } from './components/MapSurface';
import { ColorPicker } from './components/ColorPicker';
import { Legend } from './components/Legend';
import { PinEditor } from './components/PinEditor';
import { MapBar } from './components/MapBar';
import { CreateBar, type CreateStatus } from './components/CreateBar';
import { ReadonlyView } from './components/ReadonlyView';
import { MapKey } from './components/MapKey';
import { RoyalEncampments } from './components/RoyalEncampments';
import { LayersPanel } from './components/LayersPanel';
import type { RoyalEncampment } from './data/mapKey';

// Zoom level a Royal-Encampments jump lands at — tight enough to read block labels, loose enough to
// keep the surrounding neighbourhood in view.
const ENCAMPMENT_JUMP_SCALE = 3.5;

// The modes the app can be in. `preview` is the locked, read-only preview shown before any map exists:
// the map is fully pannable/zoomable and every reference dock panel works, but pin editing and the map
// name are locked until the user explicitly creates a shared map (the creation gate).
type AppMode = 'preview' | 'loading' | 'edit' | 'readonly' | 'error';
type WidgetState = 'ready' | 'empty' | 'populated' | 'loading' | 'error';
type DockPanel = 'key' | 'royals' | 'legend' | 'layers' | null;

// The reference map shown in the locked preview has no pins (nothing has been created yet). One shared
// empty array — it is never mutated.
const PREVIEW_PINS: Pin[] = [];

// Widget-state for the loaded/created modes. `preview`'s state is driven separately by the create gate
// (ready = locked preview, loading = create in flight, error = create failed) so it isn't handled here.
function widgetStateFor(mode: 'edit' | 'readonly', pinCount: number): WidgetState {
  // Both an editable map and a shared map are `empty` until they hold ≥1 pin, then `populated`. These
  // are only ever reachable AFTER a successful creation (or opening an existing map).
  return pinCount > 0 ? 'populated' : 'empty';
}

function setWidgetState(state: WidgetState): void {
  document.documentElement.dataset.widgetState = state;
}

// A caller-generated id. crypto.randomUUID() (not frozen by the journey harness — only Date.now and
// Math.random are — and confirmed available under the file:// render/journey gate) instead of a
// session-local counter: two browser tabs editing the same shared map independently is a real case
// this widget supports, and a counter reseeded from whatever pins happen to be loaded still lets two
// concurrent sessions compute the same "next" id and collide; a UUID can't.
function genId(): string {
  return `pin-${crypto.randomUUID()}`;
}

// No map hash ⇒ a locked preview behind the creation gate; a map hash ⇒ load it.
function initialMode(): AppMode {
  if (typeof location === 'undefined') return 'preview';
  return parseHash(location.hash).mode === 'landing' ? 'preview' : 'loading';
}

export function App() {
  const [mode, setModeState] = useState<AppMode>(initialMode);
  const [active, setActive] = useState<ActiveMap | null>(mapStore.getActive());
  const [sync, setSync] = useState<{ status: SyncStatus; message?: string }>({ status: 'idle' });
  const [selectedColor, setSelectedColor] = useState<string>(PALETTE[0].key);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [highlightPinId, setHighlightPinId] = useState<string | null>(null);
  // Which dock panel is open. Single-open: opening one closes the others AND the pin editor AND the Share
  // popover, so at most one floating surface is ever shown (matters most on mobile). Deterministic from
  // App state.
  const [openPanel, setOpenPanel] = useState<DockPanel>(null);
  // Share popover open state, lifted here (out of MapBar) so App is the single mutual-exclusion authority:
  // opening Share closes any open dock panel + pin editor, and opening either of those closes Share. This
  // is what guarantees Share never has to fight a dock bottom sheet for the top layer on mobile (Fix 1).
  const [shareOpen, setShareOpen] = useState(false);
  // Whether the always-on pin labels are drawn on the map (Layers → "Show pin labels"; on by default).
  const [showLabels, setShowLabels] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  // Creation-gate state for the locked preview: 'idle' shows "Create shared map"; 'creating' shows the
  // in-flight button; 'error' shows an inline message + a "Try again" retry, keeping the preview intact.
  const [createStatus, setCreateStatus] = useState<CreateStatus>('idle');
  const [createError, setCreateError] = useState('');
  // Set when a readonly "Duplicate to edit" attempt fails (offline/server); surfaced in ReadonlyView.
  const [duplicateError, setDuplicateError] = useState('');
  // The currently-mounted MapSurface's imperative API (only one surface is ever mounted at a time).
  const mapApiRef = useRef<MapSurfaceApi | null>(null);
  // Last royal-encampment jumped to: drives the persistent row marker + the screen-reader announcement.
  const [jumpedBlock, setJumpedBlock] = useState<string | null>(null);
  const [jumpAnnounce, setJumpAnnounce] = useState('');

  // Kept alongside the `mode` state itself: the `subscribe` listener below can fire synchronously
  // inside a store call (e.g. clear()'s setActive(null)), before Preact has applied a pending
  // setModeState, so it reads this ref rather than the possibly-stale `mode` closure variable.
  const modeRef = useRef<AppMode>(mode);
  modeRef.current = mode;

  function transitionMode(next: AppMode): void {
    modeRef.current = next;
    setModeState(next);
  }

  const applyRouteRef = useRef<(route: Route) => Promise<void>>(async () => {});
  applyRouteRef.current = async (route: Route) => {
    if (route.mode === 'landing') {
      // No hash ⇒ the locked preview behind the creation gate. No network, no draft, no D1 row: the map
      // is a fully-pannable read-only reference until the user clicks "Create shared map". This is what
      // keeps a casual visit (or a bot) from ever minting a row. Offline-safe by construction.
      mapStore.clear();
      transitionMode('preview');
      setCreateStatus('idle');
      setCreateError('');
      setWidgetState('ready');
      setReady(true);
      return;
    }

    // A just-created or just-duplicated map is already in memory under this same id — reuse it rather
    // than round-tripping a GET (which offline would fail). This is what lets create()/duplicate() swap
    // the hash to the real edit link and land straight in edit mode.
    const existing = mapStore.getActive();
    if (existing && existing.id === route.id) {
      const editable = route.mode === 'edit' && !!existing.secret;
      const next: 'edit' | 'readonly' = editable ? 'edit' : 'readonly';
      transitionMode(next);
      setWidgetState(widgetStateFor(next, existing.pins.length));
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
    const next: 'edit' | 'readonly' = editable ? 'edit' : 'readonly';
    transitionMode(next);
    setWidgetState(widgetStateFor(next, result.map.pins.length));
    setReady(true);
  };

  useEffect(() => {
    const unsub = mapStore.subscribe((change: MapChange) => {
      if (change.type === 'active') {
        setActive(change.map);
        // Only edit/readonly derive their widget-state from the pin count. `preview` (and the transient
        // `loading`/`error` of the create gate) own their state via the gate handlers, so a setActive
        // fired mid-create must not clobber the 'loading'/'error' marker back to 'empty'.
        const m = modeRef.current;
        if (m === 'edit' || m === 'readonly') {
          setWidgetState(widgetStateFor(m, change.map ? change.map.pins.length : 0));
        }
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
    // adding/selecting a pin opens the editor → close any other floating surface (dock panel + Share)
    setOpenPanel(null);
    setShareOpen(false);
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
      setShareOpen(false);
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

  // Opening a dock panel closes the pin editor AND the Share popover (mutual exclusion — only one floating
  // surface at a time); closing it just clears that panel.
  function handlePanelToggle(name: Exclude<DockPanel, null>, isOpen: boolean): void {
    if (isOpen) {
      setOpenPanel(name);
      setEditingPinId(null);
      setShareOpen(false);
    } else {
      setOpenPanel((cur) => (cur === name ? null : cur));
    }
  }

  // Share toggle from the top bar. Opening Share closes any open dock panel + pin editor so the popover
  // never has to overlap another floating surface (the crux of Fix 1, alongside the CSS layer lift).
  function handleShareToggle(next: boolean): void {
    setShareOpen(next);
    if (next) {
      setOpenPanel(null);
      setEditingPinId(null);
    }
  }

  // The creation gate. This is the ONLY entry point that mints a D1 row on the landing/preview path, and
  // it only runs from an explicit click. On success the store holds a real id/secret; we swap the URL to
  // the edit link and applyRoute (reusing the in-memory map) unlocks editing. On failure we stay in the
  // locked preview and surface an inline retry — the page never blanks.
  async function handleCreate(): Promise<void> {
    if (createStatus === 'creating') return;
    setCreateStatus('creating');
    setCreateError('');
    setWidgetState('loading');
    const result = await mapStore.create('Untitled map', []);
    if (!result.ok) {
      setCreateStatus('error');
      setCreateError(result.message);
      setWidgetState('error');
      return;
    }
    setCreateStatus('idle');
    transitionMode('edit');
    setWidgetState(widgetStateFor('edit', result.map.pins.length));
    // applyRoute reuses the just-created in-memory map for this id, so this never re-fetches.
    location.hash = editHash(result.map.id, result.map.secret!);
  }

  // "Duplicate to edit" from a shared map: an explicit user action, so it is allowed to mint a row. It
  // creates a fresh map seeded with copies of the source pins (fresh ids), then lands in edit mode.
  async function handleDuplicate(): Promise<void> {
    if (!active || busy) return;
    setBusy(true);
    setDuplicateError('');
    // Fresh ids throughout: the source pins' ids may collide with this session's own counter.
    const pins = active.pins.map((p) => ({ id: genId(), x: p.x, y: p.y, color: p.color, label: p.label }));
    const result = await mapStore.create(`Copy of ${active.name}`, pins);
    setBusy(false);
    if (!result.ok) {
      setDuplicateError(result.message);
      return;
    }
    transitionMode('edit');
    setWidgetState(widgetStateFor('edit', result.map.pins.length));
    location.hash = editHash(result.map.id, result.map.secret!);
  }

  function goLanding(): void {
    // Clearing the hash re-enters the no-hash branch → the locked preview / creation gate.
    location.hash = '';
  }

  // Pan/zoom the active map to a royal encampment block. Driven synchronously through MapSurface's
  // imperative API so the transform lands in the same click that requested it. Also marks the row and
  // announces the jump: the on-map pulse is aria-hidden and can fade off-screen, so screen-reader and
  // mobile users get a durable, non-visual confirmation of where they landed.
  function handleJumpToBlock(camp: RoyalEncampment): void {
    // Close every floating surface so the map's pan/zoom/pulse is visible — on mobile the open panel is a
    // 70cqh bottom sheet that would otherwise hide the very reaction the jump triggers. (Clearing the pin
    // editor is defensive: a jump is only reachable via the Encampments panel, which already closed it.)
    setOpenPanel(null);
    setShareOpen(false);
    setEditingPinId(null);
    mapApiRef.current?.focusOn(camp.x, camp.y, ENCAMPMENT_JUMP_SCALE);
    setJumpedBlock(camp.block);
    setJumpAnnounce(`Jumped to ${camp.kingdom}, block ${camp.block}.`);
  }

  const registerMapApi = (api: MapSurfaceApi | null): void => {
    mapApiRef.current = api;
  };

  const editingPin = active && editingPinId ? active.pins.find((p) => p.id === editingPinId) ?? null : null;
  const selectedColorName = PALETTE.find((c) => c.key === selectedColor)?.name ?? PALETTE[0].name;
  // `preview` shows the empty reference map; `edit` shows the created map's pins.
  const isEditing = mode === 'edit';
  const mapPins = isEditing && active ? active.pins : PREVIEW_PINS;

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

      {/* The locked preview and the editable map share the same full-bleed map + reference dock. They
          differ only in the top bar (create gate vs rename/share), whether the surface is editable
          (pin dropping), and the editing chrome (pin editor + colour toolbar). Keeping them in one
          branch is what makes the preview→editable transition seamless: only these differences swap. */}
      {(mode === 'preview' || mode === 'edit') && (
        <>
          <h1 class="sr-only">{isEditing && active ? active.name : 'Untitled map'}</h1>
          <MapSurface
            pins={mapPins}
            editable={isEditing}
            editingPinId={editingPinId}
            highlightPinId={highlightPinId}
            showLabels={showLabels}
            onAddPin={handleAddPin}
            onMovePin={handleMovePin}
            onSelectPin={handleSelectPin}
            registerApi={registerMapApi}
          />
          {isEditing && active ? (
            <MapBar
              map={active}
              sync={sync}
              onRename={handleRename}
              shareOpen={shareOpen}
              onShareToggle={handleShareToggle}
            />
          ) : (
            <CreateBar status={createStatus} errorMessage={createError} onCreate={handleCreate} />
          )}
          <div class={`panel-dock${mode === 'preview' && createStatus === 'error' ? ' panel-dock--error-offset' : ''}`}>
            <MapKey open={openPanel === 'key'} onToggle={(o) => handlePanelToggle('key', o)} />
            <RoyalEncampments
              onJump={handleJumpToBlock}
              activeBlock={jumpedBlock}
              open={openPanel === 'royals'}
              onToggle={(o) => handlePanelToggle('royals', o)}
            />
            <LayersPanel
              showLabels={showLabels}
              onToggleLabels={setShowLabels}
              open={openPanel === 'layers'}
              onToggle={(o) => handlePanelToggle('layers', o)}
            />
            <details
              class="info-panel legend-panel"
              open={openPanel === 'legend'}
              onToggle={(e) => handlePanelToggle('legend', (e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary class="info-panel-summary" title="Your pins">
                <span class="info-panel-heading">
                  <h2 class="info-panel-title">Your pins</h2>
                  <span class="info-panel-hint">{mapPins.length} pinned</span>
                </span>
              </summary>
              <div class="info-panel-body legend-panel-body">
                <Legend pins={mapPins} highlightPinId={highlightPinId} onSelect={handleSelectPin} />
              </div>
            </details>
          </div>
          {/* Editing chrome (pin editor / colour toolbar) is edit-only: there is nothing to edit in the
              locked preview until a map is created. */}
          {isEditing && active && (
            editingPin ? (
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
            )
          )}
          {/* A slim floating hint. In the locked preview it explains why pins can't be dropped yet and
              points at the create action; in an empty editable map it's the first-run "drop a pin"
              invitation. Both hide once there's a pin (or nothing more to say). */}
          {mode === 'preview' && createStatus === 'idle' ? (
            <p class="map-hint">
              Create a shared map to start dropping pins
              <span class="map-hint-detail"> · scroll or drag to explore the map</span>
            </p>
          ) : mode === 'edit' && active && active.pins.length === 0 ? (
            <p class="map-hint">
              Click the map to drop a pin
              <span class="map-hint-detail"> · scroll or drag to explore · {selectedColorName} selected</span>
            </p>
          ) : null}
        </>
      )}

      {mode === 'readonly' && active && (
        <ReadonlyView
          map={active}
          highlightPinId={highlightPinId}
          busy={busy}
          duplicateError={duplicateError}
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
