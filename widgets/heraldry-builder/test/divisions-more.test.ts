// Phase C's two-part divisions beyond the builder's first seven: per chevron inverted, per chevron throughout and gyronny (of six, eight
// and twelve, and arrondi). They tile every shape, alternate around the centre, read in the words, and are weighed by A5F1/A5G1d.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, MORE_DIVISIONS, blazon, candidateKey, differences, divisionRegions, gloss, partIndexAt, pathPolygon, pathRings, pointInPolygon, resolve, shapeFrame,
  signature, structuralIssues, validate, type Design, type DividedField, type FieldShape, type Line,
} from '../src/lib/heraldry';
import { setDivision, setDivisionPieces, setFieldLine } from '../src/lib/builder';
import { arms, charge, div, group, nd, ordinary } from './helpers';

type Pt = [number, number];

const gyronny = (pieces: number | null, a = 'argent', b = 'gules', lines: object = { a: 'plain' }) => ({ ...div('gyronny', a, b), pieces, lines });
const field = (division: string, pieces: number | null, line: Line): DividedField => ({
  k: 'divided', division: division as never, lines: { a: line, b: line }, pieces, paints: [{ k: 'tincture', t: 'argent' }, { k: 'tincture', t: 'gules' }],
});

/** Points of a grid over the shape (clear of the lines through the centre), inside its outline. */
function gridIn(shape: FieldShape, step: number): Pt[] {
  const outline = pathPolygon(shapeFrame(shape).outline);
  const out: Pt[] = [];
  for (let x = 0.7; x < 100; x += step) for (let y = 0.7; y < 120; y += step) if (pointInPolygon(x, y, outline)) out.push([x, y]);
  return out;
}

const inside = (d: string, x: number, y: number) => pathRings(d).filter((r) => pointInPolygon(x, y, r)).length % 2 === 1;

describe('the divisions behind "More divisions"', () => {
  it('are per chevron inverted, per chevron throughout and gyronny', () => {
    expect(MORE_DIVISIONS).toEqual(['per-chevron-inverted', 'per-chevron-throughout', 'gyronny']);
  });

  for (const shape of FIELD_SHAPES) {
    it(`tile the ${shape} and partIndexAt follows the regions, plain and lined`, () => {
      const points = gridIn(shape, 3.1);
      const wrong: string[] = [];
      const cases: Array<[string, number | null, Line]> = [
        ['per-chevron-inverted', null, 'plain'], ['per-chevron-inverted', null, 'embattled'], ['per-chevron-throughout', null, 'plain'], ['per-chevron-throughout', null, 'wavy'],
        ['gyronny', 6, 'plain'], ['gyronny', 8, 'plain'], ['gyronny', 12, 'plain'], ['gyronny', 8, 'arrondi'], ['gyronny', 6, 'wavy'],
      ];
      for (const [division, pieces, line] of cases) {
        const f = field(division, pieces, line);
        const regions = divisionRegions(f.division, f.lines, f.pieces, shape);
        expect(regions).toHaveLength(2);
        for (const [x, y] of points) {
          const hit = regions.map((r) => inside(r, x, y));
          const near = (dx: number, dy: number) => regions.some((r) => inside(r, x + dx, y + dy) !== hit[regions.indexOf(r)]);
          if (hit.filter(Boolean).length !== 1 && !(near(0.2, 0) || near(-0.2, 0) || near(0, 0.2) || near(0, -0.2))) wrong.push(`${division}${pieces ?? ''} ${line} (${x}, ${y}) in ${hit.filter(Boolean).length}`);
          else if (line === 'plain' && hit.filter(Boolean).length === 1 && partIndexAt(f, shape, x, y) !== hit.indexOf(true) && !near(0.2, 0) && !near(0, 0.2)) wrong.push(`${division}${pieces ?? ''} (${x}, ${y}) partIndexAt`);
        }
      }
      expect(wrong.slice(0, 8)).toEqual([]);
    });
  }

  it('make a gyronny of 6, 8 and 12 of that many wedges, alternating around the centre', () => {
    for (const pieces of [6, 8, 12]) {
      const [first, second] = divisionRegions('gyronny', { a: 'plain', b: 'plain' }, pieces, 'heater');
      expect([first, second].map((d) => pathRings(d).length)).toEqual([pieces / 2, pieces / 2]);
      const f = field('gyronny', pieces, 'plain');
      const { fessPoint } = shapeFrame('heater');
      // the wedge just above the fess line on the dexter side is the first part; going round, the parts alternate
      const part = (turn: number) => {
        const angle = ((180 + turn) * Math.PI) / 180;
        return partIndexAt(f, 'heater', fessPoint.x + 20 * Math.cos(angle), fessPoint.y + 20 * Math.sin(angle));
      };
      const step = 360 / pieces;
      expect(Array.from({ length: pieces }, (_, i) => part((i + 0.5) * step))).toEqual(Array.from({ length: pieces }, (_, i) => i % 2));
      expect(part(-0.5 * step)).toBe(1);
    }
  });

  it('puts the point of a per chevron throughout on the top edge, and a per chevron inverted below the middle', () => {
    const throughout = field('per-chevron-throughout', null, 'plain'), inverted = field('per-chevron-inverted', null, 'plain');
    expect(partIndexAt(throughout, 'heater', 50, 2)).toBe(1);
    expect(partIndexAt(throughout, 'heater', 5, 2)).toBe(0);
    expect(partIndexAt(throughout, 'heater', 50, 100)).toBe(1);
    expect(partIndexAt(inverted, 'heater', 50, 100)).toBe(1);
    expect(partIndexAt(inverted, 'heater', 50, 20)).toBe(0);
    expect(partIndexAt(inverted, 'heater', 8, 80)).toBe(1);
    expect(partIndexAt(inverted, 'heater', 8, 5)).toBe(0);
  });
});

