// Phase C's divisions in three parts: per pall, per pall inverted, tierced in pale and tierced in fess. They tile every shape, take the
// three-part tincture rules (SENA A3B3b; RULES-C §E.2), read in the words, are weighed by area for a change of tincture, and the builder
// sets each part.

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, blazon, differences, divisionRegions, fieldTinctureChoices, gloss, partIndexAt, pathPolygon, pathRings, pointInPolygon, shapeFrame,
  signature, unsupportedIssues, validate, groupTinctureChoices, type Design, type DividedField, type FieldShape, type Line,
} from '../src/lib/heraldry';
import { setDivision, setFieldTincture } from '../src/lib/builder';
import { arms, charge, div, group, nd, ordinary } from './helpers';

type Pt = [number, number];
type Three = 'per-pall' | 'per-pall-inverted' | 'tierced-per-pale' | 'tierced-per-fess';
const THREE: readonly Three[] = ['per-pall', 'per-pall-inverted', 'tierced-per-pale', 'tierced-per-fess'];

const field = (division: Three, line: Line): DividedField => ({
  k: 'divided', division, lines: { a: line, b: line }, pieces: null, paints: [{ k: 'tincture', t: 'argent' }, { k: 'tincture', t: 'gules' }, { k: 'tincture', t: 'azure' }],
});

/** Points of a grid over the shape, inside its outline. */
function gridIn(shape: FieldShape, step: number): Pt[] {
  const outline = pathPolygon(shapeFrame(shape).outline);
  const out: Pt[] = [];
  for (let x = 0.7; x < 100; x += step) for (let y = 0.7; y < 120; y += step) if (pointInPolygon(x, y, outline)) out.push([x, y]);
  return out;
}

const inside = (d: string, x: number, y: number) => pathRings(d).filter((r) => pointInPolygon(x, y, r)).length % 2 === 1;
const issues = (d: Design) => validate(d).map((i) => i.message);
const ERMINE = { k: 'fur', fur: 'ermine', colours: null };
/** A field in three whose first part is ermine. */
const ermineFirst = (division: Three, b: string, c: string) => ({ k: 'divided', division, parts: [ERMINE, b, c] });

describe('the divisions in three parts', () => {
  for (const shape of FIELD_SHAPES) {
    it(`tile the ${shape} in three, and partIndexAt follows the regions, plain and lined`, () => {
      const points = gridIn(shape, 3.1);
      const wrong: string[] = [];
      for (const division of THREE) {
        for (const line of ['plain', 'wavy', 'embattled'] as const) {
          const f = field(division, line);
          const regions = divisionRegions(f.division, f.lines, null, shape);
          expect(regions).toHaveLength(3);
          for (const [x, y] of points) {
            const hit = regions.map((r) => inside(r, x, y));
            const near = (dx: number, dy: number) => regions.some((r, i) => inside(r, x + dx, y + dy) !== hit[i]);
            const n = hit.filter(Boolean).length;
            if (n !== 1 && !(near(0.2, 0) || near(-0.2, 0) || near(0, 0.2) || near(0, -0.2))) wrong.push(`${division} ${line} (${x}, ${y}) in ${n}`);
            else if (n === 1 && partIndexAt(f, shape, x, y) !== hit.indexOf(true) && !near(0.2, 0) && !near(0, 0.2)) wrong.push(`${division} ${line} (${x}, ${y}) partIndexAt`);
          }
        }
      }
      expect(wrong.slice(0, 8)).toEqual([]);
    });
  }

  it('put each part where the blazon names it: per pall chief, dexter, sinister; inverted dexter, sinister, base; tierced in order', () => {
    const at = (division: Three, x: number, y: number) => partIndexAt(field(division, 'plain'), 'heater', x, y);
    expect([at('per-pall', 50, 10), at('per-pall', 15, 60), at('per-pall', 85, 60)]).toEqual([0, 1, 2]);
    expect([at('per-pall-inverted', 15, 30), at('per-pall-inverted', 85, 30), at('per-pall-inverted', 50, 100)]).toEqual([0, 1, 2]);
    expect([at('tierced-per-pale', 10, 50), at('tierced-per-pale', 50, 50), at('tierced-per-pale', 90, 50)]).toEqual([0, 1, 2]);
    expect([at('tierced-per-fess', 50, 10), at('tierced-per-fess', 50, 50), at('tierced-per-fess', 50, 100)]).toEqual([0, 1, 2]);
    // the per pall's arms run from the fess point to the top corners
    expect([at('per-pall', 20, 18), at('per-pall', 20, 22)]).toEqual([0, 1]);
  });
});

