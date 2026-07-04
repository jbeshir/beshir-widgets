import type { ActiveMap } from '../store';
import { MapSurface, type MapSurfaceApi } from './MapSurface';
import { Legend } from './Legend';
import { MapKey } from './MapKey';
import { RoyalEncampments } from './RoyalEncampments';
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

// A shared map viewed without its secret: map + pins + legend, no editing controls at all. The only
// action offered is duplicating it into a new local draft the visitor can then edit. The map key and
// royal-encampments reference panels are shown here too, so a visitor can read the printed legend and
// find a kingdom's block just as an editor can.
export function ReadonlyView({ map, highlightPinId, busy, registerMapApi, activeBlock, onSelectPin, onDuplicate, onJumpToBlock }: Props) {
  return (
    <div class="readonly-view">
      <p class="readonly-eyebrow">Shared map</p>
      <h1 class="readonly-title">{map.name}</h1>
      <MapSurface
        pins={map.pins}
        editable={false}
        editingPinId={null}
        highlightPinId={highlightPinId}
        onAddPin={() => {}}
        onMovePin={() => {}}
        onSelectPin={onSelectPin}
        registerApi={registerMapApi}
      />
      <Legend pins={map.pins} highlightPinId={highlightPinId} onSelect={onSelectPin} />
      <button type="button" class="button-primary" data-testid="duplicate-map" disabled={busy} onClick={onDuplicate}>
        {busy ? 'Copying…' : 'Duplicate to edit'}
      </button>
      <p class="readonly-duplicate-caption">Creates your own copy you can edit — the original won't change.</p>
      <MapKey />
      <RoyalEncampments onJump={onJumpToBlock} activeBlock={activeBlock} />
    </div>
  );
}
