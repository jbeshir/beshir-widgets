// Every pinned shield is drawn exactly as it was when the fixture was written.
import { expect, it } from 'vitest';
import golden from './fixtures/render-golden.json';
import { goldenDiff, goldenReport, sameAsGolden } from './golden';
import { PAINT_CASE_DESIGNS, describeRender, goldenRenders, goldenShields } from './render-golden-cases';
import { isSupported } from '../src/lib/heraldry';

it('pins only paint and charge cases the builder draws', () => {
  expect(PAINT_CASE_DESIGNS.filter(({ design }) => !isSupported(design)).map(({ name }) => name)).toEqual([]);
});

it('draws every pinned shield as the golden says', { timeout: 60_000 }, () => {
  const shields = goldenShields();
  const diff = goldenDiff(golden, goldenRenders(shields));
  expect(sameAsGolden(diff), goldenReport(diff, describeRender(shields))).toBe(true);
});