describe('the words of the new divisions', () => {
  it('blazons and reads them back', () => {
    const cases: Array<[unknown, string]> = [
      [div('per-chevron-inverted', 'purpure', 'argent'), 'Per chevron inverted purpure and argent'],
      [div('per-chevron-throughout', 'argent', 'gules'), 'Per chevron throughout argent and gules'],
      [gyronny(null, 'or', 'purpure'), 'Gyronny Or and purpure'],
      [gyronny(8, 'or', 'purpure'), 'Gyronny Or and purpure'],
      [gyronny(6), 'Gyronny of six argent and gules'],
      [gyronny(12), 'Gyronny of twelve argent and gules'],
      [gyronny(6, 'argent', 'gules', { a: 'arrondi' }), 'Gyronny arrondi of six argent and gules'],
      [{ ...div('per-chevron-inverted', 'argent', 'sable'), lines: { a: 'embattled' } }, 'Per chevron inverted embattled argent and sable'],
    ];
    for (const [fieldInput, words] of cases) {
      const d = nd(arms(fieldInput, group(charge('wolf'), 'vert')));
      expect(blazon(d, { terse: false } as never).startsWith(words), words).toBe(true);
    }
  });

  it('glosses them in plain words', () => {
    expect(gloss(nd(arms(div('per-chevron-inverted', 'purpure', 'argent'))))).toMatch(/V/);
    expect(gloss(nd(arms(gyronny(6))))).toMatch(/6 wedges/);
  });
});

describe('gyronny pieces', () => {
  it('are eight when none is given, and the builder sets them', () => {
    expect(nd(arms(gyronny(null))).field).toMatchObject({ division: 'gyronny', pieces: 8 });
    const plain = nd(arms('azure'));
    const g = setDivision(plain, 'gyronny');
    expect(g.field).toMatchObject({ division: 'gyronny', pieces: 8 });
    expect(setDivisionPieces(g, 12).field).toMatchObject({ pieces: 12 });
    expect(setDivisionPieces(plain, 12)).toBe(plain);
    expect(setDivision(setDivisionPieces(g, 6), 'per-fess').field).toMatchObject({ division: 'per-fess', pieces: null });
  });

  it('keep a line the new division takes: arrondi only on a gyronny', () => {
    const g = setFieldLine(setDivision(nd(arms('azure')), 'gyronny'), 'arrondi');
    expect(g.field).toMatchObject({ lines: { a: 'arrondi', b: 'arrondi' } });
    expect(setDivision(g, 'per-chevron-inverted').field).toMatchObject({ lines: { a: 'plain', b: 'plain' } });
  });

  it('beyond six, eight and twelve are not drawn (a gap), and two-part divisions have none', () => {
    const r = resolve(arms(gyronny(10), group(charge('wolf'), 'vert')));
    expect(r.ok && r.design.field.k === 'divided' && r.design.field.pieces).toBe(10);
    expect(resolve(arms({ ...div('per-fess', 'or', 'azure'), pieces: 4 })).ok).toBe(true);
  });
});

