// The numbered step card of one layer beyond the band and the picture: its title and role, what it holds
// (a picture list with the picture controls, or a colour), and a button that removes it.

import { CHARGE_IDS, ORDINARY_LABEL, PLACE_LABEL, TINCTURE_LABEL, chargeLabel, groupAt, groupLabel, groupTinctureChoices, layerPath, removeLayer, setLayerTincture, type ChargeId, type Companion, type Design, type Issue, type LayerKey } from '../../lib/heraldry';
import { capitalise } from '../../lib/heraldry/words';
import { setCharge } from '../../lib/builder';
import { PictureControls, Step, lower, picturesSummary, tinctureOf, type Accordion } from './BuilderSteps';
import { TincturePicker } from './TincturePicker';

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
  around: 'Pictures set around the picture: in its corners, at its sides, or in a ring round the edge.',
  'on-picture': 'Small pictures drawn on the main picture, on each one if there are several.',
  'on-ordinary': 'Pictures drawn on the band, as well as the picture above.',
  'on-chief': 'Pictures drawn on the top bar.',
  'on-bordure': 'Small pictures drawn along the border.',
  'in-chief': 'Pictures in a row across the top, beside the main picture or band.',
  'in-base': 'Pictures in a row across the bottom, beside the main picture or band.',
  'in-canton': 'A picture in the top corner, beside the main picture or band.',
} as const;

/** The step of a layer the design has: pictures on the band, or a top band or border set beside it. */
export function LayerStep({ design, place, n, onChange, onAdjust, issues, accordion }: Props) {
  const path = layerPath(design, place);
  if (!path) return null;
  const item = groupAt(design, path).item;
  const remove = (label: string) => (
    <p>
      <button type="button" class="button-tertiary" data-testid={`remove-layer-${place}`} onClick={() => onChange(removeLayer(design, place))}>{label}</button>
    </p>
  );
  const testid = `step-layer-${place}`;
  const title = groupLabel(design, path);
  if (item.k === 'ordinary') {
    const label = ORDINARY_LABEL[item.type];
    return (
      <Step n={n} title={capitalise(label.plain)} term={label.term} hint="Drawn beside the band; the pictures keep clear of it." summary={lower(TINCTURE_LABEL[tinctureOf(design, path)].plain)} issues={issues} accordion={accordion} testid={testid}>
        <TincturePicker
          group={place}
          testid={`${place}-tincture`}
          legend={`Colour of the ${lower(label.plain)}`}
          choices={groupTinctureChoices(design, path)}
          value={tinctureOf(design, path)}
          onChange={(t) => onChange(setLayerTincture(design, place, t))}
        />
        {remove(`Remove the ${lower(label.plain)}`)}
      </Step>
    );
  }
  if (item.k !== 'charge' || place === 'chief' || place === 'bordure') return null;
  return (
    <Step n={n} title={title} term={PLACE_LABEL[place].term} hint={PICTURES_HINT[place]} summary={picturesSummary(design, path)} issues={issues} accordion={accordion} testid={testid}>
      <div class="control">
        <label class="picker-legend" for={`${place}-charge-select`}>Picture</label>
        <select
          id={`${place}-charge-select`}
          class="select"
          data-testid={`${place}-charge-select`}
          value={item.charge}
          onChange={(e) => onChange(setCharge(design, place, (e.currentTarget as HTMLSelectElement).value as ChargeId))}
        >
          {CHARGE_IDS.map((id) => <option key={id} value={id}>{chargeLabel(id)}</option>)}
        </select>
      </div>
      <PictureControls design={design} path={path} prefix={`${place}-`} onChange={onChange} onAdjust={onAdjust} adjusted={null} />
      {remove('Remove these pictures')}
    </Step>
  );
}
