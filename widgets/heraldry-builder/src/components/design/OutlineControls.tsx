// The outline of a band or shape inside "More shapes and edges…": none, edged (fimbriated), or cotised once, twice or three times; the
// tincture of the edging or cotises; and for cotises the line their edges are drawn with. A blocked choice stays focusable and explains itself.

import {
  LINE_LABEL, LINE_PROFILE, OUTLINE_LABEL, TINCTURE_FILL, edgeCommands, fitPeriod,
  type Choice, type GroupTincture, type Line, type Outline,
} from '../../lib/heraldry';
import { capitalise } from '../../lib/heraldry/words';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

/** The strip a line chip draws its edge across, and how much of a 100-unit field's line it shows. */
const CHIP = { width: 60, height: 20, margin: 2, scale: 0.56 };

/** A small strip of gold over azure, parted by the line: the line's own profile, drawn without a shield. */
function LineStrip({ line }: { line: Line }) {
  const { width, height, margin, scale } = CHIP;
  const a: [number, number] = [margin, height / 2], b: [number, number] = [width - margin, height / 2];
  const chord = b[0] - a[0];
  const edge = line === 'plain'
    ? `L${b[0]} ${b[1]}`
    : edgeCommands(a, b, { line, side: -1, depth: LINE_PROFILE[line].depth * scale, period: fitPeriod(line, chord, scale), anchor: chord / 2, span: [0, chord] });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="40" height="14" aria-hidden="true" focusable="false">
      <rect width={width} height={height} fill={TINCTURE_FILL.azure} />
      <path d={`M${a[0]} ${a[1]}${edge}L${width} ${b[1]}V${height}H0V${a[1]}Z`} fill={TINCTURE_FILL.or} />
    </svg>
  );
}

interface Props {
  /** The outline options are <testid>-outline-<outline>, the colour picker <testid>-outline-tincture, the cotise edges <testid>-cotise-edge-<line>. */
  testid: string;
  /** What is outlined: "the bend". */
  noun: string;
  outlines: Choice<Outline>[];
  outline: Outline;
  onOutline: (o: Outline) => void;
  tinctures: Choice<GroupTincture>[];
  tincture: GroupTincture | null;
  onTincture: (t: GroupTincture) => void;
  cotiseLines: Choice<Line>[];
  cotiseLine: Line;
  onCotiseLine: (l: Line) => void;
}

export function OutlineControls({ testid, noun, outlines, outline, onOutline, tinctures, tincture, onTincture, cotiseLines, cotiseLine, onCotiseLine }: Props) {
  const { explain, node: explainer } = useExplainer();
  const trim = outline === 'fimbriated' ? 'edging' : 'cotises';
  return (
    <div class="fur-picker" data-testid={`${testid}-outline`}>
      <p class="picker-legend">Outline of {noun}</p>
      <RadioGroup label={`Outline of ${noun}`} class="segmented segmented-wide" testid={`${testid}-outline-select`}>
        {outlines.map((c) => (
          <ChoiceButton
            key={c.value} testid={`${testid}-outline-${c.value}`} checked={outline === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
            label={`${OUTLINE_LABEL[c.value].plain}, ${OUTLINE_LABEL[c.value].term}`} title={OUTLINE_LABEL[c.value].term} onSelect={() => onOutline(c.value)} onBlocked={explain} class="segment"
          >
            <span>{OUTLINE_LABEL[c.value].plain}</span>
          </ChoiceButton>
        ))}
      </RadioGroup>
      {outline !== 'none' && (
        <TincturePicker group="outline" legend={`Colour of the ${trim}`} choices={tinctures} value={tincture} onChange={onTincture} testid={`${testid}-outline-tincture`} />
      )}
      {outline !== 'none' && outline !== 'fimbriated' && cotiseLines.length > 0 && (
        <>
          <p class="picker-legend">Edge of the cotises</p>
          <RadioGroup label="Edge of the cotises" class="segmented segmented-wide" testid={`${testid}-cotise-edge-select`}>
            {cotiseLines.map((c) => {
              const name = c.value === 'plain' ? 'Straight' : capitalise(LINE_LABEL[c.value].term);
              return (
                <ChoiceButton
                  key={c.value} testid={`${testid}-cotise-edge-${c.value}`} checked={cotiseLine === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
                  label={`${name}, ${LINE_LABEL[c.value].plain.toLowerCase()}`} title={LINE_LABEL[c.value].plain} onSelect={() => onCotiseLine(c.value)} onBlocked={explain} class="segment"
                >
                  <LineStrip line={c.value} />
                  <span>{name}</span>
                </ChoiceButton>
              );
            })}
          </RadioGroup>
        </>
      )}
      {explainer}
    </div>
  );
}
