// The pall and the pall inverted, the fret, and the three charges that lie along an edge of the field — the label in chief, the mount and the
// trimount issuant from base (PLAN-C C10): their geometry on every shape, the charges set between a pall and on it, the rules (a voided or
// fimbriated pall, a cotised one refused, a fret that is a charge), conflict (pall against pall inverted, mount against trimount), the words
// and the builder's upside-down toggle, which turns a pall into a pall inverted.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, blazon, canonical, contextSlots, counterchangeUnavailable, defaultOrdinaryFrame, differences, explainDifferences, gloss, groupAt, layoutOfKey, ordinaryGeometry,
  pathRings, plainSpec, pointInPolygon, resolve, setToggle, shapeFrame, signature, structuralIssues, toggleChoices, toggledOn, unsupportedIssues, validate,
  type Design, type FieldShape, type LayoutContext, type OrdinarySpec, type OrdinaryType,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';

type Pt = [number, number];

const spec = (type: OrdinaryType, extra: Partial<OrdinarySpec> = {}): OrdinarySpec => ({ ...plainSpec(type), ...extra });
const geometryOf = (s: OrdinarySpec, shape: FieldShape) => ordinaryGeometry(s, defaultOrdinaryFrame(shape));
const rule = (d: Design, r: string) => structuralIssues(d).filter((i) => i.code === 'structure' && i.rule === r).map((i) => i.message);
const lone = (type: string, extra: object = {}, paint = 'or') => nd(arms('azure', group(ordinary(type, extra), paint)));

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

