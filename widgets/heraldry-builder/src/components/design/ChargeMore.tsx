// "Facing, turning and details…": the one closed disclosure under a picture's Pose row (PLAN-D §0.3.10), shown for a charge that takes
// anything in it and open by itself while the design uses it. It holds the Facing row (to dexter as drawn, or contourny), the Head row
// (guardant, regardant), for two charges the Pair row (the same way, facing each other, back to back), for a charge that turns, the
// Turned row (as usual, or the way it points, each chip previewed turned) and, for a charge with details, the nested Details disclosure
// (its shape and cut, a star's points, voided, fimbriated in a tincture, pierced, fitchy, and the pieces — wings, flames, a stem and
// leaves, a crown, a collar — each in its colour, and for a main charge that holds things, what it holds, how and in what colour).
// Undrawn options are blocked with their reason.

import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import {
  CHARGES, CUT_LABEL, FACING_LABEL, FORM_LABEL, GAZE_LABEL, HOLDABLE_IDS, HOLD_LABEL, MODIFIER_LABEL, ORIENTATION_LABEL, PAIR_LABEL, PIECE_IDS, PIECE_LABEL, PROPER_PIECES, chargeLabel, chargePath, cutChoices, cutOf, detailChoices, drawingTurn, formChoices, drawnPoints, facingChoices, fimbriationOf, fimbriationTinctureChoices, gazeChoices,
  groupAt, heldProperChoice, heldTinctureChoices, holdChoices, isPiece, isPiecePart, orientationChoices, pairChoices, partChoices, pieceTinctureChoices, piecePaint, pointsChoices, pointsOf, pointsWord, tincturePaint,
  type Charge, type ChargeForm, type ChargeId, type Choice, type Design, type GroupPath, type HoldHow, type Orientation, type Paint, type PairChoice, type PieceId, type PlainTerm,
} from '../../lib/heraldry';
import { numberWord } from '../../lib/heraldry/words';
import { setCut, setForm, setFacing, setGaze, setModifier, setOrientation, setHold, setPair, setPart } from '../../lib/builder';
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
  const way = orientation === null || orientation === 'to-center' || orientation === 'reversed' ? 0 : drawingTurn(orientation, CHARGES[item.charge].orient);
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

/** One detail's or part's toggle, pressed while the charge has it; one refused says why. */
function DetailToggle({ testid, choice: c, on, label: { plain, term }, kind, onToggle, onBlocked }: {
  testid: string; choice: Choice<string>; on: boolean; label: PlainTerm; kind: ExplainKind; onToggle: () => void; onBlocked: (e: Explanation) => void;
}) {
  return (
    <ChoiceButton
      toggle testid={testid} checked={on} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
      label={`${plain} (${term})`} title={term} kind={kind} onSelect={onToggle} onBlocked={onBlocked} class="segment"
    >
      <span>{plain}</span>
    </ChoiceButton>
  );
}

/** What each piece's colour picker names. */
const PIECE_NOUN: Record<PieceId, string> = { winged: 'wings', enflamed: 'flames', slipped: 'stem', leaved: 'leaves', crowned: 'crown', collared: 'collar' };

/** A piece's colour, while the charge has it: natural colours for flames, then the tinctures (none blocked: pieces are artistic detail, §1.4 M16). */
function PieceColour({ design, path, prefix, piece, onChange, onBlocked }: Props & { piece: PieceId; onBlocked: (e: Explanation) => void }) {
  const item = groupAt(design, path).item as Charge;
  const paint = piecePaint(item, piece)!;
  const testid = `${prefix}${isPiecePart(piece) ? 'part' : 'mod'}-${piece}`;
  const set = (p: Paint) => onChange(isPiecePart(piece) ? setPart(design, path, piece, true, p) : setModifier(design, path, piece, true, { count: null, paint: p }));
  return (
    <>
      {PROPER_PIECES.includes(piece) && (
        <div class="control">
          <RadioGroup label={`Natural colours of the ${PIECE_NOUN[piece]}`} class="segmented" testid={`${testid}-proper-select`}>
            <ChoiceButton testid={`${testid}-proper`} checked={paint.k === 'proper'} label="Natural colours (proper)" kind="tincture" onSelect={() => set({ k: 'proper' })} onBlocked={onBlocked} class="segment">
              <span>Natural colours · proper</span>
            </ChoiceButton>
          </RadioGroup>
        </div>
      )}
      <TincturePicker
        group={`${prefix}${piece}`} legend={`Colour of the ${PIECE_NOUN[piece]}`} choices={pieceTinctureChoices(design, path, piece)} value={paint.k === 'tincture' ? paint.t : null} testid={`${testid}-tincture`}
        onChange={(t) => set(tincturePaint(t))}
      />
    </>
  );
}

