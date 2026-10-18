// Diminutives (PLAN-C C11; RULES-C §C.2): bars, pallets, bendlets (sinister) and chevronels two to four at a time, and the baton (a bendlet
// sinister couped). Their geometry on every shape (evenly spaced across their ordinary's place, below a chief), what a single one is (its
// ordinary; a saltorel a saltire couped), the words, conflict (one type with their ordinary, number, three or more read as the variation,
// with wildcard candidate keys), the rules (bendlets enhanced with charges a step from core practice), charges set between them, and the
// builder's Thin toggle and count row.

import { describe, expect, it } from 'vitest';
import {
  DIMINUTIVE_COUNTS, FIELD_SHAPES, THIN_ORDINARIES, ANY_PRIMARY, blazon, candidateKey, contextSlots, coreSteps, defaultOrdinaryFrame, differences, gloss, groupAt,
  hostCounts, keysMayConflict, layoutContext, layoutOfKey, ordinaryCountChoices, ordinaryFrameOf, ordinaryGeometry, outlineChoices, pathPolygon, pathRings, plainSpec,
  pointInPolygon, setOrdinaryCount, structuralIssues, MIN_SLOT_SIZE, setToggle, shapeFrame, signature, toggleChoices, unsupportedIssues,
  type Design, type FieldShape, type OrdinarySpec, type OrdinaryType,
} from '../src/lib/heraldry';
import { setOrdinary } from '../src/lib/builder';
import { arms, charge, group, nd, ordinary } from './helpers';

type Pt = [number, number];

const spec = (type: OrdinaryType, extra: Partial<OrdinarySpec> = {}): OrdinarySpec => ({ ...plainSpec(type), ...extra });
const geometryOf = (s: OrdinarySpec, shape: FieldShape) => ordinaryGeometry(s, defaultOrdinaryFrame(shape));
const dims = (type: string, count: number, paint = 'or', extra: object = {}) => group(ordinary(type, extra), paint, { count });
const tags = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Where a piece of a group lies across the group: a bar's height, a pallet's x, a bendlet's distance across the bend, a chevronel's apex. */
function across(type: OrdinaryType, ring: readonly Pt[]): number {
  switch (type) {
    case 'bar': return mean(ring.map(([, y]) => y));
    case 'pallet': return mean(ring.map(([x]) => x));
    case 'bendlet': return mean(ring.map(([x, y]) => (x - y) / Math.SQRT2));
    case 'bendlet-sinister': return mean(ring.map(([x, y]) => (x + y) / Math.SQRT2));
    default: return Math.min(...ring.map(([, y]) => y));
  }
}

