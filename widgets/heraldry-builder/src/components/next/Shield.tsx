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

import { useRef } from 'preact/hooks';
import {
  OUTLINE_COLOUR, SHIELD_VIEWBOX, TINCTURE_FILL, TINCTURE_HATCHING, designTinctures, gloss, pathKey, renderLayers, shapeFrame, slotTransform,
  type Design, type FieldShape, type Hatching, type Layer, type Slot, type Tincture,
} from '../../lib/heraldry/next';

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

/** The ids one Shield instance gives its patterns and clips; everything per group carries the group's path. */
interface Ids {
  field: (t: Tincture) => string;
  charge: (key: string, t: Tincture) => string;
  region: (key: string, i: number) => string;
  chargeClip: (key: string, i: number) => string;
}

function makeIds(uid: string): Ids {
  return {
    field: (t) => `hatch-${uid}-${t}`,
    charge: (key, t) => `hatch-${uid}-g${key}-${t}`,
    region: (key, i) => `region-clip-${uid}-g${key}-${i}`,
    chargeClip: (key, i) => `charge-clip-${uid}-g${key}-${i}`,
  };
}

/** The patterns and clips a layer's fills need. */
function LayerDefs({ layer, ids, overlay }: { layer: Layer; ids: Ids; overlay: (t: Tincture) => boolean }) {
  if (layer.k === 'field') return null;
  const key = pathKey(layer.path);
  const clips = layer.fills.map((f, i) => (f.clip === null ? null : <clipPath key={`r${i}`} id={ids.region(key, i)}><path d={f.clip} /></clipPath>));
  if (layer.k === 'ordinary') return <>{clips}</>;
  const hatchedHere = [...new Set(layer.fills.map((f) => f.tincture))].filter(overlay);
  return (
    <>
      {clips}
      {hatchedHere.map((t) => (
        <HatchPattern key={t} id={ids.charge(key, t)} kind={TINCTURE_HATCHING[t]} ink={HATCH_INK[t]} pitch={chargeHatchPitch(layer.slots[0])} />
      ))}
      {layer.fills.map((f, i) => overlay(f.tincture) && (
        <clipPath key={`c${i}`} id={ids.chargeClip(key, i)}>
          {f.slots.map((s) => <path key={s} d={layer.art} clip-rule="evenodd" transform={slotTransform(layer.slots[s])} />)}
        </clipPath>
      ))}
    </>
  );
}

function OrdinaryShape({ layer, ids, overlay, stroke }: { layer: OrdinaryLayer; ids: Ids; overlay: (t: Tincture) => boolean; stroke: object }) {
  const key = pathKey(layer.path);
  return (
    <g data-layer="ordinary" data-group={key}>
      {layer.fills.map((f, i) => (
        <g key={i} clip-path={f.clip === null ? undefined : `url(#${ids.region(key, i)})`}>
          <path d={layer.d} fill={TINCTURE_FILL[f.tincture]} fill-rule={layer.fillRule} />
          {overlay(f.tincture) && <path d={layer.d} fill={`url(#${ids.field(f.tincture)})`} fill-rule={layer.fillRule} />}
        </g>
      ))}
      <path d={layer.d} fill="none" fill-rule={layer.fillRule} {...stroke} />
    </g>
  );
}

function ChargesShape({ layer, ids, overlay, shieldPx }: { layer: ChargesLayer; ids: Ids; overlay: (t: Tincture) => boolean; shieldPx: number | undefined }) {
  const key = pathKey(layer.path);
  // Every charge in a group shares one box size, so the first box sets the outline and hatch pitch.
  const box = layer.slots[0];
  // Without any paint (counterchanged on a plain field) the outline is all there is to see.
  const outlinePx = !box ? 0 : layer.fills.length ? chargeOutlinePx(shieldPx, box) : CHARGE_OUTLINE_PX;
  return (
    <g data-layer="charges" data-group={key}>
      {layer.fills.map((f, i) => (
        <g key={i} clip-path={f.clip === null ? undefined : `url(#${ids.region(key, i)})`} data-charge-tincture={f.tincture}>
          {f.slots.map((s) => (
            <path key={s} d={layer.art} transform={slotTransform(layer.slots[s])} fill={TINCTURE_FILL[f.tincture]} fill-rule="evenodd" />
          ))}
          {overlay(f.tincture) && (
            <g clip-path={`url(#${ids.chargeClip(key, i)})`}>
              <rect x="0" y="0" width="100" height="120" fill={`url(#${ids.charge(key, f.tincture)})`} />
              {f.slots.map((s) => (
                <path
                  key={s} d={layer.art} transform={slotTransform(layer.slots[s])} fill="none" stroke={TINCTURE_FILL[f.tincture]}
                  stroke-width={(2 * hatchEdge(layer.slots[s]) * 100) / layer.slots[s].size} stroke-linejoin="round"
                />
              ))}
            </g>
          )}
        </g>
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
        {layers.map((layer, i) => <LayerDefs key={i} layer={layer} ids={ids} overlay={overlay} />)}
      </defs>
      <path class="shield-rim" d={frame.outline} fill="none" stroke-width="3.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      <g clip-path={`url(#${clip})`}>
        {layers.map((layer, i) => {
          switch (layer.k) {
            case 'field': return (
              <g key={i} data-layer="field">
                {layer.regions.map((r, j) => (
                  <g key={j}>
                    <path d={r.d} fill={TINCTURE_FILL[r.tincture]} {...stroke} />
                    {overlay(r.tincture) && <path d={r.d} fill={`url(#${ids.field(r.tincture)})`} />}
                  </g>
                ))}
              </g>
            );
            case 'ordinary': return <OrdinaryShape key={i} layer={layer} ids={ids} overlay={overlay} stroke={stroke} />;
            case 'charges': return <ChargesShape key={i} layer={layer} ids={ids} overlay={overlay} shieldPx={size} />;
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
