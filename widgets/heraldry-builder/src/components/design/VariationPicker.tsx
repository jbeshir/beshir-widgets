// Stripes and checks — barry and its kin, checky, lozengy and the rest — of the background or of a band or
// picture: one option per pattern with a small picture of it, a count for the ones that are counted, and the
// two tinctures it is made of. Opt-in, like the fur of a part: folded under the plain and divided colours until a pattern is chosen.

import {
  TINCTURES, TINCTURE_FILL, VARIATIONS, VARIATION_LABEL, VARIATION_PIECES, asVariation, groupAt, groupVariationChoices, groupVariationTinctureChoices, isCountedVariation, setGroupVariation,
  setGroupVariationPieces, setGroupVariationTincture, variationRegions,
  type Choice, type Design, type GroupPath, type Tincture, type Variation, type VariationPaint,
} from '../../lib/heraldry';
import { setVariation, setVariationPieces, setVariationTincture } from '../../lib/builder';
import { capitalise, numberWord } from '../../lib/heraldry/words';
import { ChoiceButton, RadioGroup } from './Choices';
import { useExplainer } from './Explainer';
import { TincturePicker } from './TincturePicker';

/** The patterns of stripes (counted) and of checks, grids and piles, each offered in a group of its own. */
const STRIPES: readonly Variation[] = VARIATIONS.filter(isCountedVariation);
const CHECKS: readonly Variation[] = VARIATIONS.filter((v) => !isCountedVariation(v));

/** The shield's box, which a chip's pattern is laid out over. */
const CHIP_BOX = { x0: 0, y0: 0, x1: 100, y1: 120 };

/** A small picture of a pattern in gold and azure. */
function PatternChip({ variation }: { variation: Variation }) {
  const [, second] = variationRegions(variation, null, CHIP_BOX);
  return (
    <svg viewBox="0 0 100 120" width="26" height="31" aria-hidden="true" focusable="false">
      <rect width="100" height="120" fill={TINCTURE_FILL.or} />
      <path d={second} fill={TINCTURE_FILL.azure} />
      <rect width="100" height="120" fill="none" stroke="#222222" stroke-width="6" />
    </svg>
  );
}

interface Props {
  /** Testid of the disclosure; the options are <testid>-<pattern>, <testid>-pieces-<n> and <testid>-tincture-<1|2>. */
  testid: string;
  /** Swatch testid group of the two tincture pickers. */
  group: string;
  legend: string;
  value: VariationPaint | null;
  variations: Choice<Variation>[];
  tinctures: (part: 0 | 1) => Choice<Tincture>[];
  onVariation: (variation: Variation) => void;
  onPieces: (pieces: number) => void;
  onTincture: (part: 0 | 1, tincture: Tincture) => void;
}

function VariationPicker({ testid, group, legend, value, variations, tinctures, onVariation, onPieces, onTincture }: Props) {
  const { explain, node: explainer } = useExplainer();
  const section = (label: string, shown: readonly Variation[]) => (
    <RadioGroup label={label} class="segmented segmented-wide" testid={`${testid}-${label.toLowerCase()}`}>
      {variations.filter((c) => shown.includes(c.value)).map((c) => (
        <ChoiceButton
          key={c.value} testid={`${testid}-${c.value}`} checked={value?.variation === c.value} status={c.allowed ? undefined : { kind: 'blocked', reason: c.reason }}
          label={`${capitalise(VARIATION_LABEL[c.value].term)}, ${VARIATION_LABEL[c.value].plain.toLowerCase()}`} title={VARIATION_LABEL[c.value].plain}
          onSelect={() => onVariation(c.value)} onBlocked={explain} class="segment"
        >
          <PatternChip variation={c.value} />
          <span>{capitalise(VARIATION_LABEL[c.value].term)}</span>
        </ChoiceButton>
      ))}
    </RadioGroup>
  );
  return (
    <details class="fur-picker" data-testid={testid} open={value !== null}>
      <summary>{legend}</summary>
      {section('Stripes', STRIPES)}
      {section('Checks', CHECKS)}
      {value && isCountedVariation(value.variation) && (
        <RadioGroup label="Number of stripes" class="segmented" testid={`${testid}-pieces`}>
          {VARIATION_PIECES.map((n) => (
            <ChoiceButton key={n} testid={`${testid}-pieces-${n}`} checked={value.pieces === n} label={`${capitalise(numberWord(n))} stripes`} onSelect={() => onPieces(n)} onBlocked={explain} class="segment">
              <span>{n}</span>
            </ChoiceButton>
          ))}
        </RadioGroup>
      )}
      {value && ([0, 1] as const).map((part) => (
        <TincturePicker
          key={part}
          group={`${group}-pattern-${part + 1}`}
          testid={`${testid}-tincture-${part + 1}`}
          legend={part === 0 ? 'First colour of the pattern' : 'Second colour of the pattern'}
          choices={tinctures(part)}
          value={value.parts[part].t}
          onChange={(t) => onTincture(part, t)}
        />
      ))}
      {explainer}
    </details>
  );
}

/** Every tincture is on offer for the background: choosing one moves the other only to keep a metal with a colour. */
const ALL_TINCTURES: Choice<Tincture>[] = TINCTURES.map((value) => ({ value, allowed: true }));

/** Stripes and checks for the background: nothing is blocked, the rule of tincture is judged on what lies on it. */
export function FieldPattern({ design, onChange }: { design: Design; onChange: (design: Design) => void }) {
  const value = design.kind === 'arms' ? asVariation(design.field) : null;
  return (
    <VariationPicker
      testid="field-pattern" group="field" legend="Stripes and checks" value={value}
      variations={VARIATIONS.map((v) => ({ value: v, allowed: true }))} tinctures={() => ALL_TINCTURES}
      onVariation={(v) => onChange(setVariation(design, v))} onPieces={(n) => onChange(setVariationPieces(design, n))} onTincture={(part, t) => onChange(setVariationTincture(design, part, t))}
    />
  );
}

/** Stripes and checks for the band or picture at `path`. */
export function GroupPattern({ design, path, group, testid, onChange }: { design: Design; path: GroupPath; group: string; testid: string; onChange: (design: Design) => void }) {
  return (
    <VariationPicker
      testid={`${testid}-pattern`} group={group} legend="Stripes and checks" value={asVariation(groupAt(design, path).paint)}
      variations={groupVariationChoices(design, path)} tinctures={(part) => groupVariationTinctureChoices(design, path, part)}
      onVariation={(v) => onChange(setGroupVariation(design, path, v))} onPieces={(n) => onChange(setGroupVariationPieces(design, path, n))} onTincture={(part, t) => onChange(setGroupVariationTincture(design, path, part, t))}
    />
  );
}
