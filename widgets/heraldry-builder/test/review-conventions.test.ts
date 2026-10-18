// The convention fixes of the phase-C code review (findings K-12 … K-37, /workspace/pc/review/findings-code.md, and U-11 of findings-ui.md)
// that change what the builder shows or draws: the SCA tooling's words built from the library's tables, the band summary built from the
// toggles, one line adjective per line, and two drawing and builder fixes found beside them — the cotises of a couped band couped with it,
// and Thin blocked while the band has an outline, which thin bands can't keep.

import { describe, expect, it } from 'vitest';
import {
  COMMON_LINES, DRAWN_DIVISIONS, FIELD_SHAPES, LINE_LABEL, OUTLINE_LABEL, blazon, defaultOrdinaryFrame, gloss, ordinaryCountLegend, ordinaryGeometry,
  pathPolygon, pathRings, plainSpec, pointInPolygon, shapeFrame, toggleChoices, type Line, type OrdinarySpec,
} from '../src/lib/heraldry';
import { DEFAULT_DESIGN, ordinaryPath, setOrdinary, setOrdinaryOutline, setOrdinaryToggle } from '../src/lib/builder';
import { ordinaryShapeWords } from '../src/components/design/BuilderSteps';
import { BAND_NAMES, DIVISION_START, EDGE_NAMES } from './sca/words';
import { arms, div, group, nd, ordinary } from './helpers';

/** How far (x, y) lies from the polygon's boundary. */
function edgeDistance(poly: readonly (readonly [number, number])[], x: number, y: number): number {
  let best = Infinity;
  poly.forEach(([ax, ay], i) => {
    const [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  });
  return best;
}

describe('the cotises of a couped band are couped with it', () => {
  it('lie inside every shape, for every band that is couped and cotised, one to three cotises, plain or lined', () => {
    const outside: string[] = [];
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const type of ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire'] as const) {
        for (const count of [1, 2, 3] as const) {
          for (const line of ['plain', 'wavy'] as const satisfies readonly Line[]) {
            const spec: OrdinarySpec = { ...plainSpec(type), mods: ['couped'], cotised: { count, line } };
            const g = ordinaryGeometry(spec, defaultOrdinaryFrame(shape));
            const off = pathRings(g.cotises!.d).flat().filter(([x, y]) => !pointInPolygon(x, y, outline) && edgeDistance(outline, x, y) > 0.5);
            if (off.length) outside.push(`${shape} ${type} ×${count} ${line}: ${off.length} points outside`);
          }
        }
      }
    }
    expect(outside).toEqual([]);
  });

  it('end on the band\'s own straight ends: a couped bend\'s cotises reach no further along it than the bend', () => {
    const along = ([x, y]: readonly [number, number]) => (x + y) / Math.SQRT2;
    const g = ordinaryGeometry({ ...plainSpec('bend'), mods: ['couped'], cotised: { count: 2, line: 'plain' } }, defaultOrdinaryFrame('heater'));
    const span = (d: string) => { const s = pathRings(d).flat().map(along); return [Math.min(...s), Math.max(...s)].map((v) => v.toFixed(1)); };
    expect(span(g.cotises!.d)).toEqual(span(g.body));
  });

  it('leave an uncotised couped band as it was', () => {
    const plain = ordinaryGeometry({ ...plainSpec('bend'), mods: ['couped'] }, defaultOrdinaryFrame('heater'));
    const fimbriated = ordinaryGeometry({ ...plainSpec('bend'), mods: ['couped'], fimbriated: true }, defaultOrdinaryFrame('heater'));
    expect(fimbriated.body).toBe(plain.body);
  });
});

describe('Thin is blocked while the band has an outline', () => {
  it('says why, and is offered again once the outline is None', () => {
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const path = ordinaryPath(fess)!;
    const cotised = setOrdinaryOutline(fess, path, 'cotised');
    const thin = (d: typeof fess) => toggleChoices(d, path).find((c) => c.value === 'thin');
    expect(thin(cotised)).toEqual({ value: 'thin', allowed: false, reason: 'Thin bands have no outline: set the outline to None first.' });
    expect(thin(setOrdinaryOutline(cotised, path, 'none'))).toMatchObject({ allowed: true });
    expect(thin(setOrdinaryOutline(fess, path, 'fimbriated'))).toMatchObject({ allowed: false });
  });
});

describe('the builder\'s words come from the library\'s tables', () => {
  it('summarises a band\'s shape from its toggles and position: a pall turned over, thin bands raised', () => {
    const pall = setOrdinaryToggle(setOrdinary(DEFAULT_DESIGN, 'pall'), [0], 'inverted', true);
    expect(ordinaryShapeWords(pall, ordinaryPath(pall)!)).toBe('upside down');
    const bendlets = nd(arms('azure', group(ordinary('bendlet', { mods: ['enhanced'] }), 'or', { count: 3 })));
    expect(ordinaryShapeWords(bendlets, [0])).toBe('three, thin, raised');
  });

  it('names a line by one adjective, in the chips and the gloss; the edge rows break after straight and the seven most used', () => {
    expect(LINE_LABEL.bevilled.plain).toBe('Step-broken');
    expect(gloss(nd(arms({ ...div('per-bend', 'or', 'azure'), lines: { a: 'bevilled' } })))).toContain('step-broken');
    expect(COMMON_LINES).toEqual(['plain', 'embattled', 'wavy', 'engrailed', 'indented', 'rayonny', 'invected', 'dovetailed']);
  });

  it('labels outlines and counts in plain words (U-11)', () => {
    expect(['cotised', 'doubly-cotised', 'triply-cotised'].map((o) => OUTLINE_LABEL[o as 'cotised'].plain)).toEqual(['Stripe each side', 'Two stripes each side', 'Three stripes each side']);
    expect([ordinaryCountLegend('bendlet'), ordinaryCountLegend('tressure')]).toEqual(['How many thin bands', 'How many times over']);
  });

  it('reads every drawn division, band and edge name the widget writes (the SCA tooling\'s words)', () => {
    for (const division of DRAWN_DIVISIONS) {
      const parts = division === 'per-pall' || division === 'per-pall-inverted' || division.startsWith('tierced') ? ['or', 'azure', 'gules'] : ['or', 'azure'];
      const text = blazon(nd(arms({ ...div(division, ...parts), lines: { a: 'wavy' } }))).toLowerCase();
      expect(new RegExp(`^${DIVISION_START} `).exec(text)?.[0].trim(), division).toMatch(/wavy/);
    }
    expect(BAND_NAMES.split('|')).toEqual(expect.arrayContaining(['fess', 'pale', 'bend sinister', 'chevron', 'cross', 'saltire', 'pile', 'pall', 'pall inverted']));
    expect(EDGE_NAMES.split('|').sort()).toEqual(['dexter', 'inner', 'lower', 'outer', 'sinister', 'upper']);
  });
});
