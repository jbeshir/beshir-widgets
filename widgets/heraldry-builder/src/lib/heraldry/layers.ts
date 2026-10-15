// Builder transitions over places beyond the band and the picture ("layers"): the pictures on the band, a
// top band (chief) and a border (bordure), the pictures on those, pictures set in chief, in base or in
// canton beside the band or the picture, pictures set around the picture, pictures on the picture, a second main
// picture beside the picture, and a band or picture lying across everything (overall). Pure Design → Design, like every builder edit: a layer is added
// where it can be drawn and given the first tincture that works, the pictures are refitted to the room it
// leaves, and anything that can't be drawn is blocked with its reason, never silently dropped.

import { CHARGE_IDS, CHARGES, type ChargeId } from './charges';
import { PLAIN_LINES, canonical, tincturePaint, walkGroups, type Design, type Group, type GroupPath, type GroupTincture } from './design';
import { ORDINARY_KIND, ORDINARY_NAME, OVERALL_ORDINARIES, type OrdinaryType } from './ordinaries';
import type { SecondaryPosition } from './arrangement';
import {
  assembleParts, fitGroup, firstAllowed, groupTinctureChoices, layoutReason, partsOf, simpleParts, withTincture, type Choice,
} from './options';
import { PLACE_KEYS, pathOfPlace, type PlaceKey } from './places';
import { structuralIssues } from './structure';
import { unsupportedIssues } from './support';

/** The places the builder adds and removes on top of the band and the picture. */
export type LayerKey = Exclude<PlaceKey, 'ordinary' | 'picture'>;
export const LAYER_KEYS: readonly LayerKey[] = PLACE_KEYS.filter((k): k is LayerKey => k !== 'ordinary' && k !== 'picture');

/** The layers that are pictures set beside the band or the picture, in chief, in base or in canton. */
export type PositionedKey = Extract<LayerKey, 'in-chief' | 'in-base' | 'in-canton'>;
/** The layers that are a group of pictures, with a charge of their own. */
export type PicturesKey = Extract<LayerKey, 'co-primary' | 'around' | 'on-picture' | 'on-ordinary' | 'on-chief' | 'on-bordure'> | PositionedKey;
/** The layers that are a top band or a border, with a colour of their own. */
export type PeripheralKey = Extract<LayerKey, 'chief' | 'bordure'>;

/** The chief or bordure whose pictures a layer is. */
const hostOfPictures = (key: 'on-chief' | 'on-bordure'): PeripheralKey => (key === 'on-chief' ? 'chief' : 'bordure');
const positionOf = (key: PositionedKey): SecondaryPosition => (key === 'in-chief' ? 'chief' : key === 'in-base' ? 'base' : 'canton');
/** Where pictures set by position stand, in the builder's words. */
const POSITION_WORDS: Record<SecondaryPosition, string> = { chief: 'along the top', base: 'along the bottom', canton: 'in the top corner' };
const peripheralName = (key: PeripheralKey): string => (key === 'chief' ? 'top band' : 'border');

/** What lies overall: a band or shape across the middle, or a picture. */
export type LayerItem = { k: 'charge'; charge: ChargeId } | { k: 'ordinary'; type: OrdinaryType };

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

/**
 * The pictures refitted to the design they now sit in: those set by position first (the picture keeps clear of them), then in step
 * order (the pictures around the picture keep clear of it).
 */
