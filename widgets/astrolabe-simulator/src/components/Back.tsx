import type { JSX } from 'preact';
import { solarLongitude } from '../astro';
import { useStore } from '../store';
import { Alidade } from './Alidade';

const VIEWBOX = '-620 -620 1240 1240';
const OUTER = 600;
const ZODIAC_OUTER = 530;
const ZODIAC_INNER = 468;
const CALENDAR_INNER = 405;
const ZODIAC = ['ARI', 'TAU', 'GEM', 'CAN', 'LEO', 'VIR', 'LIB', 'SCO', 'SAG', 'CAP', 'AQU', 'PIS'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function zodiacPoint(radius: number, longitude: number): { x: number; y: number } {
  const radians = longitude * Math.PI / 180;
  // Aries 0° is the left horizontal; longitude advances toward the top.
  return { x: -radius * Math.cos(radians), y: -radius * Math.sin(radians) };
}

function ringPath(outer: number, inner: number): string {
  return `M 0 ${-outer} A ${outer} ${outer} 0 1 1 0 ${outer} A ${outer} ${outer} 0 1 1 0 ${-outer} M 0 ${-inner} A ${inner} ${inner} 0 1 0 0 ${inner} A ${inner} ${inner} 0 1 0 0 ${-inner}`;
}

function radialTick(angle: number, inner: number, outer: number, className: string): JSX.Element {
  const a = zodiacPoint(inner, angle);
  const b = zodiacPoint(outer, angle);
  return <line key={`${className}-${angle}-${inner}`} className={className} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
}

export function Back(): JSX.Element {
  const { alidadeRotation } = useStore();
  const year = new Date().getFullYear();
  const degreeTicks = Array.from({ length: 180 }, (_, index) => index * 2);
  const degreeLabels = Array.from({ length: 12 }, (_, index) => index * 30);
  const zodiacDivisions = Array.from({ length: 12 }, (_, index) => index * 30);
  const calendarDays: number[] = [];
  for (let month = 0; month < 12; month += 1) {
    const days = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= days; day += 1) {
      calendarDays.push(solarLongitude(new Date(year, month, day)));
    }
  }
  const monthStarts = MONTHS.map((_, month) => solarLongitude(new Date(year, month, 1)));
  const shadowHalf = 228;
  const shadowTop = 72;
  const shadowStep = shadowHalf / 12;
  const shadowVerticals = Array.from({ length: 25 }, (_, index) => index);
  const shadowHorizontals = Array.from({ length: 13 }, (_, index) => index);
  const hourArcs = Array.from({ length: 5 }, (_, index) => index + 1);

  return (
    <svg
      className="astro-svg astro-back"
      role="img"
      aria-label={`Back face with degree, zodiac and ${year} calendar scales, shadow square, unequal hours, and alidade at ${alidadeRotation.toFixed(1)} degrees`}
      viewBox={VIEWBOX}
    >
      <circle className="astro-mater" r="608" />
      <path className="astro-back-limb" d={ringPath(OUTER, 548)} fill-rule="evenodd" />

      <g aria-label="Outer degree and altitude scales">
        {degreeTicks.map((degrees) => radialTick(degrees, OUTER - (degrees % 10 === 0 ? 20 : 10), OUTER - 2, degrees % 10 === 0 ? 'astro-back-tick-major' : 'astro-back-tick-minor'))}
        {degreeLabels.map((degrees) => {
          const p = zodiacPoint(564, degrees);
          return <text key={degrees} className="astro-back-number" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="middle">{degrees}</text>;
        })}
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((altitude) => (
          (altitude === 90 ? [-1] : [-1, 1]).map((side) => {
            const longitude = side < 0 ? altitude : 180 - altitude;
            const p = zodiacPoint(538, longitude);
            return <text key={`${side}-${altitude}`} className="astro-altitude-number" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="middle">{altitude}</text>;
          })
        ))}
      </g>

      <path className="astro-zodiac-band" d={ringPath(ZODIAC_OUTER, ZODIAC_INNER)} fill-rule="evenodd" />
      <g aria-label="Zodiac ring, Aries at the vernal equinox on the left">
        {zodiacDivisions.map((longitude) => radialTick(longitude, ZODIAC_INNER, ZODIAC_OUTER, 'astro-zodiac-division'))}
        {ZODIAC.map((sign, index) => {
          const p = zodiacPoint(499, index * 30 + 15);
          return <text key={sign} className="astro-back-zodiac-label" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="middle">{sign}</text>;
        })}
      </g>

      <path className="astro-calendar-band" d={ringPath(ZODIAC_INNER, CALENDAR_INNER)} fill-rule="evenodd" />
      <g aria-label={`${year} calendar ring aligned by computed solar longitude`}>
        {calendarDays.map((longitude, index) => radialTick(longitude, index % 5 === 0 ? 450 : 456, ZODIAC_INNER - 2, 'astro-calendar-tick'))}
        {monthStarts.map((longitude) => radialTick(longitude, CALENDAR_INNER, ZODIAC_INNER, 'astro-calendar-month-line'))}
        {MONTHS.map((month, index) => {
          const next = monthStarts[(index + 1) % 12] + (index === 11 ? 360 : 0);
          const span = ((next - monthStarts[index]) + 360) % 360;
          const p = zodiacPoint(429, monthStarts[index] + span / 2);
          return <text key={month} className="astro-calendar-label" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="middle">{month}</text>;
        })}
      </g>

      <circle className="astro-back-field" r={CALENDAR_INNER - 2} />
      <line className="astro-back-axis" x1="-392" y1="0" x2="392" y2="0" />
      <line className="astro-back-axis" x1="0" y1="-392" x2="0" y2="392" />

      <g aria-label="Shadow square divided into twelve parts">
        <rect className="astro-shadow-square" x={-shadowHalf} y={shadowTop} width={shadowHalf * 2} height={shadowHalf} />
        {shadowVerticals.map((part) => {
          const x = -shadowHalf + part * shadowStep;
          return <line key={`shadow-v-${part}`} className="astro-shadow-grid" x1={x} y1={shadowTop} x2={x} y2={shadowTop + shadowHalf} />;
        })}
        {shadowHorizontals.map((part) => {
          const y = shadowTop + part * shadowStep;
          return <line key={`shadow-h-${part}`} className="astro-shadow-grid" x1={-shadowHalf} y1={y} x2={shadowHalf} y2={y} />;
        })}
        <line className="astro-shadow-gnomon" x1="0" y1={shadowTop} x2={-shadowHalf} y2={shadowTop + shadowHalf} />
        <line className="astro-shadow-gnomon" x1="0" y1={shadowTop} x2={shadowHalf} y2={shadowTop + shadowHalf} />
        {[2, 4, 6, 8, 10, 12].map((n) => <text key={`r-${n}`} className="astro-shadow-number" x={n * shadowStep} y={shadowTop + shadowHalf + 18} text-anchor="middle">{n}</text>)}
        {[2, 4, 6, 8, 10, 12].map((n) => <text key={`v-${n}`} className="astro-shadow-number" x={-shadowHalf - 14} y={shadowTop + n * shadowStep} text-anchor="end" dominant-baseline="middle">{n}</text>)}
        <text className="astro-shadow-label" x="0" y={shadowTop + shadowHalf + 42} text-anchor="middle">UMBRA RECTA</text>
        <text className="astro-shadow-label" transform={`translate(${-shadowHalf - 48} ${shadowTop + shadowHalf / 2}) rotate(-90)`} text-anchor="middle">UMBRA VERSA</text>
      </g>

      <g aria-label="Approximate unequal temporal hour arcs">
        {hourArcs.map((hour) => <path key={hour} className="astro-back-hour" d={`M -360 ${20 + hour * 18} Q 0 ${-80 + hour * 42} 360 ${20 + hour * 18}`} />)}
        <text className="astro-hour-label" x="0" y="60" text-anchor="middle">HORAE INAEQUALES</text>
      </g>

      <Alidade alidadeRotation={alidadeRotation} />
      <circle className="astro-pin" r="13" />
      <circle className="astro-pin-core" r="4" />
    </svg>
  );
}
