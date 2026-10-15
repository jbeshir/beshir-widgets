// The clicks that build a design in the builder: `builderPath` takes a goal design and finds the choices,
// each one offered and allowed by the options helper and applied by the real builder functions, that lead
// from the builder's starting design to exactly the normalised goal. Used by the SCA armorial test (every
// matched record must be buildable) and by the reachability tests, so it lives here, free of rendering.
//
// The checks return their problems as strings rather than throwing, so the caller can report them per record.

import {
  CHARGE_IDS, DIVISIONS, DRAWN_ORDINARIES, TINCTURES, VARIATIONS, VARIATION_PIECES, asVariation, isCountedVariation, addLayer, canonicalJson, fieldTinctureChoices, groupAt, groupTinctureChoices, groupTinctureOf, layerChoices, layerItemChoices,
  asParty, groupVariationChoices, groupVariationTinctureChoices, setGroupVariation, setGroupVariationPieces, setGroupVariationTincture, furAt, paintAt, properChoice, setProper, setTreatment, setTreatmentColour, treatmentAt, treatmentChoices, treatmentColourChoices, furChoices, furColourChoices, furColours, furKindOf, setFur, setFurColour, modifierChoices, partyDivisionChoices, partyTinctureChoices, pathOfPlace, postureChoices, setLayerItem, setLayerTincture, setPartyDivision, setPartyTincture, simpleParts, splitGroup,
  type ChargeId, type Choice, type FurKind, type FurPaint, type PaintTarget, type Paint, type TreatedPaint, type Treatment, type Design, type Division, type GroupPath, type GroupTincture, type LayerItem, type LayerKey, type OrdinaryType, type PeripheralKey, type PicturesKey, type Posture, type Tincture, type Variation,
} from '../src/lib/heraldry';
import {
  DEFAULT_DESIGN, ordinaryPath, picturePath, setCharge, setDivision, setFieldTincture, setGroupTincture, setModifier, setOrdinary, setOrdinaryTincture,
  setPlainField, setPosture, setVariation, setVariationPieces, setVariationTincture,
} from '../src/lib/builder';
import { layoutMoves, type LayoutAction } from './helpers';

/** The places the picture controls belong to: the picture, the pictures on it, the pictures around it, the pictures in chief, base or canton, the pictures on the band, the top band and the border, and what lies overall. */
type At = 'picture' | PicturesKey | 'overall';
/** The pictures laid out after the picture, in the order they are added (the second main picture first: it takes the room the others are laid out in). */
const EXTRA_PICTURES: readonly PicturesKey[] = ['co-primary', 'on-picture', 'around', 'in-chief', 'in-base', 'in-canton', 'on-ordinary', 'on-chief', 'on-bordure'];

/** One click in the builder's Design tab. */
export type BuilderAction =
  | { kind: 'plain-field' }
  | { kind: 'division'; division: Division }
  | { kind: 'field-tincture'; part: 0 | 1; tincture: Tincture }
  | { kind: 'variation'; variation: Variation }
  | { kind: 'variation-pieces'; pieces: number }
  | { kind: 'variation-tincture'; part: 0 | 1; tincture: Tincture }
  | { kind: 'ordinary'; type: OrdinaryType | null }
  | { kind: 'ordinary-tincture'; tincture: GroupTincture }
  | { kind: 'add-layer'; place: LayerKey }
  | { kind: 'layer-tincture'; place: PeripheralKey; tincture: GroupTincture }
  | { kind: 'overall-item'; item: LayerItem }
  | { kind: 'charge'; at: At; charge: ChargeId | null }
  | { kind: 'layout'; at: At; action: LayoutAction; design: Design }
  | { kind: 'posture'; at: At; posture: Posture }
  | { kind: 'splendour'; at: At; on: boolean }
  | { kind: 'charge-tincture'; at: At; tincture: GroupTincture }
  | { kind: 'split'; target: PaintWhere }
  | { kind: 'party-division'; target: PaintWhere; division: Division }
  | { kind: 'party-tincture'; target: PaintWhere; part: 0 | 1; tincture: Tincture }
  | { kind: 'pattern'; target: PaintWhere; variation: Variation }
  | { kind: 'pattern-pieces'; target: PaintWhere; pieces: number }
  | { kind: 'pattern-tincture'; target: PaintWhere; part: 0 | 1; tincture: Tincture }
  | { kind: 'fur'; target: ColourWhere; option: FurKind }
  | { kind: 'fur-colour'; target: ColourWhere; slot: 0 | 1; tincture: Tincture }
  | { kind: 'treatment'; target: ColourWhere; option: Treatment }
  | { kind: 'treatment-colour'; target: ColourWhere; slot: 0 | 1; tincture: Tincture }
  | { kind: 'proper'; at: At };

