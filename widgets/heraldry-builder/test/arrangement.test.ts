// Layouts and GoT Table 7: the default layout of a group, the layouts it can take, the keys that name
// them, and when a layout is forced or has to be worded.

import { describe, it, expect } from 'vitest';
import {
  defaultLayout, fieldContext, hostCounts, isForced, layoutCandidates, layoutContext, layoutKey, layoutOfKey, layoutWords, ROW_PATTERNS, statesLayout, tableDefault,
  UnsupportedConstructError, type Design, type Layout,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary } from './helpers';
import { generatedDesigns } from './design-generator';

/** The Table 7 default key of `count` charges of `paint` on `field` ("null" = none, must be specified). */
function table(field: unknown, count: number, paint = 'gules', id = 'rose', ...more: object[]): string | null {
  const d = nd(arms(field, group(charge(id), paint, { count }), ...more));
  const layout = tableDefault(d, [d.groups.findIndex((g) => g.role === 'primary')]);
  return layout && layoutKey(layout);
}

const candidates = (d: Design, path: number[], count: number) => layoutCandidates(d, path, count).map(layoutKey);

describe('Table 7: primary charges', () => {
  it('one charge is centred', () => {
    expect(table('or', 1)).toBe('single');
    expect(table(div('per-pale', 'or', 'azure'), 1)).toBe('single');
  });

  it('two charges: none on a plain field, one in each section of a field divided in 2', () => {
    expect(table('or', 2)).toBeNull();
    expect(table(div('per-pale', 'or', 'azure'), 2)).toBe('in-fess');
    expect(table(div('per-fess', 'or', 'azure'), 2)).toBe('in-pale');
    expect(table(div('per-bend', 'or', 'azure'), 2)).toBe('in-bend-sinister');
    expect(table(div('per-bend-sinister', 'or', 'azure'), 2)).toBe('in-bend');
    expect(table(div('per-chevron', 'or', 'azure'), 2)).toBe('in-pale');
  });

  it('two charges on a field divided in 4: one in each section with good contrast, else none', () => {
    // GoT: in Quarterly argent and vert, two vert badgers go in bend, because they can't lie on the vert quarters.
    expect(table(div('quarterly', 'argent', 'vert'), 2, 'vert')).toBe('in-bend');
    expect(table(div('quarterly', 'argent', 'vert'), 2, 'argent')).toBe('in-bend-sinister');
    expect(table(div('per-saltire', 'argent', 'vert'), 2, 'vert')).toBe('in-pale');
    expect(table(div('per-saltire', 'argent', 'vert'), 2, 'argent')).toBe('in-fess');
    expect(table(div('quarterly', 'argent', 'or'), 2, 'sable')).toBeNull();
    expect(table(div('quarterly', 'argent', 'vert'), 2, 'counterchanged')).toBeNull();
  });

  it('three: two and one, whatever the field', () => {
    for (const field of ['or', div('per-pale', 'or', 'azure'), div('per-chevron', 'or', 'azure'), div('quarterly', 'or', 'azure')]) {
      expect(table(field, 3)).toBe('rows-2-1');
    }
  });

  it('four: two and two on quarterly, in cross on per saltire, otherwise none', () => {
    expect(table(div('quarterly', 'or', 'azure'), 4)).toBe('rows-2-2');
    expect(table(div('per-saltire', 'or', 'azure'), 4)).toBe('in-cross');
    expect(table('or', 4)).toBeNull();
    expect(table(div('per-pale', 'or', 'azure'), 4)).toBeNull();
  });

  it('five: two, two and one', () => {
    expect(table('or', 5)).toBe('rows-2-2-1');
    expect(table(div('per-pale', 'or', 'azure'), 5)).toBe('rows-2-2-1');
  });

  it('six: three, two and one on a plain field only', () => {
    expect(table('or', 6)).toBe('rows-3-2-1');
    expect(table(div('per-pale', 'or', 'azure'), 6)).toBeNull();
  });

  it('ten: four, three, two and one; the other counts have none', () => {
    expect(table('or', 10)).toBe('rows-4-3-2-1');
    for (const n of [7, 8, 9, 11, 12]) expect(table('or', n)).toBeNull();
  });
});

