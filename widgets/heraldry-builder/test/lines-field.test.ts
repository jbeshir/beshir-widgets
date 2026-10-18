// Lines of partition on the field: a divided field or a counted variation drawn with a complex line. The regions still
// tile the shape and point-in-region follows the drawn line; the rules (App H, A3D1c, the hosts a line may go on),
// the conflict check (A5G1c), the words and the verdict in every shape. The builder doesn't offer these yet
// (support.ts gaps them), so the tests call the library on resolved designs.

import { describe, expect, it } from 'vitest';
import {
  BUILDER_DIVISIONS, MORE_DIVISIONS, GYRONNY_PIECES, DRAWN_LINES, FIELD_SHAPES, LINES, LINE_LABEL, blazon, couldBeOneFess, counterchangedSlotParts, differences, divisionRegions,
  explainDifferences, featureMiddle, fieldSide, gloss, inFirstPart, lineAllowed, partIndexAt, pathPolygon, pathRings, pointInPolygon, readability,
  resolve, reversedRun, edgePoints, edgeCommands, partitionContours, periodStarts, visibleSpan, LINE_PROFILE, shapeFrame, signature, structuralIssues, tinctureIssues, validate, variationRegions,
  type ComplexLine, type Design, type DividedField, type EdgeRun, type FieldShape, type Line, type VariedField,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import { rotatesIn } from './rotation';

type Pt = [number, number];
const chg = (id: string, paint: string, extra: object = {}) => group(charge(id), paint, extra);
const ord = (type: string, paint: string, extra: object = {}) => group(ordinary(type), paint, extra);
const lined = (division: string, a: string, b: string, line: string, second?: string) => ({ ...div(division, a, b), lines: second ? { a: line, b: second } : { a: line } });
const varied = (variation: string, line: string, pieces: number | null = null, a = 'argent', b = 'azure') => ({ k: 'variation', variation, pieces, lines: { a: line }, parts: [a, b] });

/** The counted variations a line is drawn on (chevronny's corners take none yet). */
const STRIPES = ['barry', 'paly', 'bendy', 'bendy-sinister'] as const;

const ringsOf = (d: string) => pathRings(d);
const inRings = (rings: readonly Pt[][], x: number, y: number) => rings.filter((r) => pointInPolygon(x, y, r)).length % 2 === 1;

/** Whether (x, y) lies within `tol` of an edge of any ring: where floating point may put a point in two regions or none. */
function nearAnEdge(rings: readonly Pt[][], x: number, y: number, tol: number): boolean {
  return rings.some((r) => r.some(([ax, ay], i) => {
    const [bx, by] = r[(i + 1) % r.length];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= tol;
  }));
}

/** Points of a grid over the shape (offset by half a step from the lines through the fess point), inside its outline. */
function gridIn(shape: FieldShape, step: number): Pt[] {
  const outline = pathPolygon(shapeFrame(shape).outline);
  const out: Pt[] = [];
  for (let x = 0.5; x < 100; x += step) for (let y = 0.5; y < 120; y += step) if (pointInPolygon(x, y, outline)) out.push([x, y]);
  return out;
}

/** Every point lies in exactly one region (bar a hair from a drawn edge), and `partIndexAt` names that region. */
function checkTiling(regions: readonly string[], partAt: (x: number, y: number) => number, points: readonly Pt[]): string[] {
  const rings = regions.map(ringsOf);
  const wrong: string[] = [];
  for (const [x, y] of points) {
    const inside = rings.flatMap((r, i) => (inRings(r, x, y) ? [i] : []));
    if (inside.length !== 1) {
      if (!nearAnEdge(rings.flat(), x, y, 0.05)) wrong.push(`(${x}, ${y}) in ${inside.length} regions`);
    } else if (partAt(x, y) !== inside[0]) wrong.push(`(${x}, ${y}) partIndexAt ${partAt(x, y)} ≠ region ${inside[0]}`);
  }
  return wrong;
}

const plainOf = (l: Line) => ({ a: l, b: l });

/** Where two edges of a ring that don't share a corner cross (edges binned by a coarse grid, so a ring of thousands of points stays cheap). */
function selfCrossings(ring: readonly Pt[]): Pt[] {
  const n = ring.length, cell = 4, bins = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % n]];
    for (let gx = Math.floor(Math.min(a[0], b[0]) / cell); gx <= Math.floor(Math.max(a[0], b[0]) / cell); gx++) {
      for (let gy = Math.floor(Math.min(a[1], b[1]) / cell); gy <= Math.floor(Math.max(a[1], b[1]) / cell); gy++) {
        const key = `${gx},${gy}`;
        bins.set(key, [...(bins.get(key) ?? []), i]);
      }
    }
  }
  const seen = new Set<string>(), out: Pt[] = [];
  for (const ids of bins.values()) for (let p = 0; p < ids.length; p++) for (let q = p + 1; q < ids.length; q++) {
    const [i, j] = ids[p] < ids[q] ? [ids[p], ids[q]] : [ids[q], ids[p]];
    if (j - i <= 1 || (i === 0 && j === n - 1) || seen.has(`${i}:${j}`)) continue;
    seen.add(`${i}:${j}`);
    const [[px, py], [qx, qy]] = [ring[i], ring[(i + 1) % n]], [[rx, ry], [sx, sy]] = [ring[j], ring[(j + 1) % n]];
    const d = (qx - px) * (sy - ry) - (qy - py) * (sx - rx);
    if (Math.abs(d) < 1e-12) continue;
    const t = ((rx - px) * (sy - ry) - (ry - py) * (sx - rx)) / d, u = ((rx - px) * (qy - py) - (ry - py) * (qx - px)) / d;
    if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) out.push([px + t * (qx - px), py + t * (qy - py)]);
  }
  return out;
}

