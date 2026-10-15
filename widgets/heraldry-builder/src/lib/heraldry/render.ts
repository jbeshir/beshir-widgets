// The paint-ordered layers a renderer draws for a design in a shape: the field, then every group in
// walk order (each group followed by the groups on it). DOM-free; Shield.tsx turns layers into SVG.

import type { Tincture } from './tinctures';
import { chargePath } from './charge-art';
import { notSupported, walkGroups, type Design, type Group, type GroupPath } from './design';
import { drawnBox, ordinaryFillRule, ordinaryPath, shapeFrame, type Slot } from './geometry';
import { groupSlots } from './layout';
import { chargeFills, fieldFill, ordinaryFill, type Fill, type SlotFill } from './paint-render';
import type { FieldShape } from './shape';

export type Layer =
  /** `outline` is the field's whole shape; a divided field's `fill` cuts it into parts. */
  | { k: 'field'; outline: string; fill: Fill }
  | { k: 'ordinary'; path: GroupPath; d: string; fillRule: 'nonzero' | 'evenodd'; fill: Fill }
  /** `slots` are the drawn boxes (the slots scaled by the charge's optical scale); each fill paints some of them. */
  | { k: 'charges'; path: GroupPath; art: string; slots: Slot[]; fills: SlotFill[] };

function ordinaryLayer(d: Design, path: GroupPath, group: Group, host: Group | null, shape: FieldShape): Layer {
  if (group.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  const { type } = group.item;
  return { k: 'ordinary', path, d: ordinaryPath(type, shape), fillRule: ordinaryFillRule(type), fill: ordinaryFill(d, group, host, type, shape) };
}

function chargeLayer(d: Design, path: GroupPath, group: Group, host: Group | null, shape: FieldShape): Layer {
  if (group.item.k !== 'charge') throw new RangeError('Not a charge.');
  const { charge, posture, mods } = group.item;
  const slots = groupSlots(d, path, shape).map((s) => drawnBox(s, charge));
  return { k: 'charges', path, art: chargePath(charge, posture, mods), slots, fills: chargeFills(d, group, host, slots, shape) };
}

/** The layers of a design in paint order. A counterchanged group that can't be (plain field, or on a host) has no fill: only its outline shows. */
export function renderLayers(d: Design, shape: FieldShape): Layer[] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const layers: Layer[] = [{ k: 'field', outline: shapeFrame(shape).outline, fill: fieldFill(d.field, shape) }];
  for (const { path, group, host } of walkGroups(d)) {
    layers.push(group.item.k === 'ordinary' ? ordinaryLayer(d, path, group, host, shape) : chargeLayer(d, path, group, host, shape));
  }
  return layers;
}

/** The tinctures a design uses, in order of first use: what hatching patterns are needed for. Counterchanged adds none. */
export function designTinctures(d: Design): Tincture[] {
  const seen = new Set<Tincture>();
  const take = (p: Group['paint']) => {
    if (p.k === 'tincture') seen.add(p.t);
    else if (p.k === 'divided') p.parts.forEach(take);
  };
  if (d.kind === 'arms') take(d.field);
  walkGroups(d).forEach(({ group }) => take(group.paint));
  return [...seen];
}
