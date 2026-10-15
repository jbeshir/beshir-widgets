// The heraldic shield as SVG, drawn from the DOM-free layers in lib/heraldry (renderLayers).
// Draws any resolved design in any field shape (all shapes share one 100×120 viewBox), including
// designs that break the rules (the violation state still shows the shield). Fill colours are the
// fixed tincture palette in both themes; field and ordinary shapes carry a 1 px non-scaling dark
// outline so Argent stays visible on light surfaces (half that on small shields, where a full pixel
// would swallow a bordure). Charges get a lighter outline, and
// none at all when they render small enough for it to swallow them.
//
// Optional Petra Sancta hatching overlays each tincture's line pattern so the arms
// read without colour. On charges the pattern's pitch follows the charge's size and a solid band of
// the tincture is kept along the charge's edge, so small charges keep their silhouette.
// Counterchanged elements are painted per partition region: each part is clipped to the region it
// lies on and filled (and hatched) with the field's other tincture.
// Pattern/clip ids are unique per instance (module counter) and per group, so many shields can share
// a page, including ones in portals and separate render roots (useId can repeat across roots).

import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import {
  OUTLINE_COLOUR, SHIELD_VIEWBOX, TINCTURE_FILL, TINCTURE_HATCHING, designTinctures, fillCode, fillTinctures, gloss, pathKey, renderLayers, shapeFrame, slotTransform,
  type Design, type FieldShape, type Fill, type Hatching, type Layer, type PatternSpec, type Slot, type Tincture,
} from '../lib/heraldry';

interface Props {
  design: Design;
  /** The field shape to draw the arms in (display only). */
  shape: FieldShape;
  /** Rendered width in px (height is 1.2×). Omit to size with CSS (class). */
  size?: number;
  hatching?: boolean;
  /** Accessible name; defaults to the plain-English gloss of the design. Pass null for a decorative shield (aria-hidden). */
  label?: string | null;
  class?: string;
  testid?: string;
}

/**
 * Hatching line colour per tincture: dark ink on the light metals, white on the colours. Sable's grid
 * is a dark grey on black, so it still reads dark.
 */
const HATCH_INK: Record<Tincture, string> = {
  or: '#3d2c00', argent: '#222222', celestine: '#06303d', azure: '#ffffff', gules: '#ffffff', vert: '#ffffff', sable: '#6a6a6a', purpure: '#ffffff',
};

/** Field and ordinary hatch pitch, in shield units. */
const HATCH_PITCH = 4;

/** Hatch pitch on a charge: about 16 lines across its box, between 2 and 4 shield units. */
const chargeHatchPitch = (box: Slot) => Math.min(HATCH_PITCH, Math.max(2, box.size / 16));

/** Width, in shield units, of the solid tincture band kept along a hatched charge's edge. */
const hatchEdge = (box: Slot) => Math.min(1.6, Math.max(0.8, box.size / 30));

/** Charges drawn narrower than this (px), or on a shield narrower than SMALL_SHIELD_PX, get no outline. */
const SMALL_CHARGE_PX = 24;
const SMALL_SHIELD_PX = 40;
const CHARGE_OUTLINE_PX = 0.75;
const isSmallShield = (shieldPx: number | undefined) => shieldPx !== undefined && shieldPx < SMALL_SHIELD_PX;

/** Charge outline width in px: a hairline, or none where it would swallow a small charge. */
function chargeOutlinePx(shieldPx: number | undefined, box: Slot): number {
  if (shieldPx === undefined) return CHARGE_OUTLINE_PX;
  return isSmallShield(shieldPx) || (shieldPx * box.size) / 100 < SMALL_CHARGE_PX ? 0 : CHARGE_OUTLINE_PX;
}

function HatchPattern({ id, kind, ink, pitch }: { id: string; kind: Hatching; ink: string; pitch: number }) {
  const line = { stroke: ink, 'stroke-width': 0.9, 'stroke-linecap': 'square' as const };
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform={pitch === HATCH_PITCH ? undefined : `scale(${pitch / HATCH_PITCH})`}>
      {kind === 'dots' && <circle cx="2" cy="2" r="0.75" fill={ink} />}
      {kind === 'horizontal' && <path d="M0 2H4" {...line} />}
      {/* One full wave per tile, about half the pitch from crest to trough, so it never reads as straight. */}
      {kind === 'wavy' && <path d="M0 2C0.8 0.6 1.2 0.6 2 2S3.2 3.4 4 2" {...line} fill="none" stroke-linecap="round" />}
      {kind === 'vertical' && <path d="M2 0V4" {...line} />}
      {kind === 'diagonal' && <path d="M-1 -1L5 5M-1 3L1 5M3 -1L5 1" {...line} />}
      {kind === 'diagonal-sinister' && <path d="M5 -1L-1 5M1 -1L-1 1M5 3L3 5" {...line} />}
      {kind === 'cross' && <path d="M0 2H4M2 0V4" {...line} />}
    </pattern>
  );
}

