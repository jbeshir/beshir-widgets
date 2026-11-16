import type { JSX } from 'preact';
import {
  almucantar,
  azimuth,
  azimuthHalfPath,
  capricornRadius,
  equatorRadius,
  horizon,
  projectHorizontal,
  tropicCancerRadius,
  zenith,
  type HorizonGeom,
} from '../geometry';
import { UNEQUAL_HOUR_LINES, unequalHourLabels, unequalHourPath } from '../unequalHours';

/**
 * Reference radius of the stereographic projection (equator radius). Chosen
 * so the Capricorn rim sits just inside the raised limb.
 */
export const ASTROLABE_R = 340;
/** The plate disc sitting in the mater's well. */
export const PLATE_R = 532;

interface PlateProps {
  latitude: number;
  almucantars: boolean;
  azimuths: boolean;
  unequalHours: boolean;
  tropics: boolean;
}

type DataAttributes = Record<`data-${string}`, string | number>;

interface UprightLabelProps {
  x: number;
  y: number;
  children: string;
  className?: string;
  fontSize?: number;
  anchor?: 'start' | 'middle' | 'end';
  data?: DataAttributes;
}

function UprightLabel({ x, y, children, className = 'astro-label', fontSize = 15, anchor = 'middle', data }: UprightLabelProps): JSX.Element {
  return (
    <g transform={`translate(${x} ${y}) scale(1,-1)`} {...data}>
      <text className={className} font-size={fontSize} text-anchor={anchor} dominant-baseline="central">{children}</text>
    </g>
  );
}

function GeometryMark({ geometry, className, extent, data }: { geometry: HorizonGeom; className: string; extent: number; data?: DataAttributes }): JSX.Element {
  if (geometry.kind === 'line') {
    return geometry.orientation === 'horizontal'
      ? <line className={className} {...data} x1={-extent} y1={geometry.value} x2={extent} y2={geometry.value} />
      : <line className={className} {...data} x1={geometry.value} y1={-extent} x2={geometry.value} y2={extent} />;
  }
  return <circle className={className} {...data} cx={geometry.cx} cy={geometry.cy} r={Math.abs(geometry.r)} />;
}

const ALTITUDES = [10, 20, 30, 40, 50, 60, 70, 80];

/**
 * Foot label of an azimuth line: just above the horizon, or, where the
 * horizon lies beyond the Capricorn rim, the first altitude at which the
 * line comes back onto the engraved plate.
 */
function azimuthLabelPoint(latitude: number, degrees: number, rim: number): { x: number; y: number } {
  for (let altitude = 5; altitude < 85; altitude += 1) {
    const point = projectHorizontal(latitude, altitude, degrees, ASTROLABE_R);
    if (point.r < rim - 30) return point;
  }
  return projectHorizontal(latitude, 85, degrees, ASTROLABE_R);
}
const AZIMUTHS = Array.from({ length: 12 }, (_, index) => index * 30);

/**
 * The latitude plate: an opaque brass disc in the well, its projection lines
 * engraved (dark incision plus a light offset glint drawn by the parent via
 * `<use href="#plate-engraving">`). Drawn in the flipped computation frame.
 */
