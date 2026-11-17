import type { JSX } from 'preact';
import { memo } from 'preact/compat';
import { LIMB_HOUR_RADIUS, LIMB_TICK_BASE, LIMB_TICK_RING, limbHourLabels, limbTicks } from '../limbScale';
import { useStore } from '../store';
import { INSTRUMENT_VIEWBOX, MATER_R, MaterBody, RimEdges, StaticBrassDefs } from './brass';
import { Plate } from './Plate';
import { Rete, ReteDefs, matrixTransform } from './Rete';
import { Band, HighlightLayer } from './moving';
import { Rule, RuleDefs } from './Rule';

/** Raised limb: the flat face between the well wall and the outer edge. */
export const LIMB_INNER = 540;
const LIMB_TICKS = limbTicks();
const LIMB_HOURS = limbHourLabels();

function polar(radius: number, degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180;
  return { x: radius * Math.sin(radians), y: radius * Math.cos(radians) };
}

function annulus(outer: number, inner: number): string {
  return `M 0 ${-outer} A ${outer} ${outer} 0 1 1 0 ${outer} A ${outer} ${outer} 0 1 1 0 ${-outer} M 0 ${-inner} A ${inner} ${inner} 0 1 0 0 ${inner} A ${inner} ${inner} 0 1 0 0 ${-inner} Z`;
}

/** Limb engraving (in the flipped plate frame): degree ticks inboard, 24 hours outboard, noon at the top. */
function LimbEngraving(): JSX.Element {
  return (
    <g id="front-limb-engraving">
      <circle className="astro-engraved-line" r={LIMB_TICK_RING} />
      <circle className="astro-engraved-line" r={LIMB_TICK_BASE - 1} />
      <g data-part="limb-degree-scale" aria-label="Limb with one-degree subdivisions">
        <Band d={annulus(LIMB_TICK_RING, LIMB_TICK_BASE - 1)} tint />
        {LIMB_TICKS.map((tick) => {
          const p1 = polar(LIMB_TICK_BASE, tick.degrees);
          const p2 = polar(LIMB_TICK_BASE + tick.inset, tick.degrees);
          return <line key={tick.degrees} data-part="limb-degree-scale" data-degree={tick.degrees} data-limb-degree={tick.degrees}
            className={`astro-limb-tick astro-limb-tick-${tick.level}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
        })}
      </g>
      <g data-part="limb-hour-scale" aria-label="24-hour scale, noon at the top">
        <Band d={annulus(MATER_R - 4, LIMB_TICK_RING + 2)} tint />
        {LIMB_HOURS.map(({ hour, degrees }) => {
          const p = polar(LIMB_HOUR_RADIUS, degrees);
          return <g key={hour} transform={`translate(${p.x} ${p.y}) scale(1,-1)`}>
            <text data-part="limb-hour-scale" data-hour={hour} className="astro-limb-label" text-anchor="middle" dominant-baseline="central">{hour}</text>
          </g>;
        })}
      </g>
    </g>
  );
}

interface FrontBaseProps {
  latitude: number;
  almucantars: boolean;
  azimuths: boolean;
  unequalHours: boolean;
  tropics: boolean;
}

/** The static layer: mater, throne, limb and plate. Filters are allowed here. */
const FrontBase = memo(function FrontBase(props: FrontBaseProps): JSX.Element {
  return (
    <svg data-occludes="false" className="astro-svg astro-layer-base" role="img" aria-label={`Front face, latitude plate ${props.latitude.toFixed(2)} degrees`} viewBox={INSTRUMENT_VIEWBOX}>
      <StaticBrassDefs />
      <MaterBody />
      <circle className="astro-grain" data-occludes="false" r={MATER_R} />
      <path className="astro-limb" data-part="limb" d={annulus(MATER_R, LIMB_INNER)} fill-rule="evenodd" />
      <path className="astro-raking" data-occludes="false" d={annulus(MATER_R, LIMB_INNER)} fill-rule="evenodd" />
      <circle className="astro-well" r={LIMB_INNER} />
      <RimEdges outer={MATER_R} inner={LIMB_INNER} />
      {/* On the front the limb covers the mater's face, so the mater's own outer edge is redrawn on top: what the learner sees of it. */}
      <circle className="astro-mater-rim" data-part="mater" r={MATER_R} />
      <HighlightLayer layer="under" frame="base" />
      <g transform="scale(1,-1)">
        <use href="#front-limb-engraving" className="astro-glint" data-occludes="false" transform="translate(0.9 -0.9)" />
        <LimbEngraving />
        <Plate {...props} />
      </g>
      <HighlightLayer layer="over" frame="base" />
    </svg>
  );
});

export function Front(): JSX.Element {
  const { plateLatitude, reteRotation, ruleRotation, visibility, epochIso } = useStore();

  return (
    <div className="astro-instrument" data-face="front">
      <FrontBase latitude={plateLatitude} almucantars={visibility.almucantars} azimuths={visibility.azimuths}
        unequalHours={visibility.unequalHours} tropics={visibility.tropics} />
      <svg data-occludes="false" className="astro-svg astro-layer-moving" aria-label={`Rete ${reteRotation.toFixed(1)} degrees, rule ${ruleRotation.toFixed(1)} degrees`} role="group" viewBox={INSTRUMENT_VIEWBOX}>
        <defs>
          <ReteDefs reteRotation={reteRotation} stars={visibility.stars} />
          <RuleDefs ruleRotation={ruleRotation} />
          <radialGradient id="front-pin-steel" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stop-color="var(--astro-steel-hi)" />
            <stop offset="0.55" stop-color="var(--astro-steel-mid)" />
            <stop offset="1" stop-color="var(--astro-steel-dark)" />
          </radialGradient>
        </defs>
        <Rete reteRotation={reteRotation} visibility={visibility} epochIso={epochIso} />
        <Rule ruleRotation={ruleRotation} visibility={visibility} />
        <g data-part="pin" className="astro-center-pin-decoration" aria-label="Central pin and wedge">
          <rect className="astro-cast-shadow" x="-26" y="-2" width="62" height="14" rx="4" />
          <rect className="astro-wedge" x="-32" y="-6" width="64" height="12" rx="3" />
          <circle className="astro-pin" r="15" fill="url(#front-pin-steel)" />
          <circle className="astro-pin-glint" cx="-5" cy="-5" r="4" />
        </g>
        {/* Single ticks, numerals and stars named by a step are located above the rule. */}
        <g transform="scale(1,-1)"><HighlightLayer layer="top" frame="rete" transform={matrixTransform(reteRotation)} /></g>
        <HighlightLayer layer="top" frame="base" />
      </svg>
    </div>
  );
}

