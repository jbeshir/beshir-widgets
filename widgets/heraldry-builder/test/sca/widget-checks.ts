// The widget-side checks the SCA armorial test applies to every design matched from a blazon:
//
// - assessMatched: the widget's own verdict on the design — registrable, blocked (a rule of
//   tincture or structure violation, or a plain field on its own), or not even well-formed.
// - renderShieldSvg + expectedElements + checkRendered: the real <Shield> rendered to SVG markup
//   in plain Node, checked layer by layer against renderLayers (the geometry Shield draws from):
//   one field block with a region per part, then for each group in paint order a block with its
//   ordinary shape or its charges, each drawn at the expected slot, painted its tinctures and
//   outlined once, with no stray paint.
// - builderPath: the clicks that build the design from the builder's starting design, each one a
//   choice the options helper offers and allows, applied by the real builder functions, ending on
//   exactly the normalised design.
//
// The checks return their problems as strings rather than throwing, so the caller can report them
// per record. Only the rendering helpers throw, on a design the widget can't draw at all.

import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { Shield } from '../../src/components/Shield';
import {
  CHARGE_IDS, DEFAULT_FIELD_SHAPE, DIVISIONS, DRAWN_ORDINARIES, OUTLINE_COLOUR, TINCTURES, TINCTURE_FILL,
  canonicalJson, fieldTinctureChoices, groupAt, groupTinctureOf, groupTinctureChoices, modifierChoices, pathKey, postureChoices, renderLayers, simpleParts, slotTransform,
  validate,
  type ChargeId, type Choice, type Design, type Division, type FieldShape, type Group, type GroupPath, type GroupTincture, type Issue, type Layer, type OrdinaryType, type Posture,
  type Tincture,
} from '../../src/lib/heraldry';
import {
  DEFAULT_DESIGN, addExtraPicture, addPeripheral, canAddPeripheral, peripheralPath, setPeripheralTincture, type PeripheralType, assess, canAddExtraPicture, extraPicturePath, ordinaryPath, picturePath, setCharge, setDivision, setFieldTincture, setGroupTincture,
  setModifier, setOrdinary, setOrdinaryTincture, setPlainField, setPosture, type DesignStatus,
} from '../../src/lib/builder';
import { layoutMoves, type LayoutAction } from '../helpers';

// ── Assessment ──────────────────────────────────────────────────────────────

type IssueCode = Issue['code'];

/**
 * ok         — the builder would let it be registered (assess() says valid).
 * violation  — well-formed but blocked: assess() says violation (structure or rule of tincture) or
 *              incomplete (a plain field alone, code 'generic'). `codes` are the distinct issue codes.
 * structural — malformed or not drawable: the widget can't use it at all.
 */
export type Assessment =
  | { kind: 'ok'; design: Design }
  | { kind: 'violation'; status: Exclude<DesignStatus, 'valid'>; codes: IssueCode[]; issues: Issue[]; design: Design }
  | { kind: 'structural'; codes: IssueCode[]; issues: Issue[] };

const distinctCodes = (issues: Issue[]): IssueCode[] => [...new Set(issues.map((i) => i.code))];

export function assessMatched(design: Design): Assessment {
  const report = assess(design);
  if (report.status === 'valid') return { kind: 'ok', design };
  const issues = validate(design);
  return { kind: 'violation', status: report.status, codes: distinctCodes(issues), issues, design };
}

// ── Rendering ───────────────────────────────────────────────────────────────

export interface RenderOptions {
  shape?: FieldShape;
  hatching?: boolean;
}

/** The real <Shield> as SVG markup, at its default (CSS-sized) size. Throws if the design can't be drawn. */
export function renderShieldSvg(design: Design, { shape = DEFAULT_FIELD_SHAPE, hatching = false }: RenderOptions = {}): string {
  return renderToString(h(Shield, { design, shape, hatching, label: null }));
}

/** A <path> of the markup: its attributes, and its position among all paths (paint order). */
interface PathTag { index: number; attrs: Record<string, string> }

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" };
const decode = (v: string) => v.replace(/&(?:amp|quot|lt|gt|#39);/g, (e) => ENTITIES[e]);

/** Every <path> in the markup, in document order. Shield's markup is flat enough that no XML parser is needed. */
function pathTags(svg: string): PathTag[] {
  return [...svg.matchAll(/<path\b([^>]*?)\/?>/g)].map((m, index) => ({
    index,
    attrs: Object.fromEntries([...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], decode(a[2])])),
  }));
}

