// The layout engine places every level-0 group exactly where it did when the fixture was written.
import { expect, it } from 'vitest';
import golden from './fixtures/slot-golden.json';
import { goldenSlots } from './slot-golden-cases';

it('draws every context, count, layout and shape where the golden says', { timeout: 30_000 }, () => {
  const now = goldenSlots();
  expect(Object.keys(now).length).toBe(Object.keys(golden).length);
  const changed = Object.keys(now).filter((k) => now[k] !== (golden as Record<string, string>)[k]);
  expect(changed).toEqual([]);
});
