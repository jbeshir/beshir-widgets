// "Save picture": the arms as a standalone SVG file or a 1024 px PNG. The shield is rendered
// offscreen with the same component as everywhere else, serialised by lib/exportPicture and, for
// PNG, drawn onto a canvas. Nothing leaves the browser.

import { render } from 'preact';
import { useState } from 'preact/hooks';
import type { FieldShape, NormDesign } from '../lib/heraldry';
import { pictureFileName, standaloneSvg, type PictureFormat } from '../lib/exportPicture';
import { Shield } from './Shield';

const SVG_WIDTH_PX = 512;
const PNG_WIDTH_PX = 1024;

/** The picture could not be produced (the browser refused to draw it or to encode it). */
class PictureSaveError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PictureSaveError';
  }
}

/** The live markup of one shield, drawn offscreen so the picture never depends on what is on screen. */
function renderedShieldMarkup(design: NormDesign, shape: FieldShape, hatching: boolean): string {
  const host = document.createElement('div');
  render(<Shield design={design} shape={shape} hatching={hatching} />, host);
  const svg = host.firstElementChild;
  const markup = svg ? new XMLSerializer().serializeToString(svg) : '';
  render(null, host);
  return markup;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new PictureSaveError('the browser could not draw the picture'));
    img.src = url;
  });
}

async function rasterise(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = PNG_WIDTH_PX;
    canvas.height = Math.round((PNG_WIDTH_PX * img.naturalHeight) / img.naturalWidth);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PictureSaveError('the browser has no canvas to draw on');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new PictureSaveError('the browser could not encode the PNG'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function savePicture(format: PictureFormat, design: NormDesign, shape: FieldShape, hatching: boolean, displayName: string): Promise<string> {
  const markup = renderedShieldMarkup(design, shape, hatching);
  const fileName = pictureFileName(displayName, format);
  const blob = format === 'svg'
    ? new Blob([standaloneSvg(markup, SVG_WIDTH_PX)], { type: 'image/svg+xml' })
    : await rasterise(standaloneSvg(markup, PNG_WIDTH_PX));
  download(blob, fileName);
  return fileName;
}

interface Props {
  design: NormDesign;
  shape: FieldShape;
  hatching: boolean;
  /** Names the file and the buttons; empty for arms that have no name yet. */
  displayName: string;
}

type Status = { kind: 'idle' } | { kind: 'saved'; fileName: string } | { kind: 'failed' };

export function SavePicture({ design, shape, hatching, displayName }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const subject = displayName.trim() ? `the arms of ${displayName.trim()}` : 'these arms';
  const save = async (format: PictureFormat) => {
    setStatus({ kind: 'idle' });
    try {
      setStatus({ kind: 'saved', fileName: await savePicture(format, design, shape, hatching, displayName) });
    } catch {
      setStatus({ kind: 'failed' });
    }
  };
  return (
    <div class="save-picture" role="group" aria-label="Save picture">
      <span class="save-picture-label" aria-hidden="true">Save picture</span>
      <button type="button" class="button-secondary button-small" data-testid="save-svg" aria-label={`Save ${subject} as an SVG picture`} onClick={() => save('svg')}>
        SVG
      </button>
      <button type="button" class="button-secondary button-small" data-testid="save-png" aria-label={`Save ${subject} as a PNG picture`} onClick={() => save('png')}>
        PNG
      </button>
      <span class="save-picture-status" role="status" data-testid="save-status">
        {status.kind === 'saved' && `Saved ${status.fileName}`}
        {status.kind === 'failed' && 'Couldn’t save the picture. Try the other format.'}
      </span>
    </div>
  );
}
