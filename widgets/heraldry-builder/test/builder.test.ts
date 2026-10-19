// Builder transitions (DOM-free), including the journey flows the Design tab must support.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN, adjustDesign, assess, chargesClash, companionNote, fixText, isUntouched,
  issueStep, ordinaryPath, picturePath, placementLabel, readabilityTip, replaceDesign, sameShapedDesign, setCharge,
  setDivision, setFieldTincture, setGroupTincture, setLayout, setModifier, setOrdinary, setOrdinaryTincture, setPlainField,
  setBadge, setPosture, setFacing, setOrientation, setPair, setFieldEdgeSide, setFieldLine, setCotiseLine, setOrdinaryBandPosition, setOrdinaryEdgeSide, setOrdinaryLine, setOrdinaryNumber, setOrdinaryOutline, setOrdinaryToggle, setVariation, setVariationPieces, setVariationTincture, undoStillOffered,
} from '../src/lib/builder';
import {
  addLayer, addedLayerStep, blazon, detailChoices, edgeSideChoices, facingChoices, fimbriationTinctureChoices, gazeChoices, orientationChoices, pairChoices, pointsChoices, pointsOf, tincturePaint, shownLayoutKey, lineChoices, outlineAt, outlineChoices, outlineTinctureChoices, outlineTinctureOf, setOutlineTincture, toggleChoices, countChoices, groupAt, groupTinctureChoices, layerChoices, pathOfPlace, layoutChoices, placementChoices, postureChoices, readability, removeLayer, setLayerTincture, signature, simpleParts, suggestTinctureFix,
  MORE_ORDINARIES, REFUSED_ORDINARIES, layersIn, ordinaryCountChoices, peripheralItemChoices, setPeripheralItem,
  type Charge, type Design, type Division, type GroupPath, type LayerKey,
} from '../src/lib/heraldry';
import { arms, charge, div, group, nd, ordinary, plain, setCount, setPlacement } from './helpers';

