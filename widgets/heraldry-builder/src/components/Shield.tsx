// The heraldic shield as SVG, drawn from the DOM-free geometry and charge art in lib/heraldry.
// Draws any resolved design, including ones that break the rules (the violation state still shows
// the shield). Fill colours are the fixed tincture palette in both themes; every shape carries a
// 1 px non-scaling dark outline so Argent stays visible on light surfaces.
//
// Optional Petra Sancta hatching (FINDINGS §4.8) overlays each tincture's line pattern so the arms
// read without colour. Pattern/clip ids are unique per instance (module counter), so many shields can share
// a page, including ones in portals and separate render roots (useId can repeat across roots).

import { useRef } from 'preact/hooks';
import {
  OUTLINE_COLOUR, ORDINARY_FILL_RULE, ORDINARY_PATHS, SHIELD_PATH, SHIELD_VIEWBOX, TINCTURE_FILL, TINCTURE_HATCHING,
  chargePath, chargeSlots, designTinctures, fieldRegions, gloss, type Hatching, type NormDesign, type Tincture,
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

const HATCH_INK: Record<Tincture, string> = {
  or: '#3d2c00', argent: '#222222', azure: '#ffffff', gules: '#ffffff', vert: '#ffffff', sable: '#d8d8d8', purpure: '#ffffff',
};

function HatchPattern({ id, kind, ink }: { id: string; kind: Hatching; ink: string }) {
  const line = { stroke: ink, 'stroke-width': 0.9, 'stroke-linecap': 'square' as const };
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
      {kind === 'dots' && <circle cx="2" cy="2" r="0.75" fill={ink} />}
      {kind === 'horizontal' && <path d="M0 2H4" {...line} />}
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
  const chargeClip = `charge-clip-${uid}`;
  const c = design.charges;
  const slots = c ? chargeSlots(design) : [];
  const d = c ? chargePath(c.charge, c.posture) : '';
  const name = label === undefined ? gloss(design) : label;
  const hatched = hatching ? designTinctures(design).filter((t) => TINCTURE_HATCHING[t] !== 'plain') : [];
  const stroke = { stroke: OUTLINE_COLOUR, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' as const, 'stroke-linejoin': 'round' as const };
  const transform = (s: { x: number; y: number; size: number }) => `translate(${s.x - s.size / 2} ${s.y - s.size / 2}) scale(${s.size / 100})`;
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
      focusable="false"
    >
      <defs>
        <clipPath id={clip}><path d={SHIELD_PATH} /></clipPath>
        {hatched.map((t) => <HatchPattern key={t} id={pat(t)} kind={TINCTURE_HATCHING[t]} ink={HATCH_INK[t]} />)}
        {c && hatched.includes(c.tincture) && (
          <clipPath id={chargeClip}>
            {slots.map((s, i) => <path key={i} d={d} clip-rule="evenodd" transform={transform(s)} />)}
          </clipPath>
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
        {c && slots.map((s, i) => (
          <path key={i} d={d} transform={transform(s)} fill={TINCTURE_FILL[c.tincture]} fill-rule="evenodd" {...stroke} />
        ))}
        {c && overlay(c.tincture) && (
          <rect x="0" y="0" width="100" height="120" fill={`url(#${pat(c.tincture)})`} clip-path={`url(#${chargeClip})`} />
        )}
      </g>
      <path d={SHIELD_PATH} fill="none" stroke={OUTLINE_COLOUR} stroke-width="1.5" vector-effect="non-scaling-stroke" />
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
