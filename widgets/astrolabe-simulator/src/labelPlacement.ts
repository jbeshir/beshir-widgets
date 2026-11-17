/**
 * Numerals that a reading edge is laid on are engraved beside their tick,
 * on the side of the radial line that the rule or alidade leaves open, so a
 * numeral is never bisected or covered by the metal at its own setting.
 *
 * `side` is the screen sense around the pivot (y down): 'cw' or 'ccw'.
 * The counterchanged alidade (back) carries its body on the counter-clockwise
 * side of its edge, so its open side is 'cw'; the front rule is the mirror
 * image (body clockwise), so its open side is 'ccw'.
 */
export type Side = 'cw' | 'ccw';

export interface Point2 { x: number; y: number }

/** Unit tangent at `p` pointing round the pivot in the given screen sense (y down). */
export function tangentAt(p: Point2, side: Side): Point2 {
  const length = Math.hypot(p.x, p.y) || 1;
  const sign = side === 'cw' ? 1 : -1;
  return { x: (-p.y / length) * sign, y: (p.x / length) * sign };
}

/** Upright (screen-aligned) text box centred so its near side is `gap` clear of the radial line through `p`. */
export function besideRadial(p: Point2, side: Side, halfWidth: number, halfHeight: number, gap: number): Point2 {
  const t = tangentAt(p, side);
  const distance = Math.abs(t.x) * halfWidth + Math.abs(t.y) * halfHeight + gap;
  return { x: p.x + t.x * distance, y: p.y + t.y * distance };
}

/** Rough half extents of a bold numeral string at a font size (digits ≈ 0.6 em wide, cap height ≈ 0.72 em). */
export function numeralHalfExtents(text: string, fontSize: number): { halfWidth: number; halfHeight: number } {
  return { halfWidth: (text.length * 0.6 * fontSize) / 2, halfHeight: 0.36 * fontSize };
}

/** Signed distance of `q` from the radial line through `p`; positive on the `side` half. */
export function sideOfRadial(p: Point2, q: Point2, side: Side): number {
  const t = tangentAt(p, side);
  return q.x * t.x + q.y * t.y;
}