interface Block { layer: string; group: string | null; markup: string }

/** The `<g data-layer data-group>` blocks of the markup in paint order. Layer blocks don't nest. */
function layerBlocks(svg: string): Block[] {
  const opens = [...svg.matchAll(/<g data-layer="(\w+)"(?: data-group="([\d.]+)")?>/g)];
  return opens.map((m, i) => ({ layer: m[1], group: m[2] ?? null, markup: svg.slice(m.index, opens[i + 1]?.index ?? svg.length) }));
}

const filled = (p: PathTag) => p.attrs.fill !== undefined && p.attrs.fill !== 'none' && !p.attrs.fill.startsWith('url(');
const sorted = (xs: string[]) => [...xs].sort();

function checkField(layer: Extract<Layer, { k: 'field' }>, block: Block): string[] {
  const paths = pathTags(block.markup);
  const want = layer.regions.map((r) => `${r.d}|${TINCTURE_FILL[r.tincture]}`);
  const got = paths.filter(filled).map((p) => `${p.attrs.d}|${p.attrs.fill}`);
  return sorted(got).join() === sorted(want).join() ? [] : [`the field draws ${got.length} regions, expected ${want.length} (${layer.regions.map((r) => TINCTURE_FILL[r.tincture]).join(', ')})`];
}

function checkOrdinary(layer: Extract<Layer, { k: 'ordinary' }>, block: Block): string[] {
  const paths = pathTags(block.markup);
  const want = layer.fills.map((f) => `${layer.d}|${TINCTURE_FILL[f.tincture]}|${layer.fillRule}`);
  const got = paths.filter(filled).map((p) => `${p.attrs.d}|${p.attrs.fill}|${p.attrs['fill-rule']}`);
  const problems: string[] = [];
  if (sorted(got).join() !== sorted(want).join()) problems.push(`the ordinary at ${block.group} draws ${got.length} fills, expected ${want.length}`);
  const outlines = paths.filter((p) => p.attrs.fill === 'none' && p.attrs.d === layer.d);
  if (outlines.length !== 1) problems.push(`the ordinary at ${block.group} is outlined ${outlines.length} times, expected once`);
  if (!layer.d) problems.push(`the geometry has no path for the ordinary at ${block.group}`);
  return problems;
}

function checkCharges(layer: Extract<Layer, { k: 'charges' }>, block: Block): string[] {
  const paths = pathTags(block.markup);
  const problems: string[] = [];
  const want = layer.fills.flatMap((f) => f.slots.map((s) => `${slotTransform(layer.slots[s])}|${TINCTURE_FILL[f.tincture]}`));
  const got = paths.filter(filled).map((p) => `${p.attrs.transform}|${p.attrs.fill}`);
  if (sorted(got).join() !== sorted(want).join()) problems.push(`the charges at ${block.group} are painted ${sorted(got).join(' ') || 'nothing'}, expected ${sorted(want).join(' ') || 'nothing'}`);
  if (paths.filter(filled).some((p) => p.attrs.d !== layer.art)) problems.push(`the charges at ${block.group} are not drawn with their own art`);
  // (the shield's own frame outline, last in the markup, has no transform)
  const outlines = paths.filter((p) => p.attrs.transform !== undefined && p.attrs.fill === 'none' && p.attrs.stroke === OUTLINE_COLOUR && p.attrs['vector-effect'] === 'non-scaling-stroke');
  if (sorted(outlines.map((p) => p.attrs.transform)).join() !== sorted(layer.slots.map(slotTransform)).join()) {
    problems.push(`${outlines.length} charge outlines are drawn at ${block.group}, expected ${layer.slots.length}`);
  }
  const markers = [...block.markup.matchAll(/\sdata-charge-tincture="([^"]*)"/g)].map((m) => m[1]);
  if (sorted(markers).join() !== sorted(layer.fills.map((f) => f.tincture)).join()) {
    problems.push(`charge groups at ${block.group} are marked ${markers.join(', ') || 'nothing'}`);
  }
  return problems;
}

