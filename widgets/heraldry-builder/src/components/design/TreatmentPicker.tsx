// The treatment of a part of the background or of a band or picture: masoned (a brick wall), scaly and papellony (scales),
// one option per treatment with a small swatch, and the colour of its lines. The colour it is laid on is the colour picker
// above, which keeps the treatment. One of the options of "More colours and patterns…".

import {
  TREATMENT_LABEL, clearTreatment, plainFirst, setTreatment, setTreatmentColour, treatedPaint, treatmentAt, treatmentChoices, treatmentColourChoices, treatmentPattern,
  type Design, type PaintTarget, type Treatment,
} from '../../lib/heraldry';
import { ChoiceButton, RadioGroup } from './Choices';
import { FillChip } from './FillChip';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  target: PaintTarget;
  /** Swatch testid group: swatch-<group>-treatment-2 for the colour of the lines. */
  group: string;
  testid: string;
  /** What is treated: "the bend", "the left half". */
  noun: string;
  onChange: (design: Design) => void;
}

/** A square of the treatment in gold and sable, drawn at the scale of a swatch. */
function TreatmentChip({ treatment, uid }: { treatment: Treatment; uid: string }) {
  return <FillChip spec={treatmentPattern(treatedPaint(treatment, 'or', 'sable'), 0.5)} id={`treatment-chip-${uid}-${treatment}`} />;
}

export function TreatmentPicker({ design, target, group, testid, noun, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const treated = treatmentAt(design, target);
  return (
    <div class="fur-picker">
      <p class="picker-legend">Brick or scales on {noun}</p>
      <RadioGroup label={`Brick or scales on ${noun}`} class="segmented segmented-wide" testid={`${testid}-treatment-select`}>
        {treatmentChoices(design, target).map((c) => (
          <ChoiceButton
            key={c.value} testid={`${testid}-treatment-${c.value}`} checked={treated?.treatment === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
            label={plainFirst(TREATMENT_LABEL[c.value])} onSelect={() => onChange(setTreatment(design, target, c.value))} onBlocked={explain} class="segment"
          >
            <TreatmentChip treatment={c.value} uid={group} />
            <span>{plainFirst(TREATMENT_LABEL[c.value])}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      {treated && (
        <TincturePicker
          group={`${group}-treatment-2`}
          testid={`${testid}-treatment-colour-2`}
          legend="Colour of the lines"
          choices={treatmentColourChoices(design, target, 1)}
          value={treated.ink}
          onChange={(t) => onChange(setTreatmentColour(design, target, 1, t))}
        />
      )}
      {treated && (
        <p>
          <button type="button" class="button-tertiary" data-testid={`${testid}-treatment-none`} onClick={() => onChange(clearTreatment(design, target))}>
            No brick or scales
          </button>
        </p>
      )}
      {explainer}
    </div>
  );
}
