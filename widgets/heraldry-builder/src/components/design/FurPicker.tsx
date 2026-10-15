// The fur of a part of the background or of a band or picture: ermine, vair, potent and their kin, one per option with a
// small swatch of how it looks, and for the furs that take them the two colours it is made of. Opt-in, like the split
// of a colour, so the tincture picker beside it stays as it was.

import {
  FUR_LABEL, TINCTURE_FILL, furAt, furChoices, furColourChoices, furColours, furKindOf, furPattern, setFur, setFurColour, takesColours,
  type Design, type FurKind, type FurTarget,
} from '../../lib/heraldry';
import { capitalise } from '../../lib/heraldry/words';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  target: FurTarget;
  /** Swatch testid group: swatch-<group>-fur-1 and -fur-2 for the colours. */
  group: string;
  testid: string;
  legend: string;
  onChange: (design: Design) => void;
}

/** A square of the fur, drawn at the scale of a swatch. */
function FurChip({ kind, uid }: { kind: FurKind; uid: string }) {
  const spec = furPattern({ k: 'fur', fur: kind === 'ermined' ? 'ermine' : kind === 'vairy' ? 'vair' : kind === 'potenty' ? 'potent' : kind, colours: null }, 0.5);
  const id = `fur-chip-${uid}-${kind}`;
  const fill = (t: typeof spec.ground) => TINCTURE_FILL[t.t];
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={spec.width} height={spec.height} patternTransform={spec.transform ?? undefined}>
          <rect width={spec.width} height={spec.height} fill={fill(spec.ground)} />
          {spec.marks.map((m, i) => <path key={i} d={m.d} fill={fill(m.colour)} />)}
        </pattern>
      </defs>
      <rect width="28" height="28" fill={`url(#${id})`} stroke="#222222" stroke-width="1" />
    </svg>
  );
}

export function FurPicker({ design, target, group, testid, legend, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const fur = furAt(design, target);
  const current = fur && furKindOf(fur);
  const choices = furChoices(design, target);
  return (
    <details class="fur-picker" data-testid={`${testid}-fur`} open={fur !== null}>
      <summary>{legend}</summary>
      <RadioGroup label={legend} class="segmented segmented-wide" testid={`${testid}-fur-select`}>
        {choices.map((c) => (
          <ChoiceButton
            key={c.value} testid={`${testid}-fur-${c.value}`} checked={current === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
            label={capitalise(FUR_LABEL[c.value].term)} title={FUR_LABEL[c.value].plain} onSelect={() => onChange(setFur(design, target, c.value))} onBlocked={explain} class="segment"
          >
            <FurChip kind={c.value} uid={group} />
            <span>{capitalise(FUR_LABEL[c.value].term)}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      {fur && takesColours(fur.fur) && ([0, 1] as const).map((slot) => (
        <TincturePicker
          key={slot}
          group={`${group}-fur-${slot + 1}`}
          testid={`${testid}-fur-colour-${slot + 1}`}
          legend={slot === 0 ? 'Fur background' : 'Fur spots, bells or crutch-heads'}
          choices={furColourChoices(design, target, slot)}
          value={furColours(fur)[slot]}
          onChange={(t) => onChange(setFurColour(design, target, slot, t))}
        />
      ))}
      {explainer}
    </details>
  );
}
