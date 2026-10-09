// Builder transitions and the lifecycle-state computation (DOM-free), including the PLAN §8
// journey flows the Design tab must support.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN, assess, placementLabel, setArrangement, setCharge, setChargeTincture, setCount, setDivision,
  setFieldTincture, setOrdinary, setOrdinaryTincture, setPlacement, setPlainField, setPosture,
} from '../src/lib/builder';
import { computeWidgetState } from '../src/lib/widgetState';
import { blazon, chargeTinctureChoices, countChoices, signature, suggestTinctureFix } from '../src/lib/heraldry';

describe('builder transitions', () => {
  it('starts as a plain Azure field: incomplete with the structural hint', () => {
    const r = assess(DEFAULT_DESIGN);
    expect(r.status).toBe('incomplete');
    expect(r.hint).toMatch(/too generic/);
    expect(r.problems).toEqual([]);
  });

  it('design-valid journey: Azure, bend Or, three unicorns on the bend Vert', () => {
    let d = setOrdinary(DEFAULT_DESIGN, 'bend');
    expect(d.ordinary).toEqual({ type: 'bend', tincture: 'or' });
    d = setCharge(d, 'unicorn');
    // A single charge can't sit between a bend; the group is refitted to the nearest legal count.
    expect(d.charges).toMatchObject({ charge: 'unicorn', count: 2, placement: 'field', arrangement: 'forced', tincture: 'or' });
    d = setPlacement(d, 'ordinary');
    expect(assess(d).status).toBe('violation'); // Or unicorns on an Or bend
    d = setCount(d, 3);
    d = setChargeTincture(d, 'vert');
    expect(assess(d).status).toBe('valid');
    expect(blazon(d)).toBe('Azure, on a bend Or three unicorns rampant Vert');
  });

  it('tincture-violation journey: a lower-layer field change breaks the charges and a fix is offered', () => {
    let d = setFieldTincture(DEFAULT_DESIGN, 0, 'gules');
    d = setCharge(d, 'lion');
    expect(d.charges?.tincture).toBe('or');
    expect(assess(d).status).toBe('valid');
    d = setFieldTincture(d, 0, 'or');
    const r = assess(d);
    expect(r.status).toBe('violation');
    expect(r.problems[0].layer).toBe('charges');
    const fix = suggestTinctureFix(d);
    expect(fix).not.toBeNull();
    expect(assess(fix!.design).status).toBe('valid');
  });

  it('blocked-swatch journey: Azure is blocked for a lion on Gules, with a reason', () => {
    const d = setCharge(setFieldTincture(DEFAULT_DESIGN, 0, 'gules'), 'lion');
    const azure = chargeTinctureChoices(d).find((c) => c.value === 'azure')!;
    expect(azure.allowed).toBe(false);
    expect(azure.reason).toMatch(/colour on colour/);
  });

  it('too-close journey design: Sable, a wolf statant Or within a bordure Argent', () => {
    let d = setFieldTincture(DEFAULT_DESIGN, 0, 'sable');
    d = setOrdinary(d, 'bordure');
    d = setOrdinaryTincture(d, 'argent');
    d = setCharge(d, 'wolf');
    d = setPosture(d, 'statant');
    expect(assess(d).status).toBe('valid');
    expect(blazon(d)).toBe('Sable, a wolf statant Or within a bordure Argent');
  });

  it('dividing keeps the first tincture and picks a different second one; plain restores the first', () => {
    const d = setDivision(DEFAULT_DESIGN, 'per-pale');
    expect(d.field).toEqual({ kind: 'divided', division: 'per-pale', tinctures: ['azure', 'or'] });
    expect(setPlainField(d).field).toEqual({ kind: 'plain', tincture: 'azure' });
    const q = setDivision(d, 'quarterly');
    expect(q.field).toEqual({ kind: 'divided', division: 'quarterly', tinctures: ['azure', 'or'] });
  });

  it('removing the ordinary moves on-ordinary charges back to the field', () => {
    let d = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'mullet');
    d = setPlacement(d, 'ordinary');
    d = setOrdinary(d, null);
    expect(d.charges?.placement).toBe('field');
    expect(signature(d)).toContain('mullet');
  });

  it('a new ordinary keeps an allowed tincture and replaces a blocked one', () => {
    const d = setOrdinary(setFieldTincture(DEFAULT_DESIGN, 0, 'or'), 'pale');
    expect(d.ordinary?.tincture).toBe('gules');
    expect(setOrdinary(d, 'cross').ordinary?.tincture).toBe('gules');
  });

  it('count choices block structurally illegal counts with a reason', () => {
    const d = setCharge(setOrdinary(DEFAULT_DESIGN, 'chief'), 'mullet');
    const four = countChoices(d).find((c) => c.value === 4)!;
    expect(four.allowed).toBe(false);
    expect(four.reason).toMatch(/at most three/);
  });

  it('arrangement edits and placement labels', () => {
    let d = setCount(setCharge(DEFAULT_DESIGN, 'mullet'), 3);
    d = setArrangement(d, 'in-fess');
    expect(blazon(d)).toBe('Azure, three mullets in fess Or');
    expect(placementLabel(setOrdinary(d, 'chevron'), 'field')).toBe('Around the chevron');
    expect(placementLabel(setOrdinary(d, 'chief'), 'field')).toBe('Below the chief');
    expect(placementLabel(setOrdinary(d, 'bordure'), 'field')).toBe('Within the bordure');
    expect(placementLabel(setOrdinary(d, 'bend'), 'ordinary')).toBe('On the bend');
  });
});

describe('computeWidgetState', () => {
  const base = { tab: 'design' as const, design: 'incomplete' as const, checkShown: false, registry: 'loading' as const, yours: 'empty' as const };
  it('maps the design tab', () => {
    expect(computeWidgetState(base)).toBe('ready');
    expect(computeWidgetState({ ...base, design: 'valid' })).toBe('populated');
    expect(computeWidgetState({ ...base, design: 'violation' })).toBe('error');
    expect(computeWidgetState({ ...base, design: 'violation', checkShown: true })).toBe('error');
  });
  it('maps the registry and your-arms tabs', () => {
    expect(computeWidgetState({ ...base, tab: 'registry', registry: 'empty' })).toBe('empty');
    expect(computeWidgetState({ ...base, tab: 'registry', registry: 'error' })).toBe('error');
    expect(computeWidgetState({ ...base, tab: 'yours', yours: 'populated' })).toBe('populated');
  });
});
