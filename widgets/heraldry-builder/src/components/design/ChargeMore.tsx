// "Facing, turning and details…": the one closed disclosure under a picture's Pose row (PLAN-D §0.3.10), shown for a charge that takes
// anything in it and open by itself while the design uses it. It holds the Facing row (to dexter as drawn, or contourny), the Head row
// (guardant, regardant), for two charges the Pair row (the same way, facing each other, back to back), for a charge that turns, the
// Turned row (as usual, or the way it points, each chip previewed turned) and, for a charge with details, the nested Details disclosure
// (a star's points, voided, fimbriated in a tincture, pierced, fitchy). Undrawn options are blocked with their reason.

import type { ComponentChildren } from 'preact';
import {
  CHARGES, FACING_LABEL, GAZE_LABEL, MODIFIER_LABEL, ORIENTATION_ANGLE, ORIENTATION_LABEL, PAIR_LABEL, chargePath, detailChoices, drawnPoints, facingChoices, fimbriationOf, fimbriationTinctureChoices, gazeChoices,
  groupAt, orientationChoices, pairChoices, pointsChoices, pointsOf, pointsWord, tincturePaint,
  type Charge, type Choice, type Design, type GroupPath, type Orientation, type PairChoice, type PlainTerm,
} from '../../lib/heraldry';
import { numberWord } from '../../lib/heraldry/words';
import { setFacing, setGaze, setModifier, setOrientation, setPair } from '../../lib/builder';
import { ChargeIcon } from '../Shield';
import { ChoiceButton, RadioGroup } from './Choices';
import { Disclosure } from './Disclosure';
import { useExplainer, type ExplainKind, type Explanation } from './Explainer';
import { TincturePicker } from './TincturePicker';

interface Props {
  design: Design;
  path: GroupPath;
  /** '' for the picture, '<place>-' for the pictures of a layer. */
  prefix: string;
  onChange: (nd: Design) => void;
}

const AHEAD: PlainTerm = { plain: 'Looking ahead', term: 'as drawn' };
const SAME_WAY: PlainTerm = { plain: 'Same way', term: 'as drawn' };
const AS_USUAL: PlainTerm = { plain: 'As usual', term: 'upright, or along its band' };

/** The charge drawn small, turned the way `orientation` points (a mirrored one flipped; pointing to the middle is shown upright). */
function TurnedPreview({ item, orientation }: { item: Charge; orientation: Orientation | null }) {
  const way = orientation === null || orientation === 'to-center' || orientation === 'reversed' ? 0 : ORIENTATION_ANGLE[orientation] - ORIENTATION_ANGLE[CHARGES[item.charge].orient.drawn];
  return (
    <span class="turned-preview" style={{ transform: `${orientation === 'reversed' ? 'scaleX(-1) ' : ''}rotate(${way}deg)` }}>
      <ChargeIcon path={chargePath(item)} size={22} />
    </span>
  );
}

/** A number of points as a chip says it, the number the star is drawn with marked: "5 (usual)", "of six points". */
function pointsLabel(item: Charge, n: number): PlainTerm {
  return n === drawnPoints(item.charge) ? { plain: `${n} (usual)`, term: 'as drawn' } : { plain: String(n), term: `of ${numberWord(n)} ${pointsWord(item.charge)}` };
}

