// The peripherals beside the chief and bordure (PLAN-C C8a): base, point pointed, canton, quarter and gyron, and the canton, quarter and
// gyron sinister. Their geometry on every shape, the charges that keep out of them (any number of them: the context's `keepOut` list),
// the frame a base leaves the ordinaries, the rules (RULES-C §C.3, SENA A6C1, App I4, A3D1c at the foot), conflict (canton ≡ quarter,
// base vs point pointed, the sinister form a change of position) and the words. The five stay gapped until the builder offers them (C8b).

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, blazon, canonical, contextSlots, defaultOrdinaryFrame, differences, explainDifferences, fieldContext, gloss, groupAt, isFieldPrimary,
  layoutContext, layoutOfKey, ordinaryFrameOf, ordinaryGeometry, pathRings, plainSpec, pointInPolygon, shapeFrame, signature, structuralIssues, unsupportedIssues,
  type Design, type FieldShape, type LayoutContext, type OrdinarySpec, type OrdinaryType,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

type Pt = [number, number];

const NEW_PERIPHERALS = ['base', 'point', 'canton', 'quarter', 'gyron'] as const;
const SIDED = ['canton', 'quarter', 'gyron'] as const;

const spec = (type: OrdinaryType, extra: Partial<OrdinarySpec> = {}): OrdinarySpec => ({ ...plainSpec(type), ...extra });
const sinister = (type: OrdinaryType): OrdinarySpec => spec(type, { mods: ['sinister'] });
const geometryOf = (s: OrdinarySpec, shape: FieldShape) => ordinaryGeometry(s, defaultOrdinaryFrame(shape));
const rule = (d: Design, r: string) => structuralIssues(d).filter((i) => i.code === 'structure' && i.rule === r);

function edgeDistance(poly: readonly Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i];
    const len = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const t = len ? Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / len)) : 0;
    best = Math.min(best, Math.hypot(x - x1 - t * (x2 - x1), y - y1 - t * (y2 - y1)));
  }
  return best;
}

