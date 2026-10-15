// The clicks that build a design in the builder: `builderPath` takes a goal design and finds the choices,
// each one offered and allowed by the options helper and applied by the real builder functions, that lead
// from the builder's starting design to exactly the normalised goal. Used by the SCA armorial test (every
// matched record must be buildable) and by the reachability tests, so it lives here, free of rendering.
//
// The checks return their problems as strings rather than throwing, so the caller can report them per record.

import {
  CHARGE_IDS, DIVISIONS, DRAWN_ORDINARIES, TINCTURES, addLayer, canonicalJson, fieldTinctureChoices, groupAt, groupTinctureChoices, groupTinctureOf, layerChoices, layerItemChoices,
  modifierChoices, pathOfPlace, postureChoices, setLayerItem, setLayerTincture, simpleParts,
  type ChargeId, type Choice, type Design, type Division, type Group, type GroupPath, type GroupTincture, type LayerItem, type LayerKey, type OrdinaryType, type PeripheralKey, type PicturesKey, type Posture, type Tincture,
} from '../src/lib/heraldry';
import {
  DEFAULT_DESIGN, ordinaryPath, picturePath, setCharge, setDivision, setFieldTincture, setGroupTincture, setModifier, setOrdinary, setOrdinaryTincture,
  setPlainField, setPosture,
} from '../src/lib/builder';
import { layoutMoves, type LayoutAction } from './helpers';

/** The places the picture controls belong to: the picture, the pictures on it, the pictures around it, the pictures in chief, base or canton, the pictures on the band, the top band and the border, and what lies overall. */
type At = 'picture' | PicturesKey | 'overall';
/** The pictures laid out after the picture, in the order they are added. */
const EXTRA_PICTURES: readonly PicturesKey[] = ['on-picture', 'around', 'in-chief', 'in-base', 'in-canton', 'on-ordinary', 'on-chief', 'on-bordure'];

/** One click in the builder's Design tab. */
export type BuilderAction =
  | { kind: 'plain-field' }
  | { kind: 'division'; division: Division }
  | { kind: 'field-tincture'; part: 0 | 1; tincture: Tincture }
  | { kind: 'ordinary'; type: OrdinaryType | null }
  | { kind: 'ordinary-tincture'; tincture: GroupTincture }
  | { kind: 'add-layer'; place: LayerKey }
  | { kind: 'layer-tincture'; place: PeripheralKey; tincture: GroupTincture }
  | { kind: 'overall-item'; item: LayerItem }
  | { kind: 'charge'; at: At; charge: ChargeId | null }
  | { kind: 'layout'; at: At; action: LayoutAction; design: Design }
  | { kind: 'posture'; at: At; posture: Posture }
  | { kind: 'splendour'; at: At; on: boolean }
  | { kind: 'charge-tincture'; at: At; tincture: GroupTincture };

const tinctureOf = (g: Group): GroupTincture | null => groupTinctureOf(g.paint);
const pathAt = (d: Design, at: At): GroupPath | null => (at === 'picture' ? picturePath(d) : at === 'on-ordinary' ? simpleParts(d).extra?.path ?? null : pathOfPlace(d, at));
const peripheralAt = (d: Design, place: PeripheralKey): GroupPath | null => simpleParts(d).peripherals.find((p) => p.place === place)?.path ?? null;

/** Why a choice list doesn't offer and allow `v`, or null when it does. */
function choiceReason<T>(choices: Choice<T>[], v: T): string | null {
  const c = choices.find((x) => x.value === v);
  if (!c) return `${String(v)} is not offered`;
  return c.allowed ? null : `${String(v)} is blocked: ${c.reason}`;
}

/**
 * Why the Design tab wouldn't let you make this click on `d`, or null when it would. The field
 * division, ordinary and picture pickers list every value and never block one (BuilderSteps); the
 * rest are offered by the options helper, which may block. Layout moves come from the options
 * helper's own allowed choices, so they are always on offer.
 */
