// The treatments that trim an ordinary's outline (RULES-C §D.3–§D.5): cotises (thin bands beside each long edge, one to three a side, a
// line of their own that follows the ordinary's by default), fimbriation (a narrow band round the body, under it) and voiding (the
// middle cut out). Their geometry on every shape and the parts render draws, the rules (SENA A3C, A3B4a, the fimbriated ordinary of the
// field's tincture), the conflict readings (App I2c cotises as a group; A5C1 voided and fimbriated read two ways), words and signature.
// All three are still gaps in support.ts: these tests call the library on resolved designs.

import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, blazon, candidateKey, coreSteps, defaultOrdinaryFrame, differences, explainDifferences, gloss, liftCotises, ordinaryGeometry,
  pathPolygon, pathRings, plainSpec, pointInPolygon, renderLayers, resolve, shapeFrame, signature, specOf, structuralIssues, tinctureIssues,
  unsupportedIssues, validate,
  type Design, type FieldShape, type Line, type OrdinarySpec, type OrdinaryType,
} from '../src/lib/heraldry';
import { pointInPath } from '../src/lib/heraldry/geometry';
import { Shield } from '../src/components/Shield';
import { checkRendered, renderShieldSvg } from './sca/widget-checks';
import { arms, charge, div, group, nd, ordinary } from './helpers';

type Pt = [number, number];

const geometryOf = (s: OrdinarySpec, shape: FieldShape = 'heater') => ordinaryGeometry(s, defaultOrdinaryFrame(shape));
const cotisedSpec = (type: OrdinaryType, count: 1 | 2 | 3, line: Line = 'plain', lines: { a: Line; b: Line } = { a: 'plain', b: 'plain' }): OrdinarySpec =>
  ({ ...plainSpec(type), lines, cotised: { count, line } });
const lone = (field: unknown, item: object, paint: string, extra: object = {}) => nd(arms(field, group(item, paint, extra)));
const changes = (a: Design, b: Design) => differences(a, b).map((x) => `${x.attr}:${x.kind}:${x.rule}`);

