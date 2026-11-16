import type { JSX } from 'preact';
import { PLATES } from '../data/plates';
import { selectPlate, useStore } from '../store';

interface PlateSelectProps {
  /** `plate-select` in the settings; the copy inside a lesson step has its own id so both can be told apart. */
  testId: string;
  /** Marks this control as the step's `plate-selector` highlight target. */
  part?: boolean;
}

/** The plate menu. Every instance is bound to the same store state. */
export function PlateSelect({ testId, part = false }: PlateSelectProps): JSX.Element {
  const state = useStore();
  const exactPlateLatitude = Math.abs(state.location.lat);
  const exactPlateValue = `exact:${exactPlateLatitude}`;
  const plateValue = state.plateLatitude === exactPlateLatitude ? exactPlateValue : String(state.plateLatitude);
  return <label>Plate <select data-testid={testId} data-part={part ? 'plate-selector' : undefined}
    aria-label="Plate latitude; Exact uses the current location latitude" value={plateValue} onChange={(event) => {
      selectPlate(event.currentTarget.value.startsWith('exact:') ? exactPlateLatitude : Number(event.currentTarget.value));
    }}>
    <option value={exactPlateValue}>Exact</option>
    {PLATES.map((plate) => <option key={plate.latitude} value={plate.latitude}>{plate.label}</option>)}
  </select></label>;
}
