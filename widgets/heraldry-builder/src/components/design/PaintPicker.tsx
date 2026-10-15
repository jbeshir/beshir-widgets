// The colour of a band or picture: the tincture picker, and on request the same thing split in two ("per pale azure
// and Or"), with a division and a tincture for each part. Splitting is opt-in so the plain picker stays as it was.

import {
  DIVISION_LABEL, asParty, groupAt, groupTinctureChoices, groupTinctureOf, joinGroup, partyDivisionChoices, partyTinctureChoices, splitGroup,
  setPartyDivision, setPartyTincture, type Design, type GroupPath,
} from '../../lib/heraldry';
import { setGroupTincture } from '../../lib/builder';
import { capitalise } from '../../lib/heraldry/words';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';
import { FurPicker } from './FurPicker';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  path: GroupPath;
  /** Swatch testid group: swatch-<group>-<tincture>; the parts of a split are <group>-part-1 and <group>-part-2. */
  group: string;
  testid: string;
  /** "Colour of the fess". */
  legend: string;
  onChange: (design: Design) => void;
}

export function PaintPicker({ design, path, group, testid, legend, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const paint = groupAt(design, path).paint;
  const party = asParty(paint);
  const split = party ? null : splitGroup(design, path);
  const tincture = groupTinctureOf(paint);
  return (
    <>
      <TincturePicker
        group={group}
        testid={testid}
        legend={legend}
        choices={groupTinctureChoices(design, path)}
        value={tincture}
        onChange={(t) => onChange(setGroupTincture(design, path, t))}
      />
      <div class="control">
        {party
          ? <button type="button" class="button-tertiary" data-testid={`${testid}-join`} onClick={() => onChange(joinGroup(design, path))}>Use one colour</button>
          : (
            <button
              type="button" class="button-tertiary" data-testid={`${testid}-split`} aria-disabled={split ? undefined : 'true'}
              onClick={(e) => (split ? onChange(split) : explain({ anchor: e.currentTarget as HTMLElement, kind: 'tincture', title: "Can't split the colour here", reason: 'No two colours would stand out on what it lies on.' }))}
            >
              Split into two colours
            </button>
          )}
      </div>
      {party && (
        <>
          <RadioGroup label="How the colour is split" class="segmented segmented-wide" testid={`${testid}-division`}>
            {partyDivisionChoices(design, path).map((c) => (
              <ChoiceButton
                key={c.value} testid={`${testid}-division-${c.value}`} checked={party.division === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
                label={capitalise(DIVISION_LABEL[c.value].plain)} onSelect={() => onChange(setPartyDivision(design, path, c.value))} onBlocked={explain} class="segment"
              >
                <span>{capitalise(DIVISION_LABEL[c.value].plain)}</span>
              </ChoiceButton>
            ))}
          </RadioGroup>
          {([0, 1] as const).map((part) => (
            <TincturePicker
              key={part}
              group={`${group}-part-${part + 1}`}
              testid={`${testid}-part-${part + 1}`}
              legend={`Colour ${part + 1} of the split`}
              choices={partyTinctureChoices(design, path, part)}
              value={party.parts[part].t}
              onChange={(t) => onChange(setPartyTincture(design, path, part, t))}
            />
          ))}
        </>
      )}
      {!party && <FurPicker design={design} target={{ k: 'group', path }} group={group} testid={testid} legend="Fur" onChange={onChange} />}
      {explainer}
    </>
  );
}