describe('diminutives: geometry', () => {
  it('bars, pallets, bendlets and chevronels are evenly spaced and inside every shape', () => {
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const type of THIN_ORDINARIES) {
        for (const count of DIMINUTIVE_COUNTS) {
          const g = geometryOf(spec(type, { count }), shape);
          const rings = pathRings(g.body);
          expect(rings, `${type} ${count} ${shape}`).toHaveLength(count);
          const places = rings.map((r) => across(type, r)).sort((a, b) => a - b);
          const gaps = places.slice(1).map((p, i) => p - places[i]);
          for (const gap of gaps) expect(gap, `${type} ${count} ${shape}`).toBeCloseTo(gaps[0], 1);
          // every piece shows in the shape, and the group's samples lie in it
          for (const ring of rings) expect(g.samples.filter(([x, y]) => pointInPolygon(x, y, ring)).length, `${type} ${count} ${shape}`).toBeGreaterThan(8);
          expect(g.samples.every(([x, y]) => pointInPolygon(x, y, outline))).toBe(true);
          // charges set between them keep clear of the whole group: one envelope round it, the pieces inside it
          expect(g.envelope.outer).toHaveLength(1);
          for (const [x, y] of g.samples) expect(pointInPolygon(x, y, g.envelope.outer[0])).toBe(true);
        }
      }
    }
  });

  it('lined, enhanced and inverted groups move and turn as a whole; a baton is a short bendlet, a baton sinister one mirrored', () => {
    const heater = (s: OrdinarySpec) => geometryOf(s, 'heater');
    const top = (s: OrdinarySpec) => Math.min(...pathRings(heater(s).body).flat().map(([, y]) => y));
    expect(heater(spec('bar', { count: 3, mods: ['enhanced'] })).centre.y).toBeLessThan(heater(spec('bar', { count: 3 })).centre.y);
    expect(heater(spec('bendlet', { count: 3, mods: ['enhanced'] })).centre.y).toBeLessThan(heater(spec('bendlet', { count: 3 })).centre.y);
    // chevronels inverted: the V points down, the group lower than the upright one
    const upright = heater(spec('chevronel', { count: 2 })), turned = heater(spec('chevronel', { count: 2, mods: ['inverted'] }));
    expect(top(spec('chevronel', { count: 2, mods: ['inverted'] }))).toBeLessThan(0);
    expect(turned.centre.y).toBeGreaterThan(upright.centre.y);
    // a wavy group has its lines and stays as many pieces
    expect(pathRings(heater(spec('bar', { count: 3, lines: { a: 'wavy', b: 'wavy' } })).body)).toHaveLength(3);
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      const baton = pathRings(geometryOf(spec('baton'), shape).body);
      expect(baton).toHaveLength(1);
      expect(baton[0].every(([x, y]) => pointInPolygon(x, y, outline))).toBe(true);
      // from dexter chief down to sinister base; sinister, the other way
      const highest = (ring: readonly (readonly number[])[]) => ring.reduce((a, p) => (p[1] < a[1] ? p : a));
      expect(highest(baton[0])[0]).toBeLessThan(50);
      expect(highest(pathRings(geometryOf(spec('baton', { mods: ['sinister'] }), shape).body)[0])[0]).toBeGreaterThan(50);
    }
  });

  it('bars and chevronels under a chief start below it', () => {
    for (const shape of FIELD_SHAPES) {
      const d = nd(arms('argent', dims('bar', 3, 'azure'), group(ordinary('chief'), 'gules')));
      const frame = ordinaryFrameOf(d, shape);
      expect(frame.top).toBe(shapeFrame(shape).chiefBase);
      for (const type of ['bar', 'chevronel'] as const) {
        const highest = Math.min(...pathRings(ordinaryGeometry(spec(type, { count: 3 }), frame).body).flat().map(([, y]) => y));
        expect(highest, `${type} ${shape}`).toBeGreaterThanOrEqual(frame.top);
      }
    }
  });
});

describe('diminutives: model and words', () => {
  it('a single diminutive canonicalises to its ordinary', () => {
    const one = (type: string, extra: object = {}) => groupAt(nd(arms('azure', dims(type, 1, 'or', extra))), [0]).item;
    expect(one('bar')).toMatchObject({ type: 'fess' });
    expect(one('pallet')).toMatchObject({ type: 'pale' });
    expect(one('bendlet', { mods: ['enhanced'] })).toMatchObject({ type: 'bend', mods: ['enhanced'] });
    expect(one('bendlet-sinister')).toMatchObject({ type: 'bend-sinister' });
    expect(one('chevronel', { mods: ['inverted'] })).toMatchObject({ type: 'chevron', mods: ['inverted'] });
    expect(one('saltorel')).toMatchObject({ type: 'saltire', mods: ['couped'] });
    expect(one('baton')).toMatchObject({ type: 'baton' });
    expect(groupAt(nd(arms('azure', dims('barrulet', 3))), [0]).item).toMatchObject({ type: 'bar' });
    // a single one set beside the main charge stays itself, a gap
    expect(tags(nd(arms('azure', group(charge('lion'), 'or'), { ...dims('bar', 1, 'argent'), role: 'secondary', position: 'chief' })))).toContain('ordinary:single-diminutive');
    expect(tags(nd(arms('argent', dims('saltorel', 3, 'gules'))))).toEqual(['ordinary:saltorel-multiple']);
    expect(tags(nd(arms('argent', dims('bar', 5, 'gules'))))).toEqual(['ordinary:multiple']);
    expect(tags(nd(arms('argent', dims('baton', 2, 'gules'))))).toEqual(['ordinary:multiple']);
    expect(tags(nd(arms('argent', dims('bar', 2, 'gules', { fimbriated: 'or' }))))).toEqual(['ordinary-treatment:outline-on-diminutives']);
    expect(tags(nd(arms('argent', { ...dims('pallet', 2, 'gules'), charged: [group(charge('mullet'), 'or', { count: 3 })] })))).toContain('multiple-groups:tertiary-on-diminutives');
  });

  it('blazons and glosses a group with its count and plural', () => {
    const words = (d: Design) => [blazon(d), gloss(d)];
    expect(words(nd(arms('gules', dims('bar', 3))))).toEqual(['Gules, three bars Or.', 'A red shield with three gold thin horizontal bands.']);
    expect(blazon(nd(arms('azure', dims('bar', 3, 'argent', { lines: { a: 'wavy' } }))))).toBe('Azure, three bars wavy argent.');
    expect(blazon(nd(arms('sable', dims('chevronel', 2, 'or', { mods: ['inverted'] }))))).toBe('Sable, two chevronels inverted Or.');
    expect(blazon(nd(arms('azure', dims('bendlet-sinister', 2))))).toBe('Azure, two bendlets sinister Or.');
    expect(blazon(nd(arms('purpure', dims('bendlet', 3, 'argent', { mods: ['enhanced'] }))))).toBe('Purpure, three bendlets enhanced argent.');
    expect(blazon(nd(arms('gules', dims('baton', 1, 'argent'))))).toBe('Gules, a baton argent.');
    expect(blazon(nd(arms('or', dims('chevronel', 2, 'gules'), group(charge('rose'), 'gules', { count: 3, relation: 'between' }))))).toBe('Or, two chevronels between three roses gules.');
  });

  it('the signature tells types, counts and lines apart', () => {
    const sigs = [dims('bar', 2), dims('bar', 3), dims('pallet', 3), dims('bar', 3, 'or', { lines: { a: 'wavy' } }), dims('chevronel', 2), dims('chevronel', 2, 'or', { mods: ['inverted'] }), dims('baton', 1), group(ordinary('fess'), 'or')]
      .map((g) => signature(nd(arms('azure', g))));
    expect(new Set(sigs).size).toBe(sigs.length);
  });
});