/**
 * What is wrong with the rendered shield, or [] when it draws the design: the same layers
 * renderLayers lists, in the same order, each drawn at its geometry in its tinctures.
 */
export function checkRendered(design: Design, svg: string, shape: FieldShape = DEFAULT_FIELD_SHAPE): string[] {
  if (!svg.startsWith('<svg')) return ['the markup is not an <svg>'];
  const layers = renderLayers(design, shape);
  const blocks = layerBlocks(svg);
  if (blocks.length !== layers.length) return [`${blocks.length} layers are drawn, expected ${layers.length}`];
  return layers.flatMap((layer, i): string[] => {
    const block = blocks[i];
    if (block.layer !== (layer.k === 'field' ? 'field' : layer.k === 'ordinary' ? 'ordinary' : 'charges')) return [`layer ${i + 1} is a ${block.layer} layer, expected ${layer.k}`];
    if (layer.k !== 'field' && block.group !== pathKey(layer.path)) return [`layer ${i + 1} is group ${block.group}, expected ${pathKey(layer.path)}`];
    switch (layer.k) {
      case 'field': return checkField(layer, block);
      case 'ordinary': return checkOrdinary(layer, block);
      case 'charges': return checkCharges(layer, block);
    }
  });
}

// ── Builder path ────────────────────────────────────────────────────────────

type Which = 'picture' | 'extra';

/** One click in the builder's Design tab. */
export type BuilderAction =
  | { kind: 'plain-field' }
  | { kind: 'division'; division: Division }
  | { kind: 'field-tincture'; part: 0 | 1; tincture: Tincture }
  | { kind: 'ordinary'; type: OrdinaryType | null }
  | { kind: 'ordinary-tincture'; tincture: GroupTincture }
  | { kind: 'peripheral'; type: PeripheralType }
  | { kind: 'peripheral-tincture'; tincture: GroupTincture }
  | { kind: 'charge'; which: Which; charge: ChargeId | null }
  | { kind: 'layout'; which: Which; action: LayoutAction; design: Design }
  | { kind: 'posture'; which: Which; posture: Posture }
  | { kind: 'splendour'; which: Which; on: boolean }
  | { kind: 'charge-tincture'; which: Which; tincture: GroupTincture };

const tinctureOf = (g: Group): GroupTincture | null => groupTinctureOf(g.paint);
const pathOf = (d: Design, which: Which): GroupPath | null => (which === 'picture' ? picturePath(d) : extraPicturePath(d));

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
    case 'peripheral': return canAddPeripheral(d, a.type) ? null : `a ${a.type} is not offered beside this band`;
    case 'peripheral-tincture': {
      const path = peripheralPath(d);
      return path ? choiceReason(groupTinctureChoices(d, path), a.tincture) : 'there is no top band or border to colour';
    }
    case 'charge':
      if (a.which === 'extra' && a.charge !== null && !canAddExtraPicture(d)) return 'pictures on the band are not offered';
      return a.charge === null || CHARGE_IDS.includes(a.charge) ? null : `${a.charge} is not offered`;
    case 'layout': return null;
    case 'posture': {
      const path = pathOf(d, a.which);
      return path ? choiceReason(postureChoices(d, path), a.posture) : `there is no ${a.which} to pose`;
    }
    case 'splendour': {
      const path = pathOf(d, a.which);
      return path ? choiceReason(modifierChoices(d, path), 'in-splendour') : `there is no ${a.which} to show a face on`;
    }
    case 'charge-tincture': {
      const path = pathOf(d, a.which);
      return path ? choiceReason(groupTinctureChoices(d, path), a.tincture) : `there is no ${a.which} to colour`;
    }
  }
}

