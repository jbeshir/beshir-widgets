// Parsing untrusted input into a canonical Design with every default filled in: roles and relations (SENA
// App I), arrangements (GoT Table 7), the charge attributes' defaults. Fails only on malformed input;
// structure and tincture rules are checked separately so the UI can still draw and blazon an illegal design.
//
// One parser per type (paint, item, arrangement, group); each returns its value, or null after recording
// the errors it found, so one pass reports everything wrong with the input. Errors name the group by its
// position in the input.

import { asObject } from './json';
import { isStain, isFur, isTincture } from './tinctures';
import { capitalise } from './words';
import {
  CHARGES, isChargeForm, isChargeId, isFacing, isHoldHow, isModifierId, isOrientation, isPartId, isPosture,
} from './charges';
import {
  canonical, ROLE_ORDER, PLAIN_LINES,
  type Arrangement, type Charge, type Cotises, type Design, type Group, type GroupPath, type Held, type Issue, type IssueAt, type Item,
  type Lines, type Modifier, type Ordinary, type Paint, type PartPaint, type Position, type Relation, type Role,
} from './design';
import { isDivision, isTreatment, isVariation, partCount } from './divisions';
import { isLine, isOrdinaryMod, isOrdinaryType, ORDINARY_KIND, type OrdinaryMod } from './ordinaries';
import { contextOf, defaultLayoutOf, isSecondaryPosition, layoutOfKey, type Layout } from './arrangement';

export type ResolveResult = { ok: true; design: Design } | { ok: false; errors: Issue[] };

/** Deeper nesting than any real design; it keeps hostile input from exhausting the stack. */
const MAX_DEPTH = 8;
const MAX_COUNT = 20;
const POSITIONS: readonly Position[] = ['chief', 'base', 'dexter-chief', 'sinister-chief', 'dexter', 'sinister', 'canton', 'flank', 'fess-point'];
const RELATIONS: readonly Relation[] = ['between', 'about', 'position'];
const LINE_DIRS = ['pale', 'fess', 'bend', 'bend-sinister'] as const;
const PATTERNS = ['cross', 'saltire', 'orle', 'annulo', 'chevron', 'chevron-inverted', 'pall', 'pile'] as const;
const PAIRS = ['combattant', 'respectant', 'addorsed'] as const;

class Errors {
  readonly list: Issue[] = [];

  /** Records a shape error and returns null, so a parser can `return E.add(...)`. */
  add(at: IssueAt, message: string): null {
    this.list.push({ code: 'shape', at, message, slots: [] });
    return null;
  }

  /** Records an error for each key of `o` that isn't allowed. */
  unknownKeys(o: Record<string, unknown>, allowed: readonly string[], at: IssueAt, what: string): boolean {
    const extra = Object.keys(o).filter((k) => !allowed.includes(k));
    for (const k of extra) this.add(at, `Unknown ${what} key "${k}".`);
    return extra.length > 0;
  }
}

/** The values when every one parsed, else null. */
function all<T>(xs: readonly (T | null)[]): T[] | null {
  return xs.every((x) => x !== null) ? (xs as T[]) : null;
}

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

// ── Paint ───────────────────────────────────────────────────────────────────

function parseLines(v: unknown, at: IssueAt, E: Errors): Lines | null {
  if (v === undefined) return { ...PLAIN_LINES };
  const o = asObject(v);
  if (!o) return E.add(at, '"lines" must be an object with the line "a" and optionally "b".');
  const bad = E.unknownKeys(o, ['a', 'b'], at, 'lines');
  if (!isLine(o.a) || (o.b !== undefined && !isLine(o.b))) return E.add(at, 'Unknown line of partition.');
  return bad ? null : { a: o.a, b: o.b ?? o.a };
}

function parsePieces(v: unknown, at: IssueAt, E: Errors): number | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : (E.add(at, '"pieces" must be a whole number of at least 1.') ?? undefined);
}

function parseTincture(v: unknown, what: string, at: IssueAt, E: Errors) {
  return isTincture(v) ? v : E.add(at, `${capitalise(what)} needs one of the eight tinctures.`);
}