describe('pall, fret, label, mount, trimount: geometry', () => {
  const LINED = (type: OrdinaryType, line: 'wavy' | 'embattled' | 'engrailed'): OrdinarySpec => spec(type, { lines: { a: line, b: line } });

  it('every one is drawn inside the shield in every shape, plain, lined and voided where it takes them', () => {
    const specs: OrdinarySpec[] = [
      ...(['pall', 'pall-inverted', 'fret', 'label', 'mount', 'trimount'] as const).map((t) => spec(t)),
      ...(['pall', 'pall-inverted'] as const).flatMap((t) => [LINED(t, 'wavy'), LINED(t, 'embattled'), LINED(t, 'engrailed'), spec(t, { mods: ['voided'] }), spec(t, { fimbriated: true })]),
    ];
    for (const shape of FIELD_SHAPES) {
      const f = shapeFrame(shape);
      const outline = pathRings(f.outline)[0];
      for (const s of specs) {
        const g = geometryOf(s, shape);
        const where = `${shape} ${JSON.stringify(s)}`;
        expect(g.samples.length, where).toBeGreaterThan(30);
        for (const [x, y] of g.samples) expect(pointInPolygon(x, y, outline), where).toBe(true);
        expect(pointInPolygon(g.centre.x, g.centre.y, outline), where).toBe(true);
        expect(g.box.x0 >= f.box.x0 && g.box.x1 <= f.box.x1 && g.box.y0 >= f.box.y0 && g.box.y1 <= f.box.y1, where).toBe(true);
      }
    }
  });

  it("a pall's arms reach the edge of the shape at its chief corners in every shape; a pall inverted's reach it at the base, both meeting at the fess point", () => {
    for (const shape of FIELD_SHAPES) {
      const f = shapeFrame(shape);
      const outline = pathRings(f.outline)[0];
      const { x: cx, y: cy } = f.fessPoint;
      for (const type of ['pall', 'pall-inverted'] as const) {
        const { samples, centre } = geometryOf(spec(type), shape);
        expect(centre, `${shape} ${type}`).toEqual(f.fessPoint);
        const up = type === 'pall';
        // the arm that runs furthest toward the chief (the base) on each side ends at the shape's edge; the foot (the head) does too
        const far = (side: -1 | 1) => samples.filter(([x]) => side * (x - cx) > 8).reduce((a, p) => (up ? p[1] < a[1] : p[1] > a[1]) ? p : a);
        for (const side of [-1, 1] as const) expect(edgeDistance(outline, ...far(side)), `${shape} ${type} ${side}`).toBeLessThan(6);
        const stem = samples.filter(([x]) => Math.abs(x - cx) < 6).reduce((a, p) => ((up ? p[1] > a[1] : p[1] < a[1]) ? p : a));
        expect(edgeDistance(outline, ...stem), `${shape} ${type} stem`).toBeLessThan(6);
        // the arms meet at the middle: it lies on the pall
        expect(samples.some(([x, y]) => Math.hypot(x - cx, y - cy) < 5), `${shape} ${type} middle`).toBe(true);
      }
    }
  });

  it('a pall inverted is the pall turned over about the fess point', () => {
    for (const shape of [...FIELD_SHAPES]) {
      const { x: cx, y: cy } = shapeFrame(shape).fessPoint;
      const pall = geometryOf(spec('pall'), shape), turned = geometryOf(spec('pall-inverted'), shape);
      const ring = pathRings(turned.body)[0];
      // whatever of the pall's samples lie inside the shape once turned lie on the pall inverted
      const shown = pall.samples.map(([x, y]): Pt => [x, 2 * cy - y]).filter(([, y]) => y > 3 && y < 117 && shapeFrame(shape).outline.length > 0);
      const inside = shown.filter(([x, y]) => pointInPolygon(x, y, pathRings(shapeFrame(shape).outline)[0]));
      const covered = inside.filter(([x, y]) => pointInPolygon(x, y, ring)).length;
      expect(covered / inside.length, shape).toBeGreaterThan(0.9);
      expect(Math.abs(turned.centre.x - cx), shape).toBe(0);
    }
  });

  it('a lined pall draws the line on every edge of its three arms, and the voided one keeps its outline', () => {
    for (const shape of FIELD_SHAPES) {
      const plain = geometryOf(spec('pall'), shape), wavy = geometryOf(LINED('pall', 'wavy'), shape), hollow = geometryOf(spec('pall', { mods: ['voided'] }), shape);
      expect(wavy.body).not.toEqual(plain.body);
      expect(wavy.body.match(/C/g)?.length ?? 0, shape).toBeGreaterThan(10);
      expect(hollow.fillRule).toBe('evenodd');
      expect(pathRings(hollow.body).length, shape).toBe(2);
      // the voiding leaves a border: fewer samples than the solid pall
      expect(hollow.samples.length).toBeLessThan(plain.samples.length);
    }
  });

  it('the label is a bar across the chief with three pendants; the mount one hill, the trimount three, in the lower part of the shape', () => {
    for (const shape of FIELD_SHAPES) {
      const f = shapeFrame(shape);
      const label = geometryOf(spec('label'), shape).samples;
      // above the foot of the chief's third: nothing of it lies in the lower half of the shield
      expect(Math.max(...label.map(([, y]) => y)), shape).toBeLessThan(f.box.y0 + 0.6 * (f.box.y1 - f.box.y0));
      // the pendants: below the bar, in three groups side by side
      const bar = Math.min(...label.map(([, y]) => y)) + 10;
      const xs = label.filter(([, y]) => y > bar).map(([x]) => x).sort((a, b) => a - b);
      const groups = xs.reduce((n, x, i) => (i > 0 && x - xs[i - 1] > 8 ? n + 1 : n), xs.length ? 1 : 0);
      expect(groups, `${shape} pendants`).toBe(3);
      for (const type of ['mount', 'trimount'] as const) {
        const hill = geometryOf(spec(type), shape).samples;
        expect(Math.min(...hill.map(([, y]) => y)), `${shape} ${type}`).toBeGreaterThan(f.box.y0 + 0.55 * (f.box.y1 - f.box.y0));
      }
      // the trimount has three tops: the highest point on each side of the middle is lower than the middle's
      const top = (samples: readonly Pt[], lo: number, hi: number) => Math.min(...samples.filter(([x]) => x >= lo && x <= hi).map(([, y]) => y));
      const tri = geometryOf(spec('trimount'), shape).samples, mount = geometryOf(spec('mount'), shape).samples;
      expect(top(tri, 40, 60), shape).toBeLessThan(top(tri, 8, 24));
      expect(top(tri, 40, 60), shape).toBeLessThan(top(tri, 76, 92));
      expect(top(mount, 40, 60), shape).toBeLessThan(top(mount, 10, 24));
    }
  });

  it('the fret is a mascle woven with a bendlet and a bendlet sinister: pieces that never overlap, a hole in the middle of the mascle', () => {
    for (const shape of FIELD_SHAPES) {
      const g = geometryOf(spec('fret'), shape);
      const rings = pathRings(g.body);
      expect(rings.length, shape).toBeGreaterThanOrEqual(10);
      const { x: cx, y: cy } = shapeFrame(shape).fessPoint;
      let overlaps = 0;
      for (let x = 0; x <= 100; x += 2) for (let y = 0; y <= 120; y += 2) if (rings.filter((r) => pointInPolygon(x, y, r)).length > 1) overlaps++;
      expect(overlaps, `${shape} pieces overlap`).toBe(0);
      const covered = (x: number, y: number) => rings.some((r) => pointInPolygon(x, y, r));
      expect(covered(cx, cy), `${shape} middle`).toBe(true);
      expect(covered(cx, cy - 14), `${shape} the mascle's hole`).toBe(false);
      // throughout: the bendlets reach the edge of the shield on every diagonal
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) expect(covered(cx + dx * 30, cy + dy * 30), `${shape} ${dx},${dy}`).toBe(true);
    }
  });
});

