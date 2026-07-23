import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { capricornRadius } from '../geometry';
import { angleFromPointer, keyRotate, rotationDelta } from '../interaction';
import { setRule, type Visibility } from '../store';
import { ASTROLABE_R } from './Plate';

interface RuleProps { ruleRotation: number; visibility: Visibility; }

export function Rule({ ruleRotation, visibility }: RuleProps): JSX.Element | null {
  const rim = capricornRadius(ASTROLABE_R);
  const ticks = Array.from({ length: 17 }, (_, index) => -rim + 34 + index * ((rim * 2 - 68) / 16));
  const drag = useRef<{ pointerId: number; pointerAngle: number; rotation: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const endDrag = (event: JSX.TargetedPointerEvent<SVGGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!visibility.rule) return null;
  return (
    <g
      className={`astro-rotary${dragging ? ' is-dragging' : ''}`}
      transform={`rotate(${ruleRotation})`}
      tabIndex={0}
      role="slider"
      aria-label="Rule rotation"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(ruleRotation)}
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
      <path className="astro-rule-body" d={`M -2.6 ${-rim + 18} L 2.6 ${-rim + 18} L 2.6 ${rim - 18} L -2.6 ${rim - 18} Z`} />
      <path className="astro-rule-tip" d={`M 0 ${-rim - 7} L 5.5 ${-rim + 18} L -5.5 ${-rim + 18} Z`} />
      <path className="astro-rule-tip" d={`M 0 ${rim + 7} L 5.5 ${rim - 18} L -5.5 ${rim - 18} Z`} />
      <line className="astro-rule-edge" x1="0" y1={-rim - 7} x2="0" y2={rim + 7} />
      {ticks.map((y, index) => <line key={index} className="astro-rule-tick" x1={index % 4 === 0 ? -8 : -5} y1={y} x2={index % 4 === 0 ? 8 : 5} y2={y} stroke-width={index % 4 === 0 ? 1.1 : 0.65} />)}
    </g>
  );
}
