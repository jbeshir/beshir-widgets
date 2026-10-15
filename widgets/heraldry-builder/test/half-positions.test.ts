// Primary charges set in a half or quarter of the field ("in dexter", "in sinister chief"), and the charges GoT Table 7
// forces into the part of a divided field they contrast with (the tinctures say where they stand: the blazon doesn't).

import { describe, expect, it } from 'vitest';
import {
  FIELD_SHAPES, blazon, canonicalSlots, contextSlots, fieldContext, shapeFrame, forcedPosition, isForced, layoutCandidates, layoutKey, layoutOfKey, normalise, tableDefault, tinctureIssues, unsupportedIssues, validate,
  type Design,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd } from './helpers';

/** Which side of the shape's fess point a half or quarter lies on: [x side, y side], 0 for either. */
const SIDES: Record<string, readonly [-1 | 0 | 1, -1 | 0 | 1]> = {
  dexter: [-1, 0], sinister: [1, 0], 'dexter-chief': [-1, -1], 'sinister-chief': [1, -1], 'dexter-base': [-1, 1], 'sinister-base': [1, 1],
};

const mullet = (paint: string, extra: object = {}) => group(charge('mullet'), paint, extra);
const key = (d: Design) => layoutKey({ arrangement: d.groups[0].arrangement, position: d.groups[0].position });
const words = (d: Design) => blazon(d, { stateDefaults: false });

describe('forced into a part of the field', () => {
  it.each([
    ['per-pale', 'argent', 'azure', 'azure', 'single@dexter'],
    ['per-pale', 'argent', 'azure', 'argent', 'single@sinister'],
    ['per-bend', 'argent', 'azure', 'azure', 'single@sinister-chief'],
    ['per-bend', 'argent', 'azure', 'argent', 'single@dexter-base'],
    ['per-bend-sinister', 'argent', 'azure', 'azure', 'single@dexter-chief'],
    ['per-bend-sinister', 'argent', 'azure', 'argent', 'single@sinister-base'],
    ['quarterly', 'argent', 'azure', 'azure', 'single@dexter-chief'],
    ['quarterly', 'argent', 'azure', 'argent', 'single@sinister-chief'],
  ])('a charge of the tincture of one part of %s %s and %s (%s) goes in the other', (division, a, b, paint, expected) => {
    const d = nd(arms(div(division, a, b), mullet(paint)));
    expect(key(d)).toBe(expected);
    expect(forcedPosition(d, [0])).toBe(d.groups[0].position);
    expect(isForced(d, [0])).toBe(true);
    expect(validate(d)).toEqual([]);
    expect(words(d)).toMatch(/^[A-Z][a-z ]+, a mullet (azure|argent)\.?$/);
    expect(words(d).split(', ')[1]).not.toMatch(/dexter|sinister/);
  });

  it('is judged where it stands: the charge lies wholly in one part', () => {
    const d = nd(arms(div('per-bend-sinister', 'argent', 'azure'), mullet('azure', { count: 3 })));
    const slots = canonicalSlots(d, [0]);
    expect(slots).toHaveLength(3);
    for (const s of slots) expect(s.x + s.y).toBeLessThan(100 - s.size / 2);
    expect(tinctureIssues(d)).toEqual([]);
  });

  it('states the arrangement it stands in, regid:92414', () => {
    const d = nd(arms(div('per-bend-sinister', 'argent', 'azure'), mullet('azure', { count: 3, arrangement: 'rows-1-2' })));
    expect(key(d)).toBe('rows-1-2@dexter-chief');
    expect(validate(d)).toEqual([]);
    expect(unsupportedIssues(d)).toEqual([]);
    expect(words(d)).toBe('Per bend sinister argent and azure, three mullets one and two azure.');
    expect(normalise(JSON.parse(JSON.stringify(d)))).toMatchObject({ ok: true });
  });

  it('is the default arrangement of its count in that part', () => {
    const three = nd(arms(div('per-pale', 'argent', 'azure'), mullet('azure', { count: 3 })));
    expect(tableDefault(three, [0])).toMatchObject({ position: 'dexter', arrangement: { k: 'rows', rows: [2, 1] } });
    expect(words(three)).toBe('Per pale argent and azure, three mullets azure.');
    const two = nd(arms(div('per-pale', 'argent', 'azure'), mullet('azure', { count: 2 })));
    expect(key(two)).toBe('in-pale@dexter');
  });

  it('goes only as far as the builder lays out: more than three in a half stays a gap', () => {
    const d = nd(arms(div('per-pale', 'argent', 'azure'), mullet('azure', { count: 4 })));
    expect(tinctureIssues(d)).toMatchObject([{ code: 'unsupported', gap: { detail: 'forced-into-one-part' } }]);
  });

  it('on a field in four, two go one in each of the other quarters', () => {
    const d = nd(arms(div('quarterly', 'argent', 'azure'), mullet('azure', { count: 2 })));
    expect(key(d)).toBe('in-bend');
  });

  it('is not forced under a chief, or when the charge contrasts with both parts', () => {
    expect(validate(nd(arms(div('per-pale', 'argent', 'azure'), mullet('gules'))))).toEqual([]);
    expect(nd(arms(div('per-pale', 'argent', 'azure'), mullet('gules'))).groups[0].position).toBeNull();
  });
});

