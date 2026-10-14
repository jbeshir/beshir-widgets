// Builder transitions over places beyond the band and the picture ("layers"): the pictures on the band, a
// top band (chief) and a border (bordure). Pure Design → Design, like every builder edit: a layer is added
// where it can be drawn and given the first tincture that works, the pictures are refitted to the room it
// leaves, and anything that can't be drawn is blocked with its reason, never silently dropped.

import { CHARGES, type ChargeId } from './charges';
import { PLAIN_LINES, canonical, tincturePaint, type Design, type Group, type GroupPath, type GroupTincture } from './design';
import { ORDINARY_KIND, type OrdinaryType } from './ordinaries';
import {
  assembleParts, fitGroup, firstAllowed, groupTinctureChoices, layoutReason, partsOf, simpleParts, withTincture, type Choice,
} from './options';
import { PLACE_KEYS, pathOfPlace, type PlaceKey } from './places';
import { structuralIssues } from './structure';
import { unsupportedIssues } from './support';

/** The places the builder adds and removes on top of the band and the picture. */
export type LayerKey = Exclude<PlaceKey, 'ordinary' | 'picture'>;
export const LAYER_KEYS: readonly LayerKey[] = PLACE_KEYS.filter((k): k is LayerKey => k !== 'ordinary' && k !== 'picture');

/** The path of the group in a layer, or null when the design has none. */
export const layerPath = (d: Design, key: LayerKey): GroupPath | null => pathOfPlace(d, key);

/** The layers a design has a card for, in step order. Pictures set only on the band are the picture step's own, so they are not a layer. */
export function layersIn(d: Design): LayerKey[] {
  return LAYER_KEYS.filter((key) => (key === 'on-ordinary' ? simpleParts(d).extra !== null : layerPath(d, key) !== null));
}


/** A new band, or peripheral, in a tincture. */
export function ordinaryGroup(type: OrdinaryType, t: GroupTincture): Group {
  return {
    role: ORDINARY_KIND[type] === 'central' ? 'primary' : 'peripheral', relation: null,
    item: { k: 'ordinary', type, lines: { ...PLAIN_LINES }, mods: [], cotised: null, fimbriated: null },
    count: 1, arrangement: { k: 'single' }, position: null,
    paint: t === 'counterchanged' ? { k: 'counterchanged' } : tincturePaint(t), charged: [],
  };
}

/** The charge of a group, keeping the posture and modifiers of the one it replaces where the new charge has them. */
export function chargeItem(id: ChargeId, previous: Group | null): Group['item'] {
  const meta = CHARGES[id];
  const was = previous?.item.k === 'charge' ? previous.item : null;
  const posture = meta.postures ? (was?.posture && meta.postures.includes(was.posture) ? was.posture : meta.defaultPosture) : null;
  return {
    k: 'charge', charge: id, form: null, posture, facing: meta.defaultFacing, orientation: null,
    mods: was ? was.mods.filter((m) => meta.mods.includes(m.id)) : [], parts: [], holds: [],
  };
}

/** A single charge in gold, as a new picture starts. */
export function newCharge(id: ChargeId, role: Group['role']): Group {
  return {
    role, relation: null, item: chargeItem(id, null), count: 1, arrangement: { k: 'single' }, position: null, paint: tincturePaint('or'), charged: [],
  };
}

/** The first problem of a design the builder can't draw as it is, or null. */
function firstProblem(d: Design): string | null {
  return unsupportedIssues(d)[0]?.message ?? structuralIssues(d)[0]?.message ?? null;
}

/** The pictures refitted to the design they now sit in, in step order. */
export function refitLayers(d: Design): Design {
  return (['picture', 'on-ordinary'] as const).reduce((out, key) => {
    const path = pathOfPlace(out, key);
    return path ? fitGroup(out, path) : out;
  }, d);
}

/** The design painted with the first tincture that works for the group at `path`, or null when none does. */
function withFirstTincture(d: Design, path: GroupPath): Design | null {
  const t = firstAllowed(groupTinctureChoices(d, path), null);
  return t ? canonical(withTincture(d, path, t)) : null;
}

type Added = { design: Design } | { reason: string };

