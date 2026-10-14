// Every level-0 slot set the layout engine can produce — context × count × layout × shape — reduced to a short
// hash each, so a refactor of the engine is provably neutral. The fixture is test/fixtures/slot-golden.json;
// `npm run golden:write` regenerates it.
import {
  FIELD_SHAPES, ROW_PATTERNS, contextSlots, fieldContext, layoutKey, layoutOfKey, type LayoutContext, type OrdinaryType,
} from '../src/lib/heraldry';

/** The counts pinned: every one to six, then the larger ones the tables name. */
const COUNTS: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const FIELD_LAYOUTS: readonly string[] = [
  'single', 'in-chief', 'in-base', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-cross', 'in-saltire', 'in-orle', 'in-annulo',
  'crossed', 'pair-combattant', 'host', ...ROW_PATTERNS.map((r) => `rows-${r.join('-')}`),
];
const HOST_LAYOUTS: readonly string[] = ['host', 'single'];
const BETWEEN: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'];
const ON: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'chief', 'cross', 'saltire', 'pile'];

export const FIELD_PERIPHERALS = ['none', 'chief', 'bordure'] as const;

interface GoldenContext { key: string; ctx: LayoutContext; layouts: readonly string[] }

export const GOLDEN_CONTEXTS: readonly GoldenContext[] = [
  ...FIELD_PERIPHERALS.map((peripheral): GoldenContext => ({
    key: `field-${peripheral}`, ctx: fieldContext(peripheral), layouts: FIELD_LAYOUTS,
  })),
  ...BETWEEN.map((ordinary): GoldenContext => ({ key: `between-${ordinary}`, ctx: { k: 'between', ordinary, peripheral: 'none' }, layouts: HOST_LAYOUTS })),
  ...ON.map((ordinary): GoldenContext => ({ key: `on-${ordinary}`, ctx: { k: 'on', ordinary, peripheral: 'none' }, layouts: HOST_LAYOUTS })),
];

/** FNV-1a, 32 bits, as 8 hex digits. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function goldenSlots(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, ctx, layouts } of GOLDEN_CONTEXTS) {
    for (const count of COUNTS) {
      for (const layoutName of layouts) {
        const layout = layoutOfKey(layoutName, count);
        if (!layout) continue;
        for (const shape of FIELD_SHAPES) {
          const slots = contextSlots(ctx, count, layout, shape);
          out[`${key}|${count}|${layoutKey(layout)}|${shape}`] = hash(JSON.stringify(slots.map((s) => [s.x, s.y, s.size, s.rotation].map(round))));
        }
      }
    }
  }
  return out;
}
