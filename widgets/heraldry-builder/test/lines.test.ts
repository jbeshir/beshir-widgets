// Lines of partition: the registry (SENA App M2 groups, hosts, edges, bare meanings), the periodic-edge generator
// and the contour. Nothing draws a complex line yet; these pin the contracts geometry builds on.

import { describe, expect, it } from 'vitest';
import {
  LINES, LINE_GROUP, LINE_PROFILE, LINE_SPELLINGS, LINE_WORD, FIELD_SHAPES, ORDINARY_TYPES, DIVISIONS, VARIATIONS,
  bareLines, contourPath, contoursPath, edgeCommands, edgeCount, edgePoints, fitPeriod, isStraightLine, lineAllowed, lineDiffers,
  pathPolygon, pathRings, pointInPolygon, polylineEdgeCommands, shapeFrame, visibleSpan,
  type ComplexLine, type Contour, type EdgeHost, type EdgeRun, type Line, type LineGroup, type OrdinaryType,
} from '../src/lib/heraldry';
import { pts, type Pt } from '../src/lib/heraldry/geometry';
import { rings } from './art-geometry';
import straightContours from './fixtures/straight-contours.json';

const COMPLEX = LINES.filter((l): l is ComplexLine => l !== 'plain');
const PERIODIC = COMPLEX.filter((l) => LINE_PROFILE[l].kind === 'periodic');
const fess = (type: OrdinaryType, inverted = false): EdgeHost => ({ k: 'ordinary', type, inverted });
const close = (p: Pt, q: Pt, tol: number) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;

/** A run over a straight chord a→b of the heater: the period fitted to the visible chord, centred on it, drawn one period beyond it. */
function chordRun(line: ComplexLine, a: Pt, b: Pt, side: 1 | -1 = 1): EdgeRun {
  const span = visibleSpan(a, b, pathPolygon(shapeFrame('heater').outline))!;
  const period = fitPeriod(line, span[1] - span[0], 1);
  return { line, side, depth: LINE_PROFILE[line].depth, period, anchor: (span[0] + span[1]) / 2, span: [span[0] - period, span[1] + period] };
}

/** Where p lies along a→b, and how far to the left of it (SVG coordinates). */
function along(a: Pt, b: Pt, p: Pt): { s: number; off: number } {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  const dx = p[0] - a[0], dy = p[1] - a[1];
  return { s: dx * ux + dy * uy, off: dx * uy - dy * ux };
}

