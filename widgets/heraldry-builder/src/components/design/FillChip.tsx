// A small square of a pattern (a fur, a treatment) for a picker's swatch.


import { colourHex, type PatternSpec } from '../../lib/heraldry';


export function FillChip({ spec, id }: { spec: PatternSpec; id: string }) {
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={spec.width} height={spec.height} patternTransform={spec.transform ?? undefined}>
          <rect width={spec.width} height={spec.height} fill={colourHex(spec.ground)} />
          {spec.marks.map((m, i) => <path key={i} d={m.d} fill={colourHex(m.colour)} transform={m.transform ?? undefined} />)}
        </pattern>
      </defs>
      <rect width="28" height="28" fill={`url(#${id})`} stroke="#222222" stroke-width="1" />
    </svg>
  );
}