/** `inField` paints (the field and its parts) can't be counterchanged or proper. */
function parsePaint(v: unknown, at: IssueAt, E: Errors, inField: boolean, depth = 0): Paint | null {
  if (depth > MAX_DEPTH) return E.add(at, 'The paint is nested too deeply.');
  const sub = (x: unknown) => parsePaint(x, at, E, inField, depth + 1);
  const fixed = (k: 'proper' | 'counterchanged'): Paint | null =>
    inField ? E.add(at, 'A field can\'t be proper or counterchanged.') : { k };
  if (typeof v === 'string') {
    if (isTincture(v)) return { k: 'tincture', t: v };
    if (v === 'counterchanged' || v === 'proper') return fixed(v);
    return E.add(at, `Unknown tincture "${v}".`);
  }
  const o = asObject(v);
  if (!o) return E.add(at, 'A paint must be a tincture name or an object.');
  switch (o.k) {
    case 'tincture': {
      if (E.unknownKeys(o, ['k', 't'], at, 'paint')) return null;
      const t = parseTincture(o.t, 'the paint', at, E);
      return t && { k: 'tincture', t };
    }
    case 'stain':
      if (E.unknownKeys(o, ['k', 'stain'], at, 'paint')) return null;
      return isStain(o.stain) ? { k: 'stain', stain: o.stain } : E.add(at, 'Unknown stain.');
    case 'fur': {
      if (E.unknownKeys(o, ['k', 'fur', 'colours'], at, 'paint')) return null;
      if (!isFur(o.fur)) return E.add(at, 'Unknown fur.');
      if (o.colours === undefined || o.colours === null) return { k: 'fur', fur: o.fur, colours: null };
      const c = o.colours;
      return Array.isArray(c) && c.length === 2 && isTincture(c[0]) && isTincture(c[1])
        ? { k: 'fur', fur: o.fur, colours: [c[0], c[1]] }
        : E.add(at, 'A fur\'s "colours" must be exactly two tinctures.');
    }
    case 'divided': {
      const bad = E.unknownKeys(o, ['k', 'division', 'lines', 'pieces', 'parts'], at, 'paint');
      const lines = parseLines(o.lines, at, E);
      const pieces = parsePieces(o.pieces, at, E);
      if (!isDivision(o.division)) return E.add(at, 'Unknown division.');
      const n = partCount(o.division);
      if (!Array.isArray(o.parts) || o.parts.length !== n) return E.add(at, `A divided paint needs exactly ${n} parts.`);
      const parts = all(o.parts.map(sub));
      return !bad && lines && pieces !== undefined && parts ? { k: 'divided', division: o.division, lines, pieces, parts } : null;
    }
    case 'variation': {
      const bad = E.unknownKeys(o, ['k', 'variation', 'lines', 'pieces', 'parts'], at, 'paint');
      const lines = parseLines(o.lines, at, E);
      const pieces = parsePieces(o.pieces, at, E);
      if (!isVariation(o.variation)) return E.add(at, 'Unknown variation.');
      if (!Array.isArray(o.parts) || o.parts.length !== 2) return E.add(at, 'A varied paint needs exactly 2 parts.');
      const parts = all(o.parts.map(sub));
      return !bad && lines && pieces !== undefined && parts ? { k: 'variation', variation: o.variation, lines, pieces, parts: [parts[0], parts[1]] } : null;
    }
    case 'treated': {
      const bad = E.unknownKeys(o, ['k', 'treatment', 'ground', 'ink'], at, 'paint');
      if (!isTreatment(o.treatment)) return E.add(at, 'Unknown treatment.');
      const ground = sub(o.ground);
      const ink = parseTincture(o.ink, 'the treatment', at, E);
      return !bad && ground && ink ? { k: 'treated', treatment: o.treatment, ground, ink } : null;
    }
    case 'semy': {
      const bad = E.unknownKeys(o, ['k', 'ground', 'charge', 'ink'], at, 'paint');
      const ground = sub(o.ground);
      const charge = asObject(o.charge);
      const ink = sub(o.ink);
      if (!charge) return E.add(at, 'A semy needs a "charge" to strew.');
      const badRef = E.unknownKeys(charge, ['charge', 'form'], at, 'semy charge');
      if (!isChargeId(charge.charge)) return E.add(at, 'Unknown charge.');
      if (charge.form !== undefined && charge.form !== null && !isChargeForm(charge.form)) return E.add(at, 'Unknown charge form.');
      return !bad && !badRef && ground && ink
        ? { k: 'semy', ground, charge: { charge: charge.charge, form: charge.form ?? null }, ink }
        : null;
    }
    case 'proper': case 'counterchanged':
      return E.unknownKeys(o, ['k'], at, 'paint') ? null : fixed(o.k);
    default:
      return E.add(at, 'Unknown kind of paint.');
  }
}

