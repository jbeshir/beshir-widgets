// The shape of a band or shape inside "More shapes and edges…": toggles that turn it upside down, shorten it or make it touch the edges,
// and where a band is set (raised, in the middle, lowered). A toggle is a pressed or unpressed button; a blocked one stays focusable and
// explains itself instead of changing anything.

import { BAND_POSITION_LABEL, SHAPE_TOGGLE_LABEL, type BandPosition, type Choice, type ShapeToggle } from '../../lib/heraldry';
import { ChoiceButton, RadioGroup } from './Choices';
import { LockGlyph, useExplainer } from './Explainer';

interface Props {
  /** The toggles are <testid>-shape-<toggle>, the positions <testid>-position-<position>. */
  testid: string;
  /** What is shaped: "the band". */
  noun: string;
  toggles: Choice<ShapeToggle>[];
  isOn: (t: ShapeToggle) => boolean;
  onToggle: (t: ShapeToggle, on: boolean) => void;
  positions: Choice<BandPosition>[];
  position: BandPosition;
  onPosition: (p: BandPosition) => void;
}

export function ShapeToggles({ testid, noun, toggles, isOn, onToggle, positions, position, onPosition }: Props) {
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
              const id = `${testid}-shape-${c.value}`;
              const label = `${plain} (${term})`;
              return (
                <span key={c.value} class="option-wrap wrap-choice" data-testid={id} data-blocked={c.allowed ? undefined : 'true'}>
                  <button
                    type="button" id={id} aria-pressed={on ? 'true' : 'false'} aria-disabled={c.allowed ? undefined : 'true'}
                    aria-label={c.allowed ? label : `${label}, not available`} aria-describedby={c.allowed ? undefined : `${id}-why`}
                    class={`choice segment${on ? ' is-checked' : ''}${c.allowed ? '' : ' is-blocked'}`}
                    onClick={(e) => {
                      if (!c.allowed) explain({ anchor: e.currentTarget as HTMLElement, kind: 'structure', title: `${plain} isn't available`, reason: c.reason });
                      else onToggle(c.value, !on);
                    }}
                  >
                    <span>{plain}</span>
                    {!c.allowed && <LockGlyph />}
                  </button>
                  {!c.allowed && <span class="sr-only" id={`${id}-why`}>{c.reason}</span>}
                </span>
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
      {explainer}
    </div>
  );
}