describe('the tincture rules of a field in three', () => {
  it('needs one part of a per pall to contrast with both others, and no two parts alike (SENA A3B3a, A3B3b)', () => {
    expect(issues(nd(arms(ermineFirst('per-pall', 'sable', 'gules'))))).toEqual([]);
    expect(issues(nd(arms(div('per-pall', 'or', 'sable', 'purpure'))))).toEqual([]);
    expect(issues(nd(arms(div('per-pall', 'gules', 'sable', 'azure'))))).toEqual(['Per pall needs one part to contrast with both others (SENA A3B3b), and none of Gules, Sable and Azure does.']);
    expect(issues(nd(arms(div('per-pall', 'argent', 'gules', 'argent'))))).toEqual(['A divided field needs different tinctures — two parts are Argent.']);
  });

  it('needs the middle of a tierced field to contrast with both outer parts, and calls alike outer parts a pale (RULES-C §E.2, L11, L24)', () => {
    expect(issues(nd(arms(div('tierced-per-pale', 'azure', 'argent', 'gules'))))).toEqual([]);
    expect(issues(nd(arms(div('tierced-per-fess', 'argent', 'gules', 'or'))))).toEqual([]);
    expect(issues(nd(arms(div('tierced-per-pale', 'argent', 'azure', 'gules'))))).toEqual(['Tierced in pale needs its middle part to contrast with both outer parts — a metal between colours, or a colour between metals (RULES-C §E.2): Argent, Azure and Gules don\'t.']);
    expect(issues(nd(arms(div('tierced-per-pale', 'azure', 'argent', 'azure'))))).toEqual(['That is a pale: choose a Background of Azure with a pale Argent.']);
    expect(issues(nd(arms(div('tierced-per-fess', 'vert', 'or', 'vert'))))).toEqual(['That is a fess: choose a Background of Vert with a fess Or.']);
  });

  it('lays a chief on a per pall on its chief part alone (SENA A3B4a: "a chief sable is fine, a chief Or is not")', () => {
    const chief = (t: string) => nd(arms(div('per-pall', 'argent', 'gules', 'azure'), group(ordinary('chief'), t)));
    expect(issues(chief('sable'))).toEqual([]);
    expect(issues(chief('or'))).toHaveLength(1);
    expect(issues(chief('argent'))).toHaveLength(1);
  });

  it('refuses a complex line between sable and azure across a per pall, and a charge over a complex line between two colours (SENA App H, RULES-C L12)', () => {
    expect(issues(nd(arms({ ...div('per-pall', 'argent', 'sable', 'azure'), lines: { a: 'wavy' } })))).toEqual([expect.stringMatching(/wavy line between Sable and Azure can't be seen/)]);
    expect(issues(nd(arms({ ...div('per-pall', 'argent', 'sable', 'azure') })))).toEqual([]);
    const over = nd(arms({ ...div('per-pall', 'argent', 'gules', 'vert'), lines: { a: 'embattled' } }, group(charge('roundel'), 'or')));
    expect(issues(over).some((m) => /embattled line hides it/.test(m))).toBe(true);
  });

  it('keeps counterchanged a gap over three parts, and the builder does not offer it', () => {
    const d = nd(arms(div('per-pall', 'argent', 'gules', 'azure'), group(charge('mullet'), 'counterchanged')));
    expect(unsupportedIssues(d).map((i) => `${i.gap.category}:${i.gap.detail}`)).toEqual(['division:counterchanged-over-three-parts']);
    const plain = nd(arms(div('per-pall', 'argent', 'gules', 'azure'), group(charge('mullet'), 'or')));
    expect(groupTinctureChoices(plain, [0]).map((c) => c.value)).not.toContain('counterchanged');
  });

  it('sets three charges one in each part and two in fess on a per pall (GoT Table 7)', () => {
    const on = (division: Three, count: number) => nd(arms(div(division, 'argent', 'gules', 'azure'), group(charge('mullet'), 'or', { count }))).groups[0].arrangement;
    expect(on('per-pall', 3)).toEqual({ k: 'rows', rows: [1, 2] });
    expect(on('per-pall-inverted', 3)).toEqual({ k: 'rows', rows: [2, 1] });
    expect(on('tierced-per-pale', 3)).toEqual({ k: 'line', dir: 'fess' });
    expect(on('tierced-per-fess', 3)).toEqual({ k: 'line', dir: 'pale' });
    expect(on('per-pall', 2)).toEqual({ k: 'line', dir: 'fess' });
  });
});

describe('the words of a field in three', () => {
  it('blazons "A, B and C" in blazon order, without the serial comma', () => {
    const cases: Array<[unknown, string]> = [
      [ermineFirst('per-pall', 'sable', 'gules'), 'Per pall ermine, sable and gules'],
      [div('per-pall-inverted', 'argent', 'sable', 'gules'), 'Per pall inverted argent, sable and gules'],
      [div('tierced-per-pale', 'azure', 'argent', 'gules'), 'Tierced in pale azure, argent and gules'],
      [div('tierced-per-fess', 'gules', 'argent', 'vert'), 'Tierced in fess gules, argent and vert'],
      [{ ...div('per-pall', 'or', 'gules', 'argent'), lines: { a: 'wavy' } }, 'Per pall wavy Or, gules and argent'],
    ];
    for (const [fieldInput, words] of cases) expect(blazon(nd(arms(fieldInput)))).toBe(`${words}.`);
    expect(blazon(nd(arms(div('per-pall', 'or', 'sable', 'purpure'), group(ordinary('chief'), 'vert'))))).toBe('Per pall Or, sable and purpure, a chief vert.');
  });

  it('glosses each part where it lies', () => {
    expect(gloss(nd(arms(div('per-pall', 'or', 'azure', 'gules'))))).toMatch(/by a Y, gold at the top, blue on the left and red on the right/);
    expect(gloss(nd(arms(div('tierced-per-fess', 'gules', 'argent', 'vert'))))).toMatch(/three level stripes, red on top, white in the middle and green below/);
  });

  it('signs all three parts in order', () => {
    expect(signature(nd(arms(div('per-pall', 'or', 'azure', 'gules'))))).toBe('arms|per-pall(or,az,gu)');
  });
});

describe('conflict over a field in three', () => {
  const g = (d: unknown) => nd(arms(d, group(charge('wolf'), 'vert')));
  const kinds = (a: Design, b: Design) => differences(a, b).map((x) => `${x.attr}:${x.kind}`);

  it('changes the tincture only where at least half the field does (A5G1a; RULES-C §E.2)', () => {
    // one part of three is not half
    expect(kinds(g(div('per-pall', 'argent', 'gules', 'azure')), g(div('per-pall', 'argent', 'gules', 'sable')))).toEqual([]);
    expect(kinds(g(div('tierced-per-pale', 'azure', 'argent', 'gules')), g(div('tierced-per-pale', 'azure', 'or', 'gules')))).toEqual([]);
    // two parts swapped cover two thirds
    expect(kinds(g(div('per-pall', 'argent', 'gules', 'azure')), g(div('per-pall', 'argent', 'azure', 'gules')))).toEqual(['field-tincture:dc']);
    expect(kinds(g(div('tierced-per-pale', 'azure', 'argent', 'gules')), g(div('tierced-per-pale', 'gules', 'argent', 'azure')))).toEqual(['field-tincture:dc']);
  });

  it('keeps per pall and per pall inverted apart, and tierced with per pale and per fess', () => {
    expect(kinds(g(div('per-pall', 'argent', 'gules', 'azure')), g(div('per-pall-inverted', 'argent', 'gules', 'azure')))).toEqual(['field-partition:sc']);
    expect(kinds(g(div('per-pall', 'argent', 'gules', 'azure')), g(div('per-saltire', 'argent', 'gules')))).toEqual(['field-partition:sc']);
    // tierced in pale is per pale cut once more: a change of the number of pieces (A5G1d); the middle third alone changes tincture
    expect(kinds(g(div('tierced-per-pale', 'azure', 'argent', 'gules')), g(div('per-pale', 'azure', 'gules')))).toEqual(['field-style:dc']);
    expect(kinds(g(div('tierced-per-fess', 'azure', 'argent', 'gules')), g(div('per-fess', 'azure', 'gules')))).toEqual(['field-style:dc']);
  });
});

describe('the builder on a field in three', () => {
  it('gives three contrasting parts when the background is divided in three', () => {
    const d = setDivision(nd(arms('azure')), 'per-pall');
    expect(d.kind === 'arms' && d.field.k === 'divided' && d.field.parts).toEqual([{ k: 'tincture', t: 'azure' }, { k: 'tincture', t: 'or' }, { k: 'tincture', t: 'gules' }]);
    expect(validate(d)).toEqual([]);
    for (const division of THREE) expect(validate(setDivision(nd(arms('or')), division)), division).toEqual([]);
    // back to two parts drops the third
    expect(setDivision(d, 'per-pale').field).toMatchObject({ division: 'per-pale', parts: [{ t: 'azure' }, { t: 'or' }] });
  });

  it('blocks on each part the tinctures the other two have', () => {
    const d = setDivision(nd(arms('azure')), 'tierced-per-pale');
    const blocked = (part: 0 | 1 | 2) => fieldTinctureChoices(d, part).filter((c) => !c.allowed).map((c) => c.value);
    expect(blocked(0)).toEqual(['or', 'gules']);
    expect(blocked(2)).toEqual(['or', 'azure']);
    expect(fieldTinctureChoices(d, 2).find((c) => c.value === 'or')).toMatchObject({ allowed: false, reason: 'The middle part is already Or — a divided field needs three different tinctures.' });
    expect(setFieldTincture(d, 2, 'gules').field).toMatchObject({ parts: [{ t: 'azure' }, { t: 'or' }, { t: 'gules' }] });
  });
});