describe('cotises, fimbriation and voiding: geometry', () => {
  it('cotises are parallel, ¼ the band wide, a cotise\'s width apart, 1–3 a side', () => {
    // across a fess (y), a pale (x) and a bend (distance from its middle line), every corner of every cotise inside the shape lies at the
    // band's half-width plus a whole number of cotise widths: 1, 2 for the first cotise, 3, 4 for the second, …
    const across: Record<'fess' | 'pale' | 'bend', (p: Pt, c: { x: number; y: number }) => number> = {
      fess: ([, y], c) => Math.abs(y - c.y), pale: ([x], c) => Math.abs(x - c.x), bend: ([x, y], c) => Math.abs((y - c.y) - (x - c.x)) / Math.SQRT2,
    };
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const type of ['fess', 'pale', 'bend'] as const) {
        for (const count of [1, 2, 3] as const) {
          const g = geometryOf(cotisedSpec(type, count), shape);
          const centre = defaultOrdinaryFrame(shape).centre;
          // the band narrows as cotises are added, so that it and its cotises are as wide as a band cotised once
          const half = 15 * (2 / (1 + count)), w = half / 2;
          expect(pathRings(g.cotises!.d)).toHaveLength(2 * count);
          // in cotise widths from the band's edge, every point of a cotise lies between 2k − 1 and 2k (cotise k), and each cotise shows
          const steps = g.cotises!.samples.map((p) => (across[type](p, centre) - half) / w);
          const cotise = (t: number) => Array.from({ length: count }, (_, k) => k + 1).find((k) => t >= 2 * k - 1 - 0.01 && t <= 2 * k + 0.01);
          for (const t of steps) expect(cotise(t), `${type} ×${count} in a ${shape}: ${t}`).toBeDefined();
          if (shape === 'heater') expect(new Set(steps.map(cotise)).size).toBe(count);
          // the cotises lie on the field, clear of the band
          for (const [x, y] of g.cotises!.samples) expect(pointInPath(pathRings(g.body), x, y)).toBe(false);
          for (const [x, y] of pathRings(g.body).flat()) if (pointInPolygon(x, y, outline)) expect(Math.abs(across[type]([x, y], centre) - half)).toBeLessThan(0.01);
        }
      }
    }
  });

  it('cotises follow a chevron\'s, a cross\'s, a saltire\'s and a pile\'s edges, mitred where they meet, and are laid inside the envelope', () => {
    for (const shape of FIELD_SHAPES) {
      for (const type of ['chevron', 'cross', 'saltire', 'pile'] as const) {
        const g = geometryOf(cotisedSpec(type, 1), shape);
        const outer = g.envelope.outer[0];
        for (const [x, y] of g.cotises!.samples) expect(pointInPolygon(x, y, outer), `${type} in a ${shape}: (${x}, ${y})`).toBe(true);
        // one ring each side of every edge: a chevron's and a pile's two (outer and inner), a cross's and a saltire's one round all four arms
        expect(pathRings(g.cotises!.d)).toHaveLength(2);
      }
    }
  });

  it('cotises carry their own line, laid on the band\'s periods; a mirrored line points out of each cotise on both edges', () => {
    const wavy = geometryOf(cotisedSpec('fess', 1, 'wavy'));
    expect(wavy.cotises!.d).toMatch(/C/);
    expect(wavy.body).not.toMatch(/C/);
    // on a band wavy with wavy cotises the cotises keep in step with the band: the same period along it
    const both = geometryOf(cotisedSpec('fess', 1, 'wavy', { a: 'wavy', b: 'wavy' }));
    const crests = (d: string) => pathRings(d)[0].filter(([x]) => x > 20 && x < 80).map(([x]) => x);
    expect(crests(both.cotises!.d).length).toBeGreaterThan(0);
    // engrailed cotises bite into each cotise from both sides: every point of the cotise's rings lies within its band, between its straight edges
    const engrailed = geometryOf(cotisedSpec('fess', 1, 'engrailed'));
    const { y } = defaultOrdinaryFrame('heater').centre;
    for (const [px, py] of pathRings(engrailed.cotises!.d).flat()) if (px > 0 && px < 100) expect(Math.abs(py - y)).toBeGreaterThanOrEqual(15 + 7.5 - 0.01);
  });

  it('fimbriation follows the band\'s line and lies under it', () => {
    for (const shape of FIELD_SHAPES) {
      for (const lines of [{ a: 'plain', b: 'plain' }, { a: 'wavy', b: 'wavy' }, { a: 'embattled', b: 'embattled' }, { a: 'engrailed', b: 'engrailed' }] as { a: Line; b: Line }[]) {
        const spec: OrdinarySpec = { ...plainSpec('pale'), lines, fimbriated: true };
        const g = geometryOf(spec, shape);
        const body = pathRings(g.body), grown = pathRings(g.fimbriation!.d);
        // the fimbriation holds the body, 2 wide all round it (its corners mitred, a sharp point cut short)
        for (const [x, y] of body.flat()) if (y > 5 && y < 115) expect(pointInPath(grown, x, y) || grown.flat().some(([gx, gy]) => Math.hypot(gx - x, gy - y) < 2.01)).toBe(true);
        const far = Math.max(...grown.flat().filter(([, py]) => py > 5 && py < 115).map(([x, y]) => Math.min(...body.flat().map(([bx, by]) => Math.hypot(bx - x, by - y)))));
        expect(far, `${lines.a} in a ${shape}`).toBeLessThanOrEqual(4.01);
        expect(g.fimbriation!.samples.length).toBeGreaterThan(0);
        for (const [x, y] of g.fimbriation!.samples) expect(pointInPath(body, x, y)).toBe(false);
      }
    }
    // render draws it first, under the body, and the cotises last
    const d = lone('gules', ordinary('pale', { lines: { a: 'wavy', b: 'wavy' }, fimbriated: 'or' }), 'sable');
    const layer = renderLayers(d, 'heater').find((l) => l.k === 'ordinary');
    expect(layer?.k === 'ordinary' && layer.parts.map((p) => p.role)).toEqual(['fimbriation', 'body']);
    const cotised = lone('argent', ordinary('bend', { cotised: { count: 2, paint: 'sable' } }), 'azure');
    const parts = renderLayers(cotised, 'heater').find((l) => l.k === 'ordinary');
    expect(parts?.k === 'ordinary' && parts.parts.map((p) => [p.role, p.fillRule])).toEqual([['body', 'nonzero'], ['cotises', 'evenodd']]);
  });

  it('voided leaves the field showing (evenodd)', () => {
    for (const shape of FIELD_SHAPES) {
      for (const type of ['cross', 'saltire'] as const) {
        for (const line of ['plain', 'wavy', 'embattled', 'indented'] as const) {
          const spec: OrdinarySpec = { ...plainSpec(type), lines: { a: line, b: line }, mods: ['voided'] };
          const g = geometryOf(spec, shape);
          expect(g.fillRule).toBe('evenodd');
          const { x, y } = defaultOrdinaryFrame(shape).centre;
          const rings = pathRings(g.body);
          expect(rings).toHaveLength(2);
          // the middle of the cross shows the field, the border round it is the cross
          expect(pointInPath(rings, x, y), `${type} ${line} voided in a ${shape}`).toBe(false);
          expect(g.samples.some(([px, py]) => Math.hypot(px - x, py - y) < 3)).toBe(false);
          expect(g.samples.length).toBeGreaterThan(0);
        }
      }
      // a couped cross voided is closed at its ends
      const couped = pathRings(geometryOf({ ...plainSpec('cross'), mods: ['couped', 'voided'] }, shape).body);
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const [x, y] of couped[1]) expect(pointInPolygon(x, y, couped[0]) && pointInPolygon(x, y, outline)).toBe(true);
    }
    // plain: the voiding's edges lie 4 inside the arms' (half-width − 4)
    const plain = pathRings(geometryOf({ ...plainSpec('cross'), mods: ['voided'] }).body);
    const xs = (ring: Pt[]) => [...new Set(ring.map(([x]) => x))].filter((x) => x > 30 && x < 70).sort((p, q) => p - q);
    expect(xs(plain[1])).toEqual(xs(plain[0]).map((x) => x + (x < 50 ? 4 : -4)));
  });

  it('a bend wavy cotised has wavy cotises: cotises follow the ordinary\'s line unless given their own', () => {
    const cotisesOf = (input: object) => {
      const r = resolve(arms('argent', group(ordinary('bend', input), 'purpure')) as never);
      if (!r.ok) throw new Error(JSON.stringify(r.errors));
      const { item } = r.design.groups[0];
      return item.k === 'ordinary' ? item.cotised : null;
    };
    expect(cotisesOf({ lines: { a: 'wavy' }, cotised: { count: 1, paint: 'sable' } })?.line).toBe('wavy');
    expect(cotisesOf({ lines: { a: 'wavy' }, cotised: { count: 1, paint: 'sable', line: 'plain' } })?.line).toBe('plain');
    expect(cotisesOf({ cotised: { count: 2, paint: 'sable' } })?.line).toBe('plain');
    // "a fess embattled" is its upper edge; its cotises follow that line on every edge
    const r = resolve(arms('argent', group(ordinary('fess', { lines: { a: 'embattled' }, cotised: { count: 1, paint: 'sable' } }), 'sable')) as never);
    expect(r.ok && r.design.groups[0].item.k === 'ordinary' && r.design.groups[0].item.cotised?.line).toBe('embattled');
    const spec = specOf(lone('argent', ordinary('bend', { lines: { a: 'wavy' }, cotised: { count: 1, paint: 'sable' } }), 'purpure').groups[0]);
    expect(geometryOf(spec).cotises!.d).toMatch(/C/);
  });

  it('plain ordinaries draw exactly as before: no trims, nonzero, their envelope their body', () => {
    for (const shape of FIELD_SHAPES) {
      for (const type of ['fess', 'pale', 'bend', 'chevron', 'cross', 'saltire', 'pile', 'chief', 'bordure'] as const) {
        const g = geometryOf(plainSpec(type), shape);
        expect([g.fimbriation, g.cotises]).toEqual([null, null]);
        expect(g.envelope.outer).toEqual(pathRings(g.body));
      }
    }
  });
});

