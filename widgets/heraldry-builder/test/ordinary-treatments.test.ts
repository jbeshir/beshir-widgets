// The treatments that change an ordinary's outline (RULES-C §D): inverted (a chevron or pile turned upside down), couped (a band,
// chevron, cross or saltire cut short inside the shape, its ends straight), throughout (a chevron's apex or a pile's point on the edge),
// enhanced and abased (a band moved toward chief or base). Their geometry on every shape, their conflict readings (A5E5c, A5G4, A5G7,
// none for position), the rules, the layouts around them, the words, the builder's toggles and the signature.

import { describe, expect, it } from 'vitest';
import {
  DRAWN_ORDINARIES, FIELD_SHAPES, MOD_HOSTS, isDiminutive, blazon, candidateKey, contextSlots, defaultOrdinaryFrame, differences, explainDifferences, gloss, groupAt,
  layoutOfKey, ordinaryGeometry, pathPolygon, pathRings, plainSpec, pointInPolygon, resolve, setBandPosition, setToggle, shapeFrame, signature,
  structuralIssues, toggleChoices, unsupportedIssues, bandPositionChoices,
  type Design, type FieldShape, type OrdinaryMod, type OrdinarySpec, type OrdinaryType,
} from '../src/lib/heraldry';
import { setOrdinary } from '../src/lib/builder';
import type { Lines } from '../src/lib/heraldry/design';
import { arms, charge, group, nd, ordinary } from './helpers';

type Pt = [number, number];

const spec = (type: OrdinaryType, mods: OrdinaryMod[], lines: Lines = { a: 'plain', b: 'plain' }): OrdinarySpec => ({ ...plainSpec(type), mods, lines });
const geometryOf = (s: OrdinarySpec, shape: FieldShape = 'heater') => ordinaryGeometry(s, defaultOrdinaryFrame(shape));
const points = (body: string): Pt[] => pathRings(body).flat();
const box = (body: string) => {
  const ps = points(body);
  return { x0: Math.min(...ps.map(([x]) => x)), y0: Math.min(...ps.map(([, y]) => y)), x1: Math.max(...ps.map(([x]) => x)), y1: Math.max(...ps.map(([, y]) => y)) };
};
const treatedArms = (type: string, mods: string[], extra: object = {}) => nd(arms('azure', group(ordinary(type, { mods, ...extra }), 'or')));