export function Plate({ latitude, almucantars, azimuths, unequalHours, tropics }: PlateProps): JSX.Element {
  const rim = capricornRadius(ASTROLABE_R);
  const cancer = tropicCancerRadius(ASTROLABE_R);
  const equator = equatorRadius(ASTROLABE_R);
  const zen = zenith(latitude, ASTROLABE_R);
  const horizonGeometry = horizon(latitude, ASTROLABE_R);
  const hourLabels = unequalHourLabels(latitude, ASTROLABE_R);

  return (
    <g data-part="plate" aria-label={`Latitude plate ${latitude.toFixed(2)} degrees`}>
      <defs>
        <clipPath id="plate-clip"><circle r={rim} /></clipPath>
        <clipPath id="plate-disc-clip"><circle r={PLATE_R} /></clipPath>
        <clipPath id="above-horizon-clip">
          {horizonGeometry.kind === 'circle'
            ? <circle cx={horizonGeometry.cx} cy={horizonGeometry.cy} r={Math.abs(horizonGeometry.r)} />
            : <rect x={-rim} y={horizonGeometry.value} width={rim * 2} height={rim} />}
        </clipPath>
      </defs>
      <circle className="astro-plate-disc" r={PLATE_R} />
      <circle className="astro-grain" data-occludes="false" r={PLATE_R} />
      <circle className="astro-plate-edge" r={PLATE_R - 1} />
      <use href="#plate-engraving" className="astro-glint" data-occludes="false" transform="translate(0.9 -0.9)" />
      <g id="plate-engraving">
        <g data-part="tropic-capricorn">
          <circle className="astro-tropic-capricorn" r={rim} />
          {tropics && <UprightLabel x={-16} y={rim - 46} anchor="end" fontSize={14}>Tropic of Capricorn</UprightLabel>}
        </g>
        {tropics && <>
          <g data-part="equator">
            <circle className="astro-equator" r={equator} />
            <UprightLabel x={-16} y={equator - 15} anchor="end" fontSize={14}>Celestial equator</UprightLabel>
          </g>
          <g data-part="tropic-cancer">
            <circle className="astro-tropic" r={cancer} />
            <UprightLabel x={-16} y={cancer - 14} anchor="end" fontSize={14}>Tropic of Cancer</UprightLabel>
          </g>
        </>}

        <g clip-path="url(#plate-clip)">
          {almucantars && <g>
            {ALTITUDES.map((altitude) => {
              const curve = almucantar(latitude, altitude, ASTROLABE_R);
              return <circle key={altitude} data-part="almucantar" data-altitude={altitude} className="astro-almucantar" cx={curve.cx} cy={curve.cy} r={Math.abs(curve.r)} />;
            })}
          </g>}
          {azimuths && <g clip-path="url(#above-horizon-clip)">
            {AZIMUTHS.filter((degrees) => degrees !== 180).map((degrees) => (
              degrees === 0
                ? <GeometryMark key={degrees} geometry={azimuth(latitude, 90, ASTROLABE_R)} className="astro-meridian" extent={rim} data={{ 'data-part': 'meridian-line' }} />
                : <path key={degrees} d={azimuthHalfPath(latitude, degrees, ASTROLABE_R)} className="astro-azimuth"
                  data-part="azimuth-line" data-azimuth={degrees} />
            ))}
          </g>}
          {unequalHours && <g>
            {UNEQUAL_HOUR_LINES.map((hour) =>
              <path key={hour} data-part="unequal-hour-line" data-hour={hour} className="astro-unequal-hour" d={unequalHourPath(latitude, hour, ASTROLABE_R)} />,
            )}
          </g>}
          <GeometryMark geometry={horizonGeometry} className="astro-horizon" extent={rim} data={{ 'data-part': 'horizon' }} />
        </g>

        {unequalHours && <g aria-label="Unequal-hour numerals I to XI">
          {hourLabels.map((label) => (
            <UprightLabel key={label.hour} x={label.point.x} y={label.point.y} className="astro-label astro-plate-numeral astro-roman" fontSize={17}
              data={{ 'data-part': 'unequal-hour-line', 'data-hour': label.hour }}>{label.roman}</UprightLabel>
          ))}
        </g>}
        {almucantars && <g aria-label="Altitude degree labels">
          {ALTITUDES.map((altitude) => {
            const label = projectHorizontal(latitude, altitude, 96, ASTROLABE_R);
            return <UprightLabel key={altitude} x={label.x} y={label.y} className="astro-label astro-plate-numeral" fontSize={13}
              data={{ 'data-part': 'almucantar', 'data-altitude': altitude }}>{`${altitude}°`}</UprightLabel>;
          })}
        </g>}
        {azimuths && <g aria-label="Azimuth degree labels">
          {AZIMUTHS.map((degrees) => {
            const label = azimuthLabelPoint(latitude, degrees, rim);
            return <UprightLabel key={degrees} x={label.x} y={label.y} className="astro-label astro-plate-numeral" fontSize={13}
              data={{ 'data-part': 'azimuth-line', 'data-azimuth': degrees }}>{`${degrees}°`}</UprightLabel>;
          })}
        </g>}
        <g data-part="zenith">
          <circle className="astro-zenith-dot" cx={zen.x} cy={zen.y} r={5} />
          {/* Left of the meridian: the side the rule leaves open at rest (its upper arm carries its body to the right). */}
          <UprightLabel x={zen.x - 14} y={zen.y + 12} anchor="end" fontSize={15}>Zenith</UprightLabel>
        </g>
      </g>
      <circle className="astro-well-shadow" data-occludes="false" clip-path="url(#plate-disc-clip)" cx="3" cy="-5" r={PLATE_R + 4} />
    </g>
  );
}
