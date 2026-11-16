// The builder's furs: which furs and fur colours a part of the field or a group may take, with the reason for every
// blocked choice, and the design each choice leads to. A fur is a paint like a tincture is, so a choice is blocked by what
// the paint would break where it lies: for the field the rule on its parts (A3B3a), for a group the rule of tincture.

import { COLOURS, METALS, TINCTURES, FUR_SPEC, isFur, type Fur, type Tincture } from './tinctures';
import type { Design } from './design';
import { FAMILY_FUR, FUR_KINDS, canonicalFur, familyOfKind, furColours, furKindOf, takesColours, type FurFamily, type FurKind, type FurPaint } from './fur';
import { ofOtherClass, paintAt, painted, reasonAt, withPartner, type PaintTarget, type Trial } from './paint-target';
import { choice, type Choice } from './options';

/** The fur at the target, or null when it is painted otherwise. */
export function furAt(d: Design, target: PaintTarget): FurPaint | null {
  const paint = paintAt(d, target);
  return paint.k === 'fur' ? paint : null;
}

/** The colours a family is first offered in when it is asked for in colours of its own. */
const OWN_COLOURS: Record<FurFamily, [Tincture, Tincture]> = { ermine: ['argent', 'gules'], vair: ['or', 'gules'], potent: ['or', 'gules'] };

const furWith = (fur: Fur, colours: [Tincture, Tincture] | null): FurPaint => canonicalFur({ k: 'fur', fur, colours });

/** Every metal-and-colour pair (either way round), the family's usual one first. */
function ownColourPairs(family: FurFamily): Array<[Tincture, Tincture]> {
  const pairs = METALS.flatMap((m) => COLOURS.flatMap((c): Array<[Tincture, Tincture]> => [[m, c], [c, m]]));
  return [OWN_COLOURS[family], ...pairs];
}

const tried = (d: Design, target: PaintTarget, paint: FurPaint): Trial<FurPaint> => ({ paint, reason: reasonAt(painted(d, target, paint), target) });

/** The paint a kind stands for at the target: a named fur, or the family in the first colours of its own that work there. */
function paintOfKind(d: Design, target: PaintTarget, kind: FurKind): Trial<FurPaint> {
  if (isFur(kind)) return tried(d, target, furWith(kind, null));
  const now = furAt(d, target);
  // Already in colours of its own: they stay.
  if (now && furKindOf(now) === kind) return { paint: now, reason: reasonAt(d, target) };
  const family = familyOfKind(kind);
  let first: Trial<FurPaint> | null = null;
  for (const colours of ownColourPairs(family)) {
    const paint = furWith(FAMILY_FUR[family], colours);
    // Colours that spell a named fur (argent and sable are ermine) are not colours of its own.
    if (furKindOf(paint) !== kind) continue;
    const trial = tried(d, target, paint);
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

/** The fur with `slot` set to `t`, the other colour moved only when it would no longer be a metal with a colour (or no longer work). */
function coloursWith(d: Design, target: PaintTarget, fur: FurPaint, slot: 0 | 1, t: Tincture): Trial<FurPaint> {
  const family = FAMILY_FUR[FUR_SPEC[fur.fur].family];
  const partners = ofOtherClass(t, [furColours(fur)[slot === 0 ? 1 : 0], ...TINCTURES]);
  return withPartner(partners, (other) => furWith(family, slot === 0 ? [t, other] : [other, t]), (paint) => reasonAt(painted(d, target, paint), target));
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
  return painted(d, target, coloursWith(d, target, fur, slot, t).paint);
}
