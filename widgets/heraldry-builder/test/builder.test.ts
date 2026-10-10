// Builder transitions and the lifecycle-state computation (DOM-free), including the
// journey flows the Design tab must support.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN, adjustDesign, assess, chargesClash, companionNote, fixText, isUntouched, readabilityTip, placementLabel, replaceDesign, sameShapedDesign, undoStillOffered, setArrangement, setCharge, setChargeTincture, setCount, setDivision,
  setFieldTincture, setOrdinary, setOrdinaryTincture, setPlacement, setPlainField, setPosture,
} from '../src/lib/builder';
import { computeWidgetState } from '../src/lib/widgetState';
import { nd, plain } from './helpers';
import { blazon, chargeTinctureChoices, countChoices, placementChoices, readability, signature, suggestTinctureFix } from '../src/lib/heraldry';

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
    expect(azure.allowed === false && azure.reason).toMatch(/colour on colour/);
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

  it('dividing, adding a mullet and asking for three no longer dead-ends: counterchanged is the way out', () => {
    let d = setDivision(DEFAULT_DESIGN, 'per-pale');
    expect(blazon(d)).toBe('Per pale Azure and Or');
    d = setCharge(d, 'mullet');
    expect(blazon(d)).toBe('Per pale Azure and Or, a mullet Argent');
    expect(assess(d).status).toBe('valid');
    // Three is offered, because counterchanged works for it…
    expect(countChoices(d).find((c) => c.value === 3)!.allowed).toBe(true);
    d = setCount(d, 3);
    // …the Argent mullets now clash with the Or half, and every plain tincture would clash somewhere…
    expect(assess(d).status).toBe('violation');
    const choices = chargeTinctureChoices(d);
    expect(choices.filter((c) => c.allowed).map((c) => c.value)).toEqual(['counterchanged']);
    // …so the one-click fix counterchanges them.
    const fix = suggestTinctureFix(d)!;
    expect(fix.label).toBe('Counterchange the mullets');
    expect(assess(fix.design).status).toBe('valid');
    expect(blazon(fix.design)).toBe('Per pale Azure and Or, three mullets counterchanged');
    expect(blazon(setChargeTincture(d, 'counterchanged'))).toBe('Per pale Azure and Or, three mullets counterchanged');
  });

  it('making the field plain leaves counterchanged charges in a violation with a fix', () => {
    const d = setPlainField(setChargeTincture(setCount(setCharge(setDivision(DEFAULT_DESIGN, 'per-pale'), 'mullet'), 3), 'counterchanged'));
    expect(assess(d).problems.map((p) => p.message)).toEqual(["Counterchanged needs a divided field: each charge takes the field's other tincture, and a plain field has only one."]);
    expect(assess(suggestTinctureFix(d)!.design).status).toBe('valid');
  });

  it('count choices block structurally illegal counts with a reason', () => {
    const d = setCharge(setOrdinary(DEFAULT_DESIGN, 'chief'), 'mullet');
    const four = countChoices(d).find((c) => c.value === 4)!;
    expect(four.allowed).toBe(false);
    expect(four.allowed === false && four.reason).toMatch(/at most three/);
  });

  it('a lion on a cross can become four lions around it: the count brings the placement along', () => {
    // Or, on a cross Gules a lion rampant Or. A cross carries one or five charges and is set between
    // exactly four, so neither "four" (on the cross) nor "around the cross" (one lion) works alone.
    const d = nd({ v: 1, field: plain('or'), ordinary: { type: 'cross', tincture: 'gules' }, charges: { charge: 'lion', count: 1, placement: 'ordinary', tincture: 'or' } });
    expect(blazon(d)).toBe('Or, on a cross Gules a lion rampant Or');
    const four = countChoices(d).find((c) => c.value === 4)!;
    expect(four).toMatchObject({ allowed: true, companion: { kind: 'placement', placement: 'field' } });
    const around = placementChoices(d).find((c) => c.value === 'field')!;
    expect(around).toMatchObject({ allowed: true, companion: { kind: 'count', count: 4 } });
    const moved = setCount(d, 4);
    expect(moved.charges).toMatchObject({ count: 4, placement: 'field', arrangement: 'forced', tincture: 'or' });
    expect(blazon(moved)).toBe('Or, a cross Gules between four lions rampant Or');
    // Only the layout moves: Or lions now lie on the Or field, which the violation panel offers to fix.
    expect(assess(moved).problems.map((p) => p.layer)).toEqual(['charges']);
    expect(assess(suggestTinctureFix(moved)!.design).status).toBe('valid');
    expect(setPlacement(d, 'field')).toEqual(moved);
    if (!four.allowed || !four.companion || !around.allowed || !around.companion) throw new Error('expected both choices with a companion');
    expect(companionNote(four.design, four.companion, 'offered')).toBe('Moves the lions around the cross; the gold lions would then need a new colour');
    expect(companionNote(around.design, around.companion, 'offered')).toBe('Changes to four lions; the gold lions would then need a new colour');
    const back = countChoices(moved).find((c) => c.value === 1)!;
    if (!back.allowed || !back.companion) throw new Error('expected one lion to go back onto the cross');
    expect(companionNote(back.design, back.companion, 'offered')).toBe('Moves the lion onto the cross');
    expect(chargesClash(back.design)).toBe(false);
    const adjusted = adjustDesign({ design: d, shape: 'round' }, around.design, around.companion);
    expect(adjusted).toEqual({ kind: 'adjusted', previous: { design: d, shape: 'round' }, replacement: { design: moved, shape: 'round' }, note: "Changed to four lions. The gold lions don't stand out on the gold background — pick a new colour below." });
    expect(undoStillOffered(adjusted, { design: moved, shape: 'round' })).toBe(true);
  });

  it('a count or placement note says so when the charges\' colour would then break the rule, and only then', () => {
    // Per pale Or and Gules, a fess Argent between two lions Azure: one lion moves onto the fess,
    // where blue on white is fine.
    const between = nd({ v: 1, field: { kind: 'divided', division: 'per-pale', tinctures: ['or', 'gules'] }, ordinary: { type: 'fess', tincture: 'argent' }, charges: { charge: 'lion', count: 2, placement: 'field', tincture: 'azure' } });
    const one = countChoices(between).find((c) => c.value === 1)!;
    if (!one.allowed || !one.companion) throw new Error('expected one lion to go onto the fess');
    expect(chargesClash(one.design)).toBe(false);
    expect(companionNote(one.design, one.companion, 'offered')).toBe('Moves the lion onto the horizontal band');
    expect(companionNote(one.design, one.companion, 'done')).toBe('Moved the lion onto the horizontal band.');

    // Or, a cross Gules between four lions Gules: one lion moves onto the cross, red on red.
    const around = nd({ v: 1, field: plain('or'), ordinary: { type: 'cross', tincture: 'gules' }, charges: { charge: 'lion', count: 4, placement: 'field', tincture: 'gules' } });
    expect(assess(around).status).toBe('valid');
    const onto = countChoices(around).find((c) => c.value === 1)!;
    if (!onto.allowed || !onto.companion) throw new Error('expected one lion to go onto the cross');
    expect(chargesClash(onto.design)).toBe(true);
    expect(companionNote(onto.design, onto.companion, 'offered')).toBe('Moves the lion onto the cross; the red lion would then need a new colour');
    expect(companionNote(onto.design, onto.companion, 'done')).toBe("Moved the lion onto the cross. The red lion doesn't stand out on the red cross — pick a new colour below.");
    // The fix offered beside Undo is the violation panel's own.
    expect(fixText(suggestTinctureFix(onto.design)!.label)).toBe('Fix: switch the lion to Or');

    // Swapped colours can't follow the charges onto a band.
    const swapped = nd({ v: 1, field: { kind: 'divided', division: 'per-pale', tinctures: ['or', 'gules'] }, ordinary: { type: 'fess', tincture: 'argent' }, charges: { charge: 'lion', count: 2, placement: 'field', tincture: 'counterchanged' } });
    expect(assess(swapped).status).toBe('valid');
    const single = countChoices(swapped).find((c) => c.value === 1)!;
    if (!single.allowed || !single.companion) throw new Error('expected one lion to go onto the fess');
    expect(companionNote(single.design, single.companion, 'offered')).toBe('Moves the lion onto the horizontal band; the lion would then need a new colour');
    expect(companionNote(single.design, single.companion, 'done')).toBe("Moved the lion onto the horizontal band. The lion can't take swapped colours there — pick a new colour below.");
  });

  it('holds the readability tip back while the rule of tincture is broken', () => {
    // Four Or lions moved around a Gules cross on Or: the tip would say to go back to a single lion.
    const d = nd({ v: 1, field: plain('or'), ordinary: { type: 'cross', tincture: 'gules' }, charges: { charge: 'lion', count: 1, placement: 'ordinary', tincture: 'or' } });
    const moved = setCount(d, 4);
    const r = readability(moved);
    expect(r.nudge).toBe('Try a single lion instead of four');
    expect(readabilityTip(r, assess(moved))).toBeNull();
    // Fixed, the same tip comes back.
    const fixed = suggestTinctureFix(moved)!.design;
    expect(assess(fixed).status).toBe('valid');
    expect(readabilityTip(readability(fixed), assess(fixed))).toBe(readability(fixed).nudge);
    expect(readabilityTip(readability(fixed), assess(fixed))).not.toBeNull();
  });

  it('arrangement edits and placement labels', () => {
    let d = setCount(setCharge(DEFAULT_DESIGN, 'mullet'), 3);
    d = setArrangement(d, 'in-fess');
    expect(blazon(d)).toBe('Azure, three mullets in fess Or');
    expect(placementLabel(setOrdinary(d, 'chevron'), 'field')).toBe('Around the peaked band');
    expect(placementLabel(setOrdinary(d, 'chief'), 'field')).toBe('Below the top bar');
    expect(placementLabel(setOrdinary(d, 'bordure'), 'field')).toBe('Within the border');
    expect(placementLabel(setOrdinary(d, 'bend'), 'ordinary')).toBe('On the diagonal band ↘');
  });
});

