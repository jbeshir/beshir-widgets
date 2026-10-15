// Every level-0 slot set the layout engine can produce — context × count × layout × shape — reduced to a short hash each, so a
// refactor of the engine is provably neutral. A combination with no layout (no slots) is not pinned: drawing one where there was
// none shows up as a new key. The fixture is test/fixtures/slot-golden.json; `GOLDEN_REASON="…" npm run golden:write` regenerates it.
import {
  FIELD_SHAPES, ROW_PATTERNS, contextSlots, fieldContext, layoutKey, layoutOfKey, type LayoutContext, type OrdinaryType, type Slot,
} from '../src/lib/heraldry';
import { hash } from './golden';

/** The counts pinned: every one to six, then the larger ones the tables name. */
const COUNTS: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const FIELD_LAYOUTS: readonly string[] = [
  'single', 'in-chief', 'in-base', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-cross', 'in-saltire', 'in-orle', 'in-annulo',
  'crossed', 'pair-combattant', 'host', ...ROW_PATTERNS.map((r) => `rows-${r.join('-')}`),
];
const HOST_LAYOUTS: readonly string[] = ['host', 'single'];
const BETWEEN: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'];
const ON: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'chief', 'cross', 'saltire', 'pile'];

const FIELD_PERIPHERALS = ['none', 'chief', 'bordure'] as const;

interface GoldenContext { key: string; ctx: LayoutContext; layouts: readonly string[] }

const GOLDEN_CONTEXTS: readonly GoldenContext[] = [
  ...FIELD_PERIPHERALS.map((peripheral): GoldenContext => ({
    key: `field-${peripheral}`, ctx: fieldContext(peripheral), layouts: FIELD_LAYOUTS,
  })),
  ...BETWEEN.map((ordinary): GoldenContext => ({ key: `between-${ordinary}`, ctx: { k: 'between', ordinary, peripheral: 'none' }, layouts: HOST_LAYOUTS })),
  ...ON.map((ordinary): GoldenContext => ({ key: `on-${ordinary}`, ctx: { k: 'on', ordinary, peripheral: 'none' }, layouts: HOST_LAYOUTS })),
];

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The slots of every pinned combination that has any, by key "<context>|<count>|<layout>|<shape>". */
export function pinnedSlots(): Map<string, readonly Slot[]> {
  const out = new Map<string, readonly Slot[]>();
  for (const { key, ctx, layouts } of GOLDEN_CONTEXTS) {
    for (const count of COUNTS) {
      for (const layoutName of layouts) {
        const layout = layoutOfKey(layoutName, count);
        if (!layout) continue;
        for (const shape of FIELD_SHAPES) {
          const slots = contextSlots(ctx, count, layout, shape);
          if (slots.length > 0) out.set(`${key}|${count}|${layoutKey(layout)}|${shape}`, slots);
        }
      }
    }
  }
  return out;
}

/** A slot set as the golden stores it: rounded x, y, size and rotation of each slot. */
export const slotText = (slots: readonly Slot[]): string => JSON.stringify(slots.map((s) => [s.x, s.y, s.size, s.rotation].map(round)));

export function goldenSlots(pinned: ReadonlyMap<string, readonly Slot[]>): Record<string, string> {
  return Object.fromEntries([...pinned].map(([key, slots]) => [key, hash(slotText(slots))]));
}

/** What a key draws now, for a report: its slots. */
export const describeSlots = (pinned: ReadonlyMap<string, readonly Slot[]>) => (key: string): string => {
  const slots = pinned.get(key);
  return slots ? slotText(slots) : '(no slots now)';
};