describe('cotises, fimbriation and voiding: render', () => {
  const CASES: Design[] = [
    lone('argent', ordinary('fess', { cotised: { count: 1, paint: 'sable' } }), 'gules'),
    lone('argent', ordinary('bend', { cotised: { count: 2, paint: 'sable' } }), 'azure', { charged: [group(charge('crescent'), 'or', { count: 3 })] }),
    lone('argent', ordinary('chevron', { lines: { a: 'wavy', b: 'wavy' }, cotised: { count: 3, paint: 'azure', line: 'plain' } }), 'gules'),
    lone(div('per-fess', 'or', 'azure'), ordinary('fess', { lines: { a: 'wavy', b: 'wavy' }, cotised: { count: 1, paint: 'counterchanged' } }), 'gules'),
    lone('argent', ordinary('pale', { lines: { a: 'wavy', b: 'wavy' }, fimbriated: 'or' }), 'sable'),
    lone(div('per-pale', 'gules', 'azure'), ordinary('saltire', { fimbriated: 'argent' }), 'counterchanged'),
    lone('gules', ordinary('cross', { mods: ['voided'] }), 'or'),
    lone('vert', ordinary('saltire', { lines: { a: 'embattled' }, mods: ['couped', 'voided'] }), 'or'),
  ];

  it('checkRendered accepts a cotised, fimbriated and voided ordinary in every shape', () => {
    for (const d of CASES) for (const shape of FIELD_SHAPES) {
      for (const hatching of [false, true]) expect(checkRendered(d, renderShieldSvg(d, { shape, hatching }), shape), `${blazon(d)} in a ${shape}`).toEqual([]);
    }
  });

  it('hatching hatches cotises and fimbriation', () => {
    for (const [d, role, tincture] of [[CASES[0], 'cotises', 'sable'], [CASES[4], 'fimbriation', 'or']] as const) {
      const svg = renderToString(h(Shield, { design: d, shape: 'heater', hatching: true }));
      const part = new RegExp(`<g data-part="${role}">(.*?)</g></g>`).exec(svg)?.[1] ?? '';
      expect(part, role).toMatch(new RegExp(`fill="url\\(#hatch-[^)]*-${tincture}\\)"`));
    }
  });

  it('a counterchanged trim takes the field\'s tinctures in reverse over the parts it lies on', () => {
    const layer = renderLayers(CASES[3], 'heater').find((l) => l.k === 'ordinary');
    const cotises = layer?.k === 'ordinary' ? layer.parts.find((p) => p.role === 'cotises') : undefined;
    expect(cotises?.fill.k === 'split' && cotises.fill.parts.map((p) => p.fill.k === 'solid' && p.fill.colour.k === 'tincture' && p.fill.colour.t)).toEqual(['azure', 'or']);
  });
});

