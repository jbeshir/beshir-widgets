// The one "+ Add pictures around / on / above" chooser under the picture step: a button for each layer the
// design can take (pictures on the band, a top band, a border), shown only while some layer can be drawn.

import { useState } from 'preact/hooks';
import { addLayer, groupAt, layerChoices, ORDINARY_LABEL, type Design, type LayerKey } from '../../lib/heraldry';
import { ordinaryPath } from '../../lib/builder';

/** What the pictures on the band are sitting on, in the builder's words: "band" or "top bar". */
function hostWord(design: Design): string {
  const path = ordinaryPath(design);
  const item = path && groupAt(design, path).item;
  return item?.k === 'ordinary' && item.type === 'chief' ? 'top bar' : 'band';
}

const buttonText = (design: Design, key: LayerKey): string => {
  switch (key) {
    case 'on-ordinary': return `Add pictures on the ${hostWord(design)}`;
    case 'chief': case 'bordure': return `Add a ${key === 'chief' ? 'top band' : 'border'} (${ORDINARY_LABEL[key].term})`;
  }
};

export function AddLayer({ design, onChange }: { design: Design; onChange: (nd: Design) => void }) {
  const [open, setOpen] = useState(false);
  const allowed = layerChoices(design).filter((c) => c.allowed).map((c) => c.value);
  if (!allowed.length) return null;
  return (
    <div class="add-layer">
      <button type="button" class="button-secondary button-small" aria-expanded={open ? 'true' : 'false'} aria-controls="add-layer-options" data-testid="add-layer-toggle" onClick={() => setOpen(!open)}>
        + Add pictures around, on or above
      </button>
      <p class="add-layer-options" id="add-layer-options" hidden={!open}>
        {allowed.map((key) => (
          <button key={key} type="button" class="button-secondary button-small" data-testid={`add-layer-${key}`} onClick={() => onChange(addLayer(design, key))}>
            + {buttonText(design, key)}
          </button>
        ))}
      </p>
    </div>
  );
}