/**
 * What the charge holds (PLAN-D §1.5): a select of the items it may hold, then, while it holds one, the way it holds it and the item's colour,
 * natural colours first where it has them (blocked where it wouldn't stand out from the field, H5). A drawing with no place to hold anything
 * (a demi lion) says why.
 */
function Holding({ design, path, prefix, ways, onChange, onBlocked }: Props & { ways: readonly Choice<HoldHow>[]; onBlocked: (e: Explanation) => void }) {
  const holder = groupAt(design, path).item as Charge;
  const held = holder.holds[0] ?? null;
  const selectId = `${prefix}hold-select`;
  const refused = held === null && ways.every((c) => !c.allowed) ? ways[0] : null;
  const proper = heldProperChoice(design, path);
  return (
    <>
      <div class="control">
        <label class="picker-legend" for={selectId}>What it holds</label>
        <select
          id={selectId} class="select" data-testid={selectId} value={held?.item.charge ?? ''} disabled={refused !== null} aria-describedby={refused ? `${selectId}-note` : undefined}
          onChange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value; onChange(setHold(design, path, v === '' ? null : v as ChargeId)); }}
        >
          <option value="">Nothing</option>
          {HOLDABLE_IDS.map((id) => <option key={id} value={id}>{chargeLabel(id)}</option>)}
        </select>
        {refused && !refused.allowed && <p class="control-note" id={`${selectId}-note`}>{refused.reason}</p>}
      </div>
      {held && (
        <ChipRow
          legend="How" testid={`${prefix}hold-how`} choices={ways} current={held.how} label={(how) => HOLD_LABEL[how]} kind="drawing"
          onSelect={(how) => onChange(setHold(design, path, held.item.charge, how))} onBlocked={onBlocked}
        />
      )}
      {held && proper && (
        <div class="control">
          <RadioGroup label={`Natural colours of the ${CHARGES[held.item.charge].name}`} class="segmented" testid={`${prefix}hold-proper-select`}>
            <ChoiceButton
              testid={`${prefix}hold-proper`} checked={held.paint.k === 'proper'} status={proper.allowed ? undefined : { kind: 'blocked', reason: proper.reason }} label="Natural colours (proper)" kind="tincture"
              onSelect={() => onChange(setHold(design, path, held.item.charge, held.how, { k: 'proper' }))} onBlocked={onBlocked} class="segment"
            >
              <span>Natural colours · proper</span>
            </ChoiceButton>
          </RadioGroup>
        </div>
      )}
      {held && (
        // keyed by what holds what, so that why a colour was refused (said of the item as it was) goes with it
        <TincturePicker
          key={`${holder.charge}|${held.item.charge}`} group={`${prefix}held`} legend={`Colour of the ${CHARGES[held.item.charge].name}`} choices={heldTinctureChoices(design, path)} value={held.paint.k === 'tincture' ? held.paint.t : null} testid={`${prefix}hold-tincture`}
          onChange={(t) => onChange(setHold(design, path, held.item.charge, held.how, tincturePaint(t)))}
        />
      )}
    </>
  );
}

/** A choice's test id suffix: no head turn is "none"; either way of facing each other is "respectant", whatever the charge's word. */
function testValue(v: unknown): string {
  return v === null ? 'none' : v === 'combattant' ? 'respectant' : String(v);
}