describe('pall, fret, label, mount, trimount: where charges stand', () => {
  const between = (type: 'pall' | 'pall-inverted'): LayoutContext => ({ k: 'between', ordinary: spec(type), peripheral: 'none', keepOut: [] });
  const on = (type: 'pall' | 'pall-inverted'): LayoutContext => ({ k: 'on', ordinary: spec(type), peripheral: 'none', keepOut: [] });
  const slotsOf = (ctx: LayoutContext, count: number, shape: FieldShape) => contextSlots(ctx, count, layoutOfKey('host', count)!, shape);
  const disc = (s: { x: number; y: number; size: number }) => Array.from({ length: 12 }, (_, i): Pt => [s.x + (s.size / 2) * Math.cos((i * Math.PI) / 6), s.y + (s.size / 2) * Math.sin((i * Math.PI) / 6)]);

  it('three between a pall stand one in each section — between the chief arms and either side of the foot — clear of it; inverted, turned over', () => {
    for (const shape of FIELD_SHAPES) {
      for (const type of ['pall', 'pall-inverted'] as const) {
        const slots = slotsOf(between(type), 3, shape);
        const where = `${shape} ${type}`;
        expect(slots.length, where).toBe(3);
        expect(new Set(slots.map((s) => s.size)).size, where).toBe(1);
        expect(slots[0].size, where).toBeGreaterThan(shape === 'lozenge' ? 6 : 18);
        const { x: cx, y: cy } = shapeFrame(shape).fessPoint;
        const ring = pathRings(geometryOf(spec(type), shape).body)[0];
        for (const s of slots) for (const [x, y] of disc(s)) expect(pointInPolygon(x, y, ring), `${where} ${JSON.stringify(s)}`).toBe(false);
        // one in the section between the two arms, on the axis; one each side of the foot
        const mid = slots.filter((s) => Math.abs(s.x - cx) < 1);
        expect(mid.length, where).toBe(1);
        expect(type === 'pall' ? mid[0].y < cy : mid[0].y > cy, where).toBe(true);
        expect(slots.filter((s) => s.x < cx - 5).length, where).toBe(1);
        expect(slots.filter((s) => s.x > cx + 5).length, where).toBe(1);
      }
    }
  });

  it('one charge on a pall stands where the arms meet; three stand one on each arm, turned to follow it', () => {
    for (const shape of FIELD_SHAPES) {
      const { x: cx, y: cy } = shapeFrame(shape).fessPoint;
      for (const type of ['pall', 'pall-inverted'] as const) {
        const where = `${shape} ${type}`;
        const ring = pathRings(geometryOf(spec(type), shape).body)[0];
        const [one] = slotsOf(on(type), 1, shape);
        expect(Math.hypot(one.x - cx, one.y - cy), where).toBeLessThan(1);
        const three = slotsOf(on(type), 3, shape);
        expect(three.length, where).toBe(3);
        for (const s of three) expect(pointInPolygon(s.x, s.y, ring), `${where} ${JSON.stringify(s)}`).toBe(true);
        expect(three.filter((s) => s.x < cx - 5).length, where).toBe(1);
        expect(three.filter((s) => s.x > cx + 5).length, where).toBe(1);
        expect(three.filter((s) => Math.abs(s.x - cx) < 1).length, where).toBe(1);
        // the arms run like a bend and a bend sinister (the pall inverted's the other way); the foot stays upright
        const turns = three.map((s) => Math.round(s.rotation)).sort((a, b) => a - b);
        expect(turns, where).toEqual([-45, 0, 45]);
        const left = three.find((s) => s.x < cx - 5)!;
        expect(left.rotation, where).toBe(type === 'pall' ? -45 : 45);
      }
    }
  });

  it('a pall carries one or three; between it only three; the counts a fret, label, mount and trimount take are gaps named for the count', () => {
    const tags = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
    const between3 = (type: string, n: number) => nd(arms('argent', group(ordinary(type), 'gules'), group(charge('roundel'), 'or', { count: n, relation: 'between' })));
    expect(tags(between3('pall', 3))).toEqual([]);
    expect(tags(between3('pall-inverted', 3))).toEqual([]);
    expect(tags(between3('pall', 2))).toEqual(['placement:between-pall-2']);
    expect(tags(between3('fret', 4))).toEqual(['placement:between-fret-4']);
    const onPall = (n: number) => nd(arms('argent', { ...group(ordinary('pall'), 'azure'), charged: [group(charge('mullet'), 'or', { count: n })] }));
    expect(tags(onPall(1))).toEqual([]);
    expect(tags(onPall(3))).toEqual([]);
    expect(tags(onPall(2))).toEqual(['placement:on-pall-2']);
    expect(tags(nd(arms('argent', { ...group(ordinary('mount'), 'vert'), charged: [group(charge('mullet'), 'or')] })))).toEqual(['multiple-groups:tertiary-on-mount']);
  });
});