// ── Items ───────────────────────────────────────────────────────────────────

function parseOrdinary(o: Record<string, unknown>, at: IssueAt, E: Errors, depth: number): Ordinary | null {
  const bad = E.unknownKeys(o, ['k', 'type', 'lines', 'mods', 'cotised', 'fimbriated'], at, 'ordinary');
  if (!isOrdinaryType(o.type)) return E.add(at, 'Unknown ordinary.');
  const lines = parseLines(o.lines, at, E);
  let mods: OrdinaryMod[] | null = [];
  if (o.mods !== undefined) {
    mods = Array.isArray(o.mods) && o.mods.every(isOrdinaryMod) ? [...new Set<OrdinaryMod>(o.mods)] : E.add(at, 'Unknown ordinary modifier.');
  }
  let cotised: Cotises | null | undefined = null;
  if (o.cotised !== undefined && o.cotised !== null) {
    const c = asObject(o.cotised);
    const badCotises = c ? E.unknownKeys(c, ['count', 'paint', 'line'], at, 'cotise') : false;
    const paint = c && parsePaint(c.paint, at, E, false, depth + 1);
    if (!c || (c.count !== 1 && c.count !== 2 && c.count !== 3)) E.add(at, 'Cotises come in ones, twos or threes.');
    else if (c.line !== undefined && !isLine(c.line)) E.add(at, 'Unknown line of partition.');
    else cotised = paint && !badCotises ? { count: c.count, paint, line: c.line ?? 'plain' } : undefined;
    if (cotised === null) cotised = undefined;
  }
  let fimbriated: Paint | null | undefined = null;
  if (o.fimbriated !== undefined && o.fimbriated !== null) fimbriated = parsePaint(o.fimbriated, at, E, false, depth + 1) ?? undefined;
  return !bad && lines && mods && cotised !== undefined && fimbriated !== undefined
    ? { k: 'ordinary', type: o.type, lines, mods, cotised, fimbriated }
    : null;
}

function parseModifier(v: unknown, at: IssueAt, E: Errors, depth: number): Modifier | null {
  const o = typeof v === 'string' ? { id: v } : asObject(v);
  if (!o) return E.add(at, 'A modifier must be a name or an object.');
  const bad = E.unknownKeys(o, ['id', 'count', 'paint'], at, 'modifier');
  const { id, count = null, paint: rawPaint = null } = o as Record<string, unknown>;
  if (!isModifierId(id)) return E.add(at, 'Unknown charge modifier.');
  if (count !== null && !(typeof count === 'number' && Number.isInteger(count) && count >= 1)) {
    return E.add(at, 'A modifier\'s "count" must be a whole number of at least 1.');
  }
  const paint = rawPaint === null ? null : parsePaint(rawPaint, at, E, false, depth + 1);
  return bad || (rawPaint !== null && paint === null) ? null : { id, count, paint };
}

