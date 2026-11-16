// Every builder control, from every valid design in a broad deterministic sweep, either offers a
// different allowed value or genuinely has only one legal value — and every legal charge layout
// (count, placement, arrangement) can be reached from any valid design by clicking through the
// count, placement and layout controls. "Legal" is worked out by brute force from the structural
// tables and assess(), never from the options helper under test. A sample of designs whose charges
// break the rule of tincture (a count or placement choice can lead there; only the layout moves) is
// held to the same two checks.

import { describe, expect, it } from 'vitest';
import {
  CHARGES, CHARGE_IDS, CHARGE_TINCTURES, COUNTS, DIVISIONS, ORDINARY_TYPES, TINCTURES, arrangementChoices, chargeTinctureChoices,
  countChoices, fieldTinctureChoices, legalArrangements, ordinaryTinctureChoices, placementChoices, postureChoices, tinctureIssues,
  type Arrangement, type ChargeTincture, type Count, type Field, type NormDesign, type Ordinary, type Placement, type Tincture,
} from '../src/lib/heraldry';
import { assess, setCharge } from '../src/lib/builder';
import { layoutMoves } from './helpers';

const PLACEMENTS: readonly Placement[] = ['field', 'ordinary'];

// Plain fields of a metal, a colour and celestine; every division in metal/colour, colour/metal,
// colour/colour and metal/metal pairs. Ordinaries in a metal and a colour.
const FIELDS: Field[] = [
  ...(['or', 'azure', 'celestine'] as Tincture[]).map((tincture): Field => ({ kind: 'plain', tincture })),
  ...DIVISIONS.flatMap((division) => ([['or', 'azure'], ['gules', 'argent'], ['azure', 'vert'], ['or', 'argent']] as [Tincture, Tincture][])
    .map((tinctures): Field => ({ kind: 'divided', division, tinctures }))),
];
const ORDINARIES: Array<Ordinary | null> = [null, ...ORDINARY_TYPES.flatMap((type) => (['argent', 'gules'] as Tincture[]).map((tincture) => ({ type, tincture })))];

type Layout = { count: Count; placement: Placement; arrangement: Arrangement };
const layoutKey = (l: Layout) => `${l.count}/${l.placement}/${l.arrangement}`;

const valid = (d: NormDesign) => assess(d).status !== 'violation';
const sameSet = <T>(a: T[]) => [...new Set(a)].map(String).sort();

/** Charge tinctures that leave the design without a rule-of-tincture problem, by trying each one. */
function legalTinctures(d: NormDesign): ChargeTincture[] {
  return CHARGE_TINCTURES.filter((tincture) => tinctureIssues({ ...d, charges: { ...d.charges!, tincture } }).length === 0);
}

/** Every structurally legal layout on this field and ordinary that some charge tincture makes valid. */
function legalLayouts(base: NormDesign): Layout[] {
  return COUNTS.flatMap((count) => PLACEMENTS.flatMap((placement) => legalArrangements(base.ordinary, placement, count)
    .map((arrangement) => ({ count, placement, arrangement }))
    .filter((l) => CHARGE_TINCTURES.some((tincture) => valid({ ...base, charges: { ...base.charges!, ...l, tincture } })))));
}

/** Layouts reachable from `start` through the count, placement and layout controls, applied by the builder. */
function reachableLayouts(start: NormDesign): Set<string> {
  const seen = new Map<string, NormDesign>([[layoutKey(start.charges!), start]]);
  const queue = [start];
  for (let d = queue.shift(); d; d = queue.shift()) {
    for (const { design: n } of layoutMoves(d)) {
      const k = layoutKey(n.charges!);
      if (!seen.has(k)) {
        seen.set(k, n);
        queue.push(n);
      }
    }
  }
  return new Set(seen.keys());
}