describe('cotises, fimbriation and voiding: rules', () => {
  const treatmentIssues = (d: Design) => structuralIssues(d).filter((i) => i.code === 'structure' && i.rule === 'ordinary-treatment').map((i) => i.message);

  it('a fess voided is refused; a cross or saltire voided is not', () => {
    expect(treatmentIssues(lone('azure', ordinary('fess', { mods: ['voided'] }), 'or'))).toEqual([
      "A fess can't be voided: only a cross or a saltire, with more than two ends, can (SENA A3C) — two narrower bands are blazoned instead.",
    ]);
    expect(treatmentIssues(lone('gules', ordinary('cross', { mods: ['voided'] }), 'or'))).toEqual([]);
    expect(treatmentIssues(lone('gules', ordinary('saltire', { mods: ['couped', 'voided'], lines: { a: 'wavy' } }), 'or'))).toEqual([]);
  });

  it('a fimbriated chief is refused, and so is fimbriation off the primary, on a band moved up or down, or with voiding', () => {
    expect(treatmentIssues(nd(arms('azure', group(charge('lion'), 'or'), group(ordinary('chief', { fimbriated: 'argent' }), 'gules', { role: 'peripheral' }))))).toEqual([
      "A chief can't be fimbriated: only a band or shape in the middle of the field can (SENA A3C).",
    ]);
    expect(treatmentIssues(nd(arms('azure', group(charge('lion'), 'or'), group(ordinary('bend', { fimbriated: 'argent' }), 'gules', { role: 'overall' }))))).toEqual([
      'Only the main band or shape can be fimbriated, not one lying overall (SENA A3C).',
    ]);
    expect(treatmentIssues(lone('azure', ordinary('fess', { mods: ['enhanced'], fimbriated: 'argent' }), 'gules'))).toEqual(["A fess enhanced can't be fimbriated (LoAR 06/2005, Mathild)."]);
    expect(treatmentIssues(lone('azure', ordinary('cross', { mods: ['voided'], fimbriated: 'argent' }), 'or'))).toHaveLength(1);
    expect(treatmentIssues(lone('azure', ordinary('pale', { lines: { a: 'raguly', b: 'raguly' }, fimbriated: 'argent' }), 'gules'))).toEqual([]);
  });

  it('cotises go on the bands, the chevron, the pile, the cross and the saltire only, and never on a tertiary', () => {
    for (const type of ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'] as const) {
      expect(treatmentIssues(lone('argent', ordinary(type, { cotised: { count: 1, paint: 'sable' } }), 'sable')), type).toEqual([]);
    }
    expect(treatmentIssues(nd(arms('azure', group(charge('lion'), 'or'), group(ordinary('chief', { cotised: { count: 1, paint: 'or' } }), 'gules', { role: 'peripheral' }))))).toEqual([
      "A chief can't be cotised: only a band, a chevron, a pile, a cross or a saltire can (RULES-C §D.5).",
    ]);
    // the cotises' line is checked on its host: a chevron's may bow, a fess's may not
    const lineIssues = (type: string, line: string) => structuralIssues(lone('argent', ordinary(type, { cotised: { count: 1, paint: 'sable', line } }), 'sable')).filter((i) => i.code === 'structure' && i.rule === 'line');
    expect(lineIssues('chevron', 'ploye')).toEqual([]);
    expect(lineIssues('fess', 'ploye').map((i) => i.message)).toEqual(['A bowed (ployé) line is drawn on a chevron only — not the cotises of a fess.']);
    expect(lineIssues('bend', 'dancetty')).toEqual([]);
  });

  it('a fimbriated ordinary of the field\'s tincture is refused; within its fimbriation it need not contrast with the field', () => {
    const issues = (d: Design) => validate(d).map((i) => i.message);
    expect(issues(lone('sable', ordinary('pale', { fimbriated: 'or' }), 'sable'))).toEqual([
      "A fimbriated pale of the field's tincture reads as two thin bands — give the pale another tincture (RULES-C §D.4; Prec Odolf Liafwin, 05/2007).",
    ]);
    // a pale sable on gules is colour on colour, but fimbriated Or it stands
    expect(issues(lone('gules', ordinary('pale', { fimbriated: 'or' }), 'sable'))).toEqual([]);
    // the fimbriation lies on the field and must contrast with it
    expect(issues(lone('argent', ordinary('pale', { fimbriated: 'or' }), 'sable'))).toEqual(['The fimbriation of the pale (Or) lies on Argent: metal on metal']);
  });

  it('cotises lie on the field and must contrast with it (SENA A3B4a), whatever the band\'s tincture', () => {
    expect(tinctureIssues(lone('argent', ordinary('fess', { cotised: { count: 1, paint: 'or' } }), 'gules')).map((i) => i.message)).toEqual([
      'The cotises of the fess (Or) lie on Argent: metal on metal',
    ]);
    expect(tinctureIssues(lone('argent', ordinary('fess', { cotised: { count: 1, paint: 'sable' } }), 'gules'))).toEqual([]);
    expect(tinctureIssues(CASE_COUNTERCHANGED)).toEqual([]);
    expect(tinctureIssues(lone('argent', ordinary('fess', { cotised: { count: 1, paint: 'counterchanged' } }), 'gules')).map((i) => i.message)).toEqual([
      "The cotises of the fess can't be counterchanged: that needs a field divided in two tinctures.",
    ]);
  });

  it('a charge overall over a fimbriated ordinary is a step from core practice (App G); two steps are refused', () => {
    const over = (lines: object) => nd(arms('azure', group(ordinary('pale', { fimbriated: 'argent' }), 'gules'), group(ordinary('fess', lines), 'or', { role: 'overall' })));
    expect(coreSteps(over({}))).toEqual(['overall-over-fimbriated']);
    expect(structuralIssues(over({})).filter((i) => i.code === 'structure' && i.rule === 'core-practice')).toEqual([]);
    expect(coreSteps(over({ lines: { a: 'plain', b: 'wavy' } }))).toEqual(['one-edge-line', 'overall-over-fimbriated']);
    expect(structuralIssues(over({ lines: { a: 'plain', b: 'wavy' } })).filter((i) => i.code === 'structure' && i.rule === 'core-practice').map((i) => i.message)).toEqual([
      'This design is two steps from core practice (a line on one edge of a band only, a charge overall over a fimbriated ordinary); SENA allows one (A2B, App G).',
    ]);
  });

  it('cotised, fimbriated and voided are drawn; what no builder control reaches stays a gap', () => {
    const tags = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
    expect(tags(lone('argent', ordinary('fess', { cotised: { count: 1, paint: 'sable' } }), 'gules'))).toEqual([]);
    expect(tags(lone('argent', ordinary('pale', { fimbriated: 'or' }), 'sable'))).toEqual([]);
    expect(tags(lone('gules', ordinary('cross', { mods: ['voided'] }), 'or'))).toEqual([]);
    // One outline at a time, in a plain tincture (the swapped colours for cotises), on the main band.
    expect(tags(lone('argent', ordinary('fess', { fimbriated: 'or', cotised: { count: 1, paint: 'sable' } }), 'gules'))).toEqual(['ordinary-treatment:fimbriated-and-cotised']);
    expect(tags(lone('argent', ordinary('fess', { cotised: { count: 1, paint: { k: 'fur', fur: 'ermine' } } }), 'gules'))).toEqual(['ordinary-treatment:trim-fur']);
    expect(tags(lone(div('per-pale', 'argent', 'azure'), ordinary('fess', { fimbriated: 'counterchanged' }), 'gules'))).toEqual(['ordinary-treatment:fimbriated-counterchanged']);
    expect(tags(lone('argent', ordinary('bend', { mods: ['voided'] }), 'gules'))).toEqual(['ordinary-treatment:voided']);
  });
});