describe('pall, fret, label, mount, trimount: rules and roles', () => {
  it('the label, mount and trimount stand as peripherals beside a picture and alone; the pall and the fret are the main band', () => {
    const roles = (d: Design) => d.groups.map((g) => g.role);
    expect(roles(lone('pall'))).toEqual(['primary']);
    expect(roles(lone('fret'))).toEqual(['primary']);
    for (const type of ['label', 'mount', 'trimount']) {
      expect(roles(lone(type)), type).toEqual(['peripheral']);
      expect(roles(nd(arms('azure', group(charge('lion'), 'or'), group(ordinary(type), 'argent')))), type).toEqual(['primary', 'peripheral']);
    }
  });

  it('a pall may be voided or fimbriated; a fret may not; a pall may not be cotised, and none of them is a chief or border', () => {
    const treatment = (d: Design) => rule(d, 'ordinary-treatment');
    expect(treatment(lone('pall', { mods: ['voided'] }))).toEqual([]);
    expect(treatment(lone('pall-inverted', { mods: ['voided'] }))).toEqual([]);
    expect(treatment(lone('pall', { fimbriated: 'argent' }))).toEqual([]);
    expect(treatment(lone('pall', { mods: ['inverted'], fimbriated: 'argent' }))).toEqual([]);
    expect(treatment(lone('fret', { mods: ['voided'] }))[0]).toMatch(/^A fret can't be voided: only a cross, a saltire or a pall/);
    expect(treatment(lone('fret', { fimbriated: 'argent' }))[0]).toMatch(/^A fret can't be fimbriated/);
    expect(treatment(lone('pall', { cotised: { count: 1, paint: 'argent' } }))[0]).toMatch(/^A pall can't be cotised/);
    expect(treatment(lone('pall', { mods: ['voided'], fimbriated: 'argent' }))[0]).toMatch(/both voided and fimbriated/);
  });

  it('a pall with the upside-down treatment is the pall inverted: one design', () => {
    expect(canonical(lone('pall', { mods: ['inverted'] }))).toEqual(lone('pall-inverted'));
    expect(groupAt(lone('pall', { mods: ['inverted'] }), [0]).item).toMatchObject({ type: 'pall-inverted', mods: [] });
  });

  it("a fret is a charge as the rule of counterchange has it: it can't be counterchanged over an ordinary, nor over stripes", () => {
    const field = div('per-pale', 'argent', 'azure');
    expect(counterchangeUnavailable(nd(arms(field, group(ordinary('fret'), 'counterchanged'))), [0])).toBeNull();
    const over = nd(arms(field, group(ordinary('pale'), 'or'), group(ordinary('fret'), 'counterchanged', { role: 'overall' })));
    expect(counterchangeUnavailable(over, [1])).toMatch(/A fret can't be counterchanged over a pale.*CC-8/);
    expect(validate(over).map((i) => i.message).join(' ')).toMatch(/CC-8/);
    const barry = { k: 'variation', variation: 'barry', pieces: 6, parts: ['or', 'azure'] };
    expect(counterchangeUnavailable(nd(arms(barry, group(ordinary('fret'), 'counterchanged'))), [0])).toMatch(/fret can't be counterchanged over stripes or a grid.*CC-3/);
  });

  it('a label, mount or trimount takes no line, and none is shortened; a label of five points and the label overall are not drawn', () => {
    const tags = (d: Design) => unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`);
    expect(tags(lone('trimount', { mods: ['couped'] }))).toEqual(['ordinary-treatment:couped-on-trimount']);
    expect(tags(nd(arms('azure', group(charge('lion'), 'or'), group(ordinary('label'), 'argent', { role: 'overall' }))))).toEqual(['placement:overall-label']);
    // a line on one is not even a design (it takes none)
    expect(resolve(arms('azure', group(charge('lion'), 'or'), group(ordinary('label', { lines: { a: 'wavy' } }), 'argent')) as never).ok).toBe(false);
  });

  it('a mount and a trimount keep charges out of their hills, as a base does', () => {
    for (const type of ['mount', 'trimount', 'label'] as const) {
      const d = nd(arms('azure', group(charge('lion'), 'or'), group(ordinary(type), 'argent')));
      const g = geometryOf(spec(type), 'heater');
      for (const shape of FIELD_SHAPES) {
        const slots = contextSlots({ k: 'field', peripheral: 'none', keepOut: [spec(type)], yields: 'none', share: null }, 1, layoutOfKey('single', 1)!, shape);
        expect(slots.length, `${shape} ${type}`).toBe(1);
        const ring = pathRings(geometryOf(spec(type), shape).body)[0];
        const [s] = slots;
        for (let i = 0; i < 12; i++) expect(pointInPolygon(s.x + (s.size / 2) * Math.cos((i * Math.PI) / 6), s.y + (s.size / 2) * Math.sin((i * Math.PI) / 6), ring), `${shape} ${type}`).toBe(false);
      }
      expect(validate(d).filter((i) => i.code !== 'tincture'), type).toEqual([]);
      expect(g.samples.length).toBeGreaterThan(0);
    }
  });
});

describe('pall, fret, label, mount, trimount: conflict, words and signature', () => {
  const tally = (a: Design, b: Design) => differences(a, b).map((x) => `${x.kind}:${x.attr}:${x.rule}`);
  const primary = (type: string) => nd(arms('azure', group(ordinary(type), 'or')));
  const beside = (type: string) => nd(arms('argent', group(charge('lion'), 'gules'), group(ordinary(type), 'azure')));

  it('a pall against a pall inverted is a substantial change of type (A5E5c); a mount against a trimount one distinct change; a label against nothing a group', () => {
    expect(tally(primary('pall'), primary('pall-inverted'))).toEqual(['sc:type:A5E2']);
    expect(tally(beside('mount'), beside('trimount'))).toEqual(['dc:type:A5G4']);
    expect(tally(nd(arms('argent', group(charge('lion'), 'gules'))), beside('label'))).toEqual(['dc:group-presence:A5G2']);
    expect(explainDifferences(primary('pall'), primary('pall-inverted')).map((n) => n.text).join(' ')).toMatch(/pall/);
  });

  it('a pall with a line against a plain one is a distinct change of its type (A5G4)', () => {
    expect(tally(primary('pall'), lone('pall', { lines: { a: 'wavy' } }))).toEqual(['dc:type:A5G4']);
  });

  it('is worded in the house style, and glossed in everyday words', () => {
    expect(blazon(primary('pall'))).toBe('Azure, a pall Or.');
    expect(blazon(primary('pall-inverted'))).toBe('Azure, a pall inverted Or.');
    expect(blazon(lone('pall-inverted', { lines: { a: 'bretessed' } }, 'argent'))).toBe('Azure, a pall inverted bretessed argent.');
    expect(blazon(lone('pall', { mods: ['voided'] }, 'sable'))).toBe('Azure, a pall voided sable.');
    expect(blazon(lone('fret', {}, 'or'))).toBe('Azure, a fret Or.');
    expect(blazon(lone('label', {}, 'argent'))).toBe('Azure, a label argent.');
    expect(blazon(lone('mount', {}, 'vert'))).toBe('Azure, a mount vert.');
    expect(blazon(lone('trimount', {}, 'vert'))).toBe('Azure, a trimount vert.');
    expect(blazon(beside('label'))).toBe('Argent, a lion gules, a label azure.');
    expect(blazon(beside('mount'))).toBe('Argent, a lion gules and a mount azure.');
    expect(blazon(nd(arms('argent', group(ordinary('pall'), 'gules'), group(charge('roundel'), 'azure', { count: 3, relation: 'between' }))))).toBe('Argent, a pall gules between three roundels azure.');
    expect(gloss(primary('pall'))).toMatch(/Y-shaped band/);
    expect(gloss(primary('pall-inverted'))).toMatch(/upside-down Y-shaped band/);
    expect(gloss(primary('trimount'))).toMatch(/three hills/);
    expect(gloss(primary('label'))).toMatch(/hanging tabs/);
  });

  it('keeps every one apart in the signature', () => {
    const sigs = ['pall', 'pall-inverted', 'fret', 'label', 'mount', 'trimount'].map((t) => signature(primary(t)));
    expect(new Set(sigs).size).toBe(6);
    expect(signature(lone('pall', { lines: { a: 'wavy' } }))).not.toEqual(signature(lone('pall')));
  });
});

describe('the upside-down toggle turns a pall into a pall inverted', () => {
  it('is offered on both, on when the pall is inverted, and swaps the type (keeping a line both can carry)', () => {
    const pall = lone('pall', { lines: { a: 'embattled' } });
    expect(toggleChoices(pall, [0]).find((c) => c.value === 'inverted')).toMatchObject({ allowed: true });
    expect(toggledOn(pall, [0], 'inverted')).toBe(false);
    const turned = setToggle(pall, [0], 'inverted', true);
    expect(groupAt(turned, [0]).item).toMatchObject({ type: 'pall-inverted', mods: [], lines: { a: 'embattled', b: 'embattled' } });
    expect(toggledOn(turned, [0], 'inverted')).toBe(true);
    expect(setToggle(turned, [0], 'inverted', true)).toBe(turned);
    const back = setToggle(turned, [0], 'inverted', false);
    expect(groupAt(back, [0]).item).toMatchObject({ type: 'pall', mods: [] });
    expect(canonical(back)).toEqual(canonical(pall));
    expect(toggleChoices(lone('pall'), [0]).map((c) => c.value)).toEqual(['inverted', 'voided']);
  });
});
