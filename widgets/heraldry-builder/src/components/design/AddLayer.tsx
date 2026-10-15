// The one "+ Add pictures around, on or above" chooser after the step cards: the layers the design can take, in three
// small groups (on it, around or beside it, across it), each named after what it goes with ("Around the lion"). A layer
// that can't be added here stays in the list, greyed, and says why. Adding one closes the chooser and moves to its new card.

import { useState } from 'preact/hooks';
import { addLayer, addedLayerStep, groupAt, layerChoices, simpleParts, type Choice, type Design, type LayerKey } from '../../lib/heraldry';
import { ordinaryPath, picturePath } from '../../lib/builder';
import { nounOf } from './BuilderSteps';
import { LockGlyph, useExplainer } from './Explainer';

/** What the pictures on the band are sitting on, in the builder's words: "band", "top bar" or "border". */
function hostWord(design: Design): string {
  const path = ordinaryPath(design);
  const item = path && groupAt(design, path).item;
  return item?.k === 'ordinary' && item.type === 'chief' ? 'top bar' : item?.k === 'ordinary' && item.type === 'bordure' ? 'border' : 'band';
}

/** The main picture's name ("lion", "mullets"), or "picture" when there is none yet. */
export function pictureWord(design: Design): string {
  const path = picturePath(design);
  return path ? nounOf(design, path) : 'picture';
}

const optionText = (design: Design, key: LayerKey): string => {
  switch (key) {
    case 'on-picture': return `On the ${pictureWord(design)}`;
    case 'on-ordinary': return `On the ${hostWord(design)}`;
    case 'on-chief': return 'On the top bar';
    case 'on-bordure': return 'On the border';
    case 'around': return `Around the ${pictureWord(design)}`;
    case 'co-primary': return `A second picture beside the ${pictureWord(design)}`;
    case 'in-chief': return 'Along the top (in chief)';
    case 'in-base': return 'Along the bottom (in base)';
    case 'in-canton': return 'In the top corner (in canton)';
    case 'chief': return 'A top band (chief)';
    case 'bordure': return 'A border (bordure)';
    case 'overall': return 'Across everything (overall)';
  }
};

/**
 * Whether a layer is about something the design has: pictures on the band, the top bar or the border, and a top band or
 * border beside the band, are listed only once there is one. The rest are listed greyed when they can't be added here.
 */
function applies(design: Design, key: LayerKey): boolean {
  const parts = simpleParts(design);
  const has = (type: 'chief' | 'bordure') => parts.peripherals.some((p) => p.place === type);
  switch (key) {
    case 'on-ordinary': case 'chief': case 'bordure': return parts.ordinary !== null;
    case 'on-chief': return has('chief');
    case 'on-bordure': return has('bordure');
    default: return true;
  }
}

/** The chooser's groups, in order. */
const GROUPS: ReadonlyArray<{ heading: string; keys: readonly LayerKey[] }> = [
  { heading: 'On it', keys: ['on-picture', 'on-ordinary', 'on-chief', 'on-bordure'] },
  { heading: 'Around or beside it', keys: ['around', 'in-chief', 'in-base', 'in-canton', 'co-primary', 'chief', 'bordure'] },
  { heading: 'Across it', keys: ['overall'] },
];

interface Props {
  design: Design;
  onChange: (nd: Design) => void;
  /** Called after a layer is added, to move to the step that shows it (its card, or the band step). */
  onAdded: (step: LayerKey | 'ordinary') => void;
}

export function AddLayer({ design, onChange, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const { explain, node: explainer } = useExplainer();
  const choices = layerChoices(design).filter((c) => applies(design, c.value));
  if (!choices.some((c) => c.allowed)) return null;
  const option = (c: Choice<LayerKey>) => {
    const text = optionText(design, c.value);
    return c.allowed
      ? (
        <button
          key={c.value} type="button" class="button-secondary button-small" data-testid={`add-layer-${c.value}`}
          onClick={() => { const nd = addLayer(design, c.value); onChange(nd); setOpen(false); onAdded(addedLayerStep(nd, c.value)); }}
        >
          {text}
        </button>
      )
      : (
        <button
          key={c.value} type="button" class="button-secondary button-small is-blocked" data-testid={`add-layer-${c.value}`} aria-disabled="true"
          onClick={(e) => explain({ anchor: e.currentTarget as HTMLElement, kind: 'structure', title: `${text} isn't available`, reason: c.reason })}
        >
          <span>{text}</span>
          <LockGlyph />
        </button>
      );
  };
  return (
    <div class="add-layer">
      <button type="button" class="button-secondary button-small" aria-expanded={open ? 'true' : 'false'} aria-controls="add-layer-options" data-testid="add-layer-toggle" onClick={() => setOpen(!open)}>
        + Add pictures around, on or above
      </button>
      <div class="add-layer-options" id="add-layer-options" hidden={!open}>
        {GROUPS.map(({ heading, keys }) => {
          const shown = keys.flatMap((key) => choices.filter((c) => c.value === key));
          return shown.length > 0 && (
            <div key={heading} class="add-layer-group" role="group" aria-label={heading}>
              <p class="add-layer-heading" aria-hidden="true">{heading}</p>
              <div class="add-layer-row">{shown.map(option)}</div>
            </div>
          );
        })}
        {explainer}
      </div>
    </div>
  );
}
