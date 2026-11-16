// The numbered step card of one layer beyond the band and the picture: its title and role, a button in its heading that
// removes it, and what it holds (a picture list with the picture controls, or a colour).

import {
  CATEGORY_LABEL, CHARGE_CATEGORIES, ORDINARY_LABEL, PLACE_LABEL, chargeLabel, chargesInCategory, groupAt, groupLabel, overallItemChoices, pathOfPlace, removeLayer, setOverallItem,
  type ChargeId, type Choice, type Companion, type Design, type Issue, type LayerItem, type LayerKey, type OrdinaryType,
} from '../../lib/heraldry';
import { capitalise } from '../../lib/heraldry/words';
import { setCharge } from '../../lib/builder';
import { PictureControls, Step, lower, picturesSummary, colourWords, type Accordion } from './BuilderSteps';
import { PaintPicker } from './PaintPicker';
import { pictureWord } from './AddLayer';

interface Props {
  design: Design;
  place: LayerKey;
  /** The step's number: the layers are numbered from 4 in the order they are shown. */
  n: number;
  onChange: (nd: Design) => void;
  onAdjust: (nd: Design, companion: Companion) => void;
  issues: Issue[];
  accordion: Accordion | null;
}

const PICTURES_HINT = {
  'co-primary': 'A second main picture, laid out with the first: side by side, one above the other, or as the shield is split.',
  around: 'Pictures set around the picture: in its corners, at its sides, or in a ring round the edge.',
  'on-picture': 'Small pictures drawn on the main picture, on each one if there are several.',
  'on-ordinary': 'Pictures drawn on the band, as well as the picture above.',
  'on-chief': 'Pictures drawn on the top bar.',
  'on-bordure': 'Small pictures drawn along the border.',
  'in-chief': 'Pictures in a row across the top, beside the main picture or band.',
  'in-base': 'Pictures in a row across the bottom, beside the main picture or band.',
  'in-canton': 'A picture in the top corner, beside the main picture or band.',
} as const;

const itemValue = (item: LayerItem): string => (item.k === 'ordinary' ? `ordinary:${item.type}` : `charge:${item.charge}`);
const itemOf = (value: string): LayerItem => (
  value.startsWith('ordinary:') ? { k: 'ordinary', type: value.slice('ordinary:'.length) as OrdinaryType } : { k: 'charge', charge: value.slice('charge:'.length) as ChargeId }
);

/** The step of what lies across everything: a band or shape, or a picture, with its colour and (a picture) its count. */
function OverallStep({ design, n, onChange, onAdjust, issues, accordion }: Omit<Props, 'place'>) {
  const path = pathOfPlace(design, 'overall')!;
  const group = groupAt(design, path);
  const item = group.item;
  const current: LayerItem = item.k === 'ordinary' ? { k: 'ordinary', type: item.type } : { k: 'charge', charge: item.charge };
  const choices = overallItemChoices(design);
  const option = (c: Choice<LayerItem>) => {
    const label = c.value.k === 'ordinary' ? capitalise(ORDINARY_LABEL[c.value.type].plain) : chargeLabel(c.value.charge);
    return <option key={itemValue(c.value)} value={itemValue(c.value)} disabled={!c.allowed} title={c.allowed ? undefined : c.reason}>{label}{c.allowed ? '' : ' (not here)'}</option>;
  };
  const blocked = choices.find((c) => !c.allowed && itemValue(c.value) === itemValue(current));
  const summary = item.k === 'ordinary' ? lower(ORDINARY_LABEL[item.type].plain) : picturesSummary(design, path);
  return (
    <Step
      n={n} title={groupLabel(design, path)} term={PLACE_LABEL.overall.term} hint="A band or picture drawn across the middle of everything else." summary={summary} issues={issues} accordion={accordion} testid="step-layer-overall"
      remove={{ label: 'Remove what goes across everything', testid: 'remove-layer-overall', onRemove: () => onChange(removeLayer(design, 'overall')) }}
    >
      <div class="control">
        <label class="picker-legend" for="overall-item-select">What goes across</label>
        <select
          id="overall-item-select"
          class="select"
          data-testid="overall-item-select"
          value={itemValue(current)}
          onChange={(e) => onChange(setOverallItem(design, itemOf((e.currentTarget as HTMLSelectElement).value)))}
        >
          <optgroup label="Band or shape">{choices.filter((c) => c.value.k === 'ordinary').map(option)}</optgroup>
          <optgroup label="Picture">{choices.filter((c) => c.value.k === 'charge').map(option)}</optgroup>
        </select>
        {blocked && !blocked.allowed && <p class="field-hint">{blocked.reason}</p>}
      </div>
      {item.k === 'ordinary'
        ? (
          <PaintPicker design={design} path={path} group="overall" testid="overall-tincture" noun={lower(ORDINARY_LABEL[item.type].plain)} onChange={onChange} />
        )
        : <PictureControls design={design} path={path} prefix="overall-" onChange={onChange} onAdjust={onAdjust} adjusted={null} />}
    </Step>
  );
}

/** The step of a layer the design has: pictures on the band, or a top band or border set beside it. */
export function LayerStep({ design, place, n, onChange, onAdjust, issues, accordion }: Props) {
  const path = pathOfPlace(design, place);
  if (!path) return null;
  if (place === 'overall') return <OverallStep design={design} n={n} onChange={onChange} onAdjust={onAdjust} issues={issues} accordion={accordion} />;
  const item = groupAt(design, path).item;
  const remove = (label: string) => ({ label, testid: `remove-layer-${place}`, onRemove: () => onChange(removeLayer(design, place)) });
  const testid = `step-layer-${place}`;
  const title = place === 'around' ? `Pictures around the ${pictureWord(design)}` : place === 'on-picture' ? `Pictures on the ${pictureWord(design)}` : groupLabel(design, path);
  if (item.k === 'ordinary') {
    const label = ORDINARY_LABEL[item.type];
    return (
      <Step n={n} title={capitalise(label.plain)} term={label.term} hint="Drawn beside the band; the pictures keep clear of it." summary={colourWords(design, path)} issues={issues} accordion={accordion} testid={testid} remove={remove(`Remove the ${lower(label.plain)}`)}>
        <PaintPicker design={design} path={path} group={place} testid={`${place}-tincture`} noun={lower(label.plain)} onChange={onChange} />
      </Step>
    );
  }
  if (item.k !== 'charge' || place === 'chief' || place === 'bordure') return null;
  return (
    <Step n={n} title={title} term={PLACE_LABEL[place].term} hint={PICTURES_HINT[place]} summary={picturesSummary(design, path)} issues={issues} accordion={accordion} testid={testid} remove={remove(`Remove the ${lower(title)}`)}>
      <div class="control">
        <label class="picker-legend" for={`${place}-charge-select`}>Picture</label>
        <select
          id={`${place}-charge-select`}
          class="select"
          data-testid={`${place}-charge-select`}
          value={item.charge}
          onChange={(e) => onChange(setCharge(design, place, (e.currentTarget as HTMLSelectElement).value as ChargeId))}
        >
          {CHARGE_CATEGORIES.map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
              {chargesInCategory(cat).map((m) => <option key={m.id} value={m.id}>{chargeLabel(m.id)}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <PictureControls design={design} path={path} prefix={`${place}-`} onChange={onChange} onAdjust={onAdjust} adjusted={null} />
    </Step>
  );
}