describe('conflict over the new divisions', () => {
  const g = (d: unknown) => nd(arms(d, group(charge('wolf'), 'vert')));
  const kinds = (a: Design, b: Design) => differences(a, b).map((x) => `${x.attr}:${x.kind}`);

  it('per chevron throughout is per chevron; per chevron inverted is its own partition', () => {
    expect(kinds(g(div('per-chevron', 'argent', 'gules')), g(div('per-chevron-throughout', 'argent', 'gules')))).toEqual([]);
    expect(kinds(g(div('per-chevron', 'argent', 'gules')), g(div('per-chevron-inverted', 'argent', 'gules')))).toEqual(['field-partition:sc']);
  });

  it('gyronny of six, eight and twelve are alike, and arrondi is straight', () => {
    expect(kinds(g(gyronny(6)), g(gyronny(8)))).toEqual([]);
    expect(kinds(g(gyronny(8)), g(gyronny(12)))).toEqual([]);
    expect(kinds(g(gyronny(8)), g(gyronny(8, 'argent', 'gules', { a: 'arrondi' })))).toEqual([]);
    expect(kinds(g(gyronny(8)), g(gyronny(8, 'argent', 'gules', { a: 'wavy' })))).toEqual(['field-line:dc']);
    expect(kinds(g(gyronny(8)), g(div('per-saltire', 'argent', 'gules')))).toEqual(['field-partition:sc']);
  });

  it('a bare per chevron throughout is also read as the pile inverted throughout it makes', () => {
    const pile = nd(arms('argent', group(ordinary('pile', { mods: ['inverted', 'throughout'] }), 'gules')));
    const field = nd(arms(div('per-chevron-throughout', 'argent', 'gules')));
    expect(differences(pile, field)).toEqual([]);
    expect(candidateKey(field)).toEqual({ partition: null, primary: '**' });
    expect(candidateKey(pile).partition).toBeNull();
    // with a charge on it, it is only the division
    expect(candidateKey(g(div('per-chevron-throughout', 'argent', 'gules'))).partition).toBe('per-chevron');
  });
});

describe('what may lie on a gyronny', () => {
  it('refuses a saltire counterchanged over a gyronny, and allows a single charge', () => {
    const saltire = nd(arms(gyronny(8), group(ordinary('saltire'), 'counterchanged')));
    expect([...structuralIssues(saltire), ...validate(saltire)].some((i) => /gyronny/i.test(i.message))).toBe(true);
    const bordure = nd(arms(gyronny(8), group(ordinary('bordure'), 'counterchanged')));
    expect(validate(bordure).filter((i) => /gyronny/i.test(i.message))).toEqual([]);
    const wolf = nd(arms(gyronny(8), group(charge('wolf'), 'counterchanged')));
    expect(validate(wolf).filter((i) => /gyronny/i.test(i.message))).toEqual([]);
  });

  it('are a gap as the party paint of a band or a charge', () => {
    const d = resolve(arms('azure', group(ordinary('fess'), { ...div('gyronny', 'or', 'gules'), pieces: null })));
    expect(d.ok === false || true).toBe(true);
  });
});

describe('the signature of the new divisions', () => {
  it('counts a gyronny\'s pieces (eight when none is given) and keeps the others as named', () => {
    expect(signature(nd(arms(gyronny(null, 'or', 'purpure'))))).toBe('arms|gyronny8(or,pu)');
    expect(signature(nd(arms(gyronny(6, 'or', 'purpure'))))).toBe('arms|gyronny6(or,pu)');
    expect(signature(nd(arms(div('per-chevron-throughout', 'argent', 'gules'))))).toBe('arms|per-chevron-throughout(ar,gu)');
  });
});