describe('peripherals: geometry', () => {
  it('each new peripheral is drawn inside the shield in every shape', () => {
    const lined: OrdinarySpec[] = [
      spec('base', { lines: { a: 'wavy', b: 'wavy' } }), spec('base', { lines: { a: 'embattled', b: 'embattled' } }),
      spec('canton', { lines: { a: 'engrailed', b: 'engrailed' } }), spec('quarter', { lines: { a: 'indented', b: 'indented' } }),
      spec('gyron', { lines: { a: 'nebuly', b: 'nebuly' } }),
    ];
    for (const shape of FIELD_SHAPES) {
      const f = shapeFrame(shape);
      const outline = pathRings(f.outline)[0];
      for (const s of [...NEW_PERIPHERALS.map((t) => spec(t)), ...SIDED.map(sinister), ...lined]) {
        const g = geometryOf(s, shape);
        const where = `${shape} ${JSON.stringify(s)}`;
        expect(g.body, where).toMatch(/^M[\d.\- LCZ]+Z$/);
        // what shows of it: a fair share of the shape, all inside it
        expect(g.samples.length, where).toBeGreaterThan(s.type === 'point' ? 10 : 20);
        for (const [x, y] of g.samples) expect(pointInPolygon(x, y, outline), where).toBe(true);
        expect(g.box.x0 >= f.box.x0 && g.box.x1 <= f.box.x1 && g.box.y0 >= f.box.y0 && g.box.y1 <= f.box.y1, where).toBe(true);
        expect(pointInPolygon(g.centre.x, g.centre.y, outline), where).toBe(true);
      }
    }
  });

  it('a base and a point pointed lie at the foot, a canton, quarter and gyron in the dexter chief corner — the larger quarter round the canton', () => {
    for (const shape of FIELD_SHAPES) {
      const { fessPoint } = shapeFrame(shape);
      const at = (t: OrdinaryType) => geometryOf(spec(t), shape);
      for (const t of ['base', 'point'] as const) expect(at(t).box.y0, `${shape} ${t}`).toBeGreaterThan(fessPoint.y);
      for (const t of SIDED) expect(at(t).centre.x < fessPoint.x && at(t).centre.y < fessPoint.y, `${shape} ${t}`).toBe(true);
      const canton = new Set(at('canton').samples.map((p) => p.join())), quarter = new Set(at('quarter').samples.map((p) => p.join()));
      expect([...canton].every((p) => quarter.has(p)), shape).toBe(true);
      expect(quarter.size, shape).toBeGreaterThan(canton.size * 1.5);
    }
  });

  it('a sinister canton, quarter or gyron mirrors the dexter one about the middle of the shape', () => {
    for (const shape of FIELD_SHAPES) {
      const cx = shapeFrame(shape).fessPoint.x;
      for (const type of SIDED) {
        for (const lines of [{ a: 'plain', b: 'plain' }, { a: 'wavy', b: 'wavy' }] as const) {
          const dexter = geometryOf(spec(type, { lines }), shape), turned = geometryOf(spec(type, { lines, mods: ['sinister'] }), shape);
          // the sample grid isn't symmetric about the middle (it is offset by one), so it shows about as much of either
          expect(Math.abs(dexter.samples.length - turned.samples.length), `${shape} ${type} ${lines.a}`).toBeLessThanOrEqual(Math.max(6, dexter.samples.length * 0.15));
          expect(Math.abs(turned.centre.x - (2 * cx - dexter.centre.x)), `${shape} ${type}`).toBeLessThanOrEqual(2.5);
          // the drawn outline is the mirror, point for point
          const flip = pathRings(dexter.body).flat().map(([x, y]) => [2 * cx - x, y]);
          expect(pathRings(turned.body).flat().map(([x, y]) => [Math.round(x), Math.round(y)]).sort())
            .toEqual(flip.map(([x, y]) => [Math.round(x), Math.round(y)]).sort());
        }
      }
    }
  });

  it('a base or point pointed ends the free field for the ordinaries: drawn on under it, they lie only above it', () => {
    const d = nd(arms('argent', group(ordinary('pale'), 'gules'), group(ordinary('base'), 'azure')));
    for (const shape of FIELD_SHAPES) {
      const frame = ordinaryFrameOf(d, shape), plain = defaultOrdinaryFrame(shape);
      const top = Math.min(...geometryOf(spec('base'), shape).envelope.inner.flat().map(([, y]) => y));
      expect(frame.bottom, shape).toBeCloseTo(top, 6);
      expect(frame.centre, shape).toEqual(plain.centre);
      const pale = ordinaryGeometry(plainSpec('pale'), frame);
      expect(pale.body, shape).toBe(geometryOf(plainSpec('pale'), shape).body);
      expect(pale.samples.every(([, y]) => y < top), shape).toBe(true);
      expect(pale.samples.length, shape).toBeLessThan(geometryOf(plainSpec('pale'), shape).samples.length);
    }
    // with no base or point the frame is the default one
    expect(ordinaryFrameOf(nd(arms('argent', group(ordinary('pale'), 'gules'), group(ordinary('canton'), 'azure'))), 'heater')).toEqual(defaultOrdinaryFrame('heater'));
  });
});

