// Every pinned shield is drawn exactly as it was when the fixture was written: the renders `npm test` works out this run
// (`inRenderSample`, seeded rotation; SCA_FULL=1 for all), each compared only with its own golden entry.
import { expect, it } from 'vitest';
import golden from './fixtures/render-golden.json';
import { goldenDiff, goldenReport, sameAsGolden, sampledGolden } from './golden';
import { PAINT_CASE_DESIGNS, describeRender, goldenRenders, goldenShields, inRenderSample } from './render-golden-cases';
import { sampleSeed } from './rotation';
import { isSupported } from '../src/lib/heraldry';

it('pins only paint and charge cases the builder draws', () => {
  expect(PAINT_CASE_DESIGNS.filter(({ design }) => !isSupported(design)).map(({ name }) => name)).toEqual([]);
});

it('draws every pinned shield as the golden says', { timeout: 60_000 }, () => {
  const shields = goldenShields();
  const diff = goldenDiff(sampledGolden(golden, inRenderSample), goldenRenders(shields, inRenderSample));
  expect(sameAsGolden(diff), `sample seed ${sampleSeed()}\n${goldenReport(diff, describeRender(shields))}`).toBe(true);
});
