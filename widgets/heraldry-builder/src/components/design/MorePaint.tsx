// "More colours and patterns…": the one disclosure under a colour picker that holds everything beyond a plain colour —
// split in two, fur, stripes and checks, a scatter of pictures, brick or scales, natural colours. A row of kinds picks
// which one's options are shown; only that one is drawn. Closed until asked for, and open by itself while the paint is one of them.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { asParty, asSemy, asTreated, asVariation, type Paint } from '../../lib/heraldry';
import { ChoiceButton, RadioGroup } from './Choices';

/** The kinds of paint beyond a plain colour, in the order they are offered. */
export type PaintMode = 'split' | 'fur' | 'pattern' | 'scatter' | 'treatment' | 'natural';

export const PAINT_MODE_LABEL: Record<PaintMode, string> = {
  split: 'Split in two',
  fur: 'Fur',
  pattern: 'Stripes and checks',
  scatter: 'Scatter',
  treatment: 'Brick or scales',
  natural: 'Natural colours',
};

/** The kind a paint is, or null for a plain colour (or counterchanged), which the colour picker above shows. */
export function paintMode(paint: Paint): PaintMode | null {
  if (asParty(paint)) return 'split';
  if (asVariation(paint)) return 'pattern';
  if (asSemy(paint)) return 'scatter';
  if (asTreated(paint)) return 'treatment';
  if (paint.k === 'fur') return 'fur';
  return paint.k === 'proper' ? 'natural' : null;
}

interface Props {
  /** The disclosure is <testid>-more; the kinds are <testid>-mode-<kind>. */
  testid: string;
  /** What the options are for, in the row's accessible name: "the bend". */
  noun: string;
  /** The kinds offered here, each with its options (drawn only while it is the one shown). */
  modes: ReadonlyArray<{ mode: PaintMode; panel: () => ComponentChildren }>;
  /** The kind the paint is now, or null for a plain colour. */
  current: PaintMode | null;
}

/** A kind button is never blocked: the options under it are, each with its reason. */
const never = () => {};

export function MorePaint({ testid, noun, modes, current }: Props) {
  const [open, setOpen] = useState(current !== null);
  const [shown, setShown] = useState<PaintMode | null>(current);
  // A paint that becomes one of these kinds (an example loaded, Undo) opens the disclosure on it.
  useEffect(() => {
    if (current === null) return;
    setOpen(true);
    setShown(current);
  }, [current]);
  const tab = modes.find((m) => m.mode === shown) ?? modes[0];
  return (
    <details class="more-paint" data-testid={`${testid}-more`} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>More colours and patterns…</summary>
      {open && (
        <div class="more-paint-body">
          <RadioGroup label={`More colours and patterns for ${noun}`} class="segmented more-paint-modes" testid={`${testid}-modes`}>
            {modes.map(({ mode }) => (
              <ChoiceButton key={mode} testid={`${testid}-mode-${mode}`} checked={mode === tab.mode} label={PAINT_MODE_LABEL[mode]} onSelect={() => setShown(mode)} onBlocked={never} class="segment">
                <span>{PAINT_MODE_LABEL[mode]}</span>
              </ChoiceButton>
            ))}
          </RadioGroup>
          {tab.panel()}
        </div>
      )}
    </details>
  );
}