/** Valid designs of the sweep: every field × ordinary × legal layout × legal charge tincture, the charge and posture rotating. */
function sweep(): Array<{ design: NormDesign; legal: Layout[] }> {
  const out: Array<{ design: NormDesign; legal: Layout[] }> = [];
  let n = 0;
  for (const field of FIELDS) for (const ordinary of ORDINARIES) {
    const base: NormDesign = { v: 1, field, ordinary, charges: null };
    // An ordinary that breaks the rule of tincture on this field never makes a valid design.
    if (tinctureIssues(base).length) continue;
    const charge = CHARGE_IDS[n++ % CHARGE_IDS.length];
    const meta = CHARGES[charge];
    const posture = meta.postures ? meta.postures[n % meta.postures.length] : null;
    const withCharge: NormDesign = { ...base, charges: { charge, count: 1, placement: 'field', arrangement: 'single', posture, tincture: 'or' } };
    const legal = legalLayouts(withCharge);
    for (const l of legal) {
      const laid: NormDesign = { ...withCharge, charges: { ...withCharge.charges!, ...l } };
      for (const tincture of legalTinctures(laid)) out.push({ design: { ...laid, charges: { ...laid.charges!, tincture } }, legal });
    }
  }
  return out;
}

/**
 * One design per second (field, ordinary, layout) of the sweep with its charges in a tincture that
 * breaks the rule there: the first one that does, keeping the charge and posture.
 */
function violationSample(designs: Array<{ design: NormDesign; legal: Layout[] }>): Array<{ design: NormDesign; legal: Layout[] }> {
  const starts = new Map<string, { design: NormDesign; legal: Layout[] }>();
  for (const s of designs) {
    const key = JSON.stringify([s.design.field, s.design.ordinary, layoutKey(s.design.charges!)]);
    if (!starts.has(key)) starts.set(key, s);
  }
  return [...starts.values()].filter((_, i) => i % 2 === 0).flatMap(({ design, legal }) => {
    const tincture = CHARGE_TINCTURES.find((t) => !legalTinctures(design).includes(t));
    return tincture ? [{ design: { ...design, charges: { ...design.charges!, tincture } }, legal }] : [];
  });
}

const allowedValues = <T>(choices: Array<{ value: T; allowed: boolean }>) => choices.filter((c) => c.allowed).map((c) => c.value);