let shieldSeq = 0;
/** Page-unique, deterministic id fragment: one per Shield instance, stable across re-renders. */
export function nextShieldUid(): string {
  shieldSeq += 1;
  return `s${shieldSeq}`;
}

type OrdinaryLayer = Extract<Layer, { k: 'ordinary' }>;
type ChargesLayer = Extract<Layer, { k: 'charges' }>;
type Leaf = Extract<Fill, { k: 'solid' | 'pattern' }>;
type Part = Extract<Fill, { k: 'split' }>['parts'][number];

/** The ids one Shield instance gives its patterns and clips; everything per group carries the group's path. */
interface Ids {
  field: (t: Tincture) => string;
  charge: (key: string, t: Tincture) => string;
  region: (key: string, i: number) => string;
  chargeClip: (key: string, i: number) => string;
  pattern: (spec: PatternSpec) => string;
}

function makeIds(uid: string): Ids {
  return {
    field: (t) => `hatch-${uid}-${t}`,
    charge: (key, t) => `hatch-${uid}-g${key}-${t}`,
    region: (key, i) => `region-clip-${uid}-g${key}-${i}`,
    chargeClip: (key, i) => `charge-clip-${uid}-g${key}-${i}`,
    pattern: (spec) => `pattern-${uid}-${spec.id}`,
  };
}

/** The parts of some fills in walk order: each is cut to a clip path of its own, numbered by its place in the order. */
function partsOf(fills: readonly Fill[]): Part[] {
  return fills.flatMap((f): Part[] => (f.k === 'split' ? f.parts.flatMap((p) => [p, ...partsOf([p.fill])]) : []));
}

/** What painting one layer needs to know: where its group sits, and the clip id of each part of its fills. */
interface Scope { key: string; ids: Ids; overlay: (t: Tincture) => boolean; clipOf: (part: Part) => string }

function scopeOf(key: string, ids: Ids, overlay: (t: Tincture) => boolean, fills: readonly Fill[]): Scope {
  const parts = partsOf(fills);
  return { key, ids, overlay, clipOf: (part) => ids.region(key, parts.indexOf(part)) };
}

/** The fills whose parts a layer clips: for the field, those of its areas. */
const layerFills = (layer: Layer): Fill[] =>
  layer.k === 'field' ? fieldAreas(layer).map((a) => a.fill) : layer.k === 'ordinary' ? [layer.fill] : layer.fills.map((f) => f.fill);

/** The clip paths of the parts of a layer's fills. */
function Clips({ fills, scope }: { fills: readonly Fill[]; scope: Scope }) {
  return <>{partsOf(fills).map((p, i) => <clipPath key={i} id={scope.clipOf(p)}><path d={p.clip} /></clipPath>)}</>;
}

/** The patterns the fills of a design's layers are drawn with, each once. */
function layerPatterns(layers: readonly Layer[]): PatternSpec[] {
  const fills = layers.flatMap((l) => (l.k === 'charges' ? l.fills.map((f) => f.fill) : [l.fill]));
  const specs = [...fills, ...partsOf(fills).map((p) => p.fill)].flatMap((f) => (f.k === 'pattern' ? [f.spec] : []));
  return [...new Map(specs.map((s) => [s.id, s])).values()];
}

/** The <pattern> a pattern fill is drawn with. */
export function PatternDef({ spec, ids }: { spec: PatternSpec; ids: Ids }) {
  const colour = (c: PatternSpec['ground']) => TINCTURE_FILL[c.t];
  return (
    <pattern id={ids.pattern(spec)} patternUnits="userSpaceOnUse" width={spec.width} height={spec.height} patternTransform={spec.transform ?? undefined}>
      <rect width={spec.width} height={spec.height} fill={colour(spec.ground)} />
      {spec.marks.map((m, i) => <path key={i} d={m.d} fill={colour(m.colour)} />)}
    </pattern>
  );
}

/** How a leaf fill is set on an element: the palette colour, or the pattern it names. */
const paintOf = (leaf: Leaf, ids: Ids) => (leaf.k === 'solid' ? TINCTURE_FILL[leaf.colour.t] : `url(#${ids.pattern(leaf.spec)})`);

