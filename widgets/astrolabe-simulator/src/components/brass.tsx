import type { JSX } from 'preact';

/**
 * Shared brass art for both faces. Colours come from the fixed
 * `--astro-brass-*` tokens in theme.css: the instrument is a physical object
 * and looks the same in light and dark page themes.
 *
 * Filters defined here are used only by the static base layer of each face
 * (mater, limb, plate, back engraving), never by the rotating overlay.
 */

/** Physical radius of the mater body (outer edge of the limb). */
export const MATER_R = 604;
/** Shared viewBox: the throne, shackle and ring extend above the disc; the margins hold the whole brass-drop shadow (dx 5, dy 12, blur 10) so it is never cut. */
export const INSTRUMENT_VIEWBOX = '-645 -760 1290 1430';

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Deterministic filed-brass grain: short horizontal streaks, light and dark. */
const GRAIN_TILE = 56;
const GRAIN_STREAKS = (() => {
  const random = seeded(23);
  return Array.from({ length: 90 }, () => ({
    x: random() * GRAIN_TILE,
    y: random() * GRAIN_TILE,
    w: 1.5 + random() * 6,
    light: random() < 0.45,
    opacity: 0.05 + random() * 0.11,
  }));
})();

function Stops({ stops }: { stops: readonly [number, string][] }): JSX.Element {
  return <>{stops.map(([offset, color]) => <stop key={offset} offset={offset} stop-color={color} />)}</>;
}

/** Gradients, grain and the pre-composed filters of a static base layer. */
export function StaticBrassDefs(): JSX.Element {
  return (
    <defs>
      <linearGradient id="brass-face" x1="0" y1="0" x2="1" y2="1">
        <Stops stops={[[0, 'var(--astro-brass-hi)'], [0.32, 'var(--astro-brass-light)'], [0.68, 'var(--astro-brass-mid)'], [1, 'var(--astro-brass-low)']]} />
      </linearGradient>
      <radialGradient id="limb-roll" gradientUnits="userSpaceOnUse" cx="0" cy="0" r={MATER_R}>
        <Stops stops={[[0.885, 'var(--astro-brass-shadow)'], [0.9, 'var(--astro-brass-light)'], [0.94, 'var(--astro-brass-mid)'], [0.985, 'var(--astro-brass-light)'], [0.995, 'var(--astro-brass-hi)'], [1, 'var(--astro-brass-shadow)']]} />
      </radialGradient>
      <linearGradient id="raking-light" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff6d8" stop-opacity="0.42" />
        <stop offset="0.45" stop-color="#fff6d8" stop-opacity="0" />
        <stop offset="0.6" stop-color="#2a1a05" stop-opacity="0" />
        <stop offset="1" stop-color="#2a1a05" stop-opacity="0.32" />
      </linearGradient>
      <linearGradient id="edge-lit" x1="0" y1="0" x2="1" y2="1">
        <Stops stops={[[0, 'var(--astro-brass-hi)'], [0.5, 'var(--astro-brass-mid)'], [1, 'var(--astro-brass-deep)']]} />
      </linearGradient>
      <linearGradient id="edge-shaded" x1="0" y1="0" x2="1" y2="1">
        <Stops stops={[[0, 'var(--astro-brass-deep)'], [0.5, 'var(--astro-brass-shadow)'], [1, 'var(--astro-brass-hi)']]} />
      </linearGradient>
      <radialGradient id="plate-face" cx="0.42" cy="0.38" r="0.72">
        <Stops stops={[[0, 'var(--astro-brass-plate-light)'], [0.65, 'var(--astro-brass-plate)'], [1, 'var(--astro-brass-plate-dark)']]} />
      </radialGradient>
      <linearGradient id="brass-wire" x1="0" y1="0" x2="0" y2="1">
        <Stops stops={[[0, 'var(--astro-brass-shadow)'], [0.3, 'var(--astro-brass-hi)'], [0.55, 'var(--astro-brass-mid)'], [1, 'var(--astro-brass-deep)']]} />
      </linearGradient>
      <pattern id="brass-grain" patternUnits="userSpaceOnUse" width={GRAIN_TILE} height={GRAIN_TILE}>
        {GRAIN_STREAKS.map((streak, index) => (
          <rect key={index} x={streak.x} y={streak.y} width={streak.w} height="0.9"
            fill={streak.light ? '#fff4cc' : '#1e150b'} opacity={streak.opacity} />
        ))}
      </pattern>
      <filter id="brass-drop" x="-8%" y="-8%" width="118%" height="120%" color-interpolation-filters="sRGB">
        <feDropShadow dx="5" dy="12" stdDeviation="10" flood-color="#140c03" flood-opacity="0.5" />
      </filter>
      <filter id="well-shade" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  );
}

