// The three builder fieldsets — Field, Ordinary, Charges — driven by the options helper so every
// blocked choice stays visible with its reason.

import type { ComponentChildren } from 'preact';
import {
  CATEGORY_LABEL, CHARGES, CHARGE_CATEGORIES, COUNTS, DIVISIONS, DIVISION_NAME, DIVISION_PART_LABEL, NUMBER_WORD,
  ORDINARY_NAME, ORDINARY_TYPES, POSTURE_GLOSS, ARRANGEMENT_WORD, arrangementChoices, chargeNoun, chargePath,
  chargeTinctureChoices, chargesInCategory, countChoices, fieldTinctureChoices, ordinaryTinctureChoices,
  placementChoices, postureChoices, postureTerm,
  type Arrangement, type Division, type Issue, type NormDesign, type OrdinaryType, type Posture,
} from '../../lib/heraldry';
import {
  placementLabel, setArrangement, setCharge, setChargeTincture, setCount, setDivision, setFieldTincture, setOrdinary,
  setOrdinaryTincture, setPlacement, setPlainField, setPosture,
} from '../../lib/builder';
import { ChargeIcon, Shield } from '../Shield';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

interface StepProps {
  design: NormDesign;
  onChange: (nd: NormDesign) => void;
  issues: Issue[];
}

/** Field and ordinary choices are never blocked; ChoiceButton still wants a handler. */
const never = () => {};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

function Step({ n, title, hint, issues, testid, children }: { n: number; title: string; hint?: string; issues: Issue[]; testid: string; children: ComponentChildren }) {
  return (
    <fieldset class={`step${issues.length ? ' has-issue' : ''}`} data-testid={testid}>
      <legend><span class="step-num" aria-hidden="true">{n}</span><h2 class="step-title">{title}</h2></legend>
      {hint && <p class="step-hint">{hint}</p>}
      <LayerIssues issues={issues} />
      {children}
    </fieldset>
  );
}

export function FieldStep({ design, onChange, issues }: StepProps) {
  const f = design.field;
  const division = f.kind === 'divided' ? f.division : null;
  return (
    <Step n={1} title="Field" hint="The background of the shield: one tincture, or split in two." issues={issues} testid="step-field">
      <RadioGroup label="Field division" class="icon-grid icon-grid-field" testid="field-division-select">
        <ChoiceButton testid="field-kind-plain" checked={!division} label="Plain" onSelect={() => onChange(setPlainField(design))} onBlocked={never} class="icon-choice">
          <Shield design={ICON_FIELD(null)} size={30} label={null} />
          <span class="choice-label">Plain</span>
        </ChoiceButton>
        {DIVISIONS.map((d) => (
          <ChoiceButton key={d} testid={`division-${d}`} checked={division === d} label={DIVISION_NAME[d]} onSelect={() => onChange(setDivision(design, d))} onBlocked={never} class="icon-choice">
            <Shield design={ICON_FIELD(d)} size={30} label={null} />
            <span class="choice-label">{DIVISION_NAME[d]}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      <TincturePicker
        group="field1"
        testid="field-tincture-1"
        legend={division ? DIVISION_PART_LABEL[division][0] : 'Field tincture'}
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

export function OrdinaryStep({ design, onChange, issues }: StepProps) {
  const o = design.ordinary;
  return (
    <Step n={2} title="Ordinary" hint="Optional: a bold geometric band across the field." issues={issues} testid="step-ordinary">
      <RadioGroup label="Ordinary" class="icon-grid icon-grid-ordinary" testid="ordinary-select">
        <ChoiceButton testid="ordinary-none" checked={!o} label="No ordinary" onSelect={() => onChange(setOrdinary(design, null))} onBlocked={never} class="icon-choice">
          <NoneIcon />
          <span class="choice-label">None</span>
        </ChoiceButton>
        {ORDINARY_TYPES.map((t) => (
          <ChoiceButton key={t} testid={`ordinary-${t}`} checked={o?.type === t} label={cap(ORDINARY_NAME[t])} onSelect={() => onChange(setOrdinary(design, t))} onBlocked={never} class="icon-choice">
            <Shield design={ICON_ORDINARY(t)} size={30} label={null} />
            <span class="choice-label">{cap(ORDINARY_NAME[t])}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      {o && (
        <TincturePicker
          group="ordinary"
          testid="ordinary-tincture"
          legend={`${cap(ORDINARY_NAME[o.type])} tincture`}
          choices={ordinaryTinctureChoices(design)}
          value={o.tincture}
          onChange={(t) => onChange(setOrdinaryTincture(design, t))}
        />
      )}
    </Step>
  );
}

function postureOption(design: NormDesign, p: Posture): string {
  const id = design.charges!.charge;
  const term = postureTerm(id, p);
  const gl = POSTURE_GLOSS[p];
  const name = term !== p ? `${cap(term)} (${p})` : cap(p);
  return gl ? `${name} — ${gl}` : name;
}

export function ChargesStep({ design, onChange, issues }: StepProps) {
  const g = design.charges;
  const counts = countChoices(design);
  const placements = placementChoices(design);
  const arr = arrangementChoices(design);
  const postures = postureChoices(design);
  const blockedArr = arr.choices.filter((c) => !c.allowed);
  const blockedPost = postures.filter((c) => !c.allowed);
  const countWhy = useExplainer();
  const placementWhy = useExplainer();

  return (
    <Step n={3} title="Charges" hint="Optional: a picture repeated one to six times." issues={issues} testid="step-charges">
      <RadioGroup label="Charge" class="charge-picker" testid="charge-select">
        <div class="charge-category">
          <ChoiceButton testid="charge-none" checked={!g} label="No charge" onSelect={() => onChange(setCharge(design, null))} onBlocked={never} class="icon-choice charge-choice">
            <NoneIcon />
            <span class="choice-label">None</span>
          </ChoiceButton>
        </div>
        {CHARGE_CATEGORIES.map((cat) => (
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
        {g ? <>Selected: <strong>{cap(CHARGES[g.charge].name)}</strong></> : 'No charge selected.'}
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
            <p class="picker-legend">Placement</p>
            <RadioGroup label="Placement" class="segmented segmented-wide" testid="placement-select">
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
            <label class="picker-legend" for="arrangement-select">Arrangement</label>
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
                      {cap(ARRANGEMENT_WORD[c.value])}{c.allowed ? '' : ' (not available)'}
                    </option>
                  ))
                : <option value={g.arrangement}>{arr.mode === 'single' ? 'Single, centred' : 'Set by the ordinary'}</option>}
            </select>
            {(arr.note || blockedArr.length > 0) && (
              <p class="control-note" id="arrangement-note">
                {arr.note ?? blockedArr.map((c) => c.reason).filter((r, i, a) => a.indexOf(r) === i).join(' ')}
              </p>
            )}
          </div>

          {postures.length > 0 && (
            <div class="control">
              <label class="picker-legend" for="posture-select">Posture</label>
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
            legend={`Tincture of the ${chargeNoun(g.charge, g.count)}`}
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

