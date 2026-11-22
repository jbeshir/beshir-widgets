import type { JSX } from 'preact';
import { memo } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { solarLongitude } from '../astro';
import { STARS } from '../data/stars';
import { eclipticCircle, eclipticPoint, orientRetePoint, reteOrientationMatrix } from '../geometry';
import { setRete, type Visibility } from '../store';
import { angleFromPointer, keyRotate, rotationDelta } from '../interaction';
import { eclipticLabels, eclipticTicks } from '../eclipticScale';
import { eclipticBandPath, reteDimensions, reteMetalPath, retePointers } from '../reteGeometry';
import { FocusRing, HighlightLayer, StackedCopies } from './moving';
import { numeralHalfExtents, tangentAt } from '../labelPlacement';
import { ASTROLABE_R } from './Plate';

interface ReteProps { reteRotation: number; visibility: Visibility; epochIso: string; }

const DIMENSIONS = reteDimensions(ASTROLABE_R);
const LABEL_INSET = DIMENSIONS.eclipticWidth * 0.72;
const ECLIPTIC_TICKS = eclipticTicks().map((tick) => ({
  ...tick,
  outer: eclipticPoint(tick.longitude, ASTROLABE_R - 1.5),
  inner: eclipticPoint(tick.longitude, ASTROLABE_R - 1.5 - tick.inset * 0.72),
}));
/** Font size of .astro-ecliptic-degree-label (styles.css). */
const ECLIPTIC_LABEL_FONT = 14;
/**
 * Each degree numeral sits beside its ten-degree tick, on the side the rule
 * leaves open (the rule's body lies clockwise of its edge), so laying the
 * edge on a tick never covers the number. The labels turn upright with the
 * rete, so they are cleared by their circumscribed radius.
 */
const ECLIPTIC_LABELS = eclipticLabels().map((longitude) => {
  const on = eclipticPoint(longitude, ASTROLABE_R - LABEL_INSET);
  const { halfWidth, halfHeight } = numeralHalfExtents(String(longitude), ECLIPTIC_LABEL_FONT);
  const t = tangentAt(on, 'ccw');
  const clear = Math.hypot(halfWidth, halfHeight) + 2;
  return { longitude, point: { x: on.x + t.x * clear, y: on.y + t.y * clear } };
});
const PLATE_STARS = STARS.filter((star) => star.onPlate);
const POINTERS = retePointers(PLATE_STARS, ASTROLABE_R);
const STAR_MARKS = PLATE_STARS.map((star, index) => ({
  star,
  id: star.name.toLowerCase().replace(/\s+/g, '-'),
  pointer: POINTERS[index],
}));
const METAL_WITH_POINTERS = reteMetalPath(ASTROLABE_R, POINTERS);
const METAL_BARE = reteMetalPath(ASTROLABE_R);
const ECLIPTIC_BAND = eclipticBandPath(ASTROLABE_R);
const ECLIPTIC = eclipticCircle(ASTROLABE_R);

export function matrixTransform(rotation: number): string {
  return `matrix(${reteOrientationMatrix(rotation).join(' ')} 0 0)`;
}

function uprightTransform(x: number, y: number, rotation: number): string {
  return `translate(${x} ${y}) ${matrixTransform(rotation)} scale(1,-1)`;
}

/**
 * Overlay `<defs>`: the single compound metal path and a fill gradient whose
 * transform cancels the rete's own, so the sheen stays lit from the top-left.
 */
export function ReteDefs({ reteRotation, stars }: { reteRotation: number; stars: boolean }): JSX.Element {
  return <>
    <path id="rete-metal" d={stars ? METAL_WITH_POINTERS : METAL_BARE} />
    <linearGradient id="rete-metal-fill" gradientUnits="userSpaceOnUse" x1="-540" y1="-540" x2="540" y2="540"
      gradientTransform={`${matrixTransform(reteRotation)} scale(1,-1)`}>
      <stop offset="0" stop-color="var(--astro-gilt-hi)" />
      <stop offset="0.4" stop-color="var(--astro-gilt-mid)" />
      <stop offset="1" stop-color="var(--astro-gilt-low)" />
    </linearGradient>
  </>;
}