export function ChargeMore({ design, path, prefix, onChange }: Props) {
  const { explain, close, node: explainer } = useExplainer();
  const g = groupAt(design, path);
  // Why an option was refused speaks of the charge as it was: a change to it (another charge, pose or piece) closes the explanation.
  useEffect(close, [g.item, close]);
  const facings = facingChoices(design, path);
  const turns = orientationChoices(design, path);
  const points = pointsChoices(design, path);
  const forms = formChoices(design, path);
  const details = detailChoices(design, path);
  const parts = partChoices(design, path);
  const ways = holdChoices(design, path);
  if (g.item.k !== 'charge' || (facings.length === 0 && turns.length === 0 && points.length === 0 && details.length === 0 && parts.length === 0 && forms.length === 0 && ways.length === 0)) return null;
  const item = g.item;
  const meta = CHARGES[item.charge];
  const fimbriations = fimbriationTinctureChoices(design, path);
  const fimbriation = fimbriationOf(item);
  const cuts = cutChoices(design, path);
  const detailed = item.mods.some((m) => meta.details.includes(m.id)) || item.parts.length > 0 || item.holds.length > 0 || item.form !== null;
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
          {(points.length > 0 || details.length > 0 || parts.length > 0 || forms.length > 0 || ways.length > 0) && (
            <Disclosure testid={`${prefix}charge-details`} class="charge-details" summary="Details" used={detailed}>
              {() => (
                <>
                  {forms.length > 0 && (
                    <ChipRow<ChargeForm | 'whole'>
                      legend="Shape" testid={`${prefix}form`} choices={forms.map((c): Choice<ChargeForm | 'whole'> => ({ ...c, value: c.value ?? 'whole' }))} current={item.form ?? 'whole'} label={(f) => FORM_LABEL[f]} kind="drawing"
                      onSelect={(f) => onChange(setForm(design, path, f === 'whole' ? null : f))} onBlocked={explain}
                    />
                  )}
                  {cuts.length > 0 && (
                    <ChipRow legend="Cut" testid={`${prefix}cut`} choices={cuts} current={cutOf(item)} label={(m) => CUT_LABEL[m]!} kind="drawing" onSelect={(m) => onChange(setCut(design, path, m))} onBlocked={explain} />
                  )}
                  {points.length > 0 && (
                    <ChipRow
                      legend="Points" testid={`${prefix}points`} choices={points} current={pointsOf(item)} label={(n) => pointsLabel(item, n)} kind="drawing"
                      onSelect={(n) => onChange(setModifier(design, path, 'of-points', true, { count: n, paint: null }))} onBlocked={explain}
                    />
                  )}
                  {(details.length > 0 || parts.length > 0) && (
                    <div class="control">
                      <p class="picker-legend">Drawn</p>
                      <div class="segmented segmented-wide" role="group" aria-label="Drawn">
                        {details.map((c) => {
                          const on = item.mods.some((m) => m.id === c.value);
                          return (
                            <DetailToggle
                              key={c.value} testid={`${prefix}mod-${c.value}`} choice={c} on={on} label={isPiece(c.value) ? PIECE_LABEL[c.value] : MODIFIER_LABEL[c.value]!} kind={isPiece(c.value) ? 'drawing' : 'detail'}
                              onToggle={() => onChange(setModifier(design, path, c.value, !on))} onBlocked={explain}
                            />
                          );
                        })}
                        {parts.map((c) => {
                          const on = item.parts.some((p) => p.part === c.value);
                          return (
                            <DetailToggle
                              key={c.value} testid={`${prefix}part-${c.value}`} choice={c} on={on} label={PIECE_LABEL[c.value]} kind="drawing"
                              onToggle={() => onChange(setPart(design, path, c.value, !on))} onBlocked={explain}
                            />
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
                  {PIECE_IDS.filter((piece) => piecePaint(item, piece) !== null).map((piece) => (
                    <PieceColour key={piece} design={design} path={path} prefix={prefix} piece={piece} onChange={onChange} onBlocked={explain} />
                  ))}
                  {ways.length > 0 && <Holding design={design} path={path} prefix={prefix} ways={ways} onChange={onChange} onBlocked={explain} />}
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
