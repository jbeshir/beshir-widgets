// The widget-side checks the SCA armorial test applies to every design matched from a blazon:
//
// - assessMatched: the widget's own verdict on the design — registrable, blocked (a rule of
//   tincture or structure violation, or a plain field on its own), or not even well-formed.
// - renderShieldSvg + expectedElements + checkRendered: the real <Shield> rendered to SVG markup
//   in plain Node, checked for one field region per part of the field, the ordinary, and exactly
//   one drawn charge per charge in the group, each painted its tincture. Shield gives its layers no
//   classes, so the expected <path> elements (path data, fill, transform) are worked out from the
//   same geometry the component draws from.
// - builderPath: the clicks that build the design from the builder's starting design, each one a
//   choice the options helper offers and allows, applied by the real builder functions, ending on
//   exactly the normalised design.
//
// The checks return their problems as strings rather than throwing, so the caller can report them
// per record. Only the rendering helpers throw, on a design the widget can't resolve at all (which
// assessMatched calls structural).

import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { Shield } from '../../src/components/Shield';
import {
  CHARGE_IDS, DEFAULT_FIELD_SHAPE, DIVISIONS, ORDINARY_FILL_RULE, ORDINARY_TYPES, OUTLINE_COLOUR, SHAPE_LAYOUT, TINCTURES, TINCTURE_FILL,
  arrangementChoices, chargePath, chargeTinctureChoices, counterchangedParts, countChoices, drawnBox, fieldRegions, fieldTinctureChoices,
  ordinaryTinctureChoices, placementChoices, postureChoices, resolve, shapedChargeSlots, validate,
  type ChargeId, type ChargeTincture, type Choice, type Design, type Division, type FieldShape, type Issue, type NormDesign,
  type OrdinaryType, type Posture, type Slot, type Tincture,
} from '../../src/lib/heraldry';
import type { IssueCode } from '../../src/lib/heraldry/design';
import {
  DEFAULT_DESIGN, assess, setArrangement, setChargeTincture, setCharge, setCount, setDivision, setFieldTincture, setOrdinary,
  setOrdinaryTincture, setPlacement, setPlainField, setPosture, type DesignStatus,
} from '../../src/lib/builder';
import { layoutMoves, type LayoutAction } from '../helpers';

// ── Assessment ──────────────────────────────────────────────────────────────

/**
 * ok         — the builder would let it be registered (assess() says valid).
 * violation  — well-formed but blocked: assess() says violation (structure or rule of tincture) or
 *              incomplete (a plain field alone, code 'generic'). `codes` are the distinct issue codes.
 * structural — malformed: the widget can't resolve it at all (code 'shape').
 */
export type Assessment =
  | { kind: 'ok'; design: NormDesign }
  | { kind: 'violation'; status: Exclude<DesignStatus, 'valid'>; codes: IssueCode[]; issues: Issue[]; design: NormDesign }
  | { kind: 'structural'; codes: IssueCode[]; issues: Issue[] };

export function assessMatched(design: Design): Assessment {
  const r = resolve(design);
  if (!r.ok) return { kind: 'structural', codes: distinctCodes(r.errors), issues: r.errors };
  const report = assess(r.design);
  if (report.status === 'valid') return { kind: 'ok', design: r.design };
  const issues = validate(r.design);
  return { kind: 'violation', status: report.status, codes: distinctCodes(issues), issues, design: r.design };
}

/** JSON with object keys sorted, so equal designs compare equal whatever order the builder set their keys in. */
const canonical = (v: unknown): string => JSON.stringify(v, (_, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  : x));

const distinctCodes = (issues: Issue[]): IssueCode[] => [...new Set(issues.map((i) => i.code))];

