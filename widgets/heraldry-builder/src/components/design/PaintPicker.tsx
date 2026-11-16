// The colour of a band or picture: the tincture picker, then one "More colours and patterns…" disclosure for the rest —
// split in two ("per pale azure and Or"), fur, stripes and checks, a scatter (bands only), brick or scales, and natural
// colours (pictures that have them). While the paint is strewn or treated, the tincture picker sets the colour under it.

import type { ComponentChildren } from 'preact';
import {
  DIVISION_LABEL, asParty, asSemy, asTreated, canStrew, groupAt, hasNaturalColours, groupTinctureChoices, groupTinctureOf, partyDivisionChoices, partyTinctureChoices, splitGroup,
  properChoice, semyColourChoices, setPartyDivision, setPartyTincture, setProper, setSemyColour, setTreatmentColour, treatmentColourChoices,
  type Design, type GroupPath, type PaintTarget,
} from '../../lib/heraldry';
import { setGroupTincture } from '../../lib/builder';
import { capitalise } from '../../lib/heraldry/words';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';
import { FurPicker } from './FurPicker';
import { MorePaint, paintMode, type PaintMode } from './MorePaint';
import { SemyPicker } from './SemyPicker';
import { TreatmentPicker } from './TreatmentPicker';
import { GroupPattern } from './VariationPicker';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  path: GroupPath;
  /** Swatch testid group: swatch-<group>-<tincture>; the parts of a split are <group>-part-1 and <group>-part-2. */
  group: string;
  testid: string;
  /** What is coloured, for the legends: "bend", "lions". */
  noun: string;
  onChange: (design: Design) => void;
}

/** The split in two: the division and a tincture for each part once split, else the button that splits it. */
function SplitPanel({ design, path, group, testid, noun, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const party = asParty(groupAt(design, path).paint);
  if (!party) {
    const split = splitGroup(design, path);
    return (
      <div class="control">
        <button
          type="button" class="button-secondary button-small" data-testid={`${testid}-split`} aria-disabled={split ? undefined : 'true'}
          onClick={(e) => (split ? onChange(split) : explain({ anchor: e.currentTarget as HTMLElement, kind: 'tincture', title: "Can't split the colour here", reason: 'No two colours would stand out on what it lies on.' }))}
        >
          Split the {noun} into two colours
        </button>
        {explainer}
      </div>
    );
  }
  return (
    <>
      <p class="picker-legend">Where the split runs</p>
      <RadioGroup label="Where the split runs" class="segmented segmented-wide" testid={`${testid}-division`}>
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
      {explainer}
    </>
  );
}

/** Natural colours, for a picture that has them: one option, checked while chosen. */
function NaturalPanel({ design, path, testid, noun, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const natural = properChoice(design, path)!;
  return (
    <>
      <RadioGroup label={`Natural colours of the ${noun}`} class="segmented" testid={`${testid}-proper-select`}>
        <ChoiceButton
          testid={`${testid}-proper`} checked={groupAt(design, path).paint.k === 'proper'} status={natural.allowed ? undefined : { kind: 'blocked', reason: natural.reason }}
          label="Natural colours (proper)" kind="tincture" onSelect={() => onChange(setProper(design, path))} onBlocked={explain} class="segment"
        >
          <span>Natural colours · proper</span>
        </ChoiceButton>
      </RadioGroup>
      {explainer}
    </>
  );
}

export function PaintPicker(props: Props) {
  const { design, path, group, testid, noun, onChange } = props;
  const paint = groupAt(design, path).paint;
  const target: PaintTarget = { k: 'group', path };
  const the = `the ${noun}`;
  const semy = asSemy(paint);
  const treated = asTreated(paint);
  const legend = `Colour of the ${noun}`;
  // Strewn or treated, the colour picked is the one under the scatter or the brick: they stay.
  const main = semy
    ? <TincturePicker group={group} testid={testid} legend={legend} choices={semyColourChoices(design, target, 0)} value={semy.ground.t} onChange={(t) => onChange(setSemyColour(design, target, 0, t))} />
    : treated
      ? <TincturePicker group={group} testid={testid} legend={legend} choices={treatmentColourChoices(design, target, 0)} value={treated.ground.t} onChange={(t) => onChange(setTreatmentColour(design, target, 0, t))} />
      : <TincturePicker group={group} testid={testid} legend={legend} choices={groupTinctureChoices(design, path)} value={groupTinctureOf(paint)} onChange={(t) => onChange(setGroupTincture(design, path, t))} />;
  const modes: Array<{ mode: PaintMode; panel: () => ComponentChildren }> = [
    { mode: 'split', panel: () => <SplitPanel {...props} /> },
    { mode: 'fur', panel: () => <FurPicker design={design} target={target} group={group} testid={testid} noun={the} onChange={onChange} /> },
    { mode: 'pattern', panel: () => <GroupPattern design={design} path={path} group={group} testid={testid} noun={the} onChange={onChange} /> },
    ...(canStrew(design, target) ? [{ mode: 'scatter' as const, panel: () => <SemyPicker design={design} target={target} group={group} testid={testid} noun={the} onChange={onChange} /> }] : []),
    { mode: 'treatment', panel: () => <TreatmentPicker design={design} target={target} group={group} testid={testid} noun={the} onChange={onChange} /> },
    ...(hasNaturalColours(design, path) ? [{ mode: 'natural' as const, panel: () => <NaturalPanel {...props} /> }] : []),
  ];
  return (
    <>
      {main}
      <MorePaint testid={testid} noun={the} modes={modes} current={paintMode(paint)} />
    </>
  );
}
