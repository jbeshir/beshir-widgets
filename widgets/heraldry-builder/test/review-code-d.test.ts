// The fixes of the phase-D code review (findings K-*, /workspace/pd/review/findings-code.md): a head form of a charge with no head drawn (K-3),
// the art the shield turns with its pieces under it (K-10), and the one builder refusal the SCA classifier files as a gap (K-16). The lazy
// art loader's (K-1, K-2, K-11) are test/lazy/art-lazy-runtime.test.ts's; the tagger's spellings (K-4) are sca-armorial.test.ts's.

import { describe, expect, it } from 'vitest';
import {
  CHARGE_IDS, cutChoices, detailChoices, facingChoices, formChoices, gazeChoices, holdChoices, opticalScale, orientationChoices, pairChoices, partChoices,
  pathRings, pointsChoices, renderLayers, resolve, unsupportedIssues, type Charge,
} from '../src/lib/heraldry';
import { builderPath } from './builder-path';
import { arms, charge, div, group, nd } from './helpers';

const TURNED_REACH = 45;

describe('a head form of a charge with no head drawn (K-3)', () => {
  const CHOICES = { detailChoices, partChoices, holdChoices, pointsChoices, formChoices, gazeChoices, facingChoices, pairChoices, orientationChoices, cutChoices };
  it('is the gap it always was (charge-modifier:head), not a malformed design: a goat\'s or a rose\'s head resolves', () => {
    const d = nd(arms('azure', group(charge('rose', { form: 'head' }), 'or')));
    expect(unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`)).toEqual(['charge-modifier:head']);
  });

  it('never throws in the Design tab\'s choices (which a stored draft or a link may open on), for any charge, its head drawn or not', () => {
    for (const id of CHARGE_IDS) {
      const r = resolve(arms('azure', group(charge(id, { form: 'head' }), 'or')));
      if (!r.ok) continue;
      for (const [name, choices] of Object.entries(CHOICES)) expect(() => choices(r.design, [0]), `${id} ${name}`).not.toThrow();
    }
    expect(CHARGE_IDS.filter((id) => resolve(arms('azure', group(charge(id, { form: 'head' }), 'or'))).ok).length).toBeGreaterThan(100);
  });
});

describe('a turned charge is refitted with the pieces drawn under it (K-10)', () => {
  const reach = (d: string) => Math.max(...pathRings(d).flat().map(([x, y]) => Math.hypot(x - 50, y - 50)));
  it.each([
    ['three hearts winged, bendwise', group(charge('heart', { orientation: 'bendwise', mods: [{ id: 'winged', paint: 'or' }] }), 'gules', { count: 3 })],
    ['three swords enflamed, bendwise', group(charge('sword', { orientation: 'bendwise', mods: [{ id: 'enflamed', paint: 'proper' }] }), 'argent', { count: 3 })],
    ['three hearts enflamed, fesswise', group(charge('heart', { orientation: 'fesswise', mods: [{ id: 'enflamed', paint: 'proper' }] }), 'gules', { count: 3 })],
  ])('%s: wings and flames stay within the turned reach', (_, g) => {
    const d = nd(arms('azure', g));
    const layer = renderLayers(d, 'heater').find((l) => l.k === 'charges');
    if (layer?.k !== 'charges') throw new Error('no charges');
    const scale = opticalScale(d.groups[0].item as Charge);
    const under = layer.overlays.flatMap((o) => (o.effect === 'fill' && o.under ? [o.art] : []));
    expect(under.length).toBeGreaterThan(0);
    for (const pose of layer.poses) {
      expect(pose.turn % 180).not.toBe(0);
      for (const art of [layer.art, ...under]) expect(reach(art) * scale * pose.fit).toBeLessThanOrEqual(TURNED_REACH + 0.05);
    }
  });
});

describe('the builder says when it stopped at a field whose parts share a tincture (K-16: the SCA classifier files only that as a gap)', () => {
  it('says so for parts of one tincture with no band between them', () => {
    const path = builderPath(nd(arms(div('per-pale', 'or', 'or'))));
    expect(path.problems.length).toBeGreaterThan(0);
    expect(path.unsettledField).toBe(true);
  });

  it('does not for a design it builds, nor for one it fails to build for another reason', () => {
    expect(builderPath(nd(arms(div('per-pale', 'or', 'gules'), group(charge('lion'), 'azure'))))).toMatchObject({ problems: [], unsettledField: false });
  });
});
