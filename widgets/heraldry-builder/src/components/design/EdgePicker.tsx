// The edge of a division or stripes: one option per line, each with a small picture of the shape drawn with it, and, for a quartered
// field, which of its two lines carries the edge. One of the contents of "More divisions and edges…".

import { LINE_LABEL, resolve, type Choice, type Design, type EdgeSide, type FieldShape, type Line } from '../../lib/heraldry';
import { capitalise } from '../../lib/heraldry/words';
import { Shield } from '../Shield';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';

/** The icon designs already drawn, by `${key}|${line}|${shape}`: a chip's picture only changes with the shape it is drawn for. */
const ICONS = new Map<string, Design>();

/** A shape in gold and azure drawn with a line; `field` is the paint's own loose input without its lines. */
function lineIcon(key: string, field: object, line: Line, shape: FieldShape): Design {
  const id = `${key}|${line}|${shape}`;
  let design = ICONS.get(id);
  if (!design) {
    const r = resolve({ v: 2, field: { ...field, lines: { a: line, b: line } }, groups: [] });
    if (!r.ok) throw new Error(`edge icon does not resolve: ${r.errors.map((e) => e.message).join('; ')}`);
    design = r.design;
    ICONS.set(id, design);
  }
  return design;
}

export const SIDE_LABEL: Record<EdgeSide, string> = { both: 'Both lines', a: 'Up-and-down line only', b: 'Across line only' };

interface Props {
  /** The options are <testid>-select, <testid>-<line> and <testid>-side-<side>. */
  testid: string;
  /** What is edged: "the background". */
  noun: string;
  /** Names the shape the chips picture (the division or variation and its count) and its loose input. */
  iconKey: string;
  icon: object;
  shape: FieldShape;
  lines: Choice<Line>[];
  line: Line;
  onLine: (line: Line) => void;
  sides: Choice<EdgeSide>[];
  side: EdgeSide;
  onSide: (side: EdgeSide) => void;
}

export function EdgePicker({ testid, noun, iconKey, icon, shape, lines, line, onLine, sides, side, onSide }: Props) {
  const { explain, node: explainer } = useExplainer();
  return (
    <div class="fur-picker" data-testid={testid}>
      <p class="picker-legend">Edge of {noun}</p>
      <RadioGroup label={`Edge of ${noun}`} class="icon-grid icon-grid-field" testid={`${testid}-select`}>
        {lines.map((c) => {
          const label = LINE_LABEL[c.value];
          const name = c.value === 'plain' ? 'Straight' : capitalise(label.term);
          return (
            <ChoiceButton
              key={c.value} testid={`${testid}-${c.value}`} checked={line === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
              label={`${name}, ${label.plain.toLowerCase()}`} title={label.plain} onSelect={() => onLine(c.value)} onBlocked={explain} class="icon-choice"
            >
              <Shield design={lineIcon(iconKey, icon, c.value, shape)} shape={shape} size={30} label={null} />
              <span class="choice-label">{name}</span>
            </ChoiceButton>
          );
        })}
      </RadioGroup>
      {sides.length > 0 && (
        <>
          <p class="picker-legend">Which lines</p>
          <RadioGroup label="Which lines of the background" class="segmented segmented-wide" testid={`${testid}-side`}>
            {sides.map((c) => (
              <ChoiceButton key={c.value} testid={`${testid}-side-${c.value}`} checked={side === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }} label={SIDE_LABEL[c.value]} onSelect={() => onSide(c.value)} onBlocked={explain} class="segment">
                <span>{SIDE_LABEL[c.value]}</span>
              </ChoiceButton>
            ))}
          </RadioGroup>
        </>
      )}
      {explainer}
    </div>
  );
}
