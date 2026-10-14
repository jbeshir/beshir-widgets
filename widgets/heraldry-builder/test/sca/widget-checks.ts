// The widget-side checks the SCA armorial test applies to every design matched from a blazon:
//
// - assessMatched: the widget's own verdict on the design — registrable, blocked (a rule of
//   tincture or structure violation, or a plain field on its own), or not even well-formed.
// - renderShieldSvg + expectedElements + checkRendered: the real <Shield> rendered to SVG markup
//   in plain Node, checked layer by layer against renderLayers (the geometry Shield draws from):
//   one field block with a region per part, then for each group in paint order a block with its
//   ordinary shape or its charges, each drawn at the expected slot, painted its tinctures and
//   outlined once, with no stray paint.
//
// (builderPath, the clicks that build a design in the builder, is test/builder-path.ts.) The checks return
// their problems as strings rather than throwing, so the caller can report them per record. Only the
// rendering helpers throw, on a design the widget can't draw at all.

import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { Shield } from '../../src/components/Shield';
import {
  DEFAULT_FIELD_SHAPE, OUTLINE_COLOUR, TINCTURE_FILL, pathKey, renderLayers, slotTransform, validate,
  type Design, type FieldShape, type Issue, type Layer,
} from '../../src/lib/heraldry';
import { assess, type DesignStatus } from '../../src/lib/builder';

// ── Assessment ──────────────────────────────────────────────────────────────

type IssueCode = Issue['code'];

/**
 * ok         — the builder would let it be registered (assess() says valid).
 * violation  — well-formed but blocked: assess() says violation (structure or rule of tincture) or
 *              incomplete (a plain field alone, code 'generic'). `codes` are the distinct issue codes.
 * structural — malformed or not drawable: the widget can't use it at all.
 */
export type Assessment =
  | { kind: 'ok'; design: Design }
  | { kind: 'violation'; status: Exclude<DesignStatus, 'valid'>; codes: IssueCode[]; issues: Issue[]; design: Design }
  | { kind: 'structural'; codes: IssueCode[]; issues: Issue[] };

const distinctCodes = (issues: Issue[]): IssueCode[] => [...new Set(issues.map((i) => i.code))];

export function assessMatched(design: Design): Assessment {
  const report = assess(design);
  if (report.status === 'valid') return { kind: 'ok', design };
  const issues = validate(design);
  return { kind: 'violation', status: report.status, codes: distinctCodes(issues), issues, design };
}

// ── Rendering ───────────────────────────────────────────────────────────────

export interface RenderOptions {
  shape?: FieldShape;
  hatching?: boolean;
}

/** The real <Shield> as SVG markup, at its default (CSS-sized) size. Throws if the design can't be drawn. */
export function renderShieldSvg(design: Design, { shape = DEFAULT_FIELD_SHAPE, hatching = false }: RenderOptions = {}): string {
  return renderToString(h(Shield, { design, shape, hatching, label: null }));
}

/** A <path> of the markup: its attributes, and its position among all paths (paint order). */
interface PathTag { index: number; attrs: Record<string, string> }

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" };
const decode = (v: string) => v.replace(/&(?:amp|quot|lt|gt|#39);/g, (e) => ENTITIES[e]);

/** Every <path> in the markup, in document order. Shield's markup is flat enough that no XML parser is needed. */
function pathTags(svg: string): PathTag[] {
  return [...svg.matchAll(/<path\b([^>]*?)\/?>/g)].map((m, index) => ({
    index,
    attrs: Object.fromEntries([...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], decode(a[2])])),
  }));
}

interface Block { layer: string; group: string | null; markup: string }

/** The `<g data-layer data-group>` blocks of the markup in paint order. Layer blocks don't nest. */
function layerBlocks(svg: string): Block[] {
  const opens = [...svg.matchAll(/<g data-layer="(\w+)"(?: data-group="([\d.]+)")?>/g)];
  return opens.map((m, i) => ({ layer: m[1], group: m[2] ?? null, markup: svg.slice(m.index, opens[i + 1]?.index ?? svg.length) }));
}

const filled = (p: PathTag) => p.attrs.fill !== undefined && p.attrs.fill !== 'none' && !p.attrs.fill.startsWith('url(');
const sorted = (xs: string[]) => [...xs].sort();