/** The resolved design (every default filled), for checks that also draw illegal-but-well-formed designs. */
function resolved(design: Design): NormDesign {
  const r = resolve(design);
  if (!r.ok) throw new Error(`design doesn't resolve: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.design;
}

// ── Rendering ───────────────────────────────────────────────────────────────

export interface RenderOptions {
  shape?: FieldShape;
  hatching?: boolean;
}

/** The real <Shield> as SVG markup, at its default (CSS-sized) size. Throws if the design doesn't resolve. */
export function renderShieldSvg(design: Design, { shape = DEFAULT_FIELD_SHAPE, hatching = false }: RenderOptions = {}): string {
  return renderToString(h(Shield, { design: resolved(design), shape, hatching }));
}

interface ExpectedPath { d: string; fill: string }

/** One drawn charge: where its art is placed, and the fills painting it (two parts when counterchanged across the line). */
interface ExpectedCharge { transform: string; fills: string[] }

export interface ExpectedElements {
  /** One filled region per part of the field, in paint order. */
  field: ExpectedPath[];
  ordinary: (ExpectedPath & { fillRule: string }) | null;
  /** The charge art and one entry per drawn charge; null without charges. */
  charges: { d: string; count: number; drawn: ExpectedCharge[] } | null;
}

/** Where Shield places a charge's art in its slot (100×100 art scaled into the drawn box). */
const chargeTransform = (s: Slot) => `translate(${s.x - s.size / 2} ${s.y - s.size / 2}) scale(${s.size / 100})`;

/** What the shield for this design should draw, from the geometry Shield draws from. */
export function expectedElements(design: Design, shape: FieldShape = DEFAULT_FIELD_SHAPE): ExpectedElements {
  const nd = resolved(design);
  const layout = SHAPE_LAYOUT[shape];
  const c = nd.charges;
  let charges: ExpectedElements['charges'] = null;
  if (c) {
    const boxes = shapedChargeSlots(nd, shape).map((s) => drawnBox(s, c.charge));
    const parts = counterchangedParts(nd, shape);
    charges = {
      d: chargePath(c.charge, c.posture),
      count: c.count,
      drawn: boxes.map((box, i) => ({
        transform: chargeTransform(box),
        fills: c.tincture === 'counterchanged' ? (parts[i] ?? []).map((p) => TINCTURE_FILL[p.tincture]) : [TINCTURE_FILL[c.tincture]],
      })),
    };
  }
  return {
    field: fieldRegions(nd.field, shape).map((r) => ({ d: r.d, fill: TINCTURE_FILL[r.tincture] })),
    ordinary: nd.ordinary
      ? { d: layout.ordinaries[nd.ordinary.type], fill: TINCTURE_FILL[nd.ordinary.tincture], fillRule: ORDINARY_FILL_RULE[nd.ordinary.type] }
      : null,
    charges,
  };
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

/** The values of every `data-charge-tincture` group marker. */
const chargeTinctureMarkers = (svg: string) => [...svg.matchAll(/\sdata-charge-tincture="([^"]*)"/g)].map((m) => m[1]);

/**
 * What is wrong with the rendered shield, or [] when it draws the design: each field region, the
 * ordinary (and no other), the charge group drawn exactly `count` times in the right slots and
 * fills, outlined once each, and field → ordinary → charges in paint order.
 */
export function checkRendered(design: Design, svg: string, shape: FieldShape = DEFAULT_FIELD_SHAPE): string[] {
  const problems: string[] = [];
  const nd = resolved(design);
  const want = expectedElements(nd, shape);
  const paths = pathTags(svg);
  const filled = (p: PathTag) => p.attrs.fill !== undefined && p.attrs.fill !== 'none' && !p.attrs.fill.startsWith('url(');
  const matching = (e: ExpectedPath) => paths.filter((p) => p.attrs.d === e.d && p.attrs.fill === e.fill);

  if (!svg.startsWith('<svg')) problems.push('the markup is not an <svg>');
  if (!want.field.length) problems.push('the geometry has no field regions');
  const fieldAt: number[] = [];
  want.field.forEach((e, i) => {
    const found = matching(e);
    const what = want.field.length > 1 ? `field part ${i + 1}` : 'the field';
    if (found.length !== 1) problems.push(`${what} (${e.fill}) is drawn ${found.length} times, expected once`);
    else fieldAt.push(found[0].index);
  });

  const ordinaryPaths = new Set(Object.values(SHAPE_LAYOUT[shape].ordinaries));
  const ordinaries = paths.filter((p) => ordinaryPaths.has(p.attrs.d) && filled(p));
  let ordinaryAt: number | null = null;
  if (want.ordinary) {
    const o = want.ordinary;
    const found = ordinaries.filter((p) => p.attrs.d === o.d && p.attrs.fill === o.fill && p.attrs['fill-rule'] === o.fillRule);
    if (!o.d) problems.push(`the geometry has no path for the ${nd.ordinary!.type}`);
    if (found.length !== 1) problems.push(`the ${nd.ordinary!.type} (${o.fill}) is drawn ${found.length} times, expected once`);
    else ordinaryAt = found[0].index;
    if (ordinaries.length !== found.length) problems.push(`${ordinaries.length - found.length} other ordinary shapes are drawn`);
  } else if (ordinaries.length) {
    problems.push(`an ordinary is drawn but the design has none`);
  }

  const chargeAt: number[] = [];
  if (want.charges) {
    const c = want.charges;
    const art = paths.filter((p) => p.attrs.d === c.d);
    if (!c.d) problems.push(`there is no art for the ${nd.charges!.charge}`);
    if (c.drawn.length !== c.count) problems.push(`the geometry has ${c.drawn.length} slots for ${c.count} charges`);
    const paint = art.filter(filled);
    const outlines = art.filter((p) => p.attrs.fill === 'none' && p.attrs.stroke === OUTLINE_COLOUR && p.attrs['vector-effect'] === 'non-scaling-stroke');
    const drawnAt = new Set(art.map((p) => p.attrs.transform));
    if (drawnAt.size !== c.count) problems.push(`${drawnAt.size} charges are drawn, expected ${c.count}`);
    if (outlines.length !== c.count) problems.push(`${outlines.length} charge outlines are drawn, expected ${c.count}`);
    for (const [i, e] of c.drawn.entries()) {
      const fills = paint.filter((p) => p.attrs.transform === e.transform).map((p) => p.attrs.fill).sort();
      if (!drawnAt.has(e.transform)) problems.push(`charge ${i + 1} is not drawn at ${e.transform}`);
      else if (fills.join() !== [...e.fills].sort().join()) problems.push(`charge ${i + 1} is painted ${fills.join('+') || 'nothing'}, expected ${e.fills.join('+') || 'nothing'}`);
    }
    const stray = paint.filter((p) => !c.drawn.some((e) => e.transform === p.attrs.transform));
    if (stray.length) problems.push(`${stray.length} charge paints are outside the expected slots`);
    chargeAt.push(...paint.map((p) => p.index));
    const tinctures = [...new Set(c.drawn.flatMap((e) => e.fills))].sort();
    const markers = chargeTinctureMarkers(svg).map((t) => TINCTURE_FILL[t as Tincture] ?? t).sort();
    if (markers.join() !== tinctures.join()) problems.push(`charge groups are marked ${markers.join(', ') || 'nothing'}, expected ${tinctures.join(', ') || 'nothing'}`);
  } else if (chargeTinctureMarkers(svg).length) {
    problems.push('charges are drawn but the design has none');
  }

  // Paint order: the field under the ordinary under the charges.
  const lastField = Math.max(-1, ...fieldAt);
  if (ordinaryAt !== null && ordinaryAt < lastField) problems.push('the ordinary is painted under the field');
  const firstCharge = Math.min(Infinity, ...chargeAt);
  if (firstCharge < Math.max(lastField, ordinaryAt ?? -1)) problems.push('a charge is painted under the field or the ordinary');
  return problems;
}

// ── Builder path ────────────────────────────────────────────────────────────

/** One click in the builder's Design tab. */
export type BuilderAction =
  | { kind: 'plain-field' }
  | { kind: 'division'; division: Division }
  | { kind: 'field-tincture'; part: 0 | 1; tincture: Tincture }
  | { kind: 'ordinary'; type: OrdinaryType | null }
  | { kind: 'ordinary-tincture'; tincture: Tincture }
  | { kind: 'charge'; charge: ChargeId | null }
  | LayoutAction
  | { kind: 'posture'; posture: Posture }
  | { kind: 'charge-tincture'; tincture: ChargeTincture };

/** Why a choice list doesn't offer and allow `v`, or null when it does. */
function choiceReason<T>(choices: Choice<T>[], v: T): string | null {
  const c = choices.find((x) => x.value === v);
  if (!c) return `${String(v)} is not offered`;
  return c.allowed ? null : `${String(v)} is blocked: ${c.reason}`;
}

/**
 * Why the Design tab wouldn't let you make this click on `d`, or null when it would. The field
 * division, ordinary and picture pickers list every value and never block one (BuilderSteps); the
 * rest are offered by the options helper, which may block.
 */
function actionReason(d: NormDesign, a: BuilderAction): string | null {
  switch (a.kind) {
    case 'plain-field': return null;
    case 'division': return DIVISIONS.includes(a.division) ? null : `${a.division} is not offered`;
    case 'field-tincture':
      if (a.part === 1 && d.field.kind !== 'divided') return 'a plain field has no second tincture';
      return choiceReason(fieldTinctureChoices(d, a.part), a.tincture);
    case 'ordinary': return a.type === null || ORDINARY_TYPES.includes(a.type) ? null : `${a.type} is not offered`;
    case 'ordinary-tincture': return d.ordinary ? choiceReason(ordinaryTinctureChoices(d), a.tincture) : 'there is no ordinary to colour';
    case 'charge': return a.charge === null || CHARGE_IDS.includes(a.charge) ? null : `${a.charge} is not offered`;
    case 'count': return d.charges ? choiceReason(countChoices(d), a.count) : 'there are no charges to count';
    case 'placement': return d.charges ? choiceReason(placementChoices(d), a.placement) : 'there are no charges to place';
    case 'arrangement': {
      const arr = arrangementChoices(d);
      return arr.mode === 'choose' ? choiceReason(arr.choices, a.arrangement) : `the layout is fixed (${arr.note})`;
    }
    case 'posture': return d.charges ? choiceReason(postureChoices(d), a.posture) : 'there are no charges to pose';
    case 'charge-tincture': return d.charges ? choiceReason(chargeTinctureChoices(d), a.tincture) : 'there are no charges to colour';
  }
}

/** The design the builder makes of a click, by the same function the Design tab calls. */
function applyAction(d: NormDesign, a: BuilderAction): NormDesign {
  switch (a.kind) {
    case 'plain-field': return setPlainField(d);
    case 'division': return setDivision(d, a.division);
    case 'field-tincture': return setFieldTincture(d, a.part, a.tincture);
    case 'ordinary': return setOrdinary(d, a.type);
    case 'ordinary-tincture': return setOrdinaryTincture(d, a.tincture);
    case 'charge': return setCharge(d, a.charge);
    case 'count': return setCount(d, a.count);
    case 'placement': return setPlacement(d, a.placement);
    case 'arrangement': return setArrangement(d, a.arrangement);
    case 'posture': return setPosture(d, a.posture);
    case 'charge-tincture': return setChargeTincture(d, a.tincture);
  }
}

function describeAction(a: BuilderAction): string {
  switch (a.kind) {
    case 'plain-field': return 'plain field';
    case 'division': return `division ${a.division}`;
    case 'field-tincture': return `field part ${a.part + 1} ${a.tincture}`;
    case 'ordinary': return `ordinary ${a.type ?? 'none'}`;
    case 'ordinary-tincture': return `ordinary tincture ${a.tincture}`;
    case 'charge': return `charge ${a.charge ?? 'none'}`;
    case 'count': return `count ${a.count}`;
    case 'placement': return `placement ${a.placement}`;
    case 'arrangement': return `arrangement ${a.arrangement}`;
    case 'posture': return `posture ${a.posture}`;
    case 'charge-tincture': return `charge tincture ${a.tincture}`;
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

const layoutKey = (d: NormDesign) => (d.charges ? `${d.charges.count}/${d.charges.placement}/${d.charges.arrangement}` : '');

/**
 * The layout clicks from `start` to the target's count, placement and arrangement: the direct
 * placement → count → arrangement clicks when the controls allow them, else searchLayoutRoute.
 */
function layoutSteps(start: NormDesign, goal: NormDesign): LayoutAction[] | null {
  const g = goal.charges!;
  const direct: LayoutAction[] = [];
  let d = start;
  for (const a of [
    { kind: 'placement', placement: g.placement },
    { kind: 'count', count: g.count },
    { kind: 'arrangement', arrangement: g.arrangement },
  ] as const) {
    const now = d.charges!;
    if ((a.kind === 'placement' && now.placement === a.placement) || (a.kind === 'count' && now.count === a.count)
      || (a.kind === 'arrangement' && now.arrangement === a.arrangement)) continue;
    if (actionReason(d, a)) break;
    direct.push(a);
    d = applyAction(d, a);
  }
  return layoutKey(d) === layoutKey(goal) ? direct : searchLayoutRoute(start, goal);
}

/**
 * The shortest route through the count, placement and layout controls from `start` to the
 * target's layout (breadth-first, as the reachability test searches), or null when there is none.
 */
function searchLayoutRoute(start: NormDesign, goal: NormDesign): LayoutAction[] | null {
  if (layoutKey(start) === layoutKey(goal)) return [];
  const routes = new Map<string, LayoutAction[]>([[layoutKey(start), []]]);
  const queue = [start];
  for (let s = queue.shift(); s; s = queue.shift()) {
    const route = routes.get(layoutKey(s))!;
    for (const m of layoutMoves(s)) {
      const k = layoutKey(m.design);
      if (routes.has(k)) continue;
      routes.set(k, [...route, m.action]);
      if (k === layoutKey(goal)) return routes.get(k)!;
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
  design: NormDesign;
}

/**
 * Build `target` in the builder from its starting design, the way a person would: the field (kind,
 * then tinctures), then the ordinary and its tincture, then the picture, its layout, pose and
 * tincture. Each click must be offered and allowed on the design at that moment; the builder's own
 * functions apply it. Stops at the first click it can't make.
 */
export function builderPath(target: Design): BuilderPath {
  const r = resolve(target);
  if (!r.ok) return { actions: [], problems: [`the target doesn't resolve: ${r.errors.map((e) => e.message).join('; ')}`], design: DEFAULT_DESIGN };
  const goal = r.design;
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

  // Field.
  const f = goal.field;
  if (f.kind === 'plain') {
    if (d.field.kind !== 'plain' && !click({ kind: 'plain-field' })) return done();
    if (d.field.kind === 'plain' && d.field.tincture !== f.tincture && !click({ kind: 'field-tincture', part: 0, tincture: f.tincture })) return done();
  } else {
    if ((d.field.kind !== 'divided' || d.field.division !== f.division) && !click({ kind: 'division', division: f.division })) return done();
    if (d.field.kind === 'divided' && !click(...dividedTinctureSteps(d.field.tinctures, f.tinctures))) return done();
  }

  // Ordinary.
  const o = goal.ordinary;
  if (o) {
    if (d.ordinary?.type !== o.type && !click({ kind: 'ordinary', type: o.type })) return done();
    if (d.ordinary?.tincture !== o.tincture && !click({ kind: 'ordinary-tincture', tincture: o.tincture })) return done();
  }

  // Charges: the picture, its layout, pose and tincture (last, so it is judged where the charges end up).
  const g = goal.charges;
  if (g) {
    if (!click({ kind: 'charge', charge: g.charge })) return done();
    const route = layoutSteps(d, goal);
    if (!route) {
      problems.push(`no route through the count, placement and layout controls reaches ${layoutKey(goal)} from ${layoutKey(d)}`);
      return done();
    }
    if (!click(...route)) return done();
    if (g.posture && d.charges!.posture !== g.posture && !click({ kind: 'posture', posture: g.posture })) return done();
    if (d.charges!.tincture !== g.tincture && !click({ kind: 'charge-tincture', tincture: g.tincture })) return done();
  }

  if (canonical(d) !== canonical(goal)) problems.push(`the builder ended on ${JSON.stringify(d)}, not ${JSON.stringify(goal)}`);
  return done();
}
