// Structured design model (FINDINGS §4.1): types, structural tables, shape parsing with defaults
// (`resolve`) and the structural rules (`structuralIssues`). The full pipeline including the rule of
// tincture is `normalise()` in validate.ts.

import { CHARGES, isChargeId, isPosture, type ChargeId, type Posture } from './charges';
import { isTincture, TINCTURE_NAME, type Tincture } from './tinctures';

export type Division = 'per-pale' | 'per-fess' | 'per-bend' | 'per-bend-sinister' | 'per-saltire' | 'per-chevron' | 'quarterly';
export const DIVISIONS: readonly Division[] = ['per-pale', 'per-fess', 'per-bend', 'per-bend-sinister', 'per-saltire', 'per-chevron', 'quarterly'];

export type Field =
  | { kind: 'plain'; tincture: Tincture }
  | { kind: 'divided'; division: Division; tinctures: [Tincture, Tincture] }; // t1 ≠ t2, order meaningful

export type OrdinaryType = 'fess' | 'pale' | 'bend' | 'bend-sinister' | 'chevron' | 'cross' | 'saltire' | 'chief' | 'bordure' | 'pile';
export const ORDINARY_TYPES: readonly OrdinaryType[] = ['fess', 'pale', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'chief', 'bordure', 'pile'];

export interface Ordinary { type: OrdinaryType; tincture: Tincture }

export type Arrangement = 'single' | 'forced'
  | 'in-pale' | 'in-fess' | 'in-bend' | 'in-bend-sinister'
  | 'two-and-one' | 'two-and-two' | 'in-cross' | 'in-saltire' | 'three-two-one';
export const ARRANGEMENTS: readonly Arrangement[] = ['single', 'forced', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister',
  'two-and-one', 'two-and-two', 'in-cross', 'in-saltire', 'three-two-one'];

export type Count = 1 | 2 | 3 | 4 | 5 | 6;
export const COUNTS: readonly Count[] = [1, 2, 3, 4, 5, 6];
export type Placement = 'field' | 'ordinary';

/** Input charge group (may omit defaults). */
export interface ChargeGroup {
  charge: ChargeId;
  count: Count;
  placement: Placement;
  arrangement?: Arrangement | null;
  posture?: Posture | null;
  tincture: Tincture;
}

/** Input design (may omit defaults). `kind` is reserved for future badges; only 'arms' is accepted. */
export interface Design {
  v: 1;
  kind?: 'arms';
  field: Field;
  ordinary?: Ordinary | null;
  charges?: ChargeGroup | null;
}

export interface NormChargeGroup {
  charge: ChargeId;
  count: Count;
  placement: Placement;
  arrangement: Arrangement;
  posture: Posture | null;
  tincture: Tincture;
}

/** Every optional field resolved; nulls explicit; canonical key order. */
export interface NormDesign {
  v: 1;
  field: Field;
  ordinary: Ordinary | null;
  charges: NormChargeGroup | null;
}

export type IssueLayer = 'design' | 'field' | 'ordinary' | 'charges';
/**
 * shape     — malformed input (unknown key/id, wrong type)
 * structure — legal ids, illegal combination (count/arrangement/placement, t1 = t2)
 * generic   — plain field alone: a hint while building, a blocker for registration
 * tincture  — rule-of-tincture violation
 */
export type IssueCode = 'shape' | 'structure' | 'generic' | 'tincture';
export interface Issue {
  code: IssueCode;
  layer: IssueLayer;
  message: string;
  /** Slot indices (into chargeSlots()) involved in a charge tincture violation. */
  slots?: number[];
}

// ── Structural tables (§4.1) ────────────────────────────────────────────────

export const DEFAULT_ARR: Record<2 | 3 | 4 | 5 | 6, Arrangement> = {
  2: 'in-pale', 3: 'two-and-one', 4: 'two-and-two', 5: 'in-saltire', 6: 'three-two-one',
};

