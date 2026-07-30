import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { solarLongitude } from '../astro';
import { STARS } from '../data/stars';
import { capricornRadius, eclipticCircle, eclipticPoint, project } from '../geometry';
import { setRete, useStore, type Visibility } from '../store';
import { angleFromPointer, keyRotate, rotationDelta } from '../interaction';
import { ASTROLABE_R } from './Plate';
import { eclipticLabels, eclipticTicks } from '../eclipticScale';

interface ReteProps { reteRotation: number; visibility: Visibility; }

const ECLIPTIC_TICKS = eclipticTicks().map((tick) => ({
  ...tick,
  outer: eclipticPoint(tick.longitude, ASTROLABE_R),
  inner: eclipticPoint(tick.longitude, ASTROLABE_R - tick.inset),
}));
const ECLIPTIC_LABELS = eclipticLabels().map((longitude) => ({
  longitude,
  point: eclipticPoint(longitude, ASTROLABE_R - 29),
}));
const RETE_RIM = capricornRadius(ASTROLABE_R);

function uprightTransform(x: number, y: number, rotation: number): string {
  return `translate(${x} ${y}) rotate(${-rotation}) scale(1,-1)`;
}

export function Rete({ reteRotation, visibility }: ReteProps): JSX.Element {
  const { epochIso } = useStore();
  const ecliptic = eclipticCircle(ASTROLABE_R);
  const rim = capricornRadius(ASTROLABE_R);
  const sun = eclipticPoint(solarLongitude(new Date(epochIso)), ASTROLABE_R);
  const drag = useRef<{ pointerId: number; pointerAngle: number; rotation: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const endDrag = (event: JSX.TargetedPointerEvent<SVGGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <g
      data-tutorial-target="front.rete"
      className={`astro-rotary${dragging ? ' is-dragging' : ''}`}
      transform={`rotate(${reteRotation})`}
      tabIndex={0}
      role="slider"
      aria-label="Rete rotation"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(reteRotation)}
      aria-valuetext={`${reteRotation.toFixed(1)} degrees`}
      onPointerDown={(event) => {
        const svg = event.currentTarget.ownerSVGElement;
        if (!svg) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, pointerAngle: angleFromPointer(svg, event.clientX, event.clientY), rotation: reteRotation };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        const svg = event.currentTarget.ownerSVGElement;
        if (!start || start.pointerId !== event.pointerId || !svg) return;
        setRete(start.rotation + rotationDelta(start.pointerAngle, angleFromPointer(svg, event.clientX, event.clientY)));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        setRete(keyRotate(reteRotation, event.key, event.shiftKey));
      }}
    >
      <defs>
        <filter
          id="rete-edge-texture"
          x={-RETE_RIM}
          y={-RETE_RIM}
          width={RETE_RIM * 2}
          height={RETE_RIM * 2}
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.18 0.55" numOctaves="2" seed="23" result="noise" />
          <feColorMatrix
            in="noise"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0.34 0.34 0.34 0 -0.48"
            result="grain-alpha"
          />
          <feFlood flood-color="var(--astro-line-strong)" result="grain-colour" />
          <feComposite in="grain-colour" in2="grain-alpha" operator="in" result="tinted-grain" />
          <feComposite in="tinted-grain" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <circle className="astro-rotary-hit" r={rim} />
      <circle className="astro-rete-outer-rim" r={RETE_RIM} aria-label="Outer frame of the rete" />
      <circle className="astro-rete-edge-texture" r={RETE_RIM - 10} aria-hidden="true" />
      {visibility.ecliptic && <g clip-path="url(#plate-clip)" aria-label="Ecliptic longitude scale, graduated every half degree">
        <circle className="astro-rete-ring" cx={ecliptic.cx} cy={ecliptic.cy} r={ecliptic.r} />
        <circle className="astro-rete-thin" cx={ecliptic.cx} cy={ecliptic.cy} r={ecliptic.r - 14} />
        {ECLIPTIC_TICKS.map((tick) =>
          <line key={`degree-${tick.longitude}`} data-ecliptic-longitude={tick.longitude} className={`astro-ecliptic-tick astro-ecliptic-tick-${tick.level}`} x1={tick.outer.x} y1={tick.outer.y} x2={tick.inner.x} y2={tick.inner.y} />,
        )}
        {ECLIPTIC_LABELS.map(({ longitude, point }) => {
          return <g key={longitude} transform={uprightTransform(point.x, point.y, reteRotation)}>
            <text className="astro-ecliptic-degree-label" text-anchor="middle" dominant-baseline="middle">{longitude}°</text>
          </g>;
        })}
        <g data-tutorial-target="front.sun">
          <circle className="astro-sun" cx={sun.x} cy={sun.y} r={9} />
          <circle cx={sun.x} cy={sun.y} r={3} fill="var(--astro-mater-fill)" />
        </g>
      </g>}

      {visibility.stars && <g clip-path="url(#plate-clip)">
        {STARS.filter((star) => star.onPlate).map((star) => {
          const point = project(star.raDeg, star.decDeg, ASTROLABE_R);
          const labelX = point.x + (point.x >= 0 ? 13 : -13);
          return <g key={star.bayer} data-tutorial-target={star.name === 'Sirius' ? 'front.star.sirius' : undefined}>
            <circle className="astro-star-dot" cx={point.x} cy={point.y} r={3.5} />
            {star.label && <g transform={uprightTransform(labelX, point.y, reteRotation)}>
              <text className="astro-star-label" x={0} y={0} text-anchor={point.x >= 0 ? 'start' : 'end'} dominant-baseline="middle">{star.name}</text>
            </g>}
          </g>;
        })}
      </g>}
    </g>
  );
}