describe('builder controls never lock a legal value away', () => {
  const designs = sweep();
  const violations = violationSample(designs);

  it('covers a broad sweep of valid designs', () => {
    const contexts = new Set(designs.map(({ design }) => JSON.stringify([design.field, design.ordinary])));
    const charges = new Set(designs.map(({ design }) => design.charges!.charge));
    console.log(`swept ${designs.length} valid designs over ${contexts.size} field × ordinary combinations, ${charges.size} charges`);
    expect(contexts.size).toBeGreaterThan(300);
    expect(charges.size).toBe(CHARGE_IDS.length);
    expect(designs.length).toBeGreaterThan(7000);
    expect(designs.every(({ design }) => valid(design))).toBe(true);
    console.log(`and ${violations.length} designs whose charges break the rule of tincture`);
    expect(violations.length).toBeGreaterThan(1000);
    expect(violations.every(({ design }) => tinctureIssues(design).some((i) => i.layer === 'charges'))).toBe(true);
  });

  it('every charge control offers exactly the values some completion makes legal, and something other than the current one unless only one is', () => {
    let checked = 0;
    for (const { design: d, legal } of [...designs, ...violations]) {
      const g = d.charges!;
      const label = JSON.stringify(d);
      // Count and placement: allowed exactly when some partner, arrangement and tincture make them legal.
      const counts = allowedValues(countChoices(d));
      expect(sameSet(counts), label).toEqual(sameSet(legal.map((l) => l.count)));
      const placements = allowedValues(placementChoices(d));
      expect(sameSet(placements), label).toEqual(sameSet(legal.map((l) => l.placement)));
      // Layout: allowed exactly when some tincture makes it legal at this count and placement.
      const here = legal.filter((l) => l.count === g.count && l.placement === g.placement).map((l) => l.arrangement);
      const arr = arrangementChoices(d);
      expect(sameSet(arr.mode === 'choose' ? allowedValues(arr.choices) : [g.arrangement]), label).toEqual(sameSet(here));
      // Posture: the ones the charge is drawn in. Tincture: the ones the rule of tincture allows here.
      const postures = allowedValues(postureChoices(d));
      expect(sameSet(postures), label).toEqual(sameSet([...(CHARGES[g.charge].postures ?? [])]));
      const tinctures = allowedValues(chargeTinctureChoices(d));
      expect(sameSet(tinctures), label).toEqual(sameSet(legalTinctures(d)));
      for (const [values, current] of [[counts, g.count], [placements, g.placement], [here, g.arrangement], [tinctures, g.tincture]] as const) {
        const others = (values as readonly unknown[]).filter((v) => v !== current);
        expect(others.length > 0 || (values as readonly unknown[]).length === 1, label).toBe(true);
      }
      checked++;
    }
    console.log(`checked count, placement, layout, pose and tincture options on ${checked} designs`);
  }, 30_000);

  it('the lower layers always offer another value, and the charge can always be swapped', () => {
    for (const { design: d } of designs) {
      const label = JSON.stringify(d);
      const f = d.field;
      const parts = f.kind === 'divided' ? [0, 1] as const : [0] as const;
      for (const part of parts) {
        const current = f.kind === 'plain' ? f.tincture : f.tinctures[part];
        const other = f.kind === 'divided' ? f.tinctures[part === 0 ? 1 : 0] : null;
        const allowed = allowedValues(fieldTinctureChoices(d, part));
        expect(sameSet(allowed), label).toEqual(sameSet(TINCTURES.filter((t) => t !== other)));
        expect(allowed.some((t) => t !== current), label).toBe(true);
      }
      if (d.ordinary) {
        const o = d.ordinary;
        const allowed = allowedValues(ordinaryTinctureChoices(d));
        const legal = TINCTURES.filter((t) => !tinctureIssues({ ...d, ordinary: { ...o, tincture: t }, charges: null }).some((i) => i.layer === 'ordinary'));
        expect(sameSet(allowed), label).toEqual(sameSet(legal));
        expect(allowed.some((t) => t !== o.tincture), label).toBe(true);
      }
      const other = CHARGE_IDS.find((id) => id !== d.charges!.charge)!;
      expect(setCharge(d, other).charges?.charge, label).toBe(other);
    }
  });

  it('every legal count, placement and layout is reachable from every valid design through the controls', () => {
    let pairs = 0, states = 0;
    const byStart = new Map<string, Set<string>>();
    for (const { design: d, legal } of designs) {
      // The options don't depend on the charge's own tincture, pose or kind, so designs that differ
      // only there share one search.
      const key = JSON.stringify([d.field, d.ordinary, layoutKey(d.charges!)]);
      const reached = byStart.get(key) ?? reachableLayouts(d);
      byStart.set(key, reached);
      const missing = legal.map(layoutKey).filter((k) => !reached.has(k));
      expect(missing, JSON.stringify(d)).toEqual([]);
      pairs += new Set(legal.map((l) => `${l.count}/${l.placement}`)).size;
      states += reached.size;
    }
    console.log(`searched from ${byStart.size} distinct starting layouts; ${pairs} (design, legal count+placement) pairs and ${states} reached layouts checked`);
  }, 90_000);

  it('every legal count, placement and layout is reachable from a design whose charges break the rule of tincture', () => {
    for (const { design: d, legal } of violations) {
      const reached = reachableLayouts(d);
      expect(legal.map(layoutKey).filter((k) => !reached.has(k)), JSON.stringify(d)).toEqual([]);
    }
  }, 30_000);
});
