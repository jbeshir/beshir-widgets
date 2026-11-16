// Field-shape picker: heater shield, square banner, round or lozenge, each shown as a small
// thumbnail of the current design. The shape is display only — it never changes the arms, their
// blazon or whether they are available — and the picker says so.

import { FIELD_SHAPES, FIELD_SHAPE_NAME, crampedInShape, type FieldShape, type Design } from '../../lib/heraldry';
import { Shield } from '../Shield';
import { ChoiceButton, RadioGroup } from './Choices';

interface Props {
  design: Design;
  value: FieldShape;
  onChange: (shape: FieldShape) => void;
  /** Prefix for the option test ids and element ids (`<prefix>-<shape>`), unique on the page. */
  idPrefix: string;
}

/** Shapes are never blocked; ChoiceButton still wants a handler. */
const never = () => {};

export function ShapePicker({ design, value, onChange, idPrefix }: Props) {
  const noteId = `${idPrefix}-note`;
  // what the chosen shape can't draw at a size that reads, though the heater can: said here, as the design's verdict is the heater's
  const cramped = crampedInShape(design, value);
  return (
    <div class="shape-picker" data-testid={`${idPrefix}-picker`}>
      <p class="shape-title" id={noteId}>
        <span class="shape-label">Shape</span> — just for display; doesn't change your arms
      </p>
      <RadioGroup label="Shape" describedBy={noteId} class="shape-grid" testid={`${idPrefix}-select`}>
        {FIELD_SHAPES.map((s) => (
          <ChoiceButton key={s} testid={`${idPrefix}-${s}`} checked={value === s} label={FIELD_SHAPE_NAME[s]} onSelect={() => onChange(s)} onBlocked={never} class="icon-choice shape-choice">
            <Shield design={design} shape={s} size={28} label={null} />
            <span class="choice-label">{FIELD_SHAPE_NAME[s]}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      {cramped.length > 0 && (
        <ul class="shape-cramped" data-testid={`${idPrefix}-cramped`}>
          {cramped.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
    </div>
  );
}
