// The paint-ordered layers a renderer draws for a design in a shape: the field, then every group in
// walk order (each group followed by the groups on it). DOM-free; Shield.tsx turns layers into SVG.

import type { Tincture } from './tinctures';
import { chargePath } from './charge-art';
import { notSupported, walkGroups, type Design, type Group, type GroupPath } from './design';
import {
  counterchangedOrdinaryParts, counterchangedSlotParts, drawnBox, fieldRegions, ordinaryFillRule, ordinaryPath, type Slot,
} from './geometry';
import { groupSlots } from './layout';
import type { FieldShape } from './shape';

/** Part of a layer painted in one tincture; `clip` is the partition region it is cut to (null: all of it). */
interface OrdinaryFill { tincture: Tincture; clip: string | null }
interface ChargeFill { tincture: Tincture; clip: string | null; slots: number[] }

export type Layer =
  | { k: 'field'; regions: Array<{ d: string; tincture: Tincture }> }
  | { k: 'ordinary'; path: GroupPath; d: string; fillRule: 'nonzero' | 'evenodd'; fills: OrdinaryFill[] }
  /** `slots` are the drawn boxes (the slots scaled by the charge's optical scale). */
  | { k: 'charges'; path: GroupPath; art: string; slots: Slot[]; fills: ChargeFill[] };

/** The tinctures a group is painted in, given what it lies on: `fills` of the parts, none when it can't be counterchanged there. */
function ordinaryLayer(d: Design, path: GroupPath, group: Group, host: Group | null, shape: FieldShape): Layer {
  if (group.item.k !== 'ordinary') throw new RangeError('Not an ordinary.');
  const { type } = group.item;
  const fills = ((): OrdinaryFill[] => {
    switch (group.paint.k) {
      case 'tincture': return [{ tincture: group.paint.t, clip: null }];
      case 'counterchanged':
        return d.kind === 'arms' && !host ? counterchangedOrdinaryParts(d.field, type, shape).map((p) => ({ tincture: p.tincture, clip: p.d })) : [];
      default: return notSupported({ category: 'tincture', detail: group.paint.k });
    }
  })();
  return { k: 'ordinary', path, d: ordinaryPath(type, shape), fillRule: ordinaryFillRule(type), fills };
}

function chargeLayer(d: Design, path: GroupPath, group: Group, host: Group | null, shape: FieldShape): Layer {
  if (group.item.k !== 'charge') throw new RangeError('Not a charge.');
  const { charge, posture, mods } = group.item;
  const slots = groupSlots(d, path, shape).map((s) => drawnBox(s, charge));
  const all = slots.map((_, i) => i);
  const fills = ((): ChargeFill[] => {
    switch (group.paint.k) {
      case 'tincture': return [{ tincture: group.paint.t, clip: null, slots: all }];
      case 'counterchanged': {
        if (d.kind !== 'arms' || host) return [];
        const parts = slots.map((s) => counterchangedSlotParts(d.field, s, shape));
        return ([0, 1] as const).flatMap((region) => {
          const on = all.filter((i) => parts[i].some((p) => p.region === region));
          const part = on.length ? parts[on[0]].find((p) => p.region === region) : undefined;
          return part ? [{ tincture: part.tincture, clip: part.d, slots: on }] : [];
        });
      }
      default: return notSupported({ category: 'tincture', detail: group.paint.k });
    }
  })();
  return { k: 'charges', path, art: chargePath(charge, posture, mods), slots, fills };
}

/** The layers of a design in paint order. A counterchanged group that can't be (plain field, or on a host) has no fills: only its outline shows. */
export function renderLayers(d: Design, shape: FieldShape): Layer[] {
  if (d.kind !== 'arms') return notSupported({ category: 'fieldless', detail: 'badge' });
  const layers: Layer[] = [{ k: 'field', regions: fieldRegions(d.field, shape) }];
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
