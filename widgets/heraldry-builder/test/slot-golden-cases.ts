// Every level-0 slot set the layout engine can produce — context × count × layout × shape — reduced to a short hash each, so a
// refactor of the engine is provably neutral. A combination with no layout (no slots) is not pinned: drawing one where there was
// none shows up as a new key. The fixture is test/fixtures/slot-golden.json; `GOLDEN_REASON="…" npm run golden:write` regenerates it
// from every combination; `npm test` works out a seeded rotating sample of them (`inSlotSample`).
import {
  FIELD_SHAPES, ROW_PATTERNS, contextSlots, fieldContext, layoutKey, layoutOfKey, plainSpec, type LayoutContext, type OrdinaryType, type Slot,
} from '../src/lib/heraldry';
import { hash } from './golden';
import { rotatesIn } from './rotation';

/** The counts pinned: every one to six, then the larger ones the tables name. */
const COUNTS: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const FIELD_LAYOUTS: readonly string[] = [
  'single', 'in-chief', 'in-base', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-cross', 'in-saltire', 'in-orle', 'in-annulo',
  'crossed', 'pair-combattant', 'host', ...ROW_PATTERNS.map((r) => `rows-${r.join('-')}`),
];
const HOST_LAYOUTS: readonly string[] = ['host', 'single'];
const BETWEEN: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile', 'pall', 'pall-inverted'];
const ON: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'chief', 'cross', 'saltire', 'pile', 'pall', 'pall-inverted'];

const FIELD_PERIPHERALS = ['none', 'chief', 'bordure'] as const;

interface GoldenContext { key: string; ctx: LayoutContext; layouts: readonly string[] }

const GOLDEN_CONTEXTS: readonly GoldenContext[] = [
  ...FIELD_PERIPHERALS.map((peripheral): GoldenContext => ({
    key: `field-${peripheral}`, ctx: fieldContext(peripheral), layouts: FIELD_LAYOUTS,
  })),
  ...BETWEEN.map((ordinary): GoldenContext => ({ key: `between-${ordinary}`, ctx: { k: 'between', ordinary: plainSpec(ordinary), peripheral: 'none', keepOut: [] }, layouts: HOST_LAYOUTS })),
  ...ON.map((ordinary): GoldenContext => ({ key: `on-${ordinary}`, ctx: { k: 'on', ordinary: plainSpec(ordinary), peripheral: 'none', keepOut: [] }, layouts: HOST_LAYOUTS })),
];

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Whether `npm test` works out a combination this run, by key: every heater one, a rotating sixth of each other shape's (SCA_FULL=1: all). */
export const inSlotSample = (key: string): boolean => key.endsWith('|heater') || rotatesIn(key, 1 / 6);

/** The slots of every pinned combination in the sample that has any, by key "<context>|<count>|<layout>|<shape>". */
export function pinnedSlots(inSample: (key: string) => boolean): Map<string, readonly Slot[]> {
  const out = new Map<string, readonly Slot[]>();
  for (const { key, ctx, layouts } of GOLDEN_CONTEXTS) {
    for (const count of COUNTS) {
      for (const layoutName of layouts) {
        const layout = layoutOfKey(layoutName, count);
        if (!layout) continue;
        for (const shape of FIELD_SHAPES) {
          const combination = `${key}|${count}|${layoutKey(layout)}|${shape}`;
          if (!inSample(combination)) continue;
          const slots = contextSlots(ctx, count, layout, shape);
          if (slots.length > 0) out.set(combination, slots);
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