/** What a colour click is about: the band, a top band or border, or one of the pictures. */
type PaintWhere = 'ordinary' | PeripheralKey | At;

/** What a fur or treatment click is about: a part of the background (a plain background is its first part), or what a colour click is about. */
type ColourWhere = PaintWhere | 'field-1' | 'field-2';

const pathAt = (d: Design, at: At): GroupPath | null => (at === 'picture' ? picturePath(d) : at === 'on-ordinary' ? simpleParts(d).extra?.path ?? null : pathOfPlace(d, at));
const peripheralAt = (d: Design, place: PeripheralKey): GroupPath | null => simpleParts(d).peripherals.find((p) => p.place === place)?.path ?? null;
const paintPathOf = (d: Design, target: PaintWhere): GroupPath | null =>
  target === 'ordinary' ? ordinaryPath(d) : target === 'chief' || target === 'bordure' ? peripheralAt(d, target) : pathAt(d, target);

const paintTargetOf = (d: Design, where: ColourWhere): PaintTarget | null => {
  if (where === 'field-1' || where === 'field-2') return { k: 'field', part: where === 'field-1' ? 0 : 1 };
  const path = paintPathOf(d, where);
  return path && { k: 'group', path };
};

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
    case 'variation': return VARIATIONS.includes(a.variation) ? null : `${a.variation} is not offered`;
    case 'variation-pieces': {
      const varied = d.kind === 'arms' ? asVariation(d.field) : null;
      return varied && isCountedVariation(varied.variation) && VARIATION_PIECES.includes(a.pieces) ? null : `${a.pieces} stripes are not offered`;
    }
    case 'variation-tincture': return d.kind === 'arms' && asVariation(d.field) ? null : 'the background has no stripes to colour';
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
    case 'split': {
      const path = paintPathOf(d, a.target);
      if (!path) return `there is no ${a.target} to split`;
      return splitGroup(d, path) && !asParty(groupAt(d, path).paint) ? null : 'splitting the colour is not offered';
    }
    case 'party-division': {
      const path = paintPathOf(d, a.target);
      return path ? choiceReason(partyDivisionChoices(d, path), a.division) : `there is no ${a.target} to divide`;
    }
    case 'party-tincture': {
      const path = paintPathOf(d, a.target);
      return path ? choiceReason(partyTinctureChoices(d, path, a.part), a.tincture) : `there is no ${a.target} to colour`;
    }
    case 'pattern': {
      const path = paintPathOf(d, a.target);
      return path ? choiceReason(groupVariationChoices(d, path), a.variation) : `there is no ${a.target} to stripe`;
    }
    case 'pattern-pieces': {
      const path = paintPathOf(d, a.target);
      const varied = path ? asVariation(groupAt(d, path).paint) : null;
      return varied && isCountedVariation(varied.variation) && VARIATION_PIECES.includes(a.pieces) ? null : `${a.pieces} stripes are not offered on the ${a.target}`;
    }
    case 'pattern-tincture': {
      const path = paintPathOf(d, a.target);
      return path ? choiceReason(groupVariationTinctureChoices(d, path, a.part), a.tincture) : `there is no ${a.target} to colour`;
    }
    case 'fur': {
      const target = paintTargetOf(d, a.target);
      if (!target) return `there is no ${a.target} to put a fur on`;
      if (target.k === 'field' && target.part === 1 && !(d.kind === 'arms' && d.field.k === 'divided')) return 'a plain background has no second part';
      return choiceReason(furChoices(d, target), a.option);
    }
    case 'fur-colour': {
      const target = paintTargetOf(d, a.target);
      return target && furAt(d, target) ? choiceReason(furColourChoices(d, target, a.slot), a.tincture) : `there is no fur on the ${a.target}`;
    }
    case 'treatment': {
      const target = paintTargetOf(d, a.target);
      if (!target) return `there is no ${a.target} to lay a treatment on`;
      if (target.k === 'field' && target.part === 1 && !(d.kind === 'arms' && d.field.k === 'divided')) return 'a plain background has no second part';
      return choiceReason(treatmentChoices(d, target), a.option);
    }
    case 'treatment-colour': {
      const target = paintTargetOf(d, a.target);
      return target && treatmentAt(d, target) ? choiceReason(treatmentColourChoices(d, target, a.slot), a.tincture) : `there is no treatment on the ${a.target}`;
    }
    case 'proper': {
      const path = pathAt(d, a.at);
      const choice = path ? properChoice(d, path) : null;
      if (!choice) return `the ${a.at} has no natural colours`;
      return choice.allowed ? null : `natural colours are blocked: ${choice.reason}`;
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
    case 'variation': return setVariation(d, a.variation);
    case 'variation-pieces': return setVariationPieces(d, a.pieces);
    case 'variation-tincture': return setVariationTincture(d, a.part, a.tincture);
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
    case 'split': return splitGroup(d, paintPathOf(d, a.target)!)!;
    case 'party-division': return setPartyDivision(d, paintPathOf(d, a.target)!, a.division);
    case 'party-tincture': return setPartyTincture(d, paintPathOf(d, a.target)!, a.part, a.tincture);
    case 'pattern': return setGroupVariation(d, paintPathOf(d, a.target)!, a.variation);
    case 'pattern-pieces': return setGroupVariationPieces(d, paintPathOf(d, a.target)!, a.pieces);
    case 'pattern-tincture': return setGroupVariationTincture(d, paintPathOf(d, a.target)!, a.part, a.tincture);
    case 'fur': return setFur(d, paintTargetOf(d, a.target)!, a.option);
    case 'fur-colour': return setFurColour(d, paintTargetOf(d, a.target)!, a.slot, a.tincture);
    case 'treatment': return setTreatment(d, paintTargetOf(d, a.target)!, a.option);
    case 'treatment-colour': return setTreatmentColour(d, paintTargetOf(d, a.target)!, a.slot, a.tincture);
    case 'proper': return setProper(d, path!);
  }
}

