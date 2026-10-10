// Parsing and building the nametag sheet route, and choosing which entries go on the sheet.
import { describe, it, expect, vi } from 'vitest';
import { MAX_PRINT_ENTRIES, parseHash, printHash } from '../src/lib/route';
import { TAGS_PER_PAGE, collectNametags, fillPages, paginate, sheetTags, type Nametag } from '../src/lib/nametags';
import { DEFAULT_FIELD_SHAPE, type ShapedDesign } from '../src/lib/heraldry';
import { DEFAULT_DESIGN } from '../src/lib/builder';

describe('print route', () => {
  it('parses a bare #/print as every remembered entry', () => {
    expect(parseHash('#/print')).toEqual({ mode: 'print', ids: [] });
    expect(parseHash('#/print/')).toEqual({ mode: 'print', ids: [] });
  });

  it('parses one or several ids in order, without repeats', () => {
    expect(parseHash('#/print/abc')).toEqual({ mode: 'print', ids: ['abc'] });
    expect(parseHash('#/print/abc,def,abc,,ghi')).toEqual({ mode: 'print', ids: ['abc', 'def', 'ghi'] });
  });

  it('decodes ids and survives malformed escapes', () => {
    expect(parseHash('#/print/a%2Cb,c%20d')).toEqual({ mode: 'print', ids: ['a,b', 'c d'] });
    expect(parseHash('#/print/%E0%A4%A')).toEqual({ mode: 'print', ids: ['%E0%A4%A'] });
  });

  it('caps the number of entries', () => {
    const ids = Array.from({ length: MAX_PRINT_ENTRIES + 10 }, (_, i) => `e${i}`);
    const route = parseHash(printHash(ids));
    expect(route.mode === 'print' && route.ids).toHaveLength(MAX_PRINT_ENTRIES);
  });

  it('round-trips through printHash', () => {
    expect(printHash([])).toBe('#/print');
    for (const ids of [['abc'], ['a,b', 'c/d', 'e f']]) expect(parseHash(printHash(ids))).toEqual({ mode: 'print', ids });
  });

  it('leaves the other routes alone', () => {
    expect(parseHash('#/a/xyz')).toEqual({ mode: 'entry', id: 'xyz' });
    expect(parseHash('#/')).toEqual({ mode: 'builder' });
    expect(parseHash('#/printer')).toEqual({ mode: 'builder' });
  });
});

const arms: ShapedDesign = { design: DEFAULT_DESIGN, shape: DEFAULT_FIELD_SHAPE };
const remembered = (id: string, shield: ShapedDesign | null) => ({ id, displayName: `Name ${id}`, blazon: `Blazon ${id}`, shield });
const loaded = (id: string): Nametag => ({ id, displayName: `Loaded ${id}`, blazon: 'b', arms });

describe('collectNametags', () => {
  it('prints every remembered entry when no ids are given, without any lookup', async () => {
    const load = vi.fn();
    const sheet = await collectNametags([], [remembered('a', arms), remembered('b', arms)], load);
    expect(sheet.tags.map((t) => t.id)).toEqual(['a', 'b']);
    expect(sheet.tags[0]).toEqual({ id: 'a', displayName: 'Name a', blazon: 'Blazon a', arms });
    expect(sheet.missing).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the order asked for and loads entries not remembered with a shield', async () => {
    const load = vi.fn(async (id: string) => loaded(id));
    const sheet = await collectNametags(['z', 'b', 'a'], [remembered('a', arms), remembered('b', null)], load);
    expect(sheet.tags.map((t) => t.displayName)).toEqual(['Loaded z', 'Loaded b', 'Name a']);
    expect(load.mock.calls.map((c) => c[0])).toEqual(['z', 'b']);
  });

  it('reports entries that cannot be found and prints the rest', async () => {
    const sheet = await collectNametags(['a', 'gone'], [remembered('a', arms)], async () => null);
    expect(sheet.tags.map((t) => t.id)).toEqual(['a']);
    expect(sheet.missing).toEqual(['gone']);
  });
});

describe('paginate', () => {
  it('fills pages of eight', () => {
    expect(TAGS_PER_PAGE).toBe(8);
    expect(paginate([])).toEqual([]);
    expect(paginate([1, 2, 3]).map((p) => p.length)).toEqual([3]);
    expect(paginate(Array.from({ length: 17 }, (_, i) => i)).map((p) => p.length)).toEqual([8, 8, 1]);
  });
});

describe('fillPages', () => {
  it('repeats one entry to fill a page of eight', () => {
    expect(fillPages(['a'])).toEqual(Array.from({ length: 8 }, () => 'a'));
  });

  it('shares the places out evenly, copies together, spares to the first tags', () => {
    expect(fillPages(['a', 'b', 'c'])).toEqual(['a', 'a', 'a', 'b', 'b', 'b', 'c', 'c']);
    expect(fillPages(Array.from({ length: 8 }, (_, i) => i))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('fills the last page when there are more tags than one page holds', () => {
    const filled = fillPages(Array.from({ length: 9 }, (_, i) => i));
    expect(filled).toHaveLength(16);
    expect(paginate(filled).map((p) => p.length)).toEqual([8, 8]);
    expect(new Set(filled).size).toBe(9);
  });

  it('gives no tags for no entries', () => {
    expect(fillPages([])).toEqual([]);
  });
});

describe('sheetTags', () => {
  it('prints one of each or fills the sheet', () => {
    expect(sheetTags(['a', 'b'], 'one')).toEqual(['a', 'b']);
    expect(sheetTags(['a', 'b'], 'fill')).toHaveLength(8);
  });
});