function checkField(layer: Extract<Layer, { k: 'field' }>, block: Block): string[] {
  const paths = pathTags(block.markup);
  const want = layer.regions.map((r) => `${r.d}|${TINCTURE_FILL[r.tincture]}`);
  const got = paths.filter(filled).map((p) => `${p.attrs.d}|${p.attrs.fill}`);
  return sorted(got).join() === sorted(want).join() ? [] : [`the field draws ${got.length} regions, expected ${want.length} (${layer.regions.map((r) => TINCTURE_FILL[r.tincture]).join(', ')})`];
}

function checkOrdinary(layer: Extract<Layer, { k: 'ordinary' }>, block: Block): string[] {
  const paths = pathTags(block.markup);
  const want = layer.fills.map((f) => `${layer.d}|${TINCTURE_FILL[f.tincture]}|${layer.fillRule}`);
  const got = paths.filter(filled).map((p) => `${p.attrs.d}|${p.attrs.fill}|${p.attrs['fill-rule']}`);
  const problems: string[] = [];
  if (sorted(got).join() !== sorted(want).join()) problems.push(`the ordinary at ${block.group} draws ${got.length} fills, expected ${want.length}`);
  const outlines = paths.filter((p) => p.attrs.fill === 'none' && p.attrs.d === layer.d);
  if (outlines.length !== 1) problems.push(`the ordinary at ${block.group} is outlined ${outlines.length} times, expected once`);
  if (!layer.d) problems.push(`the geometry has no path for the ordinary at ${block.group}`);
  return problems;
}

function checkCharges(layer: Extract<Layer, { k: 'charges' }>, block: Block): string[] {
  const paths = pathTags(block.markup);
  const problems: string[] = [];
  const want = layer.fills.flatMap((f) => f.slots.map((s) => `${slotTransform(layer.slots[s])}|${TINCTURE_FILL[f.tincture]}`));
  const got = paths.filter(filled).map((p) => `${p.attrs.transform}|${p.attrs.fill}`);
  if (sorted(got).join() !== sorted(want).join()) problems.push(`the charges at ${block.group} are painted ${sorted(got).join(' ') || 'nothing'}, expected ${sorted(want).join(' ') || 'nothing'}`);
  if (paths.filter(filled).some((p) => p.attrs.d !== layer.art)) problems.push(`the charges at ${block.group} are not drawn with their own art`);
  // (the shield's own frame outline, last in the markup, has no transform)
  const outlines = paths.filter((p) => p.attrs.transform !== undefined && p.attrs.fill === 'none' && p.attrs.stroke === OUTLINE_COLOUR && p.attrs['vector-effect'] === 'non-scaling-stroke');
  if (sorted(outlines.map((p) => p.attrs.transform)).join() !== sorted(layer.slots.map(slotTransform)).join()) {
    problems.push(`${outlines.length} charge outlines are drawn at ${block.group}, expected ${layer.slots.length}`);
  }
  const markers = [...block.markup.matchAll(/\sdata-charge-tincture="([^"]*)"/g)].map((m) => m[1]);
  if (sorted(markers).join() !== sorted(layer.fills.map((f) => f.tincture)).join()) {
    problems.push(`charge groups at ${block.group} are marked ${markers.join(', ') || 'nothing'}`);
  }
  return problems;
}

/**
 * What is wrong with the rendered shield, or [] when it draws the design: the same layers
 * renderLayers lists, in the same order, each drawn at its geometry in its tinctures.
 */
export function checkRendered(design: Design, svg: string, shape: FieldShape = DEFAULT_FIELD_SHAPE): string[] {
  if (!svg.startsWith('<svg')) return ['the markup is not an <svg>'];
  const layers = renderLayers(design, shape);
  const blocks = layerBlocks(svg);
  if (blocks.length !== layers.length) return [`${blocks.length} layers are drawn, expected ${layers.length}`];
  return layers.flatMap((layer, i): string[] => {
    const block = blocks[i];
    if (block.layer !== (layer.k === 'field' ? 'field' : layer.k === 'ordinary' ? 'ordinary' : 'charges')) return [`layer ${i + 1} is a ${block.layer} layer, expected ${layer.k}`];
    if (layer.k !== 'field' && block.group !== pathKey(layer.path)) return [`layer ${i + 1} is group ${block.group}, expected ${pathKey(layer.path)}`];
    switch (layer.k) {
      case 'field': return checkField(layer, block);
      case 'ordinary': return checkOrdinary(layer, block);
      case 'charges': return checkCharges(layer, block);
    }
  });
}

