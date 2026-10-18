// The edge of a division, stripes, band or shape: one option per line, each with a small picture of the shape drawn with it, and, for a
// quartered field or a two-edged band, which of its lines or edges carries it. The content of "More … and edges…".

import { Fragment } from 'preact';
import { LINE_LABEL, resolve, type Choice, type Design, type EdgeSide, type FieldShape, type Line } from '../../lib/heraldry';
import { capitalise } from '../../lib/heraldry/words';
import { Shield } from '../Shield';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';

/** The icon designs already drawn, by `${key}|${line}|${shape}`: a chip's picture only changes with the shape it is drawn for. */
const ICONS = new Map<string, Design>();

/** A shape in gold and azure drawn with a line; `make` is the loose design input of the shape with that line. */
function lineIcon(key: string, make: (line: Line) => object, line: Line, shape: FieldShape): Design {
  const id = `${key}|${line}|${shape}`;
  let design = ICONS.get(id);
  if (!design) {
    const r = resolve(make(line) as Parameters<typeof resolve>[0]);
    if (!r.ok) throw new Error(`edge icon does not resolve: ${r.errors.map((e) => e.message).join('; ')}`);
    design = r.design;
    ICONS.set(id, design);
  }
  return design;
}

/** The lines in the order the Society's blazons use them (Laurel's armorial: embattled, wavy, indented, engrailed, …); the rest follow in the library's order. */
const COMMON_LINES: readonly Line[] = ['plain', 'embattled', 'wavy', 'indented', 'engrailed', 'rayonny', 'enarched', 'invected'];

/** The chips in that order, the lines before the break first. */
function byFrequency(lines: Choice<Line>[]): Choice<Line>[] {
  const rank = (c: Choice<Line>) => { const i = COMMON_LINES.indexOf(c.value); return i < 0 ? COMMON_LINES.length : i; };
  return lines.map((c, n) => ({ c, n })).sort((a, b) => rank(a.c) - rank(b.c) || a.n - b.n).map(({ c }) => c);
}

interface Props {
  /** The options are <testid>-select, <testid>-<line> and <testid>-side-<side>. */
  testid: string;
  /** What is edged: "the background", "the band". */
  noun: string;
  /** Names the shape the chips picture (the division, stripes or band and its count) and builds its loose design input drawn with a line. */
  iconKey: string;
  icon: (line: Line) => object;
  shape: FieldShape;
  lines: Choice<Line>[];
  line: Line;
  onLine: (line: Line) => void;
  sides: Choice<EdgeSide>[];
  side: EdgeSide;
  /** What the sides are ("lines" of a quartered field, "edges" of a band) and what each is called: "Both lines", "Top edge only". */
  sideNoun: 'lines' | 'edges';
  sideLabels: Record<EdgeSide, string>;
  onSide: (side: EdgeSide) => void;
}

export function EdgePicker({ testid, noun, iconKey, icon, shape, lines, line, onLine, sides, side, sideNoun, sideLabels, onSide }: Props) {
  const { explain, node: explainer } = useExplainer();
  return (
    <div class="fur-picker" data-testid={testid}>
      <p class="picker-legend">Edge of {noun}</p>
      <RadioGroup label={`Edge of ${noun}`} class="icon-grid icon-grid-field" testid={`${testid}-select`}>
        {byFrequency(lines).map((c, n) => {
          const label = LINE_LABEL[c.value];
          const name = c.value === 'plain' ? 'Straight' : capitalise(label.term);
          return (
            <Fragment key={c.value}>
              {n === COMMON_LINES.length && <span class="icon-grid-break" role="presentation" />}
              <ChoiceButton
                testid={`${testid}-${c.value}`} checked={line === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
                label={`${name}, ${label.plain.toLowerCase()}`} title={label.plain} onSelect={() => onLine(c.value)} onBlocked={explain} class="icon-choice"
              >
                <Shield design={lineIcon(iconKey, icon, c.value, shape)} shape={shape} size={30} label={null} />
                <span class="choice-label">{name}</span>
              </ChoiceButton>
            </Fragment>
          );
        })}
      </RadioGroup>
      {sides.length > 0 && (
        <>
          <p class="picker-legend">Which {sideNoun}</p>
          <RadioGroup label={`Which ${sideNoun} of ${noun}`} class="segmented segmented-wide" testid={`${testid}-side`}>
            {sides.map((c) => (
              <ChoiceButton key={c.value} testid={`${testid}-side-${c.value}`} checked={side === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }} label={sideLabels[c.value]} onSelect={() => onSide(c.value)} onBlocked={explain} class="segment">
                <span>{sideLabels[c.value]}</span>
              </ChoiceButton>
            ))}
          </RadioGroup>
        </>
      )}
      {explainer}
    </div>
  );
}
