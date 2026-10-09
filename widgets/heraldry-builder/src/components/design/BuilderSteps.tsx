// The three builder fieldsets — Background (field), Band or shape (ordinary), Picture (charge) — driven
// by the options helper so every blocked choice stays visible with its reason. Labels lead with
// everyday words and give the heraldic term second. On phones the steps collapse into an accordion
// and the picture list shows one kind of picture at a time.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  ARRANGEMENT_LABEL, CATEGORY_LABEL, CHARGES, CHARGE_CATEGORIES, COUNTS, DIVISIONS, DIVISION_LABEL, DIVISION_PART_LABEL, NUMBER_WORD,
  ORDINARY_LABEL, ORDINARY_TYPES, TINCTURE_LABEL, arrangementChoices, chargeNoun, chargePath,
  chargeTinctureChoices, chargesInCategory, countChoices, fieldTinctureChoices, ordinaryTinctureChoices,
  placementChoices, plainFirst, postureChoices, postureGloss, postureLabel, postureTerm,
  type Arrangement, type ChargeCategory, type Division, type FieldShape, type Issue, type NormDesign, type OrdinaryType, type Posture,
  type PlainTerm,
} from '../../lib/heraldry';
import {
  placementLabel, setArrangement, setCharge, setChargeTincture, setCount, setDivision, setFieldTincture, setOrdinary,
  setOrdinaryTincture, setPlacement, setPlainField, setPosture,
} from '../../lib/builder';
import { ChargeIcon, Shield } from '../Shield';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

/** How a step collapses on phones: null where steps are always open. */
export interface Accordion {
  open: boolean;
  onToggle: () => void;
}

interface StepProps {
  design: NormDesign;
  onChange: (nd: NormDesign) => void;
  issues: Issue[];
  accordion: Accordion | null;
}

/** Field and ordinary choices are never blocked; ChoiceButton still wants a handler. */
const never = () => {};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Two-line choice text: the everyday word, then the heraldic term in small type. */
function PlainLabel({ label }: { label: PlainTerm }) {
  return (
    <span class="choice-label">
      <span class="choice-plain">{label.plain}</span>
      <span class="choice-term">{label.term}</span>
    </span>
  );
}

/** Accessible name of a choice: "Split down the middle (per pale)". */
const nameOf = ({ plain, term }: PlainTerm) => `${plain} (${term})`;

const ICON_FIELD = (division: Division | null): NormDesign => ({
  v: 1,
  field: division ? { kind: 'divided', division, tinctures: ['or', 'azure'] } : { kind: 'plain', tincture: 'azure' },
  ordinary: null,
  charges: null,
});
const ICON_ORDINARY = (type: OrdinaryType): NormDesign => ({
  v: 1, field: { kind: 'plain', tincture: 'azure' }, ordinary: { type, tincture: 'or' }, charges: null,
});

function LayerIssues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul class="layer-issues">
      {issues.map((i, n) => <li key={n}>{i.message}</li>)}
    </ul>
  );
}

interface StepFrameProps {
  n: number;
  title: string;
  /** The heraldic term for what the step builds, shown after the title. */
  term: string;
  hint: string;
  /** One line saying what is chosen, shown while the step is collapsed. */
  summary: string;
  issues: Issue[];
  accordion: Accordion | null;
  testid: string;
  children: ComponentChildren;
}

function Step({ n, title, term, hint, summary, issues, accordion, testid, children }: StepFrameProps) {
  const open = accordion?.open ?? true;
  const heading = (
    <>
      <span class="step-num" aria-hidden="true">{n}</span>
      <span class="step-name">{title} <span class="step-term">({term})</span></span>
    </>
  );
  return (
    <fieldset class={`step${issues.length ? ' has-issue' : ''}${open ? '' : ' is-collapsed'}`} data-testid={testid}>
      <legend>
        <h2 class="step-title">
          {accordion ? (
            <button type="button" class="step-toggle" aria-expanded={open ? 'true' : 'false'} aria-controls={`${testid}-body`} data-testid={`${testid}-toggle`} onClick={accordion.onToggle}>
              {heading}
              <span class="step-chevron" aria-hidden="true" />
            </button>
          ) : heading}
        </h2>
      </legend>
      {accordion && !open && (
        <p class="step-summary" data-testid={`${testid}-summary`}>{issues.length ? 'Needs a fix — open to see why' : summary}</p>
      )}
      <div class="step-body" id={`${testid}-body`} hidden={!open}>
        <p class="step-hint">{hint}</p>
        <LayerIssues issues={issues} />
        {children}
      </div>
    </fieldset>
  );
}