function parseCharge(o: Record<string, unknown>, at: IssueAt, E: Errors, depth: number): Charge | null {
  const bad = E.unknownKeys(o, ['k', 'charge', 'form', 'posture', 'facing', 'orientation', 'mods', 'parts', 'holds'], at, 'charge');
  if (!isChargeId(o.charge)) return E.add(at, 'Unknown charge.');
  const meta = CHARGES[o.charge];
  const name = `${capitalise(meta.article)} ${meta.name}`;
  const given = <T>(v: T | undefined | null): v is T => v !== undefined && v !== null;
  let ok = !bad;
  const fail = (message: string) => { ok = false; E.add(at, message); };

  if (given(o.form) && !isChargeForm(o.form)) fail('Unknown charge form.');
  if (given(o.posture) && !isPosture(o.posture)) fail('Unknown posture.');
  else if (given(o.posture) && meta.postures === null) fail(`${name} has no posture.`);
  if (given(o.facing) && !isFacing(o.facing)) fail('Unknown facing.');
  else if (given(o.facing) && meta.defaultFacing === null) fail(`${name} has no facing.`);
  if (given(o.orientation) && !isOrientation(o.orientation)) fail('Unknown orientation.');

  const list = (key: 'mods' | 'parts' | 'holds'): unknown[] => {
    const v = o[key];
    if (v === undefined) return [];
    if (Array.isArray(v)) return v;
    fail(`"${key}" must be a list.`);
    return [];
  };
  const mods = all(list('mods').map((m) => parseModifier(m, at, E, depth)));
  const parts = all(list('parts').map((p): PartPaint | null => {
    const po = asObject(p);
    if (!po) return E.add(at, 'A part must be an object.');
    const badPart = E.unknownKeys(po, ['part', 'paint'], at, 'part');
    if (!isPartId(po.part)) return E.add(at, 'Unknown charge part.');
    const paint = parsePaint(po.paint, at, E, false, depth + 1);
    return paint && !badPart ? { part: po.part, paint } : null;
  }));
  const holds = all(list('holds').map((h): Held | null => {
    const ho = asObject(h);
    if (!ho) return E.add(at, 'A held charge must be an object.');
    const badHold = E.unknownKeys(ho, ['how', 'item', 'paint'], at, 'held charge');
    const item = asObject(ho.item);
    if (!isHoldHow(ho.how)) return E.add(at, 'Unknown way of holding.');
    if (!item || item.k !== 'charge') return E.add(at, 'A held item must be a charge.');
    const held = depth >= MAX_DEPTH ? E.add(at, 'The charges are nested too deeply.') : parseCharge(item, at, E, depth + 1);
    const paint = parsePaint(ho.paint, at, E, false, depth + 1);
    return held && paint && !badHold ? { how: ho.how, item: held, paint } : null;
  }));
  if (!ok || !mods || !parts || !holds) return null;
  return {
    k: 'charge', charge: o.charge, form: o.form ?? null, posture: o.posture ?? meta.defaultPosture, facing: o.facing ?? meta.defaultFacing,
    orientation: o.orientation ?? null, mods, parts, holds,
  } as Charge;
}

function parseItem(v: unknown, at: IssueAt, E: Errors): Item | null {
  const o = asObject(v);
  if (!o) return E.add(at, 'The "item" must be an object.');
  if (o.k === 'ordinary') return parseOrdinary(o, at, E, 0);
  if (o.k === 'charge') return parseCharge(o, at, E, 0);
  return E.add(at, 'The "item" must be an ordinary or a charge.');
}

// ── Arrangement ─────────────────────────────────────────────────────────────

/** The layout an input arrangement names, null when none is given (the default applies), undefined after an error. */
function parseLayout(v: unknown, count: number, at: IssueAt, E: Errors): Layout | null | undefined {
  if (v === undefined || v === null) return null;
  let layout: Layout | null = null;
  if (typeof v === 'string') {
    layout = layoutOfKey(v, count);
    if (!layout) return E.add(at, `Unknown arrangement "${v}".`) ?? undefined;
  } else {
    const o = asObject(v);
    let arrangement: Arrangement | null = null;
    if (o) {
      if (E.unknownKeys(o, ['k', 'dir', 'rows', 'pattern', 'pair'], at, 'arrangement')) return undefined;
      if (o.k === 'single' || o.k === 'host' || o.k === 'crossed') arrangement = { k: o.k };
      else if (o.k === 'line' && oneOf(LINE_DIRS, o.dir)) arrangement = { k: 'line', dir: o.dir };
      else if (o.k === 'rows' && Array.isArray(o.rows) && o.rows.length > 0 && o.rows.every((n) => Number.isInteger(n) && n >= 1)) arrangement = { k: 'rows', rows: [...o.rows] };
      else if (o.k === 'pattern' && oneOf(PATTERNS, o.pattern)) arrangement = { k: 'pattern', pattern: o.pattern };
      else if (o.k === 'pair' && oneOf(PAIRS, o.pair)) arrangement = { k: 'pair', pair: o.pair };
    }
    if (!arrangement) return E.add(at, 'Unknown arrangement.') ?? undefined;
    layout = { arrangement, position: null };
  }
  if (layout.arrangement.k === 'rows' && layout.arrangement.rows.reduce((a, b) => a + b, 0) !== count) {
    return E.add(at, `The rows add up to ${layout.arrangement.rows.reduce((a, b) => a + b, 0)}, not ${count}.`) ?? undefined;
  }
  return layout;
}

