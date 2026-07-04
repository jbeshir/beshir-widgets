import { useEffect, useRef, useState } from 'preact/hooks';
import type { ActiveMap } from '../store';
import { MapSurface, type MapSurfaceApi } from './MapSurface';
import { Legend } from './Legend';
import { MapKey } from './MapKey';
import { RoyalEncampments } from './RoyalEncampments';
import { LayersPanel } from './LayersPanel';
import type { RoyalEncampment } from '../data/mapKey';

interface Props {
  map: ActiveMap;
  highlightPinId: string | null;
  busy: boolean;
  /** Set when the last "Duplicate to edit" attempt failed (e.g. offline); shown inline beside the button. */
  duplicateError?: string;
  registerMapApi: (api: MapSurfaceApi | null) => void;
  activeBlock: string | null;
  onSelectPin: (id: string) => void;
  onDuplicate: () => void;
  onJumpToBlock: (camp: RoyalEncampment) => void;
}

type DockPanel = 'key' | 'royals' | 'legend' | 'layers' | null;

// A shared map viewed without its secret: the full-bleed map + floating chrome, but no editing. The
// top bar shows the map name (read-only) + a Duplicate action; the left dock carries the map key, royal
// encampments, and the pin legend. The only action offered is duplicating the map into a new local
// draft the visitor can then edit.
export function ReadonlyView({ map, highlightPinId, busy, duplicateError, registerMapApi, activeBlock, onSelectPin, onDuplicate, onJumpToBlock }: Props) {
  // Single-open dock: opening one panel closes the others (avoids two bottom sheets on mobile).
  const [openPanel, setOpenPanel] = useState<DockPanel>(null);
  // On-map pin labels toggle (Layers → "Show pin labels"; on by default), same as the editable view.
  const [showLabels, setShowLabels] = useState(true);
  const duplicateBtnRef = useRef<HTMLButtonElement>(null);

  // Refocus the (now "Try again") Duplicate button after a failed attempt, so a keyboard user can retry
  // immediately — mirrors the create gate. We use aria-disabled (not the native attribute) below so
  // focus is never dropped while the request is in flight.
  useEffect(() => {
    if (duplicateError) duplicateBtnRef.current?.focus();
  }, [duplicateError]);
  function panelToggle(name: Exclude<DockPanel, null>, isOpen: boolean): void {
    if (isOpen) setOpenPanel(name);
    else setOpenPanel((cur) => (cur === name ? null : cur));
  }

  // Mirror App's dock behaviour: closing any open dock panel on a jump keeps the map's pan/zoom/pulse
  // visible (the open panel is a bottom sheet on mobile that would otherwise hide it).
  function handleJump(camp: RoyalEncampment): void {
    setOpenPanel(null);
    onJumpToBlock(camp);
  }

  return (
    <>
      <h1 class="sr-only">{map.name}</h1>
      <div class="map-topbar map-topbar-readonly">
        <div class="topbar-main-row">
          <div class="readonly-topbar-title">
            <span class="readonly-eyebrow">Shared map</span>
            <span class="readonly-title">{map.name}</span>
          </div>
          <p class="readonly-topbar-caption">Creates your own editable copy — the original won't change.</p>
          <button
            ref={duplicateBtnRef}
            type="button"
            class="button-primary share-toggle"
            data-testid="duplicate-map"
            aria-disabled={busy}
            aria-busy={busy}
            aria-label={busy ? 'Duplicating this map…' : duplicateError ? 'Try duplicating this map again' : 'Duplicate this map to edit your own copy'}
            aria-describedby={duplicateError ? 'duplicate-gate-error' : undefined}
            onClick={() => {
              if (!busy) onDuplicate();
            }}
          >
            {busy ? 'Copying…' : duplicateError ? 'Try again' : 'Duplicate to edit'}
          </button>
        </div>
        {duplicateError && (
          <p class="topbar-error" id="duplicate-gate-error" role="alert" data-testid="duplicate-error">
            {duplicateError}
          </p>
        )}
      </div>
      <MapSurface
        pins={map.pins}
        editable={false}
        editingPinId={null}
        highlightPinId={highlightPinId}
        showLabels={showLabels}
        onAddPin={() => {}}
        onMovePin={() => {}}
        onSelectPin={onSelectPin}
        registerApi={registerMapApi}
      />
      <div class={`panel-dock${duplicateError ? ' panel-dock--error-offset' : ''}`}>
        <MapKey open={openPanel === 'key'} onToggle={(o) => panelToggle('key', o)} />
        <RoyalEncampments
          onJump={handleJump}
          activeBlock={activeBlock}
          open={openPanel === 'royals'}
          onToggle={(o) => panelToggle('royals', o)}
        />
        <LayersPanel
          showLabels={showLabels}
          onToggleLabels={setShowLabels}
          open={openPanel === 'layers'}
          onToggle={(o) => panelToggle('layers', o)}
        />
        <details
          class="info-panel legend-panel"
          open={openPanel === 'legend'}
          onToggle={(e) => panelToggle('legend', (e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary class="info-panel-summary" title="Pins on this map">
            <span class="info-panel-heading">
              <h2 class="info-panel-title">Pins on this map</h2>
              <span class="info-panel-hint">{map.pins.length} pinned</span>
            </span>
          </summary>
          <div class="info-panel-body legend-panel-body">
            <Legend pins={map.pins} highlightPinId={highlightPinId} onSelect={onSelectPin} />
          </div>
        </details>
      </div>
    </>
  );
}