describe('Table 7: no-contrast forcing', () => {
  it('puts a charge that matches a half of a per fess field in the other half', () => {
    expect(table(div('per-fess', 'or', 'vert'), 1, 'vert')).toBe('in-chief');
    expect(table(div('per-fess', 'or', 'vert'), 1, 'or')).toBe('in-base');
    expect(table(div('per-fess', 'or', 'vert'), 3, 'vert')).toBe('in-chief');
  });

  it('does the same on per chevron, with a line fess for several charges', () => {
    const d = nd(arms(div('per-chevron', 'vert', 'or'), group(charge('sun', { mods: ['in-splendour'] }), 'or', { count: 2 })));
    expect(d.groups[0].position).toBe('chief');
    expect(d.groups[0].arrangement).toEqual({ k: 'line', dir: 'fess' });
  });

  it('takes precedence over the count rules', () => {
    expect(table(div('per-fess', 'argent', 'vert'), 2, 'argent')).toBe('in-base');
    expect(table(div('per-fess', 'argent', 'vert'), 5, 'vert')).toBe('in-chief');
  });

  it('needs the charge to contrast with the other half', () => {
    expect(table(div('per-fess', 'azure', 'vert'), 1, 'azure')).toBe('single');
    expect(table(div('per-fess', 'or', 'argent'), 1, 'or')).toBe('single');
  });

  it('does not apply to other divisions, to other tinctures or under a chief', () => {
    expect(table(div('per-pale', 'or', 'vert'), 1, 'vert')).toBe('single');
    expect(table(div('per-fess', 'or', 'vert'), 1, 'gules')).toBe('single');
    expect(table(div('per-fess', 'or', 'vert'), 1, 'vert', 'rose', group(ordinary('chief'), 'argent'))).toBe('single');
  });
});

describe('Table 7: secondary and tertiary groups', () => {
  it('are placed by the host', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }), group(charge('mullet'), 'argent', { count: 3 })));
    expect(layoutKey(tableDefault(d, [1])!)).toBe('host');
    expect(layoutKey(tableDefault(d, [0, 0])!)).toBe('host');
    expect(candidates(d, [1], 3)).toEqual(['host']);
    expect(candidates(d, [0, 0], 5)).toEqual(['host']);
    expect(layoutContext(d, [1])).toEqual({ k: 'between', ordinary: 'fess', peripheral: 'none' });
    expect(layoutContext(d, [0, 0])).toEqual({ k: 'on', ordinary: 'fess', peripheral: 'none' });
  });

  it('knows the chief and bordure beside the group it sits around or on', () => {
    const d = nd(arms('azure', group(ordinary('pale'), 'or', { charged: [group(charge('rose'), 'gules', { count: 2 })] }), group(charge('mullet'), 'argent', { count: 2 }),
      group(ordinary('chief'), 'argent'), group(ordinary('bordure'), 'argent')));
    expect(layoutContext(d, [1])).toEqual({ k: 'between', ordinary: 'pale', peripheral: 'chief-bordure' });
    expect(layoutContext(d, [0, 0])).toEqual({ k: 'on', ordinary: 'pale', peripheral: 'chief-bordure' });
    // A chief is not its own peripheral: charges on it know of the bordure alone.
    const chiefly = nd(arms('azure', group(ordinary('chief'), 'or', { charged: [group(charge('rose'), 'gules', { count: 2 })] }), group(ordinary('bordure'), 'argent')));
    expect(layoutContext(chiefly, [0, 0])).toEqual({ k: 'on', ordinary: 'chief', peripheral: 'bordure' });
  });

  it('has a layout only for the counts of the table', () => {
    expect(hostCounts('between', 'fess')).toEqual([2, 3, 4, 6]);
    expect(hostCounts('between', 'pale')).toEqual([2, 4, 6]);
    expect(hostCounts('between', 'chevron')).toEqual([2, 3, 6]);
    expect(hostCounts('between', 'cross')).toEqual([4]);
    expect(hostCounts('between', 'pile')).toEqual([2]);
    expect(hostCounts('between', 'canton')).toEqual([]);
    expect(hostCounts('on', 'chief')).toHaveLength(12);
    expect(hostCounts('on', 'cross')).toEqual([1, 4, 5]);
    expect(hostCounts('on', 'pile')).toEqual([1, 2, 3]);
    expect(hostCounts('on', 'bordure')).toHaveLength(12);
  });

  it('has no layout context where the builder has none', () => {
    const overall = nd(arms('azure', group(ordinary('bend'), 'or'), group(charge('rose'), 'gules', { role: 'overall' })));
    expect(() => layoutContext(overall, [1])).toThrow(UnsupportedConstructError);
    const onCharge = nd(arms('azure', group(charge('lion'), 'or', { charged: [group(charge('rose'), 'gules')] })));
    expect(() => layoutContext(onCharge, [0, 0])).toThrow(UnsupportedConstructError);
    expect(() => tableDefault(onCharge, [0, 0])).toThrow(UnsupportedConstructError);
    expect(layoutContext(onCharge, [0])).toEqual(fieldContext('none'));
  });
});