// ── Groups ──────────────────────────────────────────────────────────────────

/** A parsed group before roles and defaults are settled. */
interface RawGroup {
  role: Role | null;
  relation: Relation | null;
  item: Item;
  count: number;
  layout: Layout | null;
  position: Position | null;
  paint: Paint;
  charged: RawGroup[];
}

function parseGroup(v: unknown, path: GroupPath, top: boolean, E: Errors): RawGroup | null {
  const at: IssueAt = { k: 'group', path };
  const o = asObject(v);
  if (!o) return E.add(at, 'A group must be an object.');
  let ok = !E.unknownKeys(o, ['role', 'relation', 'item', 'count', 'arrangement', 'position', 'paint', 'charged'], at, 'group');
  const fail = (message: string) => { ok = false; E.add(at, message); };

  let role: Role | null = null;
  if (o.role !== undefined && o.role !== null) {
    if (!oneOf(ROLE_ORDER, o.role)) fail('Unknown role.');
    else if (top && o.role === 'tertiary') fail('Only a group on another group can be tertiary.');
    else if (!top && o.role !== 'tertiary') fail('A group on another group must be tertiary.');
    else role = o.role;
  }
  let relation: Relation | null = null;
  if (o.relation !== undefined && o.relation !== null) {
    if (!oneOf(RELATIONS, o.relation)) fail('Unknown relation.');
    else relation = o.relation;
  }
  let position: Position | null = null;
  if (o.position !== undefined && o.position !== null) {
    if (!oneOf(POSITIONS, o.position)) fail('Unknown position.');
    else position = o.position;
  }
  let count = 1;
  if (o.count !== undefined) {
    if (typeof o.count === 'number' && Number.isInteger(o.count) && o.count >= 1 && o.count <= MAX_COUNT) count = o.count;
    else fail(`The "count" must be a whole number from 1 to ${MAX_COUNT}.`);
  }
  const item = o.item === undefined ? E.add(at, 'A group needs an "item".') : parseItem(o.item, at, E);
  const paint = o.paint === undefined ? E.add(at, 'A group needs a "paint".') : parsePaint(o.paint, at, E, false);
  const layout = parseLayout(o.arrangement, count, at, E);
  if (layout?.position && position && layout.position !== position) fail(`The arrangement puts the group ${layout.position}, but its position is ${position}.`);

  let charged: RawGroup[] | null = [];
  if (o.charged !== undefined) {
    if (!Array.isArray(o.charged)) fail('"charged" must be a list of groups.');
    else if (path.length >= MAX_DEPTH) fail('The groups are nested too deeply.');
    else charged = all(o.charged.map((g, i) => parseGroup(g, [...path, i], false, E)));
  }
  if (!ok || !item || !paint || layout === undefined || !charged) return null;
  return { role, relation, item, count, layout, position: position ?? layout?.position ?? null, paint, charged };
}

/**
 * The role a top-level group has when the input names none (RULES §B.3, SENA App I1): charges beside a central ordinary
 * are secondary, and so are charges in chief, in base or in canton beside a central group of charges — "if you removed
 * the fess the lions would become the primary charge group". Charges in chief with nothing central are primary. A group
 * the input relates to the main one ("between": a lion between three mullets) is secondary.
 */
function inferRole(r: RawGroup, siblings: readonly RawGroup[]): Role {
  if (r.item.k === 'ordinary') return ORDINARY_KIND[r.item.type] === 'peripheral' ? 'peripheral' : 'primary';
  if (r.relation !== null) return 'secondary';
  if (siblings.some((s) => s.item.k === 'ordinary' && ORDINARY_KIND[s.item.type] === 'central' && s.role !== 'overall')) return 'secondary';
  const central = (s: RawGroup) => s !== r && s.item.k === 'charge' && s.position === null && s.relation === null && (s.role === null || s.role === 'primary');
  return isSecondaryPosition(r.position) && siblings.some(central) ? 'secondary' : 'primary';
}

