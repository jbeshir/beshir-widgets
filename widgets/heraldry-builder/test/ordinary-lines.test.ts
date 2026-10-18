// Lines of partition on the edges of the ten drawn ordinaries: a band's two edges share their periods (in phase
// or opposed as the line's profile pairs them), a band with a complex line is drawn wider, arms and limbs carry the
// line from where they meet, a bordure's line runs round its inner edge; the rules (one line per ordinary, jagged
// lines on both edges, dancetty on two-sided bands, one step from core practice), the conflict check (A5G4), the
// words and the signature, called on resolved designs (the builder's edge rows are test/builder-edges.test.ts).

import { describe, expect, it } from 'vitest';
import {
  BUILDER_ORDINARIES, DRAWN_LINES, FIELD_SHAPES, blazon, contextSlots, lineChoices, coreSteps, defaultOrdinaryFrame, differences, explainDifferences, gloss, hostCounts,
  layoutOfKey, lineAllowed, ordinaryGeometry, pathPolygon, pathRings, plainSpec, pointInPolygon, shapeFrame, signature, structuralIssues, tinctureIssues,
  type ComplexLine, type FieldShape, type OrdinarySpec, type OrdinaryType, type Slot,
} from '../src/lib/heraldry';
import type { Lines } from '../src/lib/heraldry/design';
import { arms, charge, group, nd, ordinary } from './helpers';
import { rotatesIn, sampleSeed } from './rotation';

type Pt = [number, number];

const spec = (type: OrdinaryType, lines: Lines): OrdinarySpec => ({ ...plainSpec(type), lines });
const geometryOf = (type: OrdinaryType, lines: Lines, shape: FieldShape = 'heater') => ordinaryGeometry(spec(type, lines), defaultOrdinaryFrame(shape));
const both = (l: ComplexLine): Lines => ({ a: l, b: l });
const allowed = (type: OrdinaryType, line: ComplexLine) => lineAllowed({ k: 'ordinary', type, inverted: false }, line);
const BANDS: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron'];

/** Where the vertical through x crosses the body's rings: the lowest and highest y. */
function extentAt(body: string, x: number): [number, number] {
  const ys: number[] = [];
  for (const ring of pathRings(body)) {
    ring.forEach(([ax, ay], i) => {
      const [bx, by] = ring[(i + 1) % ring.length];
      if ((ax - x) * (bx - x) < 0) ys.push(ay + ((by - ay) * (x - ax)) / (bx - ax));
    });
  }
  return [Math.min(...ys), Math.max(...ys)];
}

/** Whether a point lies within `tol` of any edge of the rings. */
function nearAnEdge(rings: readonly Pt[][], [x, y]: Pt, tol: number): boolean {
  return rings.some((r) => r.some(([ax, ay], i) => {
    const [bx, by] = r[(i + 1) % r.length];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= tol;
  }));
}
const inRings = (rings: readonly Pt[][], [x, y]: Pt) => rings.filter((r) => pointInPolygon(x, y, r)).length % 2 === 1;

/** Sample abscissae across the heater's fess, clear of the square lines' steps (their periods are whole numbers of steps apart). */
const ACROSS = Array.from({ length: 40 }, (_, i) => 10.37 + i * 2.003);

