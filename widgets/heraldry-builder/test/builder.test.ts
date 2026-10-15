// Builder transitions (DOM-free), including the journey flows the Design tab must support.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN, adjustDesign, assess, chargesClash, companionNote, fixText, isUntouched,
  issueStep, ordinaryPath, picturePath, placementLabel, readabilityTip, replaceDesign, sameShapedDesign, setCharge,
  setDivision, setFieldTincture, setGroupTincture, setLayout, setModifier, setOrdinary, setOrdinaryTincture, setPlainField,
  setPosture, undoStillOffered,
} from '../src/lib/builder';
import {
  addLayer, blazon, countChoices, groupAt, groupTinctureChoices, layerChoices, layerPath, layoutChoices, placementChoices, postureChoices, readability, removeLayer, setLayerTincture, signature, simpleParts, suggestTinctureFix,
  type Design, type GroupPath, type LayerKey,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary, plain, setCount, setPlacement } from './helpers';

const picture = (d: Design): GroupPath => picturePath(d)!;
const extraPath = (d: Design): GroupPath | null => simpleParts(d).extra?.path ?? null;
const extra = (d: Design): GroupPath => extraPath(d)!;
const canAddExtra = (d: Design): boolean => layerChoices(d).some((c) => c.value === 'on-ordinary' && c.allowed);

