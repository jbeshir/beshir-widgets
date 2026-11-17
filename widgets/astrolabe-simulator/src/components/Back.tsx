import type { JSX } from 'preact';
import { memo } from 'preact/compat';
import { equationOfTimeLabelPosition, equationOfTimePoint } from '../ruleGeometry';
import { shadowSquareLayout, shadowSquareNumbers } from '../shadowSquare';
import { createHoraryLayout } from '../horaryQuadrant';
import { useStore } from '../store';
import { calendarDayTicks, calendarMonthStarts } from '../calendarScale';
import { backLongitudePoint } from '../backGeometry';
import { besideRadial, numeralHalfExtents } from '../labelPlacement';
import { Alidade, AlidadeDefs } from './Alidade';
import { Band, HighlightLayer } from './moving';
import { INSTRUMENT_VIEWBOX, MATER_R, MaterBody, RimEdges, StaticBrassDefs } from './brass';
import { formatPartValue } from '../tutorial/parts';

const OUTER = 600;
const DEGREE_INNER = 548;
const ZODIAC_OUTER = 530;
const ZODIAC_INNER = 468;
const CALENDAR_INNER = 405;
const ZODIAC = ['ARI', 'TAU', 'GEM', 'CAN', 'LEO', 'VIR', 'LIB', 'SCO', 'SAG', 'CAP', 'AQU', 'PIS'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DEGREE_TICKS = Array.from({ length: 360 }, (_, index) => index);
const DEGREE_LABELS = Array.from({ length: 36 }, (_, index) => index * 10);
const ZODIAC_DIVISIONS = Array.from({ length: 12 }, (_, index) => index * 30);
const CALENDAR_DAYS = calendarDayTicks();
const MONTH_STARTS = calendarMonthStarts();
const SHADOW = shadowSquareLayout();
const SHADOW_NUMBERS = shadowSquareNumbers();
const HORARY = createHoraryLayout();
/** Font sizes of .astro-back-number and .astro-altitude-number (styles.css). */
const DEGREE_FONT = 17;
const ALTITUDE_FONT = 14;
/** UMBRA VERSA labels sit outboard of the equation-of-time loop, which reaches about 40 units beyond the square. */
const UMBRA_VERSA_OFFSET = 64;

/**
 * A numeral engraved beside its tick on the side the alidade leaves open
 * (its body lies counter-clockwise of the edge), so the edge laid on the
 * tick never covers or bisects the number it names.
 */
function besideTick(radius: number, longitude: number, text: string, fontSize: number): { x: number; y: number } {
  const { halfWidth, halfHeight } = numeralHalfExtents(text, fontSize);
  return besideRadial(backLongitudePoint(radius, longitude), 'cw', halfWidth, halfHeight, 3);
}

function ringPath(outer: number, inner: number): string {
  return `M 0 ${-outer} A ${outer} ${outer} 0 1 1 0 ${outer} A ${outer} ${outer} 0 1 1 0 ${-outer} M 0 ${-inner} A ${inner} ${inner} 0 1 0 0 ${inner} A ${inner} ${inner} 0 1 0 0 ${-inner} Z`;
}

/** Upper half of a ring, from 0 at the left through 90 at the top to 180 at the right (the altitude scales exist only there). */
function upperHalfRingPath(outer: number, inner: number): string {
  return `M ${-outer} 0 A ${outer} ${outer} 0 0 1 ${outer} 0 L ${inner} 0 A ${inner} ${inner} 0 0 0 ${-inner} 0 Z`;
}

/** A rectangle as a closed path. */
const rectPath = (x0: number, y0: number, x1: number, y1: number): string => `M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`;

function radialTick(angle: number, inner: number, outer: number, className: string, extra?: Record<string, string | undefined>): JSX.Element {
  const a = backLongitudePoint(inner, angle);
  const b = backLongitudePoint(outer, angle);
  return <line key={`${className}-${angle}-${inner}`} {...extra} className={className} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

interface BackBaseProps {
  year: number;
  zodiacScale: boolean;
  calendar: boolean;
  shadowSquare: boolean;
  backUnequalHours: boolean;
  equationOfTime: boolean;
}

/** The static back of the mater: engraved scales on brass. Filters are allowed here. */
const BackBase = memo(function BackBase({ year, zodiacScale, calendar, shadowSquare, backUnequalHours, equationOfTime }: BackBaseProps): JSX.Element {
  const daysInYear = Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1) === 366 * 86400000 ? 366 : 365;
  const equationSamples = Array.from({ length: daysInYear }, (_, day) => (
    equationOfTimePoint(new Date(Date.UTC(year, 0, day + 1, 12)))
  ));
  const equationPath = `${equationSamples.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
  const equationLabel = equationOfTimeLabelPosition(equationSamples);

  return (
    <svg
      data-occludes="false"
      className="astro-svg astro-layer-base astro-back"
      role="img"
      aria-label={`Back face with degree, zodiac and calendar scales, shadow square, unequal hours, and the ${year} equation-of-time curve`}
      viewBox={INSTRUMENT_VIEWBOX}
    >
      <StaticBrassDefs />
      <MaterBody />
      <circle className="astro-grain" data-occludes="false" r={MATER_R} />
      <circle className="astro-raking" data-occludes="false" r={MATER_R} />
      <path className="astro-burnished" d={ringPath(OUTER, DEGREE_INNER)} fill-rule="evenodd" />
      {calendar && <path className="astro-burnished" d={ringPath(ZODIAC_INNER, CALENDAR_INNER)} fill-rule="evenodd" />}
      <RimEdges outer={MATER_R} />
      <HighlightLayer layer="under" frame="base" />

      <use href="#back-engraving" className="astro-glint" data-occludes="false" transform="translate(0.9 0.9)" />
      <g id="back-engraving">
        <circle className="astro-engraved-line" r={OUTER - 2} />
        <circle className="astro-engraved-line" r={DEGREE_INNER} />
        <g data-part="back-degree-scale" aria-label="Outer ecliptic-longitude scale, marked from zero to 360 degrees">
          <Band d={ringPath(OUTER - 2, DEGREE_INNER)} tint />
          {DEGREE_TICKS.map((degrees) => radialTick(
            degrees,
            OUTER - (degrees % 10 === 0 ? 20 : degrees % 5 === 0 ? 15 : 9),
            OUTER - 2,
            degrees % 10 === 0 ? 'astro-back-tick-major' : degrees % 5 === 0 ? 'astro-back-tick-medium' : 'astro-back-tick-minor',
            { 'data-part': 'back-degree-scale', 'data-degree': formatPartValue(degrees) },
          ))}
          {DEGREE_LABELS.map((degrees) => {
            const p = besideTick(565, degrees, String(degrees), DEGREE_FONT);
            return <text key={degrees} className="astro-back-number" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="central">{degrees}</text>;
          })}
        </g>
        <g data-part="altitude-scale" aria-label="Altitude scales">
          <Band d={upperHalfRingPath(DEGREE_INNER, ZODIAC_OUTER)} tint />
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((altitude) => (
            (altitude === 90 ? [-1] : [-1, 1]).map((side) => {
              const longitude = side < 0 ? altitude : 180 - altitude;
              const p = besideTick(539, longitude, String(altitude), ALTITUDE_FONT);
              // The minute-arm quadrant (and the single 90) carries the instance: that is where lessons read a height.
              const instance = side > 0 || altitude === 90 ? { 'data-part': 'altitude-scale', 'data-altitude': formatPartValue(altitude) } : {};
              return <text key={`${side}-${altitude}`} className="astro-altitude-number" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="central" {...instance}>{altitude}</text>;
            })
          ))}
        </g>

        {zodiacScale && <g data-part="zodiac-scale" aria-label="Ecliptic-longitude ring, divided into zodiac signs with Aries at the vernal equinox on the left">
          <path className="astro-zodiac-band" d={ringPath(ZODIAC_OUTER, ZODIAC_INNER)} fill-rule="evenodd" />
          <Band d={ringPath(ZODIAC_OUTER, ZODIAC_INNER)} tint />
          {ZODIAC_DIVISIONS.map((longitude) => radialTick(longitude, ZODIAC_INNER, ZODIAC_OUTER, 'astro-zodiac-division'))}
          {ZODIAC.map((sign, index) => {
            const p = backLongitudePoint(499, index * 30 + 15);
            return <text key={sign} className="astro-back-zodiac-label" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="central">{sign}</text>;
          })}
        </g>}

        {calendar && <g data-part="calendar-scale" aria-label="Fixed 365-day calendar ring aligned with ecliptic longitude">
          <path className="astro-calendar-band" d={ringPath(ZODIAC_INNER, CALENDAR_INNER)} fill-rule="evenodd" />
          <Band d={ringPath(ZODIAC_INNER, CALENDAR_INNER)} tint />
          {CALENDAR_DAYS.map((tick) => radialTick(
            tick.longitude,
            tick.isFiveDayTick ? 448 : 455,
            ZODIAC_INNER - 2,
            'astro-calendar-tick',
            {
              'data-part': 'calendar-scale',
              'data-date': `${pad(tick.month + 1)}-${pad(tick.dayOfMonth)}`,
              'data-testid': tick.month === 6 && tick.dayOfMonth === 14 ? 'calendar-july-14' : undefined,
            },
          ))}
          {MONTH_STARTS.map((longitude) => radialTick(longitude, CALENDAR_INNER, ZODIAC_INNER, 'astro-calendar-month-line'))}
          {MONTHS.map((month, index) => {
            const next = MONTH_STARTS[(index + 1) % 12] + (index === 11 ? 360 : 0);
            const span = ((next - MONTH_STARTS[index]) + 360) % 360;
            const p = backLongitudePoint(427, MONTH_STARTS[index] + span / 2);
            return <text key={month} className="astro-calendar-label" x={p.x} y={p.y} text-anchor="middle" dominant-baseline="central">{month}</text>;
          })}
        </g>}

        <circle className="astro-engraved-line" r={CALENDAR_INNER - 2} />
        <g data-part="back-axes">
          <line className="astro-back-axis" x1="-392" y1="0" x2="392" y2="0" />
          <line className="astro-back-axis" x1="0" y1="-392" x2="0" y2="392" />
        </g>

        {shadowSquare && <g data-part="shadow-square" aria-label="Shadow square divided into twelve parts">
          <Band d={`M ${SHADOW.left} ${SHADOW.top} H ${SHADOW.right} V ${SHADOW.bottom} H ${SHADOW.left} Z`} />
          <rect data-testid="shadow-square" className="astro-shadow-square" x={SHADOW.left} y={SHADOW.top} width={SHADOW.right - SHADOW.left} height={SHADOW.bottom - SHADOW.top} />
          {SHADOW.verticals.map((x, part) => <line key={`shadow-v-${part}`} className="astro-shadow-grid" x1={x} y1={SHADOW.top} x2={x} y2={SHADOW.bottom} />)}
          {SHADOW.horizontals.map((y, part) => <line key={`shadow-h-${part}`} className="astro-shadow-grid" x1={SHADOW.left} y1={y} x2={SHADOW.right} y2={y} />)}
          <line className="astro-shadow-gnomon" x1="0" y1={SHADOW.top} x2={SHADOW.left} y2={SHADOW.bottom} />
          <line className="astro-shadow-gnomon" x1="0" y1={SHADOW.top} x2={SHADOW.right} y2={SHADOW.bottom} />
          <g data-part="umbra-recta">
            <Band d={rectPath(SHADOW.left - 12, SHADOW.bottom + 10, SHADOW.right + 12, SHADOW.bottom + 56)} />
            {SHADOW_NUMBERS.filter((n) => n.edge === 'bottom').map((n) => (
              <text key={`r-${n.x}`} className="astro-shadow-number" x={n.x} y={n.y + 17} text-anchor="middle" dominant-baseline="central">{n.value}</text>
            ))}
            <text className="astro-shadow-label" x="0" y={SHADOW.bottom + 42} text-anchor="middle" dominant-baseline="central">UMBRA RECTA</text>
          </g>
          <g data-part="umbra-versa">
            <Band d={`${rectPath(SHADOW.left - UMBRA_VERSA_OFFSET - 12, SHADOW.top - 8, SHADOW.left - 2, SHADOW.bottom + 9)} ${rectPath(SHADOW.right + 2, SHADOW.top - 8, SHADOW.right + UMBRA_VERSA_OFFSET + 12, SHADOW.bottom + 9)}`} />
            {SHADOW_NUMBERS.filter((n) => n.edge !== 'bottom').map((n) => (
              <text key={`v-${n.edge}-${n.value}`} className="astro-shadow-number" x={n.x + (n.edge === 'left' ? -10 : 10)} y={n.y}
                text-anchor={n.edge === 'left' ? 'end' : 'start'} dominant-baseline="central">{n.value}</text>
            ))}
            <text className="astro-shadow-label" transform={`translate(${SHADOW.left - UMBRA_VERSA_OFFSET} ${(SHADOW.top + SHADOW.bottom) / 2}) rotate(-90)`} text-anchor="middle" dominant-baseline="central">UMBRA VERSA</text>
            <text className="astro-shadow-label" transform={`translate(${SHADOW.right + UMBRA_VERSA_OFFSET} ${(SHADOW.top + SHADOW.bottom) / 2}) rotate(90)`} text-anchor="middle" dominant-baseline="central">UMBRA VERSA</text>
          </g>
        </g>}

        {backUnequalHours && <g data-part="horary-quadrant" aria-label="Upper semicircle for reading temporal hours I through XII, traditionally called a double horary quadrant">
          <path className="astro-horary-boundary" d={HORARY.semicirclePath} />
          <Band d={HORARY.semicirclePath} />
          {HORARY.circles.map((circle) => (
            <path key={circle.hour} data-hour={circle.hour} className={`astro-back-hour${circle.hour === 6 ? ' astro-back-hour-sixth' : ''}`} d={circle.path} />
          ))}
          {HORARY.labels.map((label) => (
            <text key={label.hour} className="astro-horary-number" x={label.position.x} y={label.position.y} text-anchor="middle" dominant-baseline="central">{label.roman}</text>
          ))}
          <text className="astro-hour-label" x={HORARY.title.position.x} y={HORARY.title.position.y} text-anchor="middle" dominant-baseline="central">{HORARY.title.text}</text>
          {HORARY.sideLabels.map((label) => (
            <text key={label.period} className="astro-hour-side-label" x={label.position.x} y={label.position.y} text-anchor="middle" dominant-baseline="central"
              aria-label={label.period === 'morning' ? 'Ante meridiem, morning hours' : 'Post meridiem, afternoon hours'}>{label.text}</text>
          ))}
        </g>}

        {equationOfTime && <g data-part="eot-curve" aria-label="Equation-of-time curve">
          <path className="astro-equation-curve" d={equationPath} />
          <text className="astro-equation-label" x={equationLabel.x} y={equationLabel.y} text-anchor="middle" aria-label="Equation of time">EOT</text>
        </g>}
      </g>
      <HighlightLayer layer="over" frame="base" />
    </svg>
  );
});

export function Back(): JSX.Element {
  const { alidadeRotation, visibility, epochIso } = useStore();
  const year = new Date(epochIso).getUTCFullYear();

  return (
    <div className="astro-instrument" data-face="back">
      <BackBase year={year} zodiacScale={visibility.zodiacScale} calendar={visibility.calendar} shadowSquare={visibility.shadowSquare}
        backUnequalHours={visibility.backUnequalHours} equationOfTime={visibility.equationOfTime} />
      <svg data-occludes="false" className="astro-svg astro-layer-moving" role="group" aria-label={`Alidade at ${alidadeRotation.toFixed(1)} degrees`} viewBox={INSTRUMENT_VIEWBOX}>
        <defs>
          <AlidadeDefs alidadeRotation={alidadeRotation} />
          <radialGradient id="back-pin-steel" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stop-color="var(--astro-steel-hi)" />
            <stop offset="0.55" stop-color="var(--astro-steel-mid)" />
            <stop offset="1" stop-color="var(--astro-steel-dark)" />
          </radialGradient>
        </defs>
        {visibility.alidade && <Alidade alidadeRotation={alidadeRotation} />}
        <g data-part="pin" className="astro-center-pin-decoration" aria-label="Pin head">
          <circle className="astro-pin" r="14" fill="url(#back-pin-steel)" />
          <circle className="astro-pin-glint" cx="-4.5" cy="-4.5" r="3.5" />
        </g>
        {/* Single ticks and numerals named by a step are located above the alidade. */}
        <HighlightLayer layer="top" frame="base" />
      </svg>
    </div>
  );
}
