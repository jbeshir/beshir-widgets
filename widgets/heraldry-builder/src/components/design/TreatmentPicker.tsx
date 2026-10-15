// The treatment of a part of the background or of a band or picture: masoned (a brick wall), scaly and papellony (scales),
// one option per treatment with a small swatch, and the two tinctures it is made of. Opt-in, like the fur beside it, so the
// tincture picker stays as it was.

import {
  TREATMENT_LABEL, setTreatment, setTreatmentColour, treatedPaint, treatmentAt, treatmentChoices, treatmentColourChoices, treatmentPattern,
  type Design, type PaintTarget, type Treatment,
} from '../../lib/heraldry';
import { capitalise } from '../../lib/heraldry/words';
import { ChoiceButton, RadioGroup } from './Choices';
import { FillChip } from './FillChip';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  target: PaintTarget;
  /** Swatch testid group: swatch-<group>-treatment-1 and -treatment-2 for the colours. */
  group: string;
  testid: string;
  legend: string;
  onChange: (design: Design) => void;
}

/** A square of the treatment in gold and sable, drawn at the scale of a swatch. */
function TreatmentChip({ treatment, uid }: { treatment: Treatment; uid: string }) {
  return <FillChip spec={treatmentPattern(treatedPaint(treatment, 'or', 'sable'), 0.5)} id={`treatment-chip-${uid}-${treatment}`} />;
}

export function TreatmentPicker({ design, target, group, testid, legend, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const treated = treatmentAt(design, target);
  return (
    <details class="fur-picker" data-testid={`${testid}-treatment`} open={treated !== null}>
      <summary>{legend}</summary>
      <RadioGroup label={legend} class="segmented segmented-wide" testid={`${testid}-treatment-select`}>
        {treatmentChoices(design, target).map((c) => (
          <ChoiceButton
            key={c.value} testid={`${testid}-treatment-${c.value}`} checked={treated?.treatment === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
            label={capitalise(TREATMENT_LABEL[c.value].term)} title={TREATMENT_LABEL[c.value].plain} onSelect={() => onChange(setTreatment(design, target, c.value))} onBlocked={explain} class="segment"
          >
            <TreatmentChip treatment={c.value} uid={group} />
            <span>{capitalise(TREATMENT_LABEL[c.value].term)}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      {treated && ([0, 1] as const).map((slot) => (
        <TincturePicker
          key={slot}
          group={`${group}-treatment-${slot + 1}`}
          testid={`${testid}-treatment-colour-${slot + 1}`}
          legend={slot === 0 ? 'Colour it is laid on' : 'Colour of the lines'}
          choices={treatmentColourChoices(design, target, slot)}
          value={slot === 0 ? treated.ground.t : treated.ink}
          onChange={(t) => onChange(setTreatmentColour(design, target, slot, t))}
        />
      ))}
      {explainer}
    </details>
  );
}