const picture = (d: Design): GroupPath => picturePath(d)!;
const onOrdinaryPath = (d: Design): GroupPath | null => simpleParts(d).onOrdinary?.path ?? null;
const extra = (d: Design): GroupPath => onOrdinaryPath(d)!;
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
    // it changes the tincture of the group with the issue alone
    expect(fix!.design.groups.map((g) => g.paint)).toEqual([expect.not.objectContaining(d.groups[0].paint), ...d.groups.slice(1).map((g) => g.paint)]);
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

  it('setDivision keeps a line the new division takes, drops one it doesn\'t', () => {
    const fieldOf = (d: Design) => (d.kind === 'arms' ? d.field : null);
    const wavy = setFieldLine(setDivision(DEFAULT_DESIGN, 'per-pale'), 'wavy');
    expect(fieldOf(wavy)).toMatchObject({ division: 'per-pale', lines: { a: 'wavy', b: 'wavy' } });
    expect(fieldOf(setDivision(wavy, 'per-chevron'))).toMatchObject({ division: 'per-chevron', lines: { a: 'wavy', b: 'wavy' } });
    // Enarched is for per fess, per bend and per chevron only; a ployé line for per chevron only.
    const arched = setFieldLine(setDivision(DEFAULT_DESIGN, 'per-fess'), 'enarched');
    expect(fieldOf(setDivision(arched, 'per-bend'))).toMatchObject({ lines: { a: 'enarched' } });
    expect(fieldOf(setDivision(arched, 'per-pale'))).toMatchObject({ lines: { a: 'plain', b: 'plain' } });
    expect(fieldOf(setDivision(setFieldLine(setDivision(DEFAULT_DESIGN, 'per-chevron'), 'ploye'), 'per-fess'))).toMatchObject({ lines: { a: 'plain' } });
    expect(blazon(setCharge(wavy, 'picture', 'mullet'))).toMatch(/^Per pale wavy /);
  });

  it('keeps the line between stripes, through their count and colours, and drops it when a division or plain colour replaces them', () => {
    const fieldOf = (d: Design) => (d.kind === 'arms' ? d.field : null);
    const barry = setFieldLine(setVariation(DEFAULT_DESIGN, 'barry'), 'wavy');
    expect(fieldOf(barry)).toMatchObject({ k: 'variation', variation: 'barry', lines: { a: 'wavy' } });
    expect(fieldOf(setVariation(barry, 'paly'))).toMatchObject({ variation: 'paly', lines: { a: 'wavy' } });
    expect(fieldOf(setVariationPieces(barry, 8))).toMatchObject({ pieces: 8, lines: { a: 'wavy' } });
    expect(fieldOf(setVariationTincture(barry, 0, 'vert'))).toMatchObject({ lines: { a: 'wavy' } });
    // Chevronny's corners take no line; a division takes the line only where it allows it.
    expect(fieldOf(setVariation(barry, 'chevronny'))).toMatchObject({ lines: { a: 'plain' } });
    expect(setFieldLine(setVariation(DEFAULT_DESIGN, 'chevronny'), 'wavy')).toEqual(setVariation(DEFAULT_DESIGN, 'chevronny'));
    expect(fieldOf(setPlainField(barry))).toMatchObject({ k: 'tincture' });
  });

  it('a quartered field\'s line goes on both lines, or on one of them', () => {
    const fieldOf = (d: Design) => (d.kind === 'arms' ? d.field : null);
    const q = setFieldLine(setDivision(DEFAULT_DESIGN, 'quarterly'), 'embattled');
    expect(fieldOf(q)).toMatchObject({ lines: { a: 'embattled', b: 'embattled' } });
    expect(fieldOf(setFieldEdgeSide(q, 'b'))).toMatchObject({ lines: { a: 'plain', b: 'embattled' } });
    expect(fieldOf(setFieldEdgeSide(q, 'a'))).toMatchObject({ lines: { a: 'embattled', b: 'plain' } });
    expect(fieldOf(setFieldEdgeSide(setFieldEdgeSide(q, 'b'), 'both'))).toMatchObject({ lines: { a: 'embattled', b: 'embattled' } });
    // The side stays when the line changes.
    expect(fieldOf(setFieldLine(setFieldEdgeSide(q, 'b'), 'wavy'))).toMatchObject({ lines: { a: 'plain', b: 'wavy' } });
    // A division with one line has no sides to choose.
    expect(edgeSideChoices(setFieldLine(setDivision(DEFAULT_DESIGN, 'per-pale'), 'wavy'), { k: 'field' })).toEqual([]);
    expect(edgeSideChoices(q, { k: 'field' }).map((c) => c.value)).toEqual(['both', 'a', 'b']);
  });

  it('offers the lines the division takes, in order, and blocks a line the background itself refuses', () => {
    const per = (division: Division) => lineChoices(setDivision(DEFAULT_DESIGN, division), { k: 'field' });
    expect(lineChoices(DEFAULT_DESIGN, { k: 'field' })).toEqual([]);
    const pale = per('per-pale').map((c) => c.value);
    expect(pale.slice(0, 3)).toEqual(['plain', 'embattled', 'wavy']);
    expect(pale).not.toContain('dancetty');
    expect(pale).not.toContain('enarched');
    expect(per('per-chevron').map((c) => c.value)).toEqual(expect.arrayContaining(['enarched', 'ploye']));
    expect(lineChoices(setVariation(DEFAULT_DESIGN, 'barry'), { k: 'field' }).map((c) => c.value)).toContain('dancetty');
    // Azure and sable across a wavy line is a dark pair (App H); a straight line or a metal is fine.
    const dark = setFieldTincture(setFieldTincture(setDivision(DEFAULT_DESIGN, 'per-pale'), 0, 'sable'), 1, 'azure');
    const choices = lineChoices(dark, { k: 'field' });
    expect(choices.find((c) => c.value === 'plain')).toMatchObject({ allowed: true });
    expect(choices.find((c) => c.value === 'wavy')).toMatchObject({ allowed: false });
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

  it('the Details: a star\'s points, voided, fimbriated, pierced and fitchy, refused where SENA A3C and M16 refuse them (PLAN-D §3 D6b)', () => {
    const mullet = setCharge(DEFAULT_DESIGN, 'picture', 'mullet');
    expect(pointsChoices(mullet, picture(mullet)).map((c) => [c.value, c.allowed])).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [n, true]));
    expect(pointsChoices(setCharge(DEFAULT_DESIGN, 'picture', 'roundel'), [0])).toEqual([]);
    expect(detailChoices(mullet, picture(mullet)).map((c) => [c.value, c.allowed])).toEqual([['voided', true], ['fimbriated', true], ['pierced', true]]);
    expect(detailChoices(setCharge(DEFAULT_DESIGN, 'picture', 'cross-formy'), [0]).map((c) => c.value)).toEqual(['fitchy']);
    expect(detailChoices(setCharge(DEFAULT_DESIGN, 'picture', 'lion'), [0])).toEqual([]);
    // the points: the number the star is drawn with is the star as drawn
    const six = setModifier(mullet, picture(mullet), 'of-points', true, { count: 6, paint: null });
    expect(blazon(six)).toBe('Azure, a mullet of six points Or.');
    expect(pointsOf(groupAt(six, [0]).item as Charge)).toBe(6);
    expect(setModifier(six, [0], 'of-points', true, { count: 5, paint: null })).toEqual(mullet);
    expect(blazon(setModifier(six, [0], 'pierced', true))).toBe('Azure, a mullet of six points pierced Or.');
    // a fimbriation is switched on in the first tincture that stands out where the charge lies, and its tincture is blocked where it doesn't
    const edged = setModifier(mullet, [0], 'fimbriated', true);
    expect(blazon(edged)).toBe('Azure, a mullet Or fimbriated argent.');
    expect(fimbriationTinctureChoices(mullet, [0])).toEqual([]);
    expect(fimbriationTinctureChoices(edged, [0]).find((c) => c.value === 'gules')).toEqual({ value: 'gules', allowed: false, reason: 'The fimbriation of the mullet (Gules) lies on Azure: colour on colour' });
    expect(blazon(setModifier(edged, [0], 'fimbriated', true, { count: null, paint: tincturePaint('or') }))).toBe('Azure, a mullet Or fimbriated Or.');
    expect(detailChoices(edged, [0]).find((c) => c.value === 'voided')).toEqual({ value: 'voided', allowed: false, reason: "A mullet can't be both voided and fimbriated: voided, it is read as fimbriated already (SENA A5C1)." });
    expect(setModifier(edged, [0], 'fimbriated', false)).toEqual(mullet);
    // three at most; none voided in a badge
    const four = setCount(mullet, [0], 4);
    expect(detailChoices(four, [0]).filter((c) => !c.allowed).map((c) => c.value)).toEqual(['voided', 'fimbriated']);
    const badge = setCharge(setBadge(DEFAULT_DESIGN), 'picture', 'mullet');
    expect(detailChoices(badge, picture(badge)).find((c) => c.value === 'voided')).toMatchObject({ allowed: false, reason: 'A fieldless badge has no field to show through a voided charge (SENA A3C).' });
    // A swap keeps the details the new charge takes (§0.2.7) and drops the rest.
    const voided = setModifier(six, [0], 'voided', true);
    expect(blazon(setCharge(voided, 'picture', 'lozenge'))).toBe('Azure, a lozenge voided Or.');
    expect(blazon(setCharge(voided, 'picture', 'estoile'))).toBe('Azure, an estoile Or.');
    expect(blazon(setCharge(voided, 'picture', 'sun'))).toBe('Azure, a sun Or.');
  });

  it('the Turned row: as usual first, the ways a charge takes, the rest and to center blocked with their reasons (PLAN-D §3 D5b)', () => {
    const sword = setCharge(DEFAULT_DESIGN, 'picture', 'sword');
    const turns = orientationChoices(sword, picture(sword));
    expect(turns.map((c) => c.value)).toEqual([null, 'palewise', 'fesswise', 'fesswise-reversed', 'bendwise', 'bendwise-inverted', 'bendwise-sinister', 'bendwise-sinister-inverted', 'inverted', 'to-center']);
    expect(turns.filter((c) => !c.allowed).map((c) => c.value)).toEqual(['to-center']);
    expect(orientationChoices(setCharge(DEFAULT_DESIGN, 'picture', 'lion'), [0])).toEqual([]);
    // a mullet looks the same turned any way but upside down
    const mullet = orientationChoices(setCharge(DEFAULT_DESIGN, 'picture', 'mullet'), [0]);
    expect(mullet.find((c) => c.value === 'fesswise')).toMatchObject({ allowed: false, reason: 'A mullet looks the same turned that way.' });
    expect(mullet.find((c) => c.value === 'inverted')!.allowed).toBe(true);
    // to center needs a group; two crossed are not turned at all
    const three = setCount(sword, picture(sword), 3);
    expect(orientationChoices(three, picture(three)).find((c) => c.value === 'to-center')!.allowed).toBe(true);
    const crossed = setLayout(setCount(sword, picture(sword), 2), picture(sword), 'crossed');
    expect(orientationChoices(crossed, picture(crossed)).filter((c) => c.value !== null).every((c) => !c.allowed)).toBe(true);
    // turning and turning back
    const flat = setOrientation(sword, picture(sword), 'fesswise');
    expect(blazon(flat)).toBe('Azure, a sword fesswise Or.');
    expect(setOrientation(flat, picture(flat), null)).toEqual(sword);
    expect(blazon(setOrientation(setCharge(DEFAULT_DESIGN, 'picture', 'crescent'), [0], 'fesswise-reversed'))).toBe('Azure, a decrescent Or.');
    // A swap keeps the orientation where the new charge takes it (§0.2.7), and drops it where it doesn't.
    expect(groupAt(setCharge(flat, 'picture', 'key'), [0]).item).toMatchObject({ charge: 'key', orientation: 'fesswise' });
    expect(groupAt(setCharge(flat, 'picture', 'mullet'), [0]).item).toMatchObject({ charge: 'mullet', orientation: null });
    expect(groupAt(setCharge(flat, 'picture', 'lion'), [0]).item).toMatchObject({ charge: 'lion', orientation: null });
  });

  it('facing, the head and pairs (PLAN-D §0.3.10)', () => {
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    const values = <T,>(cs: ReadonlyArray<{ value: T; allowed: boolean }>) => cs.map((c) => [c.value, c.allowed]);
    expect(values(facingChoices(lion, picture(lion)))).toEqual([['to-dexter', true], ['to-sinister', true], ['affronty', false]]);
    expect(values(gazeChoices(lion, picture(lion)))).toEqual([[null, true], ['guardant', false], ['regardant', false]]);
    expect(facingChoices(setCharge(DEFAULT_DESIGN, 'picture', 'rose'), [0])).toEqual([]);
    expect(pairChoices(lion, picture(lion))).toEqual([]);
    const contourny = setFacing(lion, picture(lion), 'to-sinister');
    expect(blazon(contourny)).toBe('Azure, a lion contourny Or.');
    expect(setFacing(contourny, picture(lion), 'to-dexter')).toEqual(lion);
    // A swap keeps the facing where the new charge faces too (§0.2.7), and drops it where it doesn't.
    expect(groupAt(setCharge(contourny, 'picture', 'eagle'), [0]).item).toMatchObject({ charge: 'eagle', facing: 'to-sinister' });
    expect(groupAt(setCharge(contourny, 'picture', 'rose'), [0]).item).toMatchObject({ charge: 'rose', facing: null });

    // Two that face, side by side: the same way, facing each other (the beast's word), back to back; in pale they must be laid in fess first.
    const two = setLayout(setCount(lion, picture(lion), 2), picture(lion), 'in-fess');
    expect(values(pairChoices(two, picture(two)))).toEqual([['same', true], ['combattant', true], ['addorsed', true]]);
    expect(pairChoices(setLayout(two, picture(two), 'in-pale'), picture(two)).filter((c) => !c.allowed).map((c) => c.value)).toEqual(['combattant', 'addorsed']);
    const combattant = setPair(setFacing(two, picture(two), 'to-sinister'), picture(two), 'combattant');
    expect(blazon(combattant)).toBe('Azure, two lions combattant Or.');
    expect(groupAt(combattant, picture(two)).item).toMatchObject({ facing: 'to-dexter' });
    expect(facingChoices(combattant, picture(two)).find((c) => c.value === 'to-sinister')!.allowed).toBe(false);
    expect(shownLayoutKey(combattant, picture(two))).toBe('in-fess');
    expect(setPair(combattant, picture(two), 'same')).toEqual(two);
    expect(groupAt(setLayout(combattant, picture(two), 'in-pale'), picture(two)).arrangement).toEqual({ k: 'line', dir: 'pale' });
    // Eagles facing each other are respectant; a swap to a rose sets the two the same way where they stood.
    const eagles = setCharge(combattant, 'picture', 'eagle');
    expect(blazon(eagles)).toBe('Azure, two eagles respectant Or.');
    expect(values(pairChoices(eagles, picture(eagles))).map(([v]) => v)).toEqual(['same', 'respectant', 'addorsed']);
    expect(groupAt(setCharge(combattant, 'picture', 'rose'), picture(two)).arrangement).toEqual({ k: 'line', dir: 'fess' });
    expect(blazon(setPair(two, picture(two), 'addorsed'))).toBe('Azure, two lions addorsed Or.');

    // Either side of a pale; not beside a fess, nor as pictures in chief.
    const pale = setCharge(setOrdinary(DEFAULT_DESIGN, 'pale'), 'picture', 'lion');
    const flanking = setCount(pale, picture(pale), 2);
    expect(blazon(setPair(flanking, picture(flanking), 'addorsed'))).toBe('Azure, a pale between two lions addorsed Or.');
    const fess = setCharge(setOrdinary(DEFAULT_DESIGN, 'fess'), 'picture', 'lion');
    const besideFess = setCount(fess, picture(fess), 2);
    expect(pairChoices(besideFess, picture(besideFess)).filter((c) => !c.allowed).map((c) => c.value)).toEqual(['combattant', 'addorsed']);
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
    expect(layerChoices(chief).map((c) => c.value)).toEqual(['co-primary', 'on-picture', 'around', 'in-chief', 'in-base', 'in-canton', 'on-ordinary', 'on-chief', 'bordure', 'on-bordure', 'peripheral', 'overall']);
    expect(['in-chief', 'in-base', 'in-canton'].map((k) => allowed(chief, k as LayerKey))).toEqual([false, true, false]);
    expect(issueStep(chief, { code: 'tincture', reason: 'contrast', part: 'body', at: { k: 'group', path: pathOfPlace(chief, 'chief')! }, message: '', slots: [] })).toBe('chief');
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
    expect(pathOfPlace(bordered, 'bordure')).not.toBeNull();
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
    expect(pathOfPlace(setOrdinary(bordered, 'fess'), 'bordure')).not.toBeNull();
    expect(blazon(setOrdinary(bordered, 'pile'))).toMatch(/pile/);
    const chiefed = addLayer(band, 'chief');
    // A chief chosen as the band replaces the top band: one chief only.
    expect(setOrdinary(chiefed, 'chief').groups.filter((g) => g.item.k === 'ordinary' && g.item.type === 'chief')).toHaveLength(1);
    // With no band the bordure stands in its place (step 2): re-placed, not dropped.
    const alone = setOrdinary(bordered, null);
    expect(alone.groups.map((g) => g.item.k === 'ordinary' && g.item.type)).toEqual(['bordure']);
    expect(ordinaryPath(alone)).toEqual([0]);
  });

  it('are shown on their own card, except a top band beside a border alone, which becomes the band (step 2)', () => {
    const chiefed = addLayer(band, 'chief');
    expect(addedLayerStep(band, chiefed, 'chief')).toBe('chief');
    const border = setOrdinary(DEFAULT_DESIGN, 'bordure');
    const withChief = addLayer(border, 'chief');
    expect(ordinaryPath(withChief) && groupAt(withChief, ordinaryPath(withChief)!).item).toMatchObject({ k: 'ordinary', type: 'chief' });
    expect(addedLayerStep(border, withChief, 'chief')).toBe('ordinary');
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
    expect(pathOfPlace(chief, 'in-chief')).not.toBeNull();
    const base = addLayer(lion, 'in-base');
    expect(blazon(base)).toBe('Azure, a lion and in base a mullet Or.');
    expect(assess(base).status).toBe('valid');
    expect(issueStep(base, { code: 'tincture', reason: 'contrast', part: 'body', at: { k: 'group', path: pathOfPlace(base, 'in-base')! }, message: '', slots: [] })).toBe('in-base');
    expect(blazon(addLayer(lion, 'in-canton'))).toBe('Azure, a lion and in canton a mullet Or.');
    expect(removeLayer(base, 'in-base')).toEqual(lion);
  });

  it('stand alone: one group beside the main one, and not beside pictures around the band', () => {
    const chief = addLayer(lion, 'in-chief');
    expect(allowed(chief, 'in-base')).toMatchObject({ allowed: false, reason: 'Only one group of pictures can stand beside or around the main one — remove the others first.' });
    const around = setCharge(chevron, 'picture', 'rose');
    expect(allowed(around, 'in-chief')).toMatchObject({ allowed: false, reason: 'The picture is set around the chevron: pictures can stand around the band or along the top, not both — move the picture onto the band first.' });
  });

  it('take their count and charge like any pictures, and give the picture beside them the room they leave', () => {
    let d = addLayer(lion, 'in-chief');
    const path = () => pathOfPlace(d, 'in-chief')!;
    const three = countChoices(d, path()).find((c) => c.value === 3)!;
    expect(three.allowed).toBe(true);
    d = three.allowed ? three.design : d;
    d = setCharge(d, 'in-chief', 'crescent');
    expect(blazon(d)).toBe('Azure, a lion and in chief three crescents Or.');
    const layouts = layoutChoices(d, path());
    expect(layouts.mode === 'choose' && layouts.choices.map((c) => c.value)).toEqual(['in-chief', 'rows-2-1@chief', 'rows-1-2@chief']);
    expect(layoutChoices(addLayer(lion, 'in-canton'), pathOfPlace(addLayer(lion, 'in-canton'), 'in-canton')!)).toEqual({ mode: 'fixed', note: 'A single charge in canton stands alone there.' });
    expect(countChoices(d, picture(d)).filter((c) => c.allowed).length).toBeGreaterThan(3);
  });

  it('stay through changes beneath them, and become the picture when nothing is left for them to stand beside', () => {
    const chief = addLayer(chevron, 'in-chief');
    // A new picture goes on the chevron, since pictures around it and in chief can't both be set.
    const pictured = setCharge(chief, 'picture', 'rose');
    expect(blazon(pictured)).toMatch(/^Azure, on a chevron argent a rose \w+ and in chief a mullet Or\.$/);
    expect(pathOfPlace(setOrdinary(chief, 'fess'), 'in-chief')).not.toBeNull();
    // With no band and no picture, the mullet in chief is the picture itself (SENA App I1).
    const alone = setOrdinary(chief, null);
    expect(blazon(alone)).toBe('Azure, in chief a mullet Or.');
    expect(picturePath(alone)).not.toBeNull();
    // A band added beside a picture and pictures in chief makes the picture go around it: the pictures in chief give way.
    const banded = setOrdinary(addLayer(lion, 'in-chief'), 'pale');
    expect(pathOfPlace(banded, 'in-chief')).toBeNull();
  });
});

