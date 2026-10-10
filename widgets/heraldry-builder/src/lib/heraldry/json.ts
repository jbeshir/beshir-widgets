/** A parsed JSON value as a plain object (not null, not an array), or null. */
export function asObject(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
