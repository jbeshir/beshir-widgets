// The heraldic shield as SVG, drawn from the DOM-free geometry and charge art in lib/heraldry.
// Draws any resolved design, including ones that break the rules (the violation state still shows
// the shield). Fill colours are the fixed tincture palette in both themes; field and ordinary shapes
// carry a 1 px non-scaling dark outline so Argent stays visible on light surfaces (half that on
// small shields, where a full pixel would swallow a bordure). Charges get a lighter outline, and
// none at all when they render small enough for it to swallow them.
//
// Optional Petra Sancta hatching (FINDINGS §4.8) overlays each tincture's line pattern so the arms
// read without colour. On charges the pattern's pitch follows the charge's size and a solid band of
// the tincture is kept along the charge's edge, so small charges keep their silhouette.
// Pattern/clip ids are unique per instance (module counter), so many shields can share
// a page, including ones in portals and separate render roots (useId can repeat across roots).

import { useRef } from 'preact/hooks';
import {
  OUTLINE_COLOUR, ORDINARY_FILL_RULE, ORDINARY_PATHS, SHIELD_PATH, SHIELD_VIEWBOX, TINCTURE_FILL, TINCTURE_HATCHING,
  chargePath, chargeSlots, designTinctures, drawnBox, fieldRegions, gloss, type Hatching, type NormDesign, type Slot,
  type Tincture,
} from '../lib/heraldry';

interface Props {
  design: NormDesign;
  /** Rendered width in px (height is 1.2×). Omit to size with CSS (class). */
  size?: number;
  hatching?: boolean;
  /** Accessible name; defaults to the gloss. Pass null for a decorative shield (aria-hidden). */
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

export function Shield({ design, size, hatching = false, label, class: cls, testid }: Props) {
  const uidRef = useRef<string>();
  if (!uidRef.current) uidRef.current = nextShieldUid();
  const uid = uidRef.current;
  const clip = `shield-clip-${uid}`;
  const pat = (t: Tincture) => `hatch-${uid}-${t}`;
  const chargePat = `hatch-${uid}-charge`;
  const chargeClip = `charge-clip-${uid}`;
  const c = design.charges;
  const boxes = c ? chargeSlots(design).map((s) => drawnBox(s, c.charge)) : [];
  const d = c ? chargePath(c.charge, c.posture) : '';
  const name = label === undefined ? gloss(design) : label;
  const hatched = hatching ? designTinctures(design).filter((t) => TINCTURE_HATCHING[t] !== 'plain') : [];
  const small = isSmallShield(size);
  const stroke = { stroke: OUTLINE_COLOUR, 'stroke-width': small ? 0.5 : 1, 'vector-effect': 'non-scaling-stroke' as const, 'stroke-linejoin': 'round' as const };
  const transform = (s: Slot) => `translate(${s.x - s.size / 2} ${s.y - s.size / 2}) scale(${s.size / 100})`;
  const overlay = (t: Tincture) => hatched.includes(t);
  // Every charge in a group shares one box size, so the first box sets the outline and hatch pitch.
  const box = boxes[0];
  const outlinePx = box ? chargeOutlinePx(size, box) : 0;
  const chargeHatched = !!c && overlay(c.tincture);

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
      focusable="false"
    >
      <defs>
        <clipPath id={clip}><path d={SHIELD_PATH} /></clipPath>
        {hatched.map((t) => <HatchPattern key={t} id={pat(t)} kind={TINCTURE_HATCHING[t]} ink={HATCH_INK[t]} pitch={HATCH_PITCH} />)}
        {chargeHatched && (
          <>
            <HatchPattern id={chargePat} kind={TINCTURE_HATCHING[c.tincture]} ink={HATCH_INK[c.tincture]} pitch={chargeHatchPitch(box)} />
            <clipPath id={chargeClip}>
              {boxes.map((s, i) => <path key={i} d={d} clip-rule="evenodd" transform={transform(s)} />)}
            </clipPath>
          </>
        )}
      </defs>
      <path class="shield-rim" d={SHIELD_PATH} fill="none" stroke-width="3.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      <g clip-path={`url(#${clip})`}>
        {fieldRegions(design.field).map((r, i) => (
          <g key={i}>
            <path d={r.d} fill={TINCTURE_FILL[r.tincture]} {...stroke} />
            {overlay(r.tincture) && <path d={r.d} fill={`url(#${pat(r.tincture)})`} />}
          </g>
        ))}
        {design.ordinary && (
          <g>
            <path
              d={ORDINARY_PATHS[design.ordinary.type]}
              fill={TINCTURE_FILL[design.ordinary.tincture]}
              fill-rule={ORDINARY_FILL_RULE[design.ordinary.type]}
              {...stroke}
            />
            {overlay(design.ordinary.tincture) && (
              <path
                d={ORDINARY_PATHS[design.ordinary.type]}
                fill={`url(#${pat(design.ordinary.tincture)})`}
                fill-rule={ORDINARY_FILL_RULE[design.ordinary.type]}
              />
            )}
          </g>
        )}
        {c && boxes.map((s, i) => (
          <path key={i} d={d} transform={transform(s)} fill={TINCTURE_FILL[c.tincture]} fill-rule="evenodd" />
        ))}
        {chargeHatched && (
          <g clip-path={`url(#${chargeClip})`}>
            <rect x="0" y="0" width="100" height="120" fill={`url(#${chargePat})`} />
            {boxes.map((s, i) => (
              <path
                key={i} d={d} transform={transform(s)} fill="none" stroke={TINCTURE_FILL[c.tincture]}
                stroke-width={(2 * hatchEdge(s) * 100) / s.size} stroke-linejoin="round"
              />
            ))}
          </g>
        )}
        {c && outlinePx > 0 && boxes.map((s, i) => (
          <path
            key={i} d={d} transform={transform(s)} fill="none" stroke={OUTLINE_COLOUR} stroke-width={outlinePx}
            vector-effect="non-scaling-stroke" stroke-linejoin="round"
          />
        ))}
      </g>
      <path d={SHIELD_PATH} fill="none" stroke={OUTLINE_COLOUR} stroke-width={small ? 1 : 1.5} vector-effect="non-scaling-stroke" />
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
