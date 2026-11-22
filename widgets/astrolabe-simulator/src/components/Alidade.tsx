import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { angleFromPointer, keyRotate, rotationDelta } from '../interaction';
import { alidadeAltitudeReading } from '../backGeometry';
import { setAlidade } from '../store';
import { alidadeMinuteScale, taperedRulePath } from '../ruleGeometry';
import { Band, FiducialEdge, FocusRing, HighlightLayer, HitArea, StackedCopies } from './moving';

interface AlidadeProps { alidadeRotation: number; }
/** Fiducial edge length: reaches the outer degree scale. */
const EXTENT = 600;
const ALIDADE_TAPER = { hub: 30, root: 36, shoulder: 32, shoulderAt: 390 };
const ALIDADE_PATH = taperedRulePath('horizontal', EXTENT, ALIDADE_TAPER);
const ALIDADE_BEVEL_PATH = taperedRulePath('horizontal', EXTENT, ALIDADE_TAPER, 3);
/** Minute ticks stop short of the edge line, so a highlighted tick's cap stays on the metal. */
const TICK_END = -2.5;
const MINUTE_SCALE = alidadeMinuteScale();
/**
 * Highlight band round the minute strip: open along the fiducial edge, so the point where the
 * equation-of-time loop meets the edge beside the ticks is never covered.
 */
const MINUTE_BAND = (() => {
  const from = MINUTE_SCALE[0].radius - 14;
  const to = 382;
  return `M ${from} -1 V -38 H ${to} V -1`;
})();

function signed(minutes: number): string {
  if (minutes > 0) return `+${minutes}`;
  if (minutes < 0) return `−${-minutes}`;
  return '0';
}

export function AlidadeDefs({ alidadeRotation }: AlidadeProps): JSX.Element {
  return <>
    <path id="alidade-metal" d={ALIDADE_PATH} />
    <path id="alidade-metal-bevel" d={ALIDADE_BEVEL_PATH} />
    <linearGradient id="alidade-metal-fill" gradientUnits="userSpaceOnUse" x1="-600" y1="-600" x2="600" y2="600"
      gradientTransform={`rotate(${alidadeRotation})`}>
      <stop offset="0" stop-color="var(--astro-gilt-hi)" />
      <stop offset="0.5" stop-color="var(--astro-gilt-mid)" />
      <stop offset="1" stop-color="var(--astro-gilt-low)" />
    </linearGradient>
  </>;
}

export function Alidade({ alidadeRotation }: AlidadeProps): JSX.Element {
  const drag = useRef<{ pointerId: number; pointerAngle: number; rotation: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const transform = `rotate(${-alidadeRotation})`;
  const endDrag = (event: JSX.TargetedPointerEvent<SVGGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <>
    <StackedCopies href="#alidade-metal" bevelHref="#alidade-metal-bevel" transform={transform} />
    <g data-testid="alidade" data-part="alidade" data-hl-frame-root="alidade" className={`astro-rotary astro-alidade${dragging ? ' is-dragging' : ''}`} transform={transform}
      tabindex={0} role="slider" aria-label="Alidade rotation" aria-valuemin={0} aria-valuemax={360}
      aria-valuenow={Math.round(alidadeRotation)}
      aria-valuetext={`Altitude ${alidadeAltitudeReading(alidadeRotation).toFixed(1)} degrees on the red scale; rotation ${alidadeRotation.toFixed(1)} degrees`}
      onPointerDown={(event) => {
        const svg = event.currentTarget.ownerSVGElement;
        if (!svg) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, pointerAngle: angleFromPointer(svg, event.clientX, event.clientY), rotation: alidadeRotation };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        const svg = event.currentTarget.ownerSVGElement;
        if (!start || start.pointerId !== event.pointerId || !svg) return;
        setAlidade(start.rotation + rotationDelta(start.pointerAngle, angleFromPointer(svg, event.clientX, event.clientY)));
      }}
      onPointerUp={endDrag} onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        setAlidade(keyRotate(alidadeRotation, event.key, event.shiftKey));
      }}>
      <HighlightLayer layer="under" frame="alidade" />
      <HitArea orientation="horizontal" extent={EXTENT} />
      <FocusRing href="#alidade-metal" />
      <use href="#alidade-metal" className="astro-alidade-metal" />
      <FiducialEdge part="alidade-edge" orientation="horizontal" extent={EXTENT} />
      <g data-part="alidade-minute-scale" aria-label="Equation-of-time minutes, −20 to +20">
        <Band d={MINUTE_BAND} />
        {MINUTE_SCALE.map((tick) => <line key={tick.minutes}
          className={`astro-alidade-scale-tick${tick.labelled ? ' astro-alidade-scale-tick-major' : ''}`}
          x1={tick.radius} y1={tick.labelled ? -15 : -9} x2={tick.radius} y2={TICK_END} />)}
        {MINUTE_SCALE.filter((tick) => tick.labelled).map((tick) => (
          <text key={tick.minutes} className="astro-alidade-scale-label" x={tick.radius} y="-25" text-anchor="middle" dominant-baseline="central">{signed(tick.minutes)}</text>
        ))}
        <text className="astro-alidade-arm-label" x="350" y="-15" text-anchor="start" dominant-baseline="central">MIN</text>
      </g>
      <HighlightLayer layer="over" frame="alidade" />
    </g>
  </>;
}