describe('set in a half or quarter by the blazon', () => {
  it('"in dexter" and "in sinister chief" are layouts of any field without a chief', () => {
    const d = nd(arms(div('per-pale', 'argent', 'azure'), mullet('gules', { arrangement: 'single@dexter' })));
    expect(validate(d)).toEqual([]);
    expect(words(d)).toBe('Per pale argent and azure, in dexter a mullet gules.');
    const base = nd(arms('or', mullet('gules', { arrangement: 'single@sinister-chief' })));
    expect(validate(base)).toEqual([]);
    expect(words(base)).toBe('Or, in sinister chief a mullet gules.');
    expect(canonicalSlots(base, [0])[0]).toMatchObject({ x: expect.any(Number) });
    expect(canonicalSlots(base, [0])[0].x).toBeGreaterThan(50);
    expect(canonicalSlots(base, [0])[0].y).toBeLessThan(50);
  });

  it('words several charges with the position leading and the arrangement after', () => {
    const d = nd(arms('or', mullet('gules', { count: 3, arrangement: 'rows-2-1@dexter-base' })));
    expect(validate(d)).toEqual([]);
    expect(words(d)).toBe('Or, in dexter base three mullets two and one gules.');
    const pale = nd(arms('or', mullet('gules', { count: 2, arrangement: 'in-pale@sinister' })));
    expect(words(pale)).toBe('Or, in sinister two mullets in pale gules.');
  });

  it('offers them as layouts, and none under a chief', () => {
    const d = nd(arms('or', mullet('gules')));
    expect(layoutCandidates(d, [0], 1).map(layoutKey)).toEqual(expect.arrayContaining(['single', 'in-chief', 'single@dexter', 'single@sinister-base']));
    const chief = nd(arms('or', mullet('gules'), group({ k: 'ordinary', type: 'chief' }, 'azure')));
    expect(layoutCandidates(chief, [0], 1).map(layoutKey)).toEqual(['single']);
  });
});

describe('drawn in every shape', () => {
  for (const shape of FIELD_SHAPES) {
    it(`${shape}: charges set in a half or quarter lie wholly inside it, clear of the lines of division`, () => {
      const { x, y } = shapeFrame(shape).fessPoint;
      for (const [position, [sx, sy]] of Object.entries(SIDES)) {
        for (const [count, key] of [[1, 'single'], [2, 'in-pale'], [3, 'rows-2-1']] as const) {
          const layout = layoutOfKey(`${key}@${position}`, count)!;
          const slots = contextSlots(fieldContext('none'), count, layout, shape);
          expect(slots, `${shape} ${count} ${position}`).toHaveLength(count);
          for (const s of slots) {
            const r = s.size / 2;
            if (sx) expect(sx * (s.x - x) - r, `${shape} ${count} ${position} x`).toBeGreaterThan(0);
            if (sy) expect(sy * (s.y - y) - r, `${shape} ${count} ${position} y`).toBeGreaterThan(0);
          }
        }
      }
    });
  }
});