function actionReason(d: Design, a: BuilderAction): string | null {
  switch (a.kind) {
    case 'plain-field': return null;
    case 'division': return DIVISIONS.includes(a.division) ? null : `${a.division} is not offered`;
    case 'field-tincture':
      if (a.part === 1 && !(d.kind === 'arms' && d.field.k === 'divided')) return 'a plain field has no second tincture';
      return choiceReason(fieldTinctureChoices(d, a.part), a.tincture);
    case 'ordinary': return a.type === null || DRAWN_ORDINARIES.includes(a.type) ? null : `${a.type} is not offered`;
    case 'ordinary-tincture': {
      const path = ordinaryPath(d);
      return path ? choiceReason(groupTinctureChoices(d, path), a.tincture) : 'there is no ordinary to colour';
    }
    case 'add-layer': return choiceReason(layerChoices(d), a.place);
    case 'layer-tincture': {
      const path = peripheralAt(d, a.place);
      return path ? choiceReason(groupTinctureChoices(d, path), a.tincture) : `there is no ${a.place} to colour`;
    }
    case 'overall-item': {
      const choice = layerItemChoices(d, 'overall').find((c) => JSON.stringify(c.value) === JSON.stringify(a.item));
      if (!choice) return pathOfPlace(d, 'overall') ? `${JSON.stringify(a.item)} is not offered` : 'there is nothing overall to change';
      return choice.allowed ? null : `${JSON.stringify(a.item)} is blocked: ${choice.reason}`;
    }
    case 'charge':
      if (a.at !== 'picture' && a.at !== 'overall' && a.charge !== null && !pathAt(d, a.at)) {
        const reason = choiceReason(layerChoices(d), a.at);
        if (reason) return `pictures ${a.at} are not offered: ${reason}`;
      }
      return a.charge === null || CHARGE_IDS.includes(a.charge) ? null : `${a.charge} is not offered`;
    case 'layout': return null;
    case 'posture': {
      const path = pathAt(d, a.at);
      return path ? choiceReason(postureChoices(d, path), a.posture) : `there is no ${a.at} to pose`;
    }
    case 'splendour': {
      const path = pathAt(d, a.at);
      return path ? choiceReason(modifierChoices(d, path), 'in-splendour') : `there is no ${a.at} to show a face on`;
    }
    case 'charge-tincture': {
      const path = pathAt(d, a.at);
      return path ? choiceReason(groupTinctureChoices(d, path), a.tincture) : `there is no ${a.at} to colour`;
    }
  }
}

/** The design the builder makes of a click, by the same function the Design tab calls. */
function applyAction(d: Design, a: BuilderAction): Design {
  const path = 'at' in a ? pathAt(d, a.at) : null;
  switch (a.kind) {
    case 'plain-field': return setPlainField(d);
    case 'division': return setDivision(d, a.division);
    case 'field-tincture': return setFieldTincture(d, a.part, a.tincture);
    case 'ordinary': return setOrdinary(d, a.type);
    case 'ordinary-tincture': return setOrdinaryTincture(d, a.tincture);
    case 'add-layer': return addLayer(d, a.place);
    case 'layer-tincture': return setLayerTincture(d, a.place, a.tincture);
    case 'overall-item': return setLayerItem(d, 'overall', a.item);
    case 'charge': return setCharge(d, a.at as 'picture' | PicturesKey, a.charge);
    case 'layout': return a.design;
    case 'posture': return setPosture(d, path!, a.posture);
    case 'splendour': return setModifier(d, path!, 'in-splendour', a.on);
    case 'charge-tincture': return setGroupTincture(d, path!, a.tincture);
  }
}

function describeAction(a: BuilderAction): string {
  switch (a.kind) {
    case 'plain-field': return 'plain field';
    case 'division': return `division ${a.division}`;
    case 'field-tincture': return `field part ${a.part + 1} ${a.tincture}`;
    case 'ordinary': return `ordinary ${a.type ?? 'none'}`;
    case 'ordinary-tincture': return `ordinary tincture ${a.tincture}`;
    case 'add-layer': return `add ${a.place}`;
    case 'layer-tincture': return `${a.place} tincture ${a.tincture}`;
    case 'overall-item': return `overall ${a.item.k === 'ordinary' ? a.item.type : a.item.charge}`;
    case 'charge': return `${a.at} charge ${a.charge ?? 'none'}`;
    case 'layout': return `${a.at} ${a.action.kind} ${a.action.kind === 'count' ? a.action.count : a.action.kind === 'placement' ? a.action.placement : a.action.layout}`;
    case 'posture': return `${a.at} posture ${a.posture}`;
    case 'splendour': return `${a.at} splendour ${a.on ? 'on' : 'off'}`;
    case 'charge-tincture': return `${a.at} tincture ${a.tincture}`;
  }
}