describe('the line registry', () => {
  it('groups every line as SENA App M2 does', () => {
    const groups: Record<LineGroup, Line[]> = {
      straight: ['plain', 'enarched', 'ploye'], square: ['embattled', 'bretessed', 'dovetailed', 'raguly'], wavy: ['wavy', 'nebuly', 'urdy'],
      long: ['rayonny'], jagged: ['indented', 'engrailed', 'invected', 'dancetty'], grady: ['grady'], other: ['potenty'],
    };
    for (const [group, lines] of Object.entries(groups)) for (const l of lines) expect([l, LINE_GROUP[l]]).toEqual([l, group]);
    expect(Object.values(groups).flat().sort()).toEqual([...LINES].sort());
    expect(LINES.filter(isStraightLine)).toEqual(['plain', 'enarched', 'ploye']);
  });

  it('lineDiffers gives the RULES-C §B.7 verdicts', () => {
    const cases: Array<[Line, Line, boolean, boolean]> = [
      ['plain', 'wavy', false, true], ['wavy', 'nebuly', false, false], ['embattled', 'dovetailed', false, false],
      ['indented', 'wavy', false, true], ['indented', 'dancetty', true, true], ['indented', 'dancetty', false, false],
      ['engrailed', 'dancetty', true, true], ['engrailed', 'invected', true, false], ['potenty', 'embattled', true, true],
      ['plain', 'enarched', true, false], ['plain', 'ploye', false, false], ['embattled', 'bretessed', true, false],
      ['grady', 'urdy', true, false], ['grady', 'indented', true, false], ['grady', 'embattled', true, true], ['grady', 'plain', false, true],
      ['rayonny', 'wavy', false, true], ['embattled', 'embattled', true, false],
    ];
    for (const [x, y, band, differs] of cases) {
      expect([x, y, band, lineDiffers(x, y, band)]).toEqual([x, y, band, differs]);
      expect([y, x, band, lineDiffers(y, x, band)]).toEqual([y, x, band, differs]);
    }
  });

  it('bare lines follow the SCA defaults per host', () => {
    expect(bareLines(fess('fess'), 'embattled')).toEqual({ a: 'embattled', b: 'plain' });
    expect(bareLines(fess('chevron', true), 'embattled')).toEqual({ a: 'embattled', b: 'plain' });
    expect(bareLines(fess('bend-sinister'), 'embattled')).toEqual({ a: 'embattled', b: 'plain' });
    expect(bareLines(fess('pale'), 'embattled')).toEqual({ a: 'embattled', b: 'embattled' });
    expect(bareLines(fess('fess'), 'wavy')).toEqual({ a: 'wavy', b: 'wavy' });
    expect(bareLines(fess('chief'), 'embattled')).toEqual({ a: 'embattled', b: 'embattled' });
    expect(bareLines({ k: 'division', division: 'per-fess' }, 'embattled')).toEqual({ a: 'embattled', b: 'embattled' });
    expect(bareLines({ k: 'division', division: 'quarterly' }, 'wavy')).toEqual({ a: 'wavy', b: 'wavy' });
  });

  it('gives every host its edges and the lines it may carry', () => {
    const two: OrdinaryType[] = ['fess', 'bar', 'barrulet', 'bend', 'bendlet', 'bend-sinister', 'bendlet-sinister', 'baton', 'chevron', 'chevronel', 'pale', 'pallet', 'orle', 'tressure'];
    const none: OrdinaryType[] = ['point', 'label', 'fret', 'mount', 'trimount'];
    for (const t of ORDINARY_TYPES) expect([t, edgeCount(fess(t))]).toEqual([t, two.includes(t) ? 2 : none.includes(t) ? 0 : 1]);
    for (const d of DIVISIONS) expect([d, edgeCount({ k: 'division', division: d })]).toEqual([d, d === 'quarterly' ? 2 : 1]);
    expect(VARIATIONS.filter((v) => edgeCount({ k: 'variation', variation: v }) === 1)).toEqual(['barry', 'paly', 'bendy', 'bendy-sinister', 'chevronny']);

    const hosts = (line: Line): string[] => [
      ...ORDINARY_TYPES.flatMap((t) => [lineAllowed(fess(t), line) ? t : null, lineAllowed(fess(t, true), line) ? `${t} inverted` : null]),
      ...DIVISIONS.map((d) => (lineAllowed({ k: 'division', division: d }, line) ? d : null)),
      ...VARIATIONS.map((v) => (lineAllowed({ k: 'variation', variation: v }, line) ? v : null)),
    ].filter((h): h is string => h !== null);
    expect(hosts('enarched')).toEqual(['fess', 'fess inverted', 'bend', 'bend inverted', 'bend-sinister', 'bend-sinister inverted', 'chevron', 'chief', 'chief inverted', 'per-fess', 'per-bend', 'per-bend-sinister', 'per-chevron']);
    expect(hosts('ploye')).toEqual(['chevron', 'chevron inverted', 'per-chevron', 'per-chevron-inverted']);
    expect(hosts('dancetty').filter((h) => !h.endsWith(' inverted'))).toEqual([
      'fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'bar', 'barrulet', 'pallet', 'bendlet', 'bendlet-sinister', 'chevronel', 'baton',
      'barry', 'paly', 'bendy', 'bendy-sinister', 'chevronny',
    ]);
    for (const t of none) expect(COMPLEX.some((l) => lineAllowed(fess(t), l))).toBe(false);
    expect(hosts('wavy')).toHaveLength(2 * (ORDINARY_TYPES.length - none.length) + DIVISIONS.length + 5);
  });

  it('spells every line one way and reads the College\'s other spellings as that line', () => {
    for (const l of COMPLEX) {
      expect(LINE_SPELLINGS[l]).toBe(l);
      expect(LINE_SPELLINGS[LINE_WORD[l]]).toBe(l);
    }
    expect([LINE_SPELLINGS.undy, LINE_SPELLINGS.crenellated, LINE_SPELLINGS['embattled-grady'], LINE_SPELLINGS.ployee, LINE_SPELLINGS.arched])
      .toEqual(['wavy', 'embattled', 'grady', 'ploye', 'enarched']);
    expect(LINE_SPELLINGS['counter-embattled']).toBe('counter-embattled');
    expect(LINE_SPELLINGS['indented grady']).toBeUndefined();
    expect(Object.keys(LINE_SPELLINGS).every((k) => k === k.toLowerCase())).toBe(true);
  });
});