const CASE_COUNTERCHANGED = lone(div('per-fess', 'or', 'azure'), ordinary('fess', { lines: { a: 'wavy', b: 'wavy' }, cotised: { count: 1, paint: 'counterchanged' } }), 'gules');

describe('cotises, fimbriation and voiding: conflict', () => {
  const bend = (extra: object = {}, paint = 'or', field = 'argent') => lone(field, ordinary('bend', extra), paint);
  const cotises = (count: 1 | 2 | 3, paint = 'sable', line?: Line) => ({ cotised: { count, paint, ...(line ? { line } : {}) } });

  it('cotises are a secondary group of the ordinary\'s type (App I2c): one per pair, in their tincture and line', () => {
    const lifted = liftCotises(bend({ lines: { a: 'wavy' }, ...cotises(2) }));
    expect(lifted.groups.map((g) => [g.role, g.relation, g.item.k === 'ordinary' && g.item.type, g.count])).toEqual([['primary', null, 'bend', 1], ['secondary', 'between', 'bend', 2]]);
    expect(lifted.groups[1].item).toMatchObject({ lines: { a: 'wavy', b: 'wavy' } });
    expect(lifted.groups[0].item).toMatchObject({ cotised: null });
    // adding or removing them is a distinct change (A5G2); their tincture another (A5G3)
    expect(changes(bend(), bend(cotises(1)))).toEqual(['group-presence:dc:A5G2']);
    expect(changes(bend(cotises(1)), bend(cotises(1, 'gules')))).toEqual(['tincture:dc:A5G3']);
    expect(explainDifferences(bend(), bend(cotises(1)))[0].text).toBe('cotises (none ↔ 1 a side)');
    expect(candidateKey(bend(cotises(1)))).toEqual(candidateKey(bend()));
  });

  it('RULES-C §B.7: a bend cotised against a bend wavy cotised is two DCs (its edge, and its cotises\' edge, which follow it); against a bend doubly cotised, one', () => {
    expect(changes(bend(cotises(1)), bend({ lines: { a: 'wavy' }, ...cotises(1) }))).toEqual(['type:dc:A5G4', 'type:dc:A5G4']);
    expect(changes(bend(cotises(1)), bend(cotises(2)))).toEqual(['number:dc:A5G5']);
    // the cotises' line alone (herald question L25)
    expect(changes(bend(cotises(1)), bend(cotises(1, 'sable', 'wavy')))).toEqual(['type:dc:A5G4']);
    expect(explainDifferences(bend(cotises(1)), bend(cotises(1, 'sable', 'wavy')))[0].text).toBe('edge of cotises (straight ↔ wavy)');
  });

  it('voided vs plain cross is one DC: read as the cross with a cross of the field\'s tincture on it, and as one of the field\'s tincture fimbriated', () => {
    const cross = (extra: object = {}, paint = 'or') => lone('gules', ordinary('cross', extra), paint);
    expect(changes(cross({ mods: ['voided'] }), cross())).toEqual(['group-presence:dc:A5G2']);
    // as "on a cross Or a cross gules", no change
    expect(changes(cross({ mods: ['voided'] }), lone('gules', ordinary('cross'), 'or', { charged: [group(ordinary('cross'), 'gules')] }))).toEqual([]);
    // as "a cross gules fimbriated Or", whose fimbriation is worth nothing: no change from a cross gules (on gules: not registrable, but compared)
    expect(changes(cross({ mods: ['voided'] }), cross({}, 'gules'))).toEqual([]);
    expect(candidateKey(cross({ mods: ['voided'] }))).toEqual(candidateKey(cross()));
    expect(explainDifferences(cross({ mods: ['voided'] }), cross())[0].text).toBe('band or shape (cross ↔ none)');
  });

  it('fimbriated vs plain is no change; read also as an ordinary of the fimbriation\'s tincture with the ordinary on it', () => {
    expect(changes(bend({ fimbriated: 'gules' }), bend())).toEqual([]);
    expect(changes(bend({ fimbriated: 'gules' }), bend({}, 'gules', 'argent'))).toEqual(['tincture:dc:A5G3']);
    expect(changes(bend({ fimbriated: 'gules' }), lone('argent', ordinary('bend'), 'gules', { charged: [group(ordinary('bend'), 'or')] }))).toEqual([]);
  });

  it('bend Or fimbriated gules is not a bend between two bendlets', () => {
    const bendlets = nd(arms('argent', group(ordinary('bend'), 'or'), group(ordinary('bendlet'), 'gules', { count: 2, role: 'secondary', relation: 'between' })));
    // read as the bend alone, the bendlets are an added group: one DC, not none
    expect(changes(bend({ fimbriated: 'gules' }), bendlets)).toEqual(['group-presence:dc:A5G2']);
  });

  it('designs with neither keep their differences and keys', () => {
    const [a, b] = [bend(), lone('argent', ordinary('bend', { lines: { a: 'wavy' } }), 'gules')];
    expect(changes(a, b)).toEqual(['type:dc:A5G4', 'tincture:dc:A5G3']);
    expect(liftCotises(a)).toBe(a);
  });
});