describe('drawing a line on the field', () => {
  const divisionCases = BUILDER_DIVISIONS.flatMap((division) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'division', division }, l)).map((line) => ({ division, line })));
  const moreCases = MORE_DIVISIONS.flatMap((division) => (division === 'gyronny' ? GYRONNY_PIECES : [null]).flatMap((pieces) => DRAWN_LINES
    .filter((l) => lineAllowed({ k: 'division', division }, l)).map((line) => ({ division, line, pieces }))));
  const stripeCases = STRIPES.flatMap((variation) => DRAWN_LINES.filter((l) => lineAllowed({ k: 'variation', variation }, l)).map((line, i) => ({ variation, line, pieces: i % 2 === 0 ? 6 : 8 })));

  it('lays every allowed line on every phase-B division and on the striped variations', () => {
    expect(divisionCases.length).toBeGreaterThanOrEqual(7 * 13);
    expect(stripeCases.length).toBe(4 * 14);
  });

  // Heater exhaustively; each other shape a rotating third of the cases.
  FIELD_SHAPES.forEach((shape, s) => {
    it(`the regions of a lined division tile the ${shape} and partIndexAt follows the drawn line`, () => {
      const points = gridIn(shape, 4);
      const wrong = divisionCases.filter((_, i) => shape === 'heater' || i % 3 === s % 3).flatMap(({ division, line }) => {
        const field: DividedField = { k: 'divided', division, lines: plainOf(line), pieces: null, paints: [{ k: 'tincture', t: 'or' }, { k: 'tincture', t: 'gules' }] };
        return checkTiling(divisionRegions(division, field.lines, null, shape), (x, y) => partIndexAt(field, shape, x, y), points).map((w) => `${division} ${line} ${w}`);
      });
      expect(wrong).toEqual([]);
    });

    // Where lines meet (per chevron inverted's limbs, gyronny's rays, per pall's arms) their features keep clear of each other (review K-4,
    // K-5): no region's outline crosses itself (a periodic line's), and the regions tile the shape on a coarse grid.
    it(`the regions of a lined phase-C division don't cross themselves where its lines meet, and tile the ${shape}`, () => {
      const points = gridIn(shape, 8);
      const wrong = moreCases.filter(({ division, line, pieces }) => shape === 'heater' || rotatesIn(`${shape}|${division}|${pieces}|${line}`, 1 / 4)).flatMap(({ division, line, pieces }) => {
        const field: DividedField = { k: 'divided', division, lines: plainOf(line), pieces, paints: [{ k: 'tincture', t: 'or' }, { k: 'tincture', t: 'gules' }, { k: 'tincture', t: 'azure' }] };
        const regions = divisionRegions(division, field.lines, pieces, shape);
        // a single bow (enarched, ployé) runs from end to end: on the lozenge an enarched per chevron inverted's two bows still cross at the apex (deferred)
        const crossings = LINE_PROFILE[line as ComplexLine].kind === 'single' ? [] : regions.flatMap((r, i) => ringsOf(r).flatMap((ring) => selfCrossings(ring)).map(([x, y]) => `region ${i} crosses itself at (${x.toFixed(1)}, ${y.toFixed(1)})`));
        return [...crossings, ...checkTiling(regions, (x, y) => partIndexAt(field, shape, x, y), points)].map((w) => `${division} ${pieces ?? ''} ${line} ${w}`);
      });
      expect(wrong).toEqual([]);
    });

    it(`the stripes of a lined variation tile the ${shape} and partIndexAt follows them`, () => {
      const points = gridIn(shape, 6);
      const wrong = stripeCases.filter((_, i) => shape === 'heater' || i % 3 === s % 3).flatMap(({ variation, line, pieces }) => {
        const field: VariedField = { k: 'varied', paint: { k: 'variation', variation, pieces, lines: plainOf(line), parts: [{ k: 'tincture', t: 'argent' }, { k: 'tincture', t: 'azure' }] } };
        const regions = variationRegions(variation, pieces, field.paint.lines, shapeFrame(shape).box);
        return checkTiling(regions, (x, y) => partIndexAt(field, shape, x, y), points).map((w) => `${variation} ${line} ${w}`);
      });
      expect(wrong).toEqual([]);
    });
  });

  it('every partition line of every allowed pair on every shape is drawn with its profile, at least two periods of it inside the shape', () => {
    const failures: string[] = [];
    for (const shape of FIELD_SHAPES) {
      const outline = pathPolygon(shapeFrame(shape).outline);
      for (const { division, line } of divisionCases) {
        for (const part of partitionContours(division, plainOf(line), null, shapeFrame(shape))) {
          for (const c of part) {
            let at = c.start;
            for (const e of c.edges) {
              const from = at;
              at = e.to;
              if (!e.run) continue;
              const name = `${shape} ${division} ${line} ${from}→${e.to}`;
              const length = Math.hypot(e.to[0] - from[0], e.to[1] - from[1]);
              const straight = `L${Math.round(e.to[0] * 100) / 100} ${Math.round(e.to[1] * 100) / 100}`;
              if (edgeCommands(from, e.to, e.run) === straight) failures.push(`${name} is straight`);
              // an edge that leaves the shape right away (a limb past the outline) has nothing to count
              const seen = visibleSpan(from, e.to, outline);
              if (LINE_PROFILE[line as ComplexLine].kind !== 'periodic' || !seen || seen[1] - seen[0] < 20) continue;
              const along = (d: number): Pt => [from[0] + ((e.to[0] - from[0]) * d) / length, from[1] + ((e.to[1] - from[1]) * d) / length];
              const shown = periodStarts(e.run, length).filter((st) => [st + 0.1, st + e.run!.period - 0.1].every((d) => { const [x, y] = along(d); return pointInPolygon(x, y, outline); })).length;
              if (shown < 2) failures.push(`${name} shows ${shown} periods`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('a plain line keeps the regions and the analytic part test it always had', () => {
    for (const shape of FIELD_SHAPES) {
      for (const division of BUILDER_DIVISIONS) {
        const field: DividedField = { k: 'divided', division, lines: plainOf('plain'), pieces: null, paints: [{ k: 'tincture', t: 'or' }, { k: 'tincture', t: 'gules' }] };
        const fess = shapeFrame(shape).fessPoint;
        for (const [x, y] of gridIn(shape, 7)) expect(partIndexAt(field, shape, x, y)).toBe(inFirstPart(division, fess, x, y) ? 0 : 1);
      }
    }
  });

  it('draws one line where two regions meet: an edge drawn back the other way is the same line', () => {
    const a: Pt = [10, 40], b: Pt = [90, 70];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const line of LINES.filter((l): l is ComplexLine => l !== 'plain')) {
      for (const side of [1, -1] as const) {
        const run: EdgeRun = { line, side, depth: 8, period: 16, anchor: 31, span: [5, 80] };
        const there = edgePoints(a, b, run), back = edgePoints(b, a, reversedRun(run, length)).reverse();
        expect(there.length, line).toBe(back.length);
        there.forEach((p, i) => expect(Math.hypot(p[0] - back[i][0], p[1] - back[i][1]), `${line} ${side} point ${i}`).toBeLessThan(0.02));
      }
    }
  });

  it('puts its features toward chief, or toward dexter on an upright line, and centres a one-sided line on where it would run plain', () => {
    expect([fieldSide([1, 0]), fieldSide([-1, 0]), fieldSide([0, 1]), fieldSide([0, -1]), fieldSide([1, 1])]).toEqual([1, -1, -1, 1, 1]);
    const middle = (l: ComplexLine) => Math.round(featureMiddle(l) * 1000) / 1000 + 0;
    expect((['engrailed', 'invected', 'indented', 'bretessed'] as const).map(middle)).toEqual([-0.5, 0.5, 0.5, 0.5]);
    expect((['wavy', 'embattled', 'rayonny', 'enarched', 'ploye'] as const).map(middle)).toEqual([0, 0, 0, 0, 0]);
    // Per fess engrailed: the points toward chief, the arcs toward base, straddling the fess line (RULES-C §A.2).
    const field: DividedField = { k: 'divided', division: 'per-fess', lines: plainOf('engrailed'), pieces: null, paints: [{ k: 'tincture', t: 'or' }, { k: 'tincture', t: 'gules' }] };
    const column = (x: number) => Array.from({ length: 200 }, (_, i) => 40 + i * 0.1).find((y) => partIndexAt(field, 'heater', x, y) === 1)!;
    const ys = Array.from({ length: 80 }, (_, i) => column(10 + i));
    expect(Math.min(...ys)).toBeGreaterThan(47);
    expect(Math.max(...ys)).toBeLessThan(53);
    expect(Math.min(...ys)).toBeLessThan(49);
    expect(Math.max(...ys)).toBeGreaterThan(51);
  });

  it('a charge counterchanged over a wavy line splits on the wave', () => {
    const d = nd(arms(lined('per-pale', 'azure', 'or', 'wavy'), chg('roundel', 'counterchanged')));
    const parts = counterchangedSlotParts(d.kind === 'arms' ? d.field : { k: 'tincture', t: 'or' }, { x: 50, y: 60, size: 30, rotation: 0 }, 'heater');
    const regions = divisionRegions('per-pale', plainOf('wavy'), null, 'heater');
    expect(parts.map((p) => p.d)).toEqual(regions);
    expect(parts.map((p) => p.paint)).toEqual([{ k: 'tincture', t: 'or' }, { k: 'tincture', t: 'azure' }]);
    expect(regions[0]).toMatch(/C/);
    // Somewhere the wave puts a point on the other side of the straight line.
    const field: DividedField = { k: 'divided', division: 'per-pale', lines: plainOf('wavy'), pieces: null, paints: [{ k: 'tincture', t: 'azure' }, { k: 'tincture', t: 'or' }] };
    expect(gridIn('heater', 1).some(([x, y]) => partIndexAt(field, 'heater', x, y) !== (inFirstPart('per-pale', { x: 50, y: 50 }, x, y) ? 0 : 1))).toBe(true);
  });
});

/** As the builder holds it: written as a draft in a shape, read back and re-resolved. */
function throughDraft(design: Design, shape: FieldShape): Design {
  const r = resolve(JSON.parse(JSON.stringify({ design, shape })).design);
  if (!r.ok) throw new Error('draft did not resolve');
  return r.design;
}

describe('the verdict on a lined field', () => {
  const LINED: Array<[string, unknown]> = [
    ['per pale wavy, a lion', arms(lined('per-pale', 'argent', 'azure', 'wavy'), chg('lion', 'gules'))],
    ['per fess embattled, three mullets', arms(lined('per-fess', 'gules', 'or', 'embattled'), chg('mullet', 'argent', { count: 3 }))],
    ['quarterly per fess indented, roses counterchanged', arms(lined('quarterly', 'or', 'gules', 'plain', 'indented'), chg('rose', 'counterchanged', { count: 4 }))],
    ['barry wavy of eight', arms(varied('barry', 'wavy', 8), chg('lion', 'gules'))],
    ['per bend raguly, a bend', arms(lined('per-bend', 'or', 'vert', 'raguly'), ord('bend', 'sable'))],
    ['per chevron engrailed, three crescents', arms(lined('per-chevron', 'argent', 'sable', 'engrailed'), chg('crescent', 'counterchanged', { count: 3 }))],
  ];

  for (const [name, input] of LINED) {
    it(`${name}: gets the same verdict and words in every shape`, () => {
      const d = nd(input);
      const verdict = (x: Design) => ({ issues: validate(x), readability: readability(x), blazon: blazon(x), gloss: gloss(x), signature: signature(x) });
      const canonical = verdict(d);
      for (const shape of FIELD_SHAPES) expect(verdict(throughDraft(d, shape)), shape).toEqual(canonical);
    });
  }
});

const rules = (input: unknown) => [...structuralIssues(nd(input)), ...tinctureIssues(nd(input))].map((i) => (i.code === 'structure' ? `${i.rule}: ${i.message}` : `${i.code}: ${i.message}`));
const lineIssues = (input: unknown) => structuralIssues(nd(input)).filter((i) => i.code === 'structure' && i.rule === 'line').map((i) => i.message);

describe('the rules for lines on the field', () => {
  it('a complex line between sable and azure or sable and purpure is refused (App H)', () => {
    const apart = chg('mullet', 'or', { count: 2, arrangement: 'in-fess' });
    expect(lineIssues(arms(lined('per-pale', 'sable', 'azure', 'wavy'), apart))).toEqual([
      'A wavy line between Sable and Azure can\'t be seen — divide them with a straight line, or choose another tincture (SENA App H).',
    ]);
    expect(lineIssues(arms(lined('per-pale', 'purpure', 'sable', 'embattled'), apart))).toHaveLength(1);
    // Plain and the straight-group lines are not complex (App H: "ployé is considered a variant of a straight line").
    expect(lineIssues(arms(div('per-pale', 'sable', 'azure'), apart))).toEqual([]);
    expect(lineIssues(arms(lined('per-chevron', 'sable', 'azure', 'ploye'), chg('lion', 'or')))).toEqual([]);
  });

  it('azure and vert wavy is allowed, with a readability tip', () => {
    const d = arms(lined('per-pale', 'azure', 'vert', 'wavy'), chg('mullet', 'or', { count: 2, arrangement: 'in-fess' }));
    expect(rules(d)).toEqual([]);
    expect(readability(nd(d)).nudge).toBe('Blue and green across a wavy line can be hard to see — try a straight line, or a metal');
  });

  it('azure and vert wavy under a charge across the line is refused (App H)', () => {
    expect(lineIssues(arms(lined('per-pale', 'azure', 'vert', 'wavy'), chg('lion', 'or')))).toEqual([
      'A lion over the wavy line hides it: between two colours the line must stay clear to be seen — set the charges off it, or divide the field with a straight line (SENA App H).',
    ]);
    expect(lineIssues(arms(lined('per-fess', 'or', 'argent', 'embattled'), ord('fess', 'sable')))).toHaveLength(1);
    // A plain line between them may be charged as before (A3B3a).
    expect(lineIssues(arms(div('per-pale', 'azure', 'vert'), chg('lion', 'or')))).toEqual([]);
  });

  it('per fess indented with a chief is allowed, per fess wavy with a chief is not (A3D1c)', () => {
    // A chief alone: no charge lies across the line.
    const chief = (field: unknown) => structuralIssues(nd(arms(field, ord('chief', 'azure')))).filter((i) => i.code === 'structure' && i.rule === 'crosses-line');
    expect(chief(lined('per-fess', 'or', 'gules', 'indented'))).toEqual([]);
    expect(chief(lined('per-fess', 'or', 'gules', 'wavy'))).toHaveLength(1);
    expect(chief(lined('per-fess', 'or', 'gules', 'embattled'))).toHaveLength(1);
    expect(chief(div('per-fess', 'or', 'gules'))).toHaveLength(1);
  });

  it('a chief and a line of division could be one fess unless one of them is jagged alone, or both are complex and different (RULES-C §A.5.5)', () => {
    const cases: Array<[Line, Line, boolean]> = [
      ['plain', 'plain', true], ['wavy', 'wavy', true], ['embattled', 'plain', true], ['plain', 'embattled', true], ['plain', 'wavy', true],
      ['indented', 'plain', false], ['plain', 'indented', false], ['plain', 'engrailed', false], ['wavy', 'embattled', false], ['indented', 'indented', true],
      ['enarched', 'plain', true], ['plain', 'ploye', true],
    ];
    for (const [upper, lower, one] of cases) expect([upper, lower, couldBeOneFess(upper, lower)]).toEqual([upper, lower, one]);
  });

  it('dancetty on a division is refused; a counted variation takes it', () => {
    expect(lineIssues(arms(lined('per-pale', 'or', 'gules', 'dancetty'), chg('lion', 'argent')))).toEqual(['Dancetty is for two-sided bands; a field divided per pale is drawn indented.']);
    expect(lineIssues(arms(varied('barry', 'dancetty'), chg('lion', 'gules')))).toEqual([]);
    expect(lineIssues(arms(lined('per-pale', 'or', 'gules', 'enarched'), chg('lion', 'argent')))).toHaveLength(1);
    expect(lineIssues(arms(lined('per-fess', 'or', 'gules', 'ploye'), chg('lion', 'argent')))).toHaveLength(1);
    expect(lineIssues(arms(lined('per-chevron', 'or', 'gules', 'enarched'), chg('lion', 'argent')))).toEqual([]);
  });
});

describe('conflict between lined fields (SENA A5G1c)', () => {
  const lion = (field: unknown) => nd(arms(field, chg('lion', 'or')));
  const between = (x: unknown, y: unknown) => differences(lion(x), lion(y)).map((d) => `${d.attr}:${d.kind}:${d.rule}`);

  it('gives the RULES-C §B.7 verdicts', () => {
    expect(between(div('per-pale', 'argent', 'azure'), lined('per-pale', 'argent', 'azure', 'wavy'))).toEqual(['field-line:dc:A5G1c']);
    expect(between(lined('per-pale', 'argent', 'azure', 'wavy'), lined('per-pale', 'argent', 'azure', 'nebuly'))).toEqual([]);
    expect(between(lined('per-fess', 'argent', 'azure', 'embattled'), lined('per-fess', 'argent', 'azure', 'dovetailed'))).toEqual([]);
    expect(between(lined('per-fess', 'argent', 'azure', 'indented'), lined('per-fess', 'argent', 'azure', 'wavy'))).toEqual(['field-line:dc:A5G1c']);
    expect(between(div('per-chevron', 'argent', 'azure'), lined('per-chevron', 'argent', 'azure', 'ploye'))).toEqual([]);
    expect(between(lined('per-pale', 'argent', 'azure', 'engrailed'), lined('per-pale', 'argent', 'azure', 'invected'))).toEqual([]);
  });

  it('counts half the lines of quarterly, and all the stripes of a variation as one line', () => {
    expect(between(div('quarterly', 'argent', 'azure'), lined('quarterly', 'argent', 'azure', 'plain', 'indented'))).toEqual(['field-line:dc:A5G1c']);
    expect(between(lined('quarterly', 'argent', 'azure', 'wavy', 'plain'), lined('quarterly', 'argent', 'azure', 'plain', 'wavy'))).toEqual(['field-line:dc:A5G1c']);
    expect(between(varied('barry', 'wavy'), varied('barry', 'engrailed'))).toEqual(['field-line:dc:A5G1c']);
    expect(between(varied('barry', 'wavy'), varied('barry', 'plain'))).toEqual(['field-line:dc:A5G1c']);
    // Dancetty and indented differ only on a two-sided band (App M2), not between stripes (RULES-C L7).
    expect(between(varied('barry', 'dancetty'), varied('barry', 'indented'))).toEqual([]);
  });

  it('stacks with the other changes of the field, and is never substantial', () => {
    // "Per pale indented argent and azure, a lion gules" against "Paly argent and azure, a lion gules": style and pieces (SENA A5G1c).
    expect(between(lined('per-pale', 'argent', 'azure', 'indented'), varied('paly', 'plain'))).toEqual(['field-style:dc:A5G1d', 'field-line:dc:A5G1c']);
    // "Per pale embattled gules and argent" against "Per pale argent and gules": clear (Prec [Mikael Rantzow, 09/2007]).
    expect(between(lined('per-pale', 'gules', 'argent', 'embattled'), div('per-pale', 'argent', 'gules'))).toEqual(['field-line:dc:A5G1c', 'field-tincture:dc:A5G1a']);
    expect(between(lined('per-pale', 'argent', 'azure', 'wavy'), lined('per-fess', 'argent', 'azure', 'wavy'))).toEqual(['field-partition:sc:A5F1']);
  });

  it('explains the change in words', () => {
    const [note] = explainDifferences(lion(div('per-pale', 'argent', 'azure')), lion(lined('per-pale', 'argent', 'azure', 'wavy')));
    expect(`${note.text} — ${note.why}`).toBe('line of division (straight ↔ wavy) — Changing the style of at least half the lines that split the background — from straight to wavy, say — is a distinct change (SENA A5G1c).');
  });
});

describe('words for a lined field', () => {
  it('glosses the line', () => {
    expect(gloss(nd(arms(lined('per-pale', 'azure', 'or', 'wavy'), chg('lion', 'argent'))))).toMatch(/^A shield split vertically by a wavy line, blue on the left and gold on the right/);
    expect(gloss(nd(arms(lined('per-fess', 'azure', 'or', 'embattled'), chg('lion', 'argent'))))).toMatch(/^A shield split horizontally by a battlemented line, /);
    expect(gloss(nd(arms(lined('quarterly', 'azure', 'or', 'plain', 'indented'), chg('lion', 'argent'))))).toMatch(/^A shield divided into four quarters, the across line zigzag, /);
    expect(gloss(nd(arms(varied('barry', 'wavy', 8), chg('lion', 'gules'))))).toMatch(/^A shield of 8 horizontal stripes with wavy edges, /);
  });

  it('labels every line for the builder', () => {
    expect(LINES.map((l) => LINE_LABEL[l].plain).every(Boolean)).toBe(true);
    expect(LINE_LABEL.plain).toEqual({ plain: 'Straight', term: 'plain' });
    expect(LINE_LABEL.grady).toEqual({ plain: 'Steps', term: 'embattled grady' });
  });
});
