// Turns paint into the fills a renderer draws: a flat colour, a repeating pattern, or parts of a shape each with
// a fill of their own (a divided field, a counterchanged group). DOM-free; Shield.tsx draws the fills.

import { TINCTURE_CODE, type Tincture } from './tinctures';
import { CHARGES } from './charges';
import { asParty, asSemy, asTreated, asVariation, notSupported, type Design, type Group, type Paint, type PartyPaint, type VariationPaint } from './design';
import { counterchangedOrdinaryParts, counterchangedSlotParts, drawnBox, fieldRegions, ordinaryBox, ordinaryCentre, partitionRegions, type CounterchangePart, type FieldPaint, type Slot } from './geometry';
import type { OrdinaryType } from './ordinaries';
import { furPattern, semyPattern, treatmentPattern, type SolidColour, type PatternSpec } from './patterns';
import type { FieldShape } from './shape';
import { variationRegions, type Box } from './variation-geometry';

export type Fill =
  | { k: 'solid'; colour: SolidColour }
  | { k: 'pattern'; spec: PatternSpec }
  /** Each part's fill shows within its clip path (an SVG path); an empty split paints nothing. */
  | { k: 'split'; parts: ReadonlyArray<{ clip: string; fill: Fill }> };

/** A fill for some of a charge group's slots (indices into the layer's slots): the whole group, or those lying on one part of the field. */
export interface SlotFill { fill: Fill; slots: number[] }

export const solidFill = (t: Tincture): Fill => ({ k: 'solid', colour: { k: 'tincture', t } });

/** The fill that paints nothing: only the outline of the element shows. */
const NO_FILL: Fill = { k: 'split', parts: [] };

/** How big a fur is drawn (see `furPattern`): the field's motifs are the largest, a band's smaller, and a charge's follow its size within limits. */
const FIELD_FUR_SCALE = 0.5;
const ORDINARY_FUR_SCALE = 0.35;

/** A charge's fur scale in its own 100-unit drawing space, where it is 0.5 shield units per unit at most and 0.15 at least. */
const chargeFurScale = (size: number): number => Math.min(0.5, Math.max(0.15, 0.008 * size)) * (100 / size);

/** The fill of a paint that is one thing over its place: a tincture, or a fur, treatment or semy drawn at `scale`. */
function paintFill(p: FieldPaint, scale: number): Fill {
  if (p.k === 'tincture') return solidFill(p.t);
  if (p.k === 'fur') return { k: 'pattern', spec: furPattern(p, scale) };
  if (p.k === 'semy') return { k: 'pattern', spec: semyPattern(asSemy(p) ?? notSupported({ category: 'field-treatment', detail: 'semy' }), scale) };
  return { k: 'pattern', spec: treatmentPattern(asTreated(p) ?? notSupported({ category: 'field-treatment', detail: `${p.treatment}-${p.ground.k}`}), scale) };
}

const counterchangedFill = (parts: readonly CounterchangePart[], scale: number): Fill =>
  ({ k: 'split', parts: parts.map((p) => ({ clip: p.d, fill: paintFill(p.paint, scale) })) });

/** A party paint split through `centre`, its lines turned `turn` degrees: each part's tincture within its side of the division. */
const partyFill = (p: PartyPaint, centre: { x: number; y: number }, turn: number): Fill =>
  ({ k: 'split', parts: partitionRegions(p.division, centre, turn).map((clip, i) => ({ clip, fill: solidFill(p.parts[i].t) })) });

/** A variation of two tinctures laid out over `box`, turned `turn` degrees: each tincture within its region. */
const variationFill = (v: VariationPaint, box: Box, turn: number): Fill =>
  ({ k: 'split', parts: variationRegions(v.variation, v.pieces, box, turn).map((clip, i) => ({ clip, fill: solidFill(v.parts[i].t) })) });

/** The variation of a group, which only a variation of two tinctures is. */
const variationOf = (p: Paint): VariationPaint => asVariation(p) ?? notSupported({ category: 'field-treatment', detail: p.k });

/** The party paint of a group, which only a divided paint of two tinctures is. */
const partyOf = (p: Paint): PartyPaint => asParty(p) ?? notSupported({ category: 'tincture', detail: p.k });

/**
 * A charge in its natural colours: its palette's one fill, or its two split per fess through the middle of each charge (the flame's
 * gules and Or), turned with the charge. `slots` are the drawn boxes.
 */
function properFills(group: Group, slots: readonly Slot[]): SlotFill[] {
  const palette = group.item.k === 'charge' ? CHARGES[group.item.charge].proper : null;
  if (!palette) return notSupported({ category: 'proper', detail: group.item.k === 'charge' ? group.item.charge : group.item.type });
  const [whole, lower] = palette.fills;
  const solid = (hex: string): Fill => ({ k: 'solid', colour: { k: 'proper', hex } });
  if (lower === undefined) return [{ fill: solid(whole), slots: slots.map((_, i) => i) }];
  return slots.map((s, i) => ({
    fill: { k: 'split', parts: partitionRegions('per-fess', s, s.rotation).map((clip, k) => ({ clip, fill: solid(k === 0 ? whole : lower) })) },
    slots: [i],
  }));
}