describe('diminutives: conflict', () => {
  const lone = (g: object, field: unknown = 'azure') => nd(arms(field, g));
  const changes = (a: Design, b: Design) => differences(a, b).map((x) => `${x.attr}:${x.kind}:${x.rule}`);
  const barry = (lines: string) => ({ k: 'variation', variation: 'barry', lines: { a: lines, b: lines }, parts: ['azure', 'argent'] });

  it('bend vs two bendlets is substantial (number); bars are the fess\'s type', () => {
    expect(changes(lone(group(ordinary('bend'), 'or')), lone(dims('bendlet', 2)))).toEqual(['number:sc:A5E3']);
    expect(changes(lone(group(ordinary('fess'), 'or')), lone(dims('bar', 2)))).toEqual(['number:sc:A5E3']);
    expect(changes(lone(dims('bar', 2)), lone(dims('pallet', 2)))).toEqual(['type:sc:A5E2']);
    // two or three, four or more (A5E3)
    expect(changes(lone(dims('bar', 4)), lone(dims('pallet', 4)))).toEqual(['type:sc:A5E2']);
    expect(changes(lone(dims('chevronel', 2)), lone(dims('chevronel', 2, 'or', { mods: ['inverted'] })))).toEqual(['type:sc:A5E2']);
    // a baton is a bend couped, a baton sinister a bend sinister couped (RULES-C §C.2; review R-5)
    expect(changes(lone(dims('baton', 1)), lone(group(ordinary('bend', { mods: ['couped'] }), 'or')))).toEqual([]);
    expect(changes(lone(dims('baton', 1)), lone(group(ordinary('bend'), 'or')))).toEqual(['type:dc:A5G4']);
    expect(changes(lone(dims('baton', 1, 'or', { mods: ['sinister'] })), lone(group(ordinary('bend-sinister', { mods: ['couped'] }), 'or')))).toEqual([]);
    expect(changes(lone(dims('baton', 1)), lone(group(ordinary('bend-sinister', { mods: ['couped'] }), 'or')))).toEqual(['type:sc:A5E2']);
  });

  it('three bars wavy vs barry rayonny is one DC; vs barry wavy no change (variation reading)', () => {
    const bars = lone(dims('bar', 3, 'argent', { lines: { a: 'wavy' } }));
    expect(changes(bars, nd(arms(barry('rayonny'))))).toEqual(['field-line:dc:A5G1c']);
    expect(changes(bars, nd(arms(barry('wavy'))))).toEqual([]);
    expect(keysMayConflict(candidateKey(bars), candidateKey(nd(arms(barry('wavy')))))).toBe(true);
    expect(candidateKey(bars)).toEqual({ partition: null, primary: ANY_PRIMARY });
  });

  it('two bendlets vs bendy is not the variation reading', () => {
    const bendy = nd(arms({ k: 'variation', variation: 'bendy', parts: ['azure', 'or'] }));
    expect(changes(lone(dims('bendlet', 2)), bendy)).toContain('field-partition:sc:A5F1');
    expect(candidateKey(lone(dims('bendlet', 2)))).toEqual({ partition: 'plain', primary: 'ordinary:bend' });
    // three with a charge set around them are read as they are
    expect(candidateKey(nd(arms('azure', dims('bendlet', 3), group(charge('mullet'), 'argent', { count: 2, relation: 'between' })))).primary).toBe('ordinary:bend');
  });
});