/** Any charge to start a layer of pictures with: not the picture's own, so the two can be told apart. */
function startingCharge(d: Design): ChargeId {
  const picture = simpleParts(d).picture?.group.item;
  return picture?.k === 'charge' && picture.charge === 'mullet' ? 'heart' : 'mullet';
}

function tryAddLayer(d: Design, key: LayerKey): Added {
  const parts = simpleParts(d);
  const ordinary = parts.ordinary?.group;
  switch (key) {
    case 'on-ordinary': {
      if (!ordinary) return { reason: 'Add a band or shape first — pictures can only sit on one once there is one.' };
      if (ordinary.item.k === 'ordinary' && ORDINARY_KIND[ordinary.item.type] === 'peripheral' && ordinary.item.type !== 'chief') {
        return { reason: "Pictures can't sit on a border in this builder; put them on the background within it." };
      }
      if (!parts.picture || parts.picture.placement !== 'field') return { reason: 'Pick a picture on the background first — more pictures can then go on the band.' };
      const placed = assembleParts(d, { ...partsOf(d), extra: newCharge(startingCharge(d), 'tertiary') });
      const path = pathOfPlace(placed, 'on-ordinary');
      if (!path) return { reason: 'This band can not carry pictures.' };
      const fitted = fitGroup(placed, path);
      const reason = layoutReason(fitted, path, true);
      return reason === null ? { design: withFirstTincture(fitted, path)! } : { reason };
    }
    case 'chief': case 'bordure': {
      if (!ordinary) return { reason: 'Add a band or shape first — a top band or border goes beside one.' };
      const type: OrdinaryType = key;
      if (ordinary.item.k === 'ordinary' && ordinary.item.type === type) return { reason: `The ${type === 'chief' ? 'top band' : 'border'} is already your band or shape.` };
      const placed = refitLayers(assembleParts(d, { ...partsOf(d), peripherals: [...parts.peripherals.map((p) => p.group), ordinaryGroup(type, 'or')] }));
      const problem = firstProblem(placed);
      if (problem) return { reason: problem };
      // The new group is the chief or border whichever place it ends up in: a chief added beside a border becomes the design's ordinary.
      const path = [placed.groups.findIndex((g) => g.item.k === 'ordinary' && g.item.type === type)];
      const painted = withFirstTincture(placed, path);
      return painted ? { design: painted } : { reason: `No colour works for a ${type === 'chief' ? 'top band' : 'border'} here.` };
    }
  }
}

/** The layers not in the design yet: allowed when one can be drawn, else blocked with the reason. */
export function layerChoices(d: Design): Choice<LayerKey>[] {
  return LAYER_KEYS.filter((key) => pathOfPlace(d, key) === null).map((value): Choice<LayerKey> => {
    const added = tryAddLayer(d, value);
    return 'reason' in added ? { value, allowed: false, reason: added.reason } : { value, allowed: true };
  });
}

/** The design with the layer added in the first tincture that works, or `d` when it can't be drawn (see `layerChoices`). */
export function addLayer(d: Design, key: LayerKey): Design {
  if (pathOfPlace(d, key) !== null) return d;
  const added = tryAddLayer(d, key);
  return 'design' in added ? added.design : d;
}

/** The design without the layer; the pictures are refitted to the room it leaves. */
export function removeLayer(d: Design, key: LayerKey): Design {
  const parts = simpleParts(d);
  switch (key) {
    case 'on-ordinary': return parts.extra ? refitLayers(assembleParts(d, { ...partsOf(d), extra: null })) : d;
    case 'chief': case 'bordure':
      return refitLayers(assembleParts(d, { ...partsOf(d), peripherals: parts.peripherals.filter((p) => p.place !== key).map((p) => p.group) }));
  }
}

/** The pictures on the band as this charge (their count, layout and tincture kept where they still work): the one layer with a charge of its own. */
export function setLayerCharge(d: Design, id: ChargeId): Design {
  const parts = simpleParts(d);
  if (!parts.extra || !parts.picture) return d;
  const swapped: Group = { ...parts.extra.group, item: chargeItem(id, parts.extra.group) };
  return refitLayers(assembleParts(d, { ...partsOf(d), extra: swapped }));
}

/** The layer's tincture. */
export function setLayerTincture(d: Design, key: LayerKey, t: GroupTincture): Design {
  const path = pathOfPlace(d, key);
  return path ? canonical(withTincture(d, path, t)) : d;
}
