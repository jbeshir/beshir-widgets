import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { angleFromPointer, keyRotate, rotationDelta } from '../interaction';
import { setAlidade } from '../store';

interface AlidadeProps { alidadeRotation: number; }
const EXTENT = 603;

export function Alidade({ alidadeRotation }: AlidadeProps): JSX.Element {
  const drag = useRef<{ pointerId: number; pointerAngle: number; rotation: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const endDrag = (event: JSX.TargetedPointerEvent<SVGGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <g data-testid="alidade" className={`astro-rotary${dragging ? ' is-dragging' : ''}`} transform={`rotate(${-alidadeRotation})`}
      tabIndex={0} role="slider" aria-label="Alidade rotation" aria-valuemin={0} aria-valuemax={360}
      aria-valuenow={Math.round(alidadeRotation)}
      onPointerDown={(event) => {
        const svg = event.currentTarget.ownerSVGElement;
        if (!svg) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, pointerAngle: angleFromPointer(svg, event.clientX, event.clientY), rotation: alidadeRotation };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        const svg = event.currentTarget.ownerSVGElement;
        if (!start || start.pointerId !== event.pointerId || !svg) return;
        setAlidade(start.rotation + rotationDelta(start.pointerAngle, angleFromPointer(svg, event.clientX, event.clientY)));
      }}
      onPointerUp={endDrag} onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        setAlidade(keyRotate(alidadeRotation, event.key, event.shiftKey));
      }}>
      <path className="astro-alidade-bar" d={`M ${-EXTENT} 0 L -548 -8 L 548 -8 L ${EXTENT} 0 L 548 8 L -548 8 Z`} />
      <line className="astro-alidade-pointer" x1={-EXTENT} y1="0" x2={EXTENT} y2="0" />
      <path className="astro-alidade-tip" d={`M ${EXTENT} 0 l -24 -6 v 12 Z`} />
      <path className="astro-alidade-tip" d={`M ${-EXTENT} 0 l 24 -6 v 12 Z`} />
      {[-455, 455].map((x) => <g key={x} transform={`translate(${x} 0)`}>
        <path className="astro-alidade-vane" d="M -15 8 L -12 -31 Q 0 -43 12 -31 L 15 8 Z" />
        <circle className="astro-alidade-sight" cy="-24" r="4.5" />
        <line className="astro-alidade-vane-line" x1="0" y1="-19" x2="0" y2="8" />
      </g>)}
    </g>
  );
}
