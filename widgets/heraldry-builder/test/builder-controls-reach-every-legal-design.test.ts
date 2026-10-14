// Every builder control, from valid designs in a broad deterministic sweep, offers exactly the values
// some completion makes legal — and every legal charge layout (count, placement, layout) can be reached
// by clicking through the count, placement and layout controls only. The oracle never touches the
// option helpers or the builder: for each field × ordinary × picture it builds the design from loose
// input, brute-forces the phase-A simple space (count 1–12 × placement × every layout key) through
// `normalise` and the rule of tincture, and calls a layout legal when the design resolves, is
// supported, passes the structure rules and some tincture satisfies the rule of tincture (which also
// reports charges Table 7 would force into one part of the field as a gap: a tincture-dependent one).

import { describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, DRAWN_DIVISIONS, DRAWN_ORDINARIES, TINCTURES, addLayer, countChoices, fieldTinctureChoices, groupTinctureChoices, layerChoices, layerPath, layoutChoices,
  layoutKey, modifierChoices, normalise, placementChoices, postureChoices, resolve, structuralIssues, tinctureIssues, unsupportedIssues,
  type ChargeId, type Design, type GroupPath, type LayerKey,
} from '../src/lib/heraldry';
import { ordinaryPath, picturePath, setCharge } from '../src/lib/builder';
import { layoutMoves, log, nd, setCount } from './helpers';

// ── The oracle: the level-0 space by brute force ────────────────────────────
//
// The space is one ordinary, one picture group and the group on the ordinary, with a chief and/or a bordure
// beside the ordinary in some of the contexts (`beside`); the oracle builds those from loose input too.

type Placement = 'field' | 'ordinary';

/** Every layout key a group of up to twelve can have (`host` stands for "leave the arrangement out"). */
const ALL_LAYOUT_KEYS: readonly string[] = [
  'single', 'in-chief', 'in-base', 'in-pale', 'in-fess', 'in-bend', 'in-bend-sinister', 'in-cross', 'in-saltire', 'in-orle', 'in-annulo', 'crossed',
  'rows-2-1', 'rows-2-2', 'rows-2-2-1', 'rows-3-2-1', 'rows-3-3-1', 'rows-3-3-2', 'rows-3-3-3', 'rows-4-3-2-1', 'rows-4-4-3', 'rows-4-4-4',
  'rows-1-2', 'rows-3-2', 'rows-2-2-2', 'rows-3-3', 'rows-4-4', 'rows-4-3-2', 'rows-1-1-1',
];
const PAINTS: readonly string[] = [...TINCTURES, 'counterchanged'];

interface Base {
  field: unknown;
  /** The field's division, or 'plain'. */
  division: string;
  ordinary: { type: string; tincture: string } | null;
  /** The peripherals set beside the ordinary (all in `besidePaint`), none unless the ordinary is a central one or a chief. */
  beside: readonly string[];
  besidePaint: string;
  charge: ChargeId;
  posture: string | null;
}

interface Triple { count: number; placement: Placement; key: string }

const tripleKey = (t: Triple) => `${t.count}/${t.placement}/${t.key}`;

/** Whether the count can possibly have this layout key: the rows add up, a cross has four or five, and so on. */
function countFits(key: string, n: number): boolean {
  if (key === 'single') return n === 1;
  if (key === 'in-cross' || key === 'in-saltire') return n === 4 || n === 5;
  if (key === 'crossed') return n === 2;
  const rows = /^rows-(.*)$/.exec(key)?.[1];
  return rows ? rows.split('-').map(Number).reduce((a, b) => a + b, 0) === n : true;
}

const centralOrdinary = (b: Base) => b.ordinary !== null && !['chief', 'bordure'].includes(b.ordinary.type);

/** The layout keys to try: charges around or on an ordinary are placed by it (the arrangement is left out), the rest are arranged. */
function keysFor(b: Base, placement: Placement): readonly string[] {
  return placement === 'ordinary' || centralOrdinary(b) ? ['host'] : ALL_LAYOUT_KEYS;
}