describe('builder transitions', () => {
  it('starts as a plain Azure field: incomplete with the structural hint', () => {
    const r = assess(DEFAULT_DESIGN);
    expect(r.status).toBe('incomplete');
    expect(r.hint).toMatch(/too generic/);
    expect(r.problems).toEqual([]);
  });

  it('design-valid journey: Azure, bend Or, three unicorns on the bend Vert', () => {
    let d = setOrdinary(DEFAULT_DESIGN, 'bend');
    expect(groupAt(d, ordinaryPath(d)!).paint).toEqual({ k: 'tincture', t: 'or' });
    d = setCharge(d, 'picture', 'unicorn');
    // A single charge can't be set between a bend; the picture is refitted to the nearest legal count.
    expect(groupAt(d, picture(d))).toMatchObject({ role: 'secondary', relation: 'between', count: 2, arrangement: { k: 'host' }, paint: { k: 'tincture', t: 'or' } });
    d = setPlacement(d, picture(d), 'ordinary');
    expect(groupAt(d, picture(d))).toMatchObject({ role: 'tertiary', count: 2 });
    expect(assess(d).status).toBe('violation'); // Or unicorns on an Or bend
    d = setCount(d, picture(d), 3);
    d = setGroupTincture(d, picture(d), 'vert');
    expect(assess(d).status).toBe('valid');
    expect(blazon(d)).toBe('Azure, on a bend Or three unicorns vert.');
  });

  it('tincture-violation journey: a lower-layer field change breaks the picture and a fix is offered', () => {
    let d = setFieldTincture(DEFAULT_DESIGN, 0, 'gules');
    d = setCharge(d, 'picture', 'lion');
    expect(groupAt(d, picture(d)).paint).toEqual({ k: 'tincture', t: 'or' });
    expect(assess(d).status).toBe('valid');
    d = setFieldTincture(d, 0, 'or');
    const r = assess(d);
    expect(r.status).toBe('violation');
    expect(r.problems[0]).toMatchObject({ code: 'tincture', at: { k: 'group', path: [0] } });
    expect(issueStep(d, r.problems[0])).toBe('picture');
    const fix = suggestTinctureFix(d);
    expect(fix).toMatchObject({ layer: 'group', path: [0] });
    expect(assess(fix!.design).status).toBe('valid');
  });

  it('blocked-swatch journey: Azure is blocked for a lion on Gules, with a reason', () => {
    const d = setCharge(setFieldTincture(DEFAULT_DESIGN, 0, 'gules'), 'picture', 'lion');
    const azure = groupTinctureChoices(d, picture(d)).find((c) => c.value === 'azure')!;
    expect(azure.allowed).toBe(false);
    expect(azure.allowed === false && azure.reason).toMatch(/colour on colour/);
  });

  it('too-close journey design: Sable, a wolf statant Or within a bordure Argent', () => {
    let d = setFieldTincture(DEFAULT_DESIGN, 0, 'sable');
    d = setOrdinary(d, 'bordure');
    d = setOrdinaryTincture(d, 'argent');
    d = setCharge(d, 'picture', 'wolf');
    d = setPosture(d, picture(d), 'statant');
    expect(assess(d).status).toBe('valid');
    expect(blazon(d)).toBe('Sable, a wolf statant Or, a bordure argent.');
  });

  it('dividing keeps the first tincture and picks a different second one; plain restores the first', () => {
    const d = setDivision(DEFAULT_DESIGN, 'per-pale');
    expect(d.kind === 'arms' && d.field).toMatchObject({ k: 'divided', division: 'per-pale', parts: [{ t: 'azure' }, { t: 'or' }] });
    expect(setPlainField(d).kind === 'arms' && setPlainField(d).field).toEqual({ k: 'tincture', t: 'azure' });
    const q = setDivision(d, 'quarterly');
    expect(q.kind === 'arms' && q.field).toMatchObject({ k: 'divided', division: 'quarterly', parts: [{ t: 'azure' }, { t: 'or' }] });
  });

  it('removing the ordinary moves on-ordinary pictures back to the background', () => {
    let d = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'mullet');
    d = setPlacement(d, picture(d), 'ordinary');
    expect(picture(d)).toHaveLength(2);
    d = setOrdinary(d, null);
    expect(picture(d)).toHaveLength(1);
    expect(groupAt(d, picture(d))).toMatchObject({ role: 'primary', relation: null });
    expect(signature(d)).toContain('mullet');
  });

  it('a new ordinary keeps an allowed tincture and replaces a blocked one', () => {
    const d = setOrdinary(setFieldTincture(DEFAULT_DESIGN, 0, 'or'), 'pale');
    expect(groupAt(d, ordinaryPath(d)!).paint).toEqual({ k: 'tincture', t: 'gules' });
    const cross = setOrdinary(d, 'cross');
    expect(groupAt(cross, ordinaryPath(cross)!).paint).toEqual({ k: 'tincture', t: 'gules' });
  });

  it('dividing, adding a mullet and asking for three no longer dead-ends: counterchanged is the way out', () => {
    let d = setDivision(DEFAULT_DESIGN, 'per-pale');
    expect(blazon(d)).toBe('Per pale azure and Or.');
    d = setCharge(d, 'picture', 'mullet');
    expect(blazon(d)).toBe('Per pale azure and Or, a mullet argent.');
    expect(assess(d).status).toBe('valid');
    // Three is offered, because counterchanged works for it…
    expect(countChoices(d, picture(d)).find((c) => c.value === 3)!.allowed).toBe(true);
    d = setCount(d, picture(d), 3);
    // …the Argent mullets now clash with the Or half, and every plain tincture would clash somewhere…
    expect(assess(d).status).toBe('violation');
    const choices = groupTinctureChoices(d, picture(d));
    expect(choices.filter((c) => c.allowed).map((c) => c.value)).toEqual(['counterchanged']);
    // …so the one-click fix counterchanges them.
    const fix = suggestTinctureFix(d)!;
    expect(fix.label).toBe('Counterchange the mullets');
    expect(assess(fix.design).status).toBe('valid');
    expect(blazon(fix.design)).toBe('Per pale azure and Or, three mullets counterchanged.');
    expect(blazon(setGroupTincture(d, picture(d), 'counterchanged'))).toBe('Per pale azure and Or, three mullets counterchanged.');
  });

  it('making the field plain leaves counterchanged pictures in a violation with a fix', () => {
    let d = setCharge(setDivision(DEFAULT_DESIGN, 'per-pale'), 'picture', 'mullet');
    d = setGroupTincture(setCount(d, picture(d), 3), picture(d), 'counterchanged');
    d = setPlainField(d);
    expect(assess(d).problems.map((p) => p.message)).toEqual(["Counterchanged needs a divided field: each charge takes the field's other tincture, and a plain field has only one."]);
    expect(assess(suggestTinctureFix(d)!.design).status).toBe('valid');
  });

  it('count choices block counts that have no layout, with a reason', () => {
    // A cross carries one, four or five charges, or is set between exactly four.
    const placed = setCharge(setOrdinary(DEFAULT_DESIGN, 'cross'), 'picture', 'mullet');
    const d = setPlacement(placed, picture(placed), 'ordinary');
    const two = countChoices(d, picture(d)).find((c) => c.value === 2)!;
    expect(two).toMatchObject({ allowed: false });
    expect(two.allowed === false && two.reason).toMatch(/can carry a single charge, four or five \(.*\), not two/);
    // Under a chief there is room for only so many.
    const chief = setCharge(setOrdinary(DEFAULT_DESIGN, 'chief'), 'picture', 'mullet');
    const crowded = countChoices(chief, picture(chief)).find((c) => c.value === 12)!;
    expect(crowded.allowed).toBe(false);
    expect(crowded.allowed === false && crowded.reason).toMatch(/room|can't be set/);
  });

  it('two lions around a fess can become five on it: the count brings the placement along', () => {
    // Azure, a fess Gules between two lions Or. A fess is set between two, three, four or six, and carries any number,
    // so "five" needs the lions on the fess, and "around the fess" needs a count it can be set between.
    const d = nd(arms(plain('azure'), group(ordinary('fess'), plain('or')), group(charge('lion'), plain('argent'), { count: 2 })));
    expect(blazon(d)).toBe('Azure, a fess Or between two lions argent.');
    const path = picture(d);
    const five = countChoices(d, path).find((c) => c.value === 5)!;
    expect(five).toMatchObject({ allowed: true, companion: { kind: 'placement', placement: 'ordinary' } });
    const moved = setCount(d, path, 5);
    expect(groupAt(moved, picture(moved))).toMatchObject({ role: 'tertiary', count: 5, arrangement: { k: 'host' }, paint: { k: 'tincture', t: 'argent' } });
    expect(blazon(moved)).toBe('Azure, on a fess Or five lions argent.');
    // Only the layout moves: white lions on a gold band is metal on metal, which the violation panel offers to fix.
    expect(chargesClash(moved, picture(moved))).toBe(true);
    // And back: "around the fess" takes the nearest count it can be set between (ties to the lower count).
    const around = placementChoices(moved, picture(moved)).find((c) => c.value === 'field')!;
    expect(around).toMatchObject({ allowed: true, companion: { kind: 'count', count: 4 } });
    expect(setPlacement(moved, picture(moved), 'field')).toEqual(setCount(d, path, 4));
    if (!five.allowed || !five.companion || !around.allowed || !around.companion) throw new Error('expected both choices with a companion');
    expect(companionNote(five.design, five.companion, 'offered')).toBe('Moves the lions onto the horizontal band; the white lions would then need a new colour');
    expect(companionNote(around.design, around.companion, 'offered')).toBe('Changes to four lions');
    const adjusted = adjustDesign({ design: moved, shape: 'round' }, around.design, around.companion);
    expect(adjusted).toEqual({ kind: 'adjusted', previous: { design: moved, shape: 'round' }, replacement: { design: around.design, shape: 'round' }, note: 'Changed to four lions.' });
    expect(adjustDesign({ design: d, shape: 'round' }, five.design, five.companion)).toMatchObject({ note: "Moved the lions onto the horizontal band. The white lions don't stand out on the gold horizontal band — pick a new colour below." });
    expect(undoStillOffered(adjusted, { design: around.design, shape: 'round' })).toBe(true);
    expect(undoStillOffered(adjusted, { design: moved, shape: 'round' })).toBe(false);
  });

  it("a count or placement note says so when the picture's colour would then break the rule, and only then", () => {
    // Per pale Or and Gules, a fess Argent between two lions Azure: one lion moves onto the fess,
    // where blue on white is fine.
    const between = nd(arms(div('per-pale', 'or', 'gules'), group(ordinary('fess'), plain('argent')), group(charge('lion'), plain('azure'), { count: 2 })));
    const one = countChoices(between, picture(between)).find((c) => c.value === 1)!;
    if (!one.allowed || !one.companion) throw new Error('expected one lion to go onto the fess');
    expect(chargesClash(one.design, picture(one.design))).toBe(false);
    expect(companionNote(one.design, one.companion, 'offered')).toBe('Moves the lion onto the horizontal band');
    expect(companionNote(one.design, one.companion, 'done')).toBe('Moved the lion onto the horizontal band.');

    // Or, a cross Gules between four lions Gules: one lion moves onto the cross, red on red.
    const around = nd(arms(plain('or'), group(ordinary('cross'), plain('gules')), group(charge('lion'), plain('gules'), { count: 4 })));
    expect(assess(around).status).toBe('valid');
    const onto = countChoices(around, picture(around)).find((c) => c.value === 1)!;
    if (!onto.allowed || !onto.companion) throw new Error('expected one lion to go onto the cross');
    expect(chargesClash(onto.design, picture(onto.design))).toBe(true);
    expect(companionNote(onto.design, onto.companion, 'offered')).toBe('Moves the lion onto the cross; the red lion would then need a new colour');
    expect(companionNote(onto.design, onto.companion, 'done')).toBe("Moved the lion onto the cross. The red lion doesn't stand out on the red cross — pick a new colour below.");
    // The fix offered beside Undo is the violation panel's own.
    expect(fixText(suggestTinctureFix(onto.design)!.label)).toBe('Fix: switch the lion on the cross to Or');

    // Swapped colours can't follow the pictures onto a band.
    const swapped = nd(arms(div('per-pale', 'or', 'gules'), group(ordinary('fess'), plain('argent')), group(charge('lion'), { k: 'counterchanged' }, { count: 2 })));
    expect(assess(swapped).status).toBe('valid');
    const single = countChoices(swapped, picture(swapped)).find((c) => c.value === 1)!;
    if (!single.allowed || !single.companion) throw new Error('expected one lion to go onto the fess');
    expect(companionNote(single.design, single.companion, 'offered')).toBe('Moves the lion onto the horizontal band; the lion would then need a new colour');
    expect(companionNote(single.design, single.companion, 'done')).toBe("Moved the lion onto the horizontal band. The lion can't take swapped colours there — pick a new colour below.");
  });

  it('holds the readability tip back while the rule of tincture is broken', () => {
    // Five white lions moved onto a gold fess: the tip would point away from the colour fix.
    const d = nd(arms(plain('azure'), group(ordinary('fess'), plain('or')), group(charge('lion'), plain('argent'), { count: 2 })));
    const moved = setCount(d, picture(d), 5);
    expect(assess(moved).status).toBe('violation');
    const r = readability(moved);
    expect(r.nudge).not.toBeNull();
    expect(readabilityTip(r, assess(moved))).toBeNull();
    // Fixed, the same tip comes back.
    const fixed = suggestTinctureFix(moved)!.design;
    expect(assess(fixed).status).toBe('valid');
    expect(readabilityTip(readability(fixed), assess(fixed))).toBe(readability(fixed).nudge);
    expect(readabilityTip(readability(fixed), assess(fixed))).not.toBeNull();
  });

  it('layout edits and placement labels', () => {
    let d = setCount(setCharge(DEFAULT_DESIGN, 'picture', 'mullet'), picture(setCharge(DEFAULT_DESIGN, 'picture', 'mullet')), 3);
    d = setLayout(d, picture(d), 'in-fess');
    expect(blazon(d)).toBe('Azure, in fess three mullets Or.');
    expect(placementLabel(setOrdinary(d, 'chevron'), 'field')).toBe('Around the peaked band');
    expect(placementLabel(setOrdinary(d, 'chief'), 'field')).toBe('Below the top bar');
    expect(placementLabel(setOrdinary(d, 'bordure'), 'field')).toBe('Within the border');
    expect(placementLabel(setOrdinary(d, 'bend'), 'ordinary')).toBe('On the diagonal band ↘');
    expect(placementLabel(d, 'field')).toBe('On the background');
  });

  it('layout controls list the candidates, host-placed pictures have nothing to choose', () => {
    const d = setCount(setCharge(DEFAULT_DESIGN, 'picture', 'mullet'), [0], 3);
    const layouts = layoutChoices(d, picture(d));
    expect(layouts.mode).toBe('choose');
    expect(layouts.mode === 'choose' && layouts.choices.map((c) => c.value)).toContain('rows-2-1');
    const onBand = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'mullet');
    const onFess = setPlacement(onBand, picture(onBand), 'ordinary');
    expect(layoutChoices(onFess, picture(onFess))).toMatchObject({ mode: 'host', note: 'Charges on the fess follow its line.' });
    const single = setCharge(DEFAULT_DESIGN, 'picture', 'mullet');
    expect(layoutChoices(single, picture(single))).toMatchObject({ mode: 'choose' });
  });

  it('counts above six come from More…', () => {
    let d = setCharge(DEFAULT_DESIGN, 'picture', 'mullet');
    const counts = countChoices(d, picture(d));
    expect(counts.map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(counts.find((c) => c.value === 10)!.allowed).toBe(true);
    d = setCount(d, picture(d), 10);
    expect(groupAt(d, picture(d)).count).toBe(10);
    expect(assess(d).status).toBe('valid');
    expect(blazon(d)).toBe('Azure, ten mullets Or.');
  });

  it('postures and the sun in splendour', () => {
    let d = setCharge(DEFAULT_DESIGN, 'picture', 'hare');
    expect(postureChoices(d, picture(d)).map((c) => [c.value, c.allowed])).toEqual([
      ['rampant', false], ['passant', false], ['statant', false], ['sejant', true], ['courant', true],
    ]);
    d = setPosture(d, picture(d), 'courant');
    expect(blazon(d)).toBe('Azure, a hare courant Or.');
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    const choices = postureChoices(lion, picture(lion));
    expect(choices.find((c) => c.value === 'passant')!.allowed).toBe(true);
    expect(choices.some((c) => c.value === 'courant')).toBe(false);
    // Swapping the charge keeps a posture it is drawn in and falls back to the default otherwise.
    expect(groupAt(setCharge(setPosture(lion, picture(lion), 'passant'), 'picture', 'wolf'), [0]).item).toMatchObject({ charge: 'wolf', posture: 'passant' });
    expect(groupAt(setCharge(setPosture(lion, picture(lion), 'sejant'), 'picture', 'wolf'), [0]).item).toMatchObject({ charge: 'wolf', posture: 'passant' });
    let sun = setCharge(DEFAULT_DESIGN, 'picture', 'sun');
    sun = setModifier(sun, picture(sun), 'in-splendour', true);
    expect(blazon(sun)).toBe('Azure, a sun in splendor Or.');
    expect(blazon(setModifier(sun, picture(sun), 'in-splendour', false))).toBe('Azure, a sun Or.');
  });
});

