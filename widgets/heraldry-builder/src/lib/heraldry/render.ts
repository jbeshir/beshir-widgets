// The paint-ordered layers a renderer draws for a design in a shape: the field, then every group in
// walk order (each group followed by the groups on it). DOM-free; Shield.tsx turns layers into SVG.

import type { Tincture } from './tinctures';
import { chargePath } from './charge-art';
import { paintTinctures, walkGroups, type Design, type Group, type GroupPath } from './design';
import { badgeTransform, CANONICAL_SHAPE, drawnBox, shapeFrame, UPRIGHT, type ArtPose, type Slot } from './geometry';
import { defaultOrdinaryFrame, fieldOrdinaryGeometry, ordinaryFrameOf, ordinaryGeometry, specOf, type OrdinaryTrim } from './ordinary-geometry';
import { groupSlots } from './layout';
import { chargeFills, fieldFill, ordinaryFill, trimFill, type Fill, type SlotFill } from './paint-render';
import type { FieldShape } from './shape';

/** What an ordinary layer paints, in paint order: its fimbriation under its body, the body, then its cotises. */
type OrdinaryPartRole = 'fimbriation' | 'body' | 'cotises';
export interface OrdinaryPart { readonly role: OrdinaryPartRole; readonly d: string; readonly fillRule: 'nonzero' | 'evenodd'; readonly fill: Fill }

export type Layer =
  /** `outline` is the field's whole shape; a divided field's `fill` cuts it into parts. */
  | { k: 'field'; outline: string; fill: Fill }
  /** The body is always one of the parts. */
  | { k: 'ordinary'; path: GroupPath; parts: readonly OrdinaryPart[] }
  /** `slots` are the drawn boxes (the slots scaled by the charge's optical scale), with the art posed in each; each fill paints some of them. */
  | { k: 'charges'; path: GroupPath; art: string; slots: Slot[]; poses: ArtPose[]; fills: SlotFill[] };

const trimPart = (role: OrdinaryPartRole, trim: OrdinaryTrim, fill: Fill): OrdinaryPart => ({ role, d: trim.d, fillRule: trim.fillRule, fill });

function ordinaryLayer(d: Design, path: GroupPath, group: Group, host: Group | null, shape: FieldShape): Layer {
  if (group.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  // a peripheral is drawn in the whole shape; the other ordinaries in what the peripherals rising from the base leave
  const spec = specOf(group), frame = group.role === 'peripheral' || host ? defaultOrdinaryFrame(shape) : ordinaryFrameOf(d, shape);
  const geometry = d.kind === 'arms' && !host ? fieldOrdinaryGeometry(d.field, spec, group.paint, frame) : ordinaryGeometry(spec, frame);
  const { fimbriation, cotises } = geometry;
  const { fimbriated, cotised } = group.item;
  const body: OrdinaryPart = { role: 'body', d: geometry.body, fillRule: geometry.fillRule, fill: ordinaryFill(d, group, host, spec, frame) };
  return {
    k: 'ordinary', path,
    parts: [
      ...(fimbriation && fimbriated ? [trimPart('fimbriation', fimbriation, trimFill(d, fimbriated, host, fimbriation, shape))] : []),
      body,
      ...(cotises && cotised ? [trimPart('cotises', cotises, trimFill(d, cotised.paint, host, cotises, shape))] : []),
    ],
  };
}

function chargeLayer(d: Design, path: GroupPath, group: Group, host: Group | null, shape: FieldShape): Layer {
  if (group.item.k !== 'charge') throw new RangeError('Not a charge.');
  const { charge, posture, mods } = group.item;
  const slots = groupSlots(d, path, shape).map((s) => drawnBox(s, charge));
  return { k: 'charges', path, art: chargePath(charge, posture, mods), slots, poses: slots.map(() => UPRIGHT), fills: chargeFills(d, group, host, slots, shape) };
}

/**
 * The layers of a design in paint order. A counterchanged group that can't be (plain field, or on a host) has no fill: only its outline shows.
 * A fieldless badge has no field layer: its charges are laid out as on a heater shield (`shape` is not used) and drawn under `badgeView`.
 */
export function renderLayers(d: Design, shape: FieldShape): Layer[] {
  const layers: Layer[] = d.kind === 'arms' ? [{ k: 'field', outline: shapeFrame(shape).outline, fill: fieldFill(d.field, shape) }] : [];
  const at = d.kind === 'arms' ? shape : CANONICAL_SHAPE;
  for (const { path, group, host } of walkGroups(d)) {
    layers.push(group.item.k === 'ordinary' ? ordinaryLayer(d, path, group, host, at) : chargeLayer(d, path, group, host, at));
  }
  return layers;
}

/** The SVG transform that scales a fieldless badge's drawing to fill the picture (an empty one is drawn as it lies); null for arms, which sit in their shield. */
export function badgeView(d: Design, layers: readonly Layer[]): string | null {
  if (d.kind === 'arms') return null;
  return badgeTransform(layers.flatMap((l) => (l.k === 'charges' ? l.slots : [])));
}

/** The tinctures a design uses, in order of first use: what hatching patterns are needed for. Counterchanged adds none. */
export function designTinctures(d: Design): Tincture[] {
  const seen = new Set<Tincture>();
  const take = (p: Group['paint']) => paintTinctures(p).forEach((t) => seen.add(t));
  if (d.kind === 'arms') take(d.field);
  walkGroups(d).forEach(({ group }) => {
    take(group.paint);
    if (group.item.k === 'ordinary') [group.item.fimbriated, group.item.cotised?.paint].forEach((p) => p && take(p));
  });
  return [...seen];
}