describe('ordinary treatments: geometry', () => {
  it('a chevron or pile inverted is the upright one reflected below the fess point; the chevron inverted\'s limbs rise to the sides', () => {
    for (const shape of FIELD_SHAPES) {
      const frame = defaultOrdinaryFrame(shape);
      const axis = frame.centre.y + 10;
      for (const type of ['chevron', 'pile'] as const) {
        const upright = points(geometryOf(spec(type, []), shape).body);
        const turned = points(geometryOf(spec(type, ['inverted']), shape).body);
        if (type === 'chevron') expect(turned).toEqual(upright.map(([x, y]) => [expect.closeTo(x, 6), expect.closeTo(2 * axis - y, 6)]));
        // a pile inverted issues from the base: its point is as far below the axis as the pile's is above it
        else expect(Math.min(...turned.map(([, y]) => y))).toBeCloseTo(2 * axis - Math.max(...upright.map(([, y]) => y)), 6);
      }
      // the apex (on its outer, lower edge) lies below the fess point, and the limbs climb from it to either side
      const chevron = box(geometryOf(spec('chevron', ['inverted']), shape).body);
      expect(chevron.y1).toBeGreaterThan(frame.centre.y);
      expect(chevron.x0).toBeLessThan(shapeFrame(shape).box.x0);
      expect(chevron.x1).toBeGreaterThan(shapeFrame(shape).box.x1);
    }
  });

  it('couped ends stay inside the shield with straight ends on lined bands', () => {
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const type of MOD_HOSTS.couped) {
        for (const lines of [{ a: 'plain', b: 'plain' }, { a: 'embattled', b: 'embattled' }, { a: 'wavy', b: 'wavy' }] as Lines[]) {
          const body = geometryOf(spec(type, ['couped'], type === 'cross' || type === 'saltire' ? { a: lines.a, b: lines.a } : lines), shape).body;
          for (const [x, y] of points(body)) expect(pointInPolygon(x, y, outline), `${type} ${lines.a} couped in a ${shape}: (${x}, ${y})`).toBe(true);
        }
      }
      // a couped fess embattled ends square: the corners at each end share their x, and nothing lies beyond them
      const fess = points(geometryOf(spec('fess', ['couped'], { a: 'embattled', b: 'embattled' }), shape).body);
      const left = Math.min(...fess.map(([x]) => x)), right = Math.max(...fess.map(([x]) => x));
      expect(fess.filter(([x]) => x === left).length).toBeGreaterThanOrEqual(2);
      expect(fess.filter(([x]) => x === right).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('throughout reaches the edge in every shape', () => {
    for (const shape of FIELD_SHAPES) {
      const { box: frameBox } = shapeFrame(shape);
      expect(box(geometryOf(spec('chevron', ['throughout']), shape).body).y0).toBeCloseTo(frameBox.y0, 6);
      expect(box(geometryOf(spec('chevron', ['inverted', 'throughout']), shape).body).y1).toBeCloseTo(frameBox.y1, 6);
      expect(box(geometryOf(spec('pile', ['throughout']), shape).body).y1).toBeCloseTo(frameBox.y1, 6);
      expect(box(geometryOf(spec('pile', ['inverted', 'throughout']), shape).body).y0).toBeCloseTo(frameBox.y0, 6);
    }
  });

  it('enhanced and abased move the band, not its width', () => {
    for (const shape of FIELD_SHAPES) {
      // the bands; diminutives move as a group (diminutives.test.ts)
      for (const type of MOD_HOSTS.enhanced.filter((t) => !isDiminutive(t))) {
        const plain = geometryOf(spec(type, []), shape), up = geometryOf(spec(type, ['enhanced']), shape), down = geometryOf(spec(type, ['abased']), shape);
        const shift = type === 'fess' ? 12 : 12 * Math.SQRT2;
        const [p, u, d] = [plain, up, down].map((g) => g.envelope.outer[0]);
        expect(u.map(([x, y]) => [x, y + shift])).toEqual(p.map(([x, y]) => [expect.closeTo(x, 1), expect.closeTo(y, 1)]));
        expect(d.map(([x, y]) => [x, y - shift])).toEqual(p.map(([x, y]) => [expect.closeTo(x, 1), expect.closeTo(y, 1)]));
        expect(up.centre.y).toBeCloseTo(plain.centre.y - shift, 6);
      }
    }
  });
});

describe('ordinary treatments: conflict', () => {
  const lone = (type: string, mods: string[] = []) => nd(arms('azure', group(ordinary(type, { mods }), 'or')));

  it('chevron vs chevron inverted is substantial (prefilter keys differ)', () => {
    const [a, b] = [lone('chevron'), lone('chevron', ['inverted'])];
    expect(differences(a, b).map((x) => [x.attr, x.kind, x.rule])).toEqual([['type', 'sc', 'A5E2']]);
    expect(candidateKey(a).primary).not.toBe(candidateKey(b).primary);
    expect(explainDifferences(a, b)[0].text).toBe('form of chevron (upright ↔ inverted)');
    // as a secondary group, the same change is one distinct change (A5G)
    const beside = (mods: string[]) => nd(arms('azure', group(charge('lion'), 'or'), group(ordinary('chevron', { mods }), 'argent', { role: 'overall' })));
    expect(differences(beside([]), beside(['inverted'])).map((x) => [x.attr, x.kind])).toEqual([['type', 'dc']]);
  });

  it('pile vs pile inverted is a DC of orientation (A5G7), not a change of type', () => {
    const [a, b] = [lone('pile'), lone('pile', ['inverted'])];
    expect(differences(a, b).map((x) => [x.attr, x.kind, x.rule])).toEqual([['posture', 'dc', 'A5G7']]);
    expect(candidateKey(a)).toEqual(candidateKey(b));
  });

  it('cross couped vs cross is a DC (A5G4), folded into one change of type with a change of edge', () => {
    expect(differences(lone('cross'), lone('cross', ['couped'])).map((x) => [x.attr, x.kind, x.rule])).toEqual([['type', 'dc', 'A5G4']]);
    expect(explainDifferences(lone('cross'), lone('cross', ['couped']))[0].text).toBe('form of cross (throughout ↔ couped)');
    const edged = nd(arms('azure', group(ordinary('cross', { mods: ['couped'], lines: { a: 'wavy' } }), 'or')));
    expect(differences(lone('cross'), edged).map((x) => [x.attr, x.kind])).toEqual([['type', 'dc']]);
  });

  it('fess enhanced vs fess is no change; a chevron throughout is no change from a chevron', () => {
    expect(differences(lone('fess'), lone('fess', ['enhanced']))).toEqual([]);
    expect(differences(lone('bend'), lone('bend', ['abased']))).toEqual([]);
    expect(differences(lone('chevron'), lone('chevron', ['throughout']))).toEqual([]);
    expect(candidateKey(lone('fess', ['couped']))).toEqual(candidateKey(lone('fess')));
  });
});

describe('ordinary treatments: rules', () => {
  it('a charged chevron inverted abased is refused', () => {
    const d = nd(arms('azure', group(ordinary('chevron', { mods: ['inverted', 'abased'] }), 'or', { charged: [group(charge('roundel'), 'gules', { count: 3 })] })));
    expect(structuralIssues(d).some((i) => i.code === 'structure' && i.rule === 'relation' && /inverted and abased/.test(i.message))).toBe(true);
    expect(structuralIssues(treatedArms('chevron', ['inverted', 'abased']))).toEqual([]);
  });

  it('treatments that contradict each other, or say what a cross already is, don\'t resolve', () => {
    for (const [type, mods] of [['chevron', ['couped', 'throughout']], ['fess', ['enhanced', 'abased']], ['chevron', ['throughout', 'enhanced']], ['cross', ['throughout']]] as const) {
      const r = resolve(arms('azure', group(ordinary(type, { mods }), 'or')) as never);
      expect(r.ok, `${type} ${mods.join(' ')}`).toBe(false);
    }
  });

  it('draws each treatment on its hosts only; elsewhere it is a gap named for the host', () => {
    // on a host the builder doesn't draw yet (the canton sinister, C8b) only the host is a gap
    const tags = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
    for (const [mod, hosts] of Object.entries(MOD_HOSTS)) for (const type of hosts) expect(tags(treatedArms(type, [mod])), `${mod} ${type}`).toEqual(DRAWN_ORDINARIES.includes(type) ? [] : [`ordinary:${type}`]);
    expect(unsupportedIssues(treatedArms('fess', ['inverted'])).map((i) => `${i.gap.category}:${i.gap.detail}`)).toEqual(['ordinary-treatment:inverted-on-fess']);
    expect(unsupportedIssues(treatedArms('pale', ['enhanced'])).map((i) => `${i.gap.category}:${i.gap.detail}`)).toEqual(['ordinary-treatment:enhanced-on-pale']);
  });
});

describe('ordinary treatments: layout', () => {
  it('three charges between a chevron inverted: one inside, two below', () => {
    const d = nd(arms('gules', group(ordinary('chevron', { mods: ['inverted'] }), 'or'), group(charge('roundel'), 'argent', { count: 3 })));
    const ctx = { k: 'between', ordinary: spec('chevron', ['inverted']), peripheral: 'none', keepOut: [] } as const;
    const slots = contextSlots(ctx, 3, layoutOfKey('host', 3)!, 'heater');
    expect(slots).toHaveLength(3);
    const inner = geometryOf(spec('chevron', ['inverted'])).envelope.outer[0];
    const apex = Math.max(...inner.map(([, y]) => y));
    const [first, ...rest] = slots;
    expect(first.y).toBeLessThan(40);
    expect(Math.abs(first.x - 50)).toBeLessThan(1);
    for (const s of rest) expect(s.y).toBeGreaterThan(apex - 30);
    expect(rest[0].x).toBeLessThan(50);
    expect(rest[1].x).toBeGreaterThan(50);
    expect(blazon(d)).toBe('Gules, a chevron inverted Or between three roundels argent.');
  });

  it('charges on a couped, raised or turned ordinary lie on it in every shape', () => {
    for (const [type, mods, count] of [['fess', ['couped'], 3], ['fess', ['enhanced'], 3], ['chevron', ['inverted'], 3], ['bend', ['abased'], 2], ['cross', ['couped'], 5]] as const) {
      for (const shape of FIELD_SHAPES) {
        const s = spec(type, [...mods]);
        const slots = contextSlots({ k: 'on', ordinary: s, peripheral: 'none', keepOut: [] }, count, layoutOfKey('host', count)!, shape);
        expect(slots, `${count} on a ${type} ${mods.join(' ')} in a ${shape}`).toHaveLength(count);
        const rings = pathRings(geometryOf(s, shape).body);
        for (const slot of slots) expect(rings.some((r) => pointInPolygon(slot.x, slot.y, r)), `${type} ${mods.join(' ')} ${shape}`).toBe(true);
      }
    }
  });
});

describe('ordinary treatments: words and the builder', () => {
  it('words each treatment in house style: inverted before the line, the others after it', () => {
    expect(blazon(treatedArms('chevron', ['inverted']))).toBe('Azure, a chevron inverted Or.');
    expect(blazon(treatedArms('chevron', ['inverted'], { lines: { a: 'embattled' } }))).toBe('Azure, a chevron inverted embattled on the upper edge Or.');
    expect(blazon(treatedArms('saltire', ['couped'], { lines: { a: 'raguly' } }))).toBe('Azure, a saltire raguly couped Or.');
    expect(blazon(treatedArms('chevron', ['throughout'], { lines: { a: 'ploye' } }))).toBe('Azure, a chevron ployé throughout Or.');
    expect(blazon(nd(arms('or', group(ordinary('fess', { mods: ['enhanced'] }), 'azure'))))).toBe('Or, a fess enhanced azure.');
    expect(blazon(treatedArms('pile', ['inverted', 'throughout']))).toBe('Azure, a pile inverted throughout Or.');
    expect(gloss(treatedArms('cross', ['couped']))).toMatch(/shortened cross/);
    expect(gloss(treatedArms('chevron', ['inverted']))).toMatch(/V shape/);
    expect(gloss(treatedArms('fess', ['abased']))).toMatch(/lowered horizontal band/);
    expect(gloss(treatedArms('pile', ['throughout']))).toMatch(/reaching the edges/);
  });

  it('signs a treated ordinary with its treatments; a plain one as before', () => {
    expect(signature(treatedArms('chevron', ['inverted', 'couped']))).toContain('o.chevron+inverted+couped');
    expect(signature(treatedArms('chevron', []))).toContain('P:o.chevron:');
  });

  it('offers the toggles a band takes, blocks those that contradict, and moves a band up or down', () => {
    const chevron = treatedArms('chevron', []);
    // Hollow is shown on a solid band, blocked (SENA A3C); Thin is blocked while a treatment thin bands don't take is on (review U-9)
    expect(toggleChoices(chevron, [0]).map((c) => [c.value, c.allowed])).toEqual([['inverted', true], ['couped', true], ['throughout', true], ['voided', false], ['thin', true]]);
    const couped = setToggle(chevron, [0], 'couped', true);
    expect(toggleChoices(couped, [0]).find((c) => c.value === 'throughout')?.allowed).toBe(false);
    expect(toggleChoices(couped, [0]).find((c) => c.value === 'thin')).toMatchObject({ allowed: false, reason: "Thin bands can't be shortened: undo that first." });
    expect(toggleChoices(treatedArms('fess', []), [0]).map((c) => c.value)).toEqual(['couped', 'voided', 'thin']);
    // thin bands show their band's treatments they can't take, blocked, rather than dropping them from the row
    const bars = setToggle(treatedArms('fess', []), [0], 'thin', true);
    expect(toggleChoices(bars, [0]).map((c) => [c.value, c.allowed ? null : c.reason])).toEqual([['couped', "Thin bands can't be shortened: turn Thin off first."], ['thin', null]]);
    expect(bandPositionChoices(treatedArms('pale', []), [0])).toEqual([]);
    const raised = setBandPosition(chevron, [0], 'enhanced');
    expect(blazon(raised)).toBe('Azure, a chevron enhanced Or.');
    expect(bandPositionChoices(setToggle(chevron, [0], 'throughout', true), [0]).filter((c) => !c.allowed).map((c) => c.value)).toEqual(['enhanced', 'abased']);
    // enarched is drawn on an upright chevron only: turning an arched one over is blocked
    expect(toggleChoices(treatedArms('chevron', [], { lines: { a: 'enarched', b: 'enarched' } }), [0]).find((c) => c.value === 'inverted')?.allowed).toBe(false);
  });

  it('setOrdinary keeps a treatment the new band takes', () => {
    const fess: Design = treatedArms('fess', ['couped', 'enhanced']);
    const item = (d: Design) => groupAt(d, [0]).item;
    expect(item(setOrdinary(fess, 'bend'))).toMatchObject({ type: 'bend', mods: ['couped', 'enhanced'] });
    expect(item(setOrdinary(treatedArms('chevron', ['inverted']), 'fess'))).toMatchObject({ type: 'fess', mods: [] });
    expect(item(setOrdinary(treatedArms('chevron', ['inverted', 'throughout']), 'pile'))).toMatchObject({ type: 'pile', mods: ['inverted', 'throughout'] });
  });
});