describe('replacing a design in progress', () => {
  const started = { design: setCharge(DEFAULT_DESIGN, 'lion'), shape: 'heater' as const };
  const example = { design: setCharge(DEFAULT_DESIGN, 'mullet'), shape: 'heater' as const };
  const untouched = { design: DEFAULT_DESIGN, shape: 'heater' as const };

  it('offers Undo with the design it replaces', () => {
    expect(replaceDesign(started, example)).toEqual({ kind: 'replaced', previous: started, replacement: example });
  });

  it('offers Undo when only the shape would be lost', () => {
    const roundDefault = { design: DEFAULT_DESIGN, shape: 'round' as const };
    expect(isUntouched(roundDefault)).toBe(false);
    expect(replaceDesign(roundDefault, example)).toEqual({ kind: 'replaced', previous: roundDefault, replacement: example });
  });

  it('offers nothing when the current design is the untouched default', () => {
    expect(isUntouched(untouched)).toBe(true);
    expect(replaceDesign(untouched, example)).toBeNull();
  });

  it('offers nothing when the replacement is identical to the current design', () => {
    expect(replaceDesign(started, { ...started })).toBeNull();
    expect(sameShapedDesign(started, { design: setCharge(DEFAULT_DESIGN, 'lion'), shape: 'heater' })).toBe(true);
    expect(sameShapedDesign(started, { ...started, shape: 'banner' })).toBe(false);
  });

  it('keeps Undo on offer only while the replacement is unedited', () => {
    const r = replaceDesign(started, example)!;
    expect(undoStillOffered(r, example)).toBe(true);
    expect(undoStillOffered(r, { ...example, shape: 'round' })).toBe(false);
    expect(undoStillOffered(r, { design: setCount(example.design, 2), shape: 'heater' })).toBe(false);
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
