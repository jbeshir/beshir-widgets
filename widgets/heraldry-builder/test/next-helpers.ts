// Builders shared by the tests of the design model: loose design input, and the resolved design it makes.

import { resolve, type Design } from '../src/lib/heraldry/next';

/** The resolved design of loose input; throws with the reasons if it doesn't resolve. */
export function nd(input: unknown): Design {
  const r = resolve(input);
  if (!r.ok) throw new Error(`resolve failed: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.design;
}

export const plain = (tincture: string) => ({ k: 'tincture', t: tincture });

/** A divided paint of two tinctures given as shorthand names. */
export const div = (division: string, ...parts: string[]) => ({ k: 'divided', division, parts });

export const ordinary = (type: string, extra: object = {}) => ({ k: 'ordinary', type, ...extra });

export const charge = (id: string, extra: object = {}) => ({ k: 'charge', charge: id, ...extra });

/** A group of loose input: the item and paint, plus whichever other keys the test cares about. */
export function group(item: object, paint: unknown, extra: object = {}) {
  return { item, paint, ...extra };
}

/** Loose arms input: the field and the groups. */
export function arms(field: unknown, ...groups: object[]) {
  return { v: 2, field, groups };
}