function pictureInput(b: Base, count: number, key: string, paint: string): object {
  const item = { k: 'charge', charge: b.charge, ...(b.posture ? { posture: b.posture } : {}) };
  return { item, paint, count, ...(key === 'host' ? {} : { arrangement: key }) };
}

/** Loose design input: the ordinary carries `onOrdinary` when given, and the top-level picture is `onField`. */
function designInput(b: Base, onField: object | null, onOrdinary: object | null): object {
  const groups: object[] = [];
  if (b.ordinary) groups.push({ item: { k: 'ordinary', type: b.ordinary.type }, paint: b.ordinary.tincture, ...(onOrdinary ? { charged: [onOrdinary] } : {}) });
  for (const type of b.beside) groups.push({ item: { k: 'ordinary', type }, paint: b.besidePaint });
  if (onField) groups.push(onField);
  return { v: 2, field: b.field, groups };
}

function triple(b: Base, t: Triple, paint: string): object {
  const picture = pictureInput(b, t.count, t.key, paint);
  return t.placement === 'ordinary' ? designInput(b, null, picture) : designInput(b, picture, null);
}

/** Whether input resolves to a supported design that passes the structure rules, whatever the rule of tincture says. */
function structurallyLegal(input: unknown): boolean {
  const r = resolve(input);
  return r.ok && unsupportedIssues(r.design).length === 0 && structuralIssues(r.design).length === 0;
}

/** Structure verdicts don't depend on tinctures, so they are shared by every base of the same shape. */
const structureMemo = new Map<string, boolean>();

function structureVerdict(b: Base, t: Triple): boolean {
  return structurallyLegal(triple(b, t, 'or'));
}

function structureLegal(b: Base, t: Triple): boolean {
  const k = JSON.stringify([b.division, b.ordinary?.type, b.beside, t.placement, t.count, t.key, t.key === 'crossed' && CHARGES[b.charge].long, t.key === 'in-annulo' && CHARGES[b.charge].postureClass === 'fish']);
  let v = structureMemo.get(k);
  if (v === undefined) {
    v = structureVerdict(b, t);
    structureMemo.set(k, v);
  }
  return v;
}

const resolved = (b: Base, t: Triple, paint: string): Design => nd(triple(b, t, paint));

/** The picture paints that satisfy the rule of tincture in a layout that is structurally legal. */
const legalPaints = (b: Base, t: Triple): string[] => PAINTS.filter((p) => tinctureIssues(resolved(b, t, p)).length === 0);

/** Every (count, placement, layout) that makes a legal design with some picture tincture. */
function legalTriples(b: Base): Triple[] {
  const out: Triple[] = [];
  for (const placement of b.ordinary ? (['field', 'ordinary'] as const) : (['field'] as const)) {
    for (let count = 1; count <= 12; count++) {
      for (const key of keysFor(b, placement)) {
        const t = { count, placement, key };
        if (countFits(key, count) && structureLegal(b, t) && PAINTS.some((p) => tinctureIssues(resolved(b, t, p)).length === 0)) out.push(t);
      }
    }
  }
  return out;
}

// ── The sweep ───────────────────────────────────────────────────────────────

// Three plain fields (a metal, a colour, celestine) and every division in metal/colour, colour/metal, colour/colour and
// metal/metal pairs; no ordinary, or each of the ten in argent and gules.
const FIELDS: Array<{ field: unknown; division: string }> = [
  ...['or', 'azure', 'celestine'].map((t) => ({ field: t, division: 'plain' })),
  ...DRAWN_DIVISIONS.flatMap((division) => [['or', 'azure'], ['gules', 'argent'], ['azure', 'vert'], ['or', 'argent']]
    .map((parts) => ({ field: { k: 'divided', division, parts }, division }))),
];
const ORDINARIES: Array<Base['ordinary']> = [null, ...DRAWN_ORDINARIES.flatMap((type) => ['argent', 'gules'].map((tincture) => ({ type, tincture })))];

interface Context { base: Base; legal: Triple[] }