/** A fill that paints one thing: a flat colour or a pattern (a split is cut into these). */
export type LeafFill = Extract<Fill, { k: 'solid' | 'pattern' }>;

/** The leaves of a fill, in order. */
const fillLeaves = (fill: Fill): LeafFill[] => (fill.k === 'split' ? fill.parts.flatMap((p) => fillLeaves(p.fill)) : [fill]);

/**
 * The tincture a leaf is hatched with when the shield is drawn without colour: a flat tincture's own, and a pattern's ground (its
 * spots, bells, lines or strewn charges stay solid); none for a natural colour.
 */
export function hatchTincture(leaf: LeafFill): Tincture | null {
  const colour = leaf.k === 'solid' ? leaf.colour : leaf.spec.ground;
  return colour.k === 'tincture' ? colour.t : null;
}

/** The tinctures hatching draws for a fill, in order of first use. */
export const fillHatchTinctures = (fill: Fill): Tincture[] => [...new Set(fillLeaves(fill).flatMap((l) => hatchTincture(l) ?? []))];

/** A compact code naming a fill, for tests and tools to compare what is drawn without resolving `url(…)` references. */
export function fillCode(fill: Fill): string {
  switch (fill.k) {
    case 'solid': return fill.colour.k === 'tincture' ? TINCTURE_CODE[fill.colour.t] : `proper:${fill.colour.hex}`;
    case 'pattern': return `pattern:${fill.spec.id}`;
    case 'split': return `split(${fill.parts.map((p) => fillCode(p.fill)).join(',')})`;
    default: return fill satisfies never;
  }
}

/** The field's fill in a shape: its tincture, or each part of a divided field in its partition region. */
export function fieldFill(field: Paint, shape: FieldShape): Fill {
  const regions = fieldRegions(field, shape);
  return regions.length === 1 ? paintFill(regions[0].paint, FIELD_FUR_SCALE) : { k: 'split', parts: regions.map((r) => ({ clip: r.d, fill: paintFill(r.paint, FIELD_FUR_SCALE) })) };
}

/** An ordinary's fill: nothing for a counterchanged one that can't be (on a plain field, or on a host). */
export function ordinaryFill(d: Design, group: Group, host: Group | null, type: OrdinaryType, shape: FieldShape): Fill {
  switch (group.paint.k) {
    case 'tincture': case 'fur': case 'treated': case 'semy': return paintFill(group.paint, ORDINARY_FUR_SCALE);
    case 'counterchanged':
      return d.kind === 'arms' && !host ? counterchangedFill(counterchangedOrdinaryParts(d.field, type, shape), ORDINARY_FUR_SCALE) : NO_FILL;
    case 'divided': return partyFill(partyOf(group.paint), ordinaryCentre(type, shape), 0);
    case 'variation': return variationFill(variationOf(group.paint), ordinaryBox(type, shape), 0);
    case 'stain': return notSupported({ category: 'tincture', detail: group.paint.stain });
    case 'proper': return notSupported({ category: 'proper', detail: type });
    default: return group.paint satisfies never;
  }
}

/**
 * A charge group's fills over the drawn boxes of its slots: one for all of them, or for a counterchanged group one per
 * part of the field it lies on. None when it can't be counterchanged (a plain field, or a host).
 */
export function chargeFills(d: Design, group: Group, host: Group | null, slots: readonly Slot[], shape: FieldShape): SlotFill[] {
  const all = slots.map((_, i) => i);
  switch (group.paint.k) {
    case 'tincture': case 'fur': case 'treated': return [{ fill: paintFill(group.paint, slots.length ? chargeFurScale(slots[0].size) : ORDINARY_FUR_SCALE), slots: all }];
    case 'proper': return properFills(group, slots);
    case 'counterchanged': {
      if (d.kind !== 'arms' || host) return [];
      const parts = slots.map((s) => counterchangedSlotParts(d.field, s, shape));
      return ([0, 1] as const).flatMap((region) => {
        const on = all.filter((i) => parts[i].some((p) => p.region === region));
        const part = on.length ? parts[on[0]].find((p) => p.region === region) : undefined;
        return part ? [{ fill: counterchangedFill([part], chargeFurScale(slots[on[0]].size)), slots: on }] : [];
      });
    }
    case 'divided': {
      const party = partyOf(group.paint);
      return slots.map((s, i) => ({ fill: partyFill(party, s, s.rotation), slots: [i] }));
    }
    case 'variation': {
      const varied = variationOf(group.paint);
      const charge = group.item.k === 'charge' ? group.item.charge : null;
      return slots.map((s, i) => {
        const { x, y, size } = charge ? drawnBox(s, charge) : s;
        return { fill: variationFill(varied, { x0: x - size / 2, y0: y - size / 2, x1: x + size / 2, y1: y + size / 2 }, s.rotation), slots: [i] };
      });
    }
    case 'stain': return notSupported({ category: 'tincture', detail: group.paint.stain });
    // A semy on a picture is too small to draw (support.ts files it as a count gap).
    case 'semy': return notSupported({ category: 'count', detail: 'semy' });
    default: return group.paint satisfies never;
  }
}