/** Engraving that never changes with the rete angle: memoised so dragging does not re-diff 720 ticks. */
const EclipticEngraving = memo(function EclipticEngraving(): JSX.Element {
  return <>
    <path className="astro-ecliptic-band" data-occludes="false" data-hl-outline="true" d={ECLIPTIC_BAND} />
    <circle data-part="ecliptic-edge" className="astro-rete-ring" cx={ECLIPTIC.cx} cy={ECLIPTIC.cy} r={ECLIPTIC.r - 1.5} />
    <g data-part="ecliptic-scale">
      {ECLIPTIC_TICKS.map((tick) =>
        <line key={tick.longitude} data-part="ecliptic-scale" data-longitude={tick.longitude} data-ecliptic-longitude={tick.longitude}
          className={`astro-ecliptic-tick astro-ecliptic-tick-${tick.level}`} x1={tick.outer.x} y1={tick.outer.y} x2={tick.inner.x} y2={tick.inner.y} />,
      )}
    </g>
  </>;
});

/** Screen direction of a rete-frame vector (orientation, then the single y flip). */
function screenDirection(x: number, y: number, rotation: number): { x: number; y: number } {
  const oriented = orientRetePoint({ x, y }, rotation);
  return { x: oriented.x, y: -oriented.y };
}

export function Rete({ reteRotation, visibility, epochIso }: ReteProps): JSX.Element {
  const sun = eclipticPoint(solarLongitude(new Date(epochIso)), ASTROLABE_R);
  const drag = useRef<{ pointerId: number; pointerAngle: number; rotation: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const transform = matrixTransform(reteRotation);

  const endDrag = (event: JSX.TargetedPointerEvent<SVGGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <>
    <StackedCopies href="#rete-metal" transform={`scale(1,-1) ${transform}`} />
    <g transform="scale(1,-1)">
      <g
        data-part="rete"
        data-hl-frame-root="rete"
        className={`astro-rotary astro-rete${dragging ? ' is-dragging' : ''}`}
        transform={transform}
        tabindex={0}
        role="slider"
        aria-label="Rete rotation"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(reteRotation)}
        aria-valuetext={`${reteRotation.toFixed(1)} degrees`}
        onPointerDown={(event) => {
          const svg = event.currentTarget.ownerSVGElement;
          if (!svg) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, pointerAngle: angleFromPointer(svg, event.clientX, event.clientY), rotation: reteRotation };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          const svg = event.currentTarget.ownerSVGElement;
          if (!start || start.pointerId !== event.pointerId || !svg) return;
          setRete(start.rotation - rotationDelta(start.pointerAngle, angleFromPointer(svg, event.clientX, event.clientY)));
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
          event.preventDefault();
          setRete(keyRotate(reteRotation, event.key, event.shiftKey));
        }}
      >
        <HighlightLayer layer="under" frame="rete" />
        <FocusRing href="#rete-metal" />
        <use href="#rete-metal" className="astro-rete-metal" aria-label="Pierced rete: Capricorn ring, ecliptic ring, bars and star pointers" />
        {visibility.ecliptic && <g data-part="ecliptic-ring" aria-label="Ecliptic ring, graduated every half degree">
          <EclipticEngraving />
          {ECLIPTIC_LABELS.map(({ longitude, point }) => (
            <g key={longitude} transform={uprightTransform(point.x, point.y, reteRotation)}>
              <text className="astro-ecliptic-degree-label" text-anchor="middle" dominant-baseline="central">{longitude}</text>
            </g>
          ))}
        </g>}

        {visibility.stars && <g aria-label="Star pointers">
          {STAR_MARKS.map(({ star, id, pointer }) => {
            // The name is engraved along the blade; it is turned end for end when it would read upside down.
            const direction = screenDirection(pointer.along.x, pointer.along.y, reteRotation);
            let angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
            if (angle > 90 || angle <= -90) angle += 180;
            return <g key={star.bayer} data-part="star-pointer" data-star={id}>
              <path className="astro-star-pointer-outline" data-occludes="false" data-hl-outline="true" data-hl-refill="astro-rete-metal" d={pointer.path} />
              <circle className="astro-star-dot" data-hl-anchor="true" data-hl-gap={pointer.nameSide?.toFixed(1)} cx={pointer.tip.x} cy={pointer.tip.y} r={3.4} />
              {pointer.labelAt && <g transform={`${uprightTransform(pointer.labelAt.x, pointer.labelAt.y, reteRotation)} rotate(${angle.toFixed(2)})`}>
                <text className="astro-star-label" text-anchor="middle" dominant-baseline="central">{star.name}</text>
              </g>}
            </g>;
          })}
        </g>}

        {visibility.artificialAssists && <g aria-label="Artificial calculated assists">
          <circle className="astro-sun" cx={sun.x} cy={sun.y} r={9} aria-label="Calculated Sun position" />
          <circle className="astro-sun-core" cx={sun.x} cy={sun.y} r={3} />
        </g>}
        <HighlightLayer layer="over" frame="rete" />
      </g>
    </g>
  </>;
}