/** Field and ordinary icons are drawn in the shape the preview uses. */
interface ShapedStepProps extends StepProps {
  shape: FieldShape;
}

const lower = (s: string) => s.toLowerCase();

function fieldSummary(design: NormDesign): string {
  const f = design.field;
  if (f.kind === 'plain') return `${TINCTURE_LABEL[f.tincture].plain}, plain`;
  return `${DIVISION_LABEL[f.division].plain}: ${lower(TINCTURE_LABEL[f.tinctures[0]].plain)} and ${lower(TINCTURE_LABEL[f.tinctures[1]].plain)}`;
}

export function FieldStep({ design, shape, onChange, issues, accordion }: ShapedStepProps) {
  const f = design.field;
  const division = f.kind === 'divided' ? f.division : null;
  return (
    <Step n={1} title="Background" term="field" hint="One colour, or split in two." summary={fieldSummary(design)} issues={issues} accordion={accordion} testid="step-field">
      <RadioGroup label="Field division" class="icon-grid icon-grid-field" testid="field-division-select">
        <ChoiceButton testid="field-kind-plain" checked={!division} label="Plain (one colour)" onSelect={() => onChange(setPlainField(design))} onBlocked={never} class="icon-choice">
          <Shield design={ICON_FIELD(null)} shape={shape} size={30} label={null} />
          <PlainLabel label={{ plain: 'Plain', term: 'one colour' }} />
        </ChoiceButton>
        {DIVISIONS.map((d) => (
          <ChoiceButton key={d} testid={`division-${d}`} checked={division === d} label={nameOf(DIVISION_LABEL[d])} onSelect={() => onChange(setDivision(design, d))} onBlocked={never} class="icon-choice">
            <Shield design={ICON_FIELD(d)} shape={shape} size={30} label={null} />
            <PlainLabel label={DIVISION_LABEL[d]} />
          </ChoiceButton>
        ))}
      </RadioGroup>
      <TincturePicker
        group="field1"
        testid="field-tincture-1"
        legend={division ? DIVISION_PART_LABEL[division][0] : 'Background colour'}
        choices={fieldTinctureChoices(design, 0)}
        value={f.kind === 'plain' ? f.tincture : f.tinctures[0]}
        onChange={(t) => onChange(setFieldTincture(design, 0, t))}
      />
      {f.kind === 'divided' && (
        <TincturePicker
          group="field2"
          testid="field-tincture-2"
          legend={DIVISION_PART_LABEL[f.division][1]}
          choices={fieldTinctureChoices(design, 1)}
          value={f.tinctures[1]}
          onChange={(t) => onChange(setFieldTincture(design, 1, t))}
        />
      )}
    </Step>
  );
}

function ordinarySummary(design: NormDesign): string {
  const o = design.ordinary;
  return o ? `${ORDINARY_LABEL[o.type].plain}, ${lower(TINCTURE_LABEL[o.tincture].plain)}` : 'None';
}

export function OrdinaryStep({ design, shape, onChange, issues, accordion }: ShapedStepProps) {
  const o = design.ordinary;
  return (
    <Step n={2} title="Band or shape" term="ordinary" hint="A bold band, border or shape. You need this or a picture (or both)." summary={ordinarySummary(design)} issues={issues} accordion={accordion} testid="step-ordinary">
      <RadioGroup label="Ordinary" class="icon-grid icon-grid-ordinary" testid="ordinary-select">
        <ChoiceButton testid="ordinary-none" checked={!o} label="No band or shape" onSelect={() => onChange(setOrdinary(design, null))} onBlocked={never} class="icon-choice">
          <NoneIcon />
          <span class="choice-label">None</span>
        </ChoiceButton>
        {ORDINARY_TYPES.map((t) => (
          <ChoiceButton key={t} testid={`ordinary-${t}`} checked={o?.type === t} label={nameOf(ORDINARY_LABEL[t])} onSelect={() => onChange(setOrdinary(design, t))} onBlocked={never} class="icon-choice">
            <Shield design={ICON_ORDINARY(t)} shape={shape} size={30} label={null} />
            <PlainLabel label={ORDINARY_LABEL[t]} />
          </ChoiceButton>
        ))}
      </RadioGroup>
      {o && (
        <TincturePicker
          group="ordinary"
          testid="ordinary-tincture"
          legend={`Colour of the ${lower(ORDINARY_LABEL[o.type].plain)}`}
          choices={ordinaryTinctureChoices(design)}
          value={o.tincture}
          onChange={(t) => onChange(setOrdinaryTincture(design, t))}
        />
      )}
    </Step>
  );
}

