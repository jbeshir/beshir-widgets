// The standalone picture made from a rendered Shield's markup (lib/exportPicture).
import { describe, it, expect } from 'vitest';
import { UnexportableMarkupError, pictureFileName, pictureStem, standaloneSvg } from '../src/lib/exportPicture';

/** Markup shaped like a serialised Shield: classes, a themed rim, screen-pixel strokes, hatching. */
const SHIELD = [
  '<svg xmlns="http://www.w3.org/2000/svg" class="shield shield-large" viewBox="0 0 100 120" role="img" aria-label="Gules, a bend Or" data-hatching="on" data-shape="round" focusable="false">',
  '<defs><clipPath id="shield-clip-s7"><path d="M0 0H100V120H0Z"/></clipPath>',
  '<pattern id="hatch-s7-or" patternUnits="userSpaceOnUse" width="4" height="4"><circle cx="2" cy="2" r="0.75" fill="#3d2c00"/></pattern></defs>',
  '<path class="shield-rim" d="M0 0H100V120H0Z" fill="none" stroke-width="3.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>',
  '<g clip-path="url(#shield-clip-s7)"><path d="M0 0H100V120H0Z" fill="#b3202b" stroke="#222222" stroke-width="1" vector-effect="non-scaling-stroke"/>',
  '<path d="M0 0L100 120" fill="url(#hatch-s7-or)"/></g>',
  '<path d="M0 0H100V120H0Z" fill="none" stroke="#222222" stroke-width="1.5" vector-effect="non-scaling-stroke"/>',
  '</svg>',
].join('');

describe('standaloneSvg', () => {
  const svg = standaloneSvg(SHIELD, 512);

  it('is a self-contained SVG document with size and viewBox', () => {
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('width="512"');
    expect(svg).toContain('height="609"');
    expect(svg).toContain('viewBox="-3 -3 106 126"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('depends on nothing outside the file', () => {
    expect(svg).not.toContain('var(');
    expect(svg).not.toContain('class=');
    expect(svg).not.toContain('shield-rim');
    expect(svg).not.toContain('vector-effect');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
    expect(svg).not.toContain('data-');
  });

  it('keeps the tincture fills, the hatching and the label', () => {
    expect(svg).toContain('fill="#b3202b"');
    expect(svg).toContain('<circle cx="2" cy="2" r="0.75" fill="#3d2c00"/>');
    expect(svg).toContain('aria-label="Gules, a bend Or"');
    expect(svg).toContain('<title>Gules, a bend Or</title>');
    expect(svg).toContain('fill="#ffffff"/>');
  });

  it('turns screen-pixel strokes into strokes that scale with the picture', () => {
    expect(svg).toContain('stroke-width="0.455"');
    expect(svg).toContain('stroke-width="0.682"');
  });

  it('namespaces every id and its references, differently for different pictures', () => {
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).toMatch(/^arms-[0-9a-f]{8}-/);
      expect(svg).toContain(`url(#${id})`);
    }
    const other = standaloneSvg(SHIELD.replace('#b3202b', '#006b3f'), 512);
    const otherIds = [...other.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(otherIds.some((id) => ids.includes(id))).toBe(false);
  });

  it('is deterministic', () => {
    expect(standaloneSvg(SHIELD, 512)).toBe(svg);
  });

  it('sizes the PNG source by the width asked for', () => {
    expect(standaloneSvg(SHIELD, 1024)).toContain('width="1024" height="1217"');
  });

  it('refuses markup that still depends on the page', () => {
    const themed = SHIELD.replace('fill="#b3202b"', 'fill="var(--gules)"');
    expect(() => standaloneSvg(themed, 512)).toThrow(UnexportableMarkupError);
    expect(() => standaloneSvg(SHIELD.replace('</defs>', '<image href="https://x.test/a.png"/></defs>'), 512)).toThrow(UnexportableMarkupError);
    expect(() => standaloneSvg('<div></div>', 512)).toThrow(UnexportableMarkupError);
    expect(() => standaloneSvg(SHIELD.replace(' viewBox="0 0 100 120"', ''), 512)).toThrow(UnexportableMarkupError);
  });
});

describe('picture file names', () => {
  it('slugifies the display name', () => {
    expect(pictureStem('Alex the Bold')).toBe('alex-the-bold');
    expect(pictureStem('  Zoë  O’Brien!! ')).toBe('zoe-o-brien');
    expect(pictureFileName('Alex the Bold', 'png')).toBe('alex-the-bold.png');
    expect(pictureFileName('Alex', 'svg')).toBe('alex.svg');
  });

  it('falls back to "arms" when nothing usable is left', () => {
    expect(pictureStem('')).toBe('arms');
    expect(pictureStem('   ')).toBe('arms');
    expect(pictureStem('日本語')).toBe('arms');
    expect(pictureFileName('???', 'svg')).toBe('arms.svg');
  });

  it('keeps long names short without a trailing hyphen', () => {
    const stem = pictureStem('word '.repeat(30));
    expect(stem.length).toBeLessThanOrEqual(40);
    expect(stem.endsWith('-')).toBe(false);
  });
});