function describeAction(a: BuilderAction): string {
  switch (a.kind) {
    case 'plain-field': return 'plain field';
    case 'division': return `division ${a.division}`;
    case 'field-tincture': return `field part ${a.part + 1} ${a.tincture}`;
    case 'variation': return `background ${a.variation}`;
    case 'variation-pieces': return `${a.pieces} stripes`;
    case 'variation-tincture': return `stripe colour ${a.part + 1} ${a.tincture}`;
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
    case 'split': return `split the ${a.target}`;
    case 'party-division': return `${a.target} divided ${a.division}`;
    case 'party-tincture': return `${a.target} part ${a.part + 1} ${a.tincture}`;
    case 'pattern': return `${a.target} ${a.variation}`;
    case 'pattern-pieces': return `${a.target} ${a.pieces} stripes`;
    case 'pattern-tincture': return `${a.target} pattern colour ${a.part + 1} ${a.tincture}`;
    case 'fur': return `${a.target} fur ${a.option}`;
    case 'fur-colour': return `${a.target} fur colour ${a.slot + 1} ${a.tincture}`;
    case 'treatment': return `${a.target} ${a.option}`;
    case 'treatment-colour': return `${a.target} treatment colour ${a.slot + 1} ${a.tincture}`;
    case 'proper': return `${a.at} natural colours`;
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
function pictureState(d: Design, at: At): string {
  const path = pathAt(d, at);
  if (!path) return '';
  const g = groupAt(d, path);
  const placement = simpleParts(d).picture?.placement ?? '';
  return `${g.count}/${at === 'picture' ? placement : ''}/${JSON.stringify([g.arrangement, g.position])}`;
}

/** The state of one or several pictures that are laid out together (two main pictures). */
const layoutState = (d: Design, ats: readonly At[]): string => ats.map((at) => pictureState(d, at)).join('|');

/**
 * The shortest route through the count, placement and layout controls from `start` to the goal's
 * layout (breadth-first, as the reachability test searches), or null when there is none.
 */
function layoutRoute(start: Design, goal: Design, ats: readonly At[]): BuilderAction[] | null {
  const target = layoutState(goal, ats);
  if (layoutState(start, ats) === target) return [];
  const routes = new Map<string, BuilderAction[]>([[layoutState(start, ats), []]]);
  const queue = [start];
  for (let s = queue.shift(); s; s = queue.shift()) {
    const route = routes.get(layoutState(s, ats))!;
    for (const at of ats) {
      const path = pathAt(s, at);
      if (!path) continue;
      for (const m of layoutMoves(s, path)) {
        const k = layoutState(m.design, ats);
        if (routes.has(k)) continue;
        const next = [...route, { kind: 'layout', at, action: m.action, design: m.design } as const];
        routes.set(k, next);
        if (k === target) return next;
        queue.push(m.design);
      }
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
  /** Make a run of clicks, or none: when one is not allowed yet, the design, the clicks and the problems are as they were. */
  const attempt = (clicks: () => boolean): boolean => {
    const before = { design: d, actions: actions.length, problems: problems.length };
    const made = clicks();
    if (!made) {
      d = before.design;
      actions.length = before.actions;
      problems.length = before.problems;
    }
    return made;
  };
  /** The clicks that give `where` the fur: its kind, then the colours it names. */
  const furTo = (where: ColourWhere, fur: FurPaint): boolean => {
    const now = (): Paint => paintAt(d, paintTargetOf(d, where)!);
    const same = () => JSON.stringify(now()) === JSON.stringify(fur);
    if (same()) return true;
    if (!click({ kind: 'fur', target: where, option: furKindOf(fur) })) return false;
    if (!fur.colours) return same() || !!problems.push(`the ${where} fur did not settle`) && false;
    const want = furColours(fur);
    // One colour click at a time: setting a colour may move the other, so the next step is worked out from where it landed.
    for (let guard = 0; guard < 6; guard++) {
      const here = furAt(d, paintTargetOf(d, where)!);
      if (!here) return false;
      const slot = ([0, 1] as const).find((s) => furColours(here)[s] !== want[s]);
      if (slot === undefined) return true;
      if (!click({ kind: 'fur-colour', target: where, slot, tincture: want[slot] })) return false;
    }
    return !!problems.push(`the ${where} fur colours did not settle`) && false;
  };
  /** The clicks that give `where` the treated tincture: its treatment, then its two tinctures. */
  const treatedTo = (where: ColourWhere, treated: TreatedPaint): boolean => {
    const now = () => treatmentAt(d, paintTargetOf(d, where)!);
    if (!click({ kind: 'treatment', target: where, option: treated.treatment })) return false;
    const want: [Tincture, Tincture] = [treated.ground.t, treated.ink];
    // One colour click at a time: setting the tincture may move the lines, so the next step is worked out from where it landed.
    for (let guard = 0; guard < 4; guard++) {
      const here = now();
      if (!here) return false;
      const have: [Tincture, Tincture] = [here.ground.t, here.ink];
      const slot = ([0, 1] as const).find((i) => have[i] !== want[i]);
      if (slot === undefined) return true;
      if (!click({ kind: 'treatment-colour', target: where, slot, tincture: want[slot] })) return false;
    }
    return !!problems.push(`the ${where} treatment did not settle`) && false;
  };
  /** The clicks that colour the thing at `target` as `paint`: its tincture, or a split with its division and two tinctures. */
  const paintTo = (target: PaintWhere, paint: Paint): boolean => {
    const path = paintPathOf(d, target);
    if (!path) return !!problems.push(`there is no ${target} to colour`) && false;
    const plain = groupTinctureOf(paint);
    const now = (): Paint => groupAt(d, paintPathOf(d, target)!).paint;
    if (plain) {
      if (groupTinctureOf(now()) === plain) return true;
      return click(target === 'ordinary' ? { kind: 'ordinary-tincture', tincture: plain } : target === 'chief' || target === 'bordure' ? { kind: 'layer-tincture', place: target, tincture: plain } : { kind: 'charge-tincture', at: target, tincture: plain });
    }
    if (paint.k === 'fur') return furTo(target, paint);
    if (paint.k === 'proper') return target === 'ordinary' || target === 'chief' || target === 'bordure' ? !!problems.push(`the ${target} cannot be proper`) && false : click({ kind: 'proper', at: target });
    if (paint.k === 'treated') return paint.ground.k === 'tincture' && treatedTo(target, { ...paint, ground: paint.ground });
    const pattern = asVariation(paint);
    if (pattern) {
      const nowPattern = () => asVariation(groupAt(d, paintPathOf(d, target)!).paint);
      if (!click({ kind: 'pattern', target, variation: pattern.variation })) return false;
      if (pattern.pieces !== null && nowPattern()!.pieces !== pattern.pieces && !click({ kind: 'pattern-pieces', target, pieces: pattern.pieces })) return false;
      // One click at a time: setting a tincture may move the other, so the next is worked out from where it landed.
      for (let guard = 0; guard < 4; guard++) {
        const here = nowPattern()!;
        const part = ([0, 1] as const).find((i) => here.parts[i].t !== pattern.parts[i].t);
        if (part === undefined) return true;
        if (!click({ kind: 'pattern-tincture', target, part, tincture: pattern.parts[part].t })) return false;
      }
      return !!problems.push(`the ${target} pattern did not settle`) && false;
    }
    const goal = asParty(paint);
    if (!goal) return !!problems.push(`the ${target} is neither one tincture, a fur nor divided in two`) && false;
    if (!asParty(now()) && !click({ kind: 'split', target })) return false;
    if (asParty(now())!.division !== goal.division && !click({ kind: 'party-division', target, division: goal.division })) return false;
    // One tincture click at a time: setting a part may move the other, so the next step is worked out from where it landed.
    const want: [Tincture, Tincture] = [goal.parts[0].t, goal.parts[1].t];
    for (let guard = 0; guard < 4; guard++) {
      const here = asParty(now())!;
      const [next] = dividedTinctureSteps([here.parts[0].t, here.parts[1].t], want);
      if (!next) return true;
      if (next.kind !== 'field-tincture' || !click({ kind: 'party-tincture', target, part: next.part, tincture: next.tincture })) return false;
    }
    return !!problems.push(`the ${target} tinctures did not settle`) && false;
  };
  if (goal.kind !== 'arms') return { actions, problems: ['a fieldless design has no builder path'], design: d };

  // Field.
  const f = goal.field;
  if (f.k === 'divided') {
    if ((d.kind !== 'arms' || d.field.k !== 'divided' || d.field.division !== f.division) && !click({ kind: 'division', division: f.division })) return done();
    const [a, b] = f.parts.map((p) => (p.k === 'tincture' ? p.t : null));
    if (a && b) {
      const now = d.kind === 'arms' && d.field.k === 'divided' ? d.field.parts.map((p) => (p.k === 'tincture' ? p.t : a)) as [Tincture, Tincture] : [a, b] as [Tincture, Tincture];
      if (!click(...dividedTinctureSteps(now, [a, b]))) return done();
    } else if (f.parts.every((p) => p.k === 'tincture' || p.k === 'fur' || p.k === 'treated')) {
      // A part can be set when the other part leaves it room: each pass sets the parts it can, and the next the ones it couldn't.
      const partNow = (i: 0 | 1) => (d.kind === 'arms' && d.field.k === 'divided' ? JSON.stringify(d.field.parts[i]) : '');
      for (let pass = 0; pass < 3 && ([0, 1] as const).some((i) => partNow(i) !== JSON.stringify(f.parts[i])); pass++) {
        for (const i of [0, 1] as const) {
          const goalPart = f.parts[i];
          if (partNow(i) === JSON.stringify(goalPart)) continue;
          if (goalPart.k === 'tincture') {
            const set: BuilderAction = { kind: 'field-tincture', part: i, tincture: goalPart.t };
            if (!actionReason(d, set)) click(set);
          } else if (goalPart.k === 'fur' && !actionReason(d, { kind: 'fur', target: i === 0 ? 'field-1' : 'field-2', option: furKindOf(goalPart) })) {
            if (!attempt(() => furTo(i === 0 ? 'field-1' : 'field-2', goalPart))) continue;
          } else if (goalPart.k === 'treated' && goalPart.ground.k === 'tincture') {
            const ground = goalPart.ground;
            // The other part may hold the tincture for now: try again after it has moved.
            attempt(() => treatedTo(i === 0 ? 'field-1' : 'field-2', { ...goalPart, ground }));
          }
        }
      }
      if (([0, 1] as const).some((i) => partNow(i) !== JSON.stringify(f.parts[i]))) return { actions, problems: [...problems, 'the parts of the field did not settle'], design: d };
    } else return { actions, problems: ['a part of the field is neither a tincture, a fur nor a treated tincture'], design: d };
  } else if (f.k === 'variation') {
    const want = asVariation(f);
    if (!want) return { actions, problems: ['a stripe of the background is neither a tincture nor a fur'], design: d };
    const now = () => (d.kind === 'arms' ? asVariation(d.field) : null);
    if (!click({ kind: 'variation', variation: want.variation })) return done();
    if (want.pieces !== null && now()!.pieces !== want.pieces && !click({ kind: 'variation-pieces', pieces: want.pieces })) return done();
    // One click at a time: setting a tincture may move the other, so the next is worked out from where it landed.
    for (let guard = 0; guard < 4; guard++) {
      const here = now()!;
      const part = ([0, 1] as const).find((i) => here.parts[i].t !== want.parts[i].t);
      if (part === undefined) break;
      if (!click({ kind: 'variation-tincture', part, tincture: want.parts[part].t })) return done();
    }
  } else if (f.k === 'fur') {
    if (!furTo('field-1', f)) return done();
  } else if (f.k === 'treated') {
    if (f.ground.k !== 'tincture' || !treatedTo('field-1', { ...f, ground: f.ground })) return done();
  } else if (f.k === 'tincture') {
    if (d.kind === 'arms' && d.field.k === 'tincture' && d.field.t !== f.t && !click({ kind: 'field-tincture', part: 0, tincture: f.t })) return done();
  }

  const parts = simpleParts(goal);

  // Ordinary.
  if (parts.ordinary) {
    const item = parts.ordinary.group.item;
    if (item.k !== 'ordinary' || !click({ kind: 'ordinary', type: item.type })) return done();
    if (!paintTo('ordinary', parts.ordinary.group.paint)) return done();
  }

  // The top band and border beside the ordinary, before the pictures they leave room for.
  for (const peripheral of parts.peripherals) {
    const place = peripheral.place as PeripheralKey;
    if (!click({ kind: 'add-layer', place })) return done();
    if (!paintTo(place, peripheral.group.paint)) return done();
  }

  // The picture, then the pictures around it or beside it in chief, base or canton, the extra pictures on the band, the top band and the border, and last what lies overall.
  for (const at of ['picture', ...EXTRA_PICTURES, 'overall'] as const) {
    const part = at === 'picture' ? parts.picture : at === 'on-ordinary' ? parts.extra : at === 'around' ? parts.around : at === 'co-primary' ? parts.coPrimary : at === 'on-picture' ? parts.onPicture
      : at === 'overall' ? parts.overall : parts.positioned?.place === at ? parts.positioned : parts.peripheralPictures.find((p) => p.place === at);
    if (!part) continue;
    const item = part.group.item;
    if (at === 'overall') {
      const wanted: LayerItem = item.k === 'ordinary' ? { k: 'ordinary', type: item.type } : { k: 'charge', charge: item.charge };
      if (!click({ kind: 'add-layer', place: 'overall' }, { kind: 'overall-item', item: wanted })) return done();
      if (item.k === 'ordinary') {
        if (!paintTo(at, part.group.paint)) return done();
        continue;
      }
    } else if (item.k !== 'charge') return { actions, problems: [...problems, `the ${at} is not a charge`], design: d };
    else if (!click({ kind: 'charge', at, charge: item.charge })) return done();
    // Two main pictures are laid out together and judged together: the first waits for the second, then the controls of either lead to the goal's layout of both.
    if (at === 'picture' && parts.coPrimary) continue;
    const together: readonly At[] = at === 'co-primary' ? ['picture', 'co-primary'] : [at];
    const route = layoutRoute(d, goal, together);
    if (!route) {
      problems.push(`no route through the count, placement and layout controls reaches ${layoutState(goal, together)} from ${layoutState(d, together)}`);
      return done();
    }
    if (!click(...route)) return done();
    for (const own of together) {
      const group = (own === at ? part : parts.picture!).group;
      const path = pathAt(d, own)!;
      const now = groupAt(d, path).item;
      if (group.item.k !== 'charge') continue;
      const { posture, mods } = group.item;
      if (posture && now.k === 'charge' && now.posture !== posture && !click({ kind: 'posture', at: own, posture })) return done();
      if (mods.some((m) => m.id === 'in-splendour') && now.k === 'charge' && !now.mods.some((m) => m.id === 'in-splendour') && !click({ kind: 'splendour', at: own, on: true })) return done();
      if (!paintTo(own, group.paint)) return done();
    }
  }

  // Pictures in chief, base or canton take room from the picture, which may have had to give up charges: lay it out again.
  if (parts.picture && layoutState(d, ['picture']) !== layoutState(goal, ['picture'])) {
    const route = layoutRoute(d, goal, ['picture']);
    if (!route) {
      problems.push(`no route through the count, placement and layout controls reaches ${layoutState(goal, ['picture'])} from ${layoutState(d, ['picture'])}`);
      return done();
    }
    if (!click(...route)) return done();
  }

  if (canonicalJson(d) !== canonicalJson(goal)) problems.push(`the builder ended on ${canonicalJson(d)}, not ${canonicalJson(goal)}`);
  return done();
}