/** The field tincture clicks from the current divided field to `[a, b]`, never asking for two equal parts. */
function dividedTinctureSteps([x, y]: [Tincture, Tincture], [a, b]: [Tincture, Tincture]): BuilderAction[] {
  const set = (part: 0 | 1, tincture: Tincture): BuilderAction => ({ kind: 'field-tincture', part, tincture });
  if (x === a && y === b) return [];
  if (a !== y) return [...(x === a ? [] : [set(0, a)]), ...(y === b ? [] : [set(1, b)])];
  // The first part's new tincture is the second part's current one: move the second part first,
  // through a third tincture when the parts simply swap.
  if (b !== x) return [set(1, b), set(0, a)];
  const z = TINCTURES.find((t) => t !== x && t !== y)!;
  return [set(0, z), set(1, b), set(0, a)];
}

/** The count, placement and layout of a picture, as the layout controls see it. */
function layoutState(d: Design, at: At): string {
  const path = pathAt(d, at);
  if (!path) return '';
  const g = groupAt(d, path);
  const placement = simpleParts(d).picture?.placement ?? '';
  return `${g.count}/${at === 'picture' ? placement : ''}/${JSON.stringify([g.arrangement, g.position])}`;
}

/**
 * The shortest route through the count, placement and layout controls from `start` to the goal's
 * layout (breadth-first, as the reachability test searches), or null when there is none.
 */
function layoutRoute(start: Design, goal: Design, at: At): BuilderAction[] | null {
  const target = layoutState(goal, at);
  if (layoutState(start, at) === target) return [];
  const routes = new Map<string, BuilderAction[]>([[layoutState(start, at), []]]);
  const queue = [start];
  for (let s = queue.shift(); s; s = queue.shift()) {
    const route = routes.get(layoutState(s, at))!;
    const path = pathAt(s, at);
    if (!path) continue;
    for (const m of layoutMoves(s, path)) {
      const k = layoutState(m.design, at);
      if (routes.has(k)) continue;
      const next = [...route, { kind: 'layout', at, action: m.action, design: m.design } as const];
      routes.set(k, next);
      if (k === target) return next;
      queue.push(m.design);
    }
  }
  return null;
}

export interface BuilderPath {
  /** The clicks made, in order (up to the first one the builder wouldn't allow). */
  actions: BuilderAction[];
  /** Empty when every click was offered and allowed and the builder ended on the normalised target. */
  problems: string[];
  /** The design the clicks built. */
  design: Design;
}

/**
 * Build `goal` in the builder from its starting design, the way a person would: the field (kind,
 * then tinctures), then the ordinary and its tincture, then the top band and border beside it, then
 * the picture — its charge, placement and layout, pose, face and tincture — then the extra pictures on
 * the band. Each click must be offered and allowed on the design at that moment; the builder's own
 * functions apply it. Stops at the first click it can't make.
 */
