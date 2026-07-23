import type { JSX } from 'preact';
import { capricornRadius } from '../geometry';
import { useStore } from '../store';
import { ASTROLABE_R, Plate } from './Plate';
import { Rete } from './Rete';
import { Rule } from './Rule';

const VIEWBOX = '-620 -620 1240 1240';

function polar(radius: number, degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180;
  return { x: radius * Math.sin(radians), y: radius * Math.cos(radians) };
}

export function Front(): JSX.Element {
  const { plateLatitude, reteRotation, ruleRotation, visibility } = useStore();
  const rim = capricornRadius(ASTROLABE_R);
  const outer = ASTROLABE_R * 1.58;
  const ticks = Array.from({ length: 120 }, (_, index) => index * 3);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const annulus = `M 0 ${-outer} A ${outer} ${outer} 0 1 1 0 ${outer} A ${outer} ${outer} 0 1 1 0 ${-outer} M 0 ${-rim} A ${rim} ${rim} 0 1 0 0 ${rim} A ${rim} ${rim} 0 1 0 0 ${-rim}`;

  return (
    <svg className="astro-svg" role="img" aria-label={`Front face, latitude ${plateLatitude.toFixed(2)} degrees, rete ${reteRotation.toFixed(1)} degrees, rule ${ruleRotation.toFixed(1)} degrees`} viewBox={VIEWBOX}>
      <defs>
        <radialGradient id="front-mater-surface" cx="34%" cy="28%" r="72%">
          <stop offset="0%" stop-color="var(--astro-device-surface-light)" />
          <stop offset="62%" stop-color="var(--astro-device-surface)" />
          <stop offset="100%" stop-color="var(--astro-device-surface-dark)" />
        </radialGradient>
      </defs>
      <circle className="astro-device-depth" r={outer + 13} />
      <circle className="astro-mater" r={outer + 8} fill="url(#front-mater-surface)" />
      <path className="astro-limb-band" d={annulus} fill-rule="evenodd" />
      <g transform="scale(1,-1)">
        <g aria-label="Limb hour and degree scales">
          {ticks.map((degrees) => {
            const major = degrees % 15 === 0;
            const p1 = polar(outer - (major ? 18 : degrees % 5 === 0 ? 12 : 7), degrees);
            const p2 = polar(outer - 2, degrees);
            return <line key={degrees} className={major ? 'astro-limb-tick-major' : 'astro-limb-tick-minor'} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
          })}
          {hours.map((hour) => {
            const p = polar(outer - 31, hour * 15);
            return <g key={hour} transform={`translate(${p.x} ${p.y}) scale(1,-1)`}>
              <text className="astro-limb-label" font-size="15" font-weight="600" text-anchor="middle" dominant-baseline="middle">{hour}</text>
            </g>;
          })}
        </g>
        <Plate latitude={plateLatitude} visibility={visibility} />
        <Rete reteRotation={reteRotation} visibility={visibility} />
        <Rule ruleRotation={ruleRotation} visibility={visibility} />
        <circle className="astro-pin" r={11} />
        <circle r={3.5} fill="var(--astro-mater-fill)" />
      </g>
    </svg>
  );
}