/** The peripherals beside a band: a third of the contexts have a chief, a bordure or both beside a central band, or a bordure beside a chief. */
function besideOf(ordinary: Base['ordinary'], n: number): Pick<Base, 'beside' | 'besidePaint'> {
  const besidePaint = n % 2 === 0 ? 'argent' : 'gules';
  if (!ordinary || n % 3 !== 1) return { beside: [], besidePaint };
  if (ordinary.type === 'chief') return { beside: ['bordure'], besidePaint };
  if (ordinary.type === 'bordure') return { beside: [], besidePaint };
  return { beside: [['chief'], ['bordure'], ['chief', 'bordure']][Math.floor(n / 3) % 3], besidePaint };
}

/** The bases that are legal designs once a picture is added, the charge and its posture rotating. */
function sweep(): Context[] {
  const out: Context[] = [];
  let n = 0;
  for (const { field, division } of FIELDS) for (const ordinary of ORDINARIES) {
    const charge = CHARGE_IDS[n % CHARGE_IDS.length];
    const postures = CHARGES[charge].postures;
    const plain: Base = { field, division, ordinary, beside: [], besidePaint: 'argent', charge, posture: postures ? postures[n % postures.length] : null };
    // An ordinary that breaks the rule of tincture on this field never makes a valid design; neither does a peripheral that does (then the context has none).
    if (tinctureIssues(nd(designInput(plain, null, null))).length) continue;
    const besides: Base = { ...plain, ...besideOf(ordinary, n) };
    const base = tinctureIssues(nd(designInput(besides, null, null))).length ? plain : besides;
    out.push({ base, legal: legalTriples(base) });
    n++;
  }
  return out;
}

const contexts = sweep();

/** A few legal layouts spread over the list, the first among them. */
function spread<T>(xs: readonly T[], n: number): T[] {
  return [...new Set(Array.from({ length: Math.min(n, xs.length) }, (_, i) => Math.floor((i * xs.length) / Math.min(n, xs.length))))].map((i) => xs[i]);
}

interface State { design: Design; path: GroupPath; triple: Triple; paint: string }

/** Where the picture is, found from the loose structure alone. */
function pictureAt(d: Design, placement: Placement): GroupPath {
  const oi = d.groups.findIndex((g) => g.item.k === 'ordinary');
  return placement === 'ordinary' ? [oi, 0] : [d.groups.findIndex((g) => g.item.k === 'charge')];
}

function stateOf(b: Base, t: Triple, paint: string): State {
  const design = resolved(b, t, paint);
  return { design, path: pictureAt(design, t.placement), triple: t, paint };
}

/** Valid states: the layouts of `spread`, each in its first legal tincture. */
function validStates({ base, legal }: Context, n: number): State[] {
  return spread(legal, n).map((t) => stateOf(base, t, legalPaints(base, t)[0]));
}

/** A state whose picture breaks the rule of tincture: the first layout with an illegal tincture, in that tincture. */
function violationState({ base, legal }: Context): State | null {
  for (const t of legal) {
    const bad = PAINTS.find((p) => !legalPaints(base, t).includes(p));
    if (bad) return stateOf(base, t, bad);
  }
  return null;
}

const allowedValues = <T>(choices: Array<{ value: T; allowed: boolean }>) => choices.filter((c) => c.allowed).map((c) => c.value);
const sameSet = <T>(a: T[]) => [...new Set(a)].map(String).sort();

/** A state's (count, placement, layout key) as the design says it. */
function tripleOf(d: Design, path: GroupPath): Triple {
  let g = d.groups[path[0]];
  for (const i of path.slice(1)) g = g.charged[i];
  const key = g.arrangement.k === 'host' ? 'host' : layoutKey({ arrangement: g.arrangement, position: g.position });
  return { count: g.count, placement: path.length > 1 ? 'ordinary' : 'field', key };
}