/** placement 'field', no ordinary or ordinary = bordure. */
export const FIELD_ARR: Record<Count, readonly Arrangement[]> = {
  1: ['single'],
  2: ['in-pale', 'in-fess', 'in-bend', 'in-bend-sinister'],
  3: ['two-and-one', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister'],
  4: ['two-and-two', 'in-cross'],
  5: ['in-saltire', 'in-cross'],
  6: ['three-two-one'],
};

/** placement 'field' with a chief (charges sit in the lower field). */
export const UNDER_CHIEF_ARR: Partial<Record<Count, readonly Arrangement[]>> = {
  1: ['single'], 2: ['in-fess'], 3: ['two-and-one', 'in-fess'],
};

/** placement 'field' with any other ordinary ("between"), arrangement 'forced'. */
export const BETWEEN_COUNTS: Record<Exclude<OrdinaryType, 'chief' | 'bordure'>, readonly Count[]> = {
  fess: [2, 3], pale: [2], bend: [2], 'bend-sinister': [2], chevron: [3], cross: [4], saltire: [4], pile: [2],
};

/** placement 'ordinary' (on it), arrangement 'forced' (or 'single' if 1). */
export const ON_COUNTS: Record<OrdinaryType, readonly Count[]> = {
  fess: [1, 2, 3], pale: [1, 2, 3], bend: [1, 2, 3], 'bend-sinister': [1, 2, 3],
  chevron: [1, 2, 3], chief: [1, 2, 3], pile: [1, 2, 3],
  cross: [1, 5], saltire: [1, 5], bordure: [],
};

// ── Names shared by blazon, gloss and messages ──────────────────────────────

export const DIVISION_NAME: Record<Division, string> = {
  'per-pale': 'Per pale', 'per-fess': 'Per fess', 'per-bend': 'Per bend', 'per-bend-sinister': 'Per bend sinister',
  'per-saltire': 'Per saltire', 'per-chevron': 'Per chevron', quarterly: 'Quarterly',
};

export const ORDINARY_NAME: Record<OrdinaryType, string> = {
  fess: 'fess', pale: 'pale', bend: 'bend', 'bend-sinister': 'bend sinister', chevron: 'chevron',
  cross: 'cross', saltire: 'saltire', chief: 'chief', bordure: 'bordure', pile: 'pile',
};

export const ARRANGEMENT_WORD: Record<Arrangement, string> = {
  single: 'single', forced: 'placed by the ordinary',
  'in-pale': 'in pale', 'in-fess': 'in fess', 'in-bend': 'in bend', 'in-bend-sinister': 'in bend sinister',
  'in-cross': 'in cross', 'in-saltire': 'in saltire', 'two-and-one': 'two and one',
  'two-and-two': 'two and two', 'three-two-one': 'three, two and one',
};

export const NUMBER_WORD: Record<Count, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };

