// "Facing, turning and details…": the one closed disclosure under a picture's Pose row (PLAN-D §0.3.10), shown for a charge that takes
// anything in it and open by itself while the design uses it. It holds the Facing row (to dexter as drawn, or contourny), the Head row
// (guardant, regardant) and, for two charges, the Pair row (the same way, facing each other, back to back). Undrawn options are blocked
// with their reason.

import {
  CHARGES, FACING_LABEL, GAZE_LABEL, PAIR_LABEL, facingChoices, gazeChoices, groupAt, pairChoices,
  type Choice, type Design, type GroupPath, type PairChoice, type PlainTerm,
} from '../../lib/heraldry';
import { setFacing, setGaze, setPair } from '../../lib/builder';
import { ChoiceButton, RadioGroup } from './Choices';
import { Disclosure } from './Disclosure';
import { useExplainer, type ExplainKind, type Explanation } from './Explainer';

interface Props {
  design: Design;
  path: GroupPath;
  /** '' for the picture, '<place>-' for the pictures of a layer. */
  prefix: string;
  onChange: (nd: Design) => void;
}

const AHEAD: PlainTerm = { plain: 'Looking ahead', term: 'as drawn' };
const SAME_WAY: PlainTerm = { plain: 'Same way', term: 'as drawn' };

/** One row of chips: each option's plain words, the heraldic term in its accessible name and tooltip. */
function ChipRow<T>({ legend, testid, choices, current, label, kind, onSelect, onBlocked }: {
  legend: string; testid: string; choices: readonly Choice<T>[]; current: T | null; label: (v: T) => PlainTerm; kind: ExplainKind; onSelect: (v: T) => void; onBlocked: (e: Explanation) => void;
}) {
  return (
    <div class="control">
      <p class="picker-legend">{legend}</p>
      <RadioGroup label={legend} class="segmented segmented-wide" testid={testid}>
        {choices.map((c) => {
          const { plain, term } = label(c.value);
          return (
            <ChoiceButton
              key={String(c.value)} testid={`${testid}-${testValue(c.value)}`} checked={c.value === current} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
              label={`${plain} (${term})`} title={term} kind={kind} onSelect={() => onSelect(c.value)} onBlocked={onBlocked} class="segment"
            >
              <span>{plain}</span>
            </ChoiceButton>
          );
        })}
      </RadioGroup>
    </div>
  );
}

/** A choice's test id suffix: no head turn is "none"; either way of facing each other is "respectant", whatever the charge's word. */
function testValue(v: unknown): string {
  return v === null ? 'none' : v === 'combattant' ? 'respectant' : String(v);
}

export function ChargeMore({ design, path, prefix, onChange }: Props) {
  const { explain, node: explainer } = useExplainer();
  const g = groupAt(design, path);
  const facings = facingChoices(design, path);
  if (g.item.k !== 'charge' || facings.length === 0) return null;
  const item = g.item;
  const gazes = gazeChoices(design, path);
  const pairs = pairChoices(design, path);
  const pair: PairChoice = g.arrangement.k === 'pair' ? g.arrangement.pair : 'same';
  const used = item.facing !== CHARGES[item.charge].defaultFacing || item.gaze !== null || pair !== 'same';
  return (
    <Disclosure testid={`${prefix}charge-more`} class="charge-more" summary="Facing, turning and details…" used={used}>
      {() => (
        <>
          <ChipRow legend="Facing" testid={`${prefix}facing`} choices={facings} current={item.facing} label={(f) => FACING_LABEL[f]} kind="drawing" onSelect={(f) => onChange(setFacing(design, path, f))} onBlocked={explain} />
          {gazes.length > 0 && (
            <ChipRow legend="Head" testid={`${prefix}gaze`} choices={gazes} current={item.gaze} label={(v) => (v === null ? AHEAD : GAZE_LABEL[v])} kind="drawing" onSelect={(v) => onChange(setGaze(design, path, v))} onBlocked={explain} />
          )}
          {pairs.length > 0 && (
            <ChipRow legend="Pair" testid={`${prefix}pair`} choices={pairs} current={pair} label={(p) => (p === 'same' ? SAME_WAY : PAIR_LABEL[p])} kind="structure" onSelect={(p) => onChange(setPair(design, path, p))} onBlocked={explain} />
          )}
          {explainer}
        </>
      )}
    </Disclosure>
  );
}