/** The design the builder makes of a click, by the same function the Design tab calls. */
function applyAction(d: Design, a: BuilderAction): Design {
  const path = 'which' in a ? pathOf(d, a.which) : null;
  switch (a.kind) {
    case 'plain-field': return setPlainField(d);
    case 'division': return setDivision(d, a.division);
    case 'field-tincture': return setFieldTincture(d, a.part, a.tincture);
    case 'ordinary': return setOrdinary(d, a.type);
    case 'ordinary-tincture': return setOrdinaryTincture(d, a.tincture);
    case 'peripheral': return addPeripheral(d, a.type);
    case 'peripheral-tincture': return setPeripheralTincture(d, a.tincture);
    case 'charge': return a.which === 'extra' && a.charge && !path ? addExtraPicture(d, a.charge) : setCharge(d, a.which, a.charge);
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
    case 'peripheral': return `add ${a.type}`;
    case 'peripheral-tincture': return `top band or border tincture ${a.tincture}`;
    case 'charge': return `${a.which} charge ${a.charge ?? 'none'}`;
    case 'layout': return `${a.which} ${a.action.kind} ${a.action.kind === 'count' ? a.action.count : a.action.kind === 'placement' ? a.action.placement : a.action.layout}`;
    case 'posture': return `${a.which} posture ${a.posture}`;
    case 'splendour': return `${a.which} splendour ${a.on ? 'on' : 'off'}`;
    case 'charge-tincture': return `${a.which} tincture ${a.tincture}`;
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
function layoutState(d: Design, which: Which): string {
  const path = pathOf(d, which);
  if (!path) return '';
  const g = groupAt(d, path);
  const placement = simpleParts(d).picture?.placement ?? '';
  return `${g.count}/${which === 'picture' ? placement : ''}/${JSON.stringify([g.arrangement, g.position])}`;
}

/**
 * The shortest route through the count, placement and layout controls from `start` to the goal's
 * layout (breadth-first, as the reachability test searches), or null when there is none.
 */
function layoutRoute(start: Design, goal: Design, which: Which): BuilderAction[] | null {
  const target = layoutState(goal, which);
  if (layoutState(start, which) === target) return [];
  const routes = new Map<string, BuilderAction[]>([[layoutState(start, which), []]]);
  const queue = [start];
  for (let s = queue.shift(); s; s = queue.shift()) {
    const route = routes.get(layoutState(s, which))!;
    const path = pathOf(s, which);
    if (!path) continue;
    for (const m of layoutMoves(s, path)) {
      const k = layoutState(m.design, which);
      if (routes.has(k)) continue;
      const next = [...route, { kind: 'layout', which, action: m.action, design: m.design } as const];
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
 * then tinctures), then the ordinary and its tincture, then a top band or border, then the picture — its charge, placement and
 * layout, pose, face and tincture — then the extra pictures on the band. Each click must be offered
 * and allowed on the design at that moment; the builder's own functions apply it. Stops at the first
 * click it can't make.
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

  // The top band or border beside the band.
  if (parts.peripheral) {
    const item = parts.peripheral.group.item;
    if (item.k !== 'ordinary' || (item.type !== 'chief' && item.type !== 'bordure') || !click({ kind: 'peripheral', type: item.type })) return done();
    const t = tinctureOf(parts.peripheral.group);
    if (t && tinctureOf(groupAt(d, peripheralPath(d)!)) !== t && !click({ kind: 'peripheral-tincture', tincture: t })) return done();
  }

  // The picture, then the extra pictures on the band.
  for (const which of ['picture', 'extra'] as const) {
    const part = parts[which];
    if (!part) continue;
    const item = part.group.item;
    if (item.k !== 'charge') return { actions, problems: [...problems, `the ${which} is not a charge`], design: d };
    if (!click({ kind: 'charge', which, charge: item.charge })) return done();
    const route = layoutRoute(d, goal, which);
    if (!route) {
      problems.push(`no route through the count, placement and layout controls reaches ${layoutState(goal, which)} from ${layoutState(d, which)}`);
      return done();
    }
    if (!click(...route)) return done();
    const path = pathOf(d, which)!;
    const now = groupAt(d, path).item;
    if (item.posture && now.k === 'charge' && now.posture !== item.posture && !click({ kind: 'posture', which, posture: item.posture })) return done();
    const wantsSplendour = item.mods.some((m) => m.id === 'in-splendour');
    if (wantsSplendour && now.k === 'charge' && !now.mods.some((m) => m.id === 'in-splendour') && !click({ kind: 'splendour', which, on: true })) return done();
    const t = tinctureOf(part.group);
    if (t && tinctureOf(groupAt(d, path)) !== t && !click({ kind: 'charge-tincture', which, tincture: t })) return done();
  }

  if (canonicalJson(d) !== canonicalJson(goal)) problems.push(`the builder ended on ${canonicalJson(d)}, not ${canonicalJson(goal)}`);
  return done();
}