/** Labels for the two tinctures of a divided field, as you look at it (§4.1 t1/t2 table). */
export const DIVISION_PART_LABEL: Record<Division, [string, string]> = {
  'per-pale': ['Left (dexter)', 'Right (sinister)'],
  'per-fess': ['Top (chief)', 'Bottom (base)'],
  'per-bend': ['Upper right', 'Lower left'],
  'per-bend-sinister': ['Upper left', 'Lower right'],
  'per-saltire': ['Top and bottom', 'Left and right'],
  'per-chevron': ['Above the chevron line', 'Below'],
  quarterly: ['1st and 4th quarters (top-left, bottom-right)', '2nd and 3rd quarters'],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function isDivision(v: unknown): v is Division {
  return typeof v === 'string' && (DIVISIONS as readonly string[]).includes(v);
}
export function isOrdinaryType(v: unknown): v is OrdinaryType {
  return typeof v === 'string' && (ORDINARY_TYPES as readonly string[]).includes(v);
}
export function isArrangement(v: unknown): v is Arrangement {
  return typeof v === 'string' && (ARRANGEMENTS as readonly string[]).includes(v);
}
export function isCount(v: unknown): v is Count {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;
}

/** Field tinctures in positional order: [t] or [t1, t2]. */
export function fieldTinctures(field: Field): Tincture[] {
  return field.kind === 'plain' ? [field.tincture] : [field.tinctures[0], field.tinctures[1]];
}

/** 'plain' or the division id. */
export function fieldDivision(field: Field): 'plain' | Division {
  return field.kind === 'plain' ? 'plain' : field.division;
}

/** Ordinaries that charges on the field are set "between" (everything except chief and bordure). */
export function isBetweenOrdinary(type: OrdinaryType): type is keyof typeof BETWEEN_COUNTS {
  return type !== 'chief' && type !== 'bordure';
}

/**
 * Where a charge group sits, which selects both the legal counts/arrangements and the slot table:
 * field (no ordinary), bordure (within), chief (under), between, on.
 */
export type ChargeContext = 'field' | 'bordure' | 'chief' | 'between' | 'on';
export function chargeContext(ordinary: Ordinary | null | undefined, placement: Placement): ChargeContext {
  if (placement === 'ordinary') return 'on';
  if (!ordinary) return 'field';
  if (ordinary.type === 'bordure') return 'bordure';
  if (ordinary.type === 'chief') return 'chief';
  return 'between';
}

export type BodyKind = 'none' | 'ordOnly' | 'chargesOnly' | 'onOrd' | 'between' | 'withChief' | 'withBordure';
/** Blazon/gloss body shape (§4.4). */
export function bodyKind(nd: NormDesign): BodyKind {
  const o = nd.ordinary, c = nd.charges;
  if (!o && !c) return 'none';
  if (!c) return 'ordOnly';
  if (!o) return 'chargesOnly';
  if (c.placement === 'ordinary') return 'onOrd';
  if (o.type === 'chief') return 'withChief';
  if (o.type === 'bordure') return 'withBordure';
  return 'between';
}

/** Legal arrangements for a placed group (['single'] / ['forced'] when fixed; [] when the count is illegal there). */
export function legalArrangements(ordinary: Ordinary | null | undefined, placement: Placement, count: Count): readonly Arrangement[] {
  if (count === 1) return ['single'];
  const ctx = chargeContext(ordinary, placement);
  if (ctx === 'on' || ctx === 'between') return ['forced'];
  if (ctx === 'chief') return UNDER_CHIEF_ARR[count] ?? [];
  return FIELD_ARR[count];
}

/** Arrangement used when none is given (§4.1 step 3). */
export function defaultArrangement(ordinary: Ordinary | null | undefined, placement: Placement, count: Count): Arrangement {
  if (count === 1) return 'single';
  const ctx = chargeContext(ordinary, placement);
  if (ctx === 'on' || ctx === 'between') return 'forced';
  // PLAN/phase-1 decision: under a chief, two charges default to the only legal arrangement (in fess)
  // rather than DEFAULT_ARR's in-pale; every other count keeps DEFAULT_ARR.
  if (ctx === 'chief') {
    const legal = UNDER_CHIEF_ARR[count];
    if (legal && !legal.includes(DEFAULT_ARR[count])) return legal[0];
  }
  return DEFAULT_ARR[count];
}

/** Words for a count of charges: "a lion", "three mullets". */
export function chargeNoun(id: ChargeId, count: number): string {
  const m = CHARGES[id];
  return count === 1 ? m.name : m.plural;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function countList(counts: readonly number[]): string {
  const words = counts.map((n) => (n === 1 ? 'a single charge' : NUMBER_WORD[n as Count]));
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

// ── Shape parsing + defaults ────────────────────────────────────────────────

export type ResolveResult = { ok: true; design: NormDesign } | { ok: false; errors: Issue[] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function extraKeys(o: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(o).filter((k) => !allowed.includes(k));
}

/**
 * Parse an untrusted design and fill every default (§4.1 normalisation steps 1–4). Fails only on
 * malformed input; structural and tincture rules are checked separately so the UI can still draw
 * and blazon an illegal-but-well-formed design.
 */
export function resolve(input: unknown): ResolveResult {
  const errors: Issue[] = [];
  const err = (layer: IssueLayer, message: string) => errors.push({ code: 'shape', layer, message });
  if (!isObj(input)) return { ok: false, errors: [{ code: 'shape', layer: 'design', message: 'The design must be an object.' }] };
  for (const k of extraKeys(input, ['v', 'kind', 'field', 'ordinary', 'charges'])) err('design', `Unknown design key "${k}".`);
  if (input.v !== 1) err('design', 'Unsupported design version (expected v: 1).');
  if (input.kind !== undefined && input.kind !== 'arms') err('design', 'Only arms are supported (badges are not available yet).');

  // field
  let field: Field | null = null;
  const f = input.field;
  if (!isObj(f)) err('field', 'The field is missing.');
  else if (f.kind === 'plain') {
    for (const k of extraKeys(f, ['kind', 'tincture'])) err('field', `Unknown field key "${k}".`);
    if (!isTincture(f.tincture)) err('field', 'The field needs one of the seven tinctures.');
    else field = { kind: 'plain', tincture: f.tincture };
  } else if (f.kind === 'divided') {
    for (const k of extraKeys(f, ['kind', 'division', 'tinctures'])) err('field', `Unknown field key "${k}".`);
    const ts = f.tinctures;
    if (!isDivision(f.division)) err('field', 'Unknown field division.');
    else if (!Array.isArray(ts) || ts.length !== 2 || !isTincture(ts[0]) || !isTincture(ts[1])) err('field', 'A divided field needs exactly two tinctures.');
    else field = { kind: 'divided', division: f.division, tinctures: [ts[0], ts[1]] };
  } else err('field', 'The field must be plain or divided.');

  // ordinary
  let ordinary: Ordinary | null = null;
  const o = input.ordinary;
  if (o !== undefined && o !== null) {
    if (!isObj(o)) err('ordinary', 'The ordinary must be an object or null.');
    else {
      for (const k of extraKeys(o, ['type', 'tincture'])) err('ordinary', `Unknown ordinary key "${k}".`);
      if (!isOrdinaryType(o.type)) err('ordinary', 'Unknown ordinary.');
      else if (!isTincture(o.tincture)) err('ordinary', 'The ordinary needs one of the seven tinctures.');
      else ordinary = { type: o.type, tincture: o.tincture };
    }
  }

  // charges
  let charges: NormChargeGroup | null = null;
  const c = input.charges;
  if (c !== undefined && c !== null) {
    if (!isObj(c)) err('charges', 'The charges must be an object or null.');
    else {
      for (const k of extraKeys(c, ['charge', 'count', 'placement', 'arrangement', 'posture', 'tincture'])) err('charges', `Unknown charge key "${k}".`);
      const before = errors.length;
      if (!isChargeId(c.charge)) err('charges', 'Unknown charge.');
      if (!isCount(c.count)) err('charges', 'The number of charges must be 1 to 6.');
      if (c.placement !== 'field' && c.placement !== 'ordinary') err('charges', 'Charges go on the field or on the ordinary.');
      if (c.arrangement !== undefined && c.arrangement !== null && !isArrangement(c.arrangement)) err('charges', 'Unknown arrangement.');
      if (c.posture !== undefined && c.posture !== null && !isPosture(c.posture)) err('charges', 'Unknown posture.');
      if (!isTincture(c.tincture)) err('charges', 'The charges need one of the seven tinctures.');
      if (errors.length === before) {
        const id = c.charge as ChargeId;
        const meta = CHARGES[id];
        const count = c.count as Count;
        const placement = c.placement as Placement;
        const given = (c.posture ?? null) as Posture | null;
        let posture: Posture | null = null;
        if (meta.postures) {
          posture = given ?? meta.defaultPosture;
          if (posture && !meta.postures.includes(posture)) {
            err('charges', `${cap(meta.article)} ${meta.name} can't be ${posture} here; choose ${meta.postures.join(' or ')}.`);
          }
        } else if (given) {
          err('charges', `${cap(meta.article)} ${meta.name} has no posture.`);
        }
        // count 1 → single; on / between → forced (any given value is ignored); else given ?? default.
        const ctx = chargeContext(ordinary, placement);
        const fixed = count === 1 || ctx === 'on' || ctx === 'between';
        const givenArr = (c.arrangement ?? null) as Arrangement | null;
        const arrangement = fixed || !givenArr ? defaultArrangement(ordinary, placement, count) : givenArr;
        charges = { charge: id, count, placement, arrangement, posture, tincture: c.tincture as Tincture };
      }
    }
  }

  if (errors.length || !field) return { ok: false, errors };
  return { ok: true, design: { v: 1, field, ordinary, charges } };
}

// ── Structural rules ────────────────────────────────────────────────────────

/** Structural problems of a resolved design (§4.1 tables and "other structural rules"). */
export function structuralIssues(nd: NormDesign): Issue[] {
  const issues: Issue[] = [];
  const add = (layer: IssueLayer, message: string, code: IssueCode = 'structure') => issues.push({ code, layer, message });
  const { field, ordinary, charges } = nd;

  if (field.kind === 'divided' && field.tinctures[0] === field.tinctures[1]) {
    add('field', `A divided field needs two different tinctures — both parts are ${TINCTURE_NAME[field.tinctures[0]]}.`);
  }
  if (field.kind === 'plain' && !ordinary && !charges) {
    add('design', 'A plain field on its own is too generic to register — add an ordinary or a charge.', 'generic');
  }
  if (charges) {
    const issue = chargeStructureIssue(ordinary, charges.placement, charges.count, charges.arrangement, charges.charge);
    if (issue) add('charges', issue);
  }
  return issues;
}

/**
 * Why a charge placement/count/arrangement is structurally illegal, or null when legal. Phrased so
 * it can double as the reason shown next to a blocked option.
 */
export function chargeStructureIssue(
  ordinary: Ordinary | null | undefined, placement: Placement, count: Count, arrangement: Arrangement, charge?: ChargeId,
): string | null {
  const noun = charge ? chargeNoun(charge, count) : count === 1 ? 'charge' : 'charges';
  if (placement === 'ordinary') {
    if (!ordinary) return 'Add an ordinary first — charges can only sit on an ordinary once there is one.';
    if (ordinary.type === 'bordure') return "Charges can't sit on a bordure in this builder; put them on the field within it.";
    const legal = ON_COUNTS[ordinary.type];
    if (!legal.includes(count)) {
      const extra = ordinary.type === 'cross' || ordinary.type === 'saltire' ? ' (one in the centre, or one on each arm and the centre)' : '';
      return `A ${ORDINARY_NAME[ordinary.type]} can carry ${countList(legal)}${extra}, not ${NUMBER_WORD[count]}.`;
    }
    return null;
  }
  const ctx = chargeContext(ordinary, placement);
  if (ctx === 'between' && ordinary && isBetweenOrdinary(ordinary.type)) {
    const legal = BETWEEN_COUNTS[ordinary.type];
    if (!legal.includes(count)) {
      const name = ORDINARY_NAME[ordinary.type];
      if (count === 1) return `A single charge can't be set between a ${name} — use ${countList(legal)}, or place it on the ${name}.`;
      return `A ${name} is set between ${legal.length === 1 ? 'exactly ' : ''}${countList(legal)} charges, not ${NUMBER_WORD[count]}.`;
    }
    return null;
  }
  if (ctx === 'chief') {
    const legal = UNDER_CHIEF_ARR[count];
    if (!legal) return `Under a chief there is room for at most three charges, not ${NUMBER_WORD[count]}.`;
    if (!legal.includes(arrangement)) {
      return `Under a chief, ${count === 1 ? 'a single charge sits alone' : `${NUMBER_WORD[count]} ${noun} can only be arranged ${legal.map((a) => ARRANGEMENT_WORD[a]).join(' or ')}`}.`;
    }
    return null;
  }
  const legal = FIELD_ARR[count];
  if (!legal.includes(arrangement)) {
    if (count === 1) return 'A single charge sits alone in the centre.';
    return `${cap(NUMBER_WORD[count])} ${noun} can be arranged ${legal.map((a) => ARRANGEMENT_WORD[a]).join(', ')} — not ${ARRANGEMENT_WORD[arrangement]}.`;
  }
  return null;
}
