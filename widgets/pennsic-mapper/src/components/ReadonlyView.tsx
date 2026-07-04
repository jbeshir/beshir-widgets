import { useState } from 'preact/hooks';
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
export function ReadonlyView({ map, highlightPinId, busy, registerMapApi, activeBlock, onSelectPin, onDuplicate, onJumpToBlock }: Props) {
  // Single-open dock: opening one panel closes the others (avoids two bottom sheets on mobile).
  const [openPanel, setOpenPanel] = useState<DockPanel>(null);
  // On-map pin labels toggle (Layers → "Show pin labels"; on by default), same as the editable view.
  const [showLabels, setShowLabels] = useState(true);
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
        <div class="readonly-topbar-title">
          <span class="readonly-eyebrow">Shared map</span>
          <span class="readonly-title">{map.name}</span>
        </div>
        <p class="readonly-topbar-caption">Creates your own editable copy — the original won't change.</p>
        <button
          type="button"
          class="button-primary share-toggle"
          data-testid="duplicate-map"
          disabled={busy}
          aria-label="Duplicate this map to edit your own copy"
          onClick={onDuplicate}
        >
          {busy ? 'Copying…' : 'Duplicate to edit'}
        </button>
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
      <div class="panel-dock">
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