describe('a top band and a border beside the band', () => {
  const band = setOrdinaryTincture(setOrdinary(DEFAULT_DESIGN, 'chevron'), 'argent');
  const allowed = (d: Design, key: LayerKey) => layerChoices(d).find((c) => c.value === key)?.allowed;

  it('are offered beside a band, coloured to work, one of each together, and removed again', () => {
    expect(allowed(DEFAULT_DESIGN, 'bordure')).toBe(false);
    expect(allowed(band, 'chief')).toBe(true);
    const chief = addLayer(band, 'chief');
    expect(blazon(chief)).toBe('Azure, a chevron argent, a chief Or.');
    expect(assess(chief).status).toBe('valid');
    expect(layerChoices(chief).map((c) => c.value)).toEqual(['in-chief', 'in-base', 'in-canton', 'on-ordinary', 'on-chief', 'bordure', 'on-bordure']);
    expect(['in-chief', 'in-base', 'in-canton'].map((k) => allowed(chief, k as LayerKey))).toEqual([false, true, false]);
    expect(issueStep(chief, { code: 'tincture', reason: 'contrast', at: { k: 'group', path: layerPath(chief, 'chief')! }, message: '', slots: [] })).toBe('chief');
    expect(blazon(setLayerTincture(chief, 'chief', 'gules'))).toContain('chief');
    const both = addLayer(chief, 'bordure');
    expect(blazon(both)).toMatch(/^Azure, a chevron argent, a chief and a bordure Or\.$/);
    expect(assess(both).status).toBe('valid');
    expect(both.groups.map((g) => g.item.k === 'ordinary' && g.item.type)).toEqual(['chevron', 'chief', 'bordure']);
    expect(removeLayer(chief, 'chief')).toEqual(band);
    expect(removeLayer(both, 'bordure')).toEqual(chief);
  });

  it('are offered beside pictures too, which are refitted to the room left', () => {
    const pictured = setCharge(band, 'picture', 'crescent');
    expect(groupAt(pictured, picture(pictured))).toMatchObject({ role: 'secondary', count: 2 });
    const bordered = addLayer(pictured, 'bordure');
    expect(blazon(bordered)).toMatch(/a bordure/);
    expect(layerPath(bordered, 'bordure')).not.toBeNull();
    expect(groupAt(bordered, picture(bordered)).item).toMatchObject({ charge: 'crescent' });
    expect(removeLayer(bordered, 'bordure')).toEqual(pictured);
  });

  it('are not offered when the band is one already, or beside a band that is not there', () => {
    expect(allowed(setOrdinary(DEFAULT_DESIGN, 'chief'), 'chief')).toBe(false);
    const chiefBand = setOrdinary(DEFAULT_DESIGN, 'chief');
    expect(addLayer(chiefBand, 'chief')).toBe(chiefBand);
    expect(allowed(chiefBand, 'bordure')).toBe(true);
  });

  it('stay through a change of band; one of the new band\'s kind gives way to it; none is lost without a band', () => {
    const bordered = addLayer(band, 'bordure');
    expect(layerPath(setOrdinary(bordered, 'fess'), 'bordure')).not.toBeNull();
    expect(blazon(setOrdinary(bordered, 'pile'))).toMatch(/pile/);
    const chiefed = addLayer(band, 'chief');
    // A chief chosen as the band replaces the top band: one chief only.
    expect(setOrdinary(chiefed, 'chief').groups.filter((g) => g.item.k === 'ordinary' && g.item.type === 'chief')).toHaveLength(1);
    // With no band the bordure stands in its place (step 2): re-placed, not dropped.
    const alone = setOrdinary(bordered, null);
    expect(alone.groups.map((g) => g.item.k === 'ordinary' && g.item.type)).toEqual(['bordure']);
    expect(ordinaryPath(alone)).toEqual([0]);
  });
});

