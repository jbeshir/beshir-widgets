import type { ActiveMap } from '../store';
import { MapSurface } from './MapSurface';
import { Legend } from './Legend';

interface Props {
  map: ActiveMap;
  highlightPinId: string | null;
  busy: boolean;
  onSelectPin: (id: string) => void;
  onDuplicate: () => void;
}

// A shared map viewed without its secret: map + pins + legend, no editing controls at all. The only
// action offered is duplicating it into a new local draft the visitor can then edit.
export function ReadonlyView({ map, highlightPinId, busy, onSelectPin, onDuplicate }: Props) {
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
      />
      <Legend pins={map.pins} highlightPinId={highlightPinId} onSelect={onSelectPin} />
      <button type="button" class="button-primary" data-testid="duplicate-map" disabled={busy} onClick={onDuplicate}>
        {busy ? 'Copying…' : 'Duplicate to edit'}
      </button>
      <p class="readonly-duplicate-caption">Creates your own copy you can edit — the original won't change.</p>
    </div>
  );
}