/** One row of chips: each option's plain words, the heraldic term in its accessible name and tooltip. */
function ChipRow<T>({ legend, testid, choices, current, label, kind, preview, onSelect, onBlocked }: {
  legend: string; testid: string; choices: readonly Choice<T>[]; current: T | null; label: (v: T) => PlainTerm; kind: ExplainKind; preview?: (v: T) => ComponentChildren;
  onSelect: (v: T) => void; onBlocked: (e: Explanation) => void;
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
              {preview?.(c.value)}
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
  const turns = orientationChoices(design, path);
  const points = pointsChoices(design, path);
  const details = detailChoices(design, path);
  if (g.item.k !== 'charge' || (facings.length === 0 && turns.length === 0 && points.length === 0 && details.length === 0)) return null;
  const item = g.item;
  const meta = CHARGES[item.charge];
  const fimbriations = fimbriationTinctureChoices(design, path);
  const fimbriation = fimbriationOf(item);
  const detailed = item.mods.some((m) => meta.details.includes(m.id));
  const gazes = gazeChoices(design, path);
  const pairs = pairChoices(design, path);
  const pair: PairChoice = g.arrangement.k === 'pair' ? g.arrangement.pair : 'same';
  const used = item.facing !== meta.defaultFacing || item.gaze !== null || pair !== 'same' || item.orientation !== null || detailed;
  return (
    <Disclosure testid={`${prefix}charge-more`} class="charge-more" summary="Facing, turning and details…" used={used}>
      {() => (
        <>
          {facings.length > 0 && (
            <ChipRow legend="Facing" testid={`${prefix}facing`} choices={facings} current={item.facing} label={(f) => FACING_LABEL[f]} kind="drawing" onSelect={(f) => onChange(setFacing(design, path, f))} onBlocked={explain} />
          )}
          {gazes.length > 0 && (
            <ChipRow legend="Head" testid={`${prefix}gaze`} choices={gazes} current={item.gaze} label={(v) => (v === null ? AHEAD : GAZE_LABEL[v])} kind="drawing" onSelect={(v) => onChange(setGaze(design, path, v))} onBlocked={explain} />
          )}
          {pairs.length > 0 && (
            <ChipRow legend="Pair" testid={`${prefix}pair`} choices={pairs} current={pair} label={(p) => (p === 'same' ? SAME_WAY : PAIR_LABEL[p])} kind="structure" onSelect={(p) => onChange(setPair(design, path, p))} onBlocked={explain} />
          )}
          {turns.length > 0 && (
            <ChipRow
              legend="Turned" testid={`${prefix}turned`} choices={turns} current={item.orientation} label={(o) => (o === null ? AS_USUAL : ORIENTATION_LABEL[o])} kind="drawing"
              preview={(o) => <TurnedPreview item={item} orientation={o} />} onSelect={(o) => onChange(setOrientation(design, path, o))} onBlocked={explain}
            />
          )}
          {(points.length > 0 || details.length > 0) && (
            <Disclosure testid={`${prefix}charge-details`} class="charge-details" summary="Details" used={detailed}>
              {() => (
                <>
                  {points.length > 0 && (
                    <ChipRow
                      legend="Points" testid={`${prefix}points`} choices={points} current={pointsOf(item)} label={(n) => pointsLabel(item, n)} kind="drawing"
                      onSelect={(n) => onChange(setModifier(design, path, 'of-points', true, { count: n, paint: null }))} onBlocked={explain}
                    />
                  )}
                  {details.length > 0 && (
                    <div class="control">
                      <p class="picker-legend">Drawn</p>
                      <div class="segmented segmented-wide" role="group" aria-label="Drawn">
                        {details.map((c) => {
                          const on = item.mods.some((m) => m.id === c.value);
                          const { plain, term } = MODIFIER_LABEL[c.value]!;
                          return (
                            <ChoiceButton
                              key={c.value} toggle testid={`${prefix}mod-${c.value}`} checked={on} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
                              label={`${plain} (${term})`} title={term} kind="detail" onSelect={() => onChange(setModifier(design, path, c.value, !on))} onBlocked={explain} class="segment"
                            >
                              <span>{plain}</span>
                            </ChoiceButton>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {fimbriations.length > 0 && (
                    <TincturePicker
                      group={`${prefix}fimbriation`} legend="Colour of the edging" choices={fimbriations} value={fimbriation?.k === 'tincture' ? fimbriation.t : null} testid={`${prefix}mod-fimbriated-tincture`}
                      onChange={(t) => onChange(setModifier(design, path, 'fimbriated', true, { count: null, paint: tincturePaint(t) }))}
                    />
                  )}
                </>
              )}
            </Disclosure>
          )}
          {explainer}
        </>
      )}
    </Disclosure>
  );
}
