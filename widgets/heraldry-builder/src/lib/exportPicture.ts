// Turns the markup of a rendered Shield into a standalone SVG picture that looks the same outside
// the app: no CSS variables, classes or external references, resolution-independent strokes, ids
// namespaced to the picture, and a white ground (the pictures are for paper, chat and slides, where
// the dark outline of an Argent or Sable shield needs a light edge). Pure string work, so it runs in
// tests without a DOM; the browser side (render, rasterise, download) lives in components/SavePicture.

/** Margin, in shield units, kept round the shield so its outline is never cut at the edge. */
const MARGIN = 3;

/**
 * Pixels per shield unit of the large preview (220 px for 100 units). The outlines of the live
 * shield are a fixed number of screen pixels wide; in a picture they scale with it, at this ratio.
 */
const PREVIEW_PX_PER_UNIT = 2.2;

const PAPER = '#ffffff';

/** The markup was not a Shield SVG, or still depends on the page it came from. */
export class UnexportableMarkupError extends Error {
  constructor(reason: string) {
    super(`This shield cannot be saved as a standalone picture: ${reason}`);
    this.name = 'UnexportableMarkupError';
  }
}

const SVG_ELEMENT = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/;

function attribute(attrs: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
}

/** FNV-1a, hex: a short deterministic fingerprint of the picture's content. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const NON_SCALING = ' vector-effect="non-scaling-stroke"';

/** Elements that kept a screen-pixel stroke get the same stroke in shield units instead. */
function scaleStrokes(inner: string): string {
  return inner.replace(/<[a-zA-Z]+\b[^>]*>/g, (tag) => {
    if (!tag.includes(NON_SCALING)) return tag;
    return tag
      .replace(NON_SCALING, '')
      .replace(/ stroke-width="([\d.]+)"/, (_, px: string) => ` stroke-width="${+(Number(px) / PREVIEW_PX_PER_UNIT).toFixed(3)}"`);
  });
}

/** Prefix every id (and the references to it) so pictures placed on one page cannot collide. */
function namespaceIds(inner: string): string {
  const prefix = `arms-${fingerprint(inner)}-`;
  return inner
    .replace(/(\s)id="([^"]+)"/g, (_, space: string, id: string) => `${space}id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${prefix}${id})`);
}

/**
 * The standalone SVG document for the markup of one rendered Shield (as serialised by the browser),
 * `widthPx` wide and in proportion. Throws UnexportableMarkupError when the result would still
 * depend on the page.
 */
export function standaloneSvg(markup: string, widthPx: number): string {
  const match = SVG_ELEMENT.exec(markup);
  if (!match) throw new UnexportableMarkupError('it is not an SVG element');
  const [, attrs, body] = match;
  const box = (attribute(attrs, 'viewBox') ?? '').split(/\s+/).map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) throw new UnexportableMarkupError('it has no viewBox');
  const [x, y, w, h] = [box[0] - MARGIN, box[1] - MARGIN, box[2] + 2 * MARGIN, box[3] + 2 * MARGIN];
  const label = attribute(attrs, 'aria-label');

  const inner = namespaceIds(
    scaleStrokes(body)
      // The light ring that separates a dark shield from a dark page has no place on white.
      .replace(/<path\b[^>]*\bclass="shield-rim"[^>]*\/>/g, '')
      .replace(/ class="[^"]*"/g, ''),
  );
  if (/var\(|https?:|<style|<image|<use\b/.test(inner)) throw new UnexportableMarkupError('it refers to something outside the picture');

  const title = label ? `<title>${label}</title>` : '';
  const labelled = label ? ` role="img" aria-label="${label}"` : '';
  const height = Math.round((widthPx * h) / w);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${height}" viewBox="${x} ${y} ${w} ${h}"${labelled}>` +
    `${title}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}"/>${inner}</svg>\n`
  );
}

/** A file-name stem from a display name: lower-case ASCII words joined by hyphens; "arms" when nothing is left. */
export function pictureStem(displayName: string): string {
  const stem = displayName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return stem || 'arms';
}

export type PictureFormat = 'svg' | 'png';

export function pictureFileName(displayName: string, format: PictureFormat): string {
  return `${pictureStem(displayName)}.${format}`;
}