describe('pictures in chief, in base or in canton beside the band or the picture', () => {
  const chevron = setOrdinaryTincture(setOrdinary(DEFAULT_DESIGN, 'chevron'), 'argent');
  const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
  const allowed = (d: Design, key: LayerKey) => layerChoices(d).find((c) => c.value === key);

  it('are offered beside a band or a picture on the background, with a charge of their own and a colour that works', () => {
    expect(allowed(DEFAULT_DESIGN, 'in-chief')).toMatchObject({ allowed: false, reason: 'Add a band or shape, or a picture on the background, first — pictures along the top stand beside one.' });
    const chief = addLayer(chevron, 'in-chief');
    expect(blazon(chief)).toBe('Azure, a chevron argent and in chief a mullet Or.');
    expect(assess(chief).status).toBe('valid');
    expect(layerPath(chief, 'in-chief')).not.toBeNull();
    const base = addLayer(lion, 'in-base');
    expect(blazon(base)).toBe('Azure, a lion and in base a mullet Or.');
    expect(assess(base).status).toBe('valid');
    expect(issueStep(base, { code: 'tincture', reason: 'contrast', at: { k: 'group', path: layerPath(base, 'in-base')! }, message: '', slots: [] })).toBe('in-base');
    expect(blazon(addLayer(lion, 'in-canton'))).toBe('Azure, a lion and in canton a mullet Or.');
    expect(removeLayer(base, 'in-base')).toEqual(lion);
  });

  it('stand alone: one group beside the main one, and not beside pictures around the band', () => {
    const chief = addLayer(lion, 'in-chief');
    expect(allowed(chief, 'in-base')).toMatchObject({ allowed: false, reason: 'Only one group of pictures can stand beside the main one — remove the others first.' });
    const around = setCharge(chevron, 'picture', 'rose');
    expect(allowed(around, 'in-chief')).toMatchObject({ allowed: false, reason: 'The picture is set around the chevron: pictures can stand around the band or along the top, not both — move the picture onto the band first.' });
  });

  it('take their count and charge like any pictures, and give the picture beside them the room they leave', () => {
    let d = addLayer(lion, 'in-chief');
    const path = () => layerPath(d, 'in-chief')!;
    const three = countChoices(d, path()).find((c) => c.value === 3)!;
    expect(three.allowed).toBe(true);
    d = three.allowed ? three.design : d;
    d = setCharge(d, 'in-chief', 'crescent');
    expect(blazon(d)).toBe('Azure, a lion and in chief three crescents Or.');
    const layouts = layoutChoices(d, path());
    expect(layouts.mode === 'choose' && layouts.choices.map((c) => c.value)).toEqual(['in-chief', 'rows-2-1@chief', 'rows-1-2@chief']);
    expect(layoutChoices(addLayer(lion, 'in-canton'), layerPath(addLayer(lion, 'in-canton'), 'in-canton')!)).toEqual({ mode: 'position', note: 'A single charge in canton stands alone there.' });
    expect(countChoices(d, picture(d)).filter((c) => c.allowed).length).toBeGreaterThan(3);
  });

  it('stay through changes beneath them, and become the picture when nothing is left for them to stand beside', () => {
    const chief = addLayer(chevron, 'in-chief');
    // A new picture goes on the chevron, since pictures around it and in chief can't both be set.
    const pictured = setCharge(chief, 'picture', 'rose');
    expect(blazon(pictured)).toMatch(/^Azure, on a chevron argent a rose \w+ and in chief a mullet Or\.$/);
    expect(layerPath(setOrdinary(chief, 'fess'), 'in-chief')).not.toBeNull();
    // With no band and no picture, the mullet in chief is the picture itself (SENA App I1).
    const alone = setOrdinary(chief, null);
    expect(blazon(alone)).toBe('Azure, in chief a mullet Or.');
    expect(picturePath(alone)).not.toBeNull();
    // A band added beside a picture and pictures in chief makes the picture go around it: the pictures in chief give way.
    const banded = setOrdinary(addLayer(lion, 'in-chief'), 'pale');
    expect(layerPath(banded, 'in-chief')).toBeNull();
  });
});

