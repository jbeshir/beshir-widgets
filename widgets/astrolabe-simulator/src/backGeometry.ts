export interface BackPoint {
  x: number;
  y: number;
}

/** Historical back scale: 0° Aries at left, longitude increasing toward the top. */
export function backLongitudePoint(radius: number, longitude: number): BackPoint {
  const radians = longitude * Math.PI / 180;
  return { x: -radius * Math.cos(radians), y: -radius * Math.sin(radians) };
}

/** Physical alidade rotation whose centre line crosses a back-scale longitude. */
export function alidadeRotationForLongitude(longitude: number): number {
  const rotation = (180 - longitude) % 180;
  return rotation < 0 ? rotation + 180 : rotation;
}

/** Direction of the rendered alidade centre line after its SVG transform. */
export function alidadeLineDirection(rotation: number): BackPoint {
  const radians = rotation * Math.PI / 180;
  return { x: Math.cos(radians), y: -Math.sin(radians) };
}

/** Signed perpendicular distance numerator; zero means the point lies on the line. */
export function alidadeLineCross(point: BackPoint, rotation: number): number {
  const direction = alidadeLineDirection(rotation);
  return point.x * direction.y - point.y * direction.x;
}