/** The arrangement a group has until `placeGroups` gives it its layout. */
const UNPLACED: Arrangement = { k: 'single' };

function buildGroup(r: RawGroup, role: Role, E: Errors, at: IssueAt): Group {
  if (r.relation !== null && role !== 'secondary') E.add(at, 'Only a secondary group has a relation to the main one.');
  return {
    role, relation: role === 'secondary' ? (r.relation ?? (isSecondaryPosition(r.position) ? 'position' : 'between')) : null, item: r.item, count: r.count,
    arrangement: UNPLACED, position: r.position, paint: r.paint,
    charged: r.charged.map((c, i) => buildGroup(c, 'tertiary', E, at.k === 'group' ? { k: 'group', path: [...at.path, i] } : at)),
  };
}

/**
 * The groups with each arrangement set from the input layout, or Table 7 when the input left it out (judged against `d`,
 * the design with every role, item and paint but not yet the layouts); checks it fits where the group sits.
 */
function placeGroups(d: Design, raws: readonly RawGroup[], groups: readonly Group[], host: Group | null, prefix: GroupPath, E: Errors): Group[] {
  return groups.map((g, i) => {
    const r = raws[i];
    const at: IssueAt = { k: 'group', path: [...prefix, i] };
    const placed = ((): Group => {
      if (r.layout) {
        const ctx = contextOf(d, g, host);
        if (ctx && (ctx.k === 'between' || ctx.k === 'on') && r.layout.arrangement.k !== 'host') E.add(at, 'Charges set around or on an ordinary are placed by it — leave the arrangement out.');
        return { ...g, arrangement: r.layout.arrangement };
      }
      if (r.position) return { ...g, arrangement: g.count === 1 ? { k: 'single' } : { k: 'line', dir: 'fess' } };
      const layout = defaultLayoutOf(d, g, host);
      return { ...g, arrangement: layout.arrangement, position: layout.position };
    })();
    return { ...placed, charged: placeGroups(d, r.charged, g.charged, g, [...prefix, i], E) };
  });
}

export function resolve(input: unknown): ResolveResult {
  const E = new Errors();
  const design: IssueAt = { k: 'design' };
  const o = asObject(input);
  if (!o) return { ok: false, errors: [{ code: 'shape', at: design, message: 'The design must be an object.', slots: [] }] };
  E.unknownKeys(o, ['v', 'kind', 'field', 'groups'], design, 'design');
  if (o.v !== 2) E.add(design, 'Unsupported design version (expected v: 2).');
  const kind = o.kind ?? 'arms';
  if (kind !== 'arms' && kind !== 'badge') E.add(design, 'The design must be arms or a badge.');

  let field: Paint | null = null;
  if (kind === 'arms') {
    field = o.field === undefined || o.field === null ? E.add({ k: 'field' }, 'The field is missing.') : parsePaint(o.field, { k: 'field' }, E, true);
  } else if (kind === 'badge' && o.field !== undefined && o.field !== null) {
    E.add({ k: 'field' }, 'A fieldless badge has no field.');
  }

  let raws: RawGroup[] = [];
  if (o.groups !== undefined) {
    if (!Array.isArray(o.groups)) E.add(design, '"groups" must be a list.');
    else raws = all(o.groups.map((g, i) => parseGroup(g, [i], true, E))) ?? [];
  }
  if (E.list.length > 0) return { ok: false, errors: E.list };

  const groups = raws.map((r, i) => buildGroup(r, r.role ?? inferRole(r, raws), E, { k: 'group', path: [i] }));
  const unplaced: Design = kind === 'badge' ? { v: 2, kind: 'badge', field: null, groups } : { v: 2, kind: 'arms', field: field as Paint, groups };
  const d: Design = { ...unplaced, groups: placeGroups(unplaced, raws, groups, null, [], E) };
  return E.list.length > 0 ? { ok: false, errors: E.list } : { ok: true, design: canonical(d) };
}