describe('pictures on a top band and on a border', () => {
  const framed = addLayer(addLayer(setOrdinary(DEFAULT_DESIGN, 'pale'), 'chief'), 'bordure');
  const allowed = (d: Design, key: LayerKey) => layerChoices(d).find((c) => c.value === key)?.allowed;

  it('are offered once the top band or border is there, with a starting charge and the first colour that works', () => {
    expect(allowed(setOrdinary(DEFAULT_DESIGN, 'pale'), 'on-chief')).toBe(false);
    expect(allowed(framed, 'on-chief')).toBe(true);
    expect(allowed(framed, 'on-bordure')).toBe(true);
    const chief = addLayer(framed, 'on-chief');
    expect(groupAt(chief, layerPath(chief, 'on-chief')!)).toMatchObject({ role: 'tertiary', count: 1, arrangement: { k: 'host' } });
    expect(assess(chief).status).toBe('valid');
    const bordure = addLayer(chief, 'on-bordure');
    // The band's colour is carried over "and on a chief" when the top band shares it.
    expect(blazon(bordure)).toMatch(/^Azure, a pale and on a chief Or an? \w+ \w+, on a bordure Or an? \w+ \w+\.$/);
    expect(assess(bordure).status).toBe('valid');
  });

  it('take a charge, a count and a colour, and lay out along the border whatever the count', () => {
    let d = setCharge(framed, 'on-bordure', 'mullet');
    const path = layerPath(d, 'on-bordure')!;
    expect(countChoices(d, path).filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    d = setCount(d, path, 8);
    expect(blazon(d)).toMatch(/on a bordure \w+ eight mullets \w+\.$/);
    expect(layoutChoices(d, layerPath(d, 'on-bordure')!)).toMatchObject({ mode: 'host' });
    expect(blazon(setCharge(d, 'on-bordure', 'rose'))).toMatch(/eight roses/);
    expect(layerPath(setCharge(d, 'on-bordure', null), 'on-bordure')).toBeNull();
  });

  it('are judged against the colour of the border they sit on, not the background', () => {
    const d = addLayer(framed, 'on-bordure');
    const border = groupAt(d, layerPath(d, 'bordure')!).paint;
    const on = layerPath(d, 'on-bordure')!;
    const tincture = border.k === 'tincture' ? border.t : null;
    const same = groupTinctureChoices(d, on).find((c) => c.value === tincture)!;
    expect(same.allowed).toBe(false);
    expect(!same.allowed && same.reason).toMatch(/on the .* bordure/);
    // Azure charges are fine on an Or border though the field behind is azure.
    expect(groupTinctureChoices(setGroupTincture(d, layerPath(d, 'bordure')!, 'or'), on).find((c) => c.value === 'azure')?.allowed).toBe(true);
  });

  it('are kept when the band changes, and go with the top band or border they sit on', () => {
    const carried = setCount(addLayer(addLayer(framed, 'on-chief'), 'on-bordure'), layerPath(addLayer(addLayer(framed, 'on-chief'), 'on-bordure'), 'on-chief')!, 2);
    for (const type of ['fess', 'bend', 'chevron'] as const) {
      const changed = setOrdinary(carried, type);
      expect(layerPath(changed, 'on-chief'), type).not.toBeNull();
      expect(layerPath(changed, 'on-bordure'), type).not.toBeNull();
    }
    expect(layerPath(removeLayer(carried, 'chief'), 'on-chief')).toBeNull();
    expect(layerPath(removeLayer(carried, 'chief'), 'on-bordure')).not.toBeNull();
    // With no band, the chief stands in its place and keeps the pictures on it.
    const alone = setOrdinary(carried, null);
    expect(simpleParts(alone).ordinary?.group.item).toMatchObject({ type: 'chief' });
    expect(simpleParts(alone).picture).toMatchObject({ placement: 'ordinary' });
    expect(layerPath(alone, 'on-bordure')).not.toBeNull();
  });

  it('are the band\'s own pictures when the top band or border is the band itself', () => {
    const border = setOrdinary(DEFAULT_DESIGN, 'bordure');
    expect(allowed(border, 'on-bordure')).toBe(false);
    const pictured = setCharge(border, 'picture', 'mullet');
    expect(groupAt(pictured, picture(pictured))).toMatchObject({ role: 'primary' });
    const on = setPlacement(pictured, picture(pictured), 'ordinary');
    expect(groupAt(on, picture(on))).toMatchObject({ role: 'tertiary' });
    expect(placementLabel(on, 'ordinary')).toBe('On the border');
  });
});

describe('extra pictures on the band', () => {
  it('are offered on a central ordinary or a chief when the picture is on the background', () => {
    const d = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'mullet');
    expect(canAddExtra(d)).toBe(true);
    expect(canAddExtra(setOrdinary(d, 'bordure'))).toBe(true);
    expect(canAddExtra(setOrdinary(d, null))).toBe(false);
    expect(canAddExtra(setPlacement(d, picture(d), 'ordinary'))).toBe(false);
    expect(canAddExtra(setCharge(DEFAULT_DESIGN, 'picture', null))).toBe(false);
    expect(canAddExtra(setCharge(d, 'on-ordinary', 'rose'))).toBe(false);
  });

  it('journey: a fess between mullets with roses on it, then a chief', () => {
    let d = setOrdinary(DEFAULT_DESIGN, 'fess');
    d = setCharge(d, 'picture', 'mullet');
    expect(groupAt(d, picture(d))).toMatchObject({ role: 'secondary', count: 2 });
    d = setCharge(d, 'on-ordinary', 'rose');
    expect(extra(d)).toEqual([0, 0]);
    expect(groupAt(d, extra(d))).toMatchObject({ role: 'tertiary', count: 1 });
    expect(assess(d).status).toBe('valid');
    expect(blazon(d)).toBe('Azure, on a fess between two mullets Or a rose gules.');
    // The extra picture has its own count, as many as fit on the band, and no placement.
    expect(placementChoices(d, extra(d))).toEqual([]);
    expect(countChoices(d, extra(d)).filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2, 3, 4, 5]);
    d = setCount(d, extra(d), 3);
    expect(groupAt(d, extra(d)).count).toBe(3);
    // Swapping and recolouring either picture leaves the other alone.
    d = setCharge(d, 'on-ordinary', 'heart');
    expect(groupAt(d, extra(d)).item).toMatchObject({ charge: 'heart' });
    expect(groupAt(d, picture(d)).item).toMatchObject({ charge: 'mullet' });
    expect(issueStep(d, { code: 'tincture', reason: 'contrast', at: { k: 'group', path: extra(d) }, message: '', slots: [] })).toBe('on-ordinary');
    // Changing the band to a chief keeps both pictures.
    const chief = setOrdinary(d, 'chief');
    expect(groupAt(chief, picture(chief))).toMatchObject({ role: 'primary', relation: null });
    expect(groupAt(chief, extra(chief))).toMatchObject({ role: 'tertiary', count: 3 });
    // Removing the band takes the extra pictures with it; removing them leaves the rest.
    expect(extraPath(setOrdinary(d, null))).toBeNull();
    expect(picturePath(setOrdinary(d, null))).not.toBeNull();
    const removed = removeLayer(d, 'on-ordinary');
    expect(extraPath(removed)).toBeNull();
    expect(groupAt(removed, picture(removed)).item).toMatchObject({ charge: 'mullet' });
    expect(setCharge(d, 'on-ordinary', null)).toEqual(removed);
  });

  it('the picture cannot move onto a band that already carries extra pictures', () => {
    const d = setCharge(setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'mullet'), 'on-ordinary', 'rose');
    const onto = placementChoices(d, picture(d)).find((c) => c.value === 'ordinary')!;
    expect(onto.allowed).toBe(false);
    expect(onto.allowed === false && onto.reason).toMatch(/already carries/);
  });

  it('removing the picture promotes the extra pictures to the picture', () => {
    const d = setCharge(setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'mullet'), 'on-ordinary', 'rose');
    const promoted = setCharge(d, 'picture', null);
    expect(extraPath(promoted)).toBeNull();
    expect(picture(promoted)).toHaveLength(2);
    expect(groupAt(promoted, picture(promoted)).item).toMatchObject({ charge: 'rose' });
  });

  it('a chief on a field divided per fess is valid once a picture crosses the line', () => {
    const bare = setOrdinary(setDivision(DEFAULT_DESIGN, 'per-fess'), 'chief');
    expect(assess(bare).problems.map((p) => p.message)).toEqual(['A chief on a field divided per fess needs a charge across the line (SENA A3D1c).']);
    expect(issueStep(bare, assess(bare).problems[0])).toBe('ordinary');
    // The picture is refitted to one that crosses the line, whichever order the steps are taken in.
    const picked = setCharge(bare, 'picture', 'mullet');
    expect(assess(picked).status).toBe('valid');
    expect(assess(setOrdinary(setCharge(setDivision(DEFAULT_DESIGN, 'per-fess'), 'picture', 'mullet'), 'chief')).status).toBe('valid');
    // Counts with no room under the chief are blocked.
    const counts = countChoices(picked, picture(picked));
    expect(counts.filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('replacing a design in progress', () => {
  const started = { design: setCharge(DEFAULT_DESIGN, 'picture', 'lion'), shape: 'heater' as const };
  const example = { design: setCharge(DEFAULT_DESIGN, 'picture', 'mullet'), shape: 'heater' as const };
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
    expect(sameShapedDesign(started, { design: setCharge(DEFAULT_DESIGN, 'picture', 'lion'), shape: 'heater' })).toBe(true);
    expect(sameShapedDesign(started, { ...started, shape: 'banner' })).toBe(false);
  });

  it('keeps Undo on offer only while the replacement is unedited', () => {
    const r = replaceDesign(started, example)!;
    expect(undoStillOffered(r, example)).toBe(true);
    expect(undoStillOffered(r, { ...example, shape: 'round' })).toBe(false);
    expect(undoStillOffered(r, { design: setCount(example.design, picture(example.design), 2), shape: 'heater' })).toBe(false);
  });
});
