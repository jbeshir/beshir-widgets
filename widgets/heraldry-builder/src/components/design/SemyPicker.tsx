// The scatter of a part of the background or of a band: the picture strewn over it (a semy), its colour and the colour of the
// pictures. Opt-in, like the fur beside it: folded under the tincture picker until a semy is chosen.

import {
  CHARGES, chargeLabel, clearSemy, semyAt, semyChoices, semyColourChoices, setSemy, setSemyColour,
  type ChargeId, type Design, type PaintTarget,
} from '../../lib/heraldry';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  target: PaintTarget;
  /** Swatch testid group: swatch-<group>-semy-1 and -semy-2 for the colours. */
  group: string;
  testid: string;
  legend: string;
  onChange: (design: Design) => void;
}

export function SemyPicker({ design, target, group, testid, legend, onChange }: Props) {
  const choices = semyChoices(design, target);
  if (choices.length === 0) return null;
  const semy = semyAt(design, target);
  const selectId = `${testid}-semy-select`;
  const blocked = choices.find((c) => !c.allowed && c.value === semy?.charge.charge);
  return (
    <details class="fur-picker" data-testid={`${testid}-semy`} open={semy !== null}>
      <summary>{legend}</summary>
      <div class="control">
        <label class="picker-legend" for={selectId}>Picture scattered over it</label>
        <select
          id={selectId}
          class="select"
          data-testid={selectId}
          value={semy?.charge.charge ?? ''}
          onChange={(e) => {
            const value = (e.currentTarget as HTMLSelectElement).value;
            onChange(value === '' ? clearSemy(design, target) : setSemy(design, target, value as ChargeId));
          }}
        >
          <option value="">None</option>
          {choices.map((c) => (
            <option key={c.value} value={c.value} disabled={!c.allowed} title={c.allowed ? undefined : c.reason}>
              {chargeLabel(c.value)}{c.allowed ? '' : ' (not here)'}
            </option>
          ))}
        </select>
        {blocked && !blocked.allowed && <p class="field-hint">{blocked.reason}</p>}
      </div>
      {semy && ([0, 1] as const).map((slot) => (
        <TincturePicker
          key={slot}
          group={`${group}-semy-${slot + 1}`}
          testid={`${testid}-semy-colour-${slot + 1}`}
          legend={slot === 0 ? 'Colour it is strewn on' : `Colour of the ${CHARGES[semy.charge.charge].plural}`}
          choices={semyColourChoices(design, target, slot)}
          value={slot === 0 ? semy.ground.t : semy.ink.t}
          onChange={(t) => onChange(setSemyColour(design, target, slot, t))}
        />
      ))}
    </details>
  );
}