/** The hatching a leaf fill takes, or null: a flat tincture that is being hatched. */
const hatchOf = (leaf: Leaf, overlay: (t: Tincture) => boolean): Tincture | null => (leaf.k === 'solid' && overlay(leaf.colour.t) ? leaf.colour.t : null);

/**
 * A fill drawn in a group per leaf: a split cuts each part to its clip path (a part within a part nests), and
 * `leaf` draws what the leaf paints. `clip` is the clip path already applied to the fill.
 */
function Painted({ fill, clip, scope, leaf }: { fill: Fill; clip: string | undefined; scope: Scope; leaf: (leaf: Leaf) => ComponentChildren }) {
  if (fill.k !== 'split') return <g clip-path={clip}>{leaf(fill)}</g>;
  const parts = fill.parts.map((part, i) => <Painted key={i} fill={part.fill} clip={`url(#${scope.clipOf(part)})`} scope={scope} leaf={leaf} />);
  return clip === undefined ? <>{parts}</> : <g clip-path={clip}>{parts}</g>;
}

type FieldLayer = Extract<Layer, { k: 'field' }>;

/** The areas a field is painted in: a divided field's parts are its regions themselves, a plain field's one fill is its outline. */
const fieldAreas = (layer: FieldLayer): Array<{ d: string; fill: Fill }> =>
  layer.fill.k === 'split' ? layer.fill.parts.map((p) => ({ d: p.clip, fill: p.fill })) : [{ d: layer.outline, fill: layer.fill }];

function FieldShape({ layer, scope, stroke }: { layer: FieldLayer; scope: Scope; stroke: object }) {
  const regions = fieldAreas(layer);
  return (
    <g data-layer="field">
      {regions.map((r, i) => (
        <Painted key={i} fill={r.fill} clip={undefined} scope={scope} leaf={(f) => {
          const hatch = hatchOf(f, scope.overlay);
          return (
            <>
              <path d={r.d} fill={paintOf(f, scope.ids)} data-paint={fillCode(f)} {...stroke} />
              {hatch && <path d={r.d} fill={`url(#${scope.ids.field(hatch)})`} />}
            </>
          );
        }} />
      ))}
    </g>
  );
}

/** The patterns and clips a layer's fills need. */
function LayerDefs({ layer, scope }: { layer: Layer; scope: Scope }) {
  if (layer.k !== 'charges') return <Clips fills={layerFills(layer)} scope={scope} />;
  const { ids, key, overlay } = scope;
  const fills = layer.fills.map((f) => f.fill);
  const hatchedHere = [...new Set(fills.flatMap(fillTinctures))].filter(overlay);
  return (
    <>
      <Clips fills={fills} scope={scope} />
      {hatchedHere.map((t) => (
        <HatchPattern key={t} id={ids.charge(key, t)} kind={TINCTURE_HATCHING[t]} ink={HATCH_INK[t]} pitch={chargeHatchPitch(layer.slots[0])} />
      ))}
      {layer.fills.map((f, i) => fillTinctures(f.fill).some(overlay) && (
        <clipPath key={`c${i}`} id={ids.chargeClip(key, i)}>
          {f.slots.map((s) => <path key={s} d={layer.art} clip-rule="evenodd" transform={slotTransform(layer.slots[s])} />)}
        </clipPath>
      ))}
    </>
  );
}

function OrdinaryShape({ layer, scope, stroke }: { layer: OrdinaryLayer; scope: Scope; stroke: object }) {
  return (
    <g data-layer="ordinary" data-group={scope.key}>
      <Painted fill={layer.fill} clip={undefined} scope={scope} leaf={(f) => {
        const hatch = hatchOf(f, scope.overlay);
        return (
          <>
            <path d={layer.d} fill={paintOf(f, scope.ids)} fill-rule={layer.fillRule} data-paint={fillCode(f)} />
            {hatch && <path d={layer.d} fill={`url(#${scope.ids.field(hatch)})`} fill-rule={layer.fillRule} />}
          </>
        );
      }} />
      <path d={layer.d} fill="none" fill-rule={layer.fillRule} {...stroke} />
    </g>
  );
}

