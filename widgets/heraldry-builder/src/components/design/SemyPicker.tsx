// The scatter of a part of the background or of a band: the picture strewn over it (a semy) and the colour of the
// pictures. The colour it is strewn on is the colour picker above, which keeps the scatter. One of the options of
// "More colours and patterns…", offered only where something can be strewn.

import {
  CHARGES, chargeLabel, clearSemy, semyAt, semyChoices, semyColourChoices, setSemy, setSemyColour,
  type ChargeId, type Design, type PaintTarget,
} from '../../lib/heraldry';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  target: PaintTarget;
  /** Swatch testid group: swatch-<group>-semy-2 for the colour of the pictures. */
  group: string;
  testid: string;
  /** What is strewn: "the bend", "the left half". */
  noun: string;
  onChange: (design: Design) => void;
}

export function SemyPicker({ design, target, group, testid, noun, onChange }: Props) {
  const choices = semyChoices(design, target);
  const semy = semyAt(design, target);
  const selectId = `${testid}-semy-select`;
  const blocked = choices.find((c) => !c.allowed && c.value === semy?.charge.charge);
  return (
    <div class="fur-picker">
      <div class="control">
        <label class="picker-legend" for={selectId}>Picture scattered over {noun}</label>
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
      {semy && (
        <TincturePicker
          group={`${group}-semy-2`}
          testid={`${testid}-semy-colour-2`}
          legend={`Colour of the ${CHARGES[semy.charge.charge].plural}`}
          choices={semyColourChoices(design, target, 1)}
          value={semy.ink.t}
          onChange={(t) => onChange(setSemyColour(design, target, 1, t))}
        />
      )}
    </div>
  );
}
