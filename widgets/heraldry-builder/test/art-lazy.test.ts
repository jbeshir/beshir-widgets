// Lazy-loaded art (PLAN-D §0.3.3): the browser build reads art/paths/lazy.ts in the place of art/paths/index.ts, so the two must have
// the same exports, and every charge's art must be in exactly one of the main chunk's modules and its category's module. Types and id
// sets only: nothing here loads a category (lazy.ts is never imported, only its types), so no module state is filled.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ALIAS_IDS, ALIAS_SOURCE, CHARGES, CHARGE_IDS, CORE_ART_IDS, chargeIdsOf, semyPaint, type ChargeCategory, type ChargeId } from '../src/lib/heraldry';
import type * as LazyArt from '../src/lib/heraldry/art/paths/lazy';
import type * as StaticArt from '../src/lib/heraldry/art/paths/index';
import { PATHS_CORE } from '../src/lib/heraldry/art/paths/core';
import { PATHS_BEAST } from '../src/lib/heraldry/art/paths/beast';
import { PATHS_MONSTER } from '../src/lib/heraldry/art/paths/monster';
import { PATHS_BIRD } from '../src/lib/heraldry/art/paths/bird';
import { PATHS_PLANT } from '../src/lib/heraldry/art/paths/plant';
import { PATHS_GEOMETRIC } from '../src/lib/heraldry/art/paths/geometric';
import { PATHS_CROSS } from '../src/lib/heraldry/art/paths/cross';
import { PATHS_OBJECT } from '../src/lib/heraldry/art/paths/object';
import { PATHS_MODERN } from '../src/lib/heraldry/art/paths/modern';
import { PATHS_STARS } from '../src/lib/heraldry/art/procedural/stars';
import { PATHS_SHAPES } from '../src/lib/heraldry/art/procedural/shapes';
import { PATHS_FOILS } from '../src/lib/heraldry/art/procedural/foils';
import { PATHS_KNOTS } from '../src/lib/heraldry/art/procedural/knots';
import { PATHS_CROSSES } from '../src/lib/heraldry/art/procedural/crosses';
import { PATHS_WHEELS } from '../src/lib/heraldry/art/procedural/wheels';
import { arms, charge, group, nd } from './helpers';

const SRC = path.join(import.meta.dirname, '../src');

/** The bespoke charges drawn in the main chunk (PLAN-D §2.4, ranks 1–25 by what they unlock), as they land. */
const MAIN_CHUNK_BESPOKE: readonly string[] = [
  'cat', 'bear', 'raven', 'horse', 'tower', 'griffin', 'arrow', 'fox', 'swan', 'phoenix', 'escallop', 'dragonfly', 'thistle', 'dolphin',
  'butterfly', 'laurel-wreath', 'oak-leaf', 'wyvern', 'hammer', 'falcon', 'harp', 'axe', 'acorn', 'hand',
  // also the winged overlay piece of main-chunk charges
  'wing',
];

const PROCEDURAL = { stars: PATHS_STARS, shapes: PATHS_SHAPES, foils: PATHS_FOILS, knots: PATHS_KNOTS, crosses: PATHS_CROSSES, wheels: PATHS_WHEELS };
const CATEGORY_PATHS: Record<ChargeCategory, object> = {
  beast: PATHS_BEAST, monster: PATHS_MONSTER, bird: PATHS_BIRD, plant: PATHS_PLANT, geometric: PATHS_GEOMETRIC, cross: PATHS_CROSS,
  object: PATHS_OBJECT, modern: PATHS_MODERN,
};

/** The module specifiers a source file imports from. */
const importsOf = (file: string): string[] => [...readFileSync(file, 'utf8').matchAll(/^(?:import|export)\b[^;]*?\bfrom '([^']+)'/gm)].map((m) => m[1]);
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sourceFiles(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));

describe('lazy-loaded art (PLAN-D §0.3.3)', () => {
  it('reads the same way in the browser build as everywhere else', () => {
    expectTypeOf<typeof LazyArt>().toEqualTypeOf<typeof StaticArt>();
    expectTypeOf<typeof LazyArt.artReady>().toEqualTypeOf<(ids: readonly ChargeId[]) => boolean>();
  });

  it('has every charge\'s art in exactly one module, each category module holding only charges of its category', () => {
    const modules: Record<string, object> = { core: PATHS_CORE, ...PROCEDURAL, ...CATEGORY_PATHS };
    const owners = new Map<string, string[]>();
    for (const [name, paths] of Object.entries(modules)) for (const id of Object.keys(paths)) owners.set(id, [...(owners.get(id) ?? []), name]);
    // the aliases have none: they are drawn from another charge's (PLAN-D §0.3.1)
    expect([...owners.keys()].sort()).toEqual(CHARGE_IDS.filter((id) => !(ALIAS_IDS as readonly string[]).includes(id)).sort());
    expect([...owners].filter(([, names]) => names.length > 1)).toEqual([]);
    for (const [cat, paths] of Object.entries(CATEGORY_PATHS)) for (const id of Object.keys(paths)) expect(CHARGES[id as ChargeId].category, id).toBe(cat);
  });

  it('draws the original charges, the generated ones and the most wanted bespoke ones from the main chunk (PLAN-D §2.4)', () => {
    const procedural = Object.values(PROCEDURAL).flatMap((paths) => Object.keys(paths));
    const bespoke = CHARGE_IDS.slice(36).filter((id) => !procedural.includes(id) && !(ALIAS_IDS as readonly string[]).includes(id));
    expect([...CORE_ART_IDS]).toEqual(Object.keys(PATHS_CORE));
    expect([...CORE_ART_IDS].sort()).toEqual([...CHARGE_IDS.slice(0, 36), ...bespoke.filter((id) => MAIN_CHUNK_BESPOKE.includes(id))].sort());
  });

  it('draws each alias from a charge of its own category, so loading the alias loads what it is drawn from (PLAN-D §0.3.1)', () => {
    for (const id of ALIAS_IDS) {
      const source = ALIAS_SOURCE[id];
      expect(CHARGES[id].category, id).toBe(CHARGES[source].category);
      expect(CHARGES[source].drawings, id).not.toEqual({});
    }
  });


  it('is read through art/paths/index only, and no generated art reads a category module (PLAN-D §0.3.1)', () => {
    const paths = path.join(SRC, 'lib/heraldry/art/paths');
    for (const file of sourceFiles(SRC).filter((f) => path.dirname(f) !== paths)) {
      const read = importsOf(file).map((s) => path.resolve(path.dirname(file), s)).filter((p) => path.dirname(p) === paths);
      expect(read.map((p) => path.basename(p)).filter((name) => name !== 'index' && name !== 'pieces'), path.relative(SRC, file)).toEqual([]);
    }
  });

  it('knows every charge a design draws, wherever it is', () => {
    const d = nd(arms(semyPaint('azure', 'squirrel', 'or'), group(charge('lion', { holds: [{ how: 'maintaining', item: charge('sword'), paint: 'argent' }] }), 'or')));
    expect(chargeIdsOf(d).sort()).toEqual(['lion', 'squirrel', 'sword']);
  });
});
