// Lazy-loaded art at run time (PLAN-D §0.3.3). The `lazy-art` project of vitest.config.ts runs this file alone, with vite.config.ts's alias,
// so the library reads art/paths/lazy.ts as the browser build does, in a module state of its own. The loader's own rules (fallback, listeners,
// a category that fails to load) are checked on loaders made with stub category modules.

import { describe, expect, it } from 'vitest';
import { artLoader } from '../../src/lib/heraldry/art/paths/loader';
import type { ArtPaths } from '../../src/lib/heraldry/art/types';
import type { ChargeCategory } from '../../src/lib/heraldry/charges';
import { artReady, chargePath, loadArtFor, overlaidArt, type Charge } from '../../src/lib/heraldry';
import { arms, charge, group, nd } from '../helpers';

const SPEAR = 'M1 1L2 1L2 2Z';
const MAIN: ArtPaths = { lion: { rampant: 'M0 0L1 0L1 1Z' }, falcon: { _: 'M0 0L2 0L2 2Z' } };

/** A loader whose category modules hold only the spear (object), each load counted, failing while `fail` says so. */
function stubLoader(fail: () => boolean) {
  const asked: ChargeCategory[] = [];
  const module = (cat: ChargeCategory, paths: ArtPaths) => () => {
    asked.push(cat);
    return fail() ? Promise.reject(new Error('chunk 404')) : Promise.resolve(paths);
  };
  const categories: Record<ChargeCategory, () => Promise<ArtPaths>> = {
    beast: module('beast', {}), monster: module('monster', {}), bird: module('bird', {}), plant: module('plant', {}),
    geometric: module('geometric', {}), cross: module('cross', {}), object: module('object', { spear: { _: SPEAR } }), modern: module('modern', {}),
  };
  return { loader: artLoader(MAIN, categories), asked };
}

/** Lets the loads and the listeners' microtasks settle. */
const settled = () => new Promise((done) => setTimeout(done, 0));

describe('the art loader (art/paths/loader.ts)', () => {
  it('gives no path until a category has loaded, asks for it once, and tells the listeners it is loading and then that it is not', async () => {
    const { loader, asked } = stubLoader(() => false);
    const heard: boolean[] = [];
    loader.onArtChange((pending) => heard.push(pending));
    expect(loader.pathFor('lion', 'rampant')).toBe('M0 0L1 0L1 1Z');
    expect(loader.artReady(['spear'])).toBe(false);
    expect(loader.pathFor('spear', '_')).toBeUndefined();
    expect(loader.pathFor('spear', '_')).toBeUndefined();
    await settled();
    expect(asked).toEqual(['object']);
    expect(loader.pathFor('spear', '_')).toBe(SPEAR);
    expect(loader.artReady(['spear', 'lion'])).toBe(true);
    expect(heard).toEqual([true, false]);
  });

  it('draws an alias from its source\'s art: a hawk is ready with the falcon, in the main chunk, and asks for nothing', async () => {
    const { loader, asked } = stubLoader(() => false);
    expect(loader.artReady(['hawk'])).toBe(true);
    expect(loader.pathFor('hawk', '_')).toBeUndefined();
    await loader.loadArtFor(['hawk']);
    expect(asked).toEqual([]);
  });

  it('does not ask again, on drawing, for a category that failed to load; loadArtFor does', async () => {
    let failing = true;
    const { loader, asked } = stubLoader(() => failing);
    const heard: boolean[] = [];
    loader.onArtChange((pending) => heard.push(pending));
    expect(loader.pathFor('spear', '_')).toBeUndefined();
    await settled();
    expect(heard).toEqual([true, false]);
    // the app draws again on hearing it, and again: nothing more is asked for
    for (let i = 0; i < 3; i++) expect(loader.pathFor('spear', '_')).toBeUndefined();
    await settled();
    expect(asked).toEqual(['object']);
    expect(loader.artReady(['spear'])).toBe(false);
    failing = false;
    await loader.loadArtFor(['spear']);
    expect(asked).toEqual(['object', 'object']);
    expect(loader.pathFor('spear', '_')).toBe(SPEAR);
  });
});

describe('the browser build\'s art (art/paths/lazy.ts)', () => {
  it('draws a held item from a category loaded after it was first drawn with its own art, not the fallback it was drawn with before', async () => {
    const d = nd(arms('azure', group(charge('lion', { holds: [{ how: 'maintaining', item: charge('spear'), paint: 'argent' }] }), 'or')));
    const lion = d.groups[0].item as Charge;
    expect(artReady(['spear'])).toBe(false);
    const fallback = chargePath(lion.holds[0].item);
    const before = overlaidArt(lion).overlays.map((o) => o.d);
    await loadArtFor(['spear']);
    expect(artReady(['spear'])).toBe(true);
    expect(chargePath(lion.holds[0].item)).not.toBe(fallback);
    const after = overlaidArt(lion).overlays.map((o) => o.d);
    expect(after).toHaveLength(1);
    expect(after).not.toEqual(before);
  });

  it('has an alias\'s art when its source is in the main chunk, whatever its own category', () => {
    expect(artReady(['hawk', 'coney', 'rabbit', 'rapier', 'dagger', 'vol', 'coronet'])).toBe(true);
  });
});