describe('layout candidates', () => {
  const plain = (count: number, id = 'rose', ...more: object[]) => {
    const d = nd(arms('or', group(charge(id), 'gules', { count: Math.max(count, 1) }), ...more));
    return candidates(d, [0], count);
  };

  it('lists the table default first, then rows, lines, patterns, annulo, orle and positions', () => {
    expect(plain(1)).toEqual(['single', 'in-chief', 'in-base']);
    expect(plain(2)).toEqual(['in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-chief', 'in-base']);
    expect(plain(3)).toEqual(['rows-2-1', 'rows-1-2', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-annulo', 'in-chief', 'in-base']);
    expect(plain(5)).toEqual(['rows-2-2-1', 'rows-3-2', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-cross', 'in-saltire', 'in-annulo', 'in-orle', 'in-chief', 'in-base']);
    expect(plain(6)).toEqual(['rows-3-2-1', 'rows-2-2-2', 'rows-3-3', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-annulo', 'in-orle', 'in-chief', 'in-base']);
  });

  it('offers a ring of two only to fish, which curl round each other', () => {
    expect(plain(2, 'fish')).toContain('in-annulo');
    expect(plain(2, 'lion')).not.toContain('in-annulo');
    expect(plain(3, 'lion')).toContain('in-annulo');
  });

  it('puts the first row pattern of a count first when the table has no default', () => {
    expect(plain(4)).toEqual(['rows-2-2', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-cross', 'in-saltire', 'in-annulo', 'in-chief', 'in-base']);
    expect(plain(12)[0]).toBe('rows-4-4-4');
  });

  it('offers crossed for two long charges only', () => {
    expect(plain(2, 'sword')).toContain('crossed');
    expect(plain(2, 'rose')).not.toContain('crossed');
    expect(plain(3, 'sword')).not.toContain('crossed');
  });

  it('leaves out orle and the positions chief and base where they would not fit', () => {
    const withChief = plain(5, 'rose', group(ordinary('chief'), 'argent'));
    expect(withChief).not.toContain('in-chief');
    expect(withChief).not.toContain('in-base');
    expect(withChief).not.toContain('in-orle');
    const withBordure = plain(5, 'rose', group(ordinary('bordure'), 'argent'));
    expect(withBordure).not.toContain('in-orle');
    expect(withBordure).toContain('in-chief');
  });

  it('starts with the forced layout where the table forces one', () => {
    const d = nd(arms(div('per-fess', 'or', 'vert'), group(charge('rose'), 'vert')));
    expect(candidates(d, [0], 1)).toEqual(['in-chief', 'in-base', 'single']);
  });

  it('offers only single for an ordinary', () => {
    const d = nd(arms('azure', group(ordinary('bend'), 'or')));
    expect(candidates(d, [0], 1)).toEqual(['single']);
    expect(layoutKey(defaultLayout(d, [0]))).toBe('single');
    expect(tableDefault(d, [0])).toEqual({ arrangement: { k: 'single' }, position: null });
  });

  it('has a default for every count that is one of the candidates', () => {
    const d = nd(arms('or', group(charge('rose'), 'gules')));
    for (let n = 1; n <= 12; n++) {
      const keys = candidates(d, [0], n);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it('uses the table default, else the first candidate, as the default layout', () => {
    const d = nd(arms('or', group(charge('rose'), 'gules', { count: 2 })));
    expect(tableDefault(d, [0])).toBeNull();
    expect(layoutKey(defaultLayout(d, [0]))).toBe('in-pale');
    const three = nd(arms('or', group(charge('rose'), 'gules', { count: 3 })));
    expect(layoutKey(defaultLayout(three, [0]))).toBe('rows-2-1');
  });
});

describe('layout keys', () => {
  it('round trips every candidate of every count', () => {
    for (const field of ['or', div('per-fess', 'or', 'vert'), div('quarterly', 'argent', 'vert')]) {
      for (let n = 1; n <= 12; n++) {
        const d = nd(arms(field, group(charge('sword'), 'vert', { count: n })));
        for (const l of layoutCandidates(d, [0], n)) {
          expect(layoutOfKey(layoutKey(l), n), `${n} ${layoutKey(l)}`).toEqual(l);
        }
      }
    }
  });

  it('names the layouts', () => {
    const k = (arrangement: Layout['arrangement'], position: Layout['position'] = null) => layoutKey({ arrangement, position });
    expect(k({ k: 'single' })).toBe('single');
    expect(k({ k: 'single' }, 'chief')).toBe('in-chief');
    expect(k({ k: 'line', dir: 'fess' }, 'base')).toBe('in-base');
    expect(k({ k: 'line', dir: 'bend-sinister' })).toBe('in-bend-sinister');
    expect(k({ k: 'rows', rows: [3, 2, 1] })).toBe('rows-3-2-1');
    expect(k({ k: 'pattern', pattern: 'orle' })).toBe('in-orle');
    expect(k({ k: 'host' })).toBe('host');
    expect(k({ k: 'crossed' })).toBe('crossed');
    expect(k({ k: 'pair', pair: 'addorsed' })).toBe('pair-addorsed');
    expect(k({ k: 'single' }, 'canton')).toBe('single@canton');
    expect(k({ k: 'line', dir: 'pale' }, 'dexter')).toBe('in-pale@dexter');
  });

  it('keeps layouts that differ in position distinct', () => {
    const keys = new Set(['dexter-chief', 'sinister-chief', 'dexter', 'sinister', 'canton', 'flank', 'fess-point', 'chief', 'base']
      .map((position) => layoutKey({ arrangement: { k: 'single' }, position: position as never })));
    expect(keys.size).toBe(9);
  });

  it('turns in-chief and in-base into a single charge or a line fess by the count', () => {
    expect(layoutOfKey('in-chief', 1)).toEqual({ arrangement: { k: 'single' }, position: 'chief' });
    expect(layoutOfKey('in-base', 4)).toEqual({ arrangement: { k: 'line', dir: 'fess' }, position: 'base' });
  });

  it('rejects unknown keys', () => {
    for (const key of ['', 'in-circles', 'rows-', 'rows-0-2', 'rows-a', 'single@nowhere', 'in-chief@base', 'single@chief@base', 'rows--1']) {
      expect(layoutOfKey(key, 3), key).toBeNull();
    }
  });

  it('words the layouts as a blazon would', () => {
    const w = (key: string, n = 3) => layoutWords(layoutOfKey(key, n)!);
    expect(w('in-pale')).toBe('in pale');
    expect(w('in-bend-sinister')).toBe('in bend sinister');
    expect(w('rows-2-1')).toBe('two and one');
    expect(w('rows-2-2-1')).toBe('two, two and one');
    expect(w('rows-4-3-2-1')).toBe('four, three, two and one');
    expect(w('in-orle')).toBe('in orle');
    expect(w('crossed', 2)).toBe('in saltire');
    expect(w('in-chief')).toBe('in chief');
    expect(w('single', 1)).toBe('single');
    expect(w('in-fess@dexter-chief')).toBe('in dexter chief');
  });

  it('has the row patterns of the table, summing to their counts', () => {
    for (const r of ROW_PATTERNS) expect(r.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(12);
    expect(ROW_PATTERNS.map((r) => r.join('')).slice(0, 10)).toEqual(['21', '22', '221', '321', '331', '332', '333', '4321', '443', '444']);
  });
});

describe('forced layouts and worded layouts', () => {
  const info = (field: unknown, count: number, paint: string, arrangement?: unknown, id = 'rose') => {
    const d = nd(arms(field, group(charge(id), paint, { count, ...(arrangement ? { arrangement } : {}) })));
    return { forced: isForced(d, [0]), states: statesLayout(d, [0]) };
  };

  it('forces the layout of charges that lack contrast with a section', () => {
    expect(info(div('per-fess', 'or', 'vert'), 3, 'vert')).toEqual({ forced: true, states: false });
    expect(info(div('quarterly', 'argent', 'vert'), 2, 'vert')).toEqual({ forced: true, states: false });
  });

  it('does not force a default the charges could leave', () => {
    expect(info(div('per-pale', 'azure', 'gules'), 2, 'or')).toEqual({ forced: false, states: false });
    expect(info('or', 3, 'gules')).toEqual({ forced: false, states: false });
  });

  it('does not force a forced layout the group has left', () => {
    expect(info(div('per-fess', 'or', 'vert'), 3, 'vert', 'in-pale')).toEqual({ forced: false, states: true });
    expect(info(div('per-fess', 'or', 'vert'), 1, 'vert', 'single')).toEqual({ forced: false, states: false });
  });

  it('always forces secondary and tertiary groups', () => {
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }), group(charge('mullet'), 'argent', { count: 3 })));
    expect(isForced(d, [1])).toBe(true);
    expect(isForced(d, [0, 0])).toBe(true);
    expect(isForced(d, [0])).toBe(false);
  });

  it('states a layout that is not the table default, including where there is none', () => {
    expect(info('or', 2, 'gules')).toEqual({ forced: false, states: true });
    expect(info('or', 3, 'gules', 'in-bend')).toEqual({ forced: false, states: true });
    expect(info('or', 3, 'gules', 'rows-2-1')).toEqual({ forced: false, states: false });
    expect(info('or', 1, 'gules', 'in-chief')).toEqual({ forced: false, states: true });
    expect(info('or', 5, 'gules', 'in-saltire')).toEqual({ forced: false, states: true });
    expect(info('or', 8, 'gules', 'in-orle')).toEqual({ forced: false, states: true });
    expect(info('or', 2, 'gules', 'crossed', 'sword')).toEqual({ forced: false, states: true });
  });

  it('never states a centred single charge, nor the layout of an ordinary, a secondary or a tertiary', () => {
    expect(info('or', 1, 'gules')).toEqual({ forced: false, states: false });
    const d = nd(arms('azure', group(ordinary('fess'), 'or', { charged: [group(charge('rose'), 'gules', { count: 3 })] }), group(charge('mullet'), 'argent', { count: 3 })));
    for (const path of [[0], [1], [0, 0]]) expect(statesLayout(d, path)).toBe(false);
  });

  it('is consistent over generated designs: a default layout is never worded', () => {
    for (const d of generatedDesigns(1, 150)) {
      d.groups.forEach((g, i) => {
        if (g.item.k !== 'charge' || g.role !== 'primary') return;
        const table = tableDefault(d, [i]);
        const isDefault = table !== null && layoutKey(table) === layoutKey({ arrangement: g.arrangement, position: g.position });
        if (isDefault) expect(statesLayout(d, [i])).toBe(false);
      });
    }
  });
});
