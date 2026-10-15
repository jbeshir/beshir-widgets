// Turns paint into the fills a renderer draws: a flat colour, a repeating pattern, or parts of a shape each with
// a fill of their own (a divided field, a counterchanged group). DOM-free; Shield.tsx draws the fills.

import { TINCTURE_CODE, type Tincture } from './tinctures';
import { asParty, asVariation, notSupported, type Design, type Group, type Paint, type PartyPaint, type VariationPaint } from './design';
import { counterchangedOrdinaryParts, counterchangedSlotParts, drawnBox, fieldRegions, ordinaryBox, ordinaryCentre, partitionRegions, type CounterchangePart, type FieldPaint, type Slot } from './geometry';
import type { OrdinaryType } from './ordinaries';
import { furPattern, type SolidColour, type PatternSpec } from './patterns';
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

/** The fill of a paint that is one thing over its place: a tincture, or a fur drawn at `scale`. */
const paintFill = (p: FieldPaint, scale: number): Fill => (p.k === 'tincture' ? solidFill(p.t) : { k: 'pattern', spec: furPattern(p, scale) });

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

/** The colours a fill is made of, in order of first use. */
export function fillColours(fill: Fill): SolidColour[] {
  switch (fill.k) {
    case 'solid': return [fill.colour];
    case 'pattern': return [fill.spec.ground, ...fill.spec.marks.map((m) => m.colour)];
    case 'split': return fill.parts.flatMap((p) => fillColours(p.fill));
    default: return fill satisfies never;
  }
}

/** The tinctures a fill is made of, in order of first use. */
export const fillTinctures = (fill: Fill): Tincture[] => [...new Set(fillColours(fill).map((c) => c.t))];

/** A compact code naming a fill, for tests and tools to compare what is drawn without resolving `url(…)` references. */
export function fillCode(fill: Fill): string {
  switch (fill.k) {
    case 'solid': return TINCTURE_CODE[fill.colour.t];
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
    case 'tincture': case 'fur': return paintFill(group.paint, ORDINARY_FUR_SCALE);
    case 'counterchanged':
      return d.kind === 'arms' && !host ? counterchangedFill(counterchangedOrdinaryParts(d.field, type, shape), ORDINARY_FUR_SCALE) : NO_FILL;
    case 'divided': return partyFill(partyOf(group.paint), ordinaryCentre(type, shape), 0);
    case 'variation': return variationFill(variationOf(group.paint), ordinaryBox(type, shape), 0);
    default: return notSupported({ category: 'tincture', detail: group.paint.k });
  }
}

/**
 * A charge group's fills over the drawn boxes of its slots: one for all of them, or for a counterchanged group one per
 * part of the field it lies on. None when it can't be counterchanged (a plain field, or a host).
 */
export function chargeFills(d: Design, group: Group, host: Group | null, slots: readonly Slot[], shape: FieldShape): SlotFill[] {
  const all = slots.map((_, i) => i);
  switch (group.paint.k) {
    case 'tincture': case 'fur': return [{ fill: paintFill(group.paint, slots.length ? chargeFurScale(slots[0].size) : ORDINARY_FUR_SCALE), slots: all }];
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
    default: return notSupported({ category: 'tincture', detail: group.paint.k });
  }
}
