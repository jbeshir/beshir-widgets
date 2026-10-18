// The shape of a band or shape inside "More shapes and edges…": toggles that turn it upside down, shorten it or make it touch the edges,
// where a band is set (raised, in the middle, lowered), and how many times over a tressure (double, triple) or thin bands (two to four) are drawn. A toggle is a pressed or unpressed button; a blocked one stays focusable and
// explains itself instead of changing anything.

import { BAND_POSITION_LABEL, SHAPE_TOGGLE_LABEL, type BandPosition, type Choice, type PlainTerm, type ShapeToggle } from '../../lib/heraldry';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';

interface Props {
  /** The toggles are <testid>-shape-<toggle>, the positions <testid>-position-<position>, the counts <testid>-number-<n>. */
  testid: string;
  /** What is shaped: "the band". */
  noun: string;
  toggles: Choice<ShapeToggle>[];
  isOn: (t: ShapeToggle) => boolean;
  onToggle: (t: ShapeToggle, on: boolean) => void;
  positions: Choice<BandPosition>[];
  position: BandPosition;
  onPosition: (p: BandPosition) => void;
  counts: Choice<number>[];
  count: number;
  /** What the row of counts asks ("How many thin bands"), and how each count is named: "Double", "Three". */
  countLegend: string;
  countLabel: (n: number) => PlainTerm;
  onCount: (n: number) => void;
}

export function ShapeToggles({ testid, noun, toggles, isOn, onToggle, positions, position, onPosition, counts, count, countLegend, countLabel, onCount }: Props) {
  const { explain, node: explainer } = useExplainer();
  return (
    <div class="fur-picker" data-testid={`${testid}-shape`}>
      {toggles.length > 0 && (
        <>
          <p class="picker-legend">Shape of {noun}</p>
          <div class="segmented segmented-wide" role="group" aria-label={`Shape of ${noun}`}>
            {toggles.map((c) => {
              const on = isOn(c.value);
              const { plain, term } = SHAPE_TOGGLE_LABEL[c.value];
              return (
                <ChoiceButton
                  key={c.value} toggle testid={`${testid}-shape-${c.value}`} checked={on} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
                  label={`${plain} (${term})`} onSelect={() => onToggle(c.value, !on)} onBlocked={explain} class="segment"
                >
                  <span>{plain}</span>
                </ChoiceButton>
              );
            })}
          </div>
        </>
      )}
      {positions.length > 0 && (
        <>
          <p class="picker-legend">Where {noun} sits</p>
          <RadioGroup label={`Where ${noun} sits`} class="segmented" testid={`${testid}-position`}>
            {positions.map((c) => (
              <ChoiceButton
                key={c.value} testid={`${testid}-position-${c.value}`} checked={position === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
                label={BAND_POSITION_LABEL[c.value].plain} title={BAND_POSITION_LABEL[c.value].term} onSelect={() => onPosition(c.value)} onBlocked={explain} class="segment"
              >
                <span>{BAND_POSITION_LABEL[c.value].plain}</span>
              </ChoiceButton>
            ))}
          </RadioGroup>
        </>
      )}
      {counts.length > 0 && (
        <>
          <p class="picker-legend">{countLegend}</p>
          <RadioGroup label={`${countLegend}: ${noun}`} class="segmented" testid={`${testid}-number`}>
            {counts.map((c) => (
              <ChoiceButton
                key={c.value} testid={`${testid}-number-${c.value}`} checked={count === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
                label={countLabel(c.value).plain} title={countLabel(c.value).term} onSelect={() => onCount(c.value)} onBlocked={explain} class="segment"
              >
                <span>{countLabel(c.value).plain}</span>
              </ChoiceButton>
            ))}
          </RadioGroup>
        </>
      )}
      {explainer}
    </div>
  );
}
