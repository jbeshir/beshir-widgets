// The builder fieldsets — Background (field), Band or shape (ordinary), Picture (charge) and, when the
// band can carry them, Pictures on the band — driven by the options helper so every blocked choice
// stays visible with its reason. Field and band tiles show the heraldic term under the icon, with the
// everyday words in the tooltip and accessible name; other labels lead with everyday words. On phones
// the steps collapse into an accordion and the picture list shows one kind of picture at a time.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  CATEGORY_LABEL, CHARGES, CHARGE_CATEGORIES, CHARGE_IDS, COUNTS, DIVISION_LABEL, DIVISION_PART_LABEL, DRAWN_DIVISIONS, DRAWN_ORDINARIES, ORDINARY_LABEL,
  TINCTURE_LABEL, chargeLabel, chargePath, chargesInCategory, countChoices, fieldTinctureChoices, fieldTinctures, groupAt, groupTinctureChoices,
  groupTinctureOf, isBlocked, layoutChoices, layoutKey, layoutLabel, modifierChoices, placementChoices, plainFirst, postureChoices, postureLabel, resolve, simpleParts,
  groupLabel, type ChargeCategory, type Companion, type Design, type Division, type FieldShape, type GroupPath, type GroupTincture, type Issue,
  type LayoutChoice, type LayoutKey, type OrdinaryType, type PlainTerm, type Posture,
} from '../../lib/heraldry';
import { numberWord } from '../../lib/heraldry/words';
import {
  PERIPHERAL_TYPES, addExtraPicture, addPeripheral, canAddExtraPicture, canAddPeripheral, companionNote, extraPicturePath, ordinaryPath, peripheralPath, picturePath,
  placementLabel, removeExtraPicture, removePeripheral, setCharge, setPeripheralTincture,
  setDivision, setFieldTincture, setGroupTincture, setLayout, setModifier, setOrdinary, setOrdinaryTincture, setPlainField, setPosture,
} from '../../lib/builder';
import { capitalise } from '../../lib/heraldry/words';
import { ChargeIcon, Shield } from '../Shield';
import { ChoiceButton, RadioGroup, type OptionStatus } from './Choices';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

/** How a step collapses on phones: null where steps are always open. */
export interface Accordion {
  open: boolean;
  onToggle: () => void;
}

interface StepProps {
  design: Design;
  onChange: (nd: Design) => void;
  issues: Issue[];
  accordion: Accordion | null;
}

/** Field and ordinary choices are never blocked; ChoiceButton still wants a handler. */
const never = () => {};

/** Accessible name of a field or band tile: the term it shows, then the everyday words ("Per pale, split down the middle"). */
const nameOf = ({ plain, term }: PlainTerm) => (plain.toLowerCase() === term ? capitalise(term) : `${capitalise(term)}, ${plain.charAt(0).toLowerCase()}${plain.slice(1)}`);

/** The field's plain option, labelled like the divisions. */
const PLAIN_FIELD_LABEL: PlainTerm = { plain: 'One colour', term: 'plain' };