/** "Running (courant)": the plain-English gloss, then the charge's own blazon term. */
function postureOption(design: NormDesign, p: Posture): string {
  const id = design.charges!.charge;
  return postureLabel(postureTerm(id, p), postureGloss(id, p), p);
}

function chargesSummary(design: NormDesign): string {
  const g = design.charges;
  return g ? `${g.count} ${chargeNoun(g.charge, g.count)}, ${lower(TINCTURE_LABEL[g.tincture].plain)}` : 'None';
}

/** The picture list on phones shows one kind at a time; this is the kind to start on. */
function categoryOf(design: NormDesign): ChargeCategory {
  return design.charges ? CHARGES[design.charges.charge].category : CHARGE_CATEGORIES[0];
}

export function ChargesStep({ design, onChange, issues, accordion, compact }: StepProps & { compact: boolean }) {
  const g = design.charges;
  const [tab, setTab] = useState<ChargeCategory>(() => categoryOf(design));
  // A design loaded from outside (an example, a registry entry) brings its own kind of picture along.
  const selectedCategory = design.charges ? CHARGES[design.charges.charge].category : null;
  useEffect(() => {
    if (selectedCategory) setTab(selectedCategory);
  }, [selectedCategory]);
  const counts = countChoices(design);
  const placements = placementChoices(design);
  const arr = arrangementChoices(design);
  const postures = postureChoices(design);
  const blockedArr = arr.choices.filter((c) => !c.allowed);
  const blockedPost = postures.filter((c) => !c.allowed);
  const countWhy = useExplainer();
  const placementWhy = useExplainer();

  return (
    <Step n={3} title="Picture" term="charge" hint="Pick a picture and repeat it up to six times. You need this or a band or shape (or both)." summary={chargesSummary(design)} issues={issues} accordion={accordion} testid="step-charges">
      {compact && (
        <RadioGroup label="Kind of picture" class="charge-tabs" testid="charge-tabs">
          {CHARGE_CATEGORIES.map((cat) => (
            <ChoiceButton key={cat} testid={`charge-tab-${cat}`} checked={tab === cat} label={CATEGORY_LABEL[cat]} onSelect={() => setTab(cat)} onBlocked={never} class="chip-choice">
              <span>{CATEGORY_LABEL[cat]}</span>
            </ChoiceButton>
          ))}
        </RadioGroup>
      )}
      <RadioGroup label="Picture" class="charge-picker" testid="charge-select">
        <div class="charge-category">
          <ChoiceButton testid="charge-none" checked={!g} label="No picture" onSelect={() => onChange(setCharge(design, null))} onBlocked={never} class="icon-choice charge-choice">
            <NoneIcon />
            <span class="choice-label">None</span>
          </ChoiceButton>
        </div>
        {CHARGE_CATEGORIES.filter((cat) => !compact || cat === tab).map((cat) => (
          <div class="charge-category" key={cat} role="group" aria-label={CATEGORY_LABEL[cat]}>
            <p class="charge-category-label" aria-hidden="true">{CATEGORY_LABEL[cat]}</p>
            <div class="icon-grid icon-grid-charges">
              {chargesInCategory(cat).map((m) => (
                <ChoiceButton key={m.id} testid={`charge-${m.id}`} checked={g?.charge === m.id} label={cap(m.name)} onSelect={() => onChange(setCharge(design, m.id))} onBlocked={never} class="icon-choice charge-choice">
                  <ChargeIcon path={chargePath(m.id, m.defaultPosture)} size={30} />
                  <span class="choice-label">{cap(m.name)}</span>
                </ChoiceButton>
              ))}
            </div>
          </div>
        ))}
      </RadioGroup>
      <p class="charge-selected" data-testid="charge-selected" aria-live="polite">
        {g ? <>Selected: <strong>{cap(CHARGES[g.charge].name)}</strong></> : 'No picture selected.'}
      </p>

      {g && (
        <div class="charge-options">
          <div class="control">
            <p class="picker-legend" id="count-label">How many</p>
            <RadioGroup label="How many" class="segmented" testid="count-select">
              {counts.map((c) => (
                <ChoiceButton key={c.value} testid={`count-${c.value}`} checked={g.count === c.value} reason={c.reason} label={cap(NUMBER_WORD[c.value])} onSelect={() => onChange(setCount(design, c.value))} onBlocked={countWhy.explain} class="segment">
                  <span aria-hidden="true">{c.value}</span>
                </ChoiceButton>
              ))}
            </RadioGroup>
            {countWhy.node}
          </div>

          <div class="control">
            <p class="picker-legend">Where it goes</p>
            <RadioGroup label="Where it goes" class="segmented segmented-wide" testid="placement-select">
              {placements.map((c) => {
                const text = placementLabel(design, c.value);
                return (
                  <ChoiceButton key={c.value} testid={`placement-${c.value}`} checked={g.placement === c.value} reason={c.reason} label={text} onSelect={() => onChange(setPlacement(design, c.value))} onBlocked={placementWhy.explain} class="segment">
                    <span>{text}</span>
                  </ChoiceButton>
                );
              })}
            </RadioGroup>
            {placementWhy.node}
          </div>

          <div class="control">
            <label class="picker-legend" for="arrangement-select">Layout</label>
            <select
              id="arrangement-select"
              class="select"
              data-testid="arrangement-select"
              disabled={arr.mode !== 'choose'}
              aria-describedby={arr.note || blockedArr.length ? 'arrangement-note' : undefined}
              value={g.arrangement}
              onChange={(e) => onChange(setArrangement(design, (e.currentTarget as HTMLSelectElement).value as Arrangement))}
            >
              {arr.mode === 'choose'
                ? arr.choices.map((c) => (
                    <option key={c.value} value={c.value} disabled={!c.allowed}>
                      {plainFirst(ARRANGEMENT_LABEL[c.value])}{c.allowed ? '' : ' (not available)'}
                    </option>
                  ))
                : <option value={g.arrangement}>{arr.mode === 'single' ? 'Single, centred' : 'Set by the band or shape'}</option>}
            </select>
            {(arr.note || blockedArr.length > 0) && (
              <p class="control-note" id="arrangement-note">
                {arr.note ?? blockedArr.map((c) => c.reason).filter((r, i, a) => a.indexOf(r) === i).join(' ')}
              </p>
            )}
          </div>

          {postures.length > 0 && (
            <div class="control">
              <label class="picker-legend" for="posture-select">Pose</label>
              <select
                id="posture-select"
                class="select"
                data-testid="posture-select"
                value={g.posture ?? ''}
                aria-describedby={blockedPost.length ? 'posture-note' : undefined}
                onChange={(e) => onChange(setPosture(design, (e.currentTarget as HTMLSelectElement).value as Posture))}
              >
                {postures.map((c) => (
                  <option key={c.value} value={c.value} disabled={!c.allowed}>
                    {postureOption(design, c.value)}{c.allowed ? '' : ' (not drawn)'}
                  </option>
                ))}
              </select>
              {blockedPost.length > 0 && <p class="control-note" id="posture-note">{blockedPost[0].reason}</p>}
            </div>
          )}

          <TincturePicker
            group="charge"
            testid="charge-tincture"
            legend={`Colour of the ${chargeNoun(g.charge, g.count)}`}
            choices={chargeTinctureChoices(design)}
            value={g.tincture}
            onChange={(t) => onChange(setChargeTincture(design, t))}
          />
        </div>
      )}
    </Step>
  );
}

function NoneIcon() {
  return (
    <svg class="none-icon" viewBox="0 0 30 36" width="30" height="36" aria-hidden="true" focusable="false">
      <path d="M1 1H29V18C29 27.6 22.8 33 15 36C7.2 33 1 27.6 1 18Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2.5" />
    </svg>
  );
}

