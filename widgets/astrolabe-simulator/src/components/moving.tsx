import type { JSX } from 'preact';
import { fiducialSegments } from '../ruleGeometry';

interface StackedCopiesProps {
  /** `#id` of a fill-less metal path in the overlay's `<defs>`. */
  href: string;
  /** Outline for the bevel copies when it differs (set back from a fiducial edge); defaults to `href`. */
  bevelHref?: string;
  /** The part's own transform (in the frame the part is drawn in). */
  transform: string;
}

/**
 * Cast shadow and bevel for a rotating part, drawn without any filter: plain
 * offset copies of the part's metal outline. The offsets are applied in
 * screen space, outside the rotation, so the light stays at the top-left
 * whatever the angle. Drawn beneath the part itself; never hit-testable.
 */
export function StackedCopies({ href, bevelHref = href, transform }: StackedCopiesProps): JSX.Element {
  const copy = (className: string, dx: number, dy: number, outline: string) => (
    <g className={className} transform={`translate(${dx} ${dy})`}>
      <g transform={transform}><use href={outline} /></g>
    </g>
  );
  return (
    <g aria-hidden="true" className="astro-stacked-copies" data-occludes="false">
      {copy('astro-cast-shadow', 9, 14, href)}
      {copy('astro-cast-shadow', 4, 6.5, href)}
      {copy('astro-bevel-dark', 1.8, 2.4, bevelHref)}
      {copy('astro-bevel-light', -1.6, -1.6, bevelHref)}
    </g>
  );
}

/** Half the ink line's width: the line is set this far into the metal, so its outer side is the edge itself. */
const EDGE_INK_HALF = 0.7;
/** Centre of the bright chamfer strip, just inside the ink line. */
const CHAMFER_AT = 2.4;

interface FiducialEdgeProps {
  part: 'rule-edge' | 'alidade-edge';
  orientation: 'horizontal' | 'vertical';
  extent: number;
}

/**
 * The reading edge of a counterchanged rule or alidade: on each arm, a crisp
 * ink line lying on that arm's metal along its straight edge (the line through
 * the centre), with a polished chamfer strip just inside it. Nothing is drawn
 * on the open side of the edge, so a tick, line or star the edge is laid on
 * stays visible beside it.
 */
export function FiducialEdge({ part, orientation, extent }: FiducialEdgeProps): JSX.Element {
  return <>
    <g aria-hidden="true" className="astro-fiducial-chamfer" data-occludes="false">
      {fiducialSegments(orientation, extent, CHAMFER_AT).map((s) => <line key={s.side} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />)}
    </g>
    <g data-part={part} className="astro-fiducial-edge">
      {fiducialSegments(orientation, extent, EDGE_INK_HALF).map((s) => <line key={s.side}
        className={`astro-fiducial astro-fiducial-${orientation}-${s.side}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />)}
    </g>
  </>;
}

interface HighlightLayerProps {
  layer: 'under' | 'over' | 'top';
  frame: 'base' | 'rete' | 'rule' | 'alidade';
  transform?: string;
}

/**
 * An empty group the step highlights draw their halo copies into
 * (tutorial/highlights.ts). It never takes hits and is hidden from assistive
 * technology; its children are owned by the highlight code, not by Preact.
 */
export function HighlightLayer({ layer, frame, transform }: HighlightLayerProps): JSX.Element {
  return <g className="astro-hl-layer" data-hl-layer={layer} data-hl-frame={frame} data-occludes="false" aria-hidden="true" transform={transform} />;
}

/**
 * Invisible outline round a whole scale: highlighting the scale draws one band halo along it
 * (tutorial/highlights.ts) instead of one per tick and numeral, so the ticks stay countable.
 * `tint`: a ring scale's band is also filled with the pale halo tone, beneath its ticks and numerals.
 */
export function Band({ d, tint = false }: { d: string; tint?: boolean }): JSX.Element {
  return <path className={`astro-hl-band${tint ? ' astro-hl-band-tint' : ''}`} data-occludes="false" data-hl-outline="band" fill-rule="evenodd" d={d} />;
}

/** Keyboard-focus ring of a rotating part: a copy of its metal outline, stroked only while the part has focus. */
export function FocusRing({ href }: { href: string }): JSX.Element {
  return <use href={href} className="astro-focus-ring" data-occludes="false" aria-hidden="true" />;
}

/** Width of the invisible grab strip along a rule or alidade (about 30px on a phone). */
export const HIT_WIDTH = 110;

/**
 * An invisible, wide strip along the part's centre line so a finger can pick the part up
 * beside its thin metal. It paints nothing and never occludes: only its stroke takes hits.
 */
export function HitArea({ orientation, extent }: { orientation: 'horizontal' | 'vertical'; extent: number }): JSX.Element {
  return orientation === 'horizontal'
    ? <line className="astro-hit-area" data-occludes="false" aria-hidden="true" x1={-extent} y1="0" x2={extent} y2="0" stroke-width={HIT_WIDTH} />
    : <line className="astro-hit-area" data-occludes="false" aria-hidden="true" x1="0" y1={-extent} x2="0" y2={extent} stroke-width={HIT_WIDTH} />;
}