/** An icon design from loose input; a bad literal is a programming error. */
function icon(input: unknown): Design {
  const r = resolve(input);
  if (!r.ok) throw new Error(`icon design does not resolve: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.design;
}

const ICON_FIELD = (division: Division | null): Design =>
  icon({ v: 2, field: division ? { k: 'divided', division, parts: ['or', 'azure'] } : 'azure', groups: [] });
const ICON_ORDINARY = (type: OrdinaryType): Design =>
  icon({ v: 2, field: 'azure', groups: [{ item: { k: 'ordinary', type }, paint: 'or' }] });

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

/** The plain tincture of a simple-space group (every group the builder makes is plainly painted or counterchanged). */
const tinctureOf = (design: Design, path: GroupPath): GroupTincture => groupTinctureOf(groupAt(design, path).paint) ?? 'or';

function fieldSummary(design: Design): string {
  const [first, second] = fieldTinctures(design);
  if (design.kind === 'arms' && design.field.k === 'divided') {
    return `${DIVISION_LABEL[design.field.division].plain}: ${lower(TINCTURE_LABEL[first].plain)} and ${lower(TINCTURE_LABEL[second].plain)}`;
  }
  return `${TINCTURE_LABEL[first].plain}, plain`;
}

export function FieldStep({ design, shape, onChange, issues, accordion }: ShapedStepProps) {
  const division = design.kind === 'arms' && design.field.k === 'divided' ? design.field.division : null;
  const [first, second] = fieldTinctures(design);
  return (
    <Step n={1} title="Background" term="field" hint="One colour, or split in two." summary={fieldSummary(design)} issues={issues} accordion={accordion} testid="step-field">
      <RadioGroup label="Field division" class="icon-grid icon-grid-field" testid="field-division-select">
        <ChoiceButton testid="field-kind-plain" checked={!division} label={nameOf(PLAIN_FIELD_LABEL)} title={PLAIN_FIELD_LABEL.plain} onSelect={() => onChange(setPlainField(design))} onBlocked={never} class="icon-choice">
          <Shield design={ICON_FIELD(null)} shape={shape} size={30} label={null} />
          <span class="choice-label">{capitalise(PLAIN_FIELD_LABEL.term)}</span>
        </ChoiceButton>
        {DRAWN_DIVISIONS.map((d) => (
          <ChoiceButton key={d} testid={`division-${d}`} checked={division === d} label={nameOf(DIVISION_LABEL[d])} title={DIVISION_LABEL[d].plain} onSelect={() => onChange(setDivision(design, d))} onBlocked={never} class="icon-choice">
            <Shield design={ICON_FIELD(d)} shape={shape} size={30} label={null} />
            <span class="choice-label">{capitalise(DIVISION_LABEL[d].term)}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      <TincturePicker
        group="field1"
        testid="field-tincture-1"
        legend={division ? DIVISION_PART_LABEL[division][0] : 'Background colour'}
        choices={fieldTinctureChoices(design, 0)}
        value={first}
        onChange={(t) => onChange(setFieldTincture(design, 0, t))}
      />
      {division && (
        <TincturePicker
          group="field2"
          testid="field-tincture-2"
          legend={DIVISION_PART_LABEL[division][1]}
          choices={fieldTinctureChoices(design, 1)}
          value={second}
          onChange={(t) => onChange(setFieldTincture(design, 1, t))}
        />
      )}
    </Step>
  );
}

function ordinarySummary(design: Design): string {
  const path = ordinaryPath(design);
  const item = path && groupAt(design, path).item;
  return path && item?.k === 'ordinary' ? `${ORDINARY_LABEL[item.type].plain}, ${lower(TINCTURE_LABEL[tinctureOf(design, path)].plain)}` : 'None';
}

export function OrdinaryStep({ design, shape, onChange, issues, accordion }: ShapedStepProps) {
  const path = ordinaryPath(design);
  const item = path && groupAt(design, path).item;
  const type = item?.k === 'ordinary' ? item.type : null;
  return (
    <Step n={2} title="Band or shape" term="ordinary" hint="A bold band, border or shape. You need this or a picture (or both)." summary={ordinarySummary(design)} issues={issues} accordion={accordion} testid="step-ordinary">
      <RadioGroup label="Ordinary" class="icon-grid icon-grid-ordinary" testid="ordinary-select">
        <ChoiceButton testid="ordinary-none" checked={!type} label="No band or shape" onSelect={() => onChange(setOrdinary(design, null))} onBlocked={never} class="icon-choice">
          <NoneIcon />
          <span class="choice-label">None</span>
        </ChoiceButton>
        {DRAWN_ORDINARIES.map((t) => (
          <ChoiceButton key={t} testid={`ordinary-${t}`} checked={type === t} label={nameOf(ORDINARY_LABEL[t])} title={ORDINARY_LABEL[t].plain} onSelect={() => onChange(setOrdinary(design, t))} onBlocked={never} class="icon-choice">
            <Shield design={ICON_ORDINARY(t)} shape={shape} size={30} label={null} />
            <span class="choice-label">{capitalise(ORDINARY_LABEL[t].term)}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      {path && type && (
        <TincturePicker
          group="ordinary"
          testid="ordinary-tincture"
          legend={`Colour of the ${lower(ORDINARY_LABEL[type].plain)}`}
          choices={groupTinctureChoices(design, path)}
          value={tinctureOf(design, path)}
          onChange={(t) => onChange(setOrdinaryTincture(design, t))}
        />
      )}
    </Step>
  );
}

/** "Running (courant)": the plain-English gloss, then the charge's own blazon term; the SCA's default pose says so. */
function postureOption(design: Design, path: GroupPath, p: Posture): string {
  const item = groupAt(design, path).item;
  if (item.k !== 'charge') return capitalise(p);
  return postureLabel(item.charge, p, CHARGES[item.charge].scaDefaultPosture === p ? 'default' : null);
}

const countName = (n: number) => (n === 1 ? 'one' : numberWord(n));
const nounOf = (design: Design, path: GroupPath): string => {
  const g = groupAt(design, path);
  if (g.item.k !== 'charge') return g.count === 1 ? 'charge' : 'charges';
  const meta = CHARGES[g.item.charge];
  return g.count === 1 ? meta.name : meta.plural;
};

function picturesSummary(design: Design, path: GroupPath | null): string {
  if (!path) return 'None';
  return `${groupAt(design, path).count} ${nounOf(design, path)}, ${lower(TINCTURE_LABEL[tinctureOf(design, path)].plain)}`;
}

/** A count or placement option: blocked with its reason, or offered saying what else it changes. */
function layoutStatus(c: LayoutChoice<unknown>): OptionStatus {
  if (!c.allowed) return { kind: 'blocked', reason: c.reason };
  return c.companion ? { kind: 'with-change', note: companionNote(c.design, c.companion, 'offered') } : { kind: 'open' };
}

/** A row's options, each with its status worked out once for both the option and the notes under the row. */
function withStatus<T>(choices: LayoutChoice<T>[]): Array<{ choice: LayoutChoice<T>; status: OptionStatus }> {
  return choices.map((choice) => ({ choice, status: layoutStatus(choice) }));
}

type StatusOption<T> = { choice: LayoutChoice<T>; status: OptionStatus };

/** The options of a row that change something else too, each with what it changes, shown under the row. */
function CompanionNotes<T>({ options, name, testid }: { options: Array<StatusOption<T>>; name: (v: T) => string; testid: string }) {
  const notes = options.flatMap(({ choice, status }) => (status.kind === 'with-change' ? [{ value: choice.value, note: status.note }] : []));
  if (!notes.length) return null;
  return (
    <ul class="companion-notes" data-testid={testid}>
      {notes.map((n) => (
        <li key={String(n.value)}><strong>{name(n.value)}:</strong> {n.note.charAt(0).toLowerCase()}{n.note.slice(1)}</li>
      ))}
    </ul>
  );
}

/** Counts up to this many sit in the row; the rest are behind "More…". */
const COUNT_ROW = 6;

/** The picture list on phones shows one kind at a time; this is the kind to start on. */
function categoryOf(design: Design): ChargeCategory {
  const path = picturePath(design);
  const item = path && groupAt(design, path).item;
  return item?.k === 'charge' ? CHARGES[item.charge].category : CHARGE_CATEGORIES[0];
}

interface PictureControlsProps {
  design: Design;
  path: GroupPath;
  /** '' for the picture, 'extra-' for the extra pictures: ids and test ids of the second set are prefixed. */
  prefix: '' | 'extra-';
  onChange: (nd: Design) => void;
  onAdjust: (nd: Design, companion: Companion) => void;
  /** The note shown after a count or placement brought its partner along. */
  adjusted: ComponentChildren;
}

/** How many, where, layout, pose, face and colour of one group of pictures. */
function PictureControls({ design, path, prefix, onChange, onAdjust, adjusted }: PictureControlsProps) {
  const g = groupAt(design, path);
  const item = g.item.k === 'charge' ? g.item : null;
  const counts = withStatus(countChoices(design, path));
  const placements = withStatus(placementChoices(design, path));
  const layouts = layoutChoices(design, path);
  const postures = postureChoices(design, path);
  const mods = modifierChoices(design, path);
  const blockedPostures = postures.filter(isBlocked);
  const countWhy = useExplainer();
  const placementWhy = useExplainer();
  /** Apply the design a count or placement choice leads to; one that brings its partner along can be undone. */
  const choose = <T,>(c: LayoutChoice<T>) => {
    if (!c.allowed) return;
    if (c.companion) onAdjust(c.design, c.companion);
    else onChange(c.design);
  };
  const countButton = ({ choice: c, status }: StatusOption<number>) => (
    <ChoiceButton key={c.value} testid={`${prefix}count-${c.value}`} checked={g.count === c.value} status={status} label={capitalise(countName(c.value))} onSelect={() => choose(c)} onBlocked={countWhy.explain} class="segment">
      <span aria-hidden="true">{c.value}</span>
    </ChoiceButton>
  );
  const row = counts.filter((o) => o.choice.value <= COUNT_ROW);
  const more = counts.filter((o) => o.choice.value > COUNT_ROW);
  const layoutId = `${prefix}arrangement-select`, postureId = `${prefix}posture-select`;
  const layoutValue = layoutKey(g);
  const layoutNote = layouts.note;
  const hasSplendour = mods.some((m) => m.value === 'in-splendour');
  const tincture = tinctureOf(design, path);

  return (
    <div class="charge-options">
      <div class="control">
        <p class="picker-legend" id={`${prefix}count-label`}>How many</p>
        <RadioGroup label="How many" class="segmented" testid={`${prefix}count-select`}>{row.map(countButton)}</RadioGroup>
        {(more.some((o) => o.choice.allowed) || g.count > COUNT_ROW) && (
          <details class="count-more" data-testid={`${prefix}count-more`} open={g.count > COUNT_ROW}>
            <summary>More…</summary>
            <RadioGroup label="More numbers" class="segmented" testid={`${prefix}count-more-select`}>{more.map(countButton)}</RadioGroup>
          </details>
        )}
        <CompanionNotes options={counts} name={(n) => capitalise(countName(n))} testid={`${prefix}count-companion-notes`} />
        {countWhy.node}
      </div>

      {placements.length > 0 && (
        <div class="control">
          <p class="picker-legend">Where it goes</p>
          <RadioGroup label="Where it goes" class="segmented segmented-wide" testid={`${prefix}placement-select`}>
            {placements.map(({ choice: c, status }) => {
              const text = placementLabel(design, c.value);
              return (
                <ChoiceButton key={c.value} testid={`${prefix}placement-${c.value}`} checked={simpleParts(design).picture?.placement === c.value} status={status} label={text} onSelect={() => choose(c)} onBlocked={placementWhy.explain} class="segment">
                  <span>{text}</span>
                </ChoiceButton>
              );
            })}
          </RadioGroup>
          <CompanionNotes options={placements} name={(p) => placementLabel(design, p)} testid={`${prefix}placement-companion-notes`} />
          {placementWhy.node}
          {adjusted}
        </div>
      )}
      {placements.length === 0 && adjusted}

      <div class="control">
        <label class="picker-legend" for={layoutId}>Layout</label>
        <select
          id={layoutId}
          class="select"
          data-testid={layoutId}
          disabled={layouts.mode !== 'choose'}
          aria-describedby={layoutNote ? `${layoutId}-note` : undefined}
          value={layoutValue}
          onChange={(e) => onChange(setLayout(design, path, (e.currentTarget as HTMLSelectElement).value as LayoutKey))}
        >
          {layouts.mode === 'choose'
            ? layouts.choices.map((c) => (
                <option key={c.value} value={c.value} disabled={!c.allowed}>
                  {plainFirst(layoutLabel(c.value))}{c.allowed ? '' : ' (not available)'}
                </option>
              ))
            : <option value={layoutValue}>{layouts.mode === 'single' ? 'Single, centred' : 'Set by the band or shape'}</option>}
        </select>
        {layoutNote && <p class="control-note" id={`${layoutId}-note`}>{layoutNote}</p>}
      </div>

      {postures.length > 0 && item && (
        <div class="control">
          <label class="picker-legend" for={postureId}>Pose</label>
          <select
            id={postureId}
            class="select"
            data-testid={postureId}
            value={item.posture ?? ''}
            title={CHARGES[item.charge].scaDefaultPosture === null ? `The SCA has no default pose for ${CHARGES[item.charge].article} ${CHARGES[item.charge].name}, so the blazon always names it.` : undefined}
            aria-describedby={blockedPostures.length > 0 ? `${postureId}-note` : undefined}
            onChange={(e) => onChange(setPosture(design, path, (e.currentTarget as HTMLSelectElement).value as Posture))}
          >
            {postures.map((c) => (
              <option key={c.value} value={c.value} disabled={!c.allowed}>
                {postureOption(design, path, c.value)}{c.allowed ? '' : ' (not drawn)'}
              </option>
            ))}
          </select>
          {blockedPostures.length > 0 && <p class="control-note" id={`${postureId}-note`}>{blockedPostures[0].reason}</p>}
        </div>
      )}

      {hasSplendour && item && (
        <div class="control">
          <label class="check">
            <input
              type="checkbox"
              data-testid={`${prefix}splendour-toggle`}
              checked={item.mods.some((m) => m.id === 'in-splendour')}
              onChange={(e) => onChange(setModifier(design, path, 'in-splendour', (e.currentTarget as HTMLInputElement).checked))}
            />
            <span>With a face (in splendour)</span>
          </label>
        </div>
      )}

      <TincturePicker
        group={`${prefix}charge`}
        testid={`${prefix}charge-tincture`}
        legend={`Colour of the ${nounOf(design, path)}`}
        choices={groupTinctureChoices(design, path)}
        value={tincture}
        onChange={(t) => onChange(setGroupTincture(design, path, t))}
      />
    </div>
  );
}

interface ChargesStepProps extends StepProps {
  compact: boolean;
  onAdjust: (nd: Design, companion: Companion) => void;
  /** The note shown after a count or placement brought its partner along. */
  adjusted: ComponentChildren;
}

export function ChargesStep({ design, onChange, onAdjust, adjusted, issues, accordion, compact }: ChargesStepProps) {
  const path = picturePath(design);
  const item = path && groupAt(design, path).item;
  const selected = item?.k === 'charge' ? item : null;
  const [tab, setTab] = useState<ChargeCategory>(() => categoryOf(design));
  // A design loaded from outside (an example, a registry entry) brings its own kind of picture along.
  const selectedCategory = selected ? CHARGES[selected.charge].category : null;
  useEffect(() => {
    if (selectedCategory) setTab(selectedCategory);
  }, [selectedCategory]);

  return (
    <Step n={3} title="Picture" term="charge" hint="Pick a picture and repeat it up to twelve times. You need this or a band or shape (or both)." summary={picturesSummary(design, path)} issues={issues} accordion={accordion} testid="step-charges">
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
          <ChoiceButton testid="charge-none" checked={!selected} label="No picture" onSelect={() => onChange(setCharge(design, 'picture', null))} onBlocked={never} class="icon-choice charge-choice">
            <NoneIcon />
            <span class="choice-label">None</span>
          </ChoiceButton>
        </div>
        {CHARGE_CATEGORIES.filter((cat) => !compact || cat === tab).map((cat) => (
          <div class="charge-category" key={cat} role="group" aria-label={CATEGORY_LABEL[cat]}>
            <p class="charge-category-label" aria-hidden="true">{CATEGORY_LABEL[cat]}</p>
            <div class="icon-grid icon-grid-charges">
              {chargesInCategory(cat).map((m) => (
                <ChoiceButton key={m.id} testid={`charge-${m.id}`} checked={selected?.charge === m.id} label={chargeLabel(m.id)} onSelect={() => onChange(setCharge(design, 'picture', m.id))} onBlocked={never} class="icon-choice charge-choice">
                  <ChargeIcon path={chargePath(m.id, m.defaultPosture, [])} size={30} />
                  <span class="choice-label">{chargeLabel(m.id)}</span>
                </ChoiceButton>
              ))}
            </div>
          </div>
        ))}
      </RadioGroup>
      {peripheralPath(design) && (
        <p class="control-note" data-testid="peripheral-picture-note">Choosing a picture takes away the top band or border: this builder can't draw them together.</p>
      )}
      <p class="charge-selected" data-testid="charge-selected">
        {selected ? <>Selected: <strong>{chargeLabel(selected.charge)}</strong></> : 'No picture selected.'}
      </p>

      {path && selected && <PictureControls design={design} path={path} prefix="" onChange={onChange} onAdjust={onAdjust} adjusted={adjusted} />}
    </Step>
  );
}

/** What the extra pictures are sitting on, in the builder's words: "band" or "top bar". */
function hostWord(design: Design): string {
  const path = ordinaryPath(design);
  const item = path && groupAt(design, path).item;
  return item?.k === 'ordinary' && item.type === 'chief' ? 'top bar' : 'band';
}

const PERIPHERAL_BUTTON: Record<(typeof PERIPHERAL_TYPES)[number], string> = {
  chief: 'Add a top band (chief)',
  bordure: 'Add a border (bordure)',
};

/** The buttons that add a layer beside the picture: extra pictures on the band (or top bar), or a top band or border beside the band; each shown only while it can be drawn. */
export function AddExtraLayer({ design, onChange }: { design: Design; onChange: (nd: Design) => void }) {
  const path = picturePath(design);
  const item = path && groupAt(design, path).item;
  // Any charge other than the picture's own to start with; the extra card can swap it.
  const start = item?.k === 'charge' && item.charge === 'mullet' ? 'heart' : 'mullet';
  const pictures = !extraPicturePath(design) && canAddExtraPicture(design);
  const peripherals = peripheralPath(design) ? [] : PERIPHERAL_TYPES.filter((t) => canAddPeripheral(design, t));
  if (!pictures && !peripherals.length) return null;
  return (
    <p class="add-extra">
      {pictures && (
        <button type="button" class="button-secondary button-small" data-testid="add-extra-picture" onClick={() => onChange(addExtraPicture(design, start))}>
          + Add pictures on the {hostWord(design)}
        </button>
      )}
      {peripherals.map((t) => (
        <button key={t} type="button" class="button-secondary button-small" data-testid={`add-peripheral-${t}`} onClick={() => onChange(addPeripheral(design, t))}>
          + {PERIPHERAL_BUTTON[t]}
        </button>
      ))}
    </p>
  );
}

/** Step 4 when the band has a top band or border beside it: its colour, and removing it. */
export function PeripheralStep({ design, onChange, issues, accordion }: StepProps) {
  const path = peripheralPath(design);
  const item = path && groupAt(design, path).item;
  if (!path || item?.k !== 'ordinary') return null;
  const label = ORDINARY_LABEL[item.type];
  const colour = lower(TINCTURE_LABEL[tinctureOf(design, path)].plain);
  return (
    <Step n={4} title={capitalise(label.plain)} term={label.term} hint="Drawn beside the band; a picture can't be added while it is there." summary={`${colour}`} issues={issues} accordion={accordion} testid="step-peripheral">
      <TincturePicker
        group="peripheral"
        testid="peripheral-tincture"
        legend={`Colour of the ${lower(label.plain)}`}
        choices={groupTinctureChoices(design, path)}
        value={tinctureOf(design, path)}
        onChange={(t) => onChange(setPeripheralTincture(design, t))}
      />
      <p>
        <button type="button" class="button-tertiary" data-testid="remove-peripheral" onClick={() => onChange(removePeripheral(design))}>
          Remove the {lower(label.plain)}
        </button>
      </p>
    </Step>
  );
}

interface ExtraStepProps extends StepProps {
  onAdjust: (nd: Design, companion: Companion) => void;
}

/** Step 4: the pictures that sit on the band or top bar, when there are some. */
export function ExtraStep({ design, onChange, onAdjust, issues, accordion }: ExtraStepProps) {
  const path = extraPicturePath(design);
  const item = path && groupAt(design, path).item;
  if (!path || item?.k !== 'charge') return null;
  const host = hostWord(design);
  return (
    <Step n={4} title={groupLabel(design, path)} term={`charges on the ${host === 'band' ? 'ordinary' : 'chief'}`} hint={`Pictures drawn on the ${host}, as well as the picture above.`} summary={picturesSummary(design, path)} issues={issues} accordion={accordion} testid="step-extra">
      <div class="control">
        <label class="picker-legend" for="extra-charge-select">Picture</label>
        <select
          id="extra-charge-select"
          class="select"
          data-testid="extra-charge-select"
          value={item.charge}
          onChange={(e) => onChange(setCharge(design, 'extra', (e.currentTarget as HTMLSelectElement).value as (typeof CHARGE_IDS)[number]))}
        >
          {CHARGE_IDS.map((id) => <option key={id} value={id}>{chargeLabel(id)}</option>)}
        </select>
      </div>
      <PictureControls design={design} path={path} prefix="extra-" onChange={onChange} onAdjust={onAdjust} adjusted={null} />
      <p>
        <button type="button" class="button-tertiary" data-testid="remove-extra-picture" onClick={() => onChange(removeExtraPicture(design))}>
          Remove these pictures
        </button>
      </p>
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
