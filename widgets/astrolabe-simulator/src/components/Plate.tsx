import type { JSX } from 'preact';
import {
  almucantar,
  azimuth,
  capricornRadius,
  equatorRadius,
  horizon,
  tropicCancerRadius,
  zenith,
  type HorizonGeom,
} from '../geometry';
import type { Visibility } from '../store';

export const ASTROLABE_R = 380;

interface PlateProps {
  latitude: number;
  visibility: Visibility;
}

interface UprightLabelProps {
  x: number;
  y: number;
  children: string;
  className?: string;
  fontSize?: number;
  anchor?: 'start' | 'middle' | 'end';
}

function UprightLabel({ x, y, children, className = 'astro-label', fontSize = 15, anchor = 'middle' }: UprightLabelProps): JSX.Element {
  return (
    <g transform={`translate(${x} ${y}) scale(1,-1)`}>
      <text className={className} font-size={fontSize} text-anchor={anchor} dominant-baseline="middle">{children}</text>
    </g>
  );
}

function GeometryMark({ geometry, className, extent }: { geometry: HorizonGeom; className: string; extent: number }): JSX.Element {
  if (geometry.kind === 'line') {
    return geometry.orientation === 'horizontal'
      ? <line className={className} x1={-extent} y1={geometry.value} x2={extent} y2={geometry.value} />
      : <line className={className} x1={geometry.value} y1={-extent} x2={geometry.value} y2={extent} />;
  }
  return <circle className={className} cx={geometry.cx} cy={geometry.cy} r={Math.abs(geometry.r)} />;
}

export function Plate({ latitude, visibility }: PlateProps): JSX.Element {
  const rim = capricornRadius(ASTROLABE_R);
  const cancer = tropicCancerRadius(ASTROLABE_R);
  const equator = equatorRadius(ASTROLABE_R);
  const zen = zenith(latitude, ASTROLABE_R);
  const altitudes = [10, 20, 30, 40, 50, 60, 70, 80];
  const azimuthAngles = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];

  return (
    <g aria-label={`Latitude plate ${latitude.toFixed(2)} degrees`}>
      <defs><clipPath id="plate-clip"><circle r={rim} /></clipPath></defs>
      <circle className="astro-rim" r={rim} />
      {visibility.tropics && <>
        <circle className="astro-equator" r={equator} />
        <circle className="astro-tropic" r={cancer} />
        <UprightLabel x={18} y={-rim + 42} anchor="start" fontSize={13}>Tropic of Capricorn</UprightLabel>
        <UprightLabel x={18} y={-equator + 16} anchor="start" fontSize={13}>Celestial equator</UprightLabel>
        <UprightLabel x={18} y={-cancer + 15} anchor="start" fontSize={13}>Tropic of Cancer</UprightLabel>
      </>}

      <g clip-path="url(#plate-clip)">
        {visibility.almucantars && <g>
          {altitudes.map((altitude) => {
            const curve = almucantar(latitude, altitude, ASTROLABE_R);
            return <circle key={altitude} className="astro-almucantar" cx={curve.cx} cy={curve.cy} r={Math.abs(curve.r)} />;
          })}
        </g>}
        {visibility.azimuths && <g>
          {azimuthAngles.map((angle) => <GeometryMark key={angle} geometry={azimuth(latitude, angle, ASTROLABE_R)} className="astro-azimuth" extent={rim} />)}
        </g>}
        {visibility.unequalHours && <g>
          {/* Approximation from FINDINGS §5.5: twelve evenly fanned quadratic arcs
              suggest temporal-hour divisions below the horizon; they are decorative,
              not a calibrated unequal-hour construction. */}
          {Array.from({ length: 11 }, (_, index) => {
            const t = (index + 1) / 12;
            const x = (t * 2 - 1) * equator * 0.92;
            return <path key={index} className="astro-unequal-hour" d={`M 0 ${equator * 0.16} Q ${x * 0.55} ${equator * 0.92} ${x} ${rim * 0.92}`} />;
          })}
        </g>}
        <GeometryMark geometry={horizon(latitude, ASTROLABE_R)} className="astro-horizon" extent={rim} />
      </g>

      {visibility.almucantars && <>
        {[30, 60].map((altitude) => {
          const curve = almucantar(latitude, altitude, ASTROLABE_R);
          return <UprightLabel key={altitude} x={34} y={curve.cy - curve.r} className="astro-label-muted" fontSize={13}>{`${altitude}°`}</UprightLabel>;
        })}
      </>}
      <circle className="astro-zenith-dot" cx={zen.x} cy={zen.y} r={5} />
      <UprightLabel x={zen.x + 20} y={zen.y + 8} anchor="start" fontSize={14}>Zenith</UprightLabel>
    </g>
  );
}