export function refitLayers(d: Design): Design {
  return (['in-chief', 'in-base', 'in-canton', 'picture', 'co-primary', 'on-picture', 'around', 'on-ordinary', 'on-chief', 'on-bordure', 'overall'] as const).reduce((out, key) => {
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

/** A charge to start the layer overall with: one no other group of the field has (SENA A3D1a). */
function unusedCharge(d: Design): ChargeId {
  const used = new Set(walkGroups(d).flatMap(({ group }) => (group.item.k === 'charge' ? [group.item.charge] : [])));
  return (['mullet', 'heart', 'rose'] as const).find((id) => !used.has(id)) ?? 'mullet';
}

/** A band or picture to start the layer overall with: a picture over a band or shape, a band over a picture. */
function startingOverall(d: Design): Group | null {
  const parts = simpleParts(d);
  const ordinary = parts.ordinary?.group;
  if (ordinary?.item.k === 'ordinary' && ORDINARY_KIND[ordinary.item.type] === 'central') return newCharge(unusedCharge(d), 'overall');
  return parts.picture?.placement === 'field' ? ordinaryGroup('bend', 'or') : null;
}

function tryAddLayer(d: Design, key: LayerKey): Added {
  const parts = simpleParts(d);
  const ordinary = parts.ordinary?.group;
  switch (key) {
    case 'in-chief': case 'in-base': case 'in-canton': {
      const position = positionOf(key);
      const where = POSITION_WORDS[position];
      if (parts.positioned || parts.around) return { reason: 'Only one group of pictures can stand beside or around the main one — remove the others first.' };
      const central = ordinary?.item.k === 'ordinary' && ORDINARY_KIND[ordinary.item.type] === 'central' ? ordinary.item.type : null;
      const onField = parts.picture?.placement === 'field';
      if (central && onField) return { reason: `The picture is set around the ${ORDINARY_NAME[central]}: pictures can stand around the band or ${where}, not both — move the picture onto the band first.` };
      if (!central && !onField) return { reason: `Add a band or shape, or a picture on the background, first — pictures ${where} stand beside one.` };
      const placed = refitLayers(assembleParts(d, { ...partsOf(d), positioned: { ...newCharge(startingCharge(d), 'secondary'), position } }));
      const path = pathOfPlace(placed, key);
      if (!path) return { reason: `Pictures can't stand ${where} here.` };
      const reason = layoutReason(placed, path, true) ?? firstProblem(placed);
      return reason === null ? { design: withFirstTincture(placed, path)! } : { reason };
    }
    case 'co-primary': {
      if (parts.picture?.placement !== 'field') return { reason: 'Pick a picture on the background first — a second main picture stands beside it.' };
      if (parts.picture.group.role !== 'primary') return { reason: 'A second main picture goes beside a main picture, not beside a band — remove the band first.' };
      if (parts.around) return { reason: 'Pictures stand around the picture — remove them first, or it would be one of several main pictures.' };
      if (parts.onPicture) return { reason: 'Pictures stand on the picture — remove them first: two main pictures carry none.' };
      if (parts.overall) return { reason: 'Something lies across everything — remove it first: it would lie across two main pictures.' };
      const placed = refitLayers(assembleParts(d, { ...partsOf(d), coPrimary: newCharge(unusedCharge(d), 'primary') }));
      const path = pathOfPlace(placed, 'co-primary');
      if (!path) return { reason: "A second main picture can't go here." };
      const reason = layoutReason(placed, path, true) ?? firstProblem(placed);
      return reason === null ? { design: withFirstTincture(placed, path)! } : { reason };
    }
    case 'on-picture': {
      if (parts.coPrimary) return { reason: 'Two main pictures carry no pictures on them — remove the second one first.' };
      if (parts.around) return { reason: 'Pictures stand around the picture — remove them first, or they would read as set on it too.' };
      if (parts.picture?.placement !== 'field') return { reason: 'Pick a picture on the background first — more pictures can then go on it.' };
      if (parts.picture.group.role !== 'primary') return { reason: 'Pictures can go on the main picture, not on pictures set around a band — move it off the band first.' };
      const placed = refitLayers(assembleParts(d, { ...partsOf(d), onPicture: newCharge(startingCharge(d), 'tertiary') }));
      const path = pathOfPlace(placed, key);
      if (!path) return { reason: "Pictures can't go on the picture here." };
      const reason = layoutReason(placed, path, true) ?? firstProblem(placed);
      return reason === null ? { design: withFirstTincture(placed, path)! } : { reason };
    }
    case 'around': {
      if (parts.coPrimary) return { reason: 'Pictures are set around one main picture — remove the second one first.' };
      if (parts.onPicture) return { reason: 'Pictures stand on the picture — remove them first, or they would read as set around it too.' };
      if (parts.positioned) return { reason: 'Only one group of pictures can stand beside or around the main one — remove the others first.' };
      const central = ordinary?.item.k === 'ordinary' && ORDINARY_KIND[ordinary.item.type] === 'central' ? ordinary.item.type : null;
      if (central) return { reason: `Pictures are set around the ${ORDINARY_NAME[central]} — remove the band to set pictures around a picture instead.` };
      if (parts.picture?.placement !== 'field') return { reason: 'Pick a picture on the background first — more pictures can then be set around it.' };
      // Three, two and one: Table 7's one layout that needn't be stated.
      const placed = refitLayers(assembleParts(d, { ...partsOf(d), around: { ...newCharge(startingCharge(d), 'secondary'), count: 3 } }));
      const path = pathOfPlace(placed, key);
      if (!path) return { reason: "Pictures can't be set around the picture here." };
      const reason = layoutReason(placed, path, true) ?? firstProblem(placed);
      return reason === null ? { design: withFirstTincture(placed, path)! } : { reason };
    }
    case 'on-ordinary': {
      if (!ordinary) return { reason: 'Add a band or shape first — pictures can only sit on one once there is one.' };
      if (!parts.picture || parts.picture.placement !== 'field') return { reason: 'Pick a picture on the background first — more pictures can then go on the band.' };
      const placed = assembleParts(d, { ...partsOf(d), extra: newCharge(startingCharge(d), 'tertiary') });
      const path = pathOfPlace(placed, 'on-ordinary');
      if (!path) return { reason: 'This band can not carry pictures.' };
      const fitted = fitGroup(placed, path);
      const reason = layoutReason(fitted, path, true);
      return reason === null ? { design: withFirstTincture(fitted, path)! } : { reason };
    }
    case 'on-chief': case 'on-bordure': {
      const type = hostOfPictures(key);
      const host = parts.peripherals.find((p) => p.place === type);
      if (!host) {
        return { reason: ordinary?.item.k === 'ordinary' && ordinary.item.type === type
          ? `The ${peripheralName(type)} is your band or shape — add the pictures on it with the pictures on the band.`
          : `Add a ${peripheralName(type)} first — pictures can only sit on one once there is one.` };
      }
      const peripherals = parts.peripherals.map((p) => (p.place === type ? { ...p.group, charged: [newCharge(startingCharge(d), 'tertiary')] } : p.group));
      const placed = assembleParts(d, { ...partsOf(d), peripherals });
      const path = pathOfPlace(placed, key);
      if (!path) return { reason: `This ${peripheralName(type)} can not carry pictures.` };
      const fitted = fitGroup(placed, path);
      const reason = layoutReason(fitted, path, true);
      return reason === null ? { design: withFirstTincture(fitted, path)! } : { reason };
    }
    case 'overall': {
      const overall = startingOverall(d);
      if (!overall) return { reason: 'Add a band or shape, or a picture on the background, first — something can then lie across it.' };
      const placed = refitLayers(assembleParts(d, { ...partsOf(d), overall }));
      const path = pathOfPlace(placed, 'overall');
      if (!path) return { reason: "Nothing can lie across everything here." };
      const problem = firstProblem(placed);
      if (problem) return { reason: problem };
      const painted = withFirstTincture(placed, path);
      return painted ? { design: painted } : { reason: 'No colour works for something across everything here.' };
    }
    case 'chief': case 'bordure': {
      if (!ordinary) return { reason: 'Add a band or shape first — a top band or border goes beside one.' };
      const type: OrdinaryType = key;
      if (ordinary.item.k === 'ordinary' && ordinary.item.type === type) return { reason: `The ${peripheralName(key)} is already your band or shape.` };
      const placed = refitLayers(assembleParts(d, { ...partsOf(d), peripherals: [...parts.peripherals.map((p) => p.group), ordinaryGroup(type, 'or')] }));
      const problem = firstProblem(placed);
      if (problem) return { reason: problem };
      // The new group is the chief or border whichever place it ends up in: a chief added beside a border becomes the design's ordinary.
      const path = [placed.groups.findIndex((g) => g.item.k === 'ordinary' && g.item.type === type)];
      const painted = withFirstTincture(placed, path);
      return painted ? { design: painted } : { reason: `No colour works for a ${peripheralName(key)} here.` };
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
    case 'co-primary': return parts.coPrimary ? refitLayers(assembleParts(d, { ...partsOf(d), coPrimary: null })) : d;
    case 'on-ordinary': return parts.extra ? refitLayers(assembleParts(d, { ...partsOf(d), extra: null })) : d;
    case 'on-picture': return parts.onPicture ? refitLayers(assembleParts(d, { ...partsOf(d), onPicture: null })) : d;
    case 'on-chief': case 'on-bordure': {
      const type = hostOfPictures(key);
      return refitLayers(assembleParts(d, { ...partsOf(d), peripherals: parts.peripherals.map((p) => (p.place === type ? { ...p.group, charged: [] } : p.group)) }));
    }
    case 'chief': case 'bordure':
      return refitLayers(assembleParts(d, { ...partsOf(d), peripherals: parts.peripherals.filter((p) => p.place !== key).map((p) => p.group) }));
    case 'in-chief': case 'in-base': case 'in-canton':
      return parts.positioned?.place === key ? refitLayers(assembleParts(d, { ...partsOf(d), positioned: null })) : d;
    case 'around':
      return parts.around ? refitLayers(assembleParts(d, { ...partsOf(d), around: null })) : d;
    case 'overall':
      return parts.overall ? refitLayers(assembleParts(d, { ...partsOf(d), overall: null })) : d;
  }
}

/** The group overall as this band or picture: the colour, and for pictures the count and layout, kept where they still work. */
function overallAs(was: Group, item: LayerItem): Group {
  if (item.k === 'ordinary') return { ...ordinaryGroup(item.type, 'or'), paint: was.paint };
  return { ...was, item: chargeItem(item.charge, was), count: was.item.k === 'charge' ? was.count : 1, arrangement: was.item.k === 'charge' ? was.arrangement : { k: 'single' } };
}

/** The band or picture lying overall as this one; the groups are refitted to the room it leaves. */
export function setLayerItem(d: Design, key: 'overall', item: LayerItem): Design {
  const parts = simpleParts(d);
  return parts.overall ? refitLayers(assembleParts(d, { ...partsOf(d), overall: overallAs(parts.overall.group, item) })) : d;
}

/**
 * What can lie overall, each blocked with its reason when the result couldn't be drawn or breaks SENA App I4 (the overall
 * group or the one it lies over must be a band or a long charge). Pictures are judged by one of their kind.
 */
export function layerItemChoices(d: Design, key: 'overall'): Choice<LayerItem>[] {
  const parts = simpleParts(d);
  if (!parts.overall) return [];
  const was = parts.overall.group;
  // Only what is wrong with the group overall itself blocks a choice, not another problem the design has.
  const reason = (item: LayerItem): string | null => {
    const set = setLayerItem(d, key, item);
    const at = pathOfPlace(set, 'overall')!.join();
    const issue = [...unsupportedIssues(set), ...structuralIssues(set)].find((i) => i.at.k === 'group' && i.at.path.join() === at);
    return issue?.message ?? null;
  };
  const main = parts.picture?.group.item;
  const first = (long: boolean) => CHARGE_IDS.find((id) => CHARGES[id].long === long && !(main?.k === 'charge' && main.charge === id))!;
  const byLong = new Map<boolean, string | null>();
  const bands = OVERALL_ORDINARIES.map((type): Choice<LayerItem> => {
    const item: LayerItem = { k: 'ordinary', type };
    const why = reason(item);
    return why ? { value: item, allowed: false, reason: why } : { value: item, allowed: true };
  });
  const pictures = CHARGE_IDS.map((charge): Choice<LayerItem> => {
    const item: LayerItem = { k: 'charge', charge };
    const long = CHARGES[charge].long;
    if (!byLong.has(long)) byLong.set(long, reason({ k: 'charge', charge: first(long) }));
    const same = main?.k === 'charge' && main.charge === charge;
    const why = same ? `The ${CHARGES[charge].name} is already the main picture — choose a different one to lie across it.` : byLong.get(long) ?? null;
    return why && !(was.item.k === 'charge' && was.item.charge === charge) ? { value: item, allowed: false, reason: why } : { value: item, allowed: true };
  });
  return [...bands, ...pictures];
}

/** The pictures of a layer as this charge (their count, layout and tincture kept where they still work). */
export function setLayerCharge(d: Design, key: PicturesKey, id: ChargeId): Design {
  const parts = simpleParts(d);
  if (key === 'on-ordinary') {
    if (!parts.extra || !parts.picture) return d;
    const swapped: Group = { ...parts.extra.group, item: chargeItem(id, parts.extra.group) };
    return refitLayers(assembleParts(d, { ...partsOf(d), extra: swapped }));
  }
  if (key === 'co-primary') {
    if (!parts.coPrimary) return d;
    return refitLayers(assembleParts(d, { ...partsOf(d), coPrimary: { ...parts.coPrimary.group, item: chargeItem(id, parts.coPrimary.group) } }));
  }
  if (key === 'on-picture') {
    if (!parts.onPicture) return d;
    return refitLayers(assembleParts(d, { ...partsOf(d), onPicture: { ...parts.onPicture.group, item: chargeItem(id, parts.onPicture.group) } }));
  }
  if (key === 'around') {
    if (!parts.around) return d;
    return refitLayers(assembleParts(d, { ...partsOf(d), around: { ...parts.around.group, item: chargeItem(id, parts.around.group) } }));
  }
  if (key === 'in-chief' || key === 'in-base' || key === 'in-canton') {
    if (parts.positioned?.place !== key) return d;
    return refitLayers(assembleParts(d, { ...partsOf(d), positioned: { ...parts.positioned.group, item: chargeItem(id, parts.positioned.group) } }));
  }
  const type = hostOfPictures(key);
  const swap = (t: Group): Group => ({ ...t, item: chargeItem(id, t) });
  return refitLayers(assembleParts(d, { ...partsOf(d), peripherals: parts.peripherals.map((p) => (p.place === type ? { ...p.group, charged: p.group.charged.map(swap) } : p.group)) }));
}

/** The layer's tincture. */
export function setLayerTincture(d: Design, key: LayerKey, t: GroupTincture): Design {
  const path = pathOfPlace(d, key);
  return path ? canonical(withTincture(d, path, t)) : d;
}
