// The builder's furs: which furs and fur colours a part of the field or a group may take, with the reason for every
// blocked choice, and the design each choice leads to. A fur is a paint like a tincture is, so a choice is blocked by what
// the paint would break where it lies: for the field the rule on its parts (A3B3a), for a group the rule of tincture.

import { COLOURS, METALS, TINCTURES, TINCTURE_CLASS, FUR_SPEC, isFur, type Fur, type FurSpec, type Tincture } from './tinctures';
import type { Design } from './design';
import { FUR_KINDS, canonicalFur, furColours, furKindOf, takesColours, type FurKind, type FurPaint } from './fur';
import { paintAt, painted, reasonAt, type PaintTarget } from './paint-target';
import type { Choice } from './options';

const choice = <T>(value: T, reason: string | null): Choice<T> => (reason ? { value, allowed: false, reason } : { value, allowed: true });

/** The fur at the target, or null when it is painted otherwise. */
export function furAt(d: Design, target: PaintTarget): FurPaint | null {
  const paint = paintAt(d, target);
  return paint.k === 'fur' ? paint : null;
}

type Family = FurSpec['family'];

/** The colours a family is first offered in when it is asked for in colours of its own. */
const OWN_COLOURS: Record<Family, [Tincture, Tincture]> = { ermine: ['argent', 'gules'], vair: ['or', 'gules'], potent: ['or', 'gules'] };

/** The fur of a family that names its colours. */
const PLAIN_FUR: Record<Family, Fur> = { ermine: 'ermine', vair: 'vair', potent: 'potent' };

const furWith = (fur: Fur, colours: [Tincture, Tincture] | null): FurPaint => canonicalFur({ k: 'fur', fur, colours });

/** Every metal-and-colour pair (either way round), the family's usual one first. */
function ownColourPairs(family: Family): Array<[Tincture, Tincture]> {
  const pairs = METALS.flatMap((m) => COLOURS.flatMap((c): Array<[Tincture, Tincture]> => [[m, c], [c, m]]));
  return [OWN_COLOURS[family], ...pairs];
}

/** The paint a kind stands for at the target: a named fur, or the family in the first colours of its own that work there. */
function paintOfKind(d: Design, target: PaintTarget, kind: FurKind): { paint: FurPaint; reason: string | null } {
  if (isFur(kind)) {
    const paint = furWith(kind, null);
    return { paint, reason: reasonAt(painted(d, target, paint), target) };
  }
  const family: Family = kind === 'ermined' ? 'ermine' : kind === 'vairy' ? 'vair' : 'potent';
  const now = furAt(d, target);
  // Already in colours of its own: they stay.
  if (now && furKindOf(now) === kind) return { paint: now, reason: reasonAt(d, target) };
  let first: { paint: FurPaint; reason: string | null } | null = null;
  for (const colours of ownColourPairs(family)) {
    const paint = furWith(PLAIN_FUR[family], colours);
    // Colours that spell a named fur (argent and sable are ermine) are not colours of its own.
    if (furKindOf(paint) !== kind) continue;
    const trial = { paint, reason: reasonAt(painted(d, target, paint), target) };
    if (!trial.reason) return trial;
    first ??= trial;
  }
  return first!;
}

/** The furs offered at the target, blocked where the fur would break the rule on the field or on what the group lies on. */
export function furChoices(d: Design, target: PaintTarget): Choice<FurKind>[] {
  return FUR_KINDS.map((kind) => choice(kind, paintOfKind(d, target, kind).reason));
}

/** The target painted as this kind of fur (the colours of its own kinds are the first that work). */
export function setFur(d: Design, target: PaintTarget, kind: FurKind): Design {
  return painted(d, target, paintOfKind(d, target, kind).paint);
}

const OTHER = { 0: 1, 1: 0 } as const;

/** The colours with `slot` set to `t`, the other moved only when it would no longer be a metal with a colour (or no longer work), or null when none works. */
function coloursWith(d: Design, target: PaintTarget, fur: FurPaint, slot: 0 | 1, t: Tincture): { colours: [Tincture, Tincture]; reason: string | null } {
  const current = furColours(fur)[OTHER[slot]];
  const opposite = TINCTURES.filter((x) => TINCTURE_CLASS[x] !== TINCTURE_CLASS[t]);
  let first: { colours: [Tincture, Tincture]; reason: string | null } | null = null;
  for (const other of [current, ...opposite]) {
    if (TINCTURE_CLASS[other] === TINCTURE_CLASS[t]) continue;
    const colours: [Tincture, Tincture] = slot === 0 ? [t, other] : [other, t];
    const trial = { colours, reason: reasonAt(painted(d, target, furWith(PLAIN_FUR[FUR_SPEC[fur.fur].family], colours)), target) };
    if (!trial.reason) return trial;
    first ??= trial;
  }
  return first!;
}

/** The tinctures for one of a fur's two colours (the ground or first, the spots or second), blocked where no partner colour would let the fur work. Empty unless the target is a fur that takes colours. */
export function furColourChoices(d: Design, target: PaintTarget, slot: 0 | 1): Choice<Tincture>[] {
  const fur = furAt(d, target);
  if (!fur || !takesColours(fur.fur)) return [];
  return TINCTURES.map((t) => choice(t, coloursWith(d, target, fur, slot, t).reason));
}

/** The fur with `slot` set to `t`; the other colour changes too only when it would no longer work. */
export function setFurColour(d: Design, target: PaintTarget, slot: 0 | 1, t: Tincture): Design {
  const fur = furAt(d, target);
  if (!fur || !takesColours(fur.fur)) return d;
  const family = FUR_SPEC[fur.fur].family;
  return painted(d, target, furWith(PLAIN_FUR[family], coloursWith(d, target, fur, slot, t).colours));
}