describe('builder controls never lock a legal value away', () => {
  const valid = contexts.flatMap((c) => validStates(c, 4).map((s) => ({ c, s })));
  const violations = contexts.flatMap((c) => { const s = violationState(c); return s ? [{ c, s }] : []; });

  it('covers a broad sweep of the simple space', () => {
    const perCount = new Map<number, number[]>();
    for (const { legal } of contexts) {
      for (let n = 1; n <= 12; n++) {
        const at = legal.filter((t) => t.count === n).length;
        perCount.set(n, [...(perCount.get(n) ?? []), at]);
      }
    }
    const summary = [...perCount].map(([n, xs]) => `${n}: ${Math.min(...xs)}–${Math.max(...xs)}`).join(', ');
    log(`${contexts.length} field × ordinary contexts, ${valid.length} valid designs, ${violations.length} rule-of-tincture violations`);
    log(`legal layouts per count (placements together): ${summary}`);
    expect(contexts.length).toBeGreaterThan(300);
    expect(contexts.filter(({ base }) => base.beside.length > 0).length).toBeGreaterThan(50);
    expect(new Set(valid.map(({ c }) => c.base.charge)).size).toBe(CHARGE_IDS.length);
    expect(violations.length).toBeGreaterThan(300);
    // The oracle is not vacuous: every count is legal somewhere.
    for (let n = 1; n <= 12; n++) expect(contexts.some(({ legal }) => legal.some((t) => t.count === n)), `count ${n}`).toBe(true);
    // The oracle is not vacuous: every layout key but a few is legal somewhere.
    const never = ALL_LAYOUT_KEYS.filter((key) => !contexts.some(({ legal }) => legal.some((t) => t.key === key)));
    log(`layout keys that are legal nowhere: ${never.join(', ')}`);
    // Eight in two rows of four, nine and twelve in rows of three and four are too wide for any shield; three singles in rows isn't a pattern.
    expect(never).toEqual(['rows-3-3-3', 'rows-4-4-4', 'rows-4-4', 'rows-1-1-1']);
    // Sampled structure verdicts don't depend on the tinctures they were memoised from.
    for (const { base, legal } of contexts.filter((_, i) => i % 40 === 0)) {
      for (const t of spread(legal, 3)) expect(structureVerdict(base, t), JSON.stringify([base, t])).toBe(true);
    }
  });

  it('every control offers exactly the values some completion makes legal, and something other than the current one unless only one is', () => {
    let checked = 0;
    for (const { c, s } of [...valid, ...violations]) {
      const { design: d, path, triple: here } = s;
      const label = JSON.stringify([c.base, s.triple, s.paint]);
      expect(picturePath(d), label).toEqual(path);
      expect(tripleOf(d, path), label).toEqual(here);
      // Count and placement: allowed exactly when some partner, layout and tincture make them legal.
      const counts = allowedValues(countChoices(d, path));
      expect(sameSet(counts), label).toEqual(sameSet(c.legal.map((t) => t.count)));
      const placements = allowedValues(placementChoices(d, path));
      expect(sameSet(placements), label).toEqual(sameSet(c.legal.map((t) => t.placement)));
      // Layout: allowed exactly when some tincture makes it legal at this count and placement.
      const legalHere = c.legal.filter((t) => t.count === here.count && t.placement === here.placement).map((t) => t.key);
      const layouts = layoutChoices(d, path);
      const offered = layouts.mode === 'choose' ? allowedValues(layouts.choices) : [here.key];
      expect(sameSet(offered), label).toEqual(sameSet(legalHere));
      if (layouts.mode !== 'choose') expect(legalHere, label).toEqual([here.key]);
      // Posture: the ones the charge is drawn in. Modifiers: the ones it is drawn with.
      expect(sameSet(allowedValues(postureChoices(d, path))), label).toEqual(sameSet([...(CHARGES[c.base.charge].postures ?? [])]));
      expect(sameSet(allowedValues(modifierChoices(d, path))), label).toEqual(sameSet([...CHARGES[c.base.charge].mods]));
      // Tincture: the ones the rule of tincture allows here.
      const paints = allowedValues(groupTinctureChoices(d, path));
      expect(sameSet(paints), label).toEqual(sameSet(legalPaints(c.base, here)));
      for (const [values, current] of [[counts, here.count], [placements, here.placement], [offered, here.key], [paints, s.paint]] as const) {
        const others = (values as readonly unknown[]).filter((v) => v !== current);
        expect(others.length > 0 || (values as readonly unknown[]).length === 1, label).toBe(true);
      }
      checked++;
    }
    log(`checked count, placement, layout, pose, modifier and tincture options on ${checked} designs`);
  }, 60_000);

  it('the lower layers always offer another value, and the picture can always be swapped', () => {
    for (const { c, s } of valid) {
      const { design: d } = s;
      const label = JSON.stringify([c.base, s.triple, s.paint]);
      const parts = c.base.division === 'plain' ? ([0] as const) : ([0, 1] as const);
      for (const part of parts) {
        const current = c.base.division === 'plain' ? String(c.base.field) : (c.base.field as { parts: string[] }).parts[part];
        const other = c.base.division === 'plain' ? null : (c.base.field as { parts: string[] }).parts[part === 0 ? 1 : 0];
        const allowed = allowedValues(fieldTinctureChoices(d, part));
        expect(sameSet(allowed), label).toEqual(sameSet(TINCTURES.filter((t) => t !== other)));
        expect(allowed.some((t) => t !== current), label).toBe(true);
      }
      const ordinary = ordinaryPath(d);
      if (c.base.ordinary && ordinary) {
        const alone = (paint: string) => tinctureIssues(nd(designInput({ ...c.base, ordinary: { ...c.base.ordinary!, tincture: paint } }, null, null))).length === 0;
        const allowed = allowedValues(groupTinctureChoices(d, ordinary));
        expect(sameSet(allowed), label).toEqual(sameSet(PAINTS.filter(alone)));
        expect(allowed.some((t) => t !== c.base.ordinary!.tincture), label).toBe(true);
      }
      const other = CHARGE_IDS.find((id) => id !== c.base.charge)!;
      const swapped = setCharge(d, 'picture', other);
      const at = picturePath(swapped);
      expect(at ? tripleOf(swapped, at).placement : null, label).toBe(s.triple.placement);
      expect(at && JSON.stringify(swapped.groups).includes(`"charge":"${other}"`), label).toBeTruthy();
    }
  }, 30_000);

  /** Layouts reachable from `start` through the count, placement and layout controls, as far as `legal` needs; a move to an illegal layout is a failure. */
  function reach(start: State, legal: ReadonlySet<string>): { seen: Set<string>; expanded: number; stray: string[] } {
    const seen = new Set([tripleKey(tripleOf(start.design, start.path))]);
    const queue: Array<{ design: Design; path: GroupPath }> = [start];
    const stray: string[] = [];
    let expanded = 0;
    for (let s = queue.shift(); s && [...legal].some((k) => !seen.has(k)); s = queue.shift()) {
      expanded++;
      for (const { design } of layoutMoves(s.design, s.path)) {
        const path = picturePath(design);
        if (!path) {
          stray.push('the picture went missing');
          continue;
        }
        const k = tripleKey(tripleOf(design, path));
        if (!legal.has(k)) stray.push(k);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ design, path });
        }
      }
    }
    return { seen, expanded, stray };
  }

  it('every legal count, placement and layout is reachable through the controls from valid designs', () => {
    let expanded = 0, starts = 0;
    for (const c of contexts) {
      const legal = new Set(c.legal.map(tripleKey));
      for (const s of validStates(c, 3)) {
        const r = reach(s, legal);
        expect([...legal].filter((k) => !r.seen.has(k)), JSON.stringify([c.base, s.triple])).toEqual([]);
        expect(r.stray, JSON.stringify([c.base, s.triple])).toEqual([]);
        expanded += r.expanded;
        starts++;
      }
    }
    log(`searched from ${starts} starting layouts, expanding ${expanded} designs`);
  }, 60_000);

  it('every legal count, placement and layout is reachable from a design whose picture breaks the rule of tincture', () => {
    for (const { c, s } of violations) {
      const legal = new Set(c.legal.map(tripleKey));
      const r = reach(s, legal);
      expect([...legal].filter((k) => !r.seen.has(k)), JSON.stringify([c.base, s.triple, s.paint])).toEqual([]);
      expect(r.stray, JSON.stringify([c.base, s.triple])).toEqual([]);
    }
  }, 60_000);

  it('extra pictures are offered exactly when some group on the band is legal, and every legal count is reachable', () => {
    let offered = 0, refused = 0;
    for (const c of contexts) {
      if (!c.base.ordinary || !['chief', 'pale', 'fess', 'bend', 'bend-sinister', 'chevron', 'cross', 'saltire', 'pile'].includes(c.base.ordinary.type)) continue;
      const onField = c.legal.find((t) => t.placement === 'field');
      if (!onField) continue;
      const s = stateOf(c.base, onField, legalPaints(c.base, onField)[0]);
      // The oracle: a group of this charge on the ordinary, beside the picture, with some count and tincture.
      const extra = (count: number, paint: string) => ({ item: { k: 'charge', charge: 'rose' }, paint, count });
      const legalCounts = Array.from({ length: 12 }, (_, i) => i + 1).filter((count) => {
        const r = (paint: string) => designInput(c.base, pictureInput(c.base, onField.count, onField.key, s.paint), extra(count, paint));
        return structurallyLegal(r('or')) && PAINTS.some((p) => normalise(r(p)).ok);
      });
      const label = JSON.stringify([c.base, onField]);
      expect(layerChoices(s.design).find((choice) => choice.value === 'on-ordinary')?.allowed, label).toBe(legalCounts.length > 0);
      const added = setCharge(s.design, 'on-ordinary', 'rose');
      if (!legalCounts.length) {
        expect(added, label).toBe(s.design);
        refused++;
        continue;
      }
      offered++;
      const path = layerPath(added, 'on-ordinary');
      expect(path, label).not.toBeNull();
      expect(sameSet(allowedValues(countChoices(added, path!))), label).toEqual(sameSet(legalCounts));
      for (const count of legalCounts) {
        const moved = setCount(added, layerPath(added, 'on-ordinary')!, count);
        const at = layerPath(moved, 'on-ordinary');
        expect(at && moved.groups[at[0]].charged[at[1]].count, `${label} → ${count}`).toBe(count);
      }
    }
    log(`extra pictures offered on ${offered} bases and refused on ${refused}`);
    expect(offered).toBeGreaterThan(100);
  }, 60_000);

  it('a top band or border is offered exactly when some tincture makes it legal beside a central band, and every legal tincture is reachable', () => {
    let offered = 0, refused = 0;
    for (const c of contexts) {
      if (!centralOrdinary(c.base) || c.base.beside.length > 0) continue;
      const band = nd(designInput(c.base, null, null));
      for (const type of ['chief', 'bordure'] as const satisfies readonly LayerKey[]) {
        // The oracle: the band and a peripheral of this kind in each paint, through normalise alone.
        const withPaint = (paint: string) => ({ v: 2, field: c.base.field, groups: [
          { item: { k: 'ordinary', type: c.base.ordinary!.type }, paint: c.base.ordinary!.tincture },
          { item: { k: 'ordinary', type }, paint },
        ] });
        const legalPaintsOf = PAINTS.filter((p) => normalise(withPaint(p)).ok);
        const label = JSON.stringify([c.base, type]);
        expect(layerChoices(band).find((choice) => choice.value === type)?.allowed, label).toBe(legalPaintsOf.length > 0);
        const added = addLayer(band, type);
        if (!legalPaintsOf.length) {
          expect(added, label).toBe(band);
          refused++;
          continue;
        }
        offered++;
        const path = layerPath(added, type);
        expect(path, label).not.toBeNull();
        expect(sameSet(allowedValues(groupTinctureChoices(added, path!))), label).toEqual(sameSet(legalPaintsOf));
        expect(ordinaryPath(added), label).toEqual(ordinaryPath(band));
      }
    }
    log(`top band or border offered on ${offered} bases and refused on ${refused}`);
    expect(offered).toBeGreaterThan(100);
  }, 60_000);
});