describe('diminutives: rules and layout', () => {
  it('bendlets enhanced with charges is a step from core practice', () => {
    expect(coreSteps(nd(arms('purpure', dims('bendlet', 3, 'argent', { mods: ['enhanced'] }))))).toEqual([]);
    const withCharge = nd(arms('purpure', dims('bendlet', 3, 'argent', { mods: ['enhanced'] }), group(charge('mullet'), 'argent', { count: 2, relation: 'between' })));
    expect(coreSteps(withCharge)).toEqual(['enhanced-bendlets-with-charges']);
  });

  it('a fess between two bars is not drawn (it would be "a fess cotised")', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or'), { ...dims('bar', 2, 'or'), role: 'secondary', relation: 'between' }));
    expect(tags(d)).toContain('multiple-groups:secondary-ordinary');
  });

  it('charges set between a group take the counts of its ordinary\'s Table 7 row; two of them leave room for every count', () => {
    const counts = Object.fromEntries(THIN_ORDINARIES.map((t) => [t, hostCounts('between', spec(t, { count: 2 }))]));
    expect(counts).toEqual({ bar: [2, 3, 4, 6], pallet: [2, 4, 6], bendlet: [2, 4, 6], 'bendlet-sinister': [2, 4, 6], chevronel: [2, 3, 6] });
    const fits = (type: string, count: number, n: number) => {
      const d = nd(arms('azure', dims(type, count), group(charge('mullet'), 'argent', { count: n, relation: 'between' })));
      const slots = contextSlots(layoutContext(d, [1]), n, layoutOfKey('host', n)!, 'heater');
      return slots.length === n && Math.min(...slots.map((s) => s.size)) >= MIN_SLOT_SIZE && !structuralIssues(d).some((i) => i.code === 'structure' && i.rule === 'capacity');
    };
    for (const type of THIN_ORDINARIES) for (const n of counts[type]) expect(fits(type, 2, n), `${type} 2 between ${n}`).toBe(true);
    // three chevronels between three (the usual count); three or four bars take the room above and below (the capacity rule says so)
    expect(fits('chevronel', 3, 3)).toBe(true);
    expect(fits('bar', 3, 2)).toBe(false);
  });
});

describe('diminutives: builder', () => {
  it('the Thin toggle draws a band as two thin ones of its kind, the count row two to four, and back', () => {
    const fess = nd(arms('gules', group(ordinary('fess', { lines: { a: 'wavy' } }), 'or')));
    expect(toggleChoices(fess, [0]).find((c) => c.value === 'thin')).toEqual({ value: 'thin', allowed: true });
    const bars = setToggle(fess, [0], 'thin', true);
    expect(blazon(bars)).toBe('Gules, two bars wavy Or.');
    expect(ordinaryCountChoices(bars, [0]).map((c) => c.value)).toEqual([2, 3, 4]);
    expect(outlineChoices(bars, [0])).toEqual([]);
    const three = setOrdinaryCount(bars, [0], 3);
    expect(blazon(three)).toBe('Gules, three bars wavy Or.');
    expect(blazon(setOrdinary(three, 'chevron'))).toBe('Gules, three chevronels wavy Or.');
    expect(blazon(setToggle(three, [0], 'thin', false))).toBe('Gules, a fess wavy Or.');
    // a cotised band loses its cotises when thinned; the baton and the cross have no thin form (the baton turns sinister)
    const cotised = nd(arms('gules', group(ordinary('bend', { cotised: { count: 1, paint: 'or' } }), 'or')));
    expect(blazon(setToggle(cotised, [0], 'thin', true))).toBe('Gules, two bendlets Or.');
    expect(toggleChoices(nd(arms('gules', dims('baton', 1))), [0]).map((c) => c.value)).toEqual(['sinister']);
    expect(toggleChoices(nd(arms('gules', group(ordinary('cross'), 'or'))), [0]).map((c) => c.value)).not.toContain('thin');
  });
});