describe('cotises, fimbriation and voiding: words and signature', () => {
  it('blazons every ordinary line × cotise line × shared or own tincture, each its own words', () => {
    const lines: Line[] = ['plain', 'wavy', 'embattled'];
    const seen = new Map<string, string>();
    for (const type of ['bend', 'pale', 'chevron'] as const) {
      for (const ordinaryLine of lines) {
        for (const cotiseLine of lines) {
          for (const cotisePaint of ['azure', 'or'] as const) {
            const d = lone('argent', ordinary(type, { lines: { a: ordinaryLine }, cotised: { count: 1, paint: cotisePaint, line: cotiseLine } }), 'azure');
            const text = blazon(d);
            const name = type === 'pale' ? 'endorsed' : 'cotised';
            const own = ordinaryLine === 'plain' ? '' : ` ${ordinaryLine}`;
            const follows = cotiseLine === (d.groups[0].item.k === 'ordinary' ? d.groups[0].item.lines.a : 'plain');
            const theirs = follows ? '' : ` ${cotiseLine}`;
            const tinctures = cotisePaint === 'azure' ? ` ${name}${theirs} azure` : ` azure ${name}${theirs} Or`;
            expect(text).toBe(`Argent, a ${type}${own}${tinctures}.`);
            const key = signature(d);
            expect(seen.get(text) ?? key, text).toBe(key);
            seen.set(text, key);
          }
        }
      }
    }
    expect(new Set(seen.values()).size).toBe(seen.size);
  });

  it('words the treatments in house style', () => {
    const cases: [Design, string][] = [
      [lone('argent', ordinary('fess', { cotised: { count: 1, paint: 'or' } }), 'gules'), 'Argent, a fess gules cotised Or.'],
      [lone('argent', ordinary('bend', { cotised: { count: 2, paint: 'sable' } }), 'azure', { charged: [group(charge('crescent'), 'or', { count: 3 })] }), 'Argent, on a bend azure doubly cotised sable three crescents Or.'],
      [lone('argent', ordinary('bend', { cotised: { count: 3, paint: 'sable' } }), 'sable'), 'Argent, a bend triply cotised sable.'],
      [lone('argent', ordinary('bend', { lines: { a: 'wavy' }, cotised: { count: 1, paint: 'sable', line: 'plain' } }), 'purpure'), 'Argent, a bend wavy purpure cotised plain sable.'],
      [lone('or', ordinary('pale', { cotised: { count: 1, paint: 'azure' } }), 'azure'), 'Or, a pale endorsed azure.'],
      [CASE_COUNTERCHANGED, 'Per fess Or and azure, a fess wavy gules cotised counterchanged.'],
      [lone('argent', ordinary('pale', { lines: { a: 'wavy' }, fimbriated: 'or' }), 'sable'), 'Argent, a pale wavy sable fimbriated Or.'],
      [lone(div('per-pale', 'gules', 'azure'), ordinary('saltire', { fimbriated: 'argent' }), 'counterchanged'), 'Per pale gules and azure, a saltire counterchanged fimbriated argent.'],
      [lone('gules', ordinary('cross', { mods: ['voided'] }), 'or'), 'Gules, a cross voided Or.'],
      [lone('vert', ordinary('saltire', { lines: { a: 'raguly' }, mods: ['couped', 'voided'] }), 'or'), 'Vert, a saltire raguly couped voided Or.'],
      // the fimbriation's tincture carries over to what follows it; the cotises' too
      [nd(arms('sable', group(ordinary('chevron', { fimbriated: 'argent' }), 'gules'), group(charge('roundel'), 'argent', { count: 3, relation: 'between' }))), 'Sable, a chevron gules fimbriated between three roundels argent.'],
      [nd(arms('argent', group(ordinary('chevron', { cotised: { count: 1, paint: 'azure' } }), 'azure'), group(charge('mullet'), 'azure', { count: 3, relation: 'between' }))), 'Argent, a chevron cotised between three mullets azure.'],
    ];
    for (const [d, text] of cases) expect(blazon(d)).toBe(text);
  });

  it('glosses them: thin stripes on each side, edged in a colour, hollow', () => {
    expect(gloss(lone('argent', ordinary('fess', { cotised: { count: 2, paint: 'sable', line: 'wavy' } }), 'gules'))).toBe('A white shield with a red horizontal band across the middle, with two thin wavy black stripes on each side.');
    expect(gloss(lone('argent', ordinary('pale', { fimbriated: 'or' }), 'sable'))).toMatch(/^A white shield with a black .*, edged in gold\.$/);
    expect(gloss(lone('gules', ordinary('cross', { mods: ['voided'] }), 'or'))).toMatch(/^A red shield with a gold hollow /);
    expect(gloss(CASE_COUNTERCHANGED)).toMatch(/with a thin wavy stripe on each side in the opposite colours of the field/);
  });

  it('signs cotises and fimbriation after the ordinary\'s mods (PLAN-C §3.1); plain ordinaries sign as before', () => {
    expect(signature(lone('argent', ordinary('bend', { lines: { a: 'wavy' }, cotised: { count: 2, paint: 'sable', line: 'plain' } }), 'purpure'))).toBe('arms|ar|P:o.bend~wavy#c2(sa):1:single:pu');
    expect(signature(lone('argent', ordinary('bend', { cotised: { count: 1, paint: 'sable', line: 'wavy' } }), 'purpure'))).toBe('arms|ar|P:o.bend#c1~wavy(sa):1:single:pu');
    expect(signature(lone('gules', ordinary('cross', { mods: ['couped', 'voided'], fimbriated: 'argent' }), 'or'))).toBe('arms|gu|P:o.cross+couped+voided#f(ar):1:single:or');
    expect(signature(lone('gules', ordinary('cross'), 'or'))).toBe('arms|gu|P:o.cross:1:single:or');
  });
});
