// Every pinned shield is drawn exactly as it was when the fixture was written.
import { expect, it } from 'vitest';
import golden from './fixtures/render-golden.json';
import { goldenRenders } from './render-golden-cases';

it('draws every pinned shield as the golden says', { timeout: 60_000 }, () => {
  const now = goldenRenders();
  expect(Object.keys(now).length).toBe(Object.keys(golden).length);
  const changed = Object.keys(now).filter((k) => now[k] !== (golden as Record<string, string>)[k]);
  expect(changed).toEqual([]);
});