describe('contours', () => {
  it('a contour of straight edges is byte-identical to pts()', () => {
    // every polygon the phase-B ordinaries and divisions draw, captured before contours existed
    const captured = straightContours as Record<string, string>;
    expect(Object.keys(captured)).toHaveLength(4 * (9 + 1 + 14));
    for (const [key, d] of Object.entries(captured)) {
      const cs = pathRings(d).map((ring): Contour => ({ start: ring[0], edges: ring.slice(1).map((to) => ({ via: [], to, run: null })) }));
      expect([key, contoursPath(cs)]).toEqual([key, d]);
    }
    // unrounded points too: the contour rounds exactly as pts() does
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 300 - 100;
    for (let k = 0; k < 200; k++) {
      const points = Array.from({ length: 3 + (k % 6) }, (): Pt => [rnd(), rnd()]);
      expect(contourPath({ start: points[0], edges: points.slice(1).map((to) => ({ via: [], to, run: null })) })).toBe(pts(points));
    }
  });
});

describe('the periodic-edge generator', () => {
  const directions: Pt[] = [[1, 0], [0, 1], [Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]];

  it('fits whole periods within each line\'s repeat bounds on every visible chord of every shape', () => {
    for (const shape of FIELD_SHAPES) {
      const { outline, fessPoint: { x, y } } = shapeFrame(shape);
      for (const [dx, dy] of directions) {
        const span = visibleSpan([x - 200 * dx, y - 200 * dy], [x + 200 * dx, y + 200 * dy], pathPolygon(outline))!;
        const chord = span[1] - span[0];
        for (const line of PERIODIC) {
          const { min, max } = LINE_PROFILE[line].repeats;
          const n = chord / fitPeriod(line, chord, 1);
          expect(Math.abs(n - Math.round(n))).toBeLessThan(1e-9);
          expect([shape, dx, dy, line, Math.round(n) >= Math.max(2, Math.round((min * chord) / 100)) && Math.round(n) <= Math.max(2, Math.round((max * chord) / 100))])
            .toEqual([shape, dx, dy, line, true]);
        }
        for (const line of COMPLEX.filter((l) => !PERIODIC.includes(l))) expect(fitPeriod(line, chord, 1)).toBe(chord);
      }
    }
    // shorter edges and diminutives' finer lines still get at least two whole periods
    expect(10 / fitPeriod('wavy', 10, 1)).toBe(2);
    expect(Math.round(100 / fitPeriod('embattled', 100, 1 / 1.5))).toBe(6);
  });

  it('keeps features inside the span and runs straight outside it', () => {
    const a: Pt = [-40, 50], b: Pt = [140, 50];
    for (const line of COMPLEX) {
      for (const span of [[45, 145], [0, 180], [70, 110]] as Array<[number, number]>) {
        const run: EdgeRun = { line, side: 1, depth: LINE_PROFILE[line].depth, period: fitPeriod(line, 40, 1), anchor: 90, span };
        const points = edgePoints(a, b, run);
        for (const p of points) {
          const { s, off } = along(a, b, p);
          if (Math.abs(off) > 1e-9) expect([line, span, s >= span[0] - 1e-9 && s <= span[1] + 1e-9]).toEqual([line, span, true]);
        }
        // outside the span, one straight L in from a and one out to b: no vertex between
        const inner = points.slice(1, -1).map((p) => along(a, b, p).s);
        expect([line, span, inner.every((s) => s >= span[0] - 1e-9 && s <= span[1] + 1e-9)]).toEqual([line, span, true]);
        expect(edgeCommands(a, b, run)).toMatch(/[LC ]140 50$/);
      }
    }
    // no room for a period: one straight line
    expect(edgeCommands(a, b, { line: 'wavy', side: 1, depth: 9, period: 30, anchor: 90, span: [80, 100] })).toBe('L140 50');
  });

  it('emits only M, L, C and Z, no exponent, that pathRings reads', () => {
    for (const line of COMPLEX) {
      for (const [a, b] of [[[-40, 35.123456], [140.0000001, 35]], [[0, 0], [100, 100]], [[50, -40], [50, 160]]] as Array<[Pt, Pt]>) {
        const run = chordRun(line, a, b, -1);
        const d = `M${a[0]} ${a[1]}${edgeCommands(a, b, run)}Z`.replace(/^M[^LC]*/, 'M0 0');
        expect(d).not.toMatch(/e/i);
        expect(d.replace(/[MLCZ]|-?\d+(?:\.\d{1,2})?|\s/g, '')).toBe('');
        expect(pathRings(d)[0].every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
      }
    }
    // a polyline edge is all straight lines, so the art reader takes it too
    const inset = pathPolygon(shapeFrame('heater').inset);
    const d = `M${inset[0][0]} ${inset[0][1]}${polylineEdgeCommands(inset, { line: 'indented', side: 1, depth: 5, period: 12, anchor: 100, span: [0, 400] })}Z`;
    expect(d).not.toMatch(/C/);
    expect(rings(d)[0].length).toBe(pathRings(d)[0].length);
  });

  it('a band\'s two edges share period and anchor: parallel lines stay parallel, mirrored ones mirror', () => {
    // a fess from x -40 to 140 between y 35 and 65: the upper edge left to right, the lower right to left, both + outward
    // (single profiles take + toward chief on both edges)
    const length = 180;
    for (const line of COMPLEX) {
      const upper = chordRun(line, [-40, 35], [140, 35]);
      const single = LINE_PROFILE[line].kind === 'single';
      const lower: EdgeRun = { ...upper, side: single ? -1 : 1, anchor: length - upper.anchor, span: [length - upper.span[1], length - upper.span[0]] };
      const top = edgePoints([-40, 35], [140, 35], upper).slice().reverse();
      const bottom = edgePoints([140, 65], [-40, 65], lower);
      expect([line, bottom.length]).toEqual([line, top.length]);
      const mirrored = LINE_PROFILE[line].pairing === 'mirrored';
      const expected = top.map(([x, y]): Pt => [x, mirrored ? 100 - y : y + 30]);
      expect([line, bottom.every((p, i) => close(p, expected[i], 1e-6))]).toEqual([line, true]);
    }
  });

  it('engrailed cusps lie on the + side, invected on the −', () => {
    const a: Pt = [-40, 50], b: Pt = [140, 50];
    for (const [line, sign] of [['engrailed', 1], ['invected', -1]] as const) {
      for (const side of [1, -1] as const) {
        const run = chordRun(line, a, b, side);
        // cusps are the period ends, on the line; the arcs' middles lie half a period on
        const starts = [...Array(20).keys()].map((k) => run.anchor + (k - 10.5) * run.period).filter((s) => s >= run.span[0] && s + run.period <= run.span[1]);
        expect(starts.length).toBeGreaterThan(4);
        const offAt = (s: number) => {
          const p = edgePoints(a, b, run).reduce((best, q) => (Math.abs(along(a, b, q).s - s) < Math.abs(along(a, b, best).s - s) ? q : best));
          return along(a, b, p).off;
        };
        for (const s of starts) expect(Math.sign(offAt(s) - offAt(s + run.period / 2))).toBe(sign * side);
      }
    }
  });

  it('a fess engrailed has its points out of the band and its arcs biting in; invected the reverse', () => {
    // the fess between y 35 and 65, both edges + outward: engrailed points reach the line (the upper edge's least y, the lower
    // edge's greatest) and its arcs lie inside the band; invected arcs bulge out of it
    for (const [line, out] of [['engrailed', false], ['invected', true]] as const) {
      const upperRun = chordRun(line, [-40, 35], [140, 35]);
      const lowerRun: EdgeRun = { ...upperRun, anchor: 180 - upperRun.anchor, span: [180 - upperRun.span[1], 180 - upperRun.span[0]] };
      const upper = edgePoints([-40, 35], [140, 35], upperRun).map(([, y]) => Math.round(y * 1e6) / 1e6);
      const lower = edgePoints([140, 65], [-40, 65], lowerRun).map(([, y]) => Math.round(y * 1e6) / 1e6);
      const depth = LINE_PROFILE[line].depth;
      expect([line, Math.min(...upper), Math.max(...upper)]).toEqual(out ? [line, 35 - depth, 35] : [line, 35, 35 + depth]);
      expect([line, Math.min(...lower), Math.max(...lower)]).toEqual(out ? [line, 65, 65 + depth] : [line, 65 - depth, 65]);
    }
  });

  it('rayonny and nebuly are curved, unlike the straight-stepped indented, dancetty, urdy and dovetailed', () => {
    const curved = (l: ComplexLine) => LINE_PROFILE[l].period.some((s) => s.k === 'C');
    expect((['rayonny', 'nebuly', 'wavy'] as const).every(curved)).toBe(true);
    expect((['indented', 'dancetty', 'urdy', 'dovetailed', 'embattled'] as const).some(curved)).toBe(false);
    // a nebuly lobe's head overhangs its neck; a rayonny flame's tip leans along the line
    expect(Math.min(...LINE_PROFILE.nebuly.period.map((s) => s.to[0]))).toBeLessThan(0);
    const tip = LINE_PROFILE.rayonny.period.find((s) => s.to[1] === 1)!;
    expect(tip.to[0]).not.toBe(0.25);
  });

  it('edgePoints is edgeCommands flattened', () => {
    for (const line of COMPLEX) {
      for (const [a, b] of [[[-40, 35], [140, 35]], [[-30, -51.21], [130, 108.79]], [[50, 160], [50, -40]]] as Array<[Pt, Pt]>) {
        const run = chordRun(line, a, b);
        const read = pathRings(`M${a[0]} ${a[1]}${edgeCommands(a, b, run)}`)[0];
        const points = edgePoints(a, b, run);
        expect([line, read.length]).toEqual([line, points.length]);
        expect([line, read.every((p, i) => close(p, points[i], 0.02))]).toEqual([line, true]);
      }
    }
  });

  it('polyline edges keep even periods round a curve', () => {
    // the heater's inset (a bordure's inner edge), corners and curves, indented outward (to the + side): each tooth tip sits one depth off the
    // line, and the tips come a period apart measured along it
    const inset = pathPolygon(shapeFrame('heater').inset);
    const ring = [...inset, inset[0]];
    const cum = [0];
    for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
    const total = cum[cum.length - 1];
    const depth = 5, period = fitPeriod('indented', total, 1);
    const d = polylineEdgeCommands(ring, { line: 'indented', side: 1, depth, period, anchor: period / 2, span: [0, total] });
    /** The nearest point of the ring: distance to it, and how far along the ring it is. */
    const nearest = ([x, y]: Pt) => {
      let best = { dist: Infinity, s: 0 };
      for (let i = 1; i < ring.length; i++) {
        const [x0, y0] = ring[i - 1], [x1, y1] = ring[i], len = cum[i] - cum[i - 1];
        const t = Math.max(0, Math.min(1, ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / (len * len)));
        const dist = Math.hypot(x - (x0 + t * (x1 - x0)), y - (y0 + t * (y1 - y0)));
        if (dist < best.dist) best = { dist, s: cum[i - 1] + t * len };
      }
      return best;
    };
    const drawn = pathRings(`M${ring[0][0]} ${ring[0][1]}${d}`)[0];
    const tips = drawn.filter((p) => nearest(p).dist > depth * 0.9);
    expect(tips).toHaveLength(Math.round(total / period));
    for (const p of tips) expect(nearest(p).dist).toBeLessThan(depth + 0.05);
    // (a tip off a sharp corner measures to the corner, so allow a tenth of a period)
    for (let i = 1; i < tips.length; i++) expect(Math.abs(nearest(tips[i]).s - nearest(tips[i - 1]).s - period)).toBeLessThan(period / 10);
    // the + side of the inset, drawn clockwise, is out toward the shield's edge
    expect(tips.some(([x, y]) => pointInPolygon(x, y, inset))).toBe(false);
  });
});