describe('drawing a line on an ordinary', () => {
  it('a band with a complex edge is 20 % wider and its two edges align', () => {
    // A plain fess on the heater runs from 35 to 65; with a line it is 36 wide about the same middle.
    expect(extentAt(geometryOf('fess', { a: 'plain', b: 'plain' }).body, 50)).toEqual([35, 65]);
    const counter = geometryOf('fess', both('embattled')).body;
    const tops = ACROSS.map((x) => extentAt(counter, x)[0]);
    expect(new Set(tops.map((y) => Math.round(y))).size).toBe(2);
    expect(Math.min(...tops) + Math.max(...tops)).toBeCloseTo(2 * 32, 1);
    // Enarched and ployé bow a band: they don't widen it.
    const arched = geometryOf('fess', both('enarched')).body;
    expect(extentAt(arched, 0.5)[1] - extentAt(arched, 0.5)[0]).toBeCloseTo(30, 0);
    // The two edges of every band carry their periods at the same places: the lower edge's features sit under the upper's.
    for (const line of ['wavy', 'indented', 'nebuly', 'dancetty'] as const) {
      const body = geometryOf('fess', both(line)).body;
      const widths = ACROSS.map((x) => { const [top, bottom] = extentAt(body, x); return bottom - top; });
      if (line === 'indented') expect(Math.max(...widths) - Math.min(...widths), line).toBeGreaterThan(10);
      else expect(Math.max(...widths) - Math.min(...widths), line).toBeLessThan(line === 'nebuly' ? 12 : 0.5);
    }
  });

  it('counter-embattled merlons sit over crenels, bretessed merlons over merlons', () => {
    const extents = (lines: Lines) => ACROSS.map((x) => extentAt(geometryOf('fess', lines).body, x));
    // Counter-embattled: the band steps up and down and keeps its width (36).
    for (const [top, bottom] of extents(both('embattled'))) expect(bottom - top).toBeCloseTo(36, 1);
    // Bretessed: the merlons stand out of both edges at once, so the band is 36 between them and 36 + 2 × 8 across them.
    const bretessed = extents(both('bretessed')).map(([top, bottom]) => Math.round(bottom - top));
    expect(new Set(bretessed)).toEqual(new Set([36, 52]));
  });

  it('a one-edge line leaves the other edge straight', () => {
    const lower = geometryOf('fess', { a: 'plain', b: 'wavy' }).body;
    const upper = geometryOf('fess', { a: 'embattled', b: 'plain' }).body;
    for (const x of ACROSS) {
      expect(extentAt(lower, x)[0]).toBeCloseTo(32, 5);
      expect(extentAt(upper, x)[1]).toBeCloseTo(68, 5);
    }
    expect(new Set(ACROSS.map((x) => Math.round(extentAt(lower, x)[1]))).size).toBeGreaterThan(4);
  });

  it('cross and saltire arms carry the line symmetrically', () => {
    // A mirrored line (indented, engrailed, bretessed) gives a cross and a saltire that mirror about the pale line.
    for (const type of ['cross', 'saltire'] as const) {
      for (const line of ['indented', 'engrailed', 'bretessed'] as const) {
        const ring = pathRings(geometryOf(type, both(line)).body)[0];
        const shown = ring.filter(([x, y]) => pointInPolygon(x, y, pathPolygon(shapeFrame('heater').outline)));
        const unmatched = shown.filter(([x, y]) => !ring.some(([u, v]) => Math.abs(u - (100 - x)) < 0.02 && Math.abs(v - y) < 0.02));
        expect(unmatched, `${type} ${line}`).toEqual([]);
      }
    }
    // Every arm shows the line: the cross's four arms each carry features on both their edges.
    const wavy = pathRings(geometryOf('cross', both('wavy')).body)[0];
    const off = (pred: (p: Pt) => boolean) => wavy.filter((p) => pred(p)).length;
    expect(off(([x, y]) => y < 30 && Math.abs(Math.abs(x - 50) - 14.4) > 0.5)).toBeGreaterThan(5);
    expect(off(([x, y]) => x > 70 && Math.abs(Math.abs(y - 50) - 14.4) > 0.5)).toBeGreaterThan(5);
    expect(off(([x, y]) => y > 70 && y < 100 && Math.abs(Math.abs(x - 50) - 14.4) > 0.5)).toBeGreaterThan(5);
    expect(off(([x, y]) => x < 30 && Math.abs(Math.abs(y - 50) - 14.4) > 0.5)).toBeGreaterThan(5);
  });

  it("a bordure's line follows the inset in every shape, its features toward the field", () => {
    for (const shape of FIELD_SHAPES) {
      const inset = pathPolygon(shapeFrame(shape).inset);
      for (const line of DRAWN_LINES.filter((l) => allowed('bordure', l))) {
        const [, inner] = pathRings(geometryOf('bordure', both(line), shape).body);
        const plain = pathRings(geometryOf('bordure', { a: 'plain', b: 'plain' }, shape).body)[1];
        expect(inner.length, `${shape} ${line}`).toBeGreaterThan(plain.length);
        // Within the line's depth (half the bordure's width) of the inset all the way round.
        for (const p of inner) expect(nearAnEdge([inset], p, 5.05), `${shape} ${line} ${p}`).toBe(true);
        // Indented teeth point into the field; engrailed arcs bite into the bordure (their points toward the field).
        if (line === 'indented') expect(inner.every((p) => pointInPolygon(p[0], p[1], inset) || nearAnEdge([inset], p, 0.05)), shape).toBe(true);
        if (line === 'engrailed') expect(inner.every((p) => !pointInPolygon(p[0], p[1], inset) || nearAnEdge([inset], p, 0.05)), shape).toBe(true);
      }
    }
  });

  it('every allowed line on every drawn ordinary is drawn within its outer envelope and covers its inner one (a rotating half on the heater)', () => {
    let k = 0;
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const type of BUILDER_ORDINARIES) {
        for (const line of DRAWN_LINES.filter((l) => allowed(type, l))) {
          // A seeded rotating half of the pairs on the heater (`rotatesIn`; SCA_FULL=1 for all); a third in turn elsewhere.
          if (shape === 'heater' ? !rotatesIn(`${type}|${line}`, 1 / 2) : k++ % 3 !== FIELD_SHAPES.indexOf(shape) - 1) continue;
          const where = `${shape} ${type} ${line} (sample seed ${sampleSeed()})`;
          const g = geometryOf(type, both(line), shape);
          const body = pathRings(g.body);
          expect(g.body, where).not.toBe(geometryOf(type, { a: 'plain', b: 'plain' }, shape).body);
          for (const p of body.flat()) {
            if (!pointInPolygon(p[0], p[1], outline)) continue;
            expect(inRings(g.envelope.outer, p) || nearAnEdge(g.envelope.outer, p, 0.05), `${where}: ${p} out of its envelope`).toBe(true);
          }
          for (const p of g.envelope.inner.flat()) {
            if (!pointInPolygon(p[0], p[1], outline)) continue;
            expect(inRings(body, p) || nearAnEdge(body, p, 0.05), `${where}: ${p} not on the body`).toBe(true);
          }
          expect(g.samples.length, where).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('charges around and on a lined ordinary', () => {
  /** Points round a slot's glyph disc (radius 0.4 of its box). */
  const disc = (s: Slot): Pt[] => [[s.x, s.y], ...Array.from({ length: 16 }, (_, k): Pt => [s.x + 0.4 * s.size * Math.cos((k * Math.PI) / 8), s.y + 0.4 * s.size * Math.sin((k * Math.PI) / 8)])];

  it('charges between a fess embattled keep clear of the merlons; charges on a bend wavy stay inside it', () => {
    const embattled = spec('fess', { a: 'embattled', b: 'plain' }), wavy = spec('bend', both('wavy'));
    for (const shape of FIELD_SHAPES) {
      const merlons = pathRings(ordinaryGeometry(embattled, defaultOrdinaryFrame(shape)).body);
      for (const s of contextSlots({ k: 'between', ordinary: embattled, peripheral: 'none', keepOut: [] }, 2, layoutOfKey('host', 2)!, shape)) {
        for (const p of disc(s)) expect(inRings(merlons, p), `${shape} ${JSON.stringify(s)}`).toBe(false);
      }
      const bend = pathRings(ordinaryGeometry(wavy, defaultOrdinaryFrame(shape)).body);
      const slots = contextSlots({ k: 'on', ordinary: wavy, peripheral: 'none', keepOut: [] }, 3, layoutOfKey('host', 3)!, shape);
      expect(slots, shape).toHaveLength(3);
      for (const s of slots) for (const p of disc(s)) expect(inRings(bend, p), `${shape} ${JSON.stringify(s)}`).toBe(true);
    }
  });

  it('around and on every lined ordinary, counts 1–3 keep off and on the drawn body (a rotating half on the heater, a fifth elsewhere)', () => {
    let k = 0;
    const problems: string[] = [];
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const type of BUILDER_ORDINARIES) {
        for (const line of DRAWN_LINES.filter((l) => allowed(type, l))) {
          for (const kind of ['between', 'on'] as const) {
            if (kind === 'between' && (type === 'chief' || type === 'bordure')) continue;
            if (shape === 'heater' ? !rotatesIn(`${kind}|${type}|${line}`, 1 / 2) : k++ % 5 !== FIELD_SHAPES.indexOf(shape)) continue;
            const s = spec(type, both(line));
            const body = pathRings(ordinaryGeometry(s, defaultOrdinaryFrame(shape)).body);
            // Three charges on a chevron enarched: its bowed limbs leave the straight limbs' places — no room (a capacity issue, PROGRESS-C C5a).
            for (const count of hostCounts(kind, s).filter((n) => n <= 3 && !(kind === 'on' && type === 'chevron' && line === 'enarched' && n === 3))) {
              const slots = contextSlots({ k: kind, ordinary: s, peripheral: 'none', keepOut: [] }, count, layoutOfKey('host', count)!, shape);
              const where = `${shape} ${kind} ${type} ${line} ${count}`;
              if (slots.length !== count) { problems.push(`${where}: ${slots.length} slots`); continue; }
              for (const slot of slots) {
                for (const p of disc(slot)) {
                  if (!pointInPolygon(p[0], p[1], outline)) problems.push(`${where}: off the shield`);
                  else if (inRings(body, p) !== (kind === 'on')) problems.push(`${where}: ${kind === 'on' ? 'off' : 'on'} the ${type}`);
                }
              }
            }
          }
        }
      }
    }
    expect([...new Set(problems)].slice(0, 20), `sample seed ${sampleSeed()}`).toEqual([]);
  });
});

const ord = (type: string, paint: string, lines: object | null = null, extra: object = {}) => group(ordinary(type, lines ? { lines } : {}), paint, extra);
const lineIssues = (input: unknown) => structuralIssues(nd(input)).filter((i) => i.code === 'structure' && i.rule === 'line').map((i) => i.message);

describe('the rules for lines on ordinaries', () => {
  it('two different complex lines on one ordinary are refused', () => {
    expect(lineIssues(arms('argent', ord('fess', 'gules', { a: 'wavy', b: 'embattled' })))).toEqual([
      "A fess carries one line: it can't be wavy on one edge and embattled on the other.",
    ]);
    expect(lineIssues(arms('argent', ord('fess', 'gules', { a: 'embattled', b: 'embattled' })))).toEqual([]);
  });

  it('dancetty on a chief is refused; a two-sided band takes it', () => {
    expect(lineIssues(arms('argent', ord('chief', 'gules', { a: 'dancetty' })))).toEqual(['Dancetty is for two-sided bands; a chief is drawn indented.']);
    expect(lineIssues(arms('argent', ord('cross', 'gules', { a: 'dancetty' })))).toHaveLength(1);
    expect(lineIssues(arms('argent', ord('fess', 'gules', { a: 'dancetty' })))).toEqual([]);
    expect(lineIssues(arms('argent', ord('pale', 'gules', { a: 'enarched' })))).toEqual(['An arched (enarched) line is drawn on a fess, a bend, a chevron or a chief only — not a pale.']);
  });

  it('a fess indented on one edge only is refused', () => {
    expect(lineIssues(arms('argent', ord('fess', 'gules', { a: 'indented', b: 'plain' })))).toEqual([
      "A fess can't be indented on one edge only — draw both edges indented (RULES-C §A.5, L5, after an example in SENA A3D1c).",
    ]);
    expect(lineIssues(arms('argent', ord('bend', 'gules', { a: 'plain', b: 'engrailed' })))).toHaveLength(1);
    // Embattled is a band's upper edge alone by default, and may be its lower edge alone.
    expect(lineIssues(arms('argent', ord('fess', 'gules', { a: 'plain', b: 'embattled' })))).toEqual([]);
  });

  it('two steps from core practice are refused, one is not', () => {
    const fess = ord('fess', 'gules', { a: 'wavy', b: 'plain' });
    const one = nd(arms('argent', fess));
    expect(coreSteps(one)).toEqual(['one-edge-line']);
    expect(structuralIssues(one)).toEqual([]);
    const two = nd(arms('argent', ord('pale', 'gules', { a: 'plain', b: 'raguly' }), group(ordinary('bend', { lines: { a: 'wavy', b: 'plain' } }), 'or', { role: 'overall' })));
    expect(coreSteps(two)).toEqual(['one-edge-line', 'one-edge-line']);
    expect(structuralIssues(two).filter((i) => i.code === 'structure' && i.rule === 'core-practice').map((i) => i.message)).toEqual([
      'This design is two steps from core practice (a line on one edge of a band only, a line on one edge of a band only); SENA allows one (A2B, App G).',
    ]);
    // Embattled on either edge alone is no step.
    expect(coreSteps(nd(arms('argent', ord('fess', 'gules', { a: 'plain', b: 'embattled' }))))).toEqual([]);
  });

  it('a compass star is one step from core practice: alone it is allowed, with another step refused (App G "Compass star")', () => {
    const star = group(charge('compass-star'), 'or');
    const alone = nd(arms('azure', star));
    expect(coreSteps(alone)).toEqual(['compass-star']);
    expect(structuralIssues(alone)).toEqual([]);
    const withLine = nd(arms('argent', ord('fess', 'gules', { a: 'wavy', b: 'plain' }), group(charge('compass-star'), 'or', { count: 2 })));
    expect(coreSteps(withLine)).toEqual(['one-edge-line', 'compass-star']);
    expect(structuralIssues(withLine).filter((i) => i.code === 'structure' && i.rule === 'core-practice').map((i) => i.message)).toEqual([
      'This design is two steps from core practice (a line on one edge of a band only, a compass star); SENA allows one (A2B, App G).',
    ]);
  });

  it('charges in annulo or in orle turned from upright are one step from core practice (§1.7 S2, App G); to center in annulo is none', () => {
    const swords = (orientation: string) => group(charge('sword', { orientation }), 'or', { count: 4, arrangement: 'in-annulo' });
    const alone = nd(arms('azure', swords('fesswise')));
    expect(coreSteps(alone)).toEqual(['non-default-orientation-in-annulo-or-orle']);
    expect(structuralIssues(alone)).toEqual([]);
    expect(coreSteps(nd(arms('azure', swords('to-center'))))).toEqual([]);
    expect(coreSteps(nd(arms('azure', group(charge('sword', { orientation: 'to-center' }), 'or', { count: 8, arrangement: 'in-orle' }))))).toEqual(['non-default-orientation-in-annulo-or-orle']);
    const withLine = nd(arms('argent', swords('fesswise'), group(ordinary('bend', { lines: { a: 'wavy', b: 'plain' } }), 'gules', { role: 'overall' })));
    expect(structuralIssues(withLine).filter((i) => i.code === 'structure' && i.rule === 'core-practice').map((i) => i.message)).toEqual([
      'This design is two steps from core practice (a line on one edge of a band only, charges in annulo or in orle turned from upright); SENA allows one (A2B, App G).',
    ]);
  });

  it('per fess with a chief embattled is refused, with a chief indented allowed (A3D1c)', () => {
    const crosses = (lines: object) => structuralIssues(nd(arms({ k: 'divided', division: 'per-fess', parts: ['or', 'gules'] }, ord('chief', 'azure', lines))))
      .filter((i) => i.code === 'structure' && i.rule === 'crosses-line');
    expect(crosses({ a: 'embattled' })).toHaveLength(1);
    expect(crosses({ a: 'indented' })).toEqual([]);
  });

  it("an ordinary with a complex line may not share the tincture of a multiply divided field (RULES-C §B.6)", () => {
    const vair = { k: 'fur', fur: 'vair', colours: null };
    expect(tinctureIssues(nd(arms(vair, ord('chief', 'argent'))))).toEqual([]);
    expect(tinctureIssues(nd(arms(vair, ord('chief', 'argent', { a: 'wavy' }))))).not.toEqual([]);
  });
});

describe('conflict between lined ordinaries (SENA A5G4)', () => {
  const on = (type: string, lines: object | null, paint = 'gules') => nd(arms('argent', ord(type, paint, lines)));
  const between = (x: ReturnType<typeof on>, y: ReturnType<typeof on>) => differences(x, y).map((d) => `${d.attr}:${d.kind}:${d.rule}`);

  it('gives the RULES-C §B.7 verdicts', () => {
    const emb = { a: 'embattled' }, counter = { a: 'embattled', b: 'embattled' }, bret = { a: 'bretessed' };
    expect(between(on('fess', emb), on('fess', counter))).toEqual(['type:dc:A5G4']);
    expect(between(on('fess', emb), on('fess', bret))).toEqual(['type:dc:A5G4']);
    expect(between(on('fess', bret), on('fess', counter))).toEqual([]);
    expect(between(on('fess', { a: 'indented' }), on('fess', { a: 'dancetty' }))).toEqual(['type:dc:A5G4']);
    expect(between(on('bordure', null), on('bordure', { a: 'engrailed' }))).toEqual(['type:dc:A5G4']);
    expect(between(on('bordure', { a: 'engrailed' }), on('bordure', { a: 'invected' }))).toEqual([]);
    expect(between(on('bordure', { a: 'embattled' }), on('bordure', { a: 'potenty' }))).toEqual(['type:dc:A5G4']);
    // Edge and tincture are different rules: they add up.
    expect(between(on('bend', { a: 'wavy' }, 'or'), on('bend', { a: 'embattled' }, 'sable'))).toEqual(['type:dc:A5G4', 'tincture:dc:A5G3']);
    // A change of type and of line is one change; a line never makes a substantial change.
    expect(between(on('fess', { a: 'wavy' }), on('pale', null))).toEqual(['type:sc:A5E2']);
    expect(between(on('chevron', { a: 'embattled' }), on('chevron', { a: 'raguly' }))).toEqual(['type:dc:A5G4']);
    expect(between(on('fess', { a: 'plain', b: 'raguly' }), on('fess', null))).toEqual(['type:dc:A5G4']);
  });

  it('explains an edge change as a change of type', () => {
    const [note] = explainDifferences(on('fess', null), on('fess', { a: 'embattled', b: 'embattled' }));
    expect(note.text).toBe('edge of band or shape (straight ↔ embattled counter-embattled)');
    expect(note.why).toBe('Changing the edge of a fess — from straight to embattled, say — changes its type: a distinct change (SENA A5G4).');
  });
});

describe('the words for lined ordinaries', () => {
  const words = (input: unknown) => { const d = nd(input); return [blazon(d), gloss(d)]; };

  it('blazons the line after the name, the edge when it is not the default', () => {
    const rows: Array<[unknown, string]> = [
      [arms('argent', ord('fess', 'or', { a: 'embattled' })), 'Argent, a fess embattled Or.'],
      [arms('argent', ord('fess', 'or', { a: 'embattled', b: 'embattled' })), 'Argent, a fess embattled counter-embattled Or.'],
      [arms('argent', ord('fess', 'gules', { a: 'bretessed' })), 'Argent, a fess bretessed gules.'],
      [arms('argent', ord('fess', 'gules', { a: 'plain', b: 'wavy' })), 'Argent, a fess wavy on the lower edge gules.'],
      [arms('argent', ord('chevron', 'gules', { a: 'raguly', b: 'plain' })), 'Argent, a chevron raguly on the upper edge gules.'],
      [arms('gules', ord('bend-sinister', 'argent', { a: 'wavy' })), 'Gules, a bend sinister wavy argent.'],
      [arms('azure', ord('chief', 'or', { a: 'indented' })), 'Azure, a chief indented Or.'],
      [arms('azure', ord('bordure', 'or', { a: 'engrailed' })), 'Azure, a bordure engrailed Or.'],
      [arms('azure', ord('pale', 'or', { a: 'wavy', b: 'plain' })), 'Azure, a pale wavy on the dexter edge Or.'],
      [arms('or', ord('pale', 'sable', { a: 'wavy' }, { charged: [group(charge('rose'), 'argent', { count: 3 })] })), 'Or, on a pale wavy sable three roses argent.'],
    ];
    for (const [input, text] of rows) expect(words(input)[0]).toBe(text);
  });

  it('glosses the line in plain words', () => {
    expect(words(arms('azure', ord('fess', 'or', { a: 'embattled' })))[1]).toBe('A blue shield with a gold horizontal band across the middle with a battlemented top edge.');
    expect(words(arms('azure', ord('pale', 'or', { a: 'wavy' })))[1]).toBe('A blue shield with a gold vertical band down the middle with wavy edges.');
    expect(words(arms('azure', ord('chief', 'or', { a: 'indented' })))[1]).toBe('A blue shield with a gold band across the top with a zigzag edge.');
  });

  it('signs the lines after the ordinary, and different lines differently', () => {
    expect(signature(nd(arms('argent', ord('fess', 'or', { a: 'embattled' }))))).toBe('arms|ar|P:o.fess~embattled/plain:1:single:or');
    expect(signature(nd(arms('argent', ord('bordure', 'or', { a: 'engrailed' }))))).toBe('arms|ar|R:o.bordure~engrailed:1:single:or');
    expect(signature(nd(arms('argent', ord('fess', 'or'))))).toBe('arms|ar|P:o.fess:1:single:or');
    const sigs = BUILDER_ORDINARIES.flatMap((type) => DRAWN_LINES.filter((l) => allowed(type, l)).flatMap((line) => {
      const two = BANDS.includes(type);
      return (two ? [both(line), { a: line, b: 'plain' }, { a: 'plain', b: line }] : [both(line)]).map((lines) => signature(nd(arms('argent', ord(type, 'or', lines)))));
    }));
    expect(new Set(sigs).size).toBe(sigs.length);
  });
});

describe('the lines tail: triangular, rompu, bevilled and a pile ployé (C14)', () => {
  const per = (division: string, line: string, a = 'argent', b = 'gules') => ({ k: 'divided', division, parts: [a, b], lines: { a: line, b: line } });
  const problems = (d: ReturnType<typeof nd>) => structuralIssues(d).filter((i) => i.code === 'structure').map((i) => `${i.rule}: ${i.message}`);

  it('triangular draws a chief\'s lower edge as two straight lines meeting below its middle, on every shape', () => {
    for (const shape of FIELD_SHAPES) {
      const frame = defaultOrdinaryFrame(shape);
      const plain = ordinaryGeometry(spec('chief', { a: 'plain', b: 'plain' }), frame).body, pointed = ordinaryGeometry(spec('chief', both('triangular')), frame).body;
      const [, plainLow] = extentAt(plain, 50), [, low] = extentAt(pointed, 50.01), [, side] = extentAt(pointed, 30);
      expect([shape, low > plainLow + 4]).toEqual([shape, true]);
      expect(low).toBeGreaterThan(side + 1);
      // straight: the lower edge between the middle and the flank climbs by a constant slope
      const [, q1] = extentAt(pointed, 20), [, q2] = extentAt(pointed, 30), [, q3] = extentAt(pointed, 40);
      expect(Math.abs((q3 - q2) - (q2 - q1))).toBeLessThan(0.05);
    }
  });

  it('rompu breaks a chevron\'s limbs and bevilled a bend\'s edges by a step: the body differs from the plain one and stays in the shield', () => {
    for (const shape of FIELD_SHAPES) {
      const frame = defaultOrdinaryFrame(shape);
      for (const [type, line] of [['chevron', 'rompu'], ['bend', 'bevilled'], ['bend-sinister', 'bevilled'], ['pile', 'ploye']] as const) {
        const plain = ordinaryGeometry(spec(type, { a: 'plain', b: 'plain' }), frame).body, lined = ordinaryGeometry(spec(type, both(line)), frame).body;
        expect([shape, type, lined === plain]).toEqual([shape, type, false]);
        const [ring] = pathRings(lined), [plainRing] = pathRings(plain);
        expect(ring.length).toBeGreaterThan(plainRing.length);
      }
    }
  });

  it('is offered only on the hosts that carry it, never as a blocked chip elsewhere', () => {
    const offered = (input: unknown, target: Parameters<typeof lineChoices>[1]) => lineChoices(nd(input), target).map((c) => c.value);
    const at = { k: 'group', path: [0] } as const;
    expect(offered(arms('argent', ord('chief', 'azure')), at)).toContain('triangular');
    expect(offered(arms('argent', ord('fess', 'azure')), at)).not.toContain('triangular');
    expect(offered(arms('argent', ord('chevron', 'azure')), at)).toContain('rompu');
    expect(offered(arms('argent', ord('chief', 'azure')), at)).not.toContain('rompu');
    for (const type of ['bend', 'bend-sinister']) expect(offered(arms('argent', ord(type, 'azure')), at)).toContain('bevilled');
    expect(offered(arms('argent', ord('fess', 'azure')), at)).not.toContain('bevilled');
    expect(offered(arms('argent', ord('pile', 'azure')), at)).toContain('ploye');
    for (const division of ['per-bend', 'per-bend-sinister']) expect(offered(arms(per(division, 'plain')), { k: 'field' })).toContain('bevilled');
    expect(offered(arms(per('per-pale', 'plain')), { k: 'field' })).not.toContain('bevilled');
    expect(problems(nd(arms('argent', ord('fess', 'azure', { a: 'triangular' }))))).toEqual(['line: A triangular line is drawn on a chief only — not a fess.']);
    expect(problems(nd(arms(per('per-pale', 'bevilled'))))).toEqual(['line: A bevilled line divides a field per bend or per bend sinister only — not a field divided per pale.']);
  });

  it('takes no further line, no cotise line, and no fimbriation (rompu, bevilled)', () => {
    expect(problems(nd(arms('argent', ord('chevron', 'azure', { a: 'rompu', b: 'embattled' }))))).toEqual(['line: A chevron carries one line: it can\'t be rompu on one edge and embattled on the other.']);
    expect(problems(nd(arms('argent', group(ordinary('chevron', { lines: both('rompu'), cotised: { count: 1, paint: 'or', line: 'wavy' } }), 'azure'))))[0])
      .toBe('line: A chevron rompu takes no further line, so its cotises can\'t be wavy (RULES-C §A.5).');
    expect(problems(nd(arms('argent', group(ordinary('chevron', { lines: both('rompu'), fimbriated: 'or' }), 'sable'))))).toEqual([
      "ordinary-treatment: A chevron rompu can't be fimbriated: its outline is broken (SENA A3C).",
    ]);
    expect(problems(nd(arms('argent', group(ordinary('bend', { lines: both('bevilled'), fimbriated: 'or' }), 'sable'))))).toEqual([
      "ordinary-treatment: A bend bevilled can't be fimbriated: its outline is broken (SENA A3C).",
    ]);
    expect(problems(nd(arms('argent', ord('chevron', 'azure', both('rompu')))))).toEqual([]);
  });

  it('a bend bevilled with charges around it is one step from core practice, alone none; with a one-edge line, two', () => {
    const around = arms('argent', ord('bend', 'gules', both('bevilled')), group(charge('roundel'), 'azure', { role: 'secondary', count: 2 }));
    expect(coreSteps(nd(around))).toEqual(['bevilled-with-charges']);
    expect(coreSteps(nd(arms('argent', ord('bend', 'gules', both('bevilled')))))).toEqual([]);
    expect(problems(nd(around)).filter((p) => p.startsWith('core-practice'))).toEqual([]);
    const two = arms('argent', group(ordinary('bend', { lines: { a: 'bevilled', b: 'plain' } }), 'gules'), group(charge('roundel'), 'azure', { role: 'secondary', count: 2 }));
    expect(coreSteps(nd(two))).toEqual(['one-edge-line', 'bevilled-with-charges']);
  });

  it('a field per bend bevilled is exempt from App H until a charge overlies the line', () => {
    const dark = (...groups: object[]) => problems(nd(arms(per('per-bend', 'bevilled', 'sable', 'azure'), ...groups)));
    expect(dark()).toEqual([]);
    expect(dark(group(charge('lion'), 'or')).some((p) => p.includes('App H'))).toBe(true);
    expect(problems(nd(arms(per('per-bend', 'wavy', 'sable', 'azure')))).some((p) => p.includes('App H'))).toBe(true);
  });

  it('words, signs and tells apart the lines', () => {
    const rows: Array<[unknown, string]> = [
      [arms('argent', ord('chief', 'azure', both('triangular'))), 'Argent, a chief triangular azure.'],
      [arms('or', ord('chevron', 'sable', both('rompu'))), 'Or, a chevron rompu sable.'],
      [arms('argent', ord('bend', 'gules', both('bevilled'))), 'Argent, a bend bevilled gules.'],
      [arms(per('per-bend', 'bevilled')), 'Per bend bevilled argent and gules.'],
      [arms('argent', ord('pile', 'azure', both('ploye'))), 'Argent, a pile ployé azure.'],
    ];
    for (const [input, text] of rows) expect(blazon(nd(input))).toBe(text);
    const between = (x: unknown, y: unknown) => differences(nd(x), nd(y)).map((d) => `${d.attr}:${d.kind}:${d.rule}`);
    expect(between(arms('argent', ord('chief', 'azure', both('triangular'))), arms('argent', ord('chief', 'azure', both('indented'))))).toEqual(['type:dc:A5G4']);
    expect(between(arms('or', ord('chevron', 'sable', both('rompu'))), arms('or', ord('chevron', 'sable')))).toEqual(['type:dc:A5G4']);
    expect(between(arms('argent', ord('bend', 'gules', both('bevilled'))), arms('argent', ord('bend', 'gules')))).toEqual(['type:dc:A5G4']);
    expect(signature(nd(arms('argent', ord('bend', 'gules', both('bevilled')))))).toBe('arms|ar|P:o.bend~bevilled:1:single:gu');
    expect(gloss(nd(arms('argent', ord('chief', 'azure', both('triangular')))))).toContain('pointed downward');
  });
});
