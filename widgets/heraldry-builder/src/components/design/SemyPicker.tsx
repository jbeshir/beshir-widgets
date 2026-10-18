// The scatter of a part of the background or of a band: the picture strewn over it (a semy) and the colour of the
// pictures. The colour it is strewn on is the colour picker above, which keeps the scatter. One of the options of
// "More colours and patterns…", offered only where something can be strewn.

import {
  CHARGES, clearSemy, semyAt, semyChoices, semyColourChoices, setSemy, setSemyColour,
  type Design, type PaintTarget,
} from '../../lib/heraldry';
import { ChargePicker, NoneIcon } from './ChargePicker';
import { ChoiceButton } from './Choices';
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
  const base = `${testid}-semy-charge`;
  const blocked = choices.find((c): c is Extract<typeof c, { allowed: false }> => !c.allowed && c.value === semy?.charge.charge);
  return (
    <div class="fur-picker">
      <div class="control">
        <p class="picker-legend">Picture scattered over {noun}</p>
        <ChargePicker
          base={base}
          selected={semy?.charge.charge ?? null}
          none={
            <ChoiceButton testid={`${base}-none`} checked={!semy} label="No picture" onSelect={() => onChange(clearSemy(design, target))} onBlocked={() => {}} class="icon-choice charge-choice">
              <NoneIcon />
              <span class="choice-label">None</span>
            </ChoiceButton>
          }
          status={(id) => {
            const c = choices.find((choice) => choice.value === id);
            return c && !c.allowed ? { kind: 'blocked', reason: c.reason } : { kind: 'open' };
          }}
          onSelect={(id) => onChange(setSemy(design, target, id))}
        />
        {blocked && <p class="field-hint">{blocked.reason}</p>}
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
