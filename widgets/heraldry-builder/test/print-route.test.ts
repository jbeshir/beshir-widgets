// Parsing and building the nametag sheet route, and how many tags go on the sheet.
import { describe, it, expect } from 'vitest';
import { parseHash, printHash } from '../src/lib/route';
import { TAGS_PER_PAGE, sheetTags } from '../src/lib/nametags';

describe('print route', () => {
  it('parses the entry to print', () => {
    expect(parseHash('#/print/abc')).toEqual({ mode: 'print', id: 'abc' });
  });

  it('sends a bare #/print to Your arms', () => {
    expect(parseHash('#/print')).toEqual({ mode: 'yours' });
    expect(parseHash('#/print/')).toEqual({ mode: 'yours' });
  });

  it('decodes the id and survives malformed escapes', () => {
    expect(parseHash('#/print/c%20d')).toEqual({ mode: 'print', id: 'c d' });
    expect(parseHash('#/print/%E0%A4%A')).toEqual({ mode: 'print', id: '%E0%A4%A' });
  });

  it('round-trips through printHash', () => {
    for (const id of ['abc', 'a,b', 'c/d', 'e f']) expect(parseHash(printHash(id))).toEqual({ mode: 'print', id });
  });

  it('leaves the other routes alone', () => {
    expect(parseHash('#/a/xyz')).toEqual({ mode: 'entry', id: 'xyz' });
    expect(parseHash('#/')).toEqual({ mode: 'builder' });
    expect(parseHash('#/printer')).toEqual({ mode: 'builder' });
  });
});

describe('sheetTags', () => {
  it('prints the tag once or fills a page of eight', () => {
    expect(TAGS_PER_PAGE).toBe(8);
    expect(sheetTags('a', 'one')).toEqual(['a']);
    expect(sheetTags('a', 'fill')).toEqual(Array.from({ length: 8 }, () => 'a'));
  });
});
