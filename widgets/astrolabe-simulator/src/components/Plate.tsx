import type { JSX } from 'preact';
import {
  almucantar,
  azimuth,
  capricornRadius,
  equatorRadius,
  horizon,
  projectHorizontal,
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
  const horizonGeometry = horizon(latitude, ASTROLABE_R);
  const altitudes = [10, 20, 30, 40, 50, 60, 70, 80];
  const azimuthDegrees = Array.from({ length: 12 }, (_, index) => index * 30);

  return (
    <g aria-label={`Latitude plate ${latitude.toFixed(2)} degrees`}>
      <defs>
        <clipPath id="plate-clip"><circle r={rim} /></clipPath>
        <clipPath id="above-horizon-clip">
          {horizonGeometry.kind === 'circle'
            ? <circle cx={horizonGeometry.cx} cy={horizonGeometry.cy} r={Math.abs(horizonGeometry.r)} />
            : <rect x={-rim} y={horizonGeometry.value} width={rim * 2} height={rim} />}
        </clipPath>
      </defs>
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
        {visibility.azimuths && <g clip-path="url(#above-horizon-clip)">
          {azimuthDegrees.map((degrees) => <GeometryMark key={degrees} geometry={azimuth(latitude, 90 - degrees, ASTROLABE_R)} className="astro-azimuth" extent={rim} />)}
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
        <GeometryMark geometry={horizonGeometry} className="astro-horizon" extent={rim} />
      </g>

      {visibility.almucantars && <g aria-label="Altitude degree labels">
        {altitudes.map((altitude) => {
          const label = projectHorizontal(latitude, altitude, 96, ASTROLABE_R);
          return <UprightLabel key={altitude} x={label.x} y={label.y} className="astro-label-muted astro-grid-degree-label" fontSize={11}>{`${altitude}°`}</UprightLabel>;
        })}
      </g>}
      {visibility.azimuths && <g aria-label="Azimuth degree labels">
        {azimuthDegrees.map((degrees) => {
          const label = projectHorizontal(latitude, 5, degrees, ASTROLABE_R);
          return <UprightLabel key={degrees} x={label.x} y={label.y} className="astro-label-muted astro-grid-degree-label" fontSize={10}>{`${degrees}°`}</UprightLabel>;
        })}
      </g>}
      <circle className="astro-zenith-dot" cx={zen.x} cy={zen.y} r={5} />
      <UprightLabel x={zen.x + 20} y={zen.y + 8} anchor="start" fontSize={14}>Zenith</UprightLabel>
    </g>
  );
}