/** Throne (kursi): a low European form, symmetric about x = 0, pierced three times. */
const THRONE_OUTLINE = 'M 172 -578 C 152 -606, 100 -610, 90 -634 C 82 -654, 52 -654, 38 -662 C 28 -668, 26 -688, 0 -690 '
  + 'C -26 -688, -28 -668, -38 -662 C -52 -654, -82 -654, -90 -634 C -100 -610, -152 -606, -172 -578 Z';
const THRONE_BORDER = 'M 130 -596 C 106 -603, 86 -611, 79 -628 C 72 -643, 48 -645, 32 -652 '
  + 'M -130 -596 C -106 -603, -86 -611, -79 -628 C -72 -643, -48 -645, -32 -652';
const THRONE_HOLES = [
  { cx: 0, cy: -636, r: 14 },
  { cx: -64, cy: -616, r: 7 },
  { cx: 64, cy: -616, r: 7 },
];
const LUG = { cx: 0, cy: -672, r: 6 };
const THRONE_HALO = `${THRONE_OUTLINE.replace(/ Z$/, '')} ${circleContour(0, -726, 20)}`;

function circleContour(cx: number, cy: number, r: number): string {
  return `M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} Z`;
}

/**
 * Mater body, throne, shackle and ring, carrying the page drop shadow. The
 * well and limb are drawn on top by each face.
 */
export function MaterBody({ children }: { children?: JSX.Element | JSX.Element[] }): JSX.Element {
  const throneD = `${THRONE_OUTLINE} ${THRONE_HOLES.map((hole) => circleContour(hole.cx, hole.cy, hole.r)).join(' ')} ${circleContour(LUG.cx, LUG.cy, LUG.r)}`;
  return (
    <g filter="url(#brass-drop)">
      <g data-part="throne" aria-label="Throne with shackle and suspension ring">
        <circle className="astro-ring" cx="0" cy="-726" r="20" />
        <circle className="astro-ring-glint" cx="0" cy="-726" r="20" />
        <path className="astro-shackle" d="M -8 -674 C -12 -690, -10 -704, 0 -706 C 10 -704, 12 -690, 8 -674" />
        <path className="astro-throne" d={throneD} fill-rule="evenodd" />
        <path className="astro-throne-sheen" data-occludes="false" d={throneD} fill-rule="evenodd" />
        <path className="astro-throne-border" d={THRONE_BORDER} />
        <circle className="astro-rivet" cx={LUG.cx} cy={LUG.cy} r="10" />
        {/* Highlight outline: the free upper contour and the ring only, so its halo never runs across the limb. */}
        <path className="astro-throne-outline" data-occludes="false" data-hl-outline="true" d={THRONE_HALO} />
      </g>
      <circle className="astro-mater" data-part="mater" r={MATER_R} />
      {children}
    </g>
  );
}

/** Raised rim edge glints: bright towards the light (top-left), dark away from it. */
export function RimEdges({ outer, inner }: { outer: number; inner?: number }): JSX.Element {
  return (
    <g aria-hidden="true" className="astro-rim-edges" data-occludes="false">
      <circle r={outer - 1.5} fill="none" stroke="url(#edge-lit)" stroke-width="3" />
      {inner !== undefined && <circle r={inner + 1.5} fill="none" stroke="url(#edge-shaded)" stroke-width="3.5" />}
    </g>
  );
}