describe('peripherals: charges keep out of them', () => {
  const host = (count: number) => layoutOfKey('host', count)!;
  /** The contexts charges set on the field take beside these peripherals: primary charges, between a fess, and in chief or base beside it. */
  function contexts(keepOut: readonly OrdinarySpec[]): Array<{ ctx: LayoutContext; layouts: (n: number) => ReturnType<typeof layoutOfKey>[] }> {
    return [
      { ctx: { ...fieldContext('none'), keepOut }, layouts: (n) => (n === 1 ? [layoutOfKey('single', 1)] : n === 2 ? [layoutOfKey('in-pale', 2), layoutOfKey('in-fess', 2)] : [layoutOfKey('rows-2-1', 3)]) },
      { ctx: { ...fieldContext('chief'), keepOut }, layouts: (n) => (n === 1 ? [layoutOfKey('single', 1)] : [layoutOfKey('in-fess', n)]) },
      { ctx: { k: 'between', ordinary: plainSpec('fess'), peripheral: 'none', keepOut }, layouts: (n) => (n === 1 ? [] : [host(n)]) },
      { ctx: { k: 'between', ordinary: plainSpec('pale'), peripheral: 'bordure', keepOut }, layouts: (n) => (n === 2 ? [host(n)] : []) },
      { ctx: { k: 'position', position: 'chief', ordinary: plainSpec('fess'), peripheral: 'none', keepOut }, layouts: (n) => [layoutOfKey('in-chief', n)] },
      { ctx: { k: 'position', position: 'base', ordinary: null, peripheral: 'none', keepOut }, layouts: (n) => [layoutOfKey('in-base', n)] },
    ];
  }

  it('charges keep out of a base, point pointed, canton, quarter and gyron, and of several at once (heater exhaustive, other shapes in turn)', () => {
    const keepOuts: OrdinarySpec[][] = [
      ...NEW_PERIPHERALS.map((t) => [spec(t)]), ...SIDED.map((t) => [sinister(t)]),
      [spec('base', { lines: { a: 'wavy', b: 'wavy' } })], [spec('canton', { lines: { a: 'embattled', b: 'embattled' } })],
      [spec('base'), spec('canton')], [spec('point'), sinister('gyron'), spec('quarter')],
    ];
    let k = 0, checked = 0;
    for (const keepOut of keepOuts) {
      for (const { ctx, layouts } of contexts(keepOut)) {
        for (const count of [1, 2, 3]) {
          for (const layout of layouts(count)) {
            if (!layout) continue;
            for (const shape of FIELD_SHAPES) {
              if (shape !== 'heater' && k++ % 7 !== FIELD_SHAPES.indexOf(shape) - 1) continue;
              const avoid = keepOut.flatMap((s) => geometryOf(s, shape).envelope.outer);
              for (const s of contextSlots(ctx, count, layout, shape)) {
                const where = `${shape} ${ctx.k} ${keepOut.map((x) => x.type + x.mods.join('')).join('+')} ${count} ${s.x},${s.y} ${s.size}`;
                for (const poly of avoid) {
                  expect(pointInPolygon(s.x, s.y, poly), where).toBe(false);
                  expect(edgeDistance(poly, s.x, s.y), where).toBeGreaterThanOrEqual(s.size / 2 - 0.01);
                }
                checked++;
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  }, 20_000);

  it('a charge beside a canton or quarter, or above a base, is drawn at a size that reads in every shape', () => {
    for (const keepOut of [[spec('canton')], [spec('quarter')], [spec('base')], [spec('point')], [sinister('gyron')]]) {
      for (const shape of FIELD_SHAPES) {
        const [s] = contextSlots({ ...fieldContext('none'), keepOut }, 1, layoutOfKey('single', 1)!, shape);
        expect(s?.size ?? 0, `${shape} ${keepOut[0].type}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('the design fills the contexts: its peripherals other than a chief or bordure, in order, the host a group sits on left out; none in phase-B designs', () => {
    const d = nd(arms('argent', group(charge('lion'), 'gules'), group(ordinary('canton'), 'azure'), group(ordinary('base'), 'vert'),
      group(ordinary('chief'), 'or', { charged: [group(charge('mullet'), 'sable', { count: 2 })] })));
    // canonical order: base, chief, canton (PERIPHERAL_ORDER)
    expect(d.groups.filter((g) => g.role === 'peripheral').map((g) => (g.item.k === 'ordinary' ? g.item.type : ''))).toEqual(['base', 'chief', 'canton']);
    const lion = d.groups.findIndex((g) => g.item.k === 'charge'), chief = d.groups.findIndex((g) => g.item.k === 'ordinary' && g.item.type === 'chief');
    expect(layoutContext(d, [lion])).toEqual({ ...fieldContext('chief'), keepOut: [spec('base'), spec('canton')] });
    expect(layoutContext(d, [chief, 0])).toMatchObject({ k: 'on', peripheral: 'none', keepOut: [spec('base'), spec('canton')] });
    expect(groupAt(d, [chief, 0]).count).toBe(2);
    const phaseB = nd(arms('argent', group(ordinary('fess'), 'gules'), group(charge('mullet'), 'sable', { count: 3 }), group(ordinary('bordure'), 'azure')));
    expect(layoutContext(phaseB, [1])).toEqual({ k: 'between', ordinary: plainSpec('fess'), peripheral: 'bordure', keepOut: [] });
  });
});

describe('peripherals: rules', () => {
  it('a lone canton (or base, point, quarter, gyron) makes field-primary armory', () => {
    for (const type of NEW_PERIPHERALS) {
      const d = nd(arms('argent', group(ordinary(type), 'azure')));
      expect(isFieldPrimary(d), type).toBe(true);
      expect(structuralIssues(d), type).toEqual([]);
      expect(unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`), type).toEqual([`ordinary:${type}`]);
      // A5F2: every part of the field changed is substantial for field-primary armory
      expect(differences(d, nd(arms('or', group(ordinary(type), 'azure')))).map((x) => `${x.kind}:${x.rule}`), type).toEqual(['sc:A5F2']);
    }
  });

  it('a chief and a base alike in tincture and line are refused; unlike in either, allowed', () => {
    const both = (base: string, line = 'plain') => nd(arms('argent', group(ordinary('chief'), 'azure'), group(ordinary('base', { lines: { a: line } }), base)));
    expect(rule(both('azure'), 'relation').map((i) => i.message)).toEqual(['A chief and a base alike in tincture and line are refused: make them differ in one (RULES-C §C.3).']);
    expect(rule(both('gules'), 'relation')).toEqual([]);
    expect(rule(both('azure', 'wavy'), 'relation')).toEqual([]);
  });

  it('a charged canton or quarter is refused (SENA A6C1)', () => {
    for (const type of ['canton', 'quarter'] as const) {
      const d = nd(arms('argent', group(ordinary(type), 'azure', { charged: [group(charge('mullet'), 'argent')] })));
      expect(rule(d, 'relation').map((i) => i.message), type).toEqual([`A ${type} must stay uncharged: a charged one is an augmentation (SENA A6C1).`]);
    }
  });

  it('a field per fess with a base needs a charge across the line, unless the line and the base\'s can\'t be one fess (A3D1c at the foot)', () => {
    const field = (line = 'plain') => ({ ...div('per-fess', 'argent', 'azure'), lines: { a: line } });
    const base = (line = 'plain') => group(ordinary('base', { lines: { a: line } }), 'or');
    expect(rule(nd(arms(field(), base())), 'crosses-line').map((i) => i.message)).toEqual(['A base on a field divided per fess needs a charge across the line (SENA A3D1c).']);
    expect(rule(nd(arms(field(), group(charge('lion'), 'gules'), base())), 'crosses-line')).toEqual([]);
    expect(rule(nd(arms(field('wavy'), base('wavy'))), 'crosses-line')).toHaveLength(1);
    // a per fess indented line and a plain base would be a fess indented on one edge: not one registrable fess
    expect(rule(nd(arms(field('indented'), base())), 'crosses-line')).toEqual([]);
  });

  it('nothing lies overall with a base, point, canton, quarter or gyron (App I4); with a chief or bordure it still may', () => {
    for (const type of NEW_PERIPHERALS) {
      const d = nd(arms('argent', group(charge('lion'), 'gules'), group(ordinary('bend'), 'azure', { role: 'overall' }), group(ordinary(type), 'vert')));
      expect(rule(d, 'overall').map((i) => i.message), type).toEqual([`Nothing can lie overall with a ${type === 'point' ? 'point pointed' : type} on the field (SENA App I4).`]);
    }
    expect(rule(nd(arms('argent', group(charge('lion'), 'gules'), group(ordinary('bend'), 'azure', { role: 'overall' }), group(ordinary('chief'), 'vert'))), 'overall')).toEqual([]);
  });
});

describe('peripherals: conflict', () => {
  const lone = (type: string, extra: object = {}) => nd(arms('argent', group(charge('lion'), 'gules'), group(ordinary(type, extra), 'azure')));
  const tally = (a: Design, b: Design) => differences(a, b).map((x) => `${x.kind}:${x.attr}:${x.rule}`);

  it('a canton and a quarter are one type: no change between them (L9), however drawn', () => {
    expect(tally(lone('canton'), lone('quarter'))).toEqual([]);
    expect(tally(lone('canton', { lines: { a: 'wavy' } }), lone('quarter', { lines: { a: 'wavy' } }))).toEqual([]);
    // their lines still count (A5G4)
    expect(tally(lone('canton'), lone('quarter', { lines: { a: 'wavy' } }))).toEqual(['dc:type:A5G4']);
  });

  it('a base and a point pointed differ by one DC; a canton and the canton sinister by one DC of position', () => {
    expect(tally(lone('base'), lone('point'))).toEqual(['dc:type:A5G4']);
    expect(tally(lone('canton'), lone('canton', { mods: ['sinister'] }))).toEqual(['dc:arrangement:A5G6']);
    expect(explainDifferences(lone('canton'), lone('canton', { mods: ['sinister'] })).map((n) => n.text)).toEqual(['position of corner square (top left ↔ top right)']);
    // adding one is a DC, as adding any secondary group (A5C2b)
    expect(tally(nd(arms('argent', group(charge('lion'), 'gules'))), lone('gyron'))).toEqual(['dc:group-presence:A5G2']);
  });
});

describe('peripherals: words and signature', () => {
  const words = (input: unknown) => blazon(nd(input));
  it('blazons each with its joiner from the O&A counts, the point as "point pointed" and the sinister form after the name', () => {
    expect(words(arms('argent', group(charge('mullet'), 'sable'), group(ordinary('base'), 'azure')))).toBe('Argent, a mullet sable and a base azure.');
    expect(words(arms({ k: 'variation', variation: 'bendy-sinister', parts: ['or', 'gules'] }, group(ordinary('canton'), 'sable')))).toBe('Bendy sinister Or and gules, a canton sable.');
    expect(words(arms(div('quarterly', 'azure', 'gules'), group(ordinary('point'), 'or')))).toBe('Quarterly azure and gules, a point pointed Or.');
    expect(words(arms('argent', group(ordinary('canton', { mods: ['sinister'] }), 'gules')))).toBe('Argent, a canton sinister gules.');
    expect(words(arms('argent', group(ordinary('base', { lines: { a: 'wavy' } }), 'azure')))).toBe('Argent, a base wavy azure.');
    expect(words(arms('gules', group(ordinary('quarter'), { k: 'fur', fur: 'ermine' })))).toBe('Gules, a quarter ermine.');
    expect(words(arms('argent', group(charge('lion'), 'gules'), group(ordinary('quarter'), 'azure')))).toBe('Argent, a lion gules, a quarter azure.');
    expect(words(arms('argent', group(charge('lion'), 'gules'), group(ordinary('gyron', { mods: ['sinister'] }), 'azure')))).toBe('Argent, a lion gules and a gyron sinister azure.');
    expect(words(arms('argent', group(charge('lion'), 'gules'), group(ordinary('point'), 'azure')))).toBe('Argent, a lion gules, a point pointed azure.');
    // several: base, chief, bordure, canton — each with its own joiner, tinctures shared as ever
    expect(words(arms('argent', group(charge('lion'), 'gules'), group(ordinary('chief'), 'azure'), group(ordinary('canton'), 'or'), group(ordinary('bordure'), 'sable'), group(ordinary('base'), 'vert'))))
      .toBe('Argent, a lion gules and a base vert, a chief azure, a bordure sable and a canton Or.');
    expect(words(arms('argent', group(charge('lion'), 'azure'), group(ordinary('base'), 'azure')))).toBe('Argent, a lion and a base azure.');
  });

  it('glosses them in everyday words, sinister on the right', () => {
    expect(gloss(nd(arms('argent', group(ordinary('canton', { mods: ['sinister'] }), 'gules'))))).toBe('A white shield with a red square in the top-right corner.');
    expect(gloss(nd(arms('argent', group(ordinary('base', { lines: { a: 'wavy' } }), 'azure'))))).toBe('A white shield with a blue band across the bottom with a wavy edge.');
    expect(gloss(nd(arms('argent', group(ordinary('point'), 'vert'))))).toBe('A white shield with a green curved point rising from the bottom.');
    expect(gloss(nd(arms('argent', group(ordinary('gyron'), 'sable'))))).toBe('A white shield with a black triangle from the top-left corner to the middle.');
    expect(gloss(nd(arms('argent', group(ordinary('quarter', { lines: { a: 'engrailed' } }), 'azure'))))).toBe('A white shield with a blue quarter of the shield in the top-left corner with scalloped edges.');
  });

  it('signs the sinister form as a mod; a canton and its sinister form, and a canton and a quarter, never share a signature', () => {
    const sig = (type: string, mods: string[] = []) => signature(canonical(nd(arms('argent', group(ordinary(type, { mods }), 'azure')))));
    expect(sig('canton', ['sinister'])).toBe(sig('canton').replace('o.canton', 'o.canton+sinister'));
    expect(new Set([sig('canton'), sig('canton', ['sinister']), sig('quarter'), sig('quarter', ['sinister']), sig('gyron'), sig('gyron', ['sinister']), sig('base'), sig('point')]).size).toBe(8);
  });
});
