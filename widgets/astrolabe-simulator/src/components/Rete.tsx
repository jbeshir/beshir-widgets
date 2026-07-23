import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { solarLongitude } from '../astro';
import { STARS } from '../data/stars';
import { capricornRadius, eclipticCircle, eclipticPoint, project } from '../geometry';
import { setRete, type Visibility } from '../store';
import { angleFromPointer, keyRotate, rotationDelta } from '../interaction';
import { ASTROLABE_R } from './Plate';

interface ReteProps { reteRotation: number; visibility: Visibility; }

// Three-letter abbreviations, matching the back face's zodiac ring, rather
// than the Unicode astrological glyphs (♈–♓): several platforms substitute
// those code points with a color-emoji font, which produced the bright
// rainbow "bubbles" this pass is meant to remove. Plain text can't be
// swapped for an emoji glyph, so it always renders in the brass ink color.
const ZODIAC = [
  ['ARI', 'Aries'], ['TAU', 'Taurus'], ['GEM', 'Gemini'], ['CAN', 'Cancer'],
  ['LEO', 'Leo'], ['VIR', 'Virgo'], ['LIB', 'Libra'], ['SCO', 'Scorpio'],
  ['SAG', 'Sagittarius'], ['CAP', 'Capricorn'], ['AQU', 'Aquarius'], ['PIS', 'Pisces'],
] as const;

function uprightTransform(x: number, y: number, rotation: number): string {
  return `translate(${x} ${y}) rotate(${-rotation}) scale(1,-1)`;
}

export function Rete({ reteRotation, visibility }: ReteProps): JSX.Element {
  const ecliptic = eclipticCircle(ASTROLABE_R);
  const rim = capricornRadius(ASTROLABE_R);
  const sun = eclipticPoint(solarLongitude(new Date()), ASTROLABE_R);
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
      className={`astro-rotary${dragging ? ' is-dragging' : ''}`}
      transform={`rotate(${reteRotation})`}
      tabIndex={0}
      role="slider"
      aria-label="Rete rotation"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(reteRotation)}
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
      <circle className="astro-rotary-hit" r={rim} />
      {visibility.ecliptic && <g clip-path="url(#plate-clip)">
        <circle className="astro-rete-ring" cx={ecliptic.cx} cy={ecliptic.cy} r={ecliptic.r} />
        <circle className="astro-rete-thin" cx={ecliptic.cx} cy={ecliptic.cy} r={ecliptic.r - 14} />
        {ZODIAC.map(([abbr, name], index) => {
          const point = eclipticPoint(index * 30, ASTROLABE_R);
          const inner = eclipticPoint(index * 30, ASTROLABE_R - 20);
          const label = eclipticPoint(index * 30 + 15, ASTROLABE_R - 27);
          return <g key={name}>
            <line className="astro-zodiac-tick" x1={point.x} y1={point.y} x2={inner.x} y2={inner.y} />
            <g transform={uprightTransform(label.x, label.y, reteRotation)}>
              <text className="astro-zodiac-label" text-anchor="middle" dominant-baseline="middle" aria-label={name}>{abbr}</text>
            </g>
          </g>;
        })}
        <circle className="astro-sun" cx={sun.x} cy={sun.y} r={9} />
        <circle cx={sun.x} cy={sun.y} r={3} fill="var(--astro-mater-fill)" />
      </g>}

      {visibility.stars && <g clip-path="url(#plate-clip)">
        {STARS.filter((star) => star.onPlate).map((star) => {
          const point = project(star.raDeg, star.decDeg, ASTROLABE_R);
          const length = 27;
          const scale = point.r > 0 ? (point.r - length) / point.r : 0;
          const baseX = point.x * scale;
          const baseY = point.y * scale;
          const labelX = point.x + (point.x >= 0 ? 13 : -13);
          return <g key={star.bayer}>
            <path className="astro-rete-pointer" d={`M ${baseX} ${baseY} L ${point.x} ${point.y} L ${baseX + (point.y / Math.max(point.r, 1)) * 5} ${baseY - (point.x / Math.max(point.r, 1)) * 5}`} />
            <circle className="astro-star-dot" cx={point.x} cy={point.y} r={3.5} />
            {star.label && <g transform={uprightTransform(labelX, point.y, reteRotation)}>
              <text className="astro-star-label" x={0} y={0} text-anchor={point.x >= 0 ? 'start' : 'end'} dominant-baseline="middle">{star.name}</text>
            </g>}
          </g>;
        })}
        <circle className="astro-rete-thin" r={rim * 0.13} />
      </g>}
    </g>
  );
}
