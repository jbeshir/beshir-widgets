import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { rOfDec } from '../geometry';
import { angleFromPointer, keyRotate, rotationDelta } from '../interaction';
import { setRule, type Visibility } from '../store';
import { taperedRulePath } from '../ruleGeometry';
import { RULE_TIP_RADIUS } from '../limbScale';
import { FiducialEdge, FocusRing, HighlightLayer, HitArea, StackedCopies } from './moving';
import { ASTROLABE_R } from './Plate';

interface RuleProps { ruleRotation: number; visibility: Visibility; }

/** The tips reach into the limb's tick ring and stop short of the hour numerals outside it. */
const RULE_EXTENT = RULE_TIP_RADIUS;
const RULE_TAPER = { hub: 30, root: 34, shoulder: 18, shoulderAt: 470 };
const RULE_PATH = taperedRulePath('vertical', RULE_EXTENT, RULE_TAPER);
/** Bevel copies are drawn from an outline set back from the edge, so they never spill past it. */
const RULE_BEVEL_PATH = taperedRulePath('vertical', RULE_EXTENT, RULE_TAPER, 3);
/** Declination ticks start clear of the edge line, so a highlighted tick's cap stays on the metal. */
const TICK_START = 2.5;
const DECLINATIONS = Array.from({ length: 21 }, (_, index) => -20 + index * 5);

export function RuleDefs({ ruleRotation }: { ruleRotation: number }): JSX.Element {
  return <>
    <path id="rule-metal" d={RULE_PATH} />
    <path id="rule-metal-bevel" d={RULE_BEVEL_PATH} />
    <linearGradient id="rule-metal-fill" gradientUnits="userSpaceOnUse" x1="-600" y1="-600" x2="600" y2="600"
      gradientTransform={`rotate(${-ruleRotation}) scale(1,-1)`}>
      <stop offset="0" stop-color="var(--astro-gilt-hi)" />
      <stop offset="0.5" stop-color="var(--astro-gilt-mid)" />
      <stop offset="1" stop-color="var(--astro-gilt-low)" />
    </linearGradient>
  </>;
}

export function Rule({ ruleRotation, visibility }: RuleProps): JSX.Element | null {
  const drag = useRef<{ pointerId: number; pointerAngle: number; rotation: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const endDrag = (event: JSX.TargetedPointerEvent<SVGGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!visibility.rule) return null;
  const transform = `rotate(${ruleRotation})`;
  return <>
    <StackedCopies href="#rule-metal" bevelHref="#rule-metal-bevel" transform={`scale(1,-1) ${transform}`} />
    <g transform="scale(1,-1)">
      <g
        data-part="rule"
        data-hl-frame-root="rule"
        className={`astro-rotary astro-rule${dragging ? ' is-dragging' : ''}`}
        transform={transform}
        tabindex={0}
        role="slider"
        aria-label="Rule rotation"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(ruleRotation)}
        aria-valuetext={`${ruleRotation.toFixed(1)} degrees`}
        onPointerDown={(event) => {
          const svg = event.currentTarget.ownerSVGElement;
          if (!svg) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, pointerAngle: angleFromPointer(svg, event.clientX, event.clientY), rotation: ruleRotation };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          const svg = event.currentTarget.ownerSVGElement;
          if (!start || start.pointerId !== event.pointerId || !svg) return;
          setRule(start.rotation + rotationDelta(start.pointerAngle, angleFromPointer(svg, event.clientX, event.clientY)));
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
          event.preventDefault();
          setRule(keyRotate(ruleRotation, event.key, event.shiftKey));
        }}
      >
        <HighlightLayer layer="under" frame="rule" />
        <HitArea orientation="vertical" extent={RULE_EXTENT} />
        <FocusRing href="#rule-metal" />
        <use href="#rule-metal" className="astro-rule-metal" />
        <FiducialEdge part="rule-edge" orientation="vertical" extent={RULE_EXTENT} />
        {DECLINATIONS.map((declination) => {
          const y = rOfDec(declination, ASTROLABE_R);
          const major = declination % 10 === 0;
          return <g key={declination}>
            <line className={`astro-rule-tick${major ? ' astro-rule-tick-major' : ''}`} x1={TICK_START} y1={y} x2={major ? 13 : 9} y2={y} />
            {major && <g transform={`translate(15 ${y}) scale(1,-1)`}>
              <text className="astro-rule-label" text-anchor="start" dominant-baseline="central">{declination}</text>
            </g>}
          </g>;
        })}
        <HighlightLayer layer="over" frame="rule" />
      </g>
    </g>
  </>;
}
