// The fur of a part of the background or of a band or picture, in three rows: the kind of fur (spots, bells or
// crutch-heads), for bells and crutch-heads how they are set, and for the furs that take them its two colours. The
// named fur (ermine, pean, counter-vair…) follows from those choices and is said under them. One of the options of
// "More colours and patterns…".

import {
  FUR_FAMILY_LABEL, FUR_LAYOUT_PLAIN, FUR_NAME, FUR_SPEC, familyOfKind, furAt, furChoices, furColourChoices, furColours, furGloss, furOfKind, furPattern,
  plainFirst, setFur, setFurColour, takesColours,
  type Choice, type Design, type FurFamily, type FurKind, type FurSpec, type PaintTarget,
} from '../../lib/heraldry';
import { ChoiceButton, RadioGroup, type OptionStatus } from './Choices';
import { FillChip } from './FillChip';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

type FurLayout = FurSpec['layout'];

interface Props {
  design: Design;
  target: PaintTarget;
  /** Swatch testid group: swatch-<group>-fur-1 and -fur-2 for the colours. */
  group: string;
  testid: string;
  /** What the fur is of: "the bend", "the left half". */
  noun: string;
  onChange: (design: Design) => void;
}

const FAMILIES: readonly FurFamily[] = ['ermine', 'vair', 'potent'];
const LAYOUTS: readonly FurLayout[] = ['plain', 'counter', 'en-pointe'];
const layoutOfKind = (kind: FurKind): FurLayout => FUR_SPEC[furOfKind(kind)].layout;

/** The two colours' legends: the ground and its spots, or the two sets of bells or crutch-heads. */
const COLOUR_LEGEND: Record<FurFamily, [string, string]> = {
  ermine: ['Colour of the fur', 'Colour of the spots'],
  vair: ['First colour of the bells', 'Second colour of the bells'],
  potent: ['First colour of the crutch-heads', 'Second colour of the crutch-heads'],
};

/** A square of the fur, drawn at the scale of a swatch. */
function FurChip({ kind, uid }: { kind: FurKind; uid: string }) {
  const spec = furPattern({ k: 'fur', fur: furOfKind(kind), colours: null }, 0.5);
  return <FillChip spec={spec} id={`fur-chip-${uid}-${kind}`} />;
}

/** The first allowed of these kinds (the named fur comes first), or why none is. */
function firstOf(choices: Choice<FurKind>[]): { kind: FurKind; status: OptionStatus } | null {
  const allowed = choices.find((c) => c.allowed);
  if (allowed) return { kind: allowed.value, status: { kind: 'open' } };
  const first = choices[0];
  return first && !first.allowed ? { kind: first.value, status: { kind: 'blocked', reason: first.reason } } : null;
}

export function FurPicker({ design, target, group, testid, noun, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const fur = furAt(design, target);
  const family = fur && FUR_SPEC[fur.fur].family;
  const choices = furChoices(design, target);
  const inFamily = (f: FurFamily) => choices.filter((c) => familyOfKind(c.value) === f);
  return (
    <div class="fur-picker">
      <p class="picker-legend">Fur of {noun}</p>
      <RadioGroup label={`Fur of ${noun}`} class="segmented segmented-wide" testid={`${testid}-fur-select`}>
        {FAMILIES.map((f) => {
          const pick = firstOf(inFamily(f));
          if (!pick) return null;
          const label = plainFirst(FUR_FAMILY_LABEL[f]);
          return (
            <ChoiceButton
              key={f} testid={`${testid}-fur-${f}`} checked={family === f} status={pick.status}
              label={label} onSelect={() => onChange(setFur(design, target, pick.kind))} onBlocked={explain} class="segment"
            >
              <FurChip kind={f} uid={`${group}-family`} />
              <span>{label}</span>
            </ChoiceButton>
          );
        })}
      </RadioGroup>
      {fur && family !== 'ermine' && family && (
        <>
          <p class="picker-legend">How the {family === 'vair' ? 'bells' : 'crutch-heads'} are set</p>
          <RadioGroup label={`How the ${family === 'vair' ? 'bells' : 'crutch-heads'} are set`} class="segmented segmented-wide" testid={`${testid}-fur-layout`}>
            {LAYOUTS.map((layout) => {
              const pick = firstOf(inFamily(family).filter((c) => layoutOfKind(c.value) === layout));
              if (!pick) return null;
              const label = `${FUR_LAYOUT_PLAIN[layout]} · ${FUR_NAME[furOfKind(pick.kind)]}`;
              return (
                <ChoiceButton
                  key={layout} testid={`${testid}-fur-layout-${layout}`} checked={FUR_SPEC[fur.fur].layout === layout} status={pick.status}
                  label={label} onSelect={() => onChange(setFur(design, target, pick.kind))} onBlocked={explain} class="segment"
                >
                  <FurChip kind={pick.kind} uid={`${group}-layout`} />
                  <span>{label}</span>
                </ChoiceButton>
              );
            })}
          </RadioGroup>
        </>
      )}
      {fur && takesColours(fur.fur) && ([0, 1] as const).map((slot) => (
        <TincturePicker
          key={slot}
          group={`${group}-fur-${slot + 1}`}
          testid={`${testid}-fur-colour-${slot + 1}`}
          legend={COLOUR_LEGEND[FUR_SPEC[fur.fur].family][slot]}
          choices={furColourChoices(design, target, slot)}
          value={furColours(fur)[slot]}
          onChange={(t) => onChange(setFurColour(design, target, slot, t))}
        />
      ))}
      {fur && <p class="control-note" data-testid={`${testid}-fur-name`}>This is {furGloss(fur)}.</p>}
      {explainer}
    </div>
  );
}