describe('pictures set around the picture', () => {
  const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
  const allowed = (d: Design, key: LayerKey) => layerChoices(d).find((c) => c.value === key);

  it('are offered beside a picture on the background with no band: three, two and one, in a colour that works', () => {
    expect(allowed(DEFAULT_DESIGN, 'around')).toMatchObject({ allowed: false, reason: 'Pick a picture on the background first — more pictures can then be set around it.' });
    expect(allowed(setOrdinary(DEFAULT_DESIGN, 'fess'), 'around')).toMatchObject({ allowed: false, reason: 'Pictures are set around the fess — remove the band to set pictures around a picture instead.' });
    const around = addLayer(lion, 'around');
    expect(blazon(around)).toBe('Azure, a lion between three mullets Or.');
    expect(assess(around).status).toBe('valid');
    expect(issueStep(around, { code: 'tincture', reason: 'contrast', part: 'body', at: { k: 'group', path: pathOfPlace(around, 'around')! }, message: '', slots: [] })).toBe('around');
    expect(blazon(setCharge(around, 'around', 'crescent'))).toBe('Azure, a lion between three crescents Or.');
    expect(removeLayer(around, 'around')).toEqual(lion);
    // One group stands around or beside the picture, not both.
    expect(allowed(around, 'in-chief')).toMatchObject({ allowed: false, reason: 'Only one group of pictures can stand beside or around the main one — remove the others first.' });
    expect(allowed(addLayer(lion, 'in-chief'), 'around')).toMatchObject({ allowed: false });
  });

  it('take the counts and layouts Table 7 gives them around a picture, and the picture keeps to one or two', () => {
    const around = addLayer(lion, 'around');
    const path = pathOfPlace(around, 'around')!;
    expect(layoutChoices(around, path)).toEqual({ mode: 'fixed', note: 'Three charges around the picture stand two above and one below.' });
    const counts = countChoices(around, path);
    expect(counts.filter((c) => c.allowed).map((c) => c.value)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(counts[0]).toMatchObject({ allowed: false, reason: 'Pictures around the picture come in two, three, four, five, six, seven or eight, not a single charge.' });
    const four = counts.find((c) => c.value === 4)!;
    const fourDesign = four.allowed ? four.design : around;
    expect(blazon(fourDesign)).toBe('Azure, a lion between four mullets in saltire Or.');
    const layouts = layoutChoices(fourDesign, pathOfPlace(fourDesign, 'around')!);
    expect(layouts.mode === 'choose' && layouts.choices.map((c) => c.value)).toEqual(['in-saltire', 'in-cross', 'rows-2-2']);
    const picture = countChoices(around, picturePath(around)!);
    expect(picture.filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2]);
    expect(picture[2]).toMatchObject({ allowed: false, reason: 'Pictures can be set around one picture, or two side by side, one above the other or crossed — remove the pictures around it for more.' });
  });

  it('give way to a band, and become the picture when it is removed', () => {
    const around = addLayer(lion, 'around');
    expect(blazon(setOrdinary(around, 'fess'))).toBe('Azure, a fess between two lions Or.');
    expect(blazon(setCharge(around, 'picture', null))).toBe('Azure, three mullets Or.');
    expect(placementChoices(around, picturePath(around)!).find((c) => c.value === 'ordinary')).toMatchObject({ allowed: false });
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
    expect(groupAt(chief, pathOfPlace(chief, 'on-chief')!)).toMatchObject({ role: 'tertiary', count: 1, arrangement: { k: 'host' } });
    expect(assess(chief).status).toBe('valid');
    const bordure = addLayer(chief, 'on-bordure');
    // The top band starts in a metal the band doesn't have, so the two can be told apart; with none left, the border takes the first that works.
    expect(blazon(bordure)).toMatch(/^Azure, a pale Or, on a chief argent an? \w+ \w+, on a bordure Or an? \w+ \w+\.$/);
    expect(assess(bordure).status).toBe('valid');
  });

  it('take a charge, a count and a colour, and lay out along the border whatever the count', () => {
    let d = setCharge(framed, 'on-bordure', 'mullet');
    const path = pathOfPlace(d, 'on-bordure')!;
    expect(countChoices(d, path).filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    d = setCount(d, path, 8);
    expect(blazon(d)).toMatch(/on a bordure \w+ eight mullets \w+\.$/);
    expect(layoutChoices(d, pathOfPlace(d, 'on-bordure')!)).toMatchObject({ mode: 'host' });
    expect(blazon(setCharge(d, 'on-bordure', 'rose'))).toMatch(/eight roses/);
    expect(pathOfPlace(setCharge(d, 'on-bordure', null), 'on-bordure')).toBeNull();
  });

  it('are judged against the colour of the border they sit on, not the background', () => {
    const d = addLayer(framed, 'on-bordure');
    const border = groupAt(d, pathOfPlace(d, 'bordure')!).paint;
    const on = pathOfPlace(d, 'on-bordure')!;
    const tincture = border.k === 'tincture' ? border.t : null;
    const same = groupTinctureChoices(d, on).find((c) => c.value === tincture)!;
    expect(same.allowed).toBe(false);
    expect(!same.allowed && same.reason).toMatch(/on the .* bordure/);
    // Azure charges are fine on an Or border though the field behind is azure.
    expect(groupTinctureChoices(setGroupTincture(d, pathOfPlace(d, 'bordure')!, 'or'), on).find((c) => c.value === 'azure')?.allowed).toBe(true);
  });

  it('are kept when the band changes, and go with the top band or border they sit on', () => {
    const carried = setCount(addLayer(addLayer(framed, 'on-chief'), 'on-bordure'), pathOfPlace(addLayer(addLayer(framed, 'on-chief'), 'on-bordure'), 'on-chief')!, 2);
    for (const type of ['fess', 'bend', 'chevron'] as const) {
      const changed = setOrdinary(carried, type);
      expect(pathOfPlace(changed, 'on-chief'), type).not.toBeNull();
      expect(pathOfPlace(changed, 'on-bordure'), type).not.toBeNull();
    }
    expect(pathOfPlace(removeLayer(carried, 'chief'), 'on-chief')).toBeNull();
    expect(pathOfPlace(removeLayer(carried, 'chief'), 'on-bordure')).not.toBeNull();
    // With no band, the chief stands in its place and keeps the pictures on it.
    const alone = setOrdinary(carried, null);
    expect(simpleParts(alone).ordinary?.group.item).toMatchObject({ type: 'chief' });
    expect(simpleParts(alone).picture).toMatchObject({ placement: 'ordinary' });
    expect(pathOfPlace(alone, 'on-bordure')).not.toBeNull();
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
    expect(countChoices(d, extra(d)).filter((c) => c.allowed).map((c) => c.value)).toEqual([1, 2, 3, 4, 5, 6]);
    d = setCount(d, extra(d), 3);
    expect(groupAt(d, extra(d)).count).toBe(3);
    // Swapping and recolouring either picture leaves the other alone.
    d = setCharge(d, 'on-ordinary', 'heart');
    expect(groupAt(d, extra(d)).item).toMatchObject({ charge: 'heart' });
    expect(groupAt(d, picture(d)).item).toMatchObject({ charge: 'mullet' });
    expect(issueStep(d, { code: 'tincture', reason: 'contrast', part: 'body', at: { k: 'group', path: extra(d) }, message: '', slots: [] })).toBe('on-ordinary');
    // Changing the band to a chief keeps both pictures.
    const chief = setOrdinary(d, 'chief');
    expect(groupAt(chief, picture(chief))).toMatchObject({ role: 'primary', relation: null });
    expect(groupAt(chief, extra(chief))).toMatchObject({ role: 'tertiary', count: 3 });
    // Removing the band takes the extra pictures with it; removing them leaves the rest.
    expect(onOrdinaryPath(setOrdinary(d, null))).toBeNull();
    expect(picturePath(setOrdinary(d, null))).not.toBeNull();
    const removed = removeLayer(d, 'on-ordinary');
    expect(onOrdinaryPath(removed)).toBeNull();
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
    expect(onOrdinaryPath(promoted)).toBeNull();
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

describe('a new band starts apart from what it meets', () => {
  it('lies across a gold lion in another metal, and beside a gold band in another metal, while one is left', () => {
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    expect(blazon(addLayer(lion, 'overall'))).toBe('Azure, a lion Or and overall a bend argent.');
    expect(blazon(addLayer(setOrdinary(DEFAULT_DESIGN, 'bend'), 'chief'))).toBe('Azure, a bend Or, a chief argent.');
  });
});

describe('lines on the band, the top band and the border', () => {
  const lineOf = (d: Design, path: GroupPath) => { const i = groupAt(d, path).item; return i.k === 'ordinary' ? i.lines : null; };

  it('a line is the blazon\'s bare meaning of it, and the side row widens or narrows it', () => {
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const path = ordinaryPath(fess)!;
    expect(edgeSideChoices(fess, { k: 'group', path })).toEqual([]);
    const embattled = setOrdinaryLine(fess, path, 'embattled');
    expect(lineOf(embattled, path)).toEqual({ a: 'embattled', b: 'plain' });
    expect(blazon(embattled)).toMatch(/a fess embattled /);
    expect(edgeSideChoices(embattled, { k: 'group', path }).map((c) => c.value)).toEqual(['both', 'a', 'b']);
    const both = setOrdinaryEdgeSide(embattled, path, 'both');
    expect(blazon(both)).toMatch(/a fess embattled counter-embattled /);
    expect(blazon(setOrdinaryEdgeSide(embattled, path, 'b'))).toMatch(/a fess embattled on the lower edge /);
    expect(lineOf(setOrdinaryLine(both, path, 'wavy'), path)).toEqual({ a: 'wavy', b: 'wavy' });
    expect(lineOf(setOrdinaryLine(both, path, 'plain'), path)).toEqual({ a: 'plain', b: 'plain' });
    // A cross has one line.
    const cross = setOrdinaryLine(setOrdinary(DEFAULT_DESIGN, 'cross'), ordinaryPath(setOrdinary(DEFAULT_DESIGN, 'cross'))!, 'wavy');
    expect(edgeSideChoices(cross, { k: 'group', path: ordinaryPath(cross)! })).toEqual([]);
  });

  it('offers a line only to hosts that take it', () => {
    const chief = setOrdinary(DEFAULT_DESIGN, 'chief');
    const target = { k: 'group', path: ordinaryPath(chief)! } as const;
    const byLine = (d: Design, t: typeof target) => new Map(lineChoices(d, t).map((c) => [c.value, c.allowed]));
    expect(byLine(chief, target).get('dancetty')).toBeUndefined();
    expect(byLine(chief, target).get('enarched')).toBe(true);
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const fessTarget = { k: 'group', path: ordinaryPath(fess)! } as const;
    expect(byLine(fess, fessTarget).get('dancetty')).toBe(true);
  });

  it('setOrdinary keeps an edge the new band takes, and drops one it can\'t', () => {
    const fess = setOrdinary(DEFAULT_DESIGN, 'fess');
    const wavy = setOrdinaryLine(fess, ordinaryPath(fess)!, 'wavy');
    const bend = setOrdinary(wavy, 'bend');
    expect(lineOf(bend, ordinaryPath(bend)!)).toEqual({ a: 'wavy', b: 'wavy' });
    const cross = setOrdinary(wavy, 'cross');
    expect(lineOf(cross, ordinaryPath(cross)!)).toEqual({ a: 'wavy', b: 'wavy' });
    const enarched = setOrdinaryLine(fess, ordinaryPath(fess)!, 'enarched');
    const pale = setOrdinary(enarched, 'pale');
    expect(lineOf(pale, ordinaryPath(pale)!)).toEqual({ a: 'plain', b: 'plain' });
  });

  it('a top band and a border take a line of their own', () => {
    const framed = addLayer(addLayer(setOrdinary(DEFAULT_DESIGN, 'fess'), 'chief'), 'bordure');
    const withChief = setOrdinaryLine(framed, pathOfPlace(framed, 'chief')!, 'embattled');
    const both = setOrdinaryLine(withChief, pathOfPlace(withChief, 'bordure')!, 'engrailed');
    expect(blazon(both)).toMatch(/a chief embattled .* a bordure engrailed /);
  });
});

describe('the outline of the band: edged, or cotised', () => {
  const itemOf = (d: Design) => { const i = groupAt(d, ordinaryPath(d)!).item; if (i.k !== 'ordinary') throw new Error('not an ordinary'); return i; };
  const bend = (): Design => setOrdinary(DEFAULT_DESIGN, 'bend');

  it('setOrdinaryOutline keeps the band and gives it cotises, in its own tincture to begin with', () => {
    const d = bend();
    const path = ordinaryPath(d)!;
    const cotised = setOrdinaryOutline(d, path, 'cotised');
    expect(outlineAt(cotised, path)).toBe('cotised');
    expect(itemOf(cotised)).toMatchObject({ type: 'bend', cotised: { count: 1, paint: { k: 'tincture', t: 'or' }, line: 'plain' }, fimbriated: null });
    expect(blazon(cotised)).toBe('Azure, a bend cotised Or.');
    expect(blazon(setOrdinaryOutline(cotised, path, 'doubly-cotised'))).toBe('Azure, a bend doubly cotised Or.');
    // Edged is the other outline, in a tincture other than the band's own.
    const edged = setOrdinaryOutline(cotised, path, 'fimbriated');
    expect(itemOf(edged)).toMatchObject({ cotised: null, fimbriated: { k: 'tincture' } });
    expect(itemOf(edged).fimbriated).not.toEqual({ k: 'tincture', t: 'or' });
    expect(setOrdinaryOutline(edged, path, 'none')).toEqual(d);
  });

  it('offers the outline to a central band only, and blocks what the rules refuse', () => {
    const d = bend();
    expect(outlineChoices(d, ordinaryPath(d)!).map((c) => [c.value, c.allowed])).toEqual([['none', true], ['fimbriated', true], ['cotised', true], ['doubly-cotised', true], ['triply-cotised', true]]);
    const chief = addLayer(d, 'chief');
    expect(outlineChoices(chief, pathOfPlace(chief, 'chief')!)).toEqual([]);
    // A band raised can't be edged (LoAR 06/2005, Mathild), though it can be cotised.
    const raised = setOrdinaryBandPosition(d, ordinaryPath(d)!, 'enhanced');
    const choices = new Map(outlineChoices(raised, ordinaryPath(raised)!).map((c) => [c.value, c]));
    expect(choices.get('fimbriated')).toMatchObject({ allowed: false, reason: expect.stringContaining('Mathild') });
    expect(choices.get('cotised')!.allowed).toBe(true);
  });

  it('the outline tincture picks the first that stands out, and blocks the ones that do not', () => {
    const d = setOrdinaryOutline(bend(), ordinaryPath(bend())!, 'cotised');
    const path = ordinaryPath(d)!;
    // Cotises of the colour of the field lie on it: azure on azure.
    const choices = new Map(outlineTinctureChoices(d, path).map((c) => [c.value, c.allowed]));
    expect(choices.get('azure')).toBe(false);
    expect(choices.get('argent')).toBe(true);
    expect(choices.has('counterchanged')).toBe(false);
    expect(outlineTinctureOf(setOutlineTincture(d, path, 'argent'), path)).toBe('argent');
    // On a divided field the cotises may be counterchanged.
    const divided = setOrdinaryOutline(setOrdinary(setDivision(DEFAULT_DESIGN, 'per-pale'), 'bend'), ordinaryPath(setOrdinary(setDivision(DEFAULT_DESIGN, 'per-pale'), 'bend'))!, 'cotised');
    expect(outlineTinctureChoices(divided, ordinaryPath(divided)!).some((c) => c.value === 'counterchanged')).toBe(true);
  });

  it('the cotises have a line of their own, and follow the band\'s line when they had followed it', () => {
    const d = setOrdinaryOutline(bend(), ordinaryPath(bend())!, 'cotised');
    const path = ordinaryPath(d)!;
    const wavy = setOrdinaryLine(d, path, 'wavy');
    expect(itemOf(wavy)).toMatchObject({ lines: { a: 'wavy', b: 'wavy' }, cotised: { line: 'wavy' } });
    expect(blazon(wavy)).toBe('Azure, a bend wavy cotised Or.');
    // Plain cotises beside a wavy band.
    const plainCotises = setCotiseLine(wavy, path, 'plain');
    expect(blazon(plainCotises)).toBe('Azure, a bend wavy cotised plain Or.');
    // A band's new line leaves the cotises that had their own.
    expect(itemOf(setOrdinaryLine(plainCotises, path, 'embattled')).cotised).toMatchObject({ line: 'plain' });
    expect(lineChoices(d, { k: 'cotises', path }).map((c) => c.value)).toContain('dancetty');
    expect(lineChoices(bend(), { k: 'cotises', path: ordinaryPath(bend())! })).toEqual([]);
  });

  it('setOrdinary carries the outline to a band that may have it, and drops it otherwise', () => {
    const d = setOrdinaryOutline(bend(), ordinaryPath(bend())!, 'doubly-cotised');
    expect(outlineAt(setOrdinary(d, 'fess'), ordinaryPath(setOrdinary(d, 'fess'))!)).toBe('doubly-cotised');
    const chief = setOrdinary(d, 'chief');
    expect(chief.groups.every((g) => g.item.k !== 'ordinary' || (g.item.cotised === null && g.item.fimbriated === null))).toBe(true);
  });

  it('Hollow is offered to a cross and a saltire only (a bend shows it blocked, with SENA A3C), and not with an edging', () => {
    const cross = setOrdinary(DEFAULT_DESIGN, 'cross');
    const path = ordinaryPath(cross)!;
    expect(toggleChoices(cross, path).map((c) => c.value)).toContain('voided');
    expect(toggleChoices(bend(), ordinaryPath(bend())!).find((c) => c.value === 'voided')).toMatchObject({ allowed: false, reason: expect.stringContaining("can't be voided") });
    const hollow = setOrdinaryToggle(cross, path, 'voided', true);
    expect(blazon(hollow)).toBe('Azure, a cross voided Or.');
    const edging = outlineChoices(hollow, path).find((c) => c.value === 'fimbriated')!;
    expect(edging).toMatchObject({ allowed: false, reason: expect.stringContaining('voided') });
    expect(outlineChoices(hollow, path).find((c) => c.value === 'cotised')!.allowed).toBe(true);
  });
});

describe('corner and edge shapes: the More shapes row and any number of them beside the band', () => {
  it('setOrdinary to every MORE_ORDINARIES type never throws, alone, beside a picture or a chief, and the band step shows it', () => {
    const lion = setCharge(DEFAULT_DESIGN, 'picture', 'lion');
    const chiefed = addLayer(setOrdinary(DEFAULT_DESIGN, 'fess'), 'chief');
    for (const type of MORE_ORDINARIES) {
      for (const start of [DEFAULT_DESIGN, lion, chiefed, setOrdinary(DEFAULT_DESIGN, 'chief')]) {
        const d = setOrdinary(start, type);
        expect(groupAt(d, ordinaryPath(d)!).item, type).toMatchObject({ k: 'ordinary', type });
      }
    }
    expect(placementLabel(setOrdinary(lion, 'base'), 'field')).toBe('Above the bottom bar');
    expect(placementLabel(setOrdinary(lion, 'orle'), 'field')).toBe('Within the inner border');
    expect(placementLabel(setOrdinary(lion, 'flaunches'), 'field')).toBe('Between the side curves');
  });

  it('a tressure is drawn double, then triple at a click (a single one is an orle); a gore turns to the right; the dexter and sinister points are never offered', () => {
    const lion = setGroupTincture(setCharge(DEFAULT_DESIGN, 'picture', 'lion'), picturePath(setCharge(DEFAULT_DESIGN, 'picture', 'lion'))!, 'or');
    const tressure = setOrdinary(lion, 'tressure');
    const path = ordinaryPath(tressure)!;
    expect(groupAt(tressure, path).count).toBe(2);
    expect(blazon(tressure)).toMatch(/^Azure, a lion (Or )?within a double tressure \w+\.$/);
    expect(ordinaryCountChoices(tressure, path)).toEqual([{ value: 2, allowed: true }, { value: 3, allowed: true }]);
    const triple = setOrdinaryNumber(tressure, path, 3);
    expect(blazon(triple)).toMatch(/within a triple tressure/);
    expect(setOrdinaryNumber(triple, ordinaryPath(triple)!, 1)).toBe(triple);
    const orle = setOrdinary(triple, 'orle');
    expect(groupAt(orle, ordinaryPath(orle)!).count).toBe(1);
    expect(ordinaryCountChoices(orle, ordinaryPath(orle)!)).toEqual([]);
    const gore = setOrdinary(lion, 'gore');
    expect(toggleChoices(gore, ordinaryPath(gore)!).map((c) => c.value)).toEqual(['sinister']);
    expect(blazon(setOrdinaryToggle(gore, ordinaryPath(gore)!, 'sinister', true))).toMatch(/and a gore sinister \w+\.$/);
    expect(MORE_ORDINARIES.some((t) => REFUSED_ORDINARIES.includes(t))).toBe(false);
    const card = addLayer(setOrdinaryTincture(setOrdinary(DEFAULT_DESIGN, 'fess'), 'or'), 'peripheral');
    expect(peripheralItemChoices(card, 'peripheral-0').map((c) => c.value)).toEqual(['base', 'point', 'canton', 'quarter', 'gyron', 'orle', 'tressure', 'flaunches', 'gore', 'label', 'mount', 'trimount']);
    const asTressure = setPeripheralItem(card, 'peripheral-0', 'tressure');
    expect(groupAt(asTressure, pathOfPlace(asTressure, 'peripheral-0')!).count).toBe(2);
  });

  it('adds one after another as their own cards, each a type the shield has none of, and removes each', () => {
    const band = setOrdinaryTincture(setOrdinary(DEFAULT_DESIGN, 'bend'), 'or');
    expect(layerChoices(DEFAULT_DESIGN).find((c) => c.value === 'peripheral')).toMatchObject({ allowed: false });
    const one = addLayer(band, 'peripheral');
    expect(layersIn(one)).toEqual(['peripheral-0']);
    expect(addedLayerStep(band, one, 'peripheral')).toBe('peripheral-0');
    const two = addLayer(one, 'peripheral');
    const three = addLayer(two, 'peripheral');
    expect(layersIn(three)).toEqual(['peripheral-0', 'peripheral-1', 'peripheral-2']);
    const types = three.groups.flatMap((g) => (g.item.k === 'ordinary' && g.role === 'peripheral' ? [g.item.type] : []));
    expect(new Set(types).size).toBe(3);
    expect(assess(three).status).toBe('valid');
    expect(layersIn(removeLayer(three, 'peripheral-1'))).toEqual(['peripheral-0', 'peripheral-1']);
    expect(removeLayer(three, 'peripheral-1').groups).toHaveLength(3);
  });

  it('changes a card to another type, blocking the ones the shield already has and those that break a rule', () => {
    const d = addLayer(setOrdinaryTincture(setOrdinary(DEFAULT_DESIGN, 'fess'), 'or'), 'peripheral');
    const canton = setPeripheralItem(d, 'peripheral-0', 'canton');
    expect(blazon(canton)).toMatch(/^Azure, a fess Or and a canton \w+\.$/);
    const sinister = setOrdinaryToggle(canton, pathOfPlace(canton, 'peripheral-0')!, 'sinister', true);
    expect(blazon(sinister)).toMatch(/a canton sinister/);
    expect(toggleChoices(canton, pathOfPlace(canton, 'peripheral-0')!).map((c) => c.value)).toEqual(['sinister']);
    const both = setPeripheralItem(addLayer(canton, 'peripheral'), 'peripheral-0', 'base');
    expect(peripheralItemChoices(both, 'peripheral-0').find((c) => c.value === 'canton')).toMatchObject({ allowed: false, reason: expect.stringMatching(/already a canton/) });
    // Something overall over a corner shape breaks SENA App I4.
    const overall = addLayer(setCharge(DEFAULT_DESIGN, 'picture', 'lion'), 'overall');
    expect(layerChoices(overall).find((c) => c.value === 'peripheral')?.allowed).toBe(false);
  });

  it('a base or canton picked as the band stays the band when another is added, and a chief added beside one is a card', () => {
    const canton = setOrdinary(DEFAULT_DESIGN, 'quarter');
    const added = addLayer(canton, 'peripheral');
    expect(groupAt(added, ordinaryPath(added)!).item).toMatchObject({ type: 'quarter' });
    expect(addedLayerStep(canton, added, 'peripheral')).toBe('peripheral-0');
    const chiefed = addLayer(canton, 'chief');
    expect(groupAt(chiefed, ordinaryPath(chiefed)!).item).toMatchObject({ type: 'quarter' });
    expect(layersIn(chiefed)).toEqual(['chief']);
  });
});
