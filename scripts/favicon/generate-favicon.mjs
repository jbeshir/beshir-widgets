#!/usr/bin/env node
// Render a widget favicon SVG to a multi-size ICO (16, 32 and 48 px).
//
//   node generate-favicon.mjs <input.svg> <output.ico>
//
// The ICO is rendered from the SVG's *light* variant: any `@media (prefers-color-scheme: dark) { … }`
// block inside the SVG's <style> is stripped first, so the browser-tab icon matches the default
// (light) look. Each size is rasterised by resvg and stored as a PNG image inside the ICO container
// (PNG-in-ICO is supported by every current browser and OS).

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const SIZES = [16, 32, 48];

/** Remove every `@media (prefers-color-scheme: dark) { … }` block, matching nested braces. */
export function stripDarkScheme(svg) {
  const re = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(svg))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < svg.length && depth > 0; i++) {
      if (svg[i] === '{') depth++;
      else if (svg[i] === '}') depth--;
    }
    if (depth !== 0) throw new Error('Unbalanced braces in the dark-scheme @media block');
    out += svg.slice(last, m.index);
    last = i;
    re.lastIndex = i;
  }
  return out + svg.slice(last);
}

export function renderPng(svg, size) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' });
  const png = resvg.render();
  if (png.width !== size || png.height !== size) throw new Error(`Expected ${size}×${size}, got ${png.width}×${png.height} (is the SVG square?)`);
  return png.asPng();
}

/** ICONDIR + one ICONDIRENTRY per image, followed by the PNG payloads. */
export function buildIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); // width (0 = 256)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    header.writeUInt8(0, e + 2); // palette colours
    header.writeUInt8(0, e + 3); // reserved
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.png)]);
}

function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('usage: node generate-favicon.mjs <input.svg> <output.ico>');
    process.exit(2);
  }
  const light = stripDarkScheme(readFileSync(input, 'utf8'));
  const images = SIZES.map((size) => ({ size, png: renderPng(light, size) }));
  writeFileSync(output, buildIco(images));
  console.log(`Wrote ${output} (${SIZES.join('/')} px, ${images.reduce((n, im) => n + im.png.length, 0)} bytes of PNG)`);
}

// Run only when executed directly, so the helpers can be imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
