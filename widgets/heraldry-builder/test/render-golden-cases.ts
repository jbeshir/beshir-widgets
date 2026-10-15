// Every shield the golden pins — the examples, the sample registry and generated designs, in rotating shapes, with
// hatching off and on — reduced to a short hash of its markup, so a refactor of how paint is drawn is provably
// neutral. The fixture is test/fixtures/render-golden.json; `npm run golden:write` regenerates it.
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { Shield } from '../src/components/Shield';
import sample from '../src/data/sample-registry.json';
import { FIELD_SHAPES, type Design, type FieldShape } from '../src/lib/heraldry';
import { EXAMPLE_DESIGNS } from '../src/lib/presets';
import { generatedDesigns, generatedRichDesigns } from './design-generator';
import type { SampleFile } from './sample-registry';

interface GoldenShield { key: string; design: Design; shape: FieldShape }

function goldenShields(): GoldenShield[] {
  const generated = (prefix: string, designs: readonly Design[]) =>
    designs.map((design, i): GoldenShield => ({ key: `${prefix}-${i}`, design, shape: FIELD_SHAPES[i % FIELD_SHAPES.length] }));
  return [
    ...EXAMPLE_DESIGNS.map((p): GoldenShield => ({ key: `example-${p.id}`, design: p.design, shape: 'heater' })),
    ...(sample as unknown as SampleFile).entries.map((e): GoldenShield => ({ key: `sample-${e.id}`, design: e.design as Design, shape: e.shape })),
    ...generated('level0', generatedDesigns(1, 300)),
    ...generated('rich', generatedRichDesigns(1, 100)),
  ];
}

/** FNV-1a, 32 bits, as 8 hex digits. */
function hash(text: string): string {
  let h32 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h32 = Math.imul(h32 ^ text.charCodeAt(i), 0x01000193);
  return (h32 >>> 0).toString(16).padStart(8, '0');
}

/** The markup with the per-instance id fragment and the attributes that only describe the fills to the SCA render check removed. */
const comparable = (svg: string) => svg.replace(/(hatch|hatch-tile|hatch-mask|region-clip|charge-clip|shield-clip)-s\d+/g, '$1-sN').replace(/ data-(?:paint|charge-tincture)="[^"]*"/g, '');

export function goldenRenders(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, design, shape } of goldenShields()) {
    for (const hatching of [false, true]) {
      out[`${key}|${hatching ? 'hatched' : 'plain'}`] = hash(comparable(renderToString(h(Shield, { design, shape, hatching, size: 200 }))));
    }
  }
  return out;
}