export function builderPath(goal: Design): BuilderPath {
  const actions: BuilderAction[] = [];
  const problems: string[] = [];
  let d = DEFAULT_DESIGN;
  /** Make the clicks in order; false (with the problem recorded) at the first one not allowed. */
  const click = (...as: BuilderAction[]): boolean => as.every((a) => {
    const why = actionReason(d, a);
    if (why) {
      problems.push(`step ${actions.length + 1} (${describeAction(a)}): ${why}`);
      return false;
    }
    d = applyAction(d, a);
    actions.push(a);
    return true;
  });
  const done = () => ({ actions, problems, design: d });
  if (goal.kind !== 'arms') return { actions, problems: ['a fieldless design has no builder path'], design: d };

  // Field.
  const f = goal.field;
  if (f.k === 'divided') {
    if ((d.kind !== 'arms' || d.field.k !== 'divided' || d.field.division !== f.division) && !click({ kind: 'division', division: f.division })) return done();
    const [a, b] = f.parts.map((p) => (p.k === 'tincture' ? p.t : null));
    if (!a || !b) return { actions, problems: ['a part of the field is not a plain tincture'], design: d };
    const now = d.kind === 'arms' && d.field.k === 'divided' ? d.field.parts.map((p) => (p.k === 'tincture' ? p.t : a)) as [Tincture, Tincture] : [a, b] as [Tincture, Tincture];
    if (!click(...dividedTinctureSteps(now, [a, b]))) return done();
  } else if (f.k === 'tincture') {
    if (d.kind === 'arms' && d.field.k === 'tincture' && d.field.t !== f.t && !click({ kind: 'field-tincture', part: 0, tincture: f.t })) return done();
  }

  const parts = simpleParts(goal);

  // Ordinary.
  if (parts.ordinary) {
    const item = parts.ordinary.group.item;
    if (item.k !== 'ordinary' || !click({ kind: 'ordinary', type: item.type })) return done();
    const t = tinctureOf(parts.ordinary.group);
    if (t && tinctureOf(groupAt(d, ordinaryPath(d)!)) !== t && !click({ kind: 'ordinary-tincture', tincture: t })) return done();
  }

  // The top band and border beside the ordinary, before the pictures they leave room for.
  for (const peripheral of parts.peripherals) {
    const place = peripheral.place as PeripheralKey;
    if (!click({ kind: 'add-layer', place })) return done();
    const t = tinctureOf(peripheral.group);
    if (t && tinctureOf(groupAt(d, peripheralAt(d, place)!)) !== t && !click({ kind: 'layer-tincture', place, tincture: t })) return done();
  }

  // The picture, then the pictures around it or beside it in chief, base or canton, the extra pictures on the band, the top band and the border, and last what lies overall.
  for (const at of ['picture', ...EXTRA_PICTURES, 'overall'] as const) {
    const part = at === 'picture' ? parts.picture : at === 'on-ordinary' ? parts.extra : at === 'around' ? parts.around : at === 'on-picture' ? parts.onPicture
      : at === 'overall' ? parts.overall : parts.positioned?.place === at ? parts.positioned : parts.peripheralPictures.find((p) => p.place === at);
    if (!part) continue;
    const item = part.group.item;
    if (at === 'overall') {
      const wanted: LayerItem = item.k === 'ordinary' ? { k: 'ordinary', type: item.type } : { k: 'charge', charge: item.charge };
      if (!click({ kind: 'add-layer', place: 'overall' }, { kind: 'overall-item', item: wanted })) return done();
      if (item.k === 'ordinary') {
        const t = tinctureOf(part.group);
        if (t && tinctureOf(groupAt(d, pathAt(d, at)!)) !== t && !click({ kind: 'charge-tincture', at, tincture: t })) return done();
        continue;
      }
    } else if (item.k !== 'charge') return { actions, problems: [...problems, `the ${at} is not a charge`], design: d };
    else if (!click({ kind: 'charge', at, charge: item.charge })) return done();
    const route = layoutRoute(d, goal, at);
    if (!route) {
      problems.push(`no route through the count, placement and layout controls reaches ${layoutState(goal, at)} from ${layoutState(d, at)}`);
      return done();
    }
    if (!click(...route)) return done();
    const path = pathAt(d, at)!;
    const now = groupAt(d, path).item;
    if (item.posture && now.k === 'charge' && now.posture !== item.posture && !click({ kind: 'posture', at, posture: item.posture })) return done();
    const wantsSplendour = item.mods.some((m) => m.id === 'in-splendour');
    if (wantsSplendour && now.k === 'charge' && !now.mods.some((m) => m.id === 'in-splendour') && !click({ kind: 'splendour', at, on: true })) return done();
    const t = tinctureOf(part.group);
    if (t && tinctureOf(groupAt(d, path)) !== t && !click({ kind: 'charge-tincture', at, tincture: t })) return done();
  }

  // Pictures in chief, base or canton take room from the picture, which may have had to give up charges: lay it out again.
  if (parts.picture && layoutState(d, 'picture') !== layoutState(goal, 'picture')) {
    const route = layoutRoute(d, goal, 'picture');
    if (!route) {
      problems.push(`no route through the count, placement and layout controls reaches ${layoutState(goal, 'picture')} from ${layoutState(d, 'picture')}`);
      return done();
    }
    if (!click(...route)) return done();
  }

  if (canonicalJson(d) !== canonicalJson(goal)) problems.push(`the builder ended on ${canonicalJson(d)}, not ${canonicalJson(goal)}`);
  return done();
}