function ChargesShape({ layer, scope, shieldPx }: { layer: ChargesLayer; scope: Scope; shieldPx: number | undefined }) {
  const { ids, key, overlay } = scope;
  // Every charge in a group shares one box size, so the first box sets the outline and hatch pitch.
  const box = layer.slots[0];
  // Without any paint (counterchanged on a plain field) the outline is all there is to see.
  const outlinePx = !box ? 0 : layer.fills.length ? chargeOutlinePx(shieldPx, box) : CHARGE_OUTLINE_PX;
  return (
    <g data-layer="charges" data-group={key}>
      {layer.fills.map((f, i) => (
        <Painted key={i} fill={f.fill} clip={undefined} scope={scope} leaf={(leaf) => {
          const hatch = hatchOf(leaf, overlay);
          return (
            <>
              {f.slots.map((s) => (
                <path key={s} d={layer.art} transform={slotTransform(layer.slots[s])} fill={paintOf(leaf, ids)} fill-rule="evenodd" data-paint={fillCode(leaf)} />
              ))}
              {hatch && (
                <g clip-path={`url(#${ids.chargeClip(key, i)})`}>
                  <rect x="0" y="0" width="100" height="120" fill={`url(#${ids.charge(key, hatch)})`} />
                  {f.slots.map((s) => (
                    <path
                      key={s} d={layer.art} transform={slotTransform(layer.slots[s])} fill="none" stroke={TINCTURE_FILL[hatch]}
                      stroke-width={(2 * hatchEdge(layer.slots[s]) * 100) / layer.slots[s].size} stroke-linejoin="round"
                    />
                  ))}
                </g>
              )}
            </>
          );
        }} />
      ))}
      {outlinePx > 0 && layer.slots.map((s, i) => (
        <path
          key={i} d={layer.art} transform={slotTransform(s)} fill="none" stroke={OUTLINE_COLOUR} stroke-width={outlinePx}
          vector-effect="non-scaling-stroke" stroke-linejoin="round"
        />
      ))}
    </g>
  );
}

export function Shield({ design, shape, size, hatching = false, label, class: cls, testid }: Props) {
  const uidRef = useRef<string>();
  if (!uidRef.current) uidRef.current = nextShieldUid();
  const uid = uidRef.current;
  const ids = makeIds(uid);
  const clip = `shield-clip-${uid}`;
  const frame = shapeFrame(shape);
  const layers = renderLayers(design, shape);
  const name = label === undefined ? gloss(design) : label;
  const hatched = hatching ? designTinctures(design).filter((t) => TINCTURE_HATCHING[t] !== 'plain') : [];
  const small = isSmallShield(size);
  const stroke = { stroke: OUTLINE_COLOUR, 'stroke-width': small ? 0.5 : 1, 'vector-effect': 'non-scaling-stroke' as const, 'stroke-linejoin': 'round' as const };
  const overlay = (t: Tincture) => hatched.includes(t);
  const scopes = layers.map((layer) => scopeOf(layer.k === 'field' ? 'field' : pathKey(layer.path), ids, overlay, layerFills(layer)));

  return (
    <svg
      class={`shield${cls ? ` ${cls}` : ''}`}
      viewBox={SHIELD_VIEWBOX}
      width={size}
      height={size ? size * 1.2 : undefined}
      role={name ? 'img' : undefined}
      aria-label={name ?? undefined}
      aria-hidden={name ? undefined : 'true'}
      data-testid={testid}
      data-hatching={hatching ? 'on' : 'off'}
      data-shape={shape}
      focusable="false"
    >
      <defs>
        <clipPath id={clip}><path d={frame.outline} /></clipPath>
        {hatched.map((t) => <HatchPattern key={t} id={ids.field(t)} kind={TINCTURE_HATCHING[t]} ink={HATCH_INK[t]} pitch={HATCH_PITCH} />)}
        {layerPatterns(layers).map((spec) => <PatternDef key={spec.id} spec={spec} ids={ids} />)}
        {scopes.map((scope, i) => <LayerDefs key={i} layer={layers[i]} scope={scope} />)}
      </defs>
      <path class="shield-rim" d={frame.outline} fill="none" stroke-width="3.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      <g clip-path={`url(#${clip})`}>
        {layers.map((layer, i) => {
          switch (layer.k) {
            case 'field': return <FieldShape key={i} layer={layer} scope={scopes[i]} stroke={stroke} />;
            case 'ordinary': return <OrdinaryShape key={i} layer={layer} scope={scopes[i]} stroke={stroke} />;
            case 'charges': return <ChargesShape key={i} layer={layer} scope={scopes[i]} shieldPx={size} />;
          }
        })}
      </g>
      <path d={frame.outline} fill="none" stroke={OUTLINE_COLOUR} stroke-width={small ? 1 : 1.5} vector-effect="non-scaling-stroke" />
    </svg>
  );
}

/** A single charge silhouette for picker buttons (inherits currentColor). */
export function ChargeIcon({ path, size = 32 }: { path: string; size?: number }) {
  return (
    <svg class="charge-icon" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" fill-rule="evenodd" />
    </svg>
  );
}
